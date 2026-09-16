import os
import json
import argparse
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader

# CNN architecture
class ActivityCNNLSTM(nn.Module):
    def __init__(self, num_classes):
        super(ActivityCNNLSTM, self).__init__()
        # Input shape: (Batch, Channels=6, Length=128)
        self.conv1 = nn.Conv1d(in_channels=6, out_channels=64, kernel_size=5, padding=2)
        self.relu1 = nn.ReLU()
        self.pool1 = nn.MaxPool1d(kernel_size=2)
        self.drop1 = nn.Dropout(0.3)
        
        self.conv2 = nn.Conv1d(in_channels=64, out_channels=128, kernel_size=5, padding=2)
        self.relu2 = nn.ReLU()
        self.pool2 = nn.MaxPool1d(kernel_size=2)
        self.drop2 = nn.Dropout(0.3)
        
        # After 2x MaxPool1d(2), sequence length is 128 / 4 = 32
        # Input to LSTM should be (Batch, Seq, Features) -> (Batch, 32, 128)
        self.lstm = nn.LSTM(input_size=128, hidden_size=128, num_layers=1, batch_first=True)
        
        self.fc = nn.Linear(128, num_classes)

    def forward(self, x):
        # x is (Batch, 6, 128)
        x = self.drop1(self.pool1(self.relu1(self.conv1(x))))
        x = self.drop2(self.pool2(self.relu2(self.conv2(x))))
        # x is now (Batch, 128, 32)
        
        # Transpose for LSTM: (Batch, Seq_len, Features)
        x = x.transpose(1, 2)
        
        # LSTM outputs: out is (Batch, Seq_len, Hidden), (h_n, c_n)
        lstm_out, _ = self.lstm(x)
        
        # Get the output from the last time step
        last_out = lstm_out[:, -1, :] # (Batch, Hidden)
        
        x = self.fc(last_out)
        return x

def load_uci_har_group(data_dir, group_name):
    print(f"Loading {group_name} data...")
    y_path = os.path.join(data_dir, group_name, f'y_{group_name}.txt')
    y = np.loadtxt(y_path, dtype=int)
    
    signal_names = [
        'total_acc_x', 'total_acc_y', 'total_acc_z',
        'body_gyro_x', 'body_gyro_y', 'body_gyro_z'
    ]
    
    signals = []
    for name in signal_names:
        file_path = os.path.join(data_dir, group_name, 'Inertial Signals', f'{name}_{group_name}.txt')
        data = np.loadtxt(file_path, dtype=np.float32)
        signals.append(data)
        
    # Shape: (N, L, C)
    X_raw = np.dstack(signals)
    # Convert to PyTorch format: (N, C, L)
    X_raw = np.transpose(X_raw, (0, 2, 1))
    
    return X_raw, y

def load_and_preprocess_data(data_dir: str):
    labels_path = os.path.join(data_dir, 'activity_labels.txt')
    activity_map = {}
    with open(labels_path, 'r') as f:
        for line in f:
            idx, label = line.strip().split(' ', 1)
            # Map index 1-based to 0-based
            activity_map[int(idx) - 1] = label.lower()
            
    X_train, y_train_int = load_uci_har_group(data_dir, 'train')
    X_test, y_test_int = load_uci_har_group(data_dir, 'test')
    
    # PyTorch expects 0-indexed labels
    y_train = y_train_int - 1
    y_test = y_test_int - 1
    
    return X_train, y_train, X_test, y_test, activity_map

def train(data_dir: str):
    X_train, y_train, X_test, y_test, activity_map = load_and_preprocess_data(data_dir)
    
    # Save mapping
    model_dir = os.path.join(os.path.dirname(__file__), 'model')
    os.makedirs(model_dir, exist_ok=True)
    mapping_path = os.path.join(model_dir, 'label_mapping.json')
    with open(mapping_path, 'w') as f:
        json.dump(activity_map, f)
    print(f"Saved label mapping to {mapping_path}")

    # Create PyTorch datasets
    train_dataset = TensorDataset(torch.tensor(X_train), torch.tensor(y_train, dtype=torch.long))
    test_dataset = TensorDataset(torch.tensor(X_test), torch.tensor(y_test, dtype=torch.long))
    
    train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=64, shuffle=False)
    
    num_classes = len(activity_map)
    model = ActivityCNNLSTM(num_classes)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    epochs = 30
    print("Starting training...")
    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        for inputs, labels in train_loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * inputs.size(0)
            
        epoch_loss = running_loss / len(train_dataset)
        print(f"Epoch {epoch+1}/{epochs} - Loss: {epoch_loss:.4f}")
        
    # Evaluate
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for inputs, labels in test_loader:
            outputs = model(inputs)
            _, predicted = torch.max(outputs, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
            
    accuracy = correct / total
    print(f"\n--- Evaluation Results (Held-out Test Set) ---")
    print(f"Overall Accuracy: {accuracy:.4f}")
    
    # Export to ONNX
    onnx_path = os.path.join(model_dir, 'activity_dl.onnx')
    dummy_input = torch.randn(1, 6, X_train.shape[2])
    torch.onnx.export(model, dummy_input, onnx_path,
                      export_params=True,
                      opset_version=14,
                      do_constant_folding=True,
                      input_names=['input'],
                      output_names=['output'],
                      dynamic_axes={'input': {0: 'batch_size'},
                                    'output': {0: 'batch_size'}})
                                    
    print(f"Saved ONNX model to {onnx_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train DL Activity Classifier")
    parser.add_argument("--data-dir", type=str, required=True, help="Directory containing UCI-HAR Dataset")
    args = parser.parse_args()
    
    train(args.data_dir)
