import React, { useState } from 'react';
import { Volume2, ChevronRight, Check, HelpCircle, AlertTriangle } from 'lucide-react';
import { CropType, DiseaseId, Language, QuestionnaireAnswers } from '../types';
import { UI_STRINGS, speakText } from '../translations';
import { calculateCombinedConfidence } from '../vision';
import { WeatherData } from '../weather';

interface QuestionnaireModalProps {
  currentLang: Language;
  visionConfidence: number;
  initialDiseaseId: DiseaseId;
  defaultCrop: CropType;
  weather?: WeatherData | null;
  onComplete: (result: {
    answers: QuestionnaireAnswers;
    combinedConfidence: number;
    needsExpertReview: boolean;
    notes: string;
  }) => void;
  onCancel: () => void;
}

export const QuestionnaireModal: React.FC<QuestionnaireModalProps> = ({
  currentLang,
  visionConfidence,
  initialDiseaseId,
  defaultCrop,
  weather,
  onComplete,
  onCancel,
}) => {
  const t = UI_STRINGS[currentLang];
  const [currentStep, setCurrentStep] = useState<number>(1);

  const [answers, setAnswers] = useState<QuestionnaireAnswers>({
    crop: defaultCrop,
    cropAge: '1-2_months',
    leafSymptoms: 'brown_lesions',
    fieldSpread: 'moderate_10-50%',
  });

  const handleSpeakCurrentStep = () => {
    let textToSpeak = '';
    if (currentStep === 1) {
      textToSpeak = `${t.q1Crop}: ${t.cropMaize}, ${t.cropTomato}, ${t.cropRice}, ${t.cropWheat}`;
    } else if (currentStep === 2) {
      textToSpeak = `${t.q2Age}: ${t.ageYoung}, ${t.ageMid}, ${t.ageOld}`;
    } else if (currentStep === 3) {
      textToSpeak = `${t.q3Symptoms}: ${t.sympBrown}, ${t.sympYellow}, ${t.sympHoles}, ${t.sympWilt}`;
    } else if (currentStep === 4) {
      textToSpeak = `${t.q4Spread}: ${t.spreadIso}, ${t.spreadMod}, ${t.spreadSev}`;
    }
    speakText(textToSpeak, currentLang);
  };

  const handleFinish = () => {
    const result = calculateCombinedConfidence(visionConfidence, initialDiseaseId, answers, weather);
    onComplete({
      answers,
      combinedConfidence: result.combinedConfidence,
      needsExpertReview: result.needsExpertReview,
      notes: result.notes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#faf9f6] text-stone-900 rounded-[32px] max-w-lg w-full p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.3)] border border-stone-200/80 animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Step Progress Pills */}
        <div className="flex items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-1.5 flex-1">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                  step === currentStep
                    ? 'bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.4)]'
                    : step < currentStep
                    ? 'bg-emerald-400'
                    : 'bg-stone-200'
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-wider pl-2 font-['Outfit']">
            {t.step} {currentStep} {t.of} 4
          </span>
        </div>

        {/* Header with speech readout */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-200/60 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 text-amber-900 flex items-center justify-center shrink-0 border border-amber-300 shadow-2xs">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-['Outfit'] text-stone-900 leading-tight">
                {t.symptomPromptTitle}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Refine diagnosis with field observation
              </p>
            </div>
          </div>
          <button
            onClick={handleSpeakCurrentStep}
            className="min-h-[46px] min-w-[46px] px-3 rounded-2xl bg-emerald-100/90 hover:bg-emerald-200 text-emerald-900 flex items-center justify-center transition active:scale-95 shadow-2xs"
            title={t.readAloud}
          >
            <Volume2 className="w-5 h-5 text-emerald-800" />
          </button>
        </div>

        <p className="text-xs text-stone-600 mb-5 bg-white/80 p-3 rounded-2xl border border-stone-200/80 leading-relaxed shadow-2xs">
          {t.symptomPromptDesc}
        </p>

        {/* Step 1: Crop Selection */}
        {currentStep === 1 && (
          <div className="space-y-3">
            <label className="block text-sm font-bold font-['Outfit'] text-stone-800">{t.q1Crop}</label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'maize', label: t.cropMaize, icon: '🌽' },
                { id: 'tomato', label: t.cropTomato, icon: '🍅' },
                { id: 'rice', label: t.cropRice, icon: '🌾' },
                { id: 'wheat', label: t.cropWheat, icon: '🌱' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAnswers({ ...answers, crop: c.id as CropType })}
                  className={`min-h-[60px] p-3.5 rounded-2xl text-left border-2 flex items-center justify-between transition duration-200 active:scale-95 ${
                    answers.crop === c.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs'
                      : 'border-stone-200/80 hover:border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-2xl">{c.icon}</span>
                    <span className="text-sm font-semibold">{c.label}</span>
                  </span>
                  {answers.crop === c.id && <Check className="w-5 h-5 text-emerald-600" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Crop Age */}
        {currentStep === 2 && (
          <div className="space-y-3">
            <label className="block text-sm font-bold font-['Outfit'] text-stone-800">{t.q2Age}</label>
            <div className="space-y-2.5">
              {[
                { id: '<1_month', label: t.ageYoung, desc: 'Early seedling / tillering stage' },
                { id: '1-2_months', label: t.ageMid, desc: 'Vegetative growth & leaf development' },
                { id: '>2_months', label: t.ageOld, desc: 'Flowering, grain fill or harvest maturity' },
              ].map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAnswers({ ...answers, cropAge: a.id as any })}
                  className={`w-full min-h-[56px] px-4 py-3 rounded-2xl text-left border-2 flex items-center justify-between transition duration-200 active:scale-95 ${
                    answers.cropAge === a.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs'
                      : 'border-stone-200/80 hover:border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold">{a.label}</div>
                    <div className="text-xs text-stone-500 font-normal">{a.desc}</div>
                  </div>
                  {answers.cropAge === a.id && <Check className="w-5 h-5 text-emerald-600" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Visual Symptoms */}
        {currentStep === 3 && (
          <div className="space-y-3">
            <label className="block text-sm font-bold font-['Outfit'] text-stone-800">{t.q3Symptoms}</label>
            <div className="space-y-2.5">
              {[
                { id: 'brown_lesions', label: t.sympBrown, sub: 'Necrotic dark patches or concentric rings' },
                { id: 'yellowing', label: t.sympYellow, sub: 'Chlorotic veins, mosaic or yellow stripe rust' },
                { id: 'holes_insects', label: t.sympHoles, sub: 'Chewed leaf margins or insect larvae tracks' },
                { id: 'wilting', label: t.sympWilt, sub: 'Drooping foliage, curled tips or vascular collapse' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setAnswers({ ...answers, leafSymptoms: s.id as any })}
                  className={`w-full min-h-[58px] px-4 py-3 rounded-2xl text-left border-2 flex items-center justify-between transition duration-200 active:scale-95 ${
                    answers.leafSymptoms === s.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs'
                      : 'border-stone-200/80 hover:border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold">{s.label}</div>
                    <div className="text-xs text-stone-500 font-normal">{s.sub}</div>
                  </div>
                  {answers.leafSymptoms === s.id && <Check className="w-5 h-5 text-emerald-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Field Spread */}
        {currentStep === 4 && (
          <div className="space-y-3">
            <label className="block text-sm font-bold font-['Outfit'] text-stone-800">{t.q4Spread}</label>
            <div className="space-y-2.5">
              {[
                { id: 'isolated_<10%', label: t.spreadIso, level: 'Low incidence • Single plants or corner patch' },
                { id: 'moderate_10-50%', label: t.spreadMod, level: 'Moderate cluster • Spread along wind or furrow' },
                { id: 'severe_>50%', label: t.spreadSev, level: 'Epidemic outbreak • Whole row or majority of field' },
              ].map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => setAnswers({ ...answers, fieldSpread: sp.id as any })}
                  className={`w-full min-h-[56px] px-4 py-3 rounded-2xl text-left border-2 flex items-center justify-between transition duration-200 active:scale-95 ${
                    answers.fieldSpread === sp.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs'
                      : 'border-stone-200/80 hover:border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold">{sp.label}</div>
                    <div className="text-xs text-stone-500 font-normal">{sp.level}</div>
                  </div>
                  {answers.fieldSpread === sp.id && <Check className="w-5 h-5 text-emerald-600" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="mt-7 pt-4 border-t border-stone-200/60 flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="min-h-[48px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-stone-700 hover:bg-stone-200/60 transition active:scale-95"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[48px] px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold text-stone-500 hover:bg-stone-200/60 transition"
            >
              Skip Questionnaire
            </button>
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="min-h-[50px] px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-extrabold flex items-center gap-2 shadow-[0_4px_14px_rgba(5,150,105,0.3)] transition active:scale-95"
            >
              <span>{t.next}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="min-h-[50px] px-7 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-black flex items-center gap-2 shadow-[0_4px_16px_rgba(5,150,105,0.4)] transition active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{t.submitAnswers}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
