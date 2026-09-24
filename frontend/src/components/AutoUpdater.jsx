import React, { useState, useEffect } from 'react';
import { RefreshCcw, X, Smartphone, ArrowRight } from 'lucide-react';
import { isTWA } from '../utils/nativeBridge';

const AutoUpdater = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const checkUpdate = async () => {
      // Only check for native updates if we are actually running inside the Android app
      if (!isTWA()) return;

      try {
        // Fetch the version manifest from the live web server
        const response = await fetch('/version.json?t=' + new Date().getTime());
        if (!response.ok) return;

        const data = await response.json();
        
        // Get the real installed version from the Android app itself
        let installedVersion = "1.0.0"; // Fallback
        if (window.AndroidNative && window.AndroidNative.getNativeVersion) {
          installedVersion = window.AndroidNative.getNativeVersion();
        }

        // Semantic version string comparison to only update if server has a NEWER version
        const isNewer = (remote, local) => remote.localeCompare(local, undefined, { numeric: true, sensitivity: 'base' }) > 0;

        if (data.nativeVersion && isNewer(data.nativeVersion, installedVersion)) {
          setUpdateInfo({
            ...data,
            installedVersion
          });
          setUpdateAvailable(true);
        }
      } catch (err) {
        console.log("Failed to check for updates:", err);
      }
    };

    // Check on startup after a small delay
    setTimeout(checkUpdate, 2000);
  }, []);

  const handleUpdate = () => {
    if (!updateInfo?.apkUrl) return;
    
    setDownloading(true);
    // Call the native bridge method we just added
    if (window.AndroidNative && window.AndroidNative.downloadAndInstallUpdate) {
      window.AndroidNative.downloadAndInstallUpdate(updateInfo.apkUrl);
      
      // Auto-dismiss the banner after giving the download time to start
      setTimeout(() => {
        setDismissed(true);
      }, 3000);
    } else {
      // Fallback if the native method isn't injected for some reason
      window.location.href = updateInfo.apkUrl;
    }
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 border border-indigo-500/30 shadow-2xl shadow-indigo-900/50 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-xl text-indigo-300">
              <Smartphone size={20} />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm sm:text-base leading-tight">App Update Available</h4>
              <p className="text-indigo-200/70 text-xs mt-0.5 font-medium">Update from v{updateInfo?.installedVersion} to v{updateInfo?.nativeVersion}</p>
            </div>
          </div>
          <button 
            onClick={() => setDismissed(true)}
            className="text-white/40 hover:text-white/80 transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>
        
        {updateInfo?.releaseNotes && (
          <p className="text-indigo-100/90 text-xs sm:text-sm bg-black/20 p-2.5 rounded-lg border border-white/5">
            {updateInfo.releaseNotes}
          </p>
        )}

        <button 
          onClick={handleUpdate}
          disabled={downloading}
          className="w-full mt-1 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
        >
          {downloading ? (
            <>
              <RefreshCcw size={16} className="animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              Update Now <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AutoUpdater;
