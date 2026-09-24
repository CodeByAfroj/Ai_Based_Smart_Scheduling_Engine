package com.taskpulse.app;

import android.util.Log;

public class HeuristicActivityTracker {
    private static final String TAG = "HeuristicTracker";
    private static final int BUFFER_SIZE = 128;
    
    public static class ActivityResult {
        public String activity;
        public float confidence;
        public boolean isBusy;
        
        public ActivityResult(String activity, float confidence, boolean isBusy) {
            this.activity = activity;
            this.confidence = confidence;
            this.isBusy = isBusy;
        }
    }
    
    /**
     * Advanced battery-efficient Heuristic based on Magnitude Variance.
     * Works accurately whether the phone is in a pocket, hand, or bag.
     * @param bufferData (1, 6, 128) format float array (accel x,y,z, gyro x,y,z in g-force)
     * @return ActivityResult
     */
    public ActivityResult analyze(float[] bufferData) {
        if (bufferData == null || bufferData.length < 6 * BUFFER_SIZE) {
            return new ActivityResult("unknown", 0.0f, false);
        }
        
        float[] magnitudes = new float[BUFFER_SIZE];
        float sumMag = 0;

        // 1. Calculate the Magnitude of acceleration for each frame
        // Magnitude is rotation-independent, making it perfect for pocket tracking
        for (int i = 0; i < BUFFER_SIZE; i++) {
            float ax = bufferData[0 * BUFFER_SIZE + i];
            float ay = bufferData[1 * BUFFER_SIZE + i];
            float az = bufferData[2 * BUFFER_SIZE + i];
            
            float mag = (float) Math.sqrt(ax * ax + ay * ay + az * az);
            magnitudes[i] = mag;
            sumMag += mag;
        }
        
        // 2. Calculate the Mean Magnitude
        float meanMag = sumMag / BUFFER_SIZE;
        
        // 3. Calculate the Variance of the Magnitude
        float variance = 0;
        for (int i = 0; i < BUFFER_SIZE; i++) {
            float diff = magnitudes[i] - meanMag;
            variance += (diff * diff);
        }
        variance /= BUFFER_SIZE;
        
        Log.d(TAG, "Heuristic - Magnitude Variance: " + variance);
        
        // 4. Classify based on Variance thresholds
        // When completely still, variance is < 0.005
        // When pocket walking, rhythmic motion pushes variance to ~ 0.02 - 0.5
        // When vigorously shaking or running, variance > 0.8
        
        if (variance >= 0.8f) {
            // Very high energy -> Running or vigorous shaking
            return new ActivityResult("running", 0.90f, true);
        } else if (variance >= 0.015f) {
            // Rhythmic pocket motion or hand swinging -> Walking
            return new ActivityResult("walking", 0.85f, true);
        } else if (variance >= 0.005f) {
            // Very slight motion -> Standing / In hand but mostly still
            return new ActivityResult("standing", 0.70f, false);
        } else {
            // Flat on table or perfectly still in pocket -> Sitting
            return new ActivityResult("sitting", 0.95f, false);
        }
    }
}
