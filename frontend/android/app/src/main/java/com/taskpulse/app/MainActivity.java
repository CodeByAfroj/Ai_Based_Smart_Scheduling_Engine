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

                // Use UsageEvents for reliable, real-time accurate data
                UsageEvents usageEvents = usm.queryEvents(startTime, endTime);
                
                // Track foreground time per package
                HashMap<String, Long> appForegroundTime = new HashMap<>();
                HashMap<String, Long> appLastForegroundStart = new HashMap<>();
                String currentForegroundApp = null;

                while (usageEvents.hasNextEvent()) {
                    UsageEvents.Event event = new UsageEvents.Event();
                    usageEvents.getNextEvent(event);
                    String pkg = event.getPackageName();

                    if (event.getEventType() == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                        appLastForegroundStart.put(pkg, event.getTimeStamp());
                        currentForegroundApp = pkg;
                    } else if (event.getEventType() == UsageEvents.Event.MOVE_TO_BACKGROUND) {
                        Long fgStart = appLastForegroundStart.get(pkg);
                        if (fgStart != null) {
                            long duration = event.getTimeStamp() - fgStart;
                            long existing = appForegroundTime.containsKey(pkg) ? appForegroundTime.get(pkg) : 0;
                            appForegroundTime.put(pkg, existing + duration);
                            appLastForegroundStart.remove(pkg);
                        }
                    }
                }

                // For apps still in foreground (haven't moved to background yet)
                for (Map.Entry<String, Long> entry : appLastForegroundStart.entrySet()) {
                    long duration = endTime - entry.getValue();
                    long existing = appForegroundTime.containsKey(entry.getKey()) ? appForegroundTime.get(entry.getKey()) : 0;
                    appForegroundTime.put(entry.getKey(), existing + duration);
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
                Intent intent = new Intent(mContext, MainActivity.class);
                intent.putExtra("ALARM_TITLE", title);

                PendingIntent pendingIntent = PendingIntent.getActivity(
                    mContext,
                    (int) (triggerTimeMillis % 100000),
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
    }
}
