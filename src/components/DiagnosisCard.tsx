import React from 'react';
import {
  Volume2,
  Share2,
  AlertTriangle,
  CheckCircle2,
  Sprout,
  FlaskConical,
  ShieldCheck,
  RotateCcw,
  SlidersHorizontal,
  CloudSun,
} from 'lucide-react';
import { DiagnosisRecord, Language } from '../types';
import { DISEASES_DATABASE, UI_STRINGS, speakText } from '../translations';
import { WeatherData, calculateDiseaseWeatherRisk, getCachedWeatherOrFallback } from '../weather';

interface DiagnosisCardProps {
  diagnosis: DiagnosisRecord;
  currentLang: Language;
  weather?: WeatherData | null;
  onRetake: () => void;
  onOpenQuestionnaire: () => void;
}

export const DiagnosisCard: React.FC<DiagnosisCardProps> = ({
  diagnosis,
  currentLang,
  weather,
  onRetake,
  onOpenQuestionnaire,
}) => {
  const t = UI_STRINGS[currentLang];
  const disease = DISEASES_DATABASE[diagnosis.primaryDiagnosis];
  const activeWeather = weather || getCachedWeatherOrFallback();
  const weatherRisk = activeWeather ? calculateDiseaseWeatherRisk(diagnosis.primaryDiagnosis, activeWeather) : null;
  const isHighAlert = Boolean(
    weatherRisk &&
      (weatherRisk.isHighlyFavorable ||
        weatherRisk.riskLevel === 'critical' ||
        (weatherRisk.pathogenFavored && weatherRisk.riskLevel === 'high'))
  );

  const handleSpeak = () => {
    const weatherAlertNote = isHighAlert && weatherRisk ? `. ${weatherRisk.highAlertBadge[currentLang]}. ${weatherRisk.advisory[currentLang]}` : '';
    const text = `${disease.names[currentLang]}. ${t.confidenceScore}: ${(diagnosis.combinedConfidence * 100).toFixed(0)}%${weatherAlertNote}. ${t.culturalTrack}: ${disease.culturalRemedy[currentLang]}. ${t.chemicalTrack}: ${disease.chemicalRemedy[currentLang]}`;
    speakText(text, currentLang);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `🌾 *LeafLens Crop Diagnosis Report*\n` +
      `🌱 *Crop*: ${diagnosis.crop.toUpperCase()}\n` +
      `🔬 *Diagnosis*: ${disease.names.en} (${disease.names[currentLang]})\n` +
      `📊 *Confidence*: ${(diagnosis.combinedConfidence * 100).toFixed(0)}%\n` +
      `⚠️ *Severity*: ${disease.severity.toUpperCase()}\n` +
      (isHighAlert && weatherRisk ? `🚨 *High Alert Weather*: ${weatherRisk.highAlertBadge[currentLang]}\n📍 *Microclimate Note*: ${weatherRisk.highAlertDescription[currentLang]}\n` : '') +
      `🩺 *Field Symptoms*: ${disease.symptoms[currentLang]}\n` +
      `🚜 *Action (Cultural)*: ${disease.culturalRemedy[currentLang]}\n` +
      `🧪 *Action (Chemical/Bio)*: ${disease.chemicalRemedy[currentLang]}\n` +
      `📍 *Date*: ${new Date(diagnosis.timestamp).toLocaleDateString()}\n` +
      (diagnosis.needsExpertReview ? `🚨 *Status*: Flagged for Agronomist Verification\n` : '') +
      `_Generated with LeafLens Offline Field App_`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const severityBadge = () => {
    switch (disease.severity) {
      case 'critical':
        return <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">Critical Alert</span>;
      case 'high':
        return <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">High Risk</span>;
      case 'moderate':
        return <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-yellow-100 text-yellow-900 border border-yellow-300 shadow-2xs">Moderate</span>;
      case 'none':
        return <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">Healthy</span>;
      default:
        return <span className="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-stone-100 text-stone-700">Notice</span>;
    }
  };

  return (
    <div className="bg-white rounded-[32px] shadow-[0_10px_35px_rgba(0,0,0,0.06)] border border-stone-200/80 overflow-hidden transition">
      {/* High Alert Weather Warning Top Banner */}
      {isHighAlert && weatherRisk && (
        <div
          id="weather-high-alert-top-banner"
          className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 text-white px-5 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-rose-800 shadow-xs"
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 animate-pulse">
              <AlertTriangle className="w-4 h-4 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-['Outfit'] font-black uppercase text-xs tracking-wider text-amber-200">
                  {weatherRisk.highAlertBadge[currentLang]}
                </span>
                {activeWeather && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-black/25 border border-white/30 uppercase tracking-wide">
                    {activeWeather.relativeHumidity}% Humidity • {activeWeather.temperature.toFixed(1)}°C
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-50 font-medium mt-0.5 leading-snug">
                {weatherRisk.highAlertDescription[currentLang]}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner if low confidence (<75%) */}
      {diagnosis.needsExpertReview && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 px-5 py-3.5 flex items-center justify-between gap-3 border-b border-amber-400 font-medium text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 font-bold">
            <AlertTriangle className="w-5 h-5 shrink-0 text-stone-950" />
            <span>{t.needsReviewAlert}</span>
          </div>
          <button
            onClick={onOpenQuestionnaire}
            className="min-h-[38px] px-3.5 py-1.5 bg-white hover:bg-stone-100 text-stone-950 rounded-xl text-xs font-extrabold shrink-0 shadow-xs flex items-center gap-1.5 active:scale-95 transition"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
            <span>Refine Survey</span>
          </button>
        </div>
      )}

      {/* Expert Verified Banner if already approved */}
      {diagnosis.expertFeedback && (
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white px-5 py-3 flex items-center gap-2.5 border-b border-emerald-900 text-xs sm:text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          <span>{t.expertVerifiedBadge}: {diagnosis.expertFeedback.verifiedBy}</span>
        </div>
      )}

      <div className="p-5 sm:p-7 space-y-6">
        {/* Photo + Disease Primary Info */}
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <div className="relative w-full sm:w-40 h-52 sm:h-40 rounded-2xl overflow-hidden bg-stone-900 border border-stone-200 shrink-0 shadow-md group">
            <img
              src={diagnosis.photoDataUrl}
              alt="Leaf diagnosis photo"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/70 text-white text-[10px] font-black uppercase backdrop-blur-md border border-white/20">
              {diagnosis.crop}
            </div>
          </div>

          <div className="flex-1 w-full space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {severityBadge()}
                {isHighAlert && weatherRisk && (
                  <span
                    id="weather-high-alert-badge"
                    className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-600 text-white border border-rose-700 shadow-xs flex items-center gap-1.5 animate-pulse"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                    <span>{t.weatherHighAlert}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSpeak}
                  className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 flex items-center gap-2 text-xs font-bold transition active:scale-95 shadow-2xs"
                  title={t.readAloud}
                >
                  <Volume2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{t.readAloud}</span>
                  <div className="flex items-center gap-0.5 ml-1 h-3">
                    <span className="w-0.5 h-2 bg-emerald-600 rounded-full audio-bar-1" />
                    <span className="w-0.5 h-3 bg-emerald-600 rounded-full audio-bar-2" />
                    <span className="w-0.5 h-2 bg-emerald-600 rounded-full audio-bar-3" />
                  </div>
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-['Outfit'] text-stone-900 leading-tight">
                {disease.names[currentLang]}
              </h2>
              <p className="text-xs italic text-stone-500 font-serif mt-0.5">
                {disease.scientificName}
              </p>
            </div>

            {/* High-Alert Microclimate Warning Callout */}
            {isHighAlert && weatherRisk && (
              <div
                id="weather-favorable-warning-callout"
                className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50/50 border-2 border-rose-300 text-rose-950 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 font-['Outfit'] font-black text-xs sm:text-sm text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-bounce" />
                    <span>{weatherRisk.highAlertBadge[currentLang]}</span>
                  </div>
                  {activeWeather && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-200/80 text-rose-950 border border-rose-300 uppercase tracking-wide">
                      {activeWeather.relativeHumidity}% Humidity • {activeWeather.temperature.toFixed(1)}°C
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-rose-900/90 leading-relaxed font-medium">
                  {weatherRisk.highAlertDescription[currentLang]}
                </p>
              </div>
            )}

            {/* Confidence Bar */}
            <div className="bg-[#f9f8f4] rounded-2xl p-3.5 border border-stone-200/70 shadow-2xs">
              <div className="flex justify-between items-center text-xs font-bold text-stone-700 mb-2">
                <span className="font-['Outfit']">{t.combinedScore}</span>
                <span className="text-sm text-emerald-900 font-black">
                  {(diagnosis.combinedConfidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full h-3 bg-stone-200/80 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    diagnosis.combinedConfidence >= 0.85
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                      : diagnosis.combinedConfidence >= 0.75
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600'
                  }`}
                  style={{ width: `${Math.round(diagnosis.combinedConfidence * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-stone-500 mt-1.5 font-medium">
                <span>Edge Vision AI: {(diagnosis.confidence * 100).toFixed(0)}%</span>
                <span>Verification Threshold: 75%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Symptoms Overview */}
        <div className="bg-[#faf9f5] rounded-2xl p-4 sm:p-5 border border-stone-200/80">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span>Visible Pathology</span>
          </h3>
          <p className="text-sm text-stone-800 leading-relaxed font-normal">
            {disease.symptoms[currentLang]}
          </p>
        </div>

        {/* Local Weather & Pathogen Epidemiological Context */}
        {weatherRisk && activeWeather && (
          <div
            id="weather-pathogen-context-card"
            className={`rounded-2xl p-4 sm:p-5 border shadow-2xs space-y-3 transition ${
              isHighAlert
                ? 'bg-gradient-to-br from-rose-50/90 via-white to-amber-50/70 border-rose-300 ring-2 ring-rose-500/20'
                : 'bg-gradient-to-br from-[#faf9f5] via-white to-emerald-50/50 border-emerald-200/90'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isHighAlert
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {isHighAlert ? (
                    <AlertTriangle className="w-4 h-4 text-rose-700 animate-pulse" />
                  ) : (
                    <CloudSun className="w-4 h-4 text-emerald-800" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 font-['Outfit']">
                    {t.microclimateCrossReference}
                  </h4>
                  <span className="text-[11px] text-stone-500 font-medium">
                    {activeWeather.regionName} • {activeWeather.relativeHumidity}% RH, {activeWeather.temperature.toFixed(1)}°C
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {isHighAlert && (
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-600 text-white border border-rose-700 shadow-2xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-ping" />
                    {t.weatherHighAlert}
                  </span>
                )}
                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                    weatherRisk.riskLevel === 'critical'
                      ? 'bg-rose-100 text-rose-900 border-rose-300'
                      : weatherRisk.riskLevel === 'high'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : weatherRisk.riskLevel === 'moderate'
                      ? 'bg-yellow-100 text-yellow-900 border-yellow-300'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}
                >
                  {weatherRisk.riskLevel} Risk ({weatherRisk.riskScore}%)
                </span>
              </div>
            </div>

            {/* Microclimate Cross-Referenced Factors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between ${
                  weatherRisk.favorableFactors.humidityTriggered
                    ? 'bg-rose-100/70 border-rose-200 text-rose-950 font-medium'
                    : 'bg-stone-50/80 border-stone-200 text-stone-700'
                }`}
              >
                <span>💧 {t.humidityFactor}:</span>
                <strong className="font-bold">{weatherRisk.favorableFactors.humidityText}</strong>
              </div>
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between ${
                  weatherRisk.favorableFactors.tempTriggered
                    ? 'bg-rose-100/70 border-rose-200 text-rose-950 font-medium'
                    : 'bg-stone-50/80 border-stone-200 text-stone-700'
                }`}
              >
                <span>🌡️ {t.tempFactor}:</span>
                <strong className="font-bold">{weatherRisk.favorableFactors.tempText}</strong>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
              {weatherRisk.environmentalDriver[currentLang]}
            </p>

            <div
              className={`text-[11px] p-2.5 rounded-xl border font-medium ${
                isHighAlert
                  ? 'bg-rose-100/80 text-rose-950 border-rose-200/90'
                  : 'bg-emerald-100/60 text-emerald-950 border-emerald-200/80'
              }`}
            >
              🌦️ <strong>Microclimate Action Advisory:</strong> {weatherRisk.advisory[currentLang]}
            </div>
          </div>
        )}

        {/* Actionable Dual-Track Remedy Guidance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Track A: Cultural Action */}
          <div className="bg-emerald-50/70 hover:bg-emerald-50 rounded-2xl p-5 border border-emerald-200/80 flex flex-col justify-between transition shadow-2xs">
            <div>
              <div className="flex items-center gap-2.5 text-emerald-900 font-extrabold text-sm mb-2.5 font-['Outfit']">
                <div className="w-8 h-8 rounded-xl bg-emerald-200 text-emerald-900 flex items-center justify-center shrink-0 shadow-2xs">
                  <Sprout className="w-4 h-4" />
                </div>
                <h4>{t.culturalTrack}</h4>
              </div>
              <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed">
                {disease.culturalRemedy[currentLang]}
              </p>
            </div>
            <div className="mt-4 pt-2.5 border-t border-emerald-200/60 text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Zero chemical residue • Immediate physical barrier</span>
            </div>
          </div>

          {/* Track B: Chemical / Bio Intervention */}
          <div className="bg-stone-50 hover:bg-stone-100/70 rounded-2xl p-5 border border-stone-200/80 flex flex-col justify-between transition shadow-2xs">
            <div>
              <div className="flex items-center gap-2.5 text-stone-900 font-extrabold text-sm mb-2.5 font-['Outfit']">
                <div className="w-8 h-8 rounded-xl bg-stone-200 text-stone-900 flex items-center justify-center shrink-0 shadow-2xs">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <h4>{t.chemicalTrack}</h4>
              </div>
              <p className="text-xs sm:text-sm text-stone-800 leading-relaxed">
                {disease.chemicalRemedy[currentLang]}
              </p>
            </div>
            <div className="mt-4 pt-2.5 border-t border-stone-200/60 text-[11px] text-amber-800 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Targeted application • Follow local dilution ratio</span>
            </div>
          </div>
        </div>

        {/* Alternative Diagnosis / Other Candidates */}
        {diagnosis.otherCandidates && diagnosis.otherCandidates.length > 0 && (
          <div className="pt-2 border-t border-stone-200/70">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3 font-['Outfit']">
              {t.topCandidates}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {diagnosis.otherCandidates.map((candidate, idx) => {
                const cDisease = DISEASES_DATABASE[candidate.diseaseId];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/80 text-xs"
                  >
                    <div className="truncate mr-2">
                      <p className="font-bold text-stone-800 truncate">
                        {cDisease.names[currentLang]}
                      </p>
                      <p className="text-[10px] text-stone-500 italic truncate">
                        {cDisease.scientificName}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 font-extrabold text-stone-700 shrink-0 shadow-2xs">
                      {(candidate.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expert Agronomist Feedback if provided */}
        {diagnosis.expertFeedback && (
          <div className="bg-amber-50/90 rounded-2xl p-5 border border-amber-300 shadow-xs">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-sm mb-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-700" />
              <h4 className="font-['Outfit'] text-base">Agronomist Advisory & Verified Prescription</h4>
            </div>
            <p className="text-sm text-amber-950 font-medium mb-3 italic bg-white/60 p-3 rounded-xl border border-amber-200">
              "{diagnosis.expertFeedback.advisoryNotes}"
            </p>
            <p className="text-xs text-amber-900 bg-amber-100/60 p-2.5 rounded-xl border border-amber-200/80">
              <strong>Action Plan:</strong> {diagnosis.expertFeedback.actionPlan}
            </p>
            <div className="text-[11px] text-stone-500 mt-3 font-medium">
              Verified by {diagnosis.expertFeedback.verifiedBy} on{' '}
              {new Date(diagnosis.expertFeedback.verifiedAt).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Action Buttons: WhatsApp and Retake */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 min-h-[50px] py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-md shadow-emerald-700/20 transition cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>{t.shareWhatsApp}</span>
          </button>

          <button
            onClick={onRetake}
            className="min-h-[50px] py-3.5 px-6 bg-stone-100 hover:bg-stone-200 active:scale-[0.99] text-stone-800 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-stone-200 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-stone-600" />
            <span>Scan Another Leaf</span>
          </button>
        </div>
      </div>
    </div>
  );
};
