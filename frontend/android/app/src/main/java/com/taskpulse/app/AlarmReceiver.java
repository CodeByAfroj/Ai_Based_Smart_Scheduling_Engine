package com.taskpulse.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import androidx.core.app.NotificationCompat;

/**
 * AlarmReceiver — Fires a full-screen alarm notification with system alarm sound.
 * Triggered by AlarmManager when a task deadline is reached.
 */
public class AlarmReceiver extends BroadcastReceiver {

    private static final String CHANNEL_ID = "taskpulse_alarms";
    private static final String CHANNEL_NAME = "Task Alarms";

    @Override
    public void onReceive(Context context, Intent intent) {
        String title = intent.getStringExtra("ALARM_TITLE");
        if (title == null) title = "Task Deadline";

        // Create high-priority notification channel with alarm sound
        createNotificationChannel(context);

        // Intent to open the app when notification is tapped
        Intent openApp = new Intent(context, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Start Foreground TaskMonitorService
        String taskId = intent.getStringExtra("TASK_ID");
        boolean isMeeting = intent.getBooleanExtra("IS_MEETING", false);
        int durationMins = intent.getIntExtra("DURATION_MINS", 30);
        
        Intent serviceIntent = new Intent(context, TaskMonitorService.class);
        serviceIntent.putExtra("TASK_ID", taskId);
        serviceIntent.putExtra("IS_MEETING", isMeeting);
        serviceIntent.putExtra("DURATION_MINS", durationMins);
        
        androidx.core.content.ContextCompat.startForegroundService(context, serviceIntent);

        // Build the alarm notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("⏰ " + title)
            .setContentText("Your scheduled task is starting now!")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        NotificationManager notificationManager = 
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        // Only show the loud/visible alarm notification if the user has alarms enabled
        boolean alarmEnabled = intent.getBooleanExtra("ALARM_ENABLED", true);
        if (alarmEnabled) {
            int notificationId = title.hashCode();
            notificationManager.notify(notificationId, builder.build());
        }
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Alarm notifications for task deadlines");
            channel.setDescription("Alarm notifications for task deadlines");
            
            // Do NOT force vibration or sound, let standard OS Notification Channel rules apply
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            NotificationManager manager = context.getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }
}
