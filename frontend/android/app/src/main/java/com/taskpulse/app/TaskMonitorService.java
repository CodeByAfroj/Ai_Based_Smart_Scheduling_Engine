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
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class TaskMonitorService extends Service {

    private static final String TAG = "TaskMonitorService";
    private static final String CHANNEL_ID = "taskpulse_monitor";
    private static final int FOREGROUND_NOTIFICATION_ID = 1001;

    private Handler handler;
    private Runnable distractionPoller;

    private String currentTaskId;
    private boolean isMeetingMode;
    private long taskDurationMs;
    private long serviceStartTime;
    private String lastLoggedApp = "";

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
        logToConsole("Service created.");
    }

    private void logToConsole(String message) {
        String timestamp = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        String logEntry = "[" + timestamp + "] " + message + "\n";
        
        SharedPreferences prefs = getSharedPreferences("TaskPulseLogs", Context.MODE_PRIVATE);
        String existingLogs = prefs.getString("monitor_debug_logs", "");
        
        // Keep logs relatively short (e.g. last 10000 chars)
        if (existingLogs.length() > 10000) {
            existingLogs = existingLogs.substring(existingLogs.length() - 5000);
        }
        
        prefs.edit().putString("monitor_debug_logs", existingLogs + logEntry).apply();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            currentTaskId = intent.getStringExtra("TASK_ID");
            isMeetingMode = intent.getBooleanExtra("IS_MEETING", false);
            int durationMinutes = intent.getIntExtra("DURATION_MINS", 20);
            taskDurationMs = durationMinutes * 60 * 1000L;
            serviceStartTime = System.currentTimeMillis();

            startForeground(FOREGROUND_NOTIFICATION_ID, buildForegroundNotification());

            if (isMeetingMode) {
                logToConsole("Started MEETING mode for task " + currentTaskId + ". Duration: " + durationMinutes + "m. Waiting for end window.");
                // Meeting Mode: Single check at the end
                handler.postDelayed(this::checkMeetingCompletion, taskDurationMs);
            } else {
                logToConsole("Started DISTRACTION mode for task " + currentTaskId + ". Duration: " + durationMinutes + "m. Polling every 5s.");
                // Distraction Mode: Poll every 5s
                startDistractionPolling();
                
                // Self-terminate after duration
                handler.postDelayed(() -> {
                    logToConsole("Task duration ended. Terminating service.");
                    stopSelf();
                }, taskDurationMs);
            }
        }
        return START_NOT_STICKY;
    }

    private Notification buildForegroundNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("TaskPulse")
                .setContentText(isMeetingMode ? "Monitoring meeting..." : "Focus mode active")
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
        UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        long now = System.currentTimeMillis();
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
            logToConsole("DETECTED DISTRACTION: " + foregroundApp + ". Firing nudge notification!");
            fireDistractionNudge(foregroundApp);
        }
    }

    private void checkMeetingCompletion() {
        logToConsole("Checking meeting completion for apps: " + meetingApps.toString());
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

        logToConsole("Total time in meeting apps: " + (totalMeetingTimeMs / 1000) + " seconds. Required: " + ((taskDurationMs * 0.7) / 1000) + " seconds.");

        if (totalMeetingTimeMs >= taskDurationMs * 0.7) {
            // Reached 70% of meeting duration
            logToConsole("Threshold met. Auto-completing task.");
            fireAutoCompleteNotification();
        } else {
            logToConsole("Threshold NOT met. Task remains pending.");
        }
        
        stopSelf();
    }

    private void fireDistractionNudge(String appPkg) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle("Focus Mode")
                .setContentText("Get back to work! Deadline is approaching.")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setAutoCancel(true);

        NotificationManagerCompat.from(this).notify(2001, builder.build());
    }

    private void fireAutoCompleteNotification() {
        Intent undoIntent = new Intent(this, UndoReceiver.class);
        undoIntent.setAction(UndoReceiver.ACTION_UNDO);
        undoIntent.putExtra(UndoReceiver.EXTRA_TASK_ID, currentTaskId);
        undoIntent.putExtra(UndoReceiver.EXTRA_NOTIFICATION_ID, 2002);
        
        PendingIntent undoPending = PendingIntent.getBroadcast(this, 0, undoIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_agenda)
                .setContentTitle("Meeting Finished")
                .setContentText("Auto-completed meeting task.")
                .addAction(android.R.drawable.ic_menu_revert, "Undo", undoPending)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);

        NotificationManagerCompat.from(this).notify(2002, builder.build());

        // Save auto-complete so React can pick it up
        SharedPreferences prefs = getSharedPreferences("TaskPulseSync", Context.MODE_PRIVATE);
        prefs.edit().putBoolean("complete_task_" + currentTaskId, true).apply();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Task Monitor", NotificationManager.IMPORTANCE_DEFAULT);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    @Override
    public void onDestroy() {
        logToConsole("Service destroyed.");
        if (handler != null && distractionPoller != null) {
            handler.removeCallbacks(distractionPoller);
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // Not bound
    }
}
