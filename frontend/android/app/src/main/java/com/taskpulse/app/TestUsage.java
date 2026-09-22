package com.taskpulse.app;
import android.app.usage.UsageStatsManager;
import android.app.usage.UsageStats;
import java.util.Map;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.pm.ApplicationInfo;

public class TestUsage {
    public static void test(Context mContext, long startTime, long endTime) {
        UsageStatsManager usm = (UsageStatsManager) mContext.getSystemService(Context.USAGE_STATS_SERVICE);
        Map<String, UsageStats> stats = usm.queryAndAggregateUsageStats(startTime, endTime);
        PackageManager pm = mContext.getPackageManager();
        for (UsageStats stat : stats.values()) {
            try {
                ApplicationInfo info = pm.getApplicationInfo(stat.getPackageName(), 0);
                boolean isSystem = (info.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
            } catch (Exception e) {}
        }
    }
}
