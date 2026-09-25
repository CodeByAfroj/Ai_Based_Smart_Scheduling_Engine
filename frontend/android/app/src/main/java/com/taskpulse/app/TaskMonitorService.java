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
    private Sensor gyroscope;
    private float[] sensorBuffer = new float[6 * 128];
    private int bufferIndex = 0;
    private float[] latestAccel = new float[3];
    private float[] latestGyro = new float[3];
    private HeuristicActivityTracker heuristicTracker;

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
                gyroscope = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE);
            }
            heuristicTracker = new HeuristicActivityTracker();
            logToConsole("Successfully loaded TFLite Smart HAR Tracker.");
        } catch (Exception e) {
            logToConsole("Failed to init Heuristic Tracker: " + e.getMessage());
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
            String action = intent.getAction();
            if ("START_BACKGROUND_AI".equals(action)) {
                logToConsole("Started Continuous Local AI from Settings.");
                startForeground(FOREGROUND_NOTIFICATION_ID, buildForegroundNotification("Activity Tracking Active"));
                if (sensorManager != null && accelerometer != null && gyroscope != null) {
                    // Use 50,000 microseconds (20Hz) to perfectly match WISDM training data
                    sensorManager.registerListener(this, accelerometer, 50000);
                    sensorManager.registerListener(this, gyroscope, 50000);
                }
                return START_NOT_STICKY;
            }

            currentTaskId = intent.getStringExtra("TASK_ID");
            taskTitle = intent.getStringExtra("ALARM_TITLE");
            if (taskTitle == null) taskTitle = "your current task";
            isMeetingMode = intent.getBooleanExtra("IS_MEETING", false);
            isScreenFree = intent.getBooleanExtra("IS_SCREEN_FREE", false);
            int durationMinutes = intent.getIntExtra("DURATION_MINS", 20);
            taskDurationMs = durationMinutes * 60 * 1000L;
            serviceStartTime = System.currentTimeMillis();

            startForeground(FOREGROUND_NOTIFICATION_ID, buildForegroundNotification(isMeetingMode ? "Monitoring meeting..." : (isScreenFree ? "Screen-Free Focus active" : "Focus mode active")));

            if (isMeetingMode) {
                logToConsole("Started MEETING mode. Waiting for end window.");
                handler.postDelayed(this::checkMeetingCompletion, taskDurationMs);
            } else {
                logToConsole("Started DISTRACTION mode for " + taskTitle);
                if (isScreenFree && useLocalAI && accelerometer != null && gyroscope != null) {
                    logToConsole("Registering Sensor for Local ONNX AI...");
                    // Use 50,000 microseconds (20Hz) to perfectly match WISDM training data
                    sensorManager.registerListener(this, accelerometer, 50000);
                    sensorManager.registerListener(this, gyroscope, 50000);
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
            // Android is m/s^2. WISDM dataset is ALSO in m/s^2. DO NOT divide by 9.81!
            latestAccel[0] = event.values[0];
            latestAccel[1] = event.values[1];
            latestAccel[2] = event.values[2];
            
            // Sync logic: we collect a frame every time accelerometer fires
            // Format: (1, 6, 128). Data ordered by channel, then time.
            sensorBuffer[0 * 128 + bufferIndex] = latestAccel[0];
            sensorBuffer[1 * 128 + bufferIndex] = latestAccel[1];
            sensorBuffer[2 * 128 + bufferIndex] = latestAccel[2];
            sensorBuffer[3 * 128 + bufferIndex] = latestGyro[0];
            sensorBuffer[4 * 128 + bufferIndex] = latestGyro[1];
            sensorBuffer[5 * 128 + bufferIndex] = latestGyro[2];
            
            bufferIndex++;
            if (bufferIndex >= 128) {
                runInference(sensorBuffer);
                bufferIndex = 0;
            }
        } else if (event.sensor.getType() == Sensor.TYPE_GYROSCOPE) {
            latestGyro[0] = event.values[0];
            latestGyro[1] = event.values[1];
            latestGyro[2] = event.values[2];
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not needed
    }

    private void runInference(float[] bufferData) {
        try {
            if (heuristicTracker == null) return;
            
            HeuristicActivityTracker.ActivityResult result = heuristicTracker.analyze(bufferData);
            
            String activityLabel = result.activity;
            float confidence = result.confidence;
            boolean isBusy = result.isBusy;
            
            logToConsole(String.format(Locale.US, "Heuristic Inference: %s (conf: %.2f)", activityLabel, confidence));
            
            String statusJson = String.format(Locale.US, "{\"activity\": \"%s\", \"confidence\": %.2f, \"busy\": %b}", 
                activityLabel, confidence, isBusy);
            SharedPreferences prefs = getSharedPreferences("TaskPulsePrefs", Context.MODE_PRIVATE);
            prefs.edit().putString("local_ai_status", statusJson).apply();
            
            // (Removed distraction nudge logic per user request. This activity tracker 
            // is not intended to be bound to focus mode distraction alerts.)            
        } catch (Exception e) {
            Log.e(TAG, "Heuristic Inference failed", e);
        }
    }

    private Notification buildForegroundNotification(String text) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("TaskPulse")
                .setContentText(text)
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
        }

        UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        // Check events since the service started to guarantee we see the last foreground event
        android.app.usage.UsageEvents events = usm.queryEvents(serviceStartTime, now);
        
        android.app.usage.UsageEvents.Event event = new android.app.usage.UsageEvents.Event();
        String currentApp = lastLoggedApp; // default to what it was
        
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            if (event.getEventType() == android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND) {
                currentApp = event.getPackageName();
            }
        }

        if (currentApp != null && !currentApp.equals(lastLoggedApp)) {
            logToConsole("Currently using app: " + currentApp);
            lastLoggedApp = currentApp;
        }

        if (!isScreenFree && currentApp != null && distractionApps.contains(currentApp)) {
            if (now - lastNudgeTime > 10000) {
                lastNudgeTime = now;
                fireDistractionNudge(currentApp);
            }
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
            // Nothing to close for heuristic tracker
        } catch (Exception e) {
            Log.e(TAG, "Failed to clean up AI resources");
        }
        if (heuristicTracker != null) {
            // Nothing to close for heuristic tracker
        }
        logToConsole("Service destroyed.");
    }
}
