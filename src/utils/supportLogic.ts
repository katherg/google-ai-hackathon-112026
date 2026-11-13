import {
  AgentActionItem,
  AppState,
  CalendarEvent,
  MoodOption,
  OnboardingGoal,
  SupportGroup,
  TimeOverrideMode,
  TimePeriod,
} from '../types';

export function resolveEffectiveHour(mode: TimeOverrideMode, liveDate: Date = new Date()): number {
  switch (mode) {
    case 'late_night':
      return 2;
    case 'morning':
      return 9;
    case 'afternoon':
      return 14;
    case 'evening':
      return 20;
    case 'live':
    default:
      return liveDate.getHours();
  }
}

export function getTimePeriod(hour: number): TimePeriod {
  const normalized = ((Math.floor(hour) % 24) + 24) % 24;
  if (normalized >= 0 && normalized < 6) {
    return 'late_night';
  }
  if (normalized >= 6 && normalized < 12) {
    return 'morning';
  }
  if (normalized >= 12 && normalized < 18) {
    return 'afternoon';
  }
  return 'evening';
}

export interface HomeWelcomeContent {
  period: TimePeriod;
  windowLabel: string;
  greeting: string;
  subtitle: string;
  isLateNight: boolean;
  ctaLabel: string;
}

export function getHomeWelcomeContent(hour: number, motherName = 'Maya'): HomeWelcomeContent {
  const period = getTimePeriod(hour);
  if (period === 'late_night') {
    return {
      period,
      windowLabel: '12–6am',
      greeting: 'Up for a feed?',
      subtitle: 'Sit quietly with other moms awake right now, or talk to Nia.',
      isLateNight: true,
      ctaLabel: "Can't sleep? Talk to Nia",
    };
  }
  if (period === 'morning') {
    return {
      period,
      windowLabel: '6am–12pm',
      greeting: `Good morning, ${motherName}`,
      subtitle: 'Today’s plan, check-in, and your next appointment in one calm place.',
      isLateNight: false,
      ctaLabel: 'Talk to Nia',
    };
  }
  if (period === 'afternoon') {
    return {
      period,
      windowLabel: '12–6pm',
      greeting: `Good afternoon, ${motherName}`,
      subtitle: 'Quick check-in and one gentle recovery tip for your afternoon.',
      isLateNight: false,
      ctaLabel: 'Talk to Nia',
    };
  }
  return {
    period,
    windowLabel: '6pm–12am',
    greeting: `Good evening, ${motherName}`,
    subtitle: 'Wind down and hand off a night shift or task to Jordan.',
    isLateNight: false,
    ctaLabel: 'Talk to Nia',
  };
}

export function getTodayTipForStage(babyAgeMonths: number, goals: OnboardingGoal[]): string {
  if (goals.includes('Sleep')) {
    return `At ${babyAgeMonths} months, short 30–45 minute daytime naps are normal—protect one 4-hour stretch of night sleep with help if you can.`;
  }
  if (goals.includes('Recovering from birth')) {
    return `At ${babyAgeMonths} months postpartum, pelvic and core recovery is still active—skip heavy lifting and rest when someone else holds baby.`;
  }
  if (goals.includes('Feeding')) {
    return `Keep a full water bottle and one-handed snack wherever you feed at ${babyAgeMonths} months.`;
  }
  return `At ${babyAgeMonths} months, talking or humming during ordinary routines supports baby’s brain—no special activities needed.`;
}

export function getProactiveCompanionOpening(
  hour: number,
  motherName = 'Maya',
  babyName = 'Leo'
): { windowTag: 'morning' | 'night' | 'late_night'; text: string } {
  const period = getTimePeriod(hour);
  if (period === 'late_night') {
    return {
      windowTag: 'late_night',
      text: `Can't sleep? I'm here. Up for a feed with ${babyName}, or is your mind racing?`,
    };
  }
  if (period === 'evening') {
    return {
      windowTag: 'night',
      text: `Evening check-in, ${motherName}: how are you feeling as the day winds down with ${babyName}?`,
    };
  }
  return {
    windowTag: 'morning',
    text: `Good morning, ${motherName}. How are you feeling today with ${babyName}?`,
  };
}

const SELF_HARM_PATTERNS: RegExp[] = [
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

export function detectSelfHarmIntent(input: string): boolean {
  if (!input || !input.trim()) return false;
  return SELF_HARM_PATTERNS.some((pattern) => pattern.test(input));
}

export interface EpdsEvaluationResult {
  totalScore: number;
  flagged: boolean;
  urgentCrisisEscalation: boolean;
  recommendedTierIds: string[];
  summaryMessage: string;
}

export function evaluateEpdsResponses(answers: number[]): EpdsEvaluationResult {
  const totalScore = answers.reduce((sum, val) => sum + (Number.isFinite(val) ? val : 0), 0);
  const selfHarmScore = answers[9] ?? 0;
  const urgentCrisisEscalation = selfHarmScore > 0;
  const flagged = totalScore >= 10 || urgentCrisisEscalation;

  if (urgentCrisisEscalation) {
    return {
      totalScore,
      flagged: true,
      urgentCrisisEscalation: true,
      recommendedTierIds: ['tier-911', 'tier-988', 'tier-maternal', 'tier-psi', 'tier-samhsa'],
      summaryMessage:
        'Thank you for being honest. Let’s connect you with 24/7 human support right now. Supportive check only — not a diagnosis.',
    };
  }

  if (flagged) {
    return {
      totalScore,
      flagged: true,
      urgentCrisisEscalation: false,
      recommendedTierIds: ['tier-maternal', 'tier-psi', 'tier-988', 'tier-samhsa'],
      summaryMessage:
        'Things feel heavy right now. This is a supportive check — never a formal diagnosis — and a warm signal to connect with care.',
    };
  }

  return {
    totalScore,
    flagged: false,
    urgentCrisisEscalation: false,
    recommendedTierIds: ['tier-maternal', 'tier-psi'],
    summaryMessage:
      'Saved to your mood trend. Supportive check only — not a diagnosis.',
  };
}

export function toggleGoalSelection(
  current: OnboardingGoal[],
  goal: OnboardingGoal,
  maxGoals = 2
): OnboardingGoal[] {
  if (current.includes(goal)) {
    return current.filter((g) => g !== goal);
  }
  if (current.length >= maxGoals) {
    return [...current.slice(1), goal];
  }
  return [...current, goal];
}

export function matchGroupsForOnboardingGoals(
  groups: SupportGroup[],
  goals: OnboardingGoal[]
): string[] {
  if (goals.length === 0) {
    return ['grp-first-time', 'grp-recently-moved'];
  }
  const scored = groups.map((group) => {
    const overlap = (group.goalTags ?? []).filter((tag) => goals.includes(tag)).length;
    return { id: group.id, overlap };
  });
  scored.sort((a, b) => b.overlap - a.overlap);
  const matched = scored.filter((item) => item.overlap > 0).map((item) => item.id);
  return (matched.length > 0 ? matched : ['grp-first-time', 'grp-recently-moved']).slice(0, 3);
}

export function getSuggestedTinyStepForMood(mood: MoodOption, interests: string[]): string {
  const likesWalking = interests.some((i) => i.toLowerCase().includes('walk'));
  const likesMusic = interests.some((i) => i.toLowerCase().includes('music'));
  const likesCooking = interests.some((i) => i.toLowerCase().includes('cook'));

  switch (mood) {
    case 'Okay':
      return likesWalking
        ? 'Step outside for a 5-minute breath of fresh air.'
        : 'Drink a glass of water by a bright window.';
    case 'Tired':
      return likesMusic
        ? 'Put on one calm song and rest your eyes for 3 minutes.'
        : 'Rest your head for 4 minutes and leave chores untouched.';
    case 'Overwhelmed':
      return 'Breathe in 4 counts, hold 4, exhale 4 — three slow rounds.';
    case 'Sad':
      return 'Text one trusted person: "Tough day — could use a quick hello."';
    case 'Anxious':
      return 'Put both feet flat on the floor and drop your shoulders.';
    case 'Hopeful':
      return likesCooking
        ? 'Make a warm mug of tea and enjoy it sitting down.'
        : 'Save one small moment from today that felt good.';
  }
}

export function applyAgentActionDecision(
  state: AppState,
  actionId: string,
  decision: 'accepted' | 'dismissed'
): AppState {
  const targetAction = state.agentActions.find((item) => item.id === actionId);
  if (!targetAction) {
    return state;
  }

  const updatedActions: AgentActionItem[] = state.agentActions.map((item) =>
    item.id === actionId
      ? {
          ...item,
          status: decision,
          timestampLabel: decision === 'accepted' ? 'Confirmed' : 'Dismissed',
        }
      : item
  );

  if (decision === 'dismissed') {
    const updatedUber =
      targetAction.type === 'book_uber'
        ? { ...state.uberDraft, status: 'dismissed' as const }
        : state.uberDraft;
    return {
      ...state,
      agentActions: updatedActions,
      uberDraft: updatedUber,
    };
  }

  let nextGroups = state.groups;
  let nextPosts = state.posts;
  let nextProfile = state.profile;
  let nextCalendar = state.calendarEvents;
  let nextUber = state.uberDraft;

  if (targetAction.type === 'join_group' && targetAction.targetGroupId) {
    const alreadyJoined = state.groups.find((g) => g.id === targetAction.targetGroupId)?.joined;
    nextGroups = state.groups.map((g) =>
      g.id === targetAction.targetGroupId && !g.joined
        ? { ...g, joined: true, memberCount: g.memberCount + 1 }
        : g
    );
    if (!alreadyJoined && targetAction.draftPreview) {
      const introPostId = `post-agent-${targetAction.id}`;
      if (!state.posts.some((p) => p.id === introPostId)) {
        nextPosts = [
          {
            id: introPostId,
            authorName: state.privacy.anonymousInCommunity ? 'Anonymous' : state.profile.name,
            authorRole: `Mom to ${state.profile.babyName}`,
            babyInfo: `${state.profile.babyName} · ${state.profile.babyAgeLabel}`,
            interests: state.profile.interests,
            timeAgo: 'Just now',
            groupTag: 'First-time mothers',
            isAnonymous: state.privacy.anonymousInCommunity,
            content: targetAction.draftPreview,
            warmthCount: 1,
            warmthSent: true,
            replies: [],
          },
          ...state.posts,
        ];
      }
    }
  }

  if (targetAction.type === 'favorite_hospital' && targetAction.targetHospitalId) {
    nextProfile = {
      ...nextProfile,
      favoriteHospitalId: targetAction.targetHospitalId,
    };
  }

  if (targetAction.type === 'book_uber') {
    nextUber = {
      ...state.uberDraft,
      status: 'accepted',
    };
    const rideEvent: CalendarEvent = targetAction.calendarEvent ?? {
      id: 'cal-uber-tue-10am',
      title: 'Clinic Ride → Willow Creek Postpartum Visit',
      dateTimeLabel: 'Tuesday · 9:40 AM',
      locationOrFormat: 'Medicaid NEMT / Stroller-friendly ride',
      category: 'ride',
    };
    if (!nextCalendar.some((ev) => ev.id === rideEvent.id)) {
      nextCalendar = [rideEvent, ...nextCalendar];
    }
  }

  if (targetAction.type === 'add_calendar' && targetAction.calendarEvent) {
    const ev = targetAction.calendarEvent;
    if (!nextCalendar.some((item) => item.id === ev.id)) {
      nextCalendar = [ev, ...nextCalendar];
    }
  }

  if (targetAction.type === 'pull_article' && targetAction.targetStageId) {
    if (!nextProfile.savedStageIds.includes(targetAction.targetStageId)) {
      nextProfile = {
        ...nextProfile,
        savedStageIds: [...nextProfile.savedStageIds, targetAction.targetStageId],
      };
    }
  }

  return {
    ...state,
    profile: nextProfile,
    agentActions: updatedActions,
    groups: nextGroups,
    posts: nextPosts,
    calendarEvents: nextCalendar,
    uberDraft: nextUber,
  };
}
