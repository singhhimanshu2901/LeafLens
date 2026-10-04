import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Zap,
  Brain,
  Layers,
  RotateCcw,
  Copy,
  Check,
  Leaf,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { DiagnosisRecord, Language } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

export type GeminiModelType =
  | 'gemini-3.5-flash'
  | 'gemini-3.1-flash-lite'
  | 'gemini-3.1-pro-preview';

interface AgronomistRole {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  systemInstruction: string;
}

const AGRI_ROLES: AgronomistRole[] = [
  {
    id: 'pathologist',
    title: 'Senior Plant Pathologist',
    subtitle: 'Disease etiology, sporulation biology & chemical IPM triage',
    icon: Brain,
    systemInstruction:
      'You are Dr. Aris, a Senior Crop Pathologist with 25 years of field experience in diagnosing fungal, bacterial, and viral plant diseases. Provide accurate biological diagnoses, evaluate microclimate weather risks (humidity, leaf wetness), and outline strict integrated pest management (IPM) protocols with exact chemical and biological active ingredients.',
  },
  {
    id: 'field_officer',
    title: 'Extension Agronomist',
    subtitle: 'Practical on-farm management, irrigation & soil nutrition',
    icon: Leaf,
    systemInstruction:
      'You are a friendly, experienced Agricultural Extension Officer working directly with smallholder and commercial farmers. Provide clear, straightforward, and highly practical instructions for day-to-day farm operations: irrigation timing, pruning canopy airflow, crop rotation, soil health, and affordable preventative strategies.',
  },
  {
    id: 'organic_expert',
    title: 'Organic & Bio-Farming Specialist',
    subtitle: 'Trichoderma, neem extracts, composting & natural biocontrol',
    icon: Sparkles,
    systemInstruction:
      'You are an expert Organic & Regenerative Agriculture Consultant. Specialize in zero-chemical, biological crop protection. Detail exact recipes for neem kernel extracts, cow urine bio-formulations, Trichoderma viride applications, companion planting, and mycorrhizal soil inoculation.',
  },
];

const QUICK_SUGGESTIONS = [
  'How do I treat Late Blight on potatoes organically?',
  'Why does high humidity accelerate fungal sporulation?',
  'What is the recommended spray interval for systemic fungicides?',
  'How do I make a 5% neem seed kernel extract (NSKE)?',
];

interface GeminiChatbotProps {
  currentLang: Language;
  latestDiagnosis?: DiagnosisRecord | null;
  onOpenLiveVoice?: () => void;
}

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({
  currentLang,
  latestDiagnosis,
  onOpenLiveVoice,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        'Hello! I am your LeafLens Agronomist AI. Ask me anything about crop diseases, chemical active ingredients, organic biocontrols, weather protection, or paste details from your latest field scan.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.5-flash',
    },
  ]);

  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Model Selection as instructed:
  // - gemini-3.5-flash for general tasks (default)
  // - gemini-3.1-flash-lite for fast responses
  // - gemini-3.1-pro-preview for complex tasks
  const [selectedModel, setSelectedModel] = useState<GeminiModelType>('gemini-3.5-flash');

  // Role Selection
  const [selectedRole, setSelectedRole] = useState<AgronomistRole>(AGRI_ROLES[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    setErrorMsg(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: selectedModel,
          systemInstruction: selectedRole.systemInstruction,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.text || 'No response received.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.model || selectedModel,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setErrorMsg(err.message || 'Failed to communicate with Gemini model.');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (confirm('Clear entire conversation history?')) {
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: `Conversation reset. Ready to consult as ${selectedRole.title}. How may I help your crops today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: selectedModel,
        },
      ]);
    }
  };

  const handleIncludeLatestScan = () => {
    if (!latestDiagnosis) return;
    const scanContext = `[Context from my latest field diagnosis: Crop: ${latestDiagnosis.cropName}, Primary Disease: ${latestDiagnosis.primaryDiagnosis}, Confidence: ${(latestDiagnosis.confidenceScore * 100).toFixed(0)}%, Urgent Action Needed: ${latestDiagnosis.needsExpertReview ? 'Yes' : 'No'}]. Can you advise on the best containment strategy for this diagnosis?`;
    handleSendMessage(scanContext);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 flex flex-col h-[calc(100vh-140px)] min-h-[620px]">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/90 shadow-xs mb-3 space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-['Outfit'] font-black text-lg text-stone-900">
                  Gemini Agronomist Chat
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-200">
                  Multi-Turn
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium">
                Continuous agronomy consultation powered by Google Gemini models
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenLiveVoice && (
              <button
                id="btn-switch-live-voice"
                onClick={onOpenLiveVoice}
                className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs hover:brightness-110 active:scale-95 transition"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Live Voice (gemini-3.8-live)</span>
              </button>
            )}

            <button
              id="btn-clear-chat"
              onClick={handleClearHistory}
              title="Reset conversation"
              className="p-2 rounded-2xl border border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Role and Model Selection Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-stone-100 text-xs">
          {/* Role Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-emerald-700" /> Specialist Persona & Role:
            </label>
            <select
              value={selectedRole.id}
              onChange={(e) => {
                const r = AGRI_ROLES.find((item) => item.id === e.target.value);
                if (r) setSelectedRole(r);
              }}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {AGRI_ROLES.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.title} — {role.subtitle}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Model Intelligence Engine:
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as GeminiModelType)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="gemini-3.5-flash">
                gemini-3.5-flash (Balanced & General Tasks - Recommended)
              </option>
              <option value="gemini-3.1-flash-lite">
                gemini-3.1-flash-lite (Fast Speed & Low Latency)
              </option>
              <option value="gemini-3.1-pro-preview">
                gemini-3.1-pro-preview (Deep Reasoning & Complex Pathology)
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Messages Thread Container */}
      <div className="flex-1 bg-white rounded-3xl border border-stone-200/90 shadow-sm p-4 sm:p-5 overflow-y-auto space-y-4 mb-3">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 items-start ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-emerald-800" />
                </div>
              )}

              <div
                className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                  isUser
                    ? 'bg-gradient-to-r from-emerald-700 to-emerald-800 text-white rounded-br-xs'
                    : 'bg-[#faf9f5] border border-stone-200/80 text-stone-900 rounded-bl-xs'
                }`}
              >
                {/* Message Header info */}
                <div
                  className={`flex items-center justify-between gap-3 text-[10px] mb-1 font-semibold ${
                    isUser ? 'text-emerald-200' : 'text-stone-400'
                  }`}
                >
                  <span>{isUser ? 'You' : selectedRole.title}</span>
                  <div className="flex items-center gap-1.5">
                    {msg.modelUsed && <span>{msg.modelUsed}</span>}
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>
                </div>

                {/* Message Body */}
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                {/* Copy button */}
                <button
                  onClick={() => handleCopy(msg.content, msg.id)}
                  title="Copy text"
                  className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition p-1 rounded-md ${
                    isUser
                      ? 'bg-emerald-800/80 text-emerald-100 hover:bg-emerald-900'
                      : 'bg-stone-200/70 text-stone-600 hover:bg-stone-300'
                  }`}
                >
                  {copiedId === msg.id ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-stone-800 text-white flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 items-start justify-start">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 animate-pulse">
              <Bot className="w-4 h-4 text-emerald-800" />
            </div>
            <div className="bg-[#faf9f5] border border-stone-200/80 rounded-2xl rounded-bl-xs p-4 text-xs text-stone-600 flex items-center gap-2 shadow-2xs">
              <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
              <span>
                {selectedRole.title} is analyzing using <strong className="text-stone-800">{selectedModel}</strong>...
              </span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips & Latest Scan Context */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 shrink-0 no-scrollbar">
        {latestDiagnosis && (
          <button
            onClick={handleIncludeLatestScan}
            className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px] flex items-center gap-1.5 hover:bg-emerald-200 shrink-0 transition"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-700" />
            <span>Include Latest Scan ({latestDiagnosis.cropName})</span>
          </button>
        )}

        {QUICK_SUGGESTIONS.map((sug, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(sug)}
            className="px-3 py-1.5 rounded-full bg-white border border-stone-200 text-stone-700 hover:text-stone-900 hover:bg-stone-50 font-medium text-[11px] shrink-0 shadow-2xs transition"
          >
            {sug}
          </button>
        ))}
      </div>

      {/* Input Box Area */}
      <div className="bg-white rounded-3xl p-2.5 sm:p-3 border border-stone-200/90 shadow-sm shrink-0 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask ${selectedRole.title} (Press Enter to send)...`}
          rows={1}
          className="flex-1 max-h-32 min-h-[44px] p-2.5 text-xs sm:text-sm text-stone-900 bg-transparent resize-none focus:outline-none placeholder:text-stone-400 font-medium"
        />

        <button
          id="btn-send-chat"
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() || isLoading}
          className="w-11 h-11 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-800 disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-xs hover:brightness-105 active:scale-95 transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
