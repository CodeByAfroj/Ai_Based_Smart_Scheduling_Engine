package com.taskpulse.app;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.util.Log;

import org.tensorflow.lite.Interpreter;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.util.Arrays;

public class SmartHarTracker {
    private static final String TAG = "SmartHarTracker";
    private static final int BUFFER_SIZE = 128;
    private Interpreter tflite;

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

    public SmartHarTracker(Context context) {
        try {
            tflite = new Interpreter(loadModelFile(context, "smart_har.tflite"));
            Log.d(TAG, "TFLite Model loaded successfully.");
        } catch (Exception e) {
            Log.e(TAG, "Error loading TFLite model: " + e.getMessage());
            tflite = null;
        }
    }

    private MappedByteBuffer loadModelFile(Context context, String modelPath) throws IOException {
        AssetFileDescriptor fileDescriptor = context.getAssets().openFd(modelPath);
        FileInputStream inputStream = new FileInputStream(fileDescriptor.getFileDescriptor());
        FileChannel fileChannel = inputStream.getChannel();
        long startOffset = fileDescriptor.getStartOffset();
        long declaredLength = fileDescriptor.getDeclaredLength();
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength);
    }

    /**
     * @param bufferData float array of size 6 * 128 (accel X,Y,Z, gyro X,Y,Z)
     * @return ActivityResult
     */
    public ActivityResult analyze(float[] bufferData) {
        if (tflite == null) {
            return new ActivityResult("unknown", 0.0f, false);
        }

        // 1. Calculate Magnitude (Orientation Invariant)
        // We only feed the 128-frame Magnitude vector into the 1D-CNN
        float[] magnitudes = new float[BUFFER_SIZE];
        for (int i = 0; i < BUFFER_SIZE; i++) {
            float ax = bufferData[0 * BUFFER_SIZE + i];
            float ay = bufferData[1 * BUFFER_SIZE + i];
            float az = bufferData[2 * BUFFER_SIZE + i];
            magnitudes[i] = (float) Math.sqrt(ax * ax + ay * ay + az * az);
        }

        // 2. Prepare Input Buffer
        ByteBuffer inputBuffer = ByteBuffer.allocateDirect(BUFFER_SIZE * 4); // 4 bytes per float
        inputBuffer.order(ByteOrder.nativeOrder());
        for (int i = 0; i < BUFFER_SIZE; i++) {
            inputBuffer.putFloat(magnitudes[i]);
        }

        // 3. Prepare Output Buffer (4 classes: Sitting, Standing, Walking, Jogging)
        float[][] outputBuffer = new float[1][4];

        // 4. Run Inference
        try {
            tflite.run(inputBuffer, outputBuffer);
        } catch (Exception e) {
            Log.e(TAG, "Inference error: " + e.getMessage());
            return new ActivityResult("unknown", 0.0f, false);
        }

        // 5. Parse Output
        float[] probabilities = outputBuffer[0];
        int maxIndex = -1;
        float maxProb = 0.0f;
        for (int i = 0; i < probabilities.length; i++) {
            if (probabilities[i] > maxProb) {
                maxProb = probabilities[i];
                maxIndex = i;
            }
        }

        String activityStr = "unknown";
        boolean isBusy = false;
        
        switch (maxIndex) {
            case 0:
                activityStr = "sitting";
                isBusy = false;
                break;
            case 1:
                activityStr = "standing";
                isBusy = false;
                break;
            case 2:
                activityStr = "walking";
                isBusy = true;
                break;
            case 3:
                activityStr = "jogging";
                isBusy = true;
                break;
        }

        Log.d(TAG, "Predicted Activity: " + activityStr + " Confidence: " + maxProb);
        return new ActivityResult(activityStr, maxProb, isBusy);
    }
    
    public void close() {
        if (tflite != null) {
            tflite.close();
            tflite = null;
        }
    }
}
