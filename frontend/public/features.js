/**
 * JS Port of the Python features.py
 * Extracts hand-engineered features matching the training pipeline exactly.
 */

function computeFeatures(windowData, sampleRate = 50.0) {
    if (!windowData || windowData.length === 0) {
        return [];
    }

    const numChannels = windowData[0].length;
    const N = windowData.length;
    const features = [];

    for (let channelIdx = 0; channelIdx < numChannels; channelIdx++) {
        // Extract channel data
        const channelData = windowData.map(row => row[channelIdx]);
        
        // Basic stats
        const sum = channelData.reduce((a, b) => a + b, 0);
        const mean = sum / N;
        features.push(mean);

        const variance = channelData.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / N;
        const std = Math.sqrt(variance);
        features.push(std);

        let min = channelData[0];
        let max = channelData[0];
        let absSum = 0;
        
        for (let i = 0; i < N; i++) {
            if (channelData[i] < min) min = channelData[i];
            if (channelData[i] > max) max = channelData[i];
            absSum += Math.abs(channelData[i]);
        }
        features.push(min);
        features.push(max);
        
        // Signal Magnitude Area (SMA)
        features.push(absSum);

        // Frequency-domain features (FFT)
        // We will implement a simple Discrete Fourier Transform (DFT) for small windows
        // For larger windows in production, a fast Cooley-Tukey FFT should be used.
        const yfMag = new Array(N).fill(0);
        
        for (let k = 0; k < N; k++) {
            let re = 0;
            let im = 0;
            for (let n = 0; n < N; n++) {
                const angle = (2 * Math.PI * k * n) / N;
                re += channelData[n] * Math.cos(angle);
                im -= channelData[n] * Math.sin(angle);
            }
            yfMag[k] = Math.sqrt(re * re + im * im);
        }

        // Frequencies corresponding to DFT output
        // xf = [0, 1, ..., N-1] * (sampleRate / N)
        // scipy.fft.fftfreq handles negative frequencies differently, but we only want positive (k > 0 and k < N/2)
        
        let maxMag = -1;
        let dominantFreqIdx = -1;
        let spectralEnergy = 0;
        let hasPositive = false;
        
        for (let k = 1; k < Math.floor(N / 2); k++) {
            hasPositive = true;
            spectralEnergy += Math.pow(yfMag[k], 2);
            if (yfMag[k] > maxMag) {
                maxMag = yfMag[k];
                dominantFreqIdx = k;
            }
        }
        
        if (hasPositive) {
            const dominantFreq = dominantFreqIdx * (sampleRate / N);
            features.push(dominantFreq);
            features.push(spectralEnergy / N);
        } else {
            features.push(0.0);
            features.push(0.0);
        }
    }

    return features;
}

// Expose to window
window.computeFeatures = computeFeatures;
