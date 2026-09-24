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
     * Analyzes accelerometer and gyroscope data using Heuristic + FFT logic.
     * @param bufferData (1, 6, 128) format float array (accel x,y,z, gyro x,y,z)
     * @return ActivityResult containing detected activity, confidence, and busy status
     */
    public ActivityResult analyze(float[] bufferData) {
        if (bufferData == null || bufferData.length < 6 * BUFFER_SIZE) {
            return new ActivityResult("unknown", 0.0f, false);
        }
        
        // Simple heuristic based on variance/energy (Mocking FFT logic for simplicity)
        float accelEnergy = 0;
        float gyroEnergy = 0;
        
        for (int i = 0; i < BUFFER_SIZE; i++) {
            float ax = bufferData[0 * BUFFER_SIZE + i];
            float ay = bufferData[1 * BUFFER_SIZE + i];
            float az = bufferData[2 * BUFFER_SIZE + i];
            
            float gx = bufferData[3 * BUFFER_SIZE + i];
            float gy = bufferData[4 * BUFFER_SIZE + i];
            float gz = bufferData[5 * BUFFER_SIZE + i];
            
            accelEnergy += (ax * ax + ay * ay + az * az);
            gyroEnergy += (gx * gx + gy * gy + gz * gz);
        }
        
        accelEnergy /= BUFFER_SIZE;
        gyroEnergy /= BUFFER_SIZE;
        
        Log.d(TAG, "Heuristic - Accel Energy: " + accelEnergy + ", Gyro Energy: " + gyroEnergy);
        
        // Thresholds for heuristic
        if (accelEnergy > 1.5f || gyroEnergy > 2.0f) {
            // High energy -> Walking or moving
            return new ActivityResult("walking", 0.85f, true);
        } else if (accelEnergy > 1.1f || gyroEnergy > 0.5f) {
            // Moderate energy
            return new ActivityResult("standing", 0.70f, false);
        } else {
            // Low energy -> Sitting / laying
            return new ActivityResult("sitting", 0.90f, false);
        }
    }
}
