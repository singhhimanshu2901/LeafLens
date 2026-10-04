import { CropType, DiseaseId, Language } from './types';

export interface WeatherData {
  temperature: number; // in Celsius
  relativeHumidity: number; // in %
  apparentTemperature: number; // "feels like" °C
  precipitation: number; // mm
  precipitationProbability?: number; // %
  weatherCode: number;
  windSpeed: number; // km/h
  dailyTempMax: number;
  dailyTempMin: number;
  dailyHumidityMax: number;
  conditionText: string;
  regionName: string;
  latitude: number;
  longitude: number;
  fetchedAt: number; // timestamp
  isCached: boolean;
}

export interface DiseaseWeatherRisk {
  diseaseId: DiseaseId;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  riskScore: number; // 0 to 100
  title: Record<Language, string>;
  environmentalDriver: Record<Language, string>;
  advisory: Record<Language, string>;
  pathogenFavored: boolean;
  isHighlyFavorable: boolean; // Current humidity & temp match optimal disease surge profile
  highAlertBadge: Record<Language, string>;
  highAlertDescription: Record<Language, string>;
  favorableFactors: {
    humidityTriggered: boolean;
    tempTriggered: boolean;
    humidityText: string;
    tempText: string;
  };
}

export interface RegionalPreset {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  notes: string;
}

export const REGIONAL_PRESETS: RegionalPreset[] = [
  {
    id: 'rift_valley',
    name: 'Eldoret / Rift Valley',
    country: 'Kenya',
    latitude: 0.5143,
    longitude: 35.2698,
    notes: 'Major maize & wheat breadbasket belt',
  },
  {
    id: 'punjab_ludhiana',
    name: 'Ludhiana / Punjab',
    country: 'India',
    latitude: 30.901,
    longitude: 75.8573,
    notes: 'Intense wheat & rice rotation plains',
  },
  {
    id: 'varanasi_plains',
    name: 'Varanasi / Eastern UP',
    country: 'India',
    latitude: 25.3176,
    longitude: 82.9739,
    notes: 'High-humidity paddy and vegetable zone',
  },
  {
    id: 'nakuru_highlands',
    name: 'Nakuru / Central Highlands',
    country: 'Kenya',
    latitude: -0.3031,
    longitude: 36.08,
    notes: 'Cool highland climate, susceptible to rusts',
  },
  {
    id: 'ibadan_humid',
    name: 'Ibadan / Oyo State',
    country: 'Nigeria',
    latitude: 7.3775,
    longitude: 3.947,
    notes: 'Humid tropical vegetable & cereal belt',
  },
  {
    id: 'central_valley',
    name: 'Fresno / Central Valley',
    country: 'USA',
    latitude: 36.7468,
    longitude: -119.7726,
    notes: 'Intense irrigated tomato and field crops',
  },
];

const WEATHER_CACHE_KEY = 'leaflens_weather_cache_v2';
const WEATHER_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Interpret WMO Weather interpretation codes
 */
function parseWmoCode(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code === 1 || code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy / Dewy';
  if (code >= 51 && code <= 55) return 'Light Drizzle';
  if (code >= 61 && code <= 65) return 'Rain Showers';
  if (code >= 80 && code <= 82) return 'Heavy Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}

/**
 * Default fallback weather if completely offline and no cache exists yet
 */
function getDefaultFallbackWeather(preset: RegionalPreset): WeatherData {
  return {
    temperature: 24.5,
    relativeHumidity: 78,
    apparentTemperature: 25.2,
    precipitation: 1.2,
    precipitationProbability: 60,
    weatherCode: 3,
    windSpeed: 8.5,
    dailyTempMax: 28.0,
    dailyTempMin: 18.2,
    dailyHumidityMax: 88,
    conditionText: 'Humid Overcast',
    regionName: preset.name,
    latitude: preset.latitude,
    longitude: preset.longitude,
    fetchedAt: Date.now(),
    isCached: true,
  };
}

/**
 * Retrieve cached weather data instantly or fallback to regional default
 */
export function getCachedWeatherOrFallback(): WeatherData {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(WEATHER_CACHE_KEY)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as WeatherData;
            if (parsed && typeof parsed.temperature === 'number') {
              return { ...parsed, isCached: true };
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Could not read cached weather:', e);
  }
  return getDefaultFallbackWeather(REGIONAL_PRESETS[0]);
}

/**
 * Fetch and cache regional weather pattern using Open-Meteo
 */
export async function fetchRegionalWeather(
  latitude: number,
  longitude: number,
  regionName: string,
  forceRefresh = false
): Promise<WeatherData> {
  const cacheKey = `${WEATHER_CACHE_KEY}_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;

  // 1. Check local cache first if not forced
  if (!forceRefresh) {
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cachedData = JSON.parse(cachedRaw) as WeatherData;
        const age = Date.now() - cachedData.fetchedAt;
        if (age < WEATHER_CACHE_TTL_MS) {
          return {
            ...cachedData,
            isCached: true,
          };
        }
      }
    } catch (e) {
      console.warn('Could not read weather cache:', e);
    }
  }

  // 2. Fetch fresh weather from Open-Meteo
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_max,precipitation_probability_max&timezone=auto`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Weather HTTP error: ${response.status}`);
    }

    const json = await response.json();
    const current = json.current || {};
    const daily = json.daily || {};

    const freshWeather: WeatherData = {
      temperature: current.temperature_2m ?? 24,
      relativeHumidity: current.relative_humidity_2m ?? 75,
      apparentTemperature: current.apparent_temperature ?? current.temperature_2m ?? 24,
      precipitation: current.precipitation ?? 0,
      precipitationProbability: daily.precipitation_probability_max?.[0] ?? 40,
      weatherCode: current.weather_code ?? 1,
      windSpeed: current.wind_speed_10m ?? 7,
      dailyTempMax: daily.temperature_2m_max?.[0] ?? 28,
      dailyTempMin: daily.temperature_2m_min?.[0] ?? 18,
      dailyHumidityMax: daily.relative_humidity_2m_max?.[0] ?? 85,
      conditionText: parseWmoCode(current.weather_code ?? 1),
      regionName,
      latitude,
      longitude,
      fetchedAt: Date.now(),
      isCached: false,
    };

    // Save to local cache
    try {
      localStorage.setItem(cacheKey, JSON.stringify(freshWeather));
    } catch (e) {
      console.warn('Failed to write weather cache:', e);
    }

    return freshWeather;
  } catch (error) {
    console.warn('Failed to fetch live weather, attempting cache fallback:', error);

    // Fallback: Read any stale cache if available
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cachedData = JSON.parse(cachedRaw) as WeatherData;
        return {
          ...cachedData,
          isCached: true,
        };
      }
    } catch (e) {
      // ignore
    }

    // Default agricultural model if offline
    const matchedPreset =
      REGIONAL_PRESETS.find((p) => p.name === regionName) || REGIONAL_PRESETS[0];
    return getDefaultFallbackWeather(matchedPreset);
  }
}

/**
 * Calculate Disease Proliferation Risk based on microclimate (Temp + Humidity)
 * Cross-references local ambient temperature and relative humidity against
 * specific plant pathogen epidemiological proliferation envelopes.
 */
export function calculateDiseaseWeatherRisk(
  diseaseId: DiseaseId,
  weather: WeatherData
): DiseaseWeatherRisk {
  const { temperature: temp, relativeHumidity: humidity, dailyHumidityMax } = weather;
  const maxHumidity = Math.max(humidity, dailyHumidityMax);

  switch (diseaseId) {
    case 'maize_late_blight': {
      // Exserohilum turcicum / Helminthosporium (Late Blight / Turcicum Blight):
      // Pathogen sporulation requires relative humidity >= 70% (peaks at >= 80%)
      // and moderate canopy temperatures between 18°C and 27°C.
      const tempFavorable = temp >= 17 && temp <= 28;
      const humidityFavorable = maxHumidity >= 70;
      const isHighlyFavorable = tempFavorable && humidityFavorable;

      let score = 20;
      if (tempFavorable) score += 35;
      if (maxHumidity >= 80) score += 40;
      else if (maxHumidity >= 70) score += 25;
      else if (maxHumidity >= 60) score += 10;

      const riskLevel: DiseaseWeatherRisk['riskLevel'] =
        isHighlyFavorable && maxHumidity >= 78
          ? 'critical'
          : isHighlyFavorable || score >= 65
          ? 'high'
          : score >= 45
          ? 'moderate'
          : 'low';

      return {
        diseaseId,
        riskLevel,
        riskScore: Math.min(100, score),
        pathogenFavored: isHighlyFavorable || score >= 50,
        isHighlyFavorable,
        highAlertBadge: {
          en: 'Weather High-Alert: Favorable for Late Blight Surge',
          hi: 'हाई-अलर्ट: मक्का झुलसा के अति-अनुकूल मौसम',
          sw: 'Ilani Kali: Hali ya Hewa Inaharakisha Ukungu wa Mahindi',
        },
        highAlertDescription: {
          en: `Local humidity (${humidity}%, peak ${dailyHumidityMax}%) & temperature (${temp.toFixed(1)}°C) are highly favorable for Late Blight development. High moisture accelerates fungal spore germination and rapid lesion expansion.`,
          hi: `स्थानीय आर्द्रता (${humidity}%, अधिकतम ${dailyHumidityMax}%) और तापमान (${temp.toFixed(1)}°C) मक्का झुलसा के लिए अत्यंत अनुकूल हैं। अधिक नमी से फफूंद के घाव पत्तियों पर तेजी से फैलते हैं।`,
          sw: `Unyevu wa hewa (${humidity}%, kilele ${dailyHumidityMax}%) na joto la (${temp.toFixed(1)}°C) ni muafaka sana kwa ugonjwa wa ukungu wa mahindi (Late Blight) kusambaa kwa kasi.`,
        },
        favorableFactors: {
          humidityTriggered: humidityFavorable,
          tempTriggered: tempFavorable,
          humidityText: `${humidity}% RH (threshold ≥70%)`,
          tempText: `${temp.toFixed(1)}°C (optimal 17–28°C)`,
        },
        title: {
          en: 'Maize Late Blight Weather Vulnerability',
          hi: 'मक्का का झुलसा रोग का मौसम जोखिम',
          sw: 'Uwezekano wa Ukungu wa Mahindi Kulingana na Hewa',
        },
        environmentalDriver: {
          en: `Prolonged humidity (${humidity}%, peak ${dailyHumidityMax}%) with temperatures around ${temp.toFixed(1)}°C allows rapid Late Blight lesion elongation and leaf necrosis.`,
          hi: `लगातार नमी (${humidity}%, अधिकतम ${dailyHumidityMax}%) और ${temp.toFixed(1)}°C तापमान से मक्के की पत्तियों पर लंबे घाव तेजी से बनते हैं।`,
          sw: `Hewa yenye unyevu wa (${humidity}%) na joto la (${temp.toFixed(1)}°C) huongeza ukubwa wa vidonda vya majani kwa kasi.`,
        },
        advisory: {
          en: 'High atmospheric moisture detected: Remove severely diseased lower leaves to improve canopy airflow. Apply preventive biocontrol or targeted fungicide immediately.',
          hi: 'हवा में अत्यधिक नमी: खेत में हवा के संचार हेतु नीचे की अत्यधिक रोगग्रस्त पत्तियां हटाएं और सुरक्षात्मक उपचार तुरंत करें।',
          sw: 'Unyevu mwingi hewani: Ondoa majani ya chini ili kuongeza mzunguko wa hewa na weka dawa ya kuzuia mara moja.',
        },
      };
    }

    case 'rice_blast': {
      // Rice blast (Magnaporthe oryzae) thrives in 20-29°C and >78% humidity (dew periods >10h)
      const tempFavorable = temp >= 20 && temp <= 30;
      const humidityFavorable = maxHumidity >= 78;
      const isHighlyFavorable = tempFavorable && humidityFavorable;

      let score = 20;
      if (tempFavorable) score += 35;
      if (maxHumidity >= 85) score += 40;
      else if (maxHumidity >= 75) score += 25;

      const riskLevel: DiseaseWeatherRisk['riskLevel'] =
        isHighlyFavorable && maxHumidity >= 85
          ? 'critical'
          : isHighlyFavorable || score >= 65
          ? 'high'
          : score >= 40
          ? 'moderate'
          : 'low';

      return {
        diseaseId,
        riskLevel,
        riskScore: Math.min(100, score),
        pathogenFavored: isHighlyFavorable || score >= 55,
        isHighlyFavorable,
        highAlertBadge: {
          en: 'Weather High-Alert: Rice Blast Spore Proliferation',
          hi: 'हाई-अलर्ट: धान ब्लास्ट बीजाणु फैलाव चेतावनी',
          sw: 'Ilani Kali: Hatari ya Kuenea Ukungu wa Mpunga',
        },
        highAlertDescription: {
          en: `Elevated humidity (${humidity}%, peak ${dailyHumidityMax}%) & warm canopy (${temp.toFixed(1)}°C) create ideal incubation for Magnaporthe blast spores. High risk of panicle and leaf blast outbreak.`,
          hi: `उच्च आर्द्रता (${humidity}%) और गर्म वातावरण (${temp.toFixed(1)}°C) से ब्लास्ट फफूंद के बीजाणु अत्यंत तेजी से अंकुरित होते हैं। पत्ती और बाली ब्लास्ट का गंभीर खतरा।`,
          sw: `Unyevu wa juu (${humidity}%) na joto la (${temp.toFixed(1)}°C) huweka mazingira bora ya kuenea kwa vijidudu vya ukungu wa mpunga.`,
        },
        favorableFactors: {
          humidityTriggered: humidityFavorable,
          tempTriggered: tempFavorable,
          humidityText: `${humidity}% RH (threshold ≥78%)`,
          tempText: `${temp.toFixed(1)}°C (optimal 20–30°C)`,
        },
        title: {
          en: 'Rice Blast Spore Germination Risk',
          hi: 'धान का ब्लास्ट / झोंका रोग का मौसम जोखिम',
          sw: 'Hatari ya Kuenea kwa Ukungu wa Mpunga',
        },
        environmentalDriver: {
          en: `Elevated humidity (${humidity}%, peak ${dailyHumidityMax}%) & warm canopy (${temp.toFixed(1)}°C) accelerate Magnaporthe spore germination and appressorium formation.`,
          hi: `उच्च आर्द्रता (${humidity}%, अधिकतम ${dailyHumidityMax}%) और गर्म वातावरण (${temp.toFixed(1)}°C) से फफूंद के बीजाणु तेजी से पनपते हैं।`,
          sw: `Unyevu wa juu (${humidity}%) na joto la (${temp.toFixed(1)}°C) huharakisha uenezaji wa vijidudu vya ukungu.`,
        },
        advisory: {
          en: 'Avoid high urea/nitrogen applications during humid weather. Inspect seedling nurseries and maintain field drainage.',
          hi: 'उच्च आर्द्रता में अधिक यूरिया डालने से बचें। क्यारियों में पानी निकासी दुरुस्त रखें।',
          sw: 'Epuka mbolea ya ziada ya naitrojeni wakati wa unyevu mwingi. Kagua miche mara kwa mara.',
        },
      };
    }

    case 'tomato_early_blight': {
      // Alternaria solani thrives in 22-31°C with high humidity (>70%) or persistent leaf wetness
      const tempFavorable = temp >= 21 && temp <= 31;
      const humidityFavorable = maxHumidity >= 70;
      const isHighlyFavorable = tempFavorable && humidityFavorable;

      let score = 15;
      if (tempFavorable) score += 40;
      if (maxHumidity >= 80) score += 35;
      else if (maxHumidity >= 68) score += 20;

      const riskLevel: DiseaseWeatherRisk['riskLevel'] =
        isHighlyFavorable && maxHumidity >= 80
          ? 'critical'
          : isHighlyFavorable || score >= 65
          ? 'high'
          : score >= 45
          ? 'moderate'
          : 'low';

      return {
        diseaseId,
        riskLevel,
        riskScore: Math.min(100, score),
        pathogenFavored: isHighlyFavorable || score >= 50,
        isHighlyFavorable,
        highAlertBadge: {
          en: 'Weather High-Alert: Early Blight Spore Surge',
          hi: 'हाई-अलर्ट: टमाटर अगेती झुलसा का मौसम जोखिम',
          sw: 'Ilani Kali: Hatari Kubwa ya Ukungu wa Nyanya',
        },
        highAlertDescription: {
          en: `Warm leaf surfaces (${temp.toFixed(1)}°C) combined with sustained moisture (${humidity}%) provide optimal conditions for Alternaria conidia germination and rapid concentric ring target-spotting.`,
          hi: `पत्तियों पर गर्म तापमान (${temp.toFixed(1)}°C) और लगातार नमी (${humidity}%) से अगेती झुलसा के छल्लेदार चकत्ते बहुत तेजी से फैलते हैं।`,
          sw: `Joto la (${temp.toFixed(1)}°C) na unyevu wa (${humidity}%) huwezesha madoa ya shabaha kuenea haraka kwenye mimea ya nyanya.`,
        },
        favorableFactors: {
          humidityTriggered: humidityFavorable,
          tempTriggered: tempFavorable,
          humidityText: `${humidity}% RH (threshold ≥70%)`,
          tempText: `${temp.toFixed(1)}°C (optimal 21–31°C)`,
        },
        title: {
          en: 'Tomato Early Blight Microclimate Vulnerability',
          hi: 'टमाटर अगेती झुलसा का मौसम जोखिम',
          sw: 'Hatari ya Ukungu wa Nyanya (Early Blight)',
        },
        environmentalDriver: {
          en: `Warm leaf surfaces (${temp.toFixed(1)}°C) combined with sustained moisture (${humidity}%) stimulate Alternaria conidia sporulation.`,
          hi: `पत्तियों पर गर्म तापमान (${temp.toFixed(1)}°C) और लगातार नमी (${humidity}%) से अल्टरनेरिया के छल्लेदार चकत्ते बढ़ते हैं।`,
          sw: `Joto la (${temp.toFixed(1)}°C) na unyevu wa (${humidity}%) huwezesha madoa ya shabaha kuenea haraka.`,
        },
        advisory: {
          en: 'High moisture warning: Switch to morning drip irrigation. Apply organic straw mulch to prevent soilborne fungal spores from splashing onto lower leaves.',
          hi: 'ऊपर से पानी देने की जगह सुबह ड्रिप से सिंचाई करें। मिट्टी से फफूंद रोकने के लिए पुआल की मल्चिंग करें।',
          sw: 'Tumia umwagiliaji wa matone badala ya kumwagia majani. Weka matandazo kuzuia unyevunyevu.',
        },
      };
    }

    case 'wheat_yellow_rust': {
      // Puccinia striiformis: Cool conditions (9-19°C) and high humidity (>65%).
      // Crucial: Suppressed when temperature exceeds 24°C!
      const coolFavorable = temp >= 8 && temp <= 20;
      const humidityFavorable = maxHumidity >= 65;
      const tooHot = temp >= 24;
      const isHighlyFavorable = coolFavorable && humidityFavorable && !tooHot;

      let score = 20;
      if (coolFavorable) score += 45;
      else if (temp < 23) score += 20;
      else if (tooHot) score -= 35; // Heat suppresses stripe rust

      if (maxHumidity >= 75) score += 30;
      else if (maxHumidity >= 60) score += 15;

      score = Math.max(10, score);
      const riskLevel: DiseaseWeatherRisk['riskLevel'] =
        isHighlyFavorable && maxHumidity >= 75
          ? 'critical'
          : isHighlyFavorable || score >= 65
          ? 'high'
          : score >= 40
          ? 'moderate'
          : 'low';

      return {
        diseaseId,
        riskLevel,
        riskScore: Math.min(100, score),
        pathogenFavored: isHighlyFavorable || (score >= 45 && !tooHot),
        isHighlyFavorable,
        highAlertBadge: {
          en: tooHot
            ? 'Weather Notice: Heat Suppressing Yellow Rust'
            : 'Weather High-Alert: Cool & Humid Favors Stripe Rust',
          hi: tooHot
            ? 'मौसम सूचना: गर्मी से पीला रतुआ दब रहा है'
            : 'हाई-अलर्ट: शीतल व नम मौसम से पीला रतुआ फैलने की आशंका',
          sw: tooHot
            ? 'Ilani ya Hewa: Joto Linapunguza Kutu ya Ngano'
            : 'Ilani Kali: Ubaridi na Unyevu Unachochea Kutu ya Ngano',
        },
        highAlertDescription: {
          en: tooHot
            ? `Current ambient temperature (${temp.toFixed(1)}°C) exceeds yellow rust tolerance, restricting urediniospore survival.`
            : `Cool canopy (${temp.toFixed(1)}°C) and high moisture (${humidity}%) create ideal incubation for yellow stripe rust pustules.`,
          hi: tooHot
            ? `वर्तमान तापमान (${temp.toFixed(1)}°C) अधिक होने से पीले रतुआ के बीजाणु स्वाभाविक रूप से नष्ट हो रहे हैं।`
            : `शीतल वातावरण (${temp.toFixed(1)}°C) और नमी (${humidity}%) से गेहूं पर पीली धारियां बनने का भारी जोखिम है।`,
          sw: tooHot
            ? `Joto la sasa (${temp.toFixed(1)}°C) linasaidia kuzuia kuenea kwa ugonjwa wa kutu ya manjano.`
            : `Hali ya hewa ya ubaridi (${temp.toFixed(1)}°C) na unyevu wa (${humidity}%) ni hatari kwa zao la ngano.`,
        },
        favorableFactors: {
          humidityTriggered: humidityFavorable,
          tempTriggered: coolFavorable,
          humidityText: `${humidity}% RH (threshold ≥65%)`,
          tempText: `${temp.toFixed(1)}°C (${tooHot ? 'Too warm >24°C' : 'optimal 8–20°C'})`,
        },
        title: {
          en: 'Wheat Yellow Rust Infection Conditions',
          hi: 'गेहूं के पीले रतुआ का मौसम विश्लेषण',
          sw: 'Hali ya Hewa kwa Kutu ya Ngano (Yellow Rust)',
        },
        environmentalDriver: {
          en: tooHot
            ? `Current warmer temperature (${temp.toFixed(1)}°C) actively suppresses yellow rust urediniospore germination.`
            : `Cool canopy (${temp.toFixed(1)}°C) with morning dew creates prime conditions for yellow rust pustule spreading.`,
          hi: tooHot
            ? `वर्तमान गर्म तापमान (${temp.toFixed(1)}°C) पीले रतुआ के बीजाणुओं को फैलने से रोकता है।`
            : `शीतल मौसम (${temp.toFixed(1)}°C) और सुबह की ओस से गेहूं पर पीली धारियां बनने का जोखिम बढ़ जाता है।`,
          sw: tooHot
            ? `Joto la sasa (${temp.toFixed(1)}°C) huzuia kuenea kwa ugonjwa wa kutu ya manjano.`
            : `Hali ya hewa ya ubaridi (${temp.toFixed(1)}°C) na umande huchochea kutu ya manjano.`,
        },
        advisory: {
          en: tooHot
            ? 'Natural thermal suppression in progress; maintain regular weekly field scout.'
            : 'Early morning scout: Check northern/shaded field boundaries for yellow powdery stripe pustules.',
          hi: tooHot
            ? 'तापमान अधिक होने से रतुआ का प्राकृतिक नियंत्रण हो रहा है; सामान्य निगरानी रखें।'
            : 'सुबह के समय खेत के किनारों पर पत्तियों पर पीला चूर्ण देखें।',
          sw: tooHot
            ? 'Hali ya joto inasaidia kupunguza ugonjwa; endelea kuangalia shamba.'
            : 'Kagua mistari ya manjano asubuhi mapema kwenye pembe za shamba.',
        },
      };
    }

    default: {
      return {
        diseaseId: 'healthy_leaf',
        riskLevel: 'low',
        riskScore: 20,
        pathogenFavored: false,
        isHighlyFavorable: false,
        highAlertBadge: {
          en: 'Weather Status: Normal Pathogen Pressure',
          hi: 'मौसम स्थिति: रोग का सामान्य दबाव',
          sw: 'Hali ya Hewa: Shinikizo la Kawaida',
        },
        highAlertDescription: {
          en: `Microclimate metrics (${temp.toFixed(1)}°C, ${humidity}% RH) do not indicate active fungal surges for healthy foliage.`,
          hi: `वर्तमान मौसम (${temp.toFixed(1)}°C, ${humidity}% नमी) स्वस्थ पत्तियों के लिए अनुकूल है।`,
          sw: `Hali ya hewa (${temp.toFixed(1)}°C, ${humidity}% unyevu) ni shwari kwa majani yenye afya.`,
        },
        favorableFactors: {
          humidityTriggered: false,
          tempTriggered: false,
          humidityText: `${humidity}% RH`,
          tempText: `${temp.toFixed(1)}°C`,
        },
        title: {
          en: 'Low General Fungal Pressure',
          hi: 'फफूंद का कम दबाव',
          sw: 'Shinikizo Dogo la Magonjwa',
        },
        environmentalDriver: {
          en: `Conditions (${temp.toFixed(1)}°C, ${humidity}% RH) are balanced. Keep routine sanitation practices.`,
          hi: `वर्तमान मौसम (${temp.toFixed(1)}°C, ${humidity}% नमी) संतुलित है। नियमित देखभाल जारी रखें।`,
          sw: `Hali ya hewa (${temp.toFixed(1)}°C, ${humidity}% unyevu) ni shwari. Dumisha usafi wa shamba.`,
        },
        advisory: {
          en: 'Maintain healthy crop nutrition and weed-free field borders.',
          hi: 'फसल को संतुलित पोषण दें और खेत के मेड़ों को खरपतवार मुक्त रखें।',
          sw: 'Dumisha rutuba na ondoa magugu pembezoni mwa shamba.',
        },
      };
    }
  }
}
