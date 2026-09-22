/**
 * API Base URL Resolver
 * Dynamically resolves live backend URL when deployed on Vercel/Mobile.
 */

export const getApiBase = () => {
  // Always use live remote server when running inside Android/iOS native Capacitor container
  if (typeof window !== 'undefined' && (window.Capacitor?.isNativePlatform?.() || window.location.protocol === 'capacitor:')) {
    return 'https://ai-based-smart-scheduling-engine.vercel.app';
  }
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.origin;
  }
  // Production Vercel fallback if running on APK / Production
  return 'https://ai-based-smart-scheduling-engine.vercel.app';
};

