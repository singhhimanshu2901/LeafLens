import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  Sparkles,
  Sliders,
  AlertCircle,
  HelpCircle,
  FlipHorizontal,
  CheckCircle,
} from 'lucide-react';
import { CropType, DiagnosisRecord, DiseaseId, Language, VisionAnalysisResult } from '../types';
import { UI_STRINGS } from '../translations';
import { generateSyntheticLeafImage, runEdgeVisionInference } from '../vision';
import { dbService } from '../db';
import { QuestionnaireModal } from './QuestionnaireModal';
import { DiagnosisCard } from './DiagnosisCard';
import { WeatherInsight } from './WeatherInsight';
import { WeatherData, calculateDiseaseWeatherRisk, getCachedWeatherOrFallback } from '../weather';

interface ScanViewProps {
  currentLang: Language;
  onDiagnosisSaved: () => void;
}

export const ScanView: React.FC<ScanViewProps> = ({ currentLang, onDiagnosisSaved }) => {
  const t = UI_STRINGS[currentLang];

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');

  const [currentResult, setCurrentResult] = useState<VisionAnalysisResult | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [activeDiagnosis, setActiveDiagnosis] = useState<DiagnosisRecord | null>(null);
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(() => getCachedWeatherOrFallback());

  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  // Start / Stop Camera stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Camera stream not available. Use file upload or test samples.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const toggleCameraFacing = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
  };

  useEffect(() => {
    if (cameraActive) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  // Execute Edge Inference Pipeline on an image dataUrl
  const processImage = async (dataUrl: string) => {
    setIsAnalyzing(true);
    setAnalysisStep(t.analyzingImage);
    setCapturedPhotoUrl(dataUrl);

    try {
      // Step 1: Simulated tensor extraction latency for realism
      await new Promise((r) => setTimeout(r, 350));
      setAnalysisStep(t.extractingFeatures);

      // Step 2: 224x224 Canvas downsampling & feature extraction
      const analysis = await runEdgeVisionInference(dataUrl);
      setCurrentResult(analysis);

      // Corroborate edge vision with local weather microclimate pattern
      const activeWeather = currentWeather || getCachedWeatherOrFallback();
      let weatherContextNote = '';
      let initialConfidence = analysis.primaryCandidate.confidence;
      if (activeWeather) {
        const risk = calculateDiseaseWeatherRisk(analysis.primaryCandidate.diseaseId, activeWeather);
        if (risk.isHighlyFavorable) {
          initialConfidence = Number(Math.min(0.98, initialConfidence + 0.05).toFixed(2));
          weatherContextNote = ` | High Alert Warning: Microclimate conditions (${activeWeather.relativeHumidity}% RH, ${activeWeather.temperature.toFixed(0)}°C) are highly favorable for pathogen proliferation.`;
        } else if (risk.pathogenFavored) {
          initialConfidence = Number(Math.min(0.98, initialConfidence + 0.03).toFixed(2));
          weatherContextNote = ` | Weather pattern (${activeWeather.relativeHumidity}% RH, ${activeWeather.temperature.toFixed(0)}°C) strongly correlates with pathogen spread.`;
        }
      }

      // Create draft diagnosis
      const isAmbiguous = initialConfidence < 0.85;
      const needsReview = initialConfidence < 0.75;

      const newRecord: DiagnosisRecord = {
        id: 'diag_' + Date.now(),
        crop: analysis.primaryCandidate.crop,
        primaryDiagnosis: analysis.primaryCandidate.diseaseId,
        diseaseDisplayName: analysis.primaryCandidate.diseaseName,
        confidence: analysis.primaryCandidate.confidence,
        combinedConfidence: initialConfidence,
        timestamp: Date.now(),
        photoDataUrl: dataUrl,
        notes: `Detected ${analysis.primaryCandidate.diseaseName} with ${(analysis.primaryCandidate.confidence * 100).toFixed(0)}% edge vision score.${weatherContextNote}`,
        needsExpertReview: needsReview,
        synced: false,
      };

      await dbService.saveDiagnosis(newRecord);
      setActiveDiagnosis(newRecord);
      onDiagnosisSaved();

      // Automatically pop symptom questionnaire if ambiguous (<85%)
      if (isAmbiguous) {
        setShowQuestionnaire(true);
      }
    } catch (error) {
      console.error('Inference error:', error);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Shutter click from live video stream
  const handleCaptureFromVideo = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    stopCamera();
    processImage(dataUrl);
  };

  // Upload photo from file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        stopCamera();
        processImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Quick test sample generator
  const handleTestSample = (diseaseId: DiseaseId) => {
    stopCamera();
    const syntheticUrl = generateSyntheticLeafImage(diseaseId);
    processImage(syntheticUrl);
  };

  // Reset to scan new leaf
  const handleRetake = () => {
    setActiveDiagnosis(null);
    setCurrentResult(null);
    setCapturedPhotoUrl(null);
    setShowQuestionnaire(false);
  };

  // If a diagnosis is active, render the Diagnosis Result Card
  if (activeDiagnosis) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <DiagnosisCard
          diagnosis={activeDiagnosis}
          currentLang={currentLang}
          weather={currentWeather || getCachedWeatherOrFallback()}
          onRetake={handleRetake}
          onOpenQuestionnaire={() => setShowQuestionnaire(true)}
        />

        {/* Questionnaire Modal if open */}
        {showQuestionnaire && (
          <QuestionnaireModal
            currentLang={currentLang}
            visionConfidence={activeDiagnosis.confidence}
            initialDiseaseId={activeDiagnosis.primaryDiagnosis}
            defaultCrop={activeDiagnosis.crop}
            weather={currentWeather || getCachedWeatherOrFallback()}
            onCancel={() => setShowQuestionnaire(false)}
            onComplete={async (combined) => {
              const updated: DiagnosisRecord = {
                ...activeDiagnosis,
                combinedConfidence: combined.combinedConfidence,
                needsExpertReview: combined.needsExpertReview,
                notes: combined.notes,
                questionnaireAnswers: combined.answers,
                crop: combined.answers.crop,
              };
              await dbService.updateDiagnosis(updated);
              setActiveDiagnosis(updated);
              setShowQuestionnaire(false);
              onDiagnosisSaved();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
      {/* Cozy Field Companion Header */}
      <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-stone-200/80 flex items-start gap-3.5 transition">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-xs border border-emerald-200/60">
          <Camera className="w-5 h-5 text-emerald-700" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-['Outfit'] font-bold text-stone-900 text-base sm:text-lg">
              {t.scanTitle}
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200/80">
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Offline Edge AI</span>
            </span>
          </div>
          <p className="text-xs text-stone-600 mt-1 leading-relaxed">
            {t.scanInstructions}
          </p>
        </div>
      </div>

      {/* Local Weather Insight Component: Daily regional temperature & humidity patterns */}
      <WeatherInsight
        currentLang={currentLang}
        onWeatherLoaded={setCurrentWeather}
      />

      {/* Camera / Viewfinder Box */}
      <div className="relative w-full aspect-4/3 rounded-[32px] overflow-hidden bg-gradient-to-b from-stone-900 to-stone-950 border-2 border-emerald-700/60 shadow-[0_12px_40px_rgba(22,101,52,0.18)] flex items-center justify-center">
        {/* Hidden HTML5 video element */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
        />

        {/* Viewfinder Leaf Silhouette Guide & Tactile Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
          {/* Viewfinder Corners with rounded aesthetic */}
          <div className="absolute top-5 left-5 w-9 h-9 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
          <div className="absolute top-5 right-5 w-9 h-9 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
          <div className="absolute bottom-5 left-5 w-9 h-9 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
          <div className="absolute bottom-5 right-5 w-9 h-9 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl shadow-[0_0_12px_rgba(52,211,153,0.6)]" />

          {/* Sweeping Animated Scanline (active when camera is running) */}
          {cameraActive && (
            <div className="absolute left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_14px_#34d399] animate-scanline pointer-events-none" />
          )}

          {/* Leaf Contour Guide with cozy organic dashed strokes */}
          <svg
            viewBox="0 0 200 240"
            className="w-52 h-60 text-emerald-400/70 drop-shadow-[0_0_14px_rgba(52,211,153,0.45)] animate-gentle-pulse"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="6 5"
          >
            <path d="M 100,18 C 165,70 175,165 100,225 C 25,165 35,70 100,18 Z" />
            <path d="M 100,18 L 100,220" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M 100,80 Q 135,70 150,60" strokeWidth="1.5" />
            <path d="M 100,125 Q 145,115 160,105" strokeWidth="1.5" />
            <path d="M 100,80 Q 65,70 50,60" strokeWidth="1.5" />
            <path d="M 100,125 Q 55,115 40,105" strokeWidth="1.5" />
          </svg>

          {/* Central alignment crosshairs */}
          <div className="absolute w-8 h-8 border-t border-b border-emerald-300/40" />
          <div className="absolute w-8 h-8 border-l border-r border-emerald-300/40" />
          <div className="absolute w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
        </div>

        {/* If camera is not active, show prompt */}
        {!cameraActive && !isAnalyzing && (
          <div className="text-center p-6 text-stone-300 max-w-sm z-10 space-y-4">
            <div className="w-18 h-18 rounded-3xl bg-gradient-to-br from-emerald-900/90 to-stone-900 border border-emerald-500/40 mx-auto flex items-center justify-center text-emerald-400 shadow-xl">
              <Camera className="w-9 h-9" />
            </div>
            <div>
              <p className="text-base font-bold text-white font-['Outfit']">Field Viewfinder Ready</p>
              <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Tap start camera to scan leaf directly, or select a photo from your field gallery.
              </p>
            </div>
            <button
              id="start-camera-btn"
              onClick={startCamera}
              className="min-h-[50px] px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold shadow-[0_4px_16px_rgba(5,150,105,0.4)] transition active:scale-95"
            >
              {t.cameraStart}
            </button>
          </div>
        )}

        {/* Analyzing Spinner Overlay with cozy animated visualizer */}
        {isAnalyzing && (
          <div className="absolute inset-0 bg-stone-950/90 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-white text-center space-y-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-emerald-900/60 border-t-emerald-400 animate-spin" />
              <div className="w-14 h-14 rounded-full bg-emerald-950/80 border border-emerald-400/40 absolute inset-0 m-auto flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-emerald-300 animate-pulse" />
              </div>
            </div>
            <div className="space-y-1.5 max-w-xs">
              <p className="text-base font-bold text-emerald-300 font-['Outfit']">{analysisStep}</p>
              <p className="text-xs text-stone-400">On-device neural tensor extraction & histogram classification</p>
              <div className="flex justify-center gap-1 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {cameraError && (
        <div className="p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-2xl text-xs text-amber-900 flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Camera & File Controls with tactile comfort */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {cameraActive && (
          <>
            <button
              id="shutter-capture-btn"
              onClick={handleCaptureFromVideo}
              disabled={isAnalyzing}
              className="min-h-[58px] px-8 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base shadow-[0_6px_20px_rgba(5,150,105,0.4)] flex items-center gap-3 border-2 border-emerald-300 active:scale-95 transition"
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-[0_0_8px_white] animate-pulse" />
              <span>Capture & Diagnose</span>
            </button>

            <button
              onClick={toggleCameraFacing}
              className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-white hover:bg-stone-100 text-stone-800 text-xs font-bold flex items-center gap-2 border border-stone-200/80 shadow-xs transition active:scale-95"
              title={t.flipCamera}
            >
              <FlipHorizontal className="w-4 h-4 text-emerald-700" />
              <span className="hidden sm:inline">{t.flipCamera}</span>
            </button>

            <button
              onClick={stopCamera}
              className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition active:scale-95"
            >
              {t.cameraStop}
            </button>
          </>
        )}

        {/* Upload File Button */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          id="upload-photo-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isAnalyzing}
          className="min-h-[50px] px-6 py-2.5 rounded-2xl border-2 border-emerald-600/30 hover:border-emerald-600 bg-white text-stone-800 hover:text-emerald-900 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-xs transition active:scale-95"
        >
          <Upload className="w-4 h-4 text-emerald-700" />
          <span>{t.uploadPhoto}</span>
        </button>
      </div>

      {/* Sample Leaf Presets for immediate interactive testing */}
      <div className="bg-white/80 backdrop-blur-xs rounded-3xl p-5 border border-stone-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{t.sampleLeaves}</span>
          </span>
          <span className="text-[11px] font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
            1-Tap Demo
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[
            { id: 'maize_late_blight', label: t.maizeSample, crop: '🌽 Maize', color: 'hover:border-amber-400' },
            { id: 'tomato_early_blight', label: t.tomatoSample, crop: '🍅 Tomato', color: 'hover:border-red-400' },
            { id: 'rice_blast', label: t.riceSample, crop: '🌾 Rice', color: 'hover:border-yellow-400' },
            { id: 'wheat_yellow_rust', label: t.wheatSample, crop: '🌱 Wheat', color: 'hover:border-amber-400' },
            { id: 'healthy_leaf', label: t.healthySample, crop: '🌿 Clean', color: 'hover:border-emerald-400' },
          ].map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleTestSample(sample.id as DiseaseId)}
              disabled={isAnalyzing}
              className={`min-h-[64px] p-2.5 rounded-2xl bg-[#faf9f5] hover:bg-white border border-stone-200/80 ${sample.color} text-left transition duration-200 shadow-2xs hover:shadow-sm active:scale-95 group flex flex-col justify-between`}
            >
              <div className="text-[11px] text-stone-500 font-semibold">{sample.crop}</div>
              <div className="text-xs font-bold text-stone-800 group-hover:text-emerald-800 truncate">
                {sample.label}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
