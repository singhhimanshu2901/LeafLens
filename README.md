# 🌿 LeafLens Farmer App

> **Offline-first, multilingual AI-powered crop disease diagnosis and agronomist support platform.**
> Built with React 19, Tailwind CSS, Express, WebSockets, Google Maps Platform, and the Google Gen AI SDK (`@google/genai`).

---

## 📖 Overview

**LeafLens** is designed to empower farmers and agricultural field officers in detecting, managing, and treating crop diseases directly in the field. It functions seamlessly in remote rural areas with poor or intermittent internet connectivity by using local offline caching and synchronization queues, edge vision diagnostics, microclimate risk modeling, interactive disease outbreak mapping, and conversational AI (both text and real-time live voice).

---

## ✨ Key Features

### 📸 1. Edge & AI Vision Crop Scanning
- **Instant Leaf Disease Diagnosis**: Analyzes leaves for common crop threats including Late Blight (*Phytophthora infestans*), Early Blight (*Alternaria solani*), Rice Blast, Maize Streak Virus, Citrus Canker, and verifies healthy crops.
- **Symptom Verification Questionnaire**: Guided multi-step prompt validating field observations (wilting, stem lesions, white fungal growth, humidity conditions) to improve diagnostic confidence.
- **Actionable Treatment Plans**: Immediate access to organic biocontrol remedies (e.g., Trichoderma, neem extract, copper hydroxide) and conventional treatments with dosage recommendations and safety withdrawal periods.

### 🗺️ 2. Google Maps Farmland & Pathogen Outbreak Radar
- **Interactive Vector Maps (`<gmp-map>`)**: High-performance vector map rendered with custom agricultural terrain styling.
- **GPS "Locate My Field"**: One-click geolocation detection pinning the farmer's current coordinates.
- **Live Pathogen Outbreak Radar**: Visual markers and 3.5 km quarantine risk zones for reported nearby infections with severity indicators (High, Moderate, Low).
- **Regional Quick-Switching**: Instant jump to major farming belts (Punjab Wheat & Potato Belt, Maharashtra Cotton & Onion, Kenya Rift Valley Maize & Tea, Karnataka Rice & Coffee).

### 💬 3. Gemini Agronomist Chat
- **Specialized Agricultural AI**: Backed by `gemini-3.5-flash` with system instructions tailored to plant pathology, IPM (Integrated Pest Management), and climate-smart agriculture.
- **Scan-Grounded Context**: Chat can reference the latest leaf diagnosis directly, helping farmers ask contextual follow-up questions.
- **Multilingual Queries**: Supports queries and natural dialogue across English, Hindi (हिंदी), and Swahili (Kiswahili).

### 🎙️ 4. Gemini Live Voice (Real-Time Audio)
- **Hands-Free Field Assistant**: Powered by `gemini-3.8-live` over a dedicated full-duplex WebSocket stream (`/live`).
- **Low-Latency Bidirectional Audio**: Captures farmer voice at 16kHz PCM little-endian and gaplessly plays back 24kHz synthesized audio using Web Audio API.
- **Real-Time Sound Wave Visualizer**: Dynamic visual feedback with live transcription and mute controls.

### 📶 5. Offline-First Architecture & Sync
- **Local IndexedDB Storage**: Saves all diagnostic records, questionnaire responses, photos, and timestamps locally on the device.
- **Background Auto-Sync**: Monitors network status (`navigator.onLine`); automatically syncs pending records to the server once internet connectivity is restored.

### 🩺 6. Agronomist Expert Desk
- **Second-Opinion Triage**: Enables remote agronomists and lab specialists to review field diagnoses, adjust severity, and prescribe verified interventions.

### 🌦️ 7. Microclimate & Weather Risk Insights
- **Integrated Weather Feeds**: Real-time relative humidity, temperature, wind speed, and precipitation metrics from Open-Meteo.
- **Fungal Pathogen Risk Index**: Computes infection likelihood based on temperature and high humidity persistence.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19, TypeScript, Vite |
| **Styling** | Tailwind CSS v4, Lucide React Icons |
| **Backend & Server** | Node.js, Express, `ws` (WebSocket) |
| **AI / LLM Engine** | `@google/genai` (Gemini 3.5 Flash & Gemini 3.8 Live) |
| **Maps & Geo** | Google Maps JavaScript API (`@googlemaps/js-api-loader`, `<gmp-map>`) |
| **Offline Storage** | IndexedDB (`idb` wrapper) |
| **Weather Data** | Open-Meteo Public Agricultural Weather API |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Gemini API Key**: Obtain a key from [Google AI Studio](https://aistudio.google.com/)
- **Google Maps API Key**: Enabled with Maps JavaScript API (or use the built-in development key)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd leaf-lens
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Fill in your API keys in `.env`:
   ```env
   # Server-side Gemini API Key
   GEMINI_API_KEY=your_gemini_api_key_here

   # Client-side Google Maps API Key (optional, fallback provided)
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The application runs on `http://localhost:3000` (combining the Express backend and Vite frontend middleware).

5. **Production Build:**
   ```bash
   npm run build
   npm start
   ```

---

## 📡 API & WebSocket Reference

### HTTP Endpoints
- **`GET /api/health`**
  - Returns backend health status and checks whether Gemini & Google Maps keys are configured.
- **`POST /api/gemini/chat`**
  - Multi-turn conversational chat with plant pathology system prompt.
  - Body: `{ messages: [{ role: 'user' | 'model', content: string }], model?: string }`
  - Response: `{ text: string, model: string }`

### WebSocket Endpoint
- **`ws://localhost:3000/live`**
  - Real-time bidirectional audio stream using `gemini-3.8-live`.
  - Client sends: `{ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: '<base64>' }] } }`
  - Server streams: Audio chunks (24kHz PCM) and model transcriptions.

---

## 📁 Project Structure

```
├── .env.example              # Template for environment configuration
├── index.html                # App entry point with meta tags & PWA manifest setup
├── metadata.json             # AI Studio applet metadata & permission declarations
├── package.json              # Dependencies and build scripts
├── server.ts                 # Full-stack Express server with Vite middleware & WebSocket Live API
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite configuration with Tailwind CSS plugin
└── src/
    ├── App.tsx               # Main application container, router, and navigation dock
    ├── db.ts                 # IndexedDB offline storage & sync queue manager
    ├── liveAudio.ts          # Web Audio API PCM recording (16kHz) & playback (24kHz)
    ├── mapsLoader.ts         # Google Maps Platform loader with fallback handling
    ├── translations.ts       # Multilingual strings (English, Hindi, Swahili)
    ├── types.ts              # Core TypeScript interfaces & diagnostic schemas
    ├── vision.ts             # Crop disease classification rules & mock edge engine
    ├── weather.ts            # Microclimate fetching & blight risk calculation
    └── components/
        ├── DiagnosisCard.tsx     # Disease card with symptoms, remedies & severity
        ├── ExpertDesk.tsx        # Agronomist second-opinion triage interface
        ├── FarmMapView.tsx       # Google Maps farmland view with pathogen clusters
        ├── GeminiChatbot.tsx     # Multi-turn chat assistant with scan-grounding
        ├── GeminiLiveVoice.tsx   # Real-time voice dialog modal with audio visualizer
        ├── HistoryView.tsx       # Photo history and synchronized local diagnoses
        ├── Navbar.tsx            # Header with language picker, sync indicator & live voice trigger
        ├── QuestionnaireModal.tsx# Guided symptom confirmation flow
        ├── ScanView.tsx          # Camera viewfinder, sample leaves, and diagnostic flow
        └── WeatherInsight.tsx    # Weather metrics and fungal risk badge
```

---

## 🌐 Supported Languages

LeafLens currently provides complete native translations for:
- 🇬🇧 **English** (en)
- 🇮🇳 **Hindi / हिन्दी** (hi)
- 🇰🇪 🇹🇿 **Swahili / Kiswahili** (sw)

Switch languages anytime using the dropdown selector in the top navigation bar.

---

## 🔒 Permissions & Privacy
- **Camera (`camera`)**: Used solely for capturing real-time leaf images for disease classification.
- **Microphone (`microphone`)**: Used for real-time voice streaming with Gemini Live Voice API.
- **Geolocation (`geolocation`)**: Used to center the farm map and calculate microclimate risk for the user's specific coordinates.
- **Offline Storage**: All user photos and diagnostic records are stored locally in the browser's IndexedDB before syncing.

---

## 📄 License
This project is open-source under the MIT License.
