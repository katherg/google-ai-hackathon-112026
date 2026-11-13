import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, sendEmailVerification, signOut, type User } from 'firebase/auth';
import {
  CalendarHeart,
  HeartHandshake,
  Home,
  LifeBuoy,
  UserRound,
  Users,
} from 'lucide-react';
import { INITIAL_APP_STATE } from './data/demoData';
import { auth } from './firebase';
import {
  loadUserProfile,
  sanitizeNiaInsights,
  saveNiaInsights,
  savePrivacyPreferences,
} from './services/userProfileService';
import {
  AppState,
  AssistantTodoItem,
  CalendarEvent,
  CareSubTab,
  ChatMessage,
  CheckInEntry,
  FeedLogEntry,
  MayaProfile,
  MoodOption,
  PrivacySettings,
  SupportCircleMember,
  SupportCircleTask,
  TabId,
  TherapistItem,
  TimeOverrideMode,
  UberRideDraft,
} from './types';
import {
  EpdsEvaluationResult,
  applyAgentActionDecision,
  detectSelfHarmIntent,
  getSuggestedTinyStepForMood,
  getTimePeriod,
  matchGroupsForOnboardingGoals,
  resolveEffectiveHour,
} from './utils/supportLogic';
import { TodayScreen } from './components/TodayScreen';
import { CommunityScreen } from './components/CommunityScreen';
import { CareScreen } from './components/CareScreen';
import { MeScreen } from './components/MeScreen';
import { HelpModal } from './components/HelpModal';
import {
  OnboardingCompletionPayload,
  OnboardingModal,
} from './components/OnboardingModal';
import { TalkToNiaDrawer } from './components/TalkToNiaDrawer';
import { GlobalNiaPopup } from './components/GlobalNiaPopup';

const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-morning-proactive',
    sender: 'companion',
    text: 'Good morning, Maya. How are you feeling today with Leo?',
    timestamp: 'Today · 8:15 AM',
    proactiveWindow: 'morning',
  },
];

const NAV_ITEMS: { id: TabId; label: string; Icon: typeof Home }[] = [
  { id: TabId.Today, label: 'Home', Icon: Home },
  { id: TabId.Community, label: 'Community', Icon: Users },
  { id: TabId.Care, label: 'Care', Icon: CalendarHeart },
  { id: TabId.Me, label: 'Me', Icon: UserRound },
];

function extractClientVoiceInsight(text: string): string | null {
  const lower = text.toLowerCase();
  const patterns: [RegExp, string][] = [
    [/\b(c-?section|cesarean|incision)\b/i, 'Healing from a C-section birth; prioritizing gentle lifting and rest'],
    [/\b(pelvic|sore|stitches|tear)\b/i, 'Focusing on pelvic floor and physical healing pacing'],
    [/\b(back|shoulder|neck|wrist)\s+(pain|ache|tension|sore|stiff)/i, 'Experiencing carrying tension in shoulders, neck, or back'],
    [/\b(pump(ing)?|latch|milk|breastfeed|nursing)\b/i, 'Navigating feeding and pumping routines alongside rest'],
    [/\b(tea|coffee|walk|music|journal|bath|shower)\b/i, 'Finds short calming rituals (walks, warm drinks, or music) restorative'],
    [/\b(partner|husband|wife|mom|mother|sister|friend)\b/i, 'Coordinating support stretches with family or close helpers'],
  ];
  for (const [pattern, fact] of patterns) {
    if (pattern.test(lower)) return fact;
  }
  return null;
}

function moodToIndex(mood: MoodOption): number {
  switch (mood) {
    case 'Hopeful':
      return 5;
    case 'Okay':
      return 4;
    case 'Tired':
      return 3;
    case 'Anxious':
    case 'Overwhelmed':
      return 2;
    case 'Sad':
      return 1;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(TabId.Today);
  const [careSubTab, setCareSubTab] = useState<CareSubTab>('find_care');

  const [appState, setAppState] = useState<AppState>(INITIAL_APP_STATE);
  const [timeMode, setTimeMode] = useState<TimeOverrideMode>('live');
  const [liveClockDate, setLiveClockDate] = useState<Date>(() => new Date());

  const [todayCheckIn, setTodayCheckIn] = useState<CheckInEntry | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const [niaOpen, setNiaOpen] = useState(false);
  const [niaStartInVoice, setNiaStartInVoice] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [crisisLockActive, setCrisisLockActive] = useState(false);

  const handleOpenNia = useCallback((startVoice = false) => {
    setNiaStartInVoice(startVoice);
    setNiaOpen(true);
  }, []);

  const appendNiaInsight = useCallback((fact?: string | null) => {
    const clean = fact?.trim();
    if (!clean) return;
    setAppState((prev) => {
      const nextInsights = sanitizeNiaInsights([clean, ...prev.profile.niaInsights]);
      if (auth.currentUser) {
        void saveNiaInsights(auth.currentUser.uid, nextInsights).catch((err) => {
          console.error('Could not persist Nia insight:', err);
        });
      }
      return {
        ...prev,
        profile: {
          ...prev.profile,
          niaInsights: nextInsights,
        },
      };
    });
  }, []);

  const handleRemoveNiaInsight = useCallback((insightToRemove: string) => {
    setAppState((prev) => {
      const nextInsights = prev.profile.niaInsights.filter((item) => item !== insightToRemove);
      if (auth.currentUser) {
        void saveNiaInsights(auth.currentUser.uid, nextInsights).catch((err) => {
          console.error('Could not persist Nia insight removal:', err);
        });
      }
      return {
        ...prev,
        profile: {
          ...prev.profile,
          niaInsights: nextInsights,
        },
      };
    });
  }, []);

  const handleAppendVoiceMessage = useCallback(
    (sender: 'user' | 'companion', text: string) => {
      if (sender === 'user') {
        const extracted = extractClientVoiceInsight(text);
        if (extracted) {
          appendNiaInsight(extracted);
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          sender,
          text,
          timestamp: 'Voice · Just now',
        },
      ]);
    },
    [appendNiaInsight]
  );

  const handleTriggerCrisisLock = useCallback(() => {
    setCrisisLockActive(true);
  }, []);

  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [helpWarmHandoffMode, setHelpWarmHandoffMode] = useState(false);
  const [highlightedHelpTierIds, setHighlightedHelpTierIds] = useState<string[]>([]);

  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [authUser, setAuthUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (!user) return;
      try {
        const persisted = await loadUserProfile(user.uid);
        if (!persisted) return;
        setAppState((prev) => ({
          ...prev,
          profile: {
            ...prev.profile,
            name: persisted.firstName,
            babyName: persisted.babyName,
            niaInsights: persisted.niaInsights ?? prev.profile.niaInsights,
          },
          privacy: persisted.privacy,
          onboarding: {
            completed: persisted.completed,
            firstName: persisted.firstName,
            babyName: persisted.babyName,
            babyDateInput: persisted.babyDateInput,
            babyDateLabel: persisted.babyDateLabel,
            selectedGoals: persisted.selectedGoals,
            suggestedGroupIds:
              persisted.suggestedGroupIds.length > 0
                ? persisted.suggestedGroupIds
                : matchGroupsForOnboardingGoals(prev.groups, persisted.selectedGoals),
          },
        }));
      } catch (err) {
        console.error('Could not load saved profile:', err);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveClockDate(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const effectiveHour = resolveEffectiveHour(timeMode, liveClockDate);

  useEffect(() => {
    if (getTimePeriod(effectiveHour) === 'late_night') {
      setMessages((prev) => {
        if (prev.some((m) => m.id === 'msg-late-night-proactive')) {
          return prev;
        }
        return [
          ...prev,
          {
            id: 'msg-late-night-proactive',
            sender: 'companion',
            text: "Can't sleep? I'm here. Up for a feed with Leo, or want company?",
            timestamp: '2:05 AM',
            proactiveWindow: 'late_night',
          },
        ];
      });
    }
  }, [effectiveHour]);

  const handleNavigateTab = (tab: TabId, nextCareSubTab?: CareSubTab) => {
    setActiveTab(tab);
    if (nextCareSubTab) {
      setCareSubTab(nextCareSubTab);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenStandardHelp = () => {
    setHelpWarmHandoffMode(false);
    setHighlightedHelpTierIds([]);
    setHelpModalOpen(true);
  };

  const handleOpenWarmHandoffHelp = (recommendedTierIds: string[]) => {
    setHelpWarmHandoffMode(true);
    setHighlightedHelpTierIds(recommendedTierIds);
    setHelpModalOpen(true);
  };

  const handleOpenOnboarding = (step: 1 | 2 | 3 | 4 | 5 = 1) => {
    setOnboardingInitialStep(step);
    setOnboardingModalOpen(true);
  };

  const handleCompleteOnboarding = (payload: OnboardingCompletionPayload) => {
    setAppState((prev) => {
      const suggestedGroupIds = matchGroupsForOnboardingGoals(
        prev.groups,
        payload.selectedGoals
      );
      return {
        ...prev,
        profile: {
          ...prev.profile,
          name: payload.firstName,
          babyName: payload.babyName,
        },
        privacy: payload.privacy,
        onboarding: {
          completed: true,
          firstName: payload.firstName,
          babyName: payload.babyName,
          babyDateInput: payload.babyDateInput,
          babyDateLabel: payload.babyDateLabel,
          selectedGoals: payload.selectedGoals,
          suggestedGroupIds,
        },
      };
    });
    setOnboardingModalOpen(false);
    setActiveTab(TabId.Today);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleJoinAwakeRoom = () => {
    setAppState((prev) => {
      const nextJoined = !prev.peerAwakeRoom.joinedRoom;
      return {
        ...prev,
        peerAwakeRoom: {
          ...prev.peerAwakeRoom,
          joinedRoom: nextJoined,
          awakeCount: nextJoined ? 4 : 3,
        },
      };
    });
  };

  const handleSendGentleWave = () => {
    setAppState((prev) => ({
      ...prev,
      peerAwakeRoom: {
        ...prev.peerAwakeRoom,
        gentleWavesSent: prev.peerAwakeRoom.gentleWavesSent + 1,
      },
    }));
  };

  const handleSubmitThreeMonthEpds = (
    _answers: number[],
    evaluation: EpdsEvaluationResult
  ) => {
    setAppState((prev) => ({
      ...prev,
      epdsCheckpoints: prev.epdsCheckpoints.map((cp) =>
        cp.id === '3m'
          ? {
              ...cp,
              status: evaluation.flagged ? 'flagged' : 'completed',
              completedDate: evaluation.flagged
                ? `Flagged (${evaluation.totalScore}/30)`
                : `Score ${evaluation.totalScore}/30`,
              totalScore: evaluation.totalScore,
              selfHarmItemPositive: evaluation.urgentCrisisEscalation,
            }
          : cp
      ),
    }));
  };

  const handleShareEpdsWithProvider = () => {
    setAppState((prev) => ({
      ...prev,
      epdsCheckpoints: prev.epdsCheckpoints.map((cp) =>
        cp.id === '3m'
          ? {
              ...cp,
              sharedWithProvider: true,
              sharedTimestamp: 'Shared',
            }
          : cp
      ),
    }));
  };

  const callCompanionApi = async (text: string, mood?: MoodOption) => {
    const response = await fetch('/api/companion/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        mood: mood ?? '',
        motherName: appState.profile.name,
        babyName: appState.profile.babyName,
        babyAge: appState.profile.babyAgeLabel,
        interests: appState.profile.interests,
        existingInsights: appState.profile.niaInsights,
        timeOfDay: getTimePeriod(effectiveHour),
        history: messages.slice(-6).map((m) => ({
          sender: m.sender === 'user' ? 'user' : 'companion',
          text: m.text,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Companion request failed with ${response.status}`);
    }

    return (await response.json()) as {
      crisisTriggered?: boolean;
      reply: string;
      tinyStep: string;
      nonMedicalNote: string;
      learnedFact?: string;
    };
  };

  const recordMoodInTrend = (mood: MoodOption) => {
    setAppState((prev) => ({
      ...prev,
      weeklyMoodTrend: prev.weeklyMoodTrend.map((pt, idx, arr) =>
        idx === arr.length - 1
          ? { ...pt, moodLabel: mood, wellbeingIndex: moodToIndex(mood) }
          : pt
      ),
    }));
  };

  const handleHomeMoodCheckIn = async (mood: MoodOption, note?: string) => {
    setIsCheckingIn(true);
    const fallbackStep = getSuggestedTinyStepForMood(mood, appState.profile.interests);
    recordMoodInTrend(mood);

    const promptText = note
      ? `Daily check-in: I'm feeling ${mood}. Note: ${note}`
      : `Daily check-in: I'm feeling ${mood}.`;

    try {
      const data = await callCompanionApi(promptText, mood);
      if (data.crisisTriggered || (note && detectSelfHarmIntent(note))) {
        setCrisisLockActive(true);
        setNiaOpen(true);
        return;
      }

      if (data.learnedFact) {
        appendNiaInsight(data.learnedFact);
      }

      const entry: CheckInEntry = {
        id: `chk-${Date.now()}`,
        dateLabel: 'Today',
        mood,
        note: data.reply,
        tinyStepSuggested: data.tinyStep || fallbackStep,
      };
      setTodayCheckIn(entry);
      setAppState((prev) => ({
        ...prev,
        checkIns: [entry, ...prev.checkIns],
      }));
    } catch {
      const entry: CheckInEntry = {
        id: `chk-${Date.now()}`,
        dateLabel: 'Today',
        mood,
        note: `Thank you for checking in, ${appState.profile.name}. Take things one gentle hour at a time.`,
        tinyStepSuggested: fallbackStep,
      };
      setTodayCheckIn(entry);
      setAppState((prev) => ({
        ...prev,
        checkIns: [entry, ...prev.checkIns],
      }));
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleCompanionSendMessage = async (text: string, mood?: MoodOption) => {
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: 'Just now',
      moodTag: mood,
    };
    setMessages((prev) => [...prev, userMsg]);

    if (detectSelfHarmIntent(text)) {
      setCrisisLockActive(true);
      return;
    }

    if (mood) {
      recordMoodInTrend(mood);
    }

    setIsSendingChat(true);
    try {
      const data = await callCompanionApi(text, mood);
      if (data.crisisTriggered) {
        setCrisisLockActive(true);
        return;
      }

      if (data.learnedFact) {
        appendNiaInsight(data.learnedFact);
      }

      const companionReply: ChatMessage = {
        id: `nia-${Date.now() + 1}`,
        sender: 'companion',
        text: data.reply,
        timestamp: 'Just now',
        tinyStep: data.tinyStep,
        nonMedicalNote: data.nonMedicalNote,
      };
      setMessages((prev) => [...prev, companionReply]);
    } catch {
      const fallbackStep = mood
        ? getSuggestedTinyStepForMood(mood, appState.profile.interests)
        : 'Take 3 slow breaths and sip some water.';
      setMessages((prev) => [
        ...prev,
        {
          id: `nia-${Date.now() + 1}`,
          sender: 'companion',
          text: `I hear you, ${appState.profile.name}. You don’t have to carry everything at once.`,
          timestamp: 'Just now',
          tinyStep: fallbackStep,
        },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleToggleTodo = (todoId: string) => {
    setAppState((prev) => ({
      ...prev,
      assistantTodos: prev.assistantTodos.map((t) =>
        t.id === todoId ? { ...t, done: !t.done } : t
      ),
    }));
  };

  const handleAddTodo = (title: string, kind: AssistantTodoItem['kind']) => {
    setAppState((prev) => ({
      ...prev,
      assistantTodos: [
        ...prev.assistantTodos,
        {
          id: `todo-${Date.now()}`,
          kind,
          title,
          timeLabel: 'Today',
          done: false,
        },
      ],
    }));
  };

  const handleAgentDecision = (actionId: string, decision: 'accepted' | 'dismissed') => {
    setAppState((prev) => applyAgentActionDecision(prev, actionId, decision));
  };

  const handleToggleJoinGroup = (groupId: string) => {
    setAppState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              joined: !g.joined,
              memberCount: g.joined ? g.memberCount - 1 : g.memberCount + 1,
            }
          : g
      ),
    }));
  };

  const handleInviteCircleMember = (
    name: string,
    relationship: SupportCircleMember['relationship'],
    note: string
  ) => {
    setAppState((prev) => ({
      ...prev,
      supportCircle: {
        ...prev.supportCircle,
        members: [
          ...prev.supportCircle.members,
          { id: `mem-${Date.now()}`, name, relationship, statusLabel: note },
        ],
      },
    }));
  };

  const handleToggleClaimCircleTask = (taskId: string, helperLabel: string) => {
    setAppState((prev) => ({
      ...prev,
      supportCircle: {
        ...prev.supportCircle,
        tasks: prev.supportCircle.tasks.map((t) =>
          t.id === taskId ? { ...t, claimedBy: t.claimedBy ? null : helperLabel } : t
        ),
      },
    }));
  };

  const handleAddCircleTask = (
    kind: SupportCircleTask['kind'],
    title: string,
    dateTimeLabel: string
  ) => {
    setAppState((prev) => ({
      ...prev,
      supportCircle: {
        ...prev.supportCircle,
        tasks: [
          {
            id: `task-${Date.now()}`,
            kind,
            title,
            dateTimeLabel,
            notes: '',
            claimedBy: null,
          },
          ...prev.supportCircle.tasks,
        ],
      },
    }));
  };

  const handleTherapistDecision = (
    therapistId: string,
    status: TherapistItem['status']
  ) => {
    setAppState((prev) => ({
      ...prev,
      therapists: prev.therapists.map((t) =>
        t.id === therapistId ? { ...t, status } : t
      ),
    }));
  };

  const handleCreatePost = (content: string, groupName: string, isAnonymous: boolean) => {
    setAppState((prev) => ({
      ...prev,
      posts: [
        {
          id: `post-${Date.now()}`,
          authorName: isAnonymous ? 'Anonymous' : prev.profile.name,
          authorRole: `Mom to ${prev.profile.babyName}`,
          babyInfo: `${prev.profile.babyName} · ${prev.profile.babyAgeLabel}`,
          interests: prev.profile.interests,
          timeAgo: 'Just now',
          groupTag: groupName,
          isAnonymous,
          content,
          warmthCount: 1,
          warmthSent: true,
          replies: [],
        },
        ...prev.posts,
      ],
    }));
  };

  const handleToggleWarmth = (postId: string) => {
    setAppState((prev) => ({
      ...prev,
      posts: prev.posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              warmthSent: !p.warmthSent,
              warmthCount: p.warmthSent ? p.warmthCount - 1 : p.warmthCount + 1,
            }
          : p
      ),
    }));
  };

  const handleAddReply = (postId: string, replyText: string) => {
    setAppState((prev) => ({
      ...prev,
      posts: prev.posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              replies: [
                ...p.replies,
                {
                  id: `rep-${Date.now()}`,
                  authorName: prev.privacy.anonymousInCommunity
                    ? 'Anonymous'
                    : prev.profile.name,
                  text: replyText,
                  timeAgo: 'Just now',
                },
              ],
            }
          : p
      ),
    }));
  };

  const handleToggleFavoriteHospital = (hospitalId: string) => {
    setAppState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        favoriteHospitalId:
          prev.profile.favoriteHospitalId === hospitalId ? null : hospitalId,
      },
    }));
  };

  const handleUpdateUberMode = (mode: UberRideDraft['mode']) => {
    setAppState((prev) => ({
      ...prev,
      uberDraft: { ...prev.uberDraft, mode, status: 'draft' },
    }));
  };

  const handleUpdateUberDraftSlot = (hospitalId: string, timeLabel: string) => {
    setAppState((prev) => ({
      ...prev,
      uberDraft: {
        ...prev.uberDraft,
        destinationHospitalId: hospitalId,
        appointmentTimeLabel: timeLabel,
        status: 'draft',
      },
    }));
  };

  const handleUberDecision = (decision: 'accepted' | 'dismissed' | 'reset') => {
    if (decision === 'reset') {
      setAppState((prev) => ({
        ...prev,
        uberDraft: { ...prev.uberDraft, status: 'draft' },
      }));
      return;
    }

    setAppState((prev) => {
      const destHospital =
        prev.hospitals.find((h) => h.id === prev.uberDraft.destinationHospitalId) ??
        prev.hospitals[0];

      const rideEventId = 'cal-uber-resource-ride';
      const nextCalendar =
        decision === 'accepted' && !prev.calendarEvents.some((e) => e.id === rideEventId)
          ? [
              {
                id: rideEventId,
                title: `${prev.uberDraft.mode} → ${destHospital.name}`,
                dateTimeLabel: prev.uberDraft.appointmentTimeLabel,
                locationOrFormat: 'Scheduled ride',
                category: 'ride' as const,
              },
              ...prev.calendarEvents,
            ]
          : prev.calendarEvents;

      return {
        ...prev,
        uberDraft: { ...prev.uberDraft, status: decision },
        calendarEvents: nextCalendar,
      };
    });
  };

  const handleAddCalendarEvent = (
    title: string,
    dateTimeLabel: string,
    category: CalendarEvent['category']
  ) => {
    setAppState((prev) => ({
      ...prev,
      calendarEvents: [
        {
          id: `cal-${Date.now()}`,
          title,
          dateTimeLabel,
          locationOrFormat: 'Added by Maya',
          category,
        },
        ...prev.calendarEvents,
      ],
    }));
  };

  const handleRemoveCalendarEvent = (eventId: string) => {
    setAppState((prev) => ({
      ...prev,
      calendarEvents: prev.calendarEvents.filter((ev) => ev.id !== eventId),
    }));
  };

  const handleAddFeed = (entry: Omit<FeedLogEntry, 'id'>) => {
    setAppState((prev) => ({
      ...prev,
      feedLogs: [
        {
          id: `feed-${Date.now()}`,
          ...entry,
        },
        ...prev.feedLogs,
      ],
    }));
  };

  const handleRemoveFeed = (feedId: string) => {
    setAppState((prev) => ({
      ...prev,
      feedLogs: prev.feedLogs.filter((feed) => feed.id !== feedId),
    }));
  };

  const handleToggleSaveStage = (stageId: string) => {
    setAppState((prev) => {
      const exists = prev.profile.savedStageIds.includes(stageId);
      return {
        ...prev,
        profile: {
          ...prev.profile,
          savedStageIds: exists
            ? prev.profile.savedStageIds.filter((id) => id !== stageId)
            : [...prev.profile.savedStageIds, stageId],
        },
      };
    });
  };

  const handleAddInterest = (interest: string) => {
    setAppState((prev) => {
      if (prev.profile.interests.includes(interest)) return prev;
      return {
        ...prev,
        profile: {
          ...prev.profile,
          interests: [...prev.profile.interests, interest],
        },
      };
    });
  };

  const handleRemoveInterest = (interest: string) => {
    setAppState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        interests: prev.profile.interests.filter((item) => item !== interest),
      },
    }));
  };

  const handleUpdateProfileDetails = (patch: Partial<MayaProfile>) => {
    setAppState((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...patch },
    }));
  };

  const handleUpdatePrivacy = (patch: Partial<PrivacySettings>) => {
    const nextPrivacy: PrivacySettings = { ...appState.privacy, ...patch };
    setAppState((prev) => ({
      ...prev,
      privacy: nextPrivacy,
    }));
    if (auth.currentUser) {
      void savePrivacyPreferences(auth.currentUser.uid, nextPrivacy).catch((err) => {
        console.error('Could not persist privacy update:', err);
      });
    }
  };

  const handleRevokeAllSharing = () => {
    const revokedPrivacy: PrivacySettings = {
      ...appState.privacy,
      shareCheckIns: false,
      shareAppointments: false,
      shareWithOB: false,
      shareWithTherapist: false,
      shareWithPartner: false,
    };
    setAppState((prev) => ({
      ...prev,
      privacy: revokedPrivacy,
    }));
    if (auth.currentUser) {
      void savePrivacyPreferences(auth.currentUser.uid, revokedPrivacy).catch((err) => {
        console.error('Could not persist privacy revocation:', err);
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setAuthUser(null);
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      console.error('Could not resend verification email:', err);
    }
  };

  const favoriteProviderName =
    appState.hospitals.find((h) => h.id === appState.profile.favoriteHospitalId)?.name ??
    'OB / Midwife';

  const nextAppointment =
    appState.calendarEvents.find((e) => e.category === 'appointment') ??
    appState.calendarEvents[0] ??
    null;

  return (
    <div className="min-h-screen bg-[#FAF8FC] text-[#261C35] pb-24">
      {/* Sticky Frosted Top Bar with Brand & Global 1-Tap Help Button */}
      <header className="sticky top-0 z-30 bg-[#FAF8FC]/85 backdrop-blur-md border-b border-[#EAE2F5]/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              handleNavigateTab(TabId.Today);
            }}
            className="font-display text-2xl font-bold tracking-tight text-[#261C35] whitespace-nowrap shrink-0 flex items-center gap-2.5"
          >
            <span className="w-9 h-9 rounded-xl bg-[#EFE6FA] text-[#6D4C94] inline-flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5" aria-hidden="true" />
            </span>
            <span>MomLink</span>
          </a>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleOpenStandardHelp}
              aria-label="Help"
              className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#9F1239] hover:bg-[#881337] shadow-xs text-white text-[15px] font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <LifeBuoy className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Help</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="top" className="max-w-5xl mx-auto px-4 sm:px-6 pt-5">
        {activeTab === TabId.Today && (
          <TodayScreen
            profile={appState.profile}
            onboarding={appState.onboarding}
            onOpenOnboarding={() => handleOpenOnboarding(1)}
            onOpenNia={handleOpenNia}
            effectiveHour={effectiveHour}
            timeMode={timeMode}
            onChangeTimeMode={setTimeMode}
            peerAwakeRoom={appState.peerAwakeRoom}
            onToggleJoinAwakeRoom={handleToggleJoinAwakeRoom}
            onSendGentleWave={handleSendGentleWave}
            nextAppointment={nextAppointment}
            assistantTodos={appState.assistantTodos}
            onToggleTodo={handleToggleTodo}
            onAddTodo={handleAddTodo}
            agentActions={appState.agentActions}
            onAgentDecision={handleAgentDecision}
            groups={appState.groups}
            onToggleJoinGroup={handleToggleJoinGroup}
            onNavigateTab={handleNavigateTab}
          />
        )}

        {activeTab === TabId.Community && (
          <CommunityScreen
            profile={appState.profile}
            privacy={appState.privacy}
            groups={appState.groups}
            posts={appState.posts}
            supportCircle={appState.supportCircle}
            onToggleJoinGroup={handleToggleJoinGroup}
            onCreatePost={handleCreatePost}
            onToggleWarmth={handleToggleWarmth}
            onAddReply={handleAddReply}
            onInviteCircleMember={handleInviteCircleMember}
            onToggleClaimCircleTask={handleToggleClaimCircleTask}
            onAddCircleTask={handleAddCircleTask}
          />
        )}

        {activeTab === TabId.Care && (
          <CareScreen
            activeSubTab={careSubTab}
            onChangeSubTab={setCareSubTab}
            profile={appState.profile}
            onboardingGoals={appState.onboarding.selectedGoals}
            latestCheckIn={todayCheckIn}
            weeklyMoodTrend={appState.weeklyMoodTrend}
            recentFeedCount={appState.feedLogs.length}
            onTogglePhoneCalendarSync={() =>
              handleUpdateProfileDetails({
                phoneCalendarSynced: !appState.profile.phoneCalendarSynced,
              })
            }
            onUpdateInsurance={(plan) => handleUpdateProfileDetails({ insurancePlan: plan })}
            calendarEvents={appState.calendarEvents}
            onAddCalendarEvent={handleAddCalendarEvent}
            onRemoveCalendarEvent={handleRemoveCalendarEvent}
            hospitals={appState.hospitals}
            favoriteHospitalId={appState.profile.favoriteHospitalId}
            onToggleFavoriteHospital={handleToggleFavoriteHospital}
            therapists={appState.therapists}
            onTherapistDecision={handleTherapistDecision}
            supportServices={appState.supportServices}
            uberDraft={appState.uberDraft}
            onUpdateUberMode={handleUpdateUberMode}
            onUpdateUberDraftSlot={handleUpdateUberDraftSlot}
            onUberDecision={handleUberDecision}
            savedStageIds={appState.profile.savedStageIds}
            onToggleSaveStage={handleToggleSaveStage}
            onRemoveNiaInsight={handleRemoveNiaInsight}
            onOpenNia={handleOpenNia}
          />
        )}

        {activeTab === TabId.Me && (
          <MeScreen
            profile={appState.profile}
            privacy={appState.privacy}
            onboarding={appState.onboarding}
            onReplayOnboarding={() => handleOpenOnboarding(1)}
            onAddInterest={handleAddInterest}
            onRemoveInterest={handleRemoveInterest}
            onUpdateProfileDetails={handleUpdateProfileDetails}
            onUpdatePrivacy={handleUpdatePrivacy}
            onRevokeAllSharing={handleRevokeAllSharing}
            todayCheckIn={todayCheckIn}
            isCheckingIn={isCheckingIn}
            onMoodCheckIn={handleHomeMoodCheckIn}
            epdsCheckpoints={appState.epdsCheckpoints}
            weeklyMoodTrend={appState.weeklyMoodTrend}
            favoriteProviderName={favoriteProviderName}
            onEnableProviderConsent={() =>
              handleUpdatePrivacy({ shareCheckIns: true, shareWithOB: true })
            }
            onSubmitThreeMonthEpds={handleSubmitThreeMonthEpds}
            onShareEpdsWithProvider={handleShareEpdsWithProvider}
            onOpenWarmHandoffHelp={handleOpenWarmHandoffHelp}
            onNavigateTab={handleNavigateTab}
            feedLogs={appState.feedLogs}
            onAddFeed={handleAddFeed}
            onRemoveFeed={handleRemoveFeed}
            userEmail={authUser?.email ?? null}
            emailVerified={Boolean(authUser?.emailVerified)}
            onOpenAccountSetup={(step = 5) => handleOpenOnboarding(step)}
            onSignOut={handleSignOut}
            onResendVerification={handleResendVerification}
          />
        )}
      </main>

      {/* Global Help Modal */}
      <HelpModal
        open={helpModalOpen}
        warmHandoffMode={helpWarmHandoffMode}
        highlightedTierIds={highlightedHelpTierIds}
        onClose={() => setHelpModalOpen(false)}
        onNavigateTab={handleNavigateTab}
        onOpenNia={() => handleOpenNia(false)}
      />

      {/* Talk to Nia Companion Drawer */}
      <TalkToNiaDrawer
        open={niaOpen}
        startInVoiceMode={niaStartInVoice}
        onClose={() => {
          setNiaOpen(false);
          setNiaStartInVoice(false);
        }}
        profile={appState.profile}
        effectiveHour={effectiveHour}
        messages={messages}
        isSending={isSendingChat}
        crisisLockActive={crisisLockActive}
        onClearCrisisLock={() => setCrisisLockActive(false)}
        onTriggerCrisisLock={handleTriggerCrisisLock}
        onAppendVoiceMessage={handleAppendVoiceMessage}
        onSendMessage={handleCompanionSendMessage}
        onOpenHelp={() => {
          setNiaOpen(false);
          setNiaStartInVoice(false);
          handleOpenStandardHelp();
        }}
      />

      {/* 60-Second Conversational Onboarding */}
      <OnboardingModal
        open={onboardingModalOpen}
        initialState={appState.onboarding}
        initialPrivacy={appState.privacy}
        groups={appState.groups}
        currentUserEmail={authUser?.email ?? null}
        initialStep={onboardingInitialStep}
        onClose={() => setOnboardingModalOpen(false)}
        onComplete={handleCompleteOnboarding}
        onCrisisDetected={() => {
          setCrisisLockActive(true);
          handleOpenStandardHelp();
        }}
      />

      {/* Global Small Nia Popup on Pages Other Than Today */}
      <GlobalNiaPopup
        visible={
          activeTab !== TabId.Today &&
          !niaOpen &&
          !helpModalOpen &&
          !onboardingModalOpen
        }
        profile={appState.profile}
        messages={messages}
        isSending={isSendingChat}
        crisisLockActive={crisisLockActive}
        onSendMessage={handleCompanionSendMessage}
        onOpenFullDrawer={(startInVoice = false) => handleOpenNia(startInVoice)}
        onOpenHelp={handleOpenStandardHelp}
      />

      {/* Persistent Frosted Bottom 4-Tab App Navigation Bar */}
      <nav
        aria-label="Bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-[#E4DBF2] shadow-[0_-6px_24px_-12px_rgba(38,28,53,0.12)]"
      >
        <div className="max-w-lg mx-auto grid grid-cols-4 items-center h-16 px-2 gap-1">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleNavigateTab(id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={label}
                className={`min-h-[48px] flex flex-col items-center justify-center rounded-2xl transition-all ${
                  isActive
                    ? 'text-[#5C3A88] font-bold bg-[#F3ECFB]'
                    : 'text-[#67567E] font-medium hover:text-[#3A2952] hover:bg-[#FAF7FE]'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.9]'}`}
                  aria-hidden="true"
                />
                <span className="text-[11px] leading-tight mt-0.5 whitespace-nowrap">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
