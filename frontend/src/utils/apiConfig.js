/**
 * API Base URL Resolver
 * Dynamically resolves live backend URL when deployed on Vercel/Mobile.
 */

export const getApiBase = () => {
  if (typeof window !== 'undefined') {
    const isCapacitor = !!window.Capacitor || 
                        window.location.protocol === 'capacitor:' || 
                        (window.location.hostname === 'localhost' && window.location.port === '');
    
    if (isCapacitor) {
      return 'https://ai-based-smart-scheduling-engine.vercel.app';
    }
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

