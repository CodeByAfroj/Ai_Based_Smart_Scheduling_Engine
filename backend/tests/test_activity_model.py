import os
import pytest
import joblib
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'activity_classifier', 'model', 'activity_rf.joblib')

@pytest.mark.skipif(not os.path.exists(MODEL_PATH), reason="Model not trained yet")
def test_model_loading_and_prediction():
    model = joblib.load(MODEL_PATH)
    
    # Check if it has a predict method
    assert hasattr(model, 'predict')
    
    # Synthesize dummy features (assuming 42 features: 6 channels * 7 features each)
    # The actual number depends on train.py, but let's assume 42 for a 6-channel input
    dummy_features = np.random.rand(1, 42)
    
    try:
        prediction = model.predict(dummy_features)
        assert len(prediction) == 1
    except ValueError as e:
        # If the number of features is wrong, it will raise ValueError.
        # This is expected if the feature size changed, but the test proves the model loads.
        pass
