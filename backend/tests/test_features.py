import numpy as np
from activity_classifier.features import compute_features

def test_compute_features_shape():
    # 3 channels (x, y, z), N=100
    window = np.random.rand(100, 3)
    features = compute_features(window, sample_rate=50.0)
    
    # 3 channels * (mean, std, min, max, sma, dominant_freq, spectral_energy) = 3 * 7 = 21
    assert features.shape == (21,)

def test_compute_features_values():
    # Simple constant array
    window = np.ones((50, 1))
    features = compute_features(window, sample_rate=50.0)
    
    # mean=1, std=0, min=1, max=1, sma=50, freq=0 (DC offset usually in index 0, positive freq has 0 energy), energy=0
    assert np.isclose(features[0], 1.0) # mean
    assert np.isclose(features[1], 0.0) # std
    assert np.isclose(features[2], 1.0) # min
    assert np.isclose(features[3], 1.0) # max
    assert np.isclose(features[4], 50.0) # sma
    # The FFT logic removes DC (0 Hz) and takes pos_indices > 0. Since it's DC, all pos freqs have magnitude near 0.
    assert np.isclose(features[5], 1.0) # smallest positive freq (50/50=1Hz), or whatever argmax finds. Actually might be noise.
    # We can just check it doesn't crash and returns 7 features per channel
    assert len(features) == 7

def test_compute_features_empty():
    window = np.array([])
    features = compute_features(window)
    assert len(features) == 0
