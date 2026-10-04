import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

dotenv.config();

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '10mb' }));

// Lazy initialization for Google GenAI to avoid crashing on startup
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    mapsConfigured: Boolean(process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
  });
});

// Maps configuration endpoint for dynamic client loading without hardcoded keys
app.get('/api/maps/config', (req, res) => {
  const apiKey =
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    '';
  res.json({ apiKey });
});

// Multi-turn Gemini Chat API
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { messages, model, systemInstruction } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const ai = getGenAI();
    // Default model fallback
    const targetModel = model || 'gemini-3.5-flash';

    // Format conversation history for chats.create
    // Each history entry has role: 'user' | 'model', parts: [{ text }]
    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1].content;

    const chat = ai.chats.create({
      model: targetModel,
      config: {
        systemInstruction:
          systemInstruction ||
          'You are LeafLens Agronomist AI, an expert agricultural scientist and plant pathologist. Provide accurate, empathetic, and actionable advice on crop diseases, organic biocontrols, chemical treatments, and weather risk management.',
      },
      history: history.length > 0 ? history : undefined,
    });

    const result = await chat.sendMessage({
      message: lastMessage,
    });

    const replyText = result.text || 'No response generated.';
    return res.json({ text: replyText, model: targetModel });
  } catch (error: any) {
    console.error('Gemini Chat API Error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate response from Gemini',
    });
  }
});

async function startServer() {
  const server = http.createServer(app);

  // WebSocket Server for Gemini Live API (gemini-3.8-live)
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', async (clientWs: WebSocket) => {
    console.log('[Live API] Client connected to /live WebSocket');

    let session: any = null;
    try {
      const ai = getGenAI();
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction:
            'You are LeafLens Live Voice Agronomist. You are talking directly to a farmer out in the field. Speak naturally, warmly, concisely, and with practical agricultural expertise. Focus on plant health, symptoms, immediate field actions, and weather protection.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            const text = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (text) {
              clientWs.send(JSON.stringify({ text }));
            }
          },
          onerror: (err: any) => {
            console.error('[Live API Session Error]:', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ error: err?.message || 'Live session error' }));
            }
          },
          onclose: () => {
            console.log('[Live API Session Closed]');
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ closed: true }));
            }
          },
        },
      });

      clientWs.send(JSON.stringify({ status: 'connected', model: 'gemini-3.8-live' }));
    } catch (err: any) {
      console.error('[Live API Init Error]:', err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: err?.message || 'Failed to initialize Gemini Live API' }));
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.audio && session) {
          session.sendRealtimeInput({
            audio: { data: data.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (data.text && session) {
          session.sendRealtimeInput({
            text: data.text,
          });
        }
      } catch (err) {
        console.error('[Live API Message Parse Error]:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('[Live API] Client disconnected');
      if (session) {
        try {
          session.close();
        } catch (e) {
          // ignore
        }
      }
    });

    clientWs.on('error', (err) => {
      console.error('[Live API Client WS Error]:', err);
      if (session) {
        try {
          session.close();
        } catch (e) {
          // ignore
        }
      }
    });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LeafLens Full-Stack Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal Server Startup Error:', err);
  process.exit(1);
});
