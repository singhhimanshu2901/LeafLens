import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Send,
  Sliders,
  Sparkles,
  FileText,
  UserCheck,
} from 'lucide-react';
import { CropType, DiagnosisRecord, DiseaseId, Language } from '../types';
import { DISEASES_DATABASE, UI_STRINGS } from '../translations';
import { dbService } from '../db';

interface ExpertDeskProps {
  diagnoses: DiagnosisRecord[];
  currentLang: Language;
  onRefresh: () => void;
}

export const ExpertDesk: React.FC<ExpertDeskProps> = ({ diagnoses, currentLang, onRefresh }) => {
  const t = UI_STRINGS[currentLang];

  // Cases that either need review (<75%) or have not yet been reviewed by an agronomist
  const unverifiedCases = diagnoses.filter(
    (d) => d.needsExpertReview || !d.expertFeedback
  );

  const [activeCase, setActiveCase] = useState<DiagnosisRecord | null>(
    unverifiedCases.length > 0 ? unverifiedCases[0] : null
  );

  // Form state
  const [agronomistName, setAgronomistName] = useState('Dr. Anita Sharma, Senior Extension Agronomist');
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<DiseaseId>(
    activeCase ? activeCase.primaryDiagnosis : 'maize_late_blight'
  );
  const [advisoryNotes, setAdvisoryNotes] = useState(
    'Reviewed leaf symptoms. Confirmed fungal etiology with necrotic margin spread. Apply targeted copper-based foliar spray within 48 hours and monitor surrounding field zone.'
  );
  const [actionPlan, setActionPlan] = useState(
    'Isolate affected plant cluster. Switch to drip irrigation. Re-inspect after 5 days.'
  );
  const [submitting, setSubmitting] = useState(false);

  // When active case changes, sync selection
  const handleSelectCase = (c: DiagnosisRecord) => {
    setActiveCase(c);
    setSelectedDiagnosis(c.primaryDiagnosis);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase) return;

    setSubmitting(true);
    try {
      const updated: DiagnosisRecord = {
        ...activeCase,
        primaryDiagnosis: selectedDiagnosis,
        diseaseDisplayName: DISEASES_DATABASE[selectedDiagnosis].names.en,
        needsExpertReview: false, // cleared by expert
        combinedConfidence: Math.max(activeCase.combinedConfidence, 0.95), // expert elevates confidence
        expertFeedback: {
          verifiedBy: agronomistName || 'Regional Plant Pathologist',
          verifiedAt: Date.now(),
          confirmedDiagnosis: selectedDiagnosis,
          advisoryNotes: advisoryNotes,
          actionPlan: actionPlan,
        },
      };

      await dbService.updateDiagnosis(updated);
      onRefresh();

      // Advance to next unverified case if any
      const remaining = unverifiedCases.filter((c) => c.id !== activeCase.id);
      setActiveCase(remaining.length > 0 ? remaining[0] : null);
    } catch (err) {
      console.error('Error submitting review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Agronomist Portal Header */}
      <div className="bg-white/80 backdrop-blur-xl text-stone-900 rounded-[32px] p-6 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/90 ring-1 ring-stone-900/5 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-700 shrink-0 shadow-xs">
            <Stethoscope className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-extrabold font-['Outfit'] tracking-tight text-stone-900">{t.expertDeskTitle}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300/80">
                Live Field Triage
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-1 max-w-xl font-normal leading-relaxed">
              {t.expertDeskDesc}
            </p>
          </div>
        </div>

        <div className="bg-white/85 px-5 py-3 rounded-2xl border border-white/90 ring-1 ring-stone-900/5 text-left md:text-right shrink-0 backdrop-blur-md relative z-10 shadow-xs">
          <div className="text-3xl font-black font-['Outfit'] text-amber-700">{unverifiedCases.length}</div>
          <div className="text-[11px] text-stone-500 font-medium">{t.pendingTriageCount}</div>
        </div>
      </div>

      {unverifiedCases.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-12 sm:p-16 text-center border border-white/90 ring-1 ring-stone-900/5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-200/80 shadow-2xs">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-extrabold font-['Outfit'] text-stone-900">All Field Submissions Verified</h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto leading-relaxed">
            There are no pending low-confidence scans requiring agronomist intervention at this time. Farmers are equipped with verified protocols.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Triage Queue List (Left column) */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 px-1 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Pending Cases Queue ({unverifiedCases.length})</span>
            </h3>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {unverifiedCases.map((c) => {
                const isSelected = activeCase?.id === c.id;
                const meta = DISEASES_DATABASE[c.primaryDiagnosis];
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCase(c)}
                    className={`w-full text-left p-3.5 rounded-2xl border-2 transition duration-200 flex items-center gap-3.5 active:scale-98 ${
                      isSelected
                        ? 'border-emerald-600 bg-white/95 backdrop-blur-md shadow-md ring-1 ring-emerald-500/20'
                        : 'border-white/80 bg-white/70 backdrop-blur-md hover:bg-white/90 hover:border-stone-300 text-stone-700 shadow-2xs ring-1 ring-stone-900/5'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-900 shrink-0 border border-stone-200 shadow-2xs">
                      <img
                        src={c.photoDataUrl}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
                          {c.crop}
                        </span>
                        <span className="text-xs font-black text-amber-700 font-['Outfit']">
                          {(c.combinedConfidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="font-extrabold text-xs text-stone-900 truncate font-['Outfit']">
                        {meta.names[currentLang]}
                      </div>
                      <div className="text-[10px] text-stone-400 font-medium">
                        {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Review Form (Right column) */}
          {activeCase && (
            <div className="lg:col-span-8 bg-white/80 backdrop-blur-xl rounded-[32px] p-6 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/90 ring-1 ring-stone-900/5 space-y-6">
              <div className="flex items-center justify-between border-b border-stone-200/60 pb-4">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700 font-['Outfit']">
                    Triage Case #{activeCase.id.slice(-6)}
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold font-['Outfit'] text-stone-900">
                    Agronomist Verification & Prescription
                  </h3>
                </div>
                <div className="text-right text-xs text-stone-500 font-medium">
                  Logged: {new Date(activeCase.timestamp).toLocaleString()}
                </div>
              </div>

              {/* Photo & Model Prediction Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="aspect-4/3 rounded-2xl overflow-hidden bg-stone-900 border border-stone-200 shadow-md">
                  <img
                    src={activeCase.photoDataUrl}
                    alt="Review leaf"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/80 ring-1 ring-stone-900/5 space-y-2.5 text-xs shadow-2xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-600">Model Initial Diagnosis:</span>
                    <span className="font-black text-stone-900">
                      {DISEASES_DATABASE[activeCase.primaryDiagnosis].names.en}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-600">Vision Model Confidence:</span>
                    <span className="font-semibold text-emerald-800">
                      {(activeCase.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-600">Combined Heuristic Score:</span>
                    <span className="font-bold text-amber-700">
                      {(activeCase.combinedConfidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {activeCase.questionnaireAnswers && (
                    <div className="pt-2.5 border-t border-stone-200/80 space-y-1">
                      <div className="font-bold text-stone-800">Farmer Field Survey:</div>
                      <div className="text-stone-600">
                        • Crop Age: {activeCase.questionnaireAnswers.cropAge}
                      </div>
                      <div className="text-stone-600">
                        • Visual: {activeCase.questionnaireAnswers.leafSymptoms}
                      </div>
                      <div className="text-stone-600">
                        • Field Spread: {activeCase.questionnaireAnswers.fieldSpread}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Review & Prescription Form */}
              <form onSubmit={handleSubmitReview} className="space-y-4">
                {/* Override or Confirm Disease */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5 font-['Outfit']">
                    {t.confirmedDiagnosis} (Confirm or Override AI)
                  </label>
                  <select
                    value={selectedDiagnosis}
                    onChange={(e) => setSelectedDiagnosis(e.target.value as DiseaseId)}
                    className="w-full min-h-[50px] px-4 py-2.5 rounded-2xl border-2 border-stone-200 focus:border-emerald-600 bg-white text-sm font-semibold text-stone-900 shadow-2xs"
                  >
                    {(Object.keys(DISEASES_DATABASE) as DiseaseId[]).map((id) => (
                      <option key={id} value={id}>
                        {DISEASES_DATABASE[id].names.en} ({DISEASES_DATABASE[id].scientificName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Agronomist Credentials */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5 font-['Outfit']">
                    {t.agronomistName}
                  </label>
                  <input
                    type="text"
                    value={agronomistName}
                    onChange={(e) => setAgronomistName(e.target.value)}
                    required
                    className="w-full min-h-[50px] px-4 py-2.5 rounded-2xl border border-stone-300 focus:border-emerald-600 bg-white text-sm text-stone-900 shadow-2xs"
                  />
                </div>

                {/* Prescription Notes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5 font-['Outfit']">
                    {t.advisoryNotes}
                  </label>
                  <textarea
                    rows={3}
                    value={advisoryNotes}
                    onChange={(e) => setAdvisoryNotes(e.target.value)}
                    required
                    className="w-full p-4 rounded-2xl border border-stone-300 focus:border-emerald-600 bg-white text-sm text-stone-900 shadow-2xs"
                  />
                </div>

                {/* Action Plan */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5 font-['Outfit']">
                    {t.actionPlan}
                  </label>
                  <input
                    type="text"
                    value={actionPlan}
                    onChange={(e) => setActionPlan(e.target.value)}
                    required
                    className="w-full min-h-[50px] px-4 py-2.5 rounded-2xl border border-stone-300 focus:border-emerald-600 bg-white text-sm text-stone-900 shadow-2xs"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[54px] py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(5,150,105,0.35)] transition active:scale-98"
                  >
                    <UserCheck className="w-5 h-5" />
                    <span>{submitting ? 'Submitting Review...' : t.submitReview}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
