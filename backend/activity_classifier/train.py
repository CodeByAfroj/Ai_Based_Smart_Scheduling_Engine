import os
import json
import argparse
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupKFold, GridSearchCV
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

from features import compute_features

def load_uci_har_group(data_dir, group_name):
    print(f"Loading {group_name} data...")
    y_path = os.path.join(data_dir, group_name, f'y_{group_name}.txt')
    y = np.loadtxt(y_path, dtype=int)
    
    sub_path = os.path.join(data_dir, group_name, f'subject_{group_name}.txt')
    subjects = np.loadtxt(sub_path, dtype=int)
    
    signal_names = [
        'total_acc_x', 'total_acc_y', 'total_acc_z',
        'body_gyro_x', 'body_gyro_y', 'body_gyro_z'
    ]
    
    signals = []
    for name in signal_names:
        file_path = os.path.join(data_dir, group_name, 'Inertial Signals', f'{name}_{group_name}.txt')
        data = np.loadtxt(file_path, dtype=np.float32)
        signals.append(data)
        
    X_raw = np.dstack(signals)
    
    X_features = []
    for i in range(len(X_raw)):
        features = compute_features(X_raw[i], sample_rate=50.0)
        X_features.append(features)
        
    return np.array(X_features), y, subjects

def load_and_preprocess_data(data_dir: str):
    labels_path = os.path.join(data_dir, 'activity_labels.txt')
    activity_map = {}
    with open(labels_path, 'r') as f:
        for line in f:
            idx, label = line.strip().split(' ', 1)
            activity_map[int(idx)] = label.lower()
            
    X_train, y_train_int, groups_train = load_uci_har_group(data_dir, 'train')
    X_test, y_test_int, groups_test = load_uci_har_group(data_dir, 'test')
    
    y_train = np.array([activity_map[i] for i in y_train_int])
    y_test = np.array([activity_map[i] for i in y_test_int])
    
    return X_train, y_train, groups_train, X_test, y_test, groups_test, activity_map

def train(data_dir: str):
    X_train, y_train, groups_train, X_test, y_test, groups_test, activity_map = load_and_preprocess_data(data_dir)
    
    print(f"Extracted features for {len(X_train)} training windows and {len(X_test)} testing windows.")
    print(f"Number of features per window: {X_train.shape[1]}")
    
    # Random Forest Model
    rf = RandomForestClassifier(random_state=42)
    
    # We will tune on the training set using GroupKFold
    param_grid = {
        'n_estimators': [50, 100],
        'max_depth': [10, 20, None]
    }
    
    gkf = GroupKFold(n_splits=3)
    
    print("Tuning hyperparameters using GroupKFold...")
    grid_search = GridSearchCV(
        rf, param_grid, cv=gkf, scoring='f1_macro', n_jobs=-1, verbose=1
    )
    
    grid_search.fit(X_train, y_train, groups=groups_train)
    
    best_model = grid_search.best_estimator_
    print(f"Best parameters: {grid_search.best_params_}")
    
    # Evaluate on the separate UCI-HAR test set
    y_pred = best_model.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average='macro')
    print(f"\n--- Evaluation Results (Held-out Test Set) ---")
    print(f"Overall Accuracy: {acc:.4f}")
    print(f"Macro F1-Score: {f1:.4f}")
    
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    
    # Save the model
    model_dir = os.path.join(os.path.dirname(__file__), 'model')
    os.makedirs(model_dir, exist_ok=True)
    
    joblib_path = os.path.join(model_dir, 'activity_rf.joblib')
    joblib.dump(best_model, joblib_path)
    print(f"\nSaved Joblib model to {joblib_path}")
    
    initial_type = [('float_input', FloatTensorType([None, X_train.shape[1]]))]
    onnx_model = convert_sklearn(best_model, initial_types=initial_type)
    
    onnx_path = os.path.join(model_dir, 'activity_rf.onnx')
    with open(onnx_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    print(f"Saved ONNX model to {onnx_path}")
    
    classes = best_model.classes_.tolist()
    print(f"Model classes: {classes}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Activity Classifier")
    parser.add_argument("--data-dir", type=str, required=True, help="Directory containing UCI-HAR Dataset")
    args = parser.parse_args()
    
    train(args.data_dir)
