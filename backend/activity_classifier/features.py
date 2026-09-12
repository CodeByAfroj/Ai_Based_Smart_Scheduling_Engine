import numpy as np
from scipy.fft import fft, fftfreq

def compute_features(window_data: np.ndarray, sample_rate: float = 50.0):
    """
    Computes hand-engineered features for a given window of sensor data.
    
    Args:
        window_data: A numpy array of shape (N, D) where N is the number of samples in the window,
                     and D is the number of channels (e.g., 3 for just accelerometer x,y,z or 6 for accel + gyro).
        sample_rate: The sampling rate of the sensor data in Hz.
        
    Returns:
        A 1D numpy array of computed features.
    """
    if len(window_data) == 0:
        return np.array([])

    features = []
    
    # Time-domain features for each channel
    for channel_idx in range(window_data.shape[1]):
        channel_data = window_data[:, channel_idx]
        
        # Basic stats
        features.append(np.mean(channel_data))
        features.append(np.std(channel_data))
        features.append(np.min(channel_data))
        features.append(np.max(channel_data))
        
        # Signal Magnitude Area (SMA) approximated per channel (absolute sum)
        features.append(np.sum(np.abs(channel_data)))
        
        # Frequency-domain features
        N = len(channel_data)
        # Compute FFT (using absolute value for magnitude)
        yf = fft(channel_data)
        xf = fftfreq(N, 1 / sample_rate)
        
        # Take positive frequencies only
        pos_indices = xf > 0
        if np.any(pos_indices):
            xf_pos = xf[pos_indices]
            yf_mag = np.abs(yf[pos_indices])
            
            # Dominant frequency
            dominant_freq_idx = np.argmax(yf_mag)
            dominant_freq = xf_pos[dominant_freq_idx]
            features.append(dominant_freq)
            
            # Spectral energy (sum of squared magnitudes / N)
            spectral_energy = np.sum(yf_mag ** 2) / N
            features.append(spectral_energy)
        else:
            # Fallback if no positive frequencies (e.g. N too small)
            features.append(0.0)
            features.append(0.0)

    return np.array(features)
