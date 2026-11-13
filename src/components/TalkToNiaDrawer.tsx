import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { LifeBuoy, Mic, MicOff, PhoneOff, Send, Volume2, X } from 'lucide-react';
import { ChatMessage, MayaProfile, MoodOption } from '../types';
import {
  decodeBase64Pcm16ToAudioBuffer,
  float32ToBase64Pcm16,
} from '../utils/liveAudio';
import {
  detectSelfHarmIntent,
  getProactiveCompanionOpening,
  getTimePeriod,
} from '../utils/supportLogic';
import { CrisisResourcesCard } from './CrisisResourcesCard';

const MOOD_OPTIONS: MoodOption[] = ['Okay', 'Tired', 'Overwhelmed', 'Sad', 'Anxious', 'Hopeful'];

interface TalkToNiaDrawerProps {
  open: boolean;
  startInVoiceMode?: boolean;
  onClose: () => void;
  profile: MayaProfile;
  effectiveHour: number;
  messages: ChatMessage[];
  isSending: boolean;
  crisisLockActive: boolean;
  onClearCrisisLock: () => void;
  onTriggerCrisisLock: () => void;
  onAppendVoiceMessage: (sender: 'user' | 'companion', text: string) => void;
  onSendMessage: (text: string, mood?: MoodOption) => void;
  onOpenHelp: () => void;
}

type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error';

export function TalkToNiaDrawer({
  open,
  startInVoiceMode = false,
  onClose,
  profile,
  effectiveHour,
  messages,
  isSending,
  crisisLockActive,
  onClearCrisisLock,
  onTriggerCrisisLock,
  onAppendVoiceMessage,
  onSendMessage,
  onOpenHelp,
}: TalkToNiaDrawerProps) {
  const [draftInput, setDraftInput] = useState('');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isNiaSpeaking, setIsNiaSpeaking] = useState(false);
  const [liveUserDraft, setLiveUserDraft] = useState('');
  const [liveNiaDraft, setLiveNiaDraft] = useState('');

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(false);
  const isLiveReadyRef = useRef<boolean>(false);
  const userDraftRef = useRef<string>('');
  const niaDraftRef = useRef<string>('');
  const autoStartedRef = useRef<boolean>(false);
  const onAppendVoiceMessageRef = useRef(onAppendVoiceMessage);
  const onTriggerCrisisLockRef = useRef(onTriggerCrisisLock);

  useEffect(() => {
    onAppendVoiceMessageRef.current = onAppendVoiceMessage;
  }, [onAppendVoiceMessage]);

  useEffect(() => {
    onTriggerCrisisLockRef.current = onTriggerCrisisLock;
  }, [onTriggerCrisisLock]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages, isSending, liveUserDraft, liveNiaDraft]);

  const stopPlaybackQueue = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // Ignore already stopped sources
      }
    });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsNiaSpeaking(false);
  }, []);

  const stopVoiceSession = useCallback(() => {
    if (userDraftRef.current.trim()) {
      onAppendVoiceMessageRef.current('user', userDraftRef.current.trim());
      userDraftRef.current = '';
      setLiveUserDraft('');
    }
    if (niaDraftRef.current.trim()) {
      onAppendVoiceMessageRef.current('companion', niaDraftRef.current.trim());
      niaDraftRef.current = '';
      setLiveNiaDraft('');
    }

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // Ignore
      }
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }

    stopPlaybackQueue();

    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore
      }
      wsRef.current = null;
    }

    isLiveReadyRef.current = false;
    setVoiceStatus('idle');
    setIsMuted(false);
    setIsNiaSpeaking(false);
  }, [stopPlaybackQueue]);

  const startVoiceSession = useCallback(async () => {
    if (crisisLockActive) return;
    if (wsRef.current || voiceStatus === 'connecting' || voiceStatus === 'live') return;

    setVoiceError(null);
    setVoiceStatus('connecting');
    userDraftRef.current = '';
    niaDraftRef.current = '';
    setLiveUserDraft('');
    setLiveNiaDraft('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams({
        motherName: profile.name,
        babyName: profile.babyName,
        babyAge: profile.babyAgeLabel,
        timeOfDay: getTimePeriod(effectiveHour),
      });
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/companion/live?${params}`);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          const socket = wsRef.current;
          if (!socket || socket.readyState !== WebSocket.OPEN || !isLiveReadyRef.current || isMutedRef.current) return;
          const float32 = event.inputBuffer.getChannelData(0);
          const base64 = float32ToBase64Pcm16(float32);
          socket.send(JSON.stringify({ audio: base64 }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data) as {
          ready?: boolean;
          audio?: string;
          inputTranscript?: string;
          outputTranscript?: string;
          interrupted?: boolean;
          turnComplete?: boolean;
          crisisTriggered?: boolean;
          error?: string;
        };

        if (msg.ready) {
          isLiveReadyRef.current = true;
          setVoiceStatus('live');
          return;
        }

        if (msg.error) {
          setVoiceError(msg.error);
          stopVoiceSession();
          setVoiceStatus('error');
          return;
        }

        if (msg.crisisTriggered) {
          stopVoiceSession();
          onTriggerCrisisLockRef.current();
          return;
        }

        if (msg.interrupted) {
          stopPlaybackQueue();
        }

        if (msg.inputTranscript) {
          if (niaDraftRef.current.trim()) {
            onAppendVoiceMessageRef.current('companion', niaDraftRef.current.trim());
            niaDraftRef.current = '';
            setLiveNiaDraft('');
          }
          userDraftRef.current = `${userDraftRef.current}${msg.inputTranscript}`;
          setLiveUserDraft(userDraftRef.current);
        }

        if (msg.outputTranscript) {
          if (userDraftRef.current.trim()) {
            onAppendVoiceMessageRef.current('user', userDraftRef.current.trim());
            userDraftRef.current = '';
            setLiveUserDraft('');
          }
          niaDraftRef.current = `${niaDraftRef.current}${msg.outputTranscript}`;
          setLiveNiaDraft(niaDraftRef.current);
        }

        if (msg.turnComplete) {
          if (userDraftRef.current.trim()) {
            onAppendVoiceMessageRef.current('user', userDraftRef.current.trim());
            userDraftRef.current = '';
            setLiveUserDraft('');
          }
          if (niaDraftRef.current.trim()) {
            onAppendVoiceMessageRef.current('companion', niaDraftRef.current.trim());
            niaDraftRef.current = '';
            setLiveNiaDraft('');
          }
        }

        if (msg.audio && outputCtxRef.current) {
          const ctx = outputCtxRef.current;
          const buffer = decodeBase64Pcm16ToAudioBuffer(ctx, msg.audio, 24000);
          if (!buffer) return;
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);

          const startAt = Math.max(ctx.currentTime + 0.02, nextStartTimeRef.current);
          source.start(startAt);
          nextStartTimeRef.current = startAt + buffer.duration;
          activeSourcesRef.current.add(source);
          setIsNiaSpeaking(true);

          source.onended = () => {
            activeSourcesRef.current.delete(source);
            if (activeSourcesRef.current.size === 0) {
              setIsNiaSpeaking(false);
            }
          };
        }
      };

      ws.onerror = () => {
        setVoiceError('Could not connect to live voice. Please check your connection.');
        stopVoiceSession();
        setVoiceStatus('error');
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          stopVoiceSession();
        }
      };
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const message =
        name === 'NotAllowedError' || name === 'NotFoundError' || name === 'NotReadableError'
          ? 'Microphone access is needed for voice chat.'
          : err instanceof Error && err.message
          ? err.message
          : 'Could not start microphone for voice chat.';
      setVoiceError(message);
      stopVoiceSession();
      setVoiceStatus('error');
    }
  }, [
    crisisLockActive,
    effectiveHour,
    profile.babyAgeLabel,
    profile.babyName,
    profile.name,
    stopPlaybackQueue,
    stopVoiceSession,
    voiceStatus,
  ]);

  useEffect(() => {
    if (open && startInVoiceMode && !autoStartedRef.current && !crisisLockActive) {
      autoStartedRef.current = true;
      startVoiceSession();
    }
    if (!open) {
      autoStartedRef.current = false;
      if (wsRef.current || voiceStatus === 'connecting' || voiceStatus === 'live') {
        stopVoiceSession();
      }
    }
  }, [open, startInVoiceMode, crisisLockActive, startVoiceSession, stopVoiceSession, voiceStatus]);

  useEffect(() => {
    if (crisisLockActive && (voiceStatus === 'connecting' || voiceStatus === 'live')) {
      stopVoiceSession();
    }
  }, [crisisLockActive, stopVoiceSession, voiceStatus]);

  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, [stopVoiceSession]);

  if (!open) return null;

  const opening = getProactiveCompanionOpening(effectiveHour, profile.name, profile.babyName);
  const isCrisisDraft = detectSelfHarmIntent(draftInput);
  const isVoiceActive = voiceStatus === 'connecting' || voiceStatus === 'live';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draftInput.trim();
    if (!trimmed || crisisLockActive) return;
    if (isSending && !isCrisisDraft) return;
    setDraftInput('');
    onSendMessage(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#221533]/50 backdrop-blur-sm flex items-end sm:items-center justify-end sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Talk to Nia"
    >
      <div className="bg-[#FAF8FC] w-full sm:max-w-lg h-[90vh] sm:h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-[#E4D8F3] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-white px-5 py-4 border-b border-[#EAE2F5] flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#261C35]">Talk to Nia</h2>
            <p className="text-[13px] text-[#685780]">
              Supportive companion · Never diagnoses or gives medical advice
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!crisisLockActive && (
              <button
                type="button"
                onClick={isVoiceActive ? stopVoiceSession : startVoiceSession}
                aria-pressed={isVoiceActive}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-[14px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  isVoiceActive
                    ? 'bg-[#35234E] text-white hover:bg-[#261C35]'
                    : 'bg-[#F4EFFA] text-[#4C3270] hover:bg-[#E7DCF5]'
                }`}
              >
                {isVoiceActive ? (
                  <>
                    <PhoneOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>End voice</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Voice</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onOpenHelp}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#9F1239] hover:bg-[#881337] text-white text-[14px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <LifeBuoy className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Help</span>
            </button>
            <button
              type="button"
              onClick={() => {
                stopVoiceSession();
                onClose();
              }}
              aria-label="Close Talk to Nia"
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[#F5F0FB] hover:bg-[#EAE0F7] text-[#3D2B56] inline-flex items-center justify-center shrink-0"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Live Voice Status Strip */}
        {isVoiceActive && !crisisLockActive && (
          <div className="bg-[#241937] text-white px-5 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {isNiaSpeaking ? (
                <Volume2 className="w-5 h-5 text-[#DEC9FA] shrink-0" aria-hidden="true" />
              ) : (
                <Mic className="w-5 h-5 text-[#DEC9FA] shrink-0" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-[15px] font-semibold truncate">
                  {voiceStatus === 'connecting'
                    ? 'Connecting voice…'
                    : isNiaSpeaking
                    ? 'Nia is speaking'
                    : isMuted
                    ? 'Microphone muted'
                    : 'Listening — speak anytime'}
                </p>
                <p className="text-[13px] text-[#CBB8E8]">
                  Live voice · Speak naturally or interrupt anytime
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMuted((prev) => !prev)}
              aria-pressed={isMuted}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#382754] hover:bg-[#463268] text-[14px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {isMuted ? (
                <>
                  <MicOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Unmute</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Mute</span>
                </>
              )}
            </button>
          </div>
        )}

        {voiceError && (
          <div className="bg-[#FFF4F7] border-b border-[#E7C2CE] px-5 py-2.5 text-[14px] text-[#881337]">
            {voiceError}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} aria-live="polite" className="flex-1 overflow-y-auto p-5 space-y-4">
          {crisisLockActive ? (
            <CrisisResourcesCard
              urgentMode={true}
              onResumeSafeChat={onClearCrisisLock}
            />
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-[#EAE2F5] p-4 space-y-1">
                <p className="text-[13px] font-medium text-[#6D4C94]">Nia</p>
                <p className="text-[16px] text-[#261C35]">{opening.text}</p>
              </div>

              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 space-y-2 ${
                        isUser
                          ? 'bg-[#6D4C94] text-white'
                          : 'bg-white border border-[#E7DFF2] text-[#261C35]'
                      }`}
                    >
                      <p className="text-[16px] leading-relaxed">{msg.text}</p>
                      {msg.tinyStep && (
                        <p className="text-[14px] pt-2 border-t border-[#EAE2F5] text-[#543877]">
                          <strong>Tiny step:</strong> {msg.tinyStep}
                        </p>
                      )}
                    </div>
                    <span className="text-[12px] text-[#7A6992] mt-1 px-1">{msg.timestamp}</span>
                  </div>
                );
              })}

              {liveUserDraft && (
                <div className="flex flex-col items-end">
                  <div className="max-w-[88%] rounded-2xl px-4 py-3 bg-[#6D4C94]/85 text-white">
                    <p className="text-[16px] leading-relaxed">{liveUserDraft}</p>
                  </div>
                </div>
              )}

              {liveNiaDraft && (
                <div className="flex flex-col items-start">
                  <div className="max-w-[88%] rounded-2xl px-4 py-3 bg-white border border-[#E7DFF2] text-[#261C35]">
                    <p className="text-[16px] leading-relaxed">{liveNiaDraft}</p>
                  </div>
                </div>
              )}

              {isSending && (
                <div className="bg-white border border-[#E7DFF2] rounded-2xl px-4 py-3 text-[15px] text-[#5B4C72] self-start">
                  Nia is typing…
                </div>
              )}
            </>
          )}
        </div>

        {/* Input / Quick Moods */}
        {!crisisLockActive && (
          <div className="bg-white border-t border-[#EAE2F5] p-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {MOOD_OPTIONS.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  disabled={isSending}
                  onClick={() => onSendMessage(`I feel ${mood.toLowerCase()} right now.`, mood)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F4EFFA] hover:bg-[#E7DCF5] text-[#432B66] text-[14px] font-medium whitespace-nowrap shrink-0"
                >
                  {mood}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <label htmlFor="nia-drawer-input" className="sr-only">
                Message Nia
              </label>
              <input
                id="nia-drawer-input"
                type="text"
                value={draftInput}
                onChange={(e) => setDraftInput(e.target.value)}
                placeholder="Write anything on your mind..."
                className="flex-1 min-h-[48px] px-4 py-2 rounded-2xl border border-[#D8C9EC] bg-[#FCFAFF] text-[16px] text-[#261C35] focus:outline-none focus:border-[#6D4C94]"
              />
              <button
                type="submit"
                disabled={(!isCrisisDraft && isSending) || !draftInput.trim()}
                aria-label="Send message"
                className="min-h-[48px] px-4 py-2 rounded-2xl bg-[#6D4C94] hover:bg-[#593B7D] disabled:opacity-45 text-white font-semibold inline-flex items-center justify-center shrink-0"
              >
                <Send className="w-5 h-5" aria-hidden="true" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
