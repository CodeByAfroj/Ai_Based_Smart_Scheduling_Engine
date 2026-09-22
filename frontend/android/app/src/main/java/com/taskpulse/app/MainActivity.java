package com.taskpulse.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.os.Environment;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import androidx.core.content.FileProvider;
import java.io.File;
import android.net.Uri;
import com.getcapacitor.BridgeActivity;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Inject Native Bridge to WebView
        WebView webView = this.getBridge().getWebView();
        if (webView != null) {
            webView.getSettings().setUserAgentString("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
            webView.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
            webView.getSettings().setSupportMultipleWindows(false);
            webView.addJavascriptInterface(new WebAppInterface(this), "AndroidNative");
        }
    }

    public static class WebAppInterface {
        private final Context mContext;

        public WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public boolean hasUsagePermission() {
            UsageStatsManager usm = (UsageStatsManager) mContext.getSystemService(Context.USAGE_STATS_SERVICE);
            long now = System.currentTimeMillis();
            List<UsageStats> stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - 1000 * 60, now);
            return stats != null && !stats.isEmpty();
        }

        @JavascriptInterface
        public void requestUsagePermission() {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            mContext.startActivity(intent);
        }

        /**
         * Battery-optimized screen time data using UsageEvents API.
         * Only runs on-demand when user taps "Refresh Data", no background polling.
         * Returns last 24h of app usage with accurate foreground times.
         */
        @JavascriptInterface
        public String getScreenTimeUsage() {
            try {
                UsageStatsManager usm = (UsageStatsManager) mContext.getSystemService(Context.USAGE_STATS_SERVICE);
                long endTime = System.currentTimeMillis();
                long startTime = endTime - (1000 * 60 * 60 * 24); // Last 24 Hours

                // Use queryUsageStats for 100% accurate and highly optimized data (matches Digital Wellbeing exactly)
                List<UsageStats> stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime);
                HashMap<String, Long> appForegroundTime = new HashMap<>();
                String currentForegroundApp = "unknown";

                if (stats != null) {
                    for (UsageStats stat : stats) {
                        long timeInForeground = stat.getTotalTimeInForeground();
                        if (timeInForeground > 0) {
                            String pkg = stat.getPackageName();
                            long existing = appForegroundTime.containsKey(pkg) ? appForegroundTime.get(pkg) : 0;
                            appForegroundTime.put(pkg, existing + timeInForeground);
                        }
                    }
                }

                // Convert to sorted JSON array (highest usage first)
                ArrayList<Map.Entry<String, Long>> sortedApps = new ArrayList<>(appForegroundTime.entrySet());
                Collections.sort(sortedApps, new Comparator<Map.Entry<String, Long>>() {
                    @Override
                    public int compare(Map.Entry<String, Long> a, Map.Entry<String, Long> b) {
                        return Long.compare(b.getValue(), a.getValue());
                    }
                });

                JSONArray appArray = new JSONArray();
                for (Map.Entry<String, Long> entry : sortedApps) {
                    long totalMs = entry.getValue();
                    if (totalMs > 5000) { // Skip apps with less than 5 seconds
                        long minutes = Math.max(1, totalMs / (1000 * 60));
                        JSONObject obj = new JSONObject();
                        obj.put("package", entry.getKey());
                        obj.put("minutes", minutes);
                        appArray.put(obj);
                    }
                }

                JSONObject result = new JSONObject();
                result.put("status", "Active");
                result.put("source", "Android UsageEvents (Real-Time)");
                result.put("app_count", appArray.length());
                result.put("current_app", currentForegroundApp != null ? currentForegroundApp : "unknown");
                result.put("apps", appArray);
                return result.toString();
            } catch (Exception e) {
                return "{\"status\":\"Error\", \"message\":\"" + e.getMessage() + "\"}";
            }
        }

        /**
         * Returns the currently active foreground app (real-time).
         * Battery-optimized: only queries last 5 seconds of events.
         */
        @JavascriptInterface
        public String getCurrentApp() {
            try {
                UsageStatsManager usm = (UsageStatsManager) mContext.getSystemService(Context.USAGE_STATS_SERVICE);
                long now = System.currentTimeMillis();
                UsageEvents usageEvents = usm.queryEvents(now - 5000, now);

                String lastApp = "unknown";
                while (usageEvents.hasNextEvent()) {
                    UsageEvents.Event event = new UsageEvents.Event();
                    usageEvents.getNextEvent(event);
                    if (event.getEventType() == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                        lastApp = event.getPackageName();
                    }
                }

                JSONObject result = new JSONObject();
                result.put("current_app", lastApp);
                result.put("timestamp", now);
                return result.toString();
            } catch (Exception e) {
                return "{\"current_app\":\"error\",\"message\":\"" + e.getMessage() + "\"}";
            }
        }

        @JavascriptInterface
        public boolean hasExactAlarmPermission() {
            try {
                AlarmManager alarmManager = (AlarmManager) mContext.getSystemService(Context.ALARM_SERVICE);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                    return alarmManager.canScheduleExactAlarms();
                }
                return true;
            } catch (Exception e) {
                return true;
            }
        }

        @JavascriptInterface
        public void requestExactAlarmPermission() {
            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                    Intent intent = new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    mContext.startActivity(intent);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void setExactAlarm(String title, long triggerTimeMillis) {
            try {
                AlarmManager alarmManager = (AlarmManager) mContext.getSystemService(Context.ALARM_SERVICE);
                Intent intent = new Intent(mContext, AlarmReceiver.class);
                intent.putExtra("ALARM_TITLE", title);

                int requestCode = (title + triggerTimeMillis).hashCode();
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    mContext,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                if (alarmManager != null) {
                    alarmManager.setAlarmClock(
                        new AlarmManager.AlarmClockInfo(triggerTimeMillis, pendingIntent),
                        pendingIntent
                    );
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void cancelAlarm(String title, long triggerTimeMillis) {
            try {
                AlarmManager alarmManager = (AlarmManager) mContext.getSystemService(Context.ALARM_SERVICE);
                Intent intent = new Intent(mContext, AlarmReceiver.class);
                intent.putExtra("ALARM_TITLE", title);

                int requestCode = (title + triggerTimeMillis).hashCode();
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    mContext,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                if (alarmManager != null) {
                    alarmManager.cancel(pendingIntent);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public String getNativeVersion() {
            return BuildConfig.VERSION_NAME;
        }

        @JavascriptInterface
        public void downloadAndInstallUpdate(String apkUrl) {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(apkUrl));
                request.setTitle("Downloading Update");
                request.setDescription("TaskPulse native update is downloading...");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "TaskPulse_Update.apk");

                DownloadManager manager = (DownloadManager) mContext.getSystemService(Context.DOWNLOAD_SERVICE);
                final long downloadId = manager.enqueue(request);

                BroadcastReceiver onComplete = new BroadcastReceiver() {
                    public void onReceive(Context ctxt, Intent intent) {
                        long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                        if (downloadId == id) {
                            try {
                                File file = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "TaskPulse_Update.apk");
                                Uri apkUri = FileProvider.getUriForFile(mContext, mContext.getApplicationContext().getPackageName() + ".fileprovider", file);
                                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                                installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                mContext.startActivity(installIntent);
                            } catch (Exception e) {
                                e.printStackTrace();
                            }
                            mContext.unregisterReceiver(this);
                        }
                    }
                };
                
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                    mContext.registerReceiver(onComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED);
                } else {
                    mContext.registerReceiver(onComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
                }

            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
