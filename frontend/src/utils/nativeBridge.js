/**
 * Universal Native & Web Platform Bridge
 * Handles TWA (Android APK) and Web PWA (Mac/Desktop/Browser) gracefully.
 */

// Check if running inside Android TWA / Native Container
export const isTWA = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.AndroidNative ||
    (document.referrer && document.referrer.startsWith('android-app://')) ||
    (window.Capacitor && window.Capacitor.isNativePlatform())
  );
};

// 1. SCREEN TIME / ACTIVITY USAGE PERMISSION
export async function checkScreenTimePermission() {
  if (isTWA()) {
    if (window.AndroidNative?.hasUsagePermission) {
      try {
        return Boolean(window.AndroidNative.hasUsagePermission());
      } catch {
        return false;
      }
    }
    return false; // Not granted until explicitly checked
  }
  // Web PWA: not applicable, return false so UI doesn't show "Granted" falsely
  if (typeof window !== 'undefined' && 'IdleDetector' in window) {
    try {
      return (await IdleDetector.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

export async function requestScreenTimePermission() {
  if (isTWA()) {
    if (window.AndroidNative?.requestUsagePermission) {
      window.AndroidNative.requestUsagePermission();
      // Permission is granted asynchronously in Android settings
      // Return false so UI stays in "Grant Access" state until next check
      return false;
    }
    return false;
  }
  if (typeof window !== 'undefined' && 'IdleDetector' in window) {
    try {
      const state = await IdleDetector.requestPermission();
      return state === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

// 2. EXACT ALARMS PERMISSION
export async function checkExactAlarmPermission() {
  if (isTWA()) {
    if (window.AndroidNative?.hasExactAlarmPermission) {
      try {
        return Boolean(window.AndroidNative.hasExactAlarmPermission());
      } catch {
        return false;
      }
    }
    return false; // Not granted until explicitly checked
  }
  // Web PWA: Check Notification permission
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission === 'granted';
  }
  return false;
}

export async function requestExactAlarmPermission() {
  if (isTWA()) {
    if (window.AndroidNative?.requestExactAlarmPermission) {
      window.AndroidNative.requestExactAlarmPermission();
      return false; // Opens settings, user must grant manually
    }
    return false;
  }
  if (typeof window !== 'undefined' && 'Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

// 3. FETCH SCREEN TIME DATA (24h history + current app)
export async function getScreenTimeUsageData() {
  if (isTWA() && window.AndroidNative?.getScreenTimeUsage) {
    try {
      const data = window.AndroidNative.getScreenTimeUsage();
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (err) {
      console.error('Failed to parse TWA screen time data:', err);
      return null;
    }
  }
  return null;
}

// 3b. GET CURRENT FOREGROUND APP (real-time, battery-optimized)
export async function getCurrentForegroundApp() {
  if (isTWA() && window.AndroidNative?.getCurrentApp) {
    try {
      const data = window.AndroidNative.getCurrentApp();
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (err) {
      console.error('Failed to get current app:', err);
      return null;
    }
  }
  return null;
}

// 4. SCHEDULE EXACT HARDWARE ALARM
export function triggerExactAlarm(title, timestampMillis) {
  if (isTWA() && window.AndroidNative?.setExactAlarm) {
    window.AndroidNative.setExactAlarm(title, timestampMillis);
    return true;
  }
  // Web PWA fallback
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    const delay = Math.max(0, timestampMillis - Date.now());
    setTimeout(() => {
      new Notification(`⏰ ${title}`, {
        body: 'Scheduled Task Alarm',
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 300]
      });
    }, delay);
    return true;
  }
  return false;
}

// 5. CANCEL ALARM
export function cancelAlarm(title, timestampMillis) {
  if (isTWA() && window.AndroidNative?.cancelAlarm) {
    window.AndroidNative.cancelAlarm(title, timestampMillis);
    return true;
  }
  return false;
}

// 6. FOCUS MODE (DISTRACTION BLOCKER)
let focusModeInterval = null;

export function forceAppToForeground() {
  if (isTWA() && window.AndroidNative?.forceAppToForeground) {
    window.AndroidNative.forceAppToForeground();
  }
}

export function startFocusMode(allowedApps, onDistractionDetected) {
  if (!isTWA()) return; // Only works on native app
  
  // Stop any existing interval just in case
  stopFocusMode();
  
  const packageToAppMap = {
    'com.whatsapp': 'WhatsApp',
    'com.android.chrome': 'Chrome',
    'com.google.android.youtube': 'YouTube',
    'com.instagram.android': 'Instagram',
    'com.facebook.katana': 'Facebook',
    'com.twitter.android': 'X (Twitter)',
    'com.zhiliaoapp.musically': 'TikTok',
    'com.snapchat.android': 'Snapchat',
    'com.netflix.mediaclient': 'Netflix'
  };

  focusModeInterval = setInterval(async () => {
    const data = await getCurrentForegroundApp();
    if (data && data.current_app && data.current_app !== 'unknown') {
      const currentPkg = data.current_app;
      
      // Ignore our own app, launcher, and system ui
      if (currentPkg === 'com.taskpulse.app' || 
          currentPkg === 'com.android.launcher3' || 
          currentPkg.includes('launcher') || 
          currentPkg === 'com.android.systemui') {
        return;
      }
      
      // Check if it's in the allowed list
      const isAllowed = allowedApps.some(allowed => {
        // e.g. if allowed is "Chrome", we check if the current package maps to Chrome, 
        // or if the package name itself includes the allowed app string.
        const mappedName = packageToAppMap[currentPkg] || currentPkg;
        return mappedName.toLowerCase().includes(allowed.toLowerCase());
      });
      
      if (!isAllowed) {
        console.warn(`[FOCUS MODE] Distraction detected: ${currentPkg}`);
        const appName = packageToAppMap[currentPkg] || currentPkg.split('.').pop();
        onDistractionDetected(appName);
      }
    }
  }, 3000);
}

export function stopFocusMode() {
  if (focusModeInterval) {
    clearInterval(focusModeInterval);
    focusModeInterval = null;
  }
}
