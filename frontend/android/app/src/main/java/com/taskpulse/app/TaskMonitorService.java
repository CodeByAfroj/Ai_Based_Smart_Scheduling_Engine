package com.taskpulse.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.FloatBuffer;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;

public class TaskMonitorService extends Service implements SensorEventListener {

    private static final String TAG = "TaskMonitorService";
    private static final String CHANNEL_ID = "taskpulse_monitor";
    private static final int FOREGROUND_NOTIFICATION_ID = 1001;

    private Handler handler;
    private Runnable distractionPoller;

    private String currentTaskId;
    private String taskTitle;
    private boolean isMeetingMode;
    private boolean isScreenFree;
    private long taskDurationMs;
    private long serviceStartTime;
    private String lastLoggedApp = "";
    private long lastNudgeTime = 0;

    // ML Properties
    private boolean useLocalAI = false;
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private float[] magnitudeBuffer = new float[128];
    private int bufferIndex = 0;
    private OrtEnvironment ortEnv;
    private OrtSession ortSession;

    private final List<String> meetingApps = Arrays.asList(
            "us.zoom.videomeetings",
            "com.google.android.apps.meetings",
            "com.microsoft.teams"
    );

    private final List<String> distractionApps = Arrays.asList(
            "com.instagram.android",
            "com.zhiliaoapp.musically",
            "com.facebook.katana",
            "com.twitter.android",
            "com.snapchat.android"
    );

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());
        createNotificationChannel();
        
        SharedPreferences prefs = getSharedPreferences("TaskPulsePrefs", Context.MODE_PRIVATE);
        useLocalAI = prefs.getBoolean("local_ai_enabled", false);
        
        if (useLocalAI) {
            initLocalAI();
        }
        
        logToConsole("Service created. Local AI Enabled: " + useLocalAI);
    }

    private void initLocalAI() {
        try {
            sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
            if (sensorManager != null) {
                accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            }
            
            ortEnv = OrtEnvironment.getEnvironment();
            InputStream is = getAssets().open("activity_dl.onnx");
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            int nRead;
            byte[] data = new byte[16384];
            while ((nRead = is.read(data, 0, data.length)) != -1) {
                buffer.write(data, 0, nRead);
            }
            byte[] modelBytes = buffer.toByteArray();
            ortSession = ortEnv.createSession(modelBytes, new OrtSession.SessionOptions());
            logToConsole("Successfully loaded ONNX Local AI Model.");
        } catch (Exception e) {
            logToConsole("Failed to init ONNX AI: " + e.getMessage());
            useLocalAI = false;
        }
    }

    private void logToConsole(String message) {
        String timestamp = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        String logEntry = "[" + timestamp + "] " + message + "\n";
        
        SharedPreferences prefs = getSharedPreferences("TaskPulseLogs", Context.MODE_PRIVATE);
        String existingLogs = prefs.getString("monitor_debug_logs", "");
        if (existingLogs.length() > 10000) {
            existingLogs = existingLogs.substring(existingLogs.length() - 5000);
        }
        prefs.edit().putString("monitor_debug_logs", existingLogs + logEntry).apply();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            currentTaskId = intent.getStringExtra("TASK_ID");
            taskTitle = intent.getStringExtra("ALARM_TITLE");
            if (taskTitle == null) taskTitle = "your current task";
            isMeetingMode = intent.getBooleanExtra("IS_MEETING", false);
            isScreenFree = intent.getBooleanExtra("IS_SCREEN_FREE", false);
            int durationMinutes = intent.getIntExtra("DURATION_MINS", 20);
            taskDurationMs = durationMinutes * 60 * 1000L;
            serviceStartTime = System.currentTimeMillis();

            startForeground(FOREGROUND_NOTIFICATION_ID, buildForegroundNotification());

            if (isMeetingMode) {
                logToConsole("Started MEETING mode. Waiting for end window.");
                handler.postDelayed(this::checkMeetingCompletion, taskDurationMs);
            } else {
                logToConsole("Started DISTRACTION mode for " + taskTitle);
                if (isScreenFree && useLocalAI && accelerometer != null) {
                    logToConsole("Registering Sensor for Local ONNX AI...");
                    sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
                } else {
                    startDistractionPolling();
                }
                
                handler.postDelayed(() -> {
                    logToConsole("Task duration ended. Terminating service.");
                    stopSelf();
                }, taskDurationMs);
            }
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            float x = event.values[0];
            float y = event.values[1];
            float z = event.values[2];
            
            // Calculate magnitude and remove gravity approximation (~9.8)
            float magnitude = (float) Math.sqrt(x*x + y*y + z*z) - 9.8f;
            
            magnitudeBuffer[bufferIndex] = magnitude;
            bufferIndex++;
            
            if (bufferIndex >= 128) {
                runInference(magnitudeBuffer);
                // Shift buffer or reset depending on overlap strategy. Here we reset for simplicity.
                bufferIndex = 0;
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not needed
    }

    private void runInference(float[] bufferData) {
        try {
            FloatBuffer floatBuffer = FloatBuffer.wrap(bufferData);
            long[] shape = new long[]{1, 1, 128};
            OnnxTensor tensor = OnnxTensor.createTensor(ortEnv, floatBuffer, shape);
            String inputName = ortSession.getInputNames().iterator().next();
            
            OrtSession.Result result = ortSession.run(Collections.singletonMap(inputName, tensor));
            float[][] output = (float[][]) result.get(0).getValue();
            
            // Assuming output[0] is probabilities for classes (e.g. 0: Resting, 1: Walking, 2: Phone Usage)
            // If phone usage probability is highest, fire nudge
            int maxIdx = 0;
            float maxVal = output[0][0];
            for (int i = 1; i < output[0].length; i++) {
                if (output[0][i] > maxVal) {
                    maxVal = output[0][i];
                    maxIdx = i;
                }
            }
            
            logToConsole(String.format(Locale.US, "AI Inference: class=%d conf=%.2f", maxIdx, maxVal));
            
            String statusJson = String.format(Locale.US, "{\"activity\": \"%s\", \"confidence\": %.2f, \"busy\": %b}", 
                (maxIdx == 2 ? "Distracted" : "Focused"), maxVal, (maxIdx == 2));
            SharedPreferences prefs = getSharedPreferences("TaskPulsePrefs", Context.MODE_PRIVATE);
            prefs.edit().putString("local_ai_status", statusJson).apply();
            
            long now = System.currentTimeMillis();
            // If class 2 represents device usage (or sitting perfectly still on a desk) during a physical task
            if (maxIdx == 2 && (now - lastNudgeTime > 180000)) {
                logToConsole("LOCAL AI DETECTED DISTRACTION. Firing nudge.");
                lastNudgeTime = now;
                fireDistractionNudge("Local AI Screen-Free Violation");
            }
            
            result.close();
            tensor.close();
        } catch (Exception e) {
            Log.e(TAG, "ONNX Inference failed", e);
        }
    }

    private Notification buildForegroundNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("TaskPulse")
                .setContentText(isMeetingMode ? "Monitoring meeting..." : (isScreenFree ? "Screen-Free Focus active" : "Focus mode active"))
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void startDistractionPolling() {
        distractionPoller = new Runnable() {
            @Override
            public void run() {
                checkDistraction();
                handler.postDelayed(this, 5000);
            }
        };
        handler.post(distractionPoller);
    }

    private void checkDistraction() {
        long now = System.currentTimeMillis();
        
        if (isScreenFree) {
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm.isInteractive()) {
                if (now - lastNudgeTime > 180000) {
                    lastNudgeTime = now;
                    fireDistractionNudge("Screen");
                }
            }
            return;
        }

        UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        android.app.usage.UsageEvents events = usm.queryEvents(now - 10000, now);
        
        android.app.usage.UsageEvents.Event event = new android.app.usage.UsageEvents.Event();
        String foregroundApp = null;
        
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            if (event.getEventType() == android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND) {
                foregroundApp = event.getPackageName();
            }
        }

        if (foregroundApp != null && !foregroundApp.equals(lastLoggedApp)) {
            logToConsole("Currently using app: " + foregroundApp);
            lastLoggedApp = foregroundApp;
        }

        if (foregroundApp != null && distractionApps.contains(foregroundApp)) {
            fireDistractionNudge(foregroundApp);
        }
    }

    private void checkMeetingCompletion() {
        UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        long now = System.currentTimeMillis();
        
        Map<String, UsageStats> stats = usm.queryAndAggregateUsageStats(serviceStartTime, now);
        long totalMeetingTimeMs = 0;
        for (String pkg : meetingApps) {
            UsageStats stat = stats.get(pkg);
            if (stat != null) {
                totalMeetingTimeMs += stat.getTotalTimeInForeground();
            }
        }

        if (totalMeetingTimeMs >= taskDurationMs * 0.7) {
            fireAutoCompleteNotification();
        } else {
            logToConsole("Meeting threshold not met.");
        }
    }

    private void fireDistractionNudge(String appName) {
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
        
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE);
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle("Distraction Alert!")
                .setContentText(isScreenFree ? "Put the phone down! You're supposed to be doing: " + taskTitle : "You're supposed to be doing: " + taskTitle)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);
                
        try {
            notificationManager.notify((int) System.currentTimeMillis(), builder.build());
        } catch (SecurityException e) {
            Log.e(TAG, "Missing permission to post notification");
        }
    }

    private void fireAutoCompleteNotification() {
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.star_on)
                .setContentTitle("Meeting Completed")
                .setContentText("Great job on your meeting!")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);
        try {
            notificationManager.notify((int) System.currentTimeMillis(), builder.build());
        } catch (SecurityException e) {
            Log.e(TAG, "Missing permission to post notification");
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "TaskPulse Monitor",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Background monitoring for distractions");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (handler != null) {
            handler.removeCallbacksAndMessages(null);
        }
        if (sensorManager != null && accelerometer != null) {
            sensorManager.unregisterListener(this);
        }
        try {
            if (ortSession != null) ortSession.close();
            if (ortEnv != null) ortEnv.close();
        } catch (Exception e) {
            Log.e(TAG, "Failed to close ONNX env");
        }
        logToConsole("Service destroyed.");
    }
}
