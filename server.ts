import 'dotenv/config';
import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  Type,
  type FunctionDeclaration,
  type LiveServerMessage,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const SELF_HARM_PATTERNS = [
  /\bsuicid(e|al)\b/i,
  /\bkill(ing)?\s+myself\b/i,
  /\bhurt(ing)?\s+myself\b/i,
  /\bharm(ing)?\s+myself\b/i,
  /\bcut(ting)?\s+myself\b/i,
  /\bself[- ]?harm(ing)?\b/i,
  /\bend(ing)?\s+(my\s+life|it\s+all)\b/i,
  /\bwant(ing)?\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+here|wake\s+up|exist)\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\btak(e|ing)\s+my\s+own\s+life\b/i,
];

function checkSelfHarm(text: string): boolean {
  return SELF_HARM_PATTERNS.some((pattern) => pattern.test(text));
}

function extractFallbackLearnedFact(
  message: string,
  existingInsights: string[] = []
): string {
  const lower = message.toLowerCase();
  const candidates: [RegExp, string][] = [
    [/\b(c-?section|cesarean|incision)\b/i, 'Healing from a C-section birth; prioritizing gentle lifting and rest'],
    [/\b(pelvic|sore|stitches|tear)\b/i, 'Focusing on pelvic floor and physical healing pacing'],
    [/\b(back|shoulder|neck|wrist)\s+(pain|ache|tension|sore|stiff)/i, 'Experiencing carrying tension in shoulders, neck, or back'],
    [/\b(pump(ing)?|latch|milk|breastfeed|nursing)\b/i, 'Navigating feeding and pumping routines alongside rest'],
    [/\b(tea|coffee|walk|music|journal|bath|shower)\b/i, 'Finds short calming rituals (walks, warm drinks, or music) restorative'],
    [/\b(partner|husband|wife|mom|mother|sister|friend)\b/i, 'Coordinating support stretches with family or close helpers'],
  ];

  const existingJoined = existingInsights.join(' ').toLowerCase();
  for (const [pattern, fact] of candidates) {
    if (pattern.test(lower) && !existingJoined.includes(fact.slice(0, 18).toLowerCase())) {
      return fact;
    }
  }
  return '';
}

function buildFallbackCompanionResponse(
  message: string,
  mood?: string,
  motherName = 'Maya',
  babyName = 'Leo',
  interests: string[] = ['walking', 'cooking', 'music'],
  existingInsights: string[] = []
): { reply: string; tinyStep: string; nonMedicalNote: string; learnedFact: string } {
  const key = (mood || message).toLowerCase();
  const hasMusic = interests.some((i) => i.toLowerCase().includes('music'));
  const hasWalking = interests.some((i) => i.toLowerCase().includes('walk'));
  const learnedFact = extractFallbackLearnedFact(message, existingInsights);

  if (key.includes('overwhelm') || key.includes('anxious') || key.includes('panic')) {
    return {
      reply: `Take one slow breath with me, ${motherName}. Caring for ${babyName} asks so much of your body and heart, and feeling stretched thin right now makes complete sense. You do not have to carry today all at once.`,
      tinyStep: 'Place a hand on your chest, drop your shoulders, and take 4 slow breaths before doing anything else.',
      nonMedicalNote: 'I am here for emotional support and everyday steps — I never diagnose or give medical advice.',
      learnedFact,
    };
  }

  if (key.includes('tired') || key.includes('sleep') || key.includes('exhaust')) {
    return {
      reply: `Broken sleep wears down every part of you, ${motherName}. You have been showing up for ${babyName} hour after hour, and resting right now counts as real care.`,
      tinyStep: hasMusic
        ? 'Sip a glass of water and put on one calm, familiar song while sitting down for 3 minutes.'
        : 'Drink a full glass of water and rest your eyes for 3 quiet minutes without checking your to-do list.',
      nonMedicalNote: 'I am here for emotional support and everyday steps — I never diagnose or give medical advice.',
      learnedFact,
    };
  }

  if (key.includes('sad') || key.includes('cry') || key.includes('lonely') || key.includes('alone')) {
    return {
      reply: `I am so glad you told me instead of holding that sadness alone, ${motherName}. Postpartum days can feel surprisingly quiet and heavy, even when you love ${babyName} deeply.`,
      tinyStep: 'Send a one-line text to someone you trust — even just "Thinking of you, could use a quick hello today."',
      nonMedicalNote: 'I am here for emotional support and everyday steps — I never diagnose or give medical advice.',
      learnedFact,
    };
  }

  if (key.includes('hopeful') || key.includes('good') || key.includes('okay')) {
    return {
      reply: `I love hearing that gentle steadiness in your day, ${motherName}. Notice what helped this moment feel a little lighter with ${babyName}, and give yourself credit for making it here.`,
      tinyStep: hasWalking
        ? `Step outside or near an open window for a 5-minute fresh-air stretch with ${babyName}.`
        : 'Pause for 2 minutes with a warm drink to savor this calmer pocket of the day.',
      nonMedicalNote: 'I am here for emotional support and everyday steps — I never diagnose or give medical advice.',
      learnedFact,
    };
  }

  return {
    reply: `Thank you for sharing what is on your mind, ${motherName}. Every week with ${babyName} brings new rhythms, and you deserve steady, judgment-free support right alongside them.`,
    tinyStep: 'Take 5 quiet minutes to drink some water, unclench your jaw, and pick just one gentle priority for the next hour.',
    nonMedicalNote: 'I am here for emotional support and everyday steps — I never diagnose or give medical advice.',
    learnedFact,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.post('/api/companion/chat', async (req, res) => {
    const {
      message = '',
      mood = '',
      motherName = 'Maya',
      babyName = 'Leo',
      babyAge = '3 months old',
      interests = ['walking', 'cooking', 'music'],
      existingInsights = [],
      timeOfDay = 'morning',
      history = [],
    } = req.body ?? {};

    const userText = String(message || mood || '').trim();
    if (!userText) {
      res.status(400).json({ error: 'Please share a mood or short message.' });
      return;
    }

    if (checkSelfHarm(userText)) {
      res.json({
        crisisTriggered: true,
        reply:
          'Please reach out right now — you deserve immediate, caring human support and you do not have to go through this moment alone.',
        tinyStep: 'Call or text 988 now for free, confidential 24/7 support.',
        nonMedicalNote:
          'I am an AI companion and cannot provide crisis or medical care. Please contact 988 or 1-833-TLC-MAMA (1-833-852-6262) immediately.',
      });
      return;
    }

    const safeInsights = Array.isArray(existingInsights)
      ? existingInsights.map((s) => String(s)).slice(0, 6)
      : [];

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.json({
        crisisTriggered: false,
        source: 'demo-fallback',
        ...buildFallbackCompanionResponse(userText, mood, motherName, babyName, interests, safeInsights),
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const recentContext = Array.isArray(history)
        ? history
            .slice(-6)
            .map((m: { sender?: string; text?: string }) => `${m.sender === 'user' ? motherName : 'Nia'}: ${m.text ?? ''}`)
            .join('\n')
        : '';

      const prompt = [
        `Mother's name: ${motherName}. Baby: ${babyName} (${babyAge}).`,
        `Mother's interests: ${Array.isArray(interests) ? interests.join(', ') : 'walking, cooking, music'}.`,
        safeInsights.length > 0 ? `Already remembered about ${motherName}: ${safeInsights.join(' | ')}` : '',
        `Current time window: ${timeOfDay}.`,
        mood ? `Selected check-in mood: ${mood}.` : '',
        recentContext ? `Recent conversation:\n${recentContext}` : '',
        `${motherName}'s latest message: "${userText}"`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are Nia ("Her"), a warm, calm, supportive postpartum companion inside MomLink. ' +
            'Speak gently like a caring, grounded friend in 2 to 3 short readable sentences (around 45-70 words). ' +
            'CRITICAL SAFETY BOUNDARY: You SUPPORT — you NEVER diagnose any condition, NEVER interpret medical symptoms, and NEVER give medical advice. ' +
            'Always provide one tiny, concrete, low-effort next step (taking 2 to 5 minutes, optionally weaving in walking, cozy cooking/tea, or calm music when natural) in tinyStep, ' +
            'and a clear, gentle reminder in nonMedicalNote that you offer emotional support only and never diagnose or give medical advice. ' +
            'Also populate learnedFact with 1 short non-medical personal takeaway (6-14 words, no diagnosis) if she revealed something new about her recovery experience, comfort preferences, sleep/feeding rhythm, or support network not already listed; otherwise set learnedFact to "".',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'Warm, empathetic 2-3 sentence response to the mother.',
              },
              tinyStep: {
                type: Type.STRING,
                description: 'One tiny, gentle, realistic next step taking 5 minutes or less.',
              },
              nonMedicalNote: {
                type: Type.STRING,
                description: 'Short supportive disclaimer stating Nia supports and never diagnoses or gives medical advice.',
              },
              learnedFact: {
                type: Type.STRING,
                description:
                  'Optional 6-14 word non-medical personal detail learned from this message for personalized recovery notes, or empty string if none.',
              },
            },
            required: ['reply', 'tinyStep', 'nonMedicalNote'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText) as {
        reply?: string;
        tinyStep?: string;
        nonMedicalNote?: string;
        learnedFact?: string;
      };

      const fallback = buildFallbackCompanionResponse(
        userText,
        mood,
        motherName,
        babyName,
        interests,
        safeInsights
      );
      res.json({
        crisisTriggered: false,
        source: 'gemini',
        reply: parsed.reply?.trim() || fallback.reply,
        tinyStep: parsed.tinyStep?.trim() || fallback.tinyStep,
        nonMedicalNote:
          parsed.nonMedicalNote?.trim() ||
          'I support you emotionally — I never diagnose and never give medical advice.',
        learnedFact: (parsed.learnedFact ?? '').trim().slice(0, 140),
      });
    } catch (error) {
      console.error('Gemini companion fallback used:', error);
      res.json({
        crisisTriggered: false,
        source: 'demo-fallback',
        ...buildFallbackCompanionResponse(userText, mood, motherName, babyName, interests, safeInsights),
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const companionWss = new WebSocketServer({ noServer: true });
  const onboardingWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url ?? '/', `http://localhost:${PORT}`);
    if (pathname === '/api/companion/live') {
      companionWss.handleUpgrade(request, socket, head, (ws) => {
        companionWss.emit('connection', ws, request);
      });
    } else if (pathname === '/api/onboarding/live') {
      onboardingWss.handleUpgrade(request, socket, head, (ws) => {
        onboardingWss.emit('connection', ws, request);
      });
    }
  });

  companionWss.on('connection', async (clientWs, req) => {
    const reqUrl = new URL(req.url ?? '/api/companion/live', `http://localhost:${PORT}`);
    const motherName = reqUrl.searchParams.get('motherName') || 'Maya';
    const babyName = reqUrl.searchParams.get('babyName') || 'Leo';
    const babyAge = reqUrl.searchParams.get('babyAge') || '3 months old';
    const timeOfDay = reqUrl.searchParams.get('timeOfDay') || 'morning';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            error: 'Live voice requires a configured GEMINI_API_KEY.',
          })
        );
        clientWs.close();
      }
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: 'v1beta',
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let userTranscriptBuffer = '';
    let closed = false;
    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    let errorReported = false;

    const sanitizeLiveError = (err: unknown): string => {
      const e = err as {
        message?: string;
        error?: { message?: string; code?: string | number };
        code?: string | number;
        reason?: string;
      };
      const raw =
        e?.error?.message ||
        e?.message ||
        e?.reason ||
        (typeof err === 'string' ? err : 'WebSocket connection failed');
      return String(raw).replace(/([?&](?:key|access_token)=)[^&\s]+/gi, '$1[REDACTED]');
    };

    const sendToClient = (payload: Record<string, unknown>) => {
      if (!closed && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const sessionPromise = ai.live
      .connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            `You are Nia ("Her"), a warm, calm, grounded postpartum voice companion inside MomLink talking live with ${motherName}. ` +
            `Her baby is ${babyName} (${babyAge}). Current time window: ${timeOfDay}. ` +
            'Speak naturally like a caring friend in 1 to 3 short, gentle spoken sentences. Do not use markdown, lists, or bullet points. ' +
            'CRITICAL SAFETY BOUNDARY: You offer emotional support and tiny everyday comfort steps ONLY — you NEVER diagnose any condition, NEVER interpret medical symptoms, and NEVER give medical advice. ' +
            'If she sounds overwhelmed or in distress, keep your voice soothing, remind her she is not alone, and gently offer one tiny 2-minute step.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (closed) return;
            const content = message.serverContent;

            if (content?.inputTranscription?.text) {
              const chunk = content.inputTranscription.text;
              userTranscriptBuffer = `${userTranscriptBuffer} ${chunk}`.trim();
              if (checkSelfHarm(userTranscriptBuffer)) {
                sendToClient({ crisisTriggered: true });
                closed = true;
                try {
                  liveSession?.close();
                } catch {
                  // Ignore
                }
                clientWs.close();
                return;
              }
              sendToClient({ inputTranscript: chunk });
            }

            if (content?.outputTranscription?.text) {
              sendToClient({ outputTranscript: content.outputTranscription.text });
            }

            if (content?.interrupted) {
              sendToClient({ interrupted: true });
            }

            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                sendToClient({ audio: part.inlineData.data });
              }
            }

            if (content?.turnComplete) {
              userTranscriptBuffer = '';
              sendToClient({ turnComplete: true });
            }
          },
          onerror: (err) => {
            const detail = sanitizeLiveError(err);
            console.error('Gemini Live session error:', detail, {
              hasBaseUrl: Boolean(process.env.GOOGLE_GEMINI_BASE_URL),
              useVertex: process.env.GOOGLE_GENAI_USE_VERTEXAI,
            });
            errorReported = true;
            sendToClient({
              error: `Live voice connection issue: ${detail}`,
            });
          },
          onclose: (ev) => {
            const code = (ev as { code?: number })?.code;
            const reason = (ev as { reason?: string })?.reason;
            if (code && code !== 1000 && !errorReported && !closed) {
              const safeReason = sanitizeLiveError(reason || `code ${code}`);
              console.error('Gemini Live session closed unexpectedly:', code, safeReason);
              errorReported = true;
              sendToClient({
                error: `Live voice session closed (${code}): ${safeReason}`,
              });
            }
            if (!closed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.close();
            }
          },
        },
      })
      .then((session) => {
        liveSession = session;
        if (closed) {
          try {
            session.close();
          } catch {
            // Ignore
          }
          return null;
        }
        sendToClient({ ready: true });
        return session;
      })
      .catch((err) => {
        const detail = sanitizeLiveError(err);
        console.error('Failed to connect to Gemini Live:', detail);
        if (!errorReported) {
          errorReported = true;
          sendToClient({
            error: `Could not start live voice: ${detail}`,
          });
        }
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close();
        }
        return null;
      });

    clientWs.on('message', async (raw) => {
      if (closed) return;
      try {
        const parsed = JSON.parse(raw.toString()) as { audio?: string; text?: string };
        const session = liveSession ?? (await sessionPromise);
        if (!session || closed) return;

        if (parsed.audio) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (parsed.text) {
          if (checkSelfHarm(parsed.text)) {
            sendToClient({ crisisTriggered: true });
            closed = true;
            session.close();
            clientWs.close();
            return;
          }
          session.sendRealtimeInput({ text: parsed.text });
        }
      } catch (err) {
        console.error('Error forwarding live audio chunk:', err);
      }
    });

    clientWs.on('close', async () => {
      closed = true;
      try {
        const session = liveSession ?? (await sessionPromise);
        session?.close();
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  const updateSignupFieldsTool: FunctionDeclaration = {
    name: 'updateSignupFields',
    description:
      'Saves the mother’s onboarding signup fields as she shares her first name, baby name, due date or baby birthday, up to 2 goals, or privacy preferences.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        firstName: {
          type: Type.STRING,
          description: 'The mother’s first name.',
        },
        babyName: {
          type: Type.STRING,
          description: 'The baby’s name or nickname if provided.',
        },
        babyDateInput: {
          type: Type.STRING,
          description: 'Baby birthday or due date formatted as YYYY-MM-DD.',
        },
        selectedGoals: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            'Up to 2 goals from: Recovering from birth, Sleep, Feeding, Feeling like myself again, Finding my people, Keeping track of appointments.',
        },
        shareCheckIns: {
          type: Type.BOOLEAN,
          description: 'Whether to allow sharing mood check-ins and EPDS scores.',
        },
        shareAppointments: {
          type: Type.BOOLEAN,
          description: 'Whether to allow sharing appointments.',
        },
        shareWithOB: {
          type: Type.BOOLEAN,
          description: 'Whether to share consented items with OB or midwife.',
        },
        shareWithTherapist: {
          type: Type.BOOLEAN,
          description: 'Whether to share consented items with a therapist.',
        },
        shareWithPartner: {
          type: Type.BOOLEAN,
          description: 'Whether to share consented items with partner.',
        },
        anonymousInCommunity: {
          type: Type.BOOLEAN,
          description: 'Whether to post anonymously by default in Community.',
        },
        expiryOption: {
          type: Type.STRING,
          description: 'Consent expiry: "30 days", "90 days", or "Until revoked".',
        },
        completeSignup: {
          type: Type.BOOLEAN,
          description:
            'True after gathering her name, baby info, goals, and privacy preferences so she can enter her email and password to save her account.',
        },
      },
    },
  };

  onboardingWss.on('connection', async (clientWs) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            error: 'Voice sign-up requires a configured GEMINI_API_KEY.',
          })
        );
        clientWs.close();
      }
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: 'v1beta',
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let userTranscriptBuffer = '';
    let closed = false;
    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    let errorReported = false;

    const sanitizeLiveError = (err: unknown): string => {
      const e = err as {
        message?: string;
        error?: { message?: string; code?: string | number };
        code?: string | number;
        reason?: string;
      };
      const raw =
        e?.error?.message ||
        e?.message ||
        e?.reason ||
        (typeof err === 'string' ? err : 'WebSocket connection failed');
      return String(raw).replace(/([?&](?:key|access_token)=)[^&\s]+/gi, '$1[REDACTED]');
    };

    const sendToClient = (payload: Record<string, unknown>) => {
      if (!closed && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const sessionPromise = ai.live
      .connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
          tools: [{ functionDeclarations: [updateSignupFieldsTool] }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            'You are Nia inside MomLink guiding a quick, warm 60-second voice sign-up. ' +
            'Ask ONE short gentle step at a time in 1-2 brief sentences: ' +
            '1) First name, ' +
            '2) Baby’s birthday or due date AND baby’s name (or nickname, optional if still expecting), ' +
            '3) Up to 2 goals from: Recovering from birth, Sleep, Feeding, Feeling like myself again, Finding my people, Keeping track of appointments, ' +
            '4) Quick privacy choice: whether she wants to stay anonymous in Community and who can see check-ins (OB/Midwife, Therapist, Partner, or private). ' +
            'Whenever the mother answers any part, IMMEDIATELY call updateSignupFields with the extracted fields (convert dates to YYYY-MM-DD relative to 2026 if year omitted), then warmly ask the next step. ' +
            'Once those 4 steps are gathered, call updateSignupFields with completeSignup: true and invite her to type her email and password on screen to create her account. ' +
            'NEVER ask her to speak a password out loud, and NEVER diagnose or give medical advice.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (closed) return;
            const content = message.serverContent;

            if (content?.inputTranscription?.text) {
              const chunk = content.inputTranscription.text;
              userTranscriptBuffer = `${userTranscriptBuffer} ${chunk}`.trim();
              if (checkSelfHarm(userTranscriptBuffer)) {
                sendToClient({ crisisTriggered: true });
                closed = true;
                try {
                  liveSession?.close();
                } catch {
                  // Ignore
                }
                clientWs.close();
                return;
              }
              sendToClient({ inputTranscript: chunk });
            }

            if (content?.outputTranscription?.text) {
              sendToClient({ outputTranscript: content.outputTranscription.text });
            }

            if (content?.interrupted) {
              sendToClient({ interrupted: true });
            }

            for (const call of message.toolCall?.functionCalls ?? []) {
              if (call.name === 'updateSignupFields') {
                sendToClient({ onboardingPatch: call.args ?? {} });
                try {
                  liveSession?.sendToolResponse({
                    functionResponses: [
                      {
                        id: call.id,
                        name: call.name,
                        response: { ok: true },
                      },
                    ],
                  });
                } catch {
                  // Ignore tool response error if closed
                }
              }
            }

            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                sendToClient({ audio: part.inlineData.data });
              }
            }

            if (content?.turnComplete) {
              userTranscriptBuffer = '';
              sendToClient({ turnComplete: true });
            }
          },
          onerror: (err) => {
            const detail = sanitizeLiveError(err);
            console.error('Gemini onboarding Live error:', detail);
            errorReported = true;
            sendToClient({
              error: `Voice sign-up issue: ${detail}`,
            });
          },
          onclose: (ev) => {
            const code = (ev as { code?: number })?.code;
            const reason = (ev as { reason?: string })?.reason;
            if (code && code !== 1000 && !errorReported && !closed) {
              const safeReason = sanitizeLiveError(reason || `code ${code}`);
              console.error('Gemini onboarding Live closed unexpectedly:', code, safeReason);
              errorReported = true;
              sendToClient({
                error: `Voice sign-up closed (${code}): ${safeReason}`,
              });
            }
            if (!closed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.close();
            }
          },
        },
      })
      .then((session) => {
        liveSession = session;
        if (closed) {
          try {
            session.close();
          } catch {
            // Ignore
          }
          return null;
        }
        sendToClient({ ready: true });
        try {
          session.sendRealtimeInput({
            text: 'Greet the mother warmly in one short sentence and ask her first name.',
          });
        } catch {
          // Ignore prompt send if closing
        }
        return session;
      })
      .catch((err) => {
        const detail = sanitizeLiveError(err);
        console.error('Failed to connect to Gemini onboarding Live:', detail);
        if (!errorReported) {
          errorReported = true;
          sendToClient({
            error: `Could not start voice sign-up: ${detail}`,
          });
        }
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close();
        }
        return null;
      });

    clientWs.on('message', async (raw) => {
      if (closed) return;
      try {
        const parsed = JSON.parse(raw.toString()) as { audio?: string };
        const session = liveSession ?? (await sessionPromise);
        if (!session || closed || !parsed.audio) return;
        session.sendRealtimeInput({
          audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
        });
      } catch (err) {
        console.error('Error forwarding onboarding audio chunk:', err);
      }
    });

    clientWs.on('close', async () => {
      closed = true;
      try {
        const session = liveSession ?? (await sessionPromise);
        session?.close();
      } catch {
        // Ignore
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`MomLink server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
