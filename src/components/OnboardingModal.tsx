import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Mic,
  MicOff,
  PhoneOff,
  ShieldCheck,
  Volume2,
  X,
} from 'lucide-react';
import { ONBOARDING_GOALS } from '../data/demoData';
import { auth, firebaseProjectId } from '../firebase';
import { saveUserAccountAndProfile } from '../services/userProfileService';
import { OnboardingGoal, OnboardingState, PrivacySettings, SupportGroup } from '../types';
import {
  decodeBase64Pcm16ToAudioBuffer,
  float32ToBase64Pcm16,
} from '../utils/liveAudio';
import { matchGroupsForOnboardingGoals, toggleGoalSelection } from '../utils/supportLogic';

export interface OnboardingCompletionPayload {
  firstName: string;
  babyName: string;
  babyDateInput: string;
  babyDateLabel: string;
  selectedGoals: OnboardingGoal[];
  privacy: PrivacySettings;
  accountEmail?: string | null;
}

interface OnboardingModalProps {
  open: boolean;
  initialState: OnboardingState;
  initialPrivacy: PrivacySettings;
  groups: SupportGroup[];
  currentUserEmail: string | null;
  initialStep?: 1 | 2 | 3 | 4 | 5;
  onClose: () => void;
  onComplete: (payload: OnboardingCompletionPayload) => void;
  onCrisisDetected?: () => void;
}

type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error';

interface OnboardingPatch {
  firstName?: string;
  babyName?: string;
  babyDateInput?: string;
  selectedGoals?: string[];
  shareCheckIns?: boolean;
  shareAppointments?: boolean;
  shareWithOB?: boolean;
  shareWithTherapist?: boolean;
  shareWithPartner?: boolean;
  expiryOption?: PrivacySettings['expiryOption'];
  anonymousInCommunity?: boolean;
  completeSignup?: boolean;
}

function normalizeGoals(rawGoals?: string[]): OnboardingGoal[] {
  if (!Array.isArray(rawGoals)) return [];
  const matched: OnboardingGoal[] = [];
  for (const item of rawGoals) {
    const lower = String(item).toLowerCase().trim();
    const found = ONBOARDING_GOALS.find(
      (g) =>
        g.toLowerCase() === lower ||
        g.toLowerCase().includes(lower) ||
        lower.includes(g.toLowerCase())
    );
    if (found && !matched.includes(found)) {
      matched.push(found);
    }
    if (matched.length >= 2) break;
  }
  return matched;
}

function formatAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Switch to "Sign in" below to log in.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Please choose a password with at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password did not match. Please double-check and try again.';
    case 'auth/operation-not-allowed':
      return `Email & Password sign-up needs to be enabled in Firebase Console (${firebaseProjectId} → Authentication → Sign-in method → Email/Password), or use Continue with Google below.`;
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before finishing.';
    default:
      return err instanceof Error && err.message
        ? err.message
        : 'Could not complete account setup right now. Please try again.';
  }
}

export function OnboardingModal({
  open,
  initialState,
  initialPrivacy,
  groups,
  currentUserEmail,
  initialStep = 1,
  onClose,
  onComplete,
  onCrisisDetected,
}: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(initialStep);
  const [firstName, setFirstName] = useState(initialState.firstName || 'Maya');
  const [babyName, setBabyName] = useState(initialState.babyName || 'Leo');
  const [babyDateInput, setBabyDateInput] = useState(initialState.babyDateInput || '2026-08-13');
  const [selectedGoals, setSelectedGoals] = useState<OnboardingGoal[]>(
    initialState.selectedGoals.length > 0
      ? initialState.selectedGoals
      : ['Sleep', 'Finding my people']
  );
  const [privacy, setPrivacy] = useState<PrivacySettings>(initialPrivacy);

  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState(currentUserEmail ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isNiaSpeaking, setIsNiaSpeaking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(false);
  const isLiveReadyRef = useRef<boolean>(false);

  const firstNameRef = useRef(firstName);
  const babyNameRef = useRef(babyName);
  const babyDateRef = useRef(babyDateInput);
  const goalsRef = useRef(selectedGoals);
  const privacyRef = useRef(privacy);
  const onCompleteRef = useRef(onComplete);
  const onCloseRef = useRef(onClose);
  const onCrisisRef = useRef(onCrisisDetected);

  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setFirstName(initialState.firstName || 'Maya');
      setBabyName(initialState.babyName || 'Leo');
      setBabyDateInput(initialState.babyDateInput || '2026-08-13');
      setSelectedGoals(
        initialState.selectedGoals.length > 0
          ? initialState.selectedGoals
          : ['Sleep', 'Finding my people']
      );
      setPrivacy(initialPrivacy);
      setEmail(currentUserEmail ?? '');
      setPassword('');
      setAuthError(null);
      setAuthLoading(false);
    }
  }, [
    open,
    initialStep,
    initialState.firstName,
    initialState.babyName,
    initialState.babyDateInput,
    initialState.selectedGoals,
    initialPrivacy,
    currentUserEmail,
  ]);

  useEffect(() => {
    firstNameRef.current = firstName;
  }, [firstName]);

  useEffect(() => {
    babyNameRef.current = babyName;
  }, [babyName]);

  useEffect(() => {
    babyDateRef.current = babyDateInput;
  }, [babyDateInput]);

  useEffect(() => {
    goalsRef.current = selectedGoals;
  }, [selectedGoals]);

  useEffect(() => {
    privacyRef.current = privacy;
  }, [privacy]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onCrisisRef.current = onCrisisDetected;
  }, [onCrisisDetected]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

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
    setLiveTranscript('');
  }, [stopPlaybackQueue]);

  const buildCleanedValues = useCallback(
    (overrides?: {
      firstName?: string;
      babyName?: string;
      babyDateInput?: string;
      selectedGoals?: OnboardingGoal[];
      privacy?: PrivacySettings;
    }) => {
      const cleanName = (overrides?.firstName ?? firstNameRef.current).trim() || 'Maya';
      const cleanBabyName = (overrides?.babyName ?? babyNameRef.current).trim() || 'Baby';
      const cleanDate = (overrides?.babyDateInput ?? babyDateRef.current).trim() || '2026-08-13';
      const cleanGoals =
        overrides?.selectedGoals && overrides.selectedGoals.length > 0
          ? overrides.selectedGoals
          : goalsRef.current.length > 0
          ? goalsRef.current
          : (['Sleep', 'Finding my people'] as OnboardingGoal[]);
      const cleanPrivacy = overrides?.privacy ?? privacyRef.current;

      const label =
        cleanDate === '2026-08-13'
          ? `${cleanBabyName} · 3 months old (Aug 13, 2026)`
          : `${cleanBabyName} · ${cleanDate}`;

      return {
        cleanName,
        cleanBabyName,
        cleanDate,
        cleanGoals,
        cleanPrivacy,
        label,
      };
    },
    []
  );

  const finishOnboardingDemo = useCallback(
    (accountEmail?: string | null) => {
      stopVoiceSession();
      const { cleanName, cleanBabyName, cleanDate, cleanGoals, cleanPrivacy, label } =
        buildCleanedValues();

      onCompleteRef.current({
        firstName: cleanName,
        babyName: cleanBabyName,
        babyDateInput: cleanDate,
        babyDateLabel: label,
        selectedGoals: cleanGoals,
        privacy: cleanPrivacy,
        accountEmail: accountEmail ?? null,
      });
      setStep(1);
    },
    [buildCleanedValues, stopVoiceSession]
  );

  const startVoiceSession = useCallback(async () => {
    if (wsRef.current || voiceStatus === 'connecting' || voiceStatus === 'live') return;

    setVoiceError(null);
    setVoiceStatus('connecting');
    setLiveTranscript('');

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
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/onboarding/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          const socket = wsRef.current;
          if (!socket || socket.readyState !== WebSocket.OPEN || !isLiveReadyRef.current || isMutedRef.current) {
            return;
          }
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
          onboardingPatch?: OnboardingPatch;
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
          onCloseRef.current();
          onCrisisRef.current?.();
          return;
        }

        if (msg.interrupted) {
          stopPlaybackQueue();
        }

        if (msg.inputTranscript) {
          setLiveTranscript(msg.inputTranscript.trim());
        } else if (msg.outputTranscript) {
          setLiveTranscript(msg.outputTranscript.trim());
        }

        if (msg.onboardingPatch) {
          const patch = msg.onboardingPatch;

          if (patch.firstName && patch.firstName.trim()) {
            setFirstName(patch.firstName.trim());
            setStep((curr) => (curr === 1 ? 2 : curr));
          }
          if (patch.babyName && patch.babyName.trim()) {
            setBabyName(patch.babyName.trim());
            setStep((curr) => (curr < 2 ? 2 : curr));
          }
          if (patch.babyDateInput && /^\d{4}-\d{2}-\d{2}$/.test(patch.babyDateInput.trim())) {
            setBabyDateInput(patch.babyDateInput.trim());
            setStep((curr) => (curr < 3 ? 3 : curr));
          }
          if (patch.selectedGoals && patch.selectedGoals.length > 0) {
            const normalized = normalizeGoals(patch.selectedGoals);
            if (normalized.length > 0) {
              setSelectedGoals(normalized);
              setStep((curr) => (curr < 4 ? 4 : curr));
            }
          }

          if (
            typeof patch.shareCheckIns === 'boolean' ||
            typeof patch.shareAppointments === 'boolean' ||
            typeof patch.shareWithOB === 'boolean' ||
            typeof patch.shareWithTherapist === 'boolean' ||
            typeof patch.shareWithPartner === 'boolean' ||
            typeof patch.anonymousInCommunity === 'boolean' ||
            patch.expiryOption
          ) {
            setPrivacy((prev) => ({
              ...prev,
              ...(typeof patch.shareCheckIns === 'boolean'
                ? { shareCheckIns: patch.shareCheckIns }
                : {}),
              ...(typeof patch.shareAppointments === 'boolean'
                ? { shareAppointments: patch.shareAppointments }
                : {}),
              ...(typeof patch.shareWithOB === 'boolean'
                ? { shareWithOB: patch.shareWithOB }
                : {}),
              ...(typeof patch.shareWithTherapist === 'boolean'
                ? { shareWithTherapist: patch.shareWithTherapist }
                : {}),
              ...(typeof patch.shareWithPartner === 'boolean'
                ? { shareWithPartner: patch.shareWithPartner }
                : {}),
              ...(typeof patch.anonymousInCommunity === 'boolean'
                ? { anonymousInCommunity: patch.anonymousInCommunity }
                : {}),
              ...(patch.expiryOption ? { expiryOption: patch.expiryOption } : {}),
            }));
          }

          if (patch.completeSignup) {
            stopVoiceSession();
            setStep(5);
            return;
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
        setVoiceError('Could not connect to voice sign-up. You can type or tap below.');
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
          ? 'Microphone access is needed for voice sign-up.'
          : err instanceof Error && err.message
          ? err.message
          : 'Could not start microphone for voice sign-up.';
      setVoiceError(message);
      stopVoiceSession();
      setVoiceStatus('error');
    }
  }, [stopPlaybackQueue, stopVoiceSession, voiceStatus]);

  useEffect(() => {
    if (!open) {
      stopVoiceSession();
    }
  }, [open, stopVoiceSession]);

  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, [stopVoiceSession]);

  if (!open) return null;

  const isVoiceActive = voiceStatus === 'connecting' || voiceStatus === 'live';

  const handleGoalTap = (goal: OnboardingGoal) => {
    setSelectedGoals((prev) => toggleGoalSelection(prev, goal, 2));
  };

  const persistForUser = async (uid: string, userEmail: string) => {
    const { cleanName, cleanBabyName, cleanDate, cleanGoals, cleanPrivacy, label } =
      buildCleanedValues();
    const suggestedGroupIds = matchGroupsForOnboardingGoals(groups, cleanGoals);

    await saveUserAccountAndProfile({
      uid,
      email: userEmail,
      firstName: cleanName,
      babyName: cleanBabyName,
      babyDateInput: cleanDate,
      babyDateLabel: label,
      selectedGoals: cleanGoals,
      suggestedGroupIds,
      privacy: cleanPrivacy,
    });

    stopVoiceSession();
    onCompleteRef.current({
      firstName: cleanName,
      babyName: cleanBabyName,
      babyDateInput: cleanDate,
      babyDateLabel: label,
      selectedGoals: cleanGoals,
      privacy: cleanPrivacy,
      accountEmail: userEmail,
    });
    setStep(1);
  };

  const handleAccountSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const activeUser = auth.currentUser;
    if (activeUser && currentUserEmail) {
      setAuthLoading(true);
      try {
        await persistForUser(activeUser.uid, activeUser.email ?? currentUserEmail);
      } catch (err) {
        setAuthError(formatAuthError(err));
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setAuthError('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Please enter a password with at least 6 characters.');
      return;
    }

    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const cleanName = firstName.trim() || 'Maya';
        try {
          await updateProfile(cred.user, { displayName: cleanName });
        } catch {
          // Non-fatal if displayName update fails
        }
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Non-fatal if verification email is throttled
        }
        await persistForUser(cred.user.uid, cred.user.email ?? cleanEmail);
      } else {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        await persistForUser(cred.user.uid, cred.user.email ?? cleanEmail);
      }
    } catch (err) {
      setAuthError(formatAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await persistForUser(cred.user.uid, cred.user.email ?? '');
    } catch (err) {
      setAuthError(formatAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const sharedWithLabels = [
    privacy.shareWithOB ? 'OB/Midwife' : null,
    privacy.shareWithTherapist ? 'Therapist' : null,
    privacy.shareWithPartner ? 'Partner' : null,
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#221533]/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="60-second setup and account creation with Nia"
    >
      <div className="bg-white w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[#E4D8F3] p-6 space-y-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-[13px] font-medium text-[#6D4C94] tabular-nums">
              Quick setup · Step {step} of 5
            </p>
            <h2 className="font-display text-2xl font-semibold text-[#261C35]">
              {step === 5 ? 'Save your MomLink account' : 'Hi, I’m Nia'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {step < 5 && (
              <button
                type="button"
                onClick={isVoiceActive ? stopVoiceSession : startVoiceSession}
                aria-pressed={isVoiceActive}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-[14px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  isVoiceActive
                    ? 'bg-[#35234E] text-white hover:bg-[#261C35]'
                    : 'bg-[#EAE0F7] text-[#3F2761] hover:bg-[#DDD0F2]'
                }`}
              >
                {isVoiceActive ? (
                  <>
                    <PhoneOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Stop voice</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Speak to sign up</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stopVoiceSession();
                onClose();
              }}
              aria-label="Close setup"
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[#F7F3FC] hover:bg-[#ECE2F8] text-[#3E2D58] inline-flex items-center justify-center shrink-0"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Live Voice Sign-Up Banner */}
        {isVoiceActive && (
          <div className="rounded-2xl bg-[#241937] text-white p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {isNiaSpeaking ? (
                  <Volume2 className="w-5 h-5 text-[#DEC9FA] shrink-0" aria-hidden="true" />
                ) : (
                  <Mic className="w-5 h-5 text-[#DEC9FA] shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold truncate">
                    {voiceStatus === 'connecting'
                      ? 'Connecting voice sign-up…'
                      : isNiaSpeaking
                      ? 'Nia is speaking…'
                      : isMuted
                      ? 'Microphone muted'
                      : 'Listening — speak your answers'}
                  </p>
                  <p className="text-[12px] text-[#CBB8E8] truncate">
                    Fields fill automatically as you talk
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMuted((prev) => !prev)}
                aria-pressed={isMuted}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#382754] hover:bg-[#463268] text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {isMuted ? (
                  <>
                    <MicOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Unmute</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Mute</span>
                  </>
                )}
              </button>
            </div>

            {liveTranscript && (
              <p className="text-[13px] text-[#EDE5FA] bg-[#34244F] rounded-xl px-3 py-2">
                {liveTranscript}
              </p>
            )}
          </div>
        )}

        {voiceError && (
          <div className="rounded-2xl bg-[#FFF4F7] border border-[#E7C2CE] px-4 py-2.5 text-[14px] text-[#881337]">
            {voiceError}
          </div>
        )}

        <form onSubmit={handleAccountSubmit} className="space-y-5">
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-[#FAF7FE] rounded-2xl p-4 text-[17px] text-[#35264B]">
                What’s your first name?
              </div>
              <div>
                <label htmlFor="onboard-first-name" className="sr-only">
                  First name
                </label>
                <input
                  id="onboard-first-name"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl border border-[#D8C9EC] bg-[#FCFAFF] text-[17px] text-[#261C35]"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!firstName.trim()}
                  onClick={() => setStep(2)}
                  className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-[#6D4C94] hover:bg-[#593B7D] disabled:opacity-50 text-white font-semibold text-[16px] inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-[#FAF7FE] rounded-2xl p-4 text-[17px] text-[#35264B]">
                Nice to meet you, {firstName}. What’s your baby’s name and birthday (or due date)?
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="onboard-baby-name"
                    className="block text-[14px] font-medium text-[#5B4C72]"
                  >
                    Baby’s name (or nickname)
                  </label>
                  <input
                    id="onboard-baby-name"
                    type="text"
                    value={babyName}
                    onChange={(e) => setBabyName(e.target.value)}
                    placeholder="e.g. Leo (optional if expecting)"
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl border border-[#D8C9EC] bg-[#FCFAFF] text-[17px] text-[#261C35]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="onboard-baby-date"
                    className="block text-[14px] font-medium text-[#5B4C72]"
                  >
                    Due date or baby’s birthday
                  </label>
                  <input
                    id="onboard-baby-date"
                    type="date"
                    required
                    value={babyDateInput}
                    onChange={(e) => setBabyDateInput(e.target.value)}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl border border-[#D8C9EC] bg-[#FCFAFF] text-[17px] text-[#261C35]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#F5F0FB] text-[#453261] font-semibold text-[16px]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-[#6D4C94] hover:bg-[#593B7D] text-white font-semibold text-[16px] inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-[#FAF7FE] rounded-2xl p-4 text-[17px] text-[#35264B]">
                What would help most right now? Pick up to 2.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ONBOARDING_GOALS.map((goal) => {
                  const active = selectedGoals.includes(goal);
                  return (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => handleGoalTap(goal)}
                      aria-pressed={active}
                      className={`min-h-[48px] px-4 py-2.5 rounded-2xl text-left font-semibold text-[15px] inline-flex items-center justify-between gap-2 transition-colors ${
                        active
                          ? 'bg-[#6D4C94] text-white'
                          : 'bg-[#F6F1FC] text-[#35264B] hover:bg-[#EAE0F7]'
                      }`}
                    >
                      <span>{goal}</span>
                      {active && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#F5F0FB] text-[#453261] font-semibold text-[16px]"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={selectedGoals.length === 0}
                  onClick={() => setStep(4)}
                  className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-[#6D4C94] hover:bg-[#593B7D] disabled:opacity-50 text-white font-semibold text-[16px] inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <span>Next: Privacy</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-[#FAF7FE] rounded-2xl p-4 space-y-1">
                <p className="text-[16px] font-semibold text-[#261C35] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#6D4C94] shrink-0" aria-hidden="true" />
                  <span>Choose your Privacy center settings</span>
                </p>
                <p className="text-[14px] text-[#5B4C72] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#6D4C94] shrink-0" aria-hidden="true" />
                  <span>Health data is never sold or shared without consent.</span>
                </p>
              </div>

              <div className="rounded-2xl border border-[#E7DFF2] p-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-[#6D4C94]">
                    What can be shared
                  </p>
                  <label className="flex items-center justify-between py-1 cursor-pointer">
                    <span className="text-[15px] text-[#35264B]">Check-in & EPDS scores</span>
                    <input
                      type="checkbox"
                      checked={privacy.shareCheckIns}
                      onChange={(e) =>
                        setPrivacy((prev) => ({ ...prev, shareCheckIns: e.target.checked }))
                      }
                      className="w-5 h-5 accent-[#6D4C94]"
                    />
                  </label>
                  <label className="flex items-center justify-between py-1 cursor-pointer">
                    <span className="text-[15px] text-[#35264B]">Appointments</span>
                    <input
                      type="checkbox"
                      checked={privacy.shareAppointments}
                      onChange={(e) =>
                        setPrivacy((prev) => ({ ...prev, shareAppointments: e.target.checked }))
                      }
                      className="w-5 h-5 accent-[#6D4C94]"
                    />
                  </label>
                </div>

                <div className="space-y-2 pt-3 border-t border-[#ECE4F6]">
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-[#6D4C94]">
                    Who can see it
                  </p>
                  <label className="flex items-center justify-between py-1 cursor-pointer">
                    <span className="text-[15px] text-[#35264B]">OB / Midwife</span>
                    <input
                      type="checkbox"
                      checked={privacy.shareWithOB}
                      onChange={(e) =>
                        setPrivacy((prev) => ({ ...prev, shareWithOB: e.target.checked }))
                      }
                      className="w-5 h-5 accent-[#6D4C94]"
                    />
                  </label>
                  <label className="flex items-center justify-between py-1 cursor-pointer">
                    <span className="text-[15px] text-[#35264B]">Therapist</span>
                    <input
                      type="checkbox"
                      checked={privacy.shareWithTherapist}
                      onChange={(e) =>
                        setPrivacy((prev) => ({ ...prev, shareWithTherapist: e.target.checked }))
                      }
                      className="w-5 h-5 accent-[#6D4C94]"
                    />
                  </label>
                  <label className="flex items-center justify-between py-1 cursor-pointer">
                    <span className="text-[15px] text-[#35264B]">Partner (Jordan)</span>
                    <input
                      type="checkbox"
                      checked={privacy.shareWithPartner}
                      onChange={(e) =>
                        setPrivacy((prev) => ({ ...prev, shareWithPartner: e.target.checked }))
                      }
                      className="w-5 h-5 accent-[#6D4C94]"
                    />
                  </label>
                </div>

                <div className="space-y-3 pt-3 border-t border-[#ECE4F6]">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="onboard-privacy-expiry" className="text-[15px] text-[#35264B]">
                      Optional expiry
                    </label>
                    <select
                      id="onboard-privacy-expiry"
                      value={privacy.expiryOption}
                      onChange={(e) =>
                        setPrivacy((prev) => ({
                          ...prev,
                          expiryOption: e.target.value as PrivacySettings['expiryOption'],
                        }))
                      }
                      className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[14px]"
                    >
                      <option value="30 days">30 days</option>
                      <option value="90 days">90 days</option>
                      <option value="Until revoked">Until revoked</option>
                    </select>
                  </div>

                  <label className="flex items-center justify-between py-1 cursor-pointer">
                    <span className="text-[15px] text-[#35264B]">
                      Anonymous by default in Community
                    </span>
                    <input
                      type="checkbox"
                      checked={privacy.anonymousInCommunity}
                      onChange={(e) =>
                        setPrivacy((prev) => ({
                          ...prev,
                          anonymousInCommunity: e.target.checked,
                        }))
                      }
                      className="w-5 h-5 accent-[#6D4C94]"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#F5F0FB] text-[#453261] font-semibold text-[16px]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopVoiceSession();
                    setStep(5);
                  }}
                  className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-[#6D4C94] hover:bg-[#593B7D] text-white font-semibold text-[16px] inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <span>Next: Account</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              {/* Compact summary of selected Privacy Center settings */}
              <div className="rounded-2xl bg-[#FAF7FE] border border-[#E7DFF2] px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#4E3670]">
                    Privacy settings ready to save
                  </p>
                  <p className="text-[13px] text-[#5B4C72] truncate">
                    {privacy.anonymousInCommunity ? 'Anonymous in Community' : 'Named in Community'} ·{' '}
                    {sharedWithLabels.length > 0
                      ? `Share with ${sharedWithLabels.join(', ')}`
                      : 'Private (no sharing)'}{' '}
                    · {privacy.expiryOption}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="text-[13px] font-semibold text-[#6D4C94] hover:underline whitespace-nowrap shrink-0"
                >
                  Edit
                </button>
              </div>

              {currentUserEmail && auth.currentUser ? (
                <div className="rounded-2xl border border-[#D8C9EC] bg-[#FCFAFF] p-4 space-y-1">
                  <p className="text-[14px] font-semibold text-[#261C35]">
                    Signed in as {currentUserEmail}
                  </p>
                  <p className="text-[13px] text-[#5B4C72]">
                    Your profile and privacy center preferences will update in your account.
                  </p>
                </div>
              ) : (
                <>
                  {/* Create account vs Sign in toggle */}
                  <div
                    role="tablist"
                    aria-label="Account mode"
                    className="grid grid-cols-2 gap-1 bg-[#F4EFFA] p-1 rounded-2xl"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authMode === 'signup'}
                      onClick={() => {
                        setAuthMode('signup');
                        setAuthError(null);
                      }}
                      className={`min-h-[42px] rounded-xl text-[14px] font-semibold transition-colors ${
                        authMode === 'signup'
                          ? 'bg-white text-[#261C35] shadow-xs'
                          : 'text-[#5B4C72] hover:text-[#261C35]'
                      }`}
                    >
                      Create account
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authMode === 'signin'}
                      onClick={() => {
                        setAuthMode('signin');
                        setAuthError(null);
                      }}
                      className={`min-h-[42px] rounded-xl text-[14px] font-semibold transition-colors ${
                        authMode === 'signin'
                          ? 'bg-white text-[#261C35] shadow-xs'
                          : 'text-[#5B4C72] hover:text-[#261C35]'
                      }`}
                    >
                      Sign in
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="onboard-email"
                        className="block text-[14px] font-medium text-[#5B4C72]"
                      >
                        Email address
                      </label>
                      <div className="relative">
                        <Mail
                          className="w-4 h-4 text-[#7B6994] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          id="onboard-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-2xl border border-[#D8C9EC] bg-[#FCFAFF] text-[16px] text-[#261C35]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="onboard-password"
                        className="block text-[14px] font-medium text-[#5B4C72]"
                      >
                        {authMode === 'signup' ? 'Create a password (6+ characters)' : 'Password'}
                      </label>
                      <div className="relative">
                        <Lock
                          className="w-4 h-4 text-[#7B6994] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          id="onboard-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full min-h-[48px] pl-10 pr-12 py-2.5 rounded-2xl border border-[#D8C9EC] bg-[#FCFAFF] text-[16px] text-[#261C35]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="min-h-[40px] min-w-[40px] absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl text-[#5B4C72] hover:bg-[#EFE7FA] inline-flex items-center justify-center"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {authError && (
                <div
                  role="alert"
                  className="rounded-2xl bg-[#FFF4F7] border border-[#E7C2CE] px-4 py-3 text-[14px] text-[#881337]"
                >
                  {authError}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => setStep(4)}
                  className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#F5F0FB] text-[#453261] font-semibold text-[16px]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="flex-1 min-h-[48px] px-5 py-2.5 rounded-2xl bg-[#6D4C94] hover:bg-[#593B7D] disabled:opacity-50 text-white font-semibold text-[16px] whitespace-nowrap"
                >
                  {authLoading
                    ? 'Saving account…'
                    : currentUserEmail && auth.currentUser
                    ? 'Save & set up Home'
                    : authMode === 'signup'
                    ? 'Create account & set up Home'
                    : 'Sign in & set up Home'}
                </button>
              </div>

              {!(currentUserEmail && auth.currentUser) && (
                <div className="space-y-2.5 pt-2 border-t border-[#EFE9F8]">
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={handleGoogleSignIn}
                    className="w-full min-h-[46px] px-4 py-2 rounded-2xl bg-white hover:bg-[#FAF7FE] border border-[#D8C9EC] text-[#261C35] font-semibold text-[15px]"
                  >
                    Continue with Google
                  </button>

                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={() => finishOnboardingDemo(null)}
                    title="Demo preview without creating an account"
                    className="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 border-2 border-dotted border-gray-400 font-semibold text-[14px]"
                  >
                    Preview without account (demo)
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
