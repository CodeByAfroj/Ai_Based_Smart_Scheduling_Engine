package com.taskpulse.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.core.app.NotificationManagerCompat;

public class UndoReceiver extends BroadcastReceiver {
    public static final String ACTION_UNDO = "com.taskpulse.app.ACTION_UNDO";
    public static final String EXTRA_TASK_ID = "EXTRA_TASK_ID";
    public static final String EXTRA_NOTIFICATION_ID = "EXTRA_NOTIFICATION_ID";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_UNDO.equals(intent.getAction())) {
            String taskId = intent.getStringExtra(EXTRA_TASK_ID);
            int notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1);

            if (taskId != null) {
                // Save the undo action in SharedPreferences so React can pick it up
                SharedPreferences prefs = context.getSharedPreferences("TaskPulseSync", Context.MODE_PRIVATE);
                prefs.edit().putBoolean("undo_task_" + taskId, true).apply();
            }

            if (notificationId != -1) {
                NotificationManagerCompat.from(context).cancel(notificationId);
            }
        }
    }
}
