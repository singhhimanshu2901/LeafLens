export type Language = 'en' | 'hi' | 'sw';

export type CropType = 'maize' | 'tomato' | 'rice' | 'wheat';

export type DiseaseId =
  | 'maize_late_blight'
  | 'tomato_early_blight'
  | 'rice_blast'
  | 'wheat_yellow_rust'
  | 'healthy_leaf';

export type SeverityLevel = 'none' | 'low' | 'moderate' | 'high' | 'critical';

export interface DiseaseInfo {
  id: DiseaseId;
  crop: CropType;
  scientificName: string;
  names: Record<Language, string>;
  severity: SeverityLevel;
  symptoms: Record<Language, string>;
  culturalRemedy: Record<Language, string>;
  chemicalRemedy: Record<Language, string>;
  preventiveMeasures: Record<Language, string>;
}

export interface CandidatePrediction {
  diseaseId: DiseaseId;
  diseaseName: string;
  confidence: number; // 0 to 1
  crop: CropType;
}

export interface VisionAnalysisResult {
  topCandidates: CandidatePrediction[];
  dominantFeatures: {
    greenScore: number;
    brownLesionScore: number;
    yellowScore: number;
    spotDensity: number;
  };
  imageWidth: number;
  imageHeight: number;
  primaryCandidate: CandidatePrediction;
}

export interface QuestionnaireAnswers {
  crop: CropType;
  cropAge: '<1_month' | '1-2_months' | '>2_months';
  leafSymptoms: 'brown_lesions' | 'yellowing' | 'holes_insects' | 'wilting';
  fieldSpread: 'isolated_<10%' | 'moderate_10-50%' | 'severe_>50%';
}

export interface QuestionnaireRecord {
  id: string;
  diagnosisId: string;
  answers: QuestionnaireAnswers;
  submittedAt: number;
}

export interface DiagnosisRecord {
  id: string;
  crop: CropType;
  primaryDiagnosis: DiseaseId;
  diseaseDisplayName: string;
  confidence: number; // Vision confidence (0.00 - 1.00)
  combinedConfidence: number; // Bayesian/heuristic combined (0.00 - 1.00)
  timestamp: number;
  photoDataUrl: string;
  notes: string;
  needsExpertReview: boolean;
  synced: boolean;
  expertFeedback?: {
    verifiedBy: string;
    verifiedAt: number;
    confirmedDiagnosis: DiseaseId;
    advisoryNotes: string;
    actionPlan: string;
  };
  questionnaireAnswers?: QuestionnaireAnswers;
}

export interface SyncQueueItem {
  id: string;
  diagnosisId: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retries: number;
  queuedAt: number;
  lastAttemptAt?: number;
}
