import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  X,
  AlertCircle,
  Activity,
  RotateCcw,
  Zap,
} from 'lucide-react';
import {
  float32ToInt16Pcm,
  int16ArrayToBase64,
  LiveAudioPlayer,
} from '../liveAudio';

interface GeminiLiveVoiceProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeminiLiveVoice: React.FC<GeminiLiveVoiceProps> = ({ isOpen, onClose }) => {
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isGeminiSpeaking, setIsGeminiSpeaking] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTranscript]);

  useEffect(() => {
    if (isOpen) {
      playerRef.current = new LiveAudioPlayer();
      startLiveSession();
    } else {
      cleanupLiveSession();
    }

    return () => {
      cleanupLiveSession();
    };
  }, [isOpen]);

  const startLiveSession = async () => {
    try {
      setConnectionStatus('connecting');
      setErrorMsg(null);

      // Determine websocket protocol & URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/live`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('[Live Voice Client] WebSocket connected');
        setConnectionStatus('connected');
        setLiveTranscript((prev) => [
          ...prev,
          '🌿 Connected to Gemini 3.8 Live API Voice Agronomist. Start speaking into your microphone.',
        ]);

        // Start mic capture
        await startMicCapture();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.status === 'connected') {
            console.log('[Live Voice Client] Session established with model:', data.model);
          }

          if (data.audio) {
            setIsGeminiSpeaking(true);
            playerRef.current?.playChunk(data.audio);
          }

          if (data.interrupted) {
            console.log('[Live Voice Client] Model interrupted by user speech');
            playerRef.current?.stopAll();
            setIsGeminiSpeaking(false);
          }

          if (data.text) {
            setLiveTranscript((prev) => [...prev, `Doctor: ${data.text}`]);
          }

          if (data.error) {
            setErrorMsg(data.error);
            setConnectionStatus('error');
          }
        } catch (err) {
          console.error('[Live Voice Client] Failed to parse message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[Live Voice Client] WebSocket error:', err);
        setErrorMsg('WebSocket connection failed. Please ensure server is running.');
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        console.log('[Live Voice Client] WebSocket closed');
        setConnectionStatus('disconnected');
        setIsMicActive(false);
        setIsGeminiSpeaking(false);
      };
    } catch (err: any) {
      console.error('Failed to start Live session:', err);
      setErrorMsg(err.message || 'Could not start Live Voice session');
      setConnectionStatus('error');
    }
  };

  const startMicCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtxClass({ sampleRate: 16000 });
      audioContextRef.current = inputCtx;

      const source = inputCtx.createMediaStreamSource(stream);
      // Analyser for visual volume waves
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();

      // ScriptProcessor for 16kHz PCM chunk streaming
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const int16Array = float32ToInt16Pcm(inputData);
        const base64Audio = int16ArrayToBase64(int16Array);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ audio: base64Audio }));
        }
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);
      setIsMicActive(true);
    } catch (err: any) {
      console.error('Microphone capture error:', err);
      setErrorMsg('Microphone permission denied or unavailable.');
    }
  };

  const toggleMic = () => {
    if (isMicActive) {
      mediaStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = false));
      setIsMicActive(false);
    } else {
      mediaStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = true));
      setIsMicActive(true);
    }
  };

  const cleanupLiveSession = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.close();
      playerRef.current = null;
    }
    setConnectionStatus('disconnected');
    setIsMicActive(false);
    setIsGeminiSpeaking(false);
    setAudioLevel(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-3xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 to-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-amber-300">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-['Outfit'] font-black text-lg text-white">
                  Gemini 3.8 Live Voice
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  Real-Time
                </span>
              </div>
              <p className="text-xs text-stone-300">
                Bidirectional 16kHz/24kHz low-latency voice agronomist
              </p>
            </div>
          </div>

          <button
            id="btn-close-live-voice"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-stone-200 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Audio Visualizer Stage */}
        <div className="bg-[#121c15] p-6 sm:p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
          {/* Glowing pulse rings */}
          <div
            className="absolute rounded-full transition-all duration-150 pointer-events-none"
            style={{
              width: `${120 + audioLevel * 2}px`,
              height: `${120 + audioLevel * 2}px`,
              backgroundColor: isGeminiSpeaking
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(52, 211, 153, 0.08)',
              border: isGeminiSpeaking ? '2px solid rgba(16, 185, 129, 0.4)' : '1px dashed rgba(52, 211, 153, 0.2)',
            }}
          />

          {/* Central Microphone / Gemini Indicator */}
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 z-10 ${
              isGeminiSpeaking
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white scale-105 shadow-emerald-500/30'
                : isMicActive
                ? 'bg-gradient-to-tr from-emerald-600 to-emerald-700 text-white shadow-emerald-700/40'
                : 'bg-stone-800 text-stone-400'
            }`}
          >
            {isGeminiSpeaking ? (
              <Volume2 className="w-10 h-10 animate-pulse" />
            ) : isMicActive ? (
              <Mic className="w-10 h-10 animate-bounce" />
            ) : (
              <MicOff className="w-10 h-10" />
            )}
          </div>

          {/* Status Badge */}
          <div className="mt-5 z-10">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                connectionStatus === 'connected'
                  ? isGeminiSpeaking
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isMicActive
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : 'bg-stone-700 text-stone-300'
                  : connectionStatus === 'connecting'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {connectionStatus === 'connected'
                ? isGeminiSpeaking
                  ? '🎙️ Gemini Speaking...'
                  : isMicActive
                  ? '👂 Listening to your field question...'
                  : 'Mic Muted'
                : connectionStatus === 'connecting'
                ? 'Connecting to gemini-3.8-live...'
                : 'Connection Inactive'}
            </span>
          </div>

          {/* Real-time audio waveform bars */}
          <div className="flex items-center gap-1.5 mt-5 h-6 z-10">
            {[20, 45, 80, 60, 30, 90, 75, 40, 85, 30].map((h, i) => {
              const activeHeight = isMicActive || isGeminiSpeaking ? Math.max(6, (h * audioLevel) / 100) : 4;
              return (
                <span
                  key={i}
                  className="w-1 rounded-full bg-emerald-400 transition-all duration-75"
                  style={{ height: `${activeHeight}px` }}
                />
              );
            })}
          </div>
        </div>

        {/* Live Conversation Transcript Feed */}
        <div className="flex-1 p-4 bg-stone-50 overflow-y-auto max-h-48 text-xs space-y-2 border-y border-stone-200">
          <div className="font-bold text-[10px] text-stone-400 uppercase tracking-wider">
            Live Audio Feed & Notes
          </div>
          {liveTranscript.map((line, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-white border border-stone-200/70 text-stone-800 leading-relaxed shadow-2xs"
            >
              {line}
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>

        {/* Error notification if any */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border-t border-rose-200 text-rose-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Controls Bar */}
        <div className="p-4 bg-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              id="btn-toggle-mic"
              onClick={toggleMic}
              disabled={connectionStatus !== 'connected'}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition active:scale-95 ${
                isMicActive
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
              }`}
            >
              {isMicActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isMicActive ? 'Mute Mic' : 'Unmute Mic'}</span>
            </button>

            <button
              id="btn-reconnect-live"
              onClick={() => {
                cleanupLiveSession();
                startLiveSession();
              }}
              className="p-2.5 rounded-2xl border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition"
              title="Restart voice session"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition"
          >
            End Conversation
          </button>
        </div>
      </div>
    </div>
  );
};
