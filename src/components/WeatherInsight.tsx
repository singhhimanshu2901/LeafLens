import React, { useEffect, useState } from 'react';
import {
  CloudSun,
  Droplets,
  Thermometer,
  Wind,
  MapPin,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Info,
  Navigation,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { DiseaseId, Language } from '../types';
import { UI_STRINGS } from '../translations';
import {
  WeatherData,
  RegionalPreset,
  REGIONAL_PRESETS,
  fetchRegionalWeather,
  calculateDiseaseWeatherRisk,
} from '../weather';

interface WeatherInsightProps {
  currentLang: Language;
  onWeatherLoaded?: (weather: WeatherData) => void;
  compact?: boolean;
}

export const WeatherInsight: React.FC<WeatherInsightProps> = ({
  currentLang,
  onWeatherLoaded,
  compact = false,
}) => {
  const t = UI_STRINGS[currentLang];

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<RegionalPreset>(() => {
    try {
      const saved = localStorage.getItem('leaflens_preferred_region');
      if (saved) {
        const found = REGIONAL_PRESETS.find((p) => p.id === saved);
        if (found) return found;
      }
    } catch (e) {
      // ignore
    }
    return REGIONAL_PRESETS[0];
  });

  const [isCustomGps, setIsCustomGps] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [activeDiseaseTab, setActiveDiseaseTab] = useState<DiseaseId>('rice_blast');

  // Load weather for active region
  const loadWeather = async (preset: RegionalPreset, force = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRegionalWeather(
        preset.latitude,
        preset.longitude,
        preset.name,
        force
      );
      setWeather(data);
      if (onWeatherLoaded) {
        onWeatherLoaded(data);
      }
    } catch (err: any) {
      console.warn('Weather load error:', err);
      setError('Unable to fetch live weather. Showing cached patterns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeather(selectedPreset);
  }, [selectedPreset.id]);

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const found = REGIONAL_PRESETS.find((p) => p.id === e.target.value);
    if (found) {
      setSelectedPreset(found);
      setIsCustomGps(false);
      try {
        localStorage.setItem('leaflens_preferred_region', found.id);
      } catch (err) {
        // ignore
      }
    }
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported on this browser/device.');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const custom: RegionalPreset = {
          id: 'custom_gps',
          name: 'My Farm (GPS Location)',
          country: 'Local',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          notes: `Lat: ${pos.coords.latitude.toFixed(2)}, Lon: ${pos.coords.longitude.toFixed(2)}`,
        };
        setIsCustomGps(true);
        setSelectedPreset(custom);
        await loadWeather(custom, true);
      },
      (err) => {
        console.warn('GPS error:', err);
        setError('Location permission denied or unavailable. Using agricultural preset.');
        setLoading(false);
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  const handleManualRefresh = () => {
    loadWeather(selectedPreset, true);
  };

  if (!weather && loading) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-[28px] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/90 ring-1 ring-stone-900/5 flex items-center justify-center gap-3 text-stone-500 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
        <span>Fetching local microclimate patterns...</span>
      </div>
    );
  }

  if (!weather) return null;

  // Calculate disease risk for all 4 key diseases
  const diseasesToCheck: DiseaseId[] = [
    'rice_blast',
    'tomato_early_blight',
    'maize_late_blight',
    'wheat_yellow_rust',
  ];

  const diseaseRisks = diseasesToCheck.map((id) => calculateDiseaseWeatherRisk(id, weather));
  const highRiskDiseases = diseaseRisks.filter(
    (r) => r.riskLevel === 'high' || r.riskLevel === 'critical'
  );
  const activeRiskDetail =
    diseaseRisks.find((r) => r.diseaseId === activeDiseaseTab) || diseaseRisks[0];

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      case 'high':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-900 border-yellow-300';
      default:
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[28px] p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/90 ring-1 ring-stone-900/5 space-y-4 transition">
      {/* Top Header: Title, Location Selector & Cached/Live Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs border border-emerald-200/60">
            <CloudSun className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-['Outfit'] font-bold text-stone-900 text-base">
                {t.localWeatherTitle}
              </h3>
              {weather.isCached ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>{t.cachedWeather}</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{t.liveWeather}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-500">{t.localWeatherDesc}</p>
          </div>
        </div>

        {/* Region Selector & GPS Action */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="relative">
            <select
              value={isCustomGps ? 'custom_gps' : selectedPreset.id}
              onChange={handleSelectPreset}
              className="appearance-none pl-7 pr-8 py-1.5 bg-[#f9f8f4] hover:bg-white text-stone-800 rounded-xl text-xs font-semibold border border-stone-200/80 shadow-2xs focus:outline-none focus:border-emerald-600 transition cursor-pointer"
            >
              {isCustomGps && <option value="custom_gps">📍 {selectedPreset.name}</option>}
              {REGIONAL_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} ({preset.country})
                </option>
              ))}
            </select>
            <MapPin className="w-3.5 h-3.5 text-emerald-700 absolute left-2.5 top-2.5 pointer-events-none" />
            <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* GPS Locate Button */}
          <button
            onClick={handleUseGps}
            title={t.useGps}
            className="p-1.5 rounded-xl bg-[#f9f8f4] hover:bg-white text-stone-700 hover:text-emerald-800 border border-stone-200/80 shadow-2xs transition active:scale-95"
          >
            <Navigation className="w-4 h-4 text-emerald-700" />
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            title={t.refreshWeather}
            className="p-1.5 rounded-xl bg-[#f9f8f4] hover:bg-white text-stone-700 hover:text-emerald-800 border border-stone-200/80 shadow-2xs transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-700 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 text-amber-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Metrics: Temperature, Relative Humidity, Conditions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Temperature */}
        <div className="bg-[#faf9f5] rounded-2xl p-3.5 border border-stone-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span className="flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-amber-600" />
              <span>{t.temp}</span>
            </span>
            <span className="text-[10px] text-stone-400">
              {weather.dailyTempMin}° / {weather.dailyTempMax}°
            </span>
          </div>
          <div className="mt-1">
            <div className="text-2xl font-black font-['Outfit'] text-stone-900">
              {weather.temperature.toFixed(1)}°C
            </div>
            <div className="text-[10px] text-stone-500 font-medium">
              {t.feelsLike} {weather.apparentTemperature.toFixed(0)}°C
            </div>
          </div>
        </div>

        {/* Relative Humidity */}
        <div className="bg-[#faf9f5] rounded-2xl p-3.5 border border-stone-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span className="flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-blue-600" />
              <span>{t.humidity}</span>
            </span>
            <span className="text-[10px] text-stone-400">
              Peak {weather.dailyHumidityMax}%
            </span>
          </div>
          <div className="mt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-['Outfit'] text-stone-900">
                {weather.relativeHumidity}%
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                  weather.relativeHumidity >= 80
                    ? 'bg-rose-100 text-rose-800'
                    : weather.relativeHumidity >= 65
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {weather.relativeHumidity >= 80 ? 'High' : weather.relativeHumidity >= 65 ? 'Moderate' : 'Optimal'}
              </span>
            </div>
            {/* Visual humidity bar */}
            <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full rounded-full ${
                  weather.relativeHumidity >= 80
                    ? 'bg-rose-500'
                    : weather.relativeHumidity >= 65
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, weather.relativeHumidity)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Condition & Wind */}
        <div className="bg-[#faf9f5] rounded-2xl p-3.5 border border-stone-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span className="flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-teal-600" />
              <span>{t.wind}</span>
            </span>
          </div>
          <div className="mt-1">
            <div className="text-lg font-extrabold font-['Outfit'] text-stone-900">
              {weather.windSpeed.toFixed(0)} <span className="text-xs font-normal text-stone-500">km/h</span>
            </div>
            <div className="text-[10px] text-stone-500 font-medium truncate">
              {weather.conditionText}
            </div>
          </div>
        </div>

        {/* Rain Risk */}
        <div className="bg-[#faf9f5] rounded-2xl p-3.5 border border-stone-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span className="flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-indigo-600" />
              <span>{t.precipitation}</span>
            </span>
          </div>
          <div className="mt-1">
            <div className="text-lg font-extrabold font-['Outfit'] text-stone-900">
              {weather.precipitationProbability ?? 30}%
            </div>
            <div className="text-[10px] text-stone-500 font-medium">
              {weather.precipitation > 0 ? `${weather.precipitation.toFixed(1)} mm rainfall` : 'Leaf wetness risk'}
            </div>
          </div>
        </div>
      </div>

      {/* Disease Risk Overview Alert */}
      {highRiskDiseases.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-amber-950 font-['Outfit'] block">
              Elevated Fungal Spore Weather Alert
            </span>
            <span className="text-amber-900 leading-relaxed block mt-0.5">
              High humidity ({weather.relativeHumidity}%) and warm temperatures ({weather.temperature.toFixed(0)}°C)
              favor rapid proliferation of{' '}
              <strong>{highRiskDiseases.map((d) => d.title[currentLang]).join(', ')}</strong>.
            </span>
          </div>
        </div>
      )}

      {/* Crop Disease Microclimate Vulnerability Tabs */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5 font-['Outfit']">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-700" />
            <span>{t.diseaseRiskOverview}</span>
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-bold text-emerald-800 hover:text-emerald-900 flex items-center gap-1 transition"
          >
            <span>{expanded ? 'Show Less' : 'View Pathogen Breakdown'}</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Quick disease risk pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'rice_blast', name: '🌾 Rice Blast', risk: diseaseRisks[0] },
            { id: 'tomato_early_blight', name: '🍅 Tomato Blight', risk: diseaseRisks[1] },
            { id: 'maize_late_blight', name: '🌽 Maize Blight', risk: diseaseRisks[2] },
            { id: 'wheat_yellow_rust', name: '🌱 Wheat Rust', risk: diseaseRisks[3] },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveDiseaseTab(item.id as DiseaseId);
                setExpanded(true);
              }}
              className={`p-2.5 rounded-xl border text-left transition duration-150 flex flex-col justify-between ${
                activeDiseaseTab === item.id
                  ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
                  : 'bg-white/60 hover:bg-white border-stone-200/80 shadow-2xs'
              }`}
            >
              <div className="text-xs font-bold text-stone-800 truncate">{item.name}</div>
              <div className="flex items-center justify-between gap-1 mt-1.5">
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${getRiskBadge(
                    item.risk.riskLevel
                  )}`}
                >
                  {item.risk.riskLevel}
                </span>
                <span className="text-[10px] font-bold text-stone-500">{item.risk.riskScore}%</span>
              </div>
            </button>
          ))}
        </div>

        {/* Expanded Pathogen Microclimate Breakdown */}
        {expanded && activeRiskDetail && (
          <div className="mt-3 p-4 rounded-2xl bg-[#faf9f5] border border-stone-200/80 text-xs space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-stone-200/70 pb-2">
              <span className="font-extrabold text-stone-900 font-['Outfit'] text-sm">
                {activeRiskDetail.title[currentLang]}
              </span>
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${getRiskBadge(
                  activeRiskDetail.riskLevel
                )}`}
              >
                {activeRiskDetail.riskLevel} Risk
              </span>
            </div>

            <div>
              <strong className="text-stone-700 block mb-0.5">Microclimate Driver:</strong>
              <p className="text-stone-600 leading-relaxed">
                {activeRiskDetail.environmentalDriver[currentLang]}
              </p>
            </div>

            <div className="bg-white p-3 rounded-xl border border-stone-200/70">
              <strong className="text-emerald-900 font-bold block mb-1">
                🚜 Field Weather Advisory:
              </strong>
              <p className="text-stone-700 leading-relaxed">
                {activeRiskDetail.advisory[currentLang]}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
