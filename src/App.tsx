import React, { useEffect, useState } from 'react';
import {
  Camera,
  BookOpen,
  Stethoscope,
  MapPin,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { DiagnosisRecord, DiseaseId, Language } from './types';
import { UI_STRINGS } from './translations';
import { dbService } from './db';
import { generateSyntheticLeafImage } from './vision';
import { Navbar } from './components/Navbar';
import { ScanView } from './components/ScanView';
import { HistoryView } from './components/HistoryView';
import { ExpertDesk } from './components/ExpertDesk';
import { FarmMapView } from './components/FarmMapView';
import { GeminiChatbot } from './components/GeminiChatbot';
import { GeminiLiveVoice } from './components/GeminiLiveVoice';

type TabType = 'scan' | 'history' | 'map' | 'chat' | 'expert';

export default function App() {
  const [currentLang, setCurrentLang] = useState<Language>('en');
  const [activeTab, setActiveTab] = useState<TabType>('scan');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [diagnoses, setDiagnoses] = useState<DiagnosisRecord[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [isLiveVoiceOpen, setIsLiveVoiceOpen] = useState<boolean>(false);

  const t = UI_STRINGS[currentLang];

  // Refresh all state from local IndexedDB
  const refreshStorage = async () => {
    try {
      const records = await dbService.getAllDiagnoses();
      setDiagnoses(records);
      const pending = await dbService.getPendingSyncCount();
      setPendingSyncCount(pending);
    } catch (e) {
      console.error('Database load error:', e);
    }
  };

  // Seed initial demo data & set up network listeners on mount
  useEffect(() => {
    const init = async () => {
      await dbService.seedInitialDataIfEmpty((diseaseType: string) =>
        generateSyntheticLeafImage(diseaseType as DiseaseId)
      );
      await refreshStorage();
    };

    init();

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync queue on reconnect
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync Queue simulation
  const triggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncFeedback('Syncing local queue with extension cloud...');

    try {
      const syncedCount = await dbService.processSyncSimulation();
      await refreshStorage();
      setSyncFeedback(
        syncedCount > 0
          ? `Successfully synced ${syncedCount} records!`
          : 'All field records are up to date.'
      );
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (e) {
      console.error('Sync failed:', e);
      setSyncFeedback('Sync interrupted. Records safely stored locally.');
      setTimeout(() => setSyncFeedback(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Unverified/Low-confidence count for Expert Desk badge
  const unverifiedCount = diagnoses.filter(
    (d) => d.needsExpertReview || !d.expertFeedback
  ).length;

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-stone-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] pb-28 selection:bg-emerald-600 selection:text-white relative">
      {/* Subtle organic warmth glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-amber-100/30 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Navigation Bar */}
      <Navbar
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        isOnline={isOnline}
        pendingSyncCount={pendingSyncCount}
        isSyncing={isSyncing}
        onTriggerSync={triggerSync}
        onOpenLiveVoice={() => setIsLiveVoiceOpen(true)}
      />

      {/* Sync Toast Feedback */}
      {syncFeedback && (
        <div className="fixed top-18 right-4 z-50 bg-stone-900/95 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl border border-stone-700/80 backdrop-blur-md flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Main View Router */}
      <main className="flex-1 w-full max-w-5xl mx-auto py-2">
        {activeTab === 'scan' && (
          <ScanView currentLang={currentLang} onDiagnosisSaved={refreshStorage} />
        )}

        {activeTab === 'history' && (
          <HistoryView
            diagnoses={diagnoses}
            currentLang={currentLang}
            onRefresh={refreshStorage}
          />
        )}

        {activeTab === 'map' && (
          <FarmMapView
            currentLang={currentLang}
            diagnoses={diagnoses}
          />
        )}

        {activeTab === 'chat' && (
          <GeminiChatbot
            currentLang={currentLang}
            latestDiagnosis={diagnoses[0] || null}
            onOpenLiveVoice={() => setIsLiveVoiceOpen(true)}
          />
        )}

        {activeTab === 'expert' && (
          <ExpertDesk
            diagnoses={diagnoses}
            currentLang={currentLang}
            onRefresh={refreshStorage}
          />
        )}
      </main>

      {/* Gemini 3.8 Live Voice Modal */}
      <GeminiLiveVoice
        isOpen={isLiveVoiceOpen}
        onClose={() => setIsLiveVoiceOpen(false)}
      />

      {/* Comfy Floating Bottom Dock Navigation Bar */}
      <div className="fixed bottom-4 left-0 right-0 z-40 px-3 sm:px-4 pointer-events-none flex justify-center">
        <nav className="pointer-events-auto max-w-lg w-full bg-white/95 backdrop-blur-xl rounded-full p-1.5 sm:p-2 border border-stone-200/90 shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center justify-between gap-1">
          {/* Scan Tab */}
          <button
            id="tab-scan"
            onClick={() => setActiveTab('scan')}
            className={`min-h-[48px] sm:min-h-[52px] flex-1 py-1.5 px-2 rounded-full flex flex-col sm:flex-row items-center justify-center gap-1 transition-all duration-200 active:scale-95 ${
              activeTab === 'scan'
                ? 'bg-gradient-to-r from-emerald-700 to-emerald-800 text-white font-bold shadow-[0_4px_12px_rgba(4,120,87,0.35)] scale-102'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70 font-semibold'
            }`}
          >
            <Camera className={`w-4 h-4 sm:w-5 sm:h-5 ${activeTab === 'scan' ? 'text-emerald-100' : 'text-stone-500'}`} />
            <span className="text-[11px] sm:text-xs tracking-tight font-['Outfit']">{t.tabScan}</span>
          </button>

          {/* History Tab */}
          <button
            id="tab-history"
            onClick={() => setActiveTab('history')}
            className={`min-h-[48px] sm:min-h-[52px] flex-1 py-1.5 px-2 rounded-full flex flex-col sm:flex-row items-center justify-center gap-1 transition-all duration-200 active:scale-95 ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-emerald-700 to-emerald-800 text-white font-bold shadow-[0_4px_12px_rgba(4,120,87,0.35)] scale-102'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70 font-semibold'
            }`}
          >
            <BookOpen className={`w-4 h-4 sm:w-5 sm:h-5 ${activeTab === 'history' ? 'text-emerald-100' : 'text-stone-500'}`} />
            <span className="text-[11px] sm:text-xs tracking-tight font-['Outfit']">{t.tabHistory}</span>
          </button>

          {/* Farm Map Tab */}
          <button
            id="tab-map"
            onClick={() => setActiveTab('map')}
            className={`min-h-[48px] sm:min-h-[52px] flex-1 py-1.5 px-2 rounded-full flex flex-col sm:flex-row items-center justify-center gap-1 transition-all duration-200 active:scale-95 ${
              activeTab === 'map'
                ? 'bg-gradient-to-r from-emerald-700 to-emerald-800 text-white font-bold shadow-[0_4px_12px_rgba(4,120,87,0.35)] scale-102'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70 font-semibold'
            }`}
          >
            <MapPin className={`w-4 h-4 sm:w-5 sm:h-5 ${activeTab === 'map' ? 'text-emerald-100' : 'text-stone-500'}`} />
            <span className="text-[11px] sm:text-xs tracking-tight font-['Outfit']">{t.tabMap}</span>
          </button>

          {/* Gemini Chat Tab */}
          <button
            id="tab-chat"
            onClick={() => setActiveTab('chat')}
            className={`min-h-[48px] sm:min-h-[52px] flex-1 py-1.5 px-2 rounded-full flex flex-col sm:flex-row items-center justify-center gap-1 transition-all duration-200 active:scale-95 ${
              activeTab === 'chat'
                ? 'bg-gradient-to-r from-emerald-700 to-emerald-800 text-white font-bold shadow-[0_4px_12px_rgba(4,120,87,0.35)] scale-102'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70 font-semibold'
            }`}
          >
            <MessageSquare className={`w-4 h-4 sm:w-5 sm:h-5 ${activeTab === 'chat' ? 'text-emerald-100' : 'text-stone-500'}`} />
            <span className="text-[11px] sm:text-xs tracking-tight font-['Outfit']">{t.tabChat}</span>
          </button>

          {/* Expert Desk Tab with Triage Badge */}
          <button
            id="tab-expert"
            onClick={() => setActiveTab('expert')}
            className={`relative min-h-[48px] sm:min-h-[52px] flex-1 py-1.5 px-2 rounded-full flex flex-col sm:flex-row items-center justify-center gap-1 transition-all duration-200 active:scale-95 ${
              activeTab === 'expert'
                ? 'bg-gradient-to-r from-emerald-700 to-emerald-800 text-white font-bold shadow-[0_4px_12px_rgba(4,120,87,0.35)] scale-102'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70 font-semibold'
            }`}
          >
            <div className="relative">
              <Stethoscope className={`w-4 h-4 sm:w-5 sm:h-5 ${activeTab === 'expert' ? 'text-emerald-100' : 'text-stone-500'}`} />
              {unverifiedCount > 0 && (
                <span className="absolute -top-1.5 -right-2 px-1.5 min-w-[18px] h-[18px] rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                  {unverifiedCount}
                </span>
              )}
            </div>
            <span className="text-[11px] sm:text-xs tracking-tight font-['Outfit']">{t.tabExpert}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
