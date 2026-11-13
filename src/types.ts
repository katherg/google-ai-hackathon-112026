export enum TabId {
  Today = 'today',
  Community = 'community',
  Care = 'care',
  Me = 'me',
}

export type CareSubTab = 'calendar' | 'find_care' | 'rides' | 'learn';

export type MoodOption = 'Okay' | 'Tired' | 'Overwhelmed' | 'Sad' | 'Anxious' | 'Hopeful';

export type TimePeriod = 'late_night' | 'morning' | 'afternoon' | 'evening';

export type TimeOverrideMode = 'live' | 'morning' | 'afternoon' | 'evening' | 'late_night';

export type OnboardingGoal =
  | 'Recovering from birth'
  | 'Sleep'
  | 'Feeding'
  | 'Feeling like myself again'
  | 'Finding my people'
  | 'Keeping track of appointments';

export interface OnboardingState {
  completed: boolean;
  firstName: string;
  babyName: string;
  babyDateLabel: string;
  babyDateInput: string;
  selectedGoals: OnboardingGoal[];
  suggestedGroupIds: string[];
}

export type AgentActionType =
  | 'join_group'
  | 'favorite_hospital'
  | 'book_uber'
  | 'add_calendar'
  | 'pull_article'
  | 'completed_prep';

export type AgentActionStatus = 'pending' | 'accepted' | 'dismissed';

export interface AgentActionItem {
  id: string;
  type: AgentActionType;
  title: string;
  toolBadge: string;
  mockResultHeadline: string;
  detail: string;
  draftPreview?: string;
  status: AgentActionStatus;
  timestampLabel: string;
  targetGroupId?: string;
  targetHospitalId?: string;
  targetStageId?: string;
  calendarEvent?: CalendarEvent;
}

export interface AssistantTodoItem {
  id: string;
  kind: 'medication' | 'todo';
  title: string;
  timeLabel: string;
  done: boolean;
}

export interface CheckInEntry {
  id: string;
  dateLabel: string;
  mood: MoodOption;
  note: string;
  tinyStepSuggested: string;
}

export interface WeeklyMoodPoint {
  id: string;
  weekLabel: string;
  moodLabel: string;
  wellbeingIndex: number; // 1 (heavy) to 5 (steady/hopeful)
}

export interface EpdsCheckpoint {
  id: '2w' | '6w' | '3m';
  milestoneLabel: string;
  status: 'completed' | 'due' | 'flagged';
  completedDate?: string;
  totalScore?: number;
  selfHarmItemPositive?: boolean;
  sharedWithProvider?: boolean;
  sharedTimestamp?: string;
}

export interface SupportGroup {
  id: string;
  name: string;
  memberCount: number;
  description: string;
  meetingSchedule: string;
  calendarDayTime: string;
  joined: boolean;
  facilitatorNote: string;
  moderationBadge?: string;
  goalTags?: OnboardingGoal[];
}

export interface SocialPost {
  id: string;
  authorName: string;
  authorRole: string;
  babyInfo: string;
  interests: string[];
  timeAgo: string;
  groupTag?: string;
  isAnonymous?: boolean;
  content: string;
  warmthCount: number;
  warmthSent: boolean;
  replies: {
    id: string;
    authorName: string;
    text: string;
    timeAgo: string;
  }[];
}

export interface HospitalItem {
  id: string;
  name: string;
  category: string;
  distance: string;
  address: string;
  hours: string;
  phone: string;
  maternalSpecialty: string;
  mapCoordsLabel: string;
  mapsUrl: string;
}

export interface TherapistItem {
  id: string;
  name: string;
  credentials: string;
  specialty: string;
  distanceOrFormat: string;
  insurances: string[];
  directorySource: 'PSI Provider Directory' | 'Psychology Today';
  nextOpeningDemo: string;
  status: 'available' | 'saved' | 'dismissed';
}

export interface SupportServiceItem {
  id: string;
  category: string;
  name: string;
  detail: string;
  actionLabel: string;
}

export interface SupportCircleMember {
  id: string;
  name: string;
  relationship: 'Partner' | 'Friend' | 'Family' | 'Neighbor';
  statusLabel: string;
}

export interface SupportCircleTask {
  id: string;
  kind: 'meal' | 'ride' | 'visit';
  title: string;
  dateTimeLabel: string;
  notes: string;
  claimedBy: string | null;
}

export interface SupportCircleState {
  members: SupportCircleMember[];
  tasks: SupportCircleTask[];
}

export interface PeerAwakeState {
  joinedRoom: boolean;
  awakeCount: number;
  gentleWavesSent: number;
  peers: {
    id: string;
    anonymousHandle: string;
    activity: string;
  }[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  dateTimeLabel: string;
  locationOrFormat: string;
  category: 'group' | 'appointment' | 'ride' | 'milestone';
}

export type BabyStageImageKey =
  | 'prenatal-trimester-3'
  | 'newborn'
  | 'month-1-2'
  | 'month-3'
  | 'month-4-6'
  | 'month-7-12';

export interface BabyRecoveryPoint {
  title: string;
  detail: string;
}

export interface BabyStage {
  id: string;
  imageKey: BabyStageImageKey;
  imageAlt: string;
  shortLabel: string;
  title: string;
  ageBadge: string;
  isCurrentBabyStage?: boolean;
  summary: string;
  whatToExpect: string[];
  motherCareReminder: string;
  recoveryPoints: BabyRecoveryPoint[];
}

export interface MoodChangeTopic {
  id: string;
  title: string;
  summary: string;
  signs: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'companion' | 'user';
  text: string;
  timestamp: string;
  moodTag?: MoodOption;
  tinyStep?: string;
  nonMedicalNote?: string;
  proactiveWindow?: 'morning' | 'night' | 'late_night';
  linkedActionId?: string;
}

export interface UberRideDraft {
  mode: 'Medicaid NEMT' | 'Rideshare (Uber)';
  destinationHospitalId: string;
  appointmentTimeLabel: string;
  pickupLabel: string;
  vehicleNote: string;
  estimatedFareDemo: string;
  status: 'draft' | 'accepted' | 'dismissed';
}

export interface PrivacySettings {
  shareCheckIns: boolean;
  shareAppointments: boolean;
  shareWithOB: boolean;
  shareWithTherapist: boolean;
  shareWithPartner: boolean;
  expiryOption: '30 days' | '90 days' | 'Until revoked';
  anonymousInCommunity: boolean;
}

export interface MayaProfile {
  name: string;
  babyName: string;
  babyAgeMonths: number;
  babyAgeLabel: string;
  city: string;
  neighborhood: string;
  interests: string[];
  niaInsights: string[];
  favoriteHospitalId: string | null;
  savedStageIds: string[];
  ageConfirmed: string;
  insurancePlan: string;
  ehrConnected: boolean;
  phoneCalendarSynced: boolean;
}

export type FeedSideOrType = 'Left' | 'Right' | 'Bottle';

export interface FeedLogEntry {
  id: string;
  sideOrType: FeedSideOrType;
  amountOrDuration: string;
  timeLabel: string;
  timestampMs: number;
}

export interface AppState {
  profile: MayaProfile;
  privacy: PrivacySettings;
  onboarding: OnboardingState;
  epdsCheckpoints: EpdsCheckpoint[];
  weeklyMoodTrend: WeeklyMoodPoint[];
  peerAwakeRoom: PeerAwakeState;
  assistantTodos: AssistantTodoItem[];
  agentActions: AgentActionItem[];
  groups: SupportGroup[];
  posts: SocialPost[];
  hospitals: HospitalItem[];
  therapists: TherapistItem[];
  supportServices: SupportServiceItem[];
  supportCircle: SupportCircleState;
  calendarEvents: CalendarEvent[];
  feedLogs: FeedLogEntry[];
  checkIns: CheckInEntry[];
  uberDraft: UberRideDraft;
}
