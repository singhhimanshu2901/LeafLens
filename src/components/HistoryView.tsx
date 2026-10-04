import React, { useState } from 'react';
import {
  Calendar,
  CloudCheck,
  CloudOff,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Share2,
  Volume2,
  Eye,
  Filter,
} from 'lucide-react';
import { CropType, DiagnosisRecord, Language } from '../types';
import { DISEASES_DATABASE, UI_STRINGS, speakText } from '../translations';
import { dbService } from '../db';
import { calculateDiseaseWeatherRisk, getCachedWeatherOrFallback } from '../weather';

interface HistoryViewProps {
  diagnoses: DiagnosisRecord[];
  currentLang: Language;
  onRefresh: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ diagnoses, currentLang, onRefresh }) => {
  const t = UI_STRINGS[currentLang];
  const cachedWeather = getCachedWeatherOrFallback();

  const [selectedCrop, setSelectedCrop] = useState<string>('all');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'needs_review' | 'verified'>('all');
  const [detailItem, setDetailItem] = useState<DiagnosisRecord | null>(null);

  // Apply filters
  const filtered = diagnoses.filter((d) => {
    if (selectedCrop !== 'all' && d.crop !== selectedCrop) return false;
    if (selectedFilter === 'needs_review' && !d.needsExpertReview) return false;
    if (selectedFilter === 'verified' && !d.expertFeedback) return false;
    return true;
  });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this diagnosis record from local storage?')) {
      await dbService.deleteDiagnosis(id);
      if (detailItem?.id === id) {
        setDetailItem(null);
      }
      onRefresh();
    }
  };

  const handleShareWhatsApp = (d: DiagnosisRecord) => {
    const meta = DISEASES_DATABASE[d.primaryDiagnosis];
    const text = encodeURIComponent(
      `🌾 *LeafLens Historical Diagnosis*\n` +
      `🌱 *Crop*: ${d.crop.toUpperCase()}\n` +
      `🔬 *Disease*: ${meta.names.en} (${meta.names[currentLang]})\n` +
      `📊 *Confidence*: ${(d.combinedConfidence * 100).toFixed(0)}%\n` +
      `📅 *Date*: ${new Date(d.timestamp).toLocaleString()}\n` +
      `🚜 *Prescription*: ${meta.culturalRemedy[currentLang]}\n` +
      (d.expertFeedback ? `✅ *Expert Verified*: ${d.expertFeedback.advisoryNotes}\n` : '') +
      `_From LeafLens Archive_`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-6 rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/90 ring-1 ring-stone-900/5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-extrabold font-['Outfit'] text-stone-900">{t.historyTitle}</h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            {diagnoses.length} local scans securely preserved on device IndexedDB
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`min-h-[42px] px-4 py-2 rounded-2xl text-xs font-bold transition active:scale-95 shadow-2xs ${
              selectedFilter === 'all'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-[#f4f2ec] text-stone-700 hover:bg-stone-200'
            }`}
          >
            {t.allStatuses}
          </button>
          <button
            onClick={() => setSelectedFilter('needs_review')}
            className={`min-h-[42px] px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-2xs ${
              selectedFilter === 'needs_review'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 border border-amber-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            <span>{t.filterNeedsReview}</span>
          </button>
          <button
            onClick={() => setSelectedFilter('verified')}
            className={`min-h-[42px] px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-2xs ${
              selectedFilter === 'verified'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-900 border border-emerald-300'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>{t.filterVerified}</span>
          </button>
        </div>
      </div>

      {/* Crop Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
        {[
          { id: 'all', label: t.allCrops },
          { id: 'maize', label: '🌽 ' + t.cropMaize },
          { id: 'tomato', label: '🍅 ' + t.cropTomato },
          { id: 'rice', label: '🌾 ' + t.cropRice },
          { id: 'wheat', label: '🌱 ' + t.cropWheat },
        ].map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCrop(c.id)}
            className={`min-h-[42px] px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
              selectedCrop === c.id
                ? 'bg-emerald-800 text-white shadow-xs font-extrabold'
                : 'bg-white/75 backdrop-blur-md border border-white/90 ring-1 ring-stone-900/5 text-stone-700 hover:bg-white/90 shadow-2xs'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid of Diagnoses Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white/80 backdrop-blur-xl rounded-[32px] border border-white/90 ring-1 ring-stone-900/5 p-8 sm:p-12 space-y-3 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/80 backdrop-blur-md border border-stone-200/80 flex items-center justify-center text-stone-400 shadow-2xs">
            <Calendar className="w-7 h-7 text-stone-400" />
          </div>
          <p className="text-base font-bold font-['Outfit'] text-stone-700">{t.noRecordsFound}</p>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            Take a snap in the Scan tab to run on-device disease detection. All history stays safe on your device.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => {
            const meta = DISEASES_DATABASE[item.primaryDiagnosis];
            return (
              <div
                key={item.id}
                onClick={() => setDetailItem(item)}
                className="bg-white/80 backdrop-blur-xl rounded-[26px] p-4 sm:p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/90 ring-1 ring-stone-900/5 hover:border-emerald-500/80 hover:bg-white/95 hover:shadow-[0_12px_36px_rgba(5,150,105,0.12)] transition duration-200 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Photo Thumbnail + Badges */}
                  <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-stone-900 mb-3.5 border border-stone-100 shadow-inner">
                    <img
                      src={item.photoDataUrl}
                      alt={item.diseaseDisplayName}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    {/* Sync status tag */}
                    <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase backdrop-blur-md flex items-center gap-1 shadow-xs bg-black/60 text-white border border-white/20">
                      {item.synced ? (
                        <>
                          <CloudCheck className="w-3 h-3 text-emerald-400" />
                          <span>Synced</span>
                        </>
                      ) : (
                        <>
                          <CloudOff className="w-3 h-3 text-amber-400" />
                          <span>Local</span>
                        </>
                      )}
                    </div>

                    {/* Crop Tag */}
                    <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-xl bg-black/65 text-white text-[10px] font-black uppercase backdrop-blur-md border border-white/20">
                      {item.crop}
                    </div>

                    {/* Confidence percentage */}
                    <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-emerald-950/85 text-emerald-300 text-xs font-black backdrop-blur-md border border-emerald-500/30">
                      {(item.combinedConfidence * 100).toFixed(0)}%
                    </div>
                  </div>

                  {/* Disease Info */}
                  <div className="space-y-1">
                    <h3 className="font-extrabold font-['Outfit'] text-stone-900 text-base leading-snug group-hover:text-emerald-800 transition">
                      {meta.names[currentLang] || item.diseaseDisplayName}
                    </h3>
                    <p className="text-[11px] text-stone-400 font-medium">
                      {new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {/* Status Badges */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(() => {
                      const itemRisk = calculateDiseaseWeatherRisk(item.primaryDiagnosis, cachedWeather);
                      const isItemHighAlert = itemRisk.isHighlyFavorable || itemRisk.riskLevel === 'critical' || (itemRisk.pathogenFavored && itemRisk.riskLevel === 'high');
                      if (isItemHighAlert) {
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-600 text-white border border-rose-700 shadow-2xs">
                            <AlertTriangle className="w-3 h-3 text-amber-200" />
                            <span>Weather Alert</span>
                          </span>
                        );
                      }
                      return null;
                    })()}
                    {item.expertFeedback ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                        <span>Verified</span>
                      </span>
                    ) : item.needsExpertReview ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-700" />
                        <span>Needs Review</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Footer action icons */}
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1 group-hover:translate-x-1 transition">
                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t.viewDetails}</span>
                  </span>

                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="min-h-[38px] min-w-[38px] p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition active:scale-95"
                    title={t.deleteRecord}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Historical Entry Detail Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white/90 backdrop-blur-2xl rounded-[32px] max-w-lg w-full p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.25)] border border-white/90 ring-1 ring-stone-900/10 max-h-[90vh] overflow-y-auto space-y-5 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200/70">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 font-['Outfit']">
                {new Date(detailItem.timestamp).toLocaleString()}
              </span>
              <button
                onClick={() => setDetailItem(null)}
                className="min-h-[40px] px-3.5 py-1.5 text-xs font-extrabold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-200/70 transition active:scale-95"
              >
                Close
              </button>
            </div>

            <div className="aspect-video rounded-2xl overflow-hidden bg-stone-900 border border-stone-200 shadow-md">
              <img
                src={detailItem.photoDataUrl}
                alt="Leaf photo"
                className="w-full h-full object-cover"
              />
            </div>

            {/* High Alert Weather Banner in Detail Modal */}
            {(() => {
              const modalRisk = calculateDiseaseWeatherRisk(detailItem.primaryDiagnosis, cachedWeather);
              const isModalHighAlert = modalRisk.isHighlyFavorable || modalRisk.riskLevel === 'critical' || (modalRisk.pathogenFavored && modalRisk.riskLevel === 'high');
              if (isModalHighAlert) {
                return (
                  <div className="bg-rose-600 text-white p-3.5 rounded-2xl flex items-start gap-2.5 shadow-sm border border-rose-700">
                    <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <span className="font-bold text-xs uppercase tracking-wide block text-amber-200">
                        {modalRisk.highAlertBadge[currentLang]}
                      </span>
                      <span className="text-[11px] text-rose-100 leading-snug mt-0.5 block">
                        {modalRisk.highAlertDescription[currentLang]}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-lg bg-stone-200 text-stone-800">
                  {detailItem.crop}
                </span>
                <span className="text-sm font-black text-emerald-800 font-['Outfit']">
                  {(detailItem.combinedConfidence * 100).toFixed(0)}% Confidence
                </span>
              </div>
              <h3 className="text-2xl font-black font-['Outfit'] text-stone-900">
                {DISEASES_DATABASE[detailItem.primaryDiagnosis].names[currentLang]}
              </h3>
              <p className="text-xs text-stone-500 italic mt-0.5">
                {DISEASES_DATABASE[detailItem.primaryDiagnosis].scientificName}
              </p>
            </div>

            {/* Cultural & Chemical Guidance */}
            <div className="space-y-3 bg-white/75 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/90 ring-1 ring-stone-900/5 text-xs shadow-2xs">
              <div>
                <strong className="text-emerald-900 font-bold block mb-1 text-sm font-['Outfit']">🌱 {t.culturalTrack}:</strong>
                <p className="text-stone-700 leading-relaxed">{DISEASES_DATABASE[detailItem.primaryDiagnosis].culturalRemedy[currentLang]}</p>
              </div>
              <div className="pt-3 border-t border-stone-200/60">
                <strong className="text-blue-900 font-bold block mb-1 text-sm font-['Outfit']">🧪 {t.chemicalTrack}:</strong>
                <p className="text-stone-700 leading-relaxed">{DISEASES_DATABASE[detailItem.primaryDiagnosis].chemicalRemedy[currentLang]}</p>
              </div>
            </div>

            {/* Expert Feedback if available */}
            {detailItem.expertFeedback && (
              <div className="bg-amber-50/90 p-4 sm:p-5 rounded-2xl border border-amber-300 text-xs space-y-2 shadow-2xs">
                <span className="font-bold text-amber-950 block text-sm font-['Outfit']">✅ Verified by Agronomist:</span>
                <p className="text-amber-950 font-medium italic">"{detailItem.expertFeedback.advisoryNotes}"</p>
                <p className="text-amber-900 bg-amber-100/60 p-2.5 rounded-xl border border-amber-200">
                  <strong>Action Plan:</strong> {detailItem.expertFeedback.actionPlan}
                </p>
                <div className="text-[11px] text-stone-500 pt-1 font-medium">
                  Officer: {detailItem.expertFeedback.verifiedBy}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-stone-200/70 flex items-center gap-2.5">
              <button
                onClick={() => {
                  const meta = DISEASES_DATABASE[detailItem.primaryDiagnosis];
                  speakText(`${meta.names[currentLang]}. ${meta.culturalRemedy[currentLang]}`, currentLang);
                }}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-2xs"
              >
                <Volume2 className="w-4 h-4 text-emerald-700" />
                <span>{t.readAloud}</span>
              </button>

              <button
                onClick={() => handleShareWhatsApp(detailItem)}
                className="flex-1 min-h-[48px] py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(5,150,105,0.3)] transition active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>{t.shareWhatsApp}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
