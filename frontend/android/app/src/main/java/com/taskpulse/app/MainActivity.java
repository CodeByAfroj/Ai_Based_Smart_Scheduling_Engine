package com.taskpulse.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
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
import java.util.List;

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

        @JavascriptInterface
        public String getScreenTimeUsage() {
            try {
                UsageStatsManager usm = (UsageStatsManager) mContext.getSystemService(Context.USAGE_STATS_SERVICE);
                long endTime = System.currentTimeMillis();
                long startTime = endTime - (1000 * 60 * 60 * 24); // Last 24 Hours

                List<UsageStats> stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime);
                JSONArray appArray = new JSONArray();

                if (stats != null) {
                    for (UsageStats usage : stats) {
                        long totalTimeInForeground = usage.getTotalTimeInForeground();
                        if (totalTimeInForeground > 0) {
                            long minutes = Math.max(1, totalTimeInForeground / (1000 * 60));
                            JSONObject obj = new JSONObject();
                            obj.put("package", usage.getPackageName());
                            obj.put("minutes", minutes);
                            appArray.put(obj);
                        }
                    }
                }

                JSONObject result = new JSONObject();
                result.put("status", "Active");
                result.put("source", "Android UsageStats");
                result.put("apps", appArray);
                return result.toString();
            } catch (Exception e) {
                return "{\"status\":\"Error\", \"message\":\"" + e.getMessage() + "\"}";
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
