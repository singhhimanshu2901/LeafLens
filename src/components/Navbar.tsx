import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Globe, Download, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Language } from '../types';
import { UI_STRINGS } from '../translations';

interface NavbarProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  onTriggerSync: () => void;
  onOpenLiveVoice?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentLang,
  onLanguageChange,
  isOnline,
  pendingSyncCount,
  isSyncing,
  onTriggerSync,
  onOpenLiveVoice,
}) => {
  const t = UI_STRINGS[currentLang];
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      // Show iOS / mobile instructions
      setShowIOSModal(true);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-950 via-[#18422c] to-[#123623] text-white shadow-md border-b border-emerald-800/40 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand & Connection Pill */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-[0_4px_14px_rgba(16,185,129,0.35)] border border-emerald-400/40 shrink-0 transform hover:rotate-3 transition duration-200">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white drop-shadow-xs" fill="none" stroke="currentColor" strokeWidth="2.3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M12 3c-4.5 3-7 7.5-7 12 0 4 3 6 7 6s7-2 7-6c0-4.5-2.5-9-7-12z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-['Outfit'] font-extrabold text-lg sm:text-xl leading-tight tracking-tight text-white flex items-center gap-1.5">
                {t.appName}
              </h1>
              {/* Online / Offline status badge */}
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide transition shadow-xs ${
                  isOnline
                    ? 'bg-emerald-800/80 text-emerald-200 border border-emerald-600/60'
                    : 'bg-amber-500 text-stone-950 border border-amber-300 font-extrabold animate-pulse'
                }`}
                title={isOnline ? t.online : t.offline}
              >
                {isOnline ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                    <span>{t.online}</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-stone-950" />
                    <span>{t.offline}</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-[11px] sm:text-xs text-emerald-200/80 hidden sm:block font-medium">
              {t.tagline}
            </p>
          </div>
        </div>

        {/* Right action controls */}
        <div className="flex items-center gap-2">
          {/* Live Voice Button */}
          {onOpenLiveVoice && (
            <button
              id="navbar-live-voice-btn"
              onClick={onOpenLiveVoice}
              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-[0_2px_10px_rgba(16,185,129,0.35)] transition active:scale-95"
              title="Speak with Gemini 3.8 Live Voice Agronomist"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" stroke="none">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              <span className="hidden sm:inline font-black">Live Voice</span>
            </button>
          )}

          {/* Sync Button & Badge */}
          <button
            id="sync-now-btn"
            onClick={onTriggerSync}
            disabled={isSyncing}
            className={`relative min-h-[42px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs ${
              pendingSyncCount > 0
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-bold border border-amber-300 shadow-[0_2px_10px_rgba(245,158,11,0.3)]'
                : 'bg-emerald-900/70 hover:bg-emerald-800/80 text-emerald-100 border border-emerald-700/50'
            }`}
            title={pendingSyncCount > 0 ? `${pendingSyncCount} ${t.pendingSync}` : t.syncedAll}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-300' : ''}`} />
            <span className="hidden sm:inline font-medium">{isSyncing ? t.syncing : pendingSyncCount > 0 ? t.syncNow : t.syncedAll}</span>
            {pendingSyncCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-black shadow-xs">
                {pendingSyncCount}
              </span>
            )}
          </button>

          {/* Language Selector */}
          <div className="relative flex items-center bg-black/25 rounded-xl p-1 border border-emerald-700/60 backdrop-blur-xs">
            <Globe className="w-3.5 h-3.5 text-emerald-300 ml-1.5 mr-1 hidden xs:block" />
            {(['en', 'hi', 'sw'] as Language[]).map((lang) => (
              <button
                key={lang}
                id={`lang-btn-${lang}`}
                onClick={() => onLanguageChange(lang)}
                className={`min-h-[34px] px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  currentLang === lang
                    ? 'bg-white text-emerald-950 shadow-md font-extrabold scale-102'
                    : 'text-emerald-100/90 hover:text-white hover:bg-emerald-800/50'
                }`}
              >
                {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिंदी' : 'SW'}
              </button>
            ))}
          </div>

          {/* PWA Install Button */}
          {!isInstalled && (
            <button
              id="install-pwa-btn"
              onClick={handleInstallClick}
              className="min-h-[42px] px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 border border-emerald-400/30 shadow-[0_2px_10px_rgba(5,150,105,0.25)] transition active:scale-95"
              title={t.installApp}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.installApp}</span>
            </button>
          )}
        </div>
      </div>

      {/* iOS Safari PWA Install Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white text-stone-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center gap-3 text-emerald-700 mb-3">
              <Download className="w-6 h-6" />
              <h3 className="font-bold text-lg">Install LeafLens PWA</h3>
            </div>
            <p className="text-sm text-stone-600 mb-4 leading-relaxed">
              To use LeafLens completely offline in fields without internet coverage:
            </p>
            <ol className="text-sm text-stone-700 space-y-2 mb-6 bg-stone-50 p-3 rounded-xl border border-stone-200">
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-700">1.</span>
                <span>Tap the <strong>Share</strong> button in your browser toolbar.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-700">2.</span>
                <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-700">3.</span>
                <span>Launch LeafLens anytime offline directly from your home screen.</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full min-h-[48px] py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
