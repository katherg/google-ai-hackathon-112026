import { FormEvent, useState } from 'react';
import { CheckCircle2, Lock, LogOut, Mail, Plus, RotateCcw, ShieldCheck, UserPlus, X } from 'lucide-react';
import { APP_IMAGES } from '../assets/media';
import { INSURANCE_OPTIONS } from '../data/demoData';
import {
  CareSubTab,
  CheckInEntry,
  EpdsCheckpoint,
  FeedLogEntry,
  MayaProfile,
  MoodOption,
  OnboardingState,
  PrivacySettings,
  TabId,
  WeeklyMoodPoint,
} from '../types';
import { EpdsEvaluationResult } from '../utils/supportLogic';
import { FeedTimelineCard } from './FeedTimelineCard';
import { ResilientImage } from './ResilientImage';
import { WellbeingEpdsSection } from './WellbeingEpdsSection';

interface MeScreenProps {
  profile: MayaProfile;
  privacy: PrivacySettings;
  onboarding: OnboardingState;
  onReplayOnboarding: () => void;
  onAddInterest: (interest: string) => void;
  onRemoveInterest: (interest: string) => void;
  onUpdateProfileDetails: (patch: Partial<MayaProfile>) => void;
  onUpdatePrivacy: (patch: Partial<PrivacySettings>) => void;
  onRevokeAllSharing: () => void;
  todayCheckIn: CheckInEntry | null;
  isCheckingIn: boolean;
  onMoodCheckIn: (mood: MoodOption, note?: string) => void;
  epdsCheckpoints: EpdsCheckpoint[];
  weeklyMoodTrend: WeeklyMoodPoint[];
  favoriteProviderName: string;
  onEnableProviderConsent: () => void;
  onSubmitThreeMonthEpds: (answers: number[], evaluation: EpdsEvaluationResult) => void;
  onShareEpdsWithProvider: () => void;
  onOpenWarmHandoffHelp: (recommendedTierIds: string[]) => void;
  onNavigateTab: (tab: TabId, careSubTab?: CareSubTab) => void;
  feedLogs: FeedLogEntry[];
  onAddFeed: (entry: Omit<FeedLogEntry, 'id'>) => void;
  onRemoveFeed: (feedId: string) => void;
  userEmail: string | null;
  emailVerified: boolean;
  onOpenAccountSetup: (step?: 1 | 5) => void;
  onSignOut: () => void;
  onResendVerification: () => Promise<void>;
}

export function MeScreen({
  profile,
  privacy,
  onboarding,
  onReplayOnboarding,
  onAddInterest,
  onRemoveInterest,
  onUpdateProfileDetails,
  onUpdatePrivacy,
  onRevokeAllSharing,
  todayCheckIn,
  isCheckingIn,
  onMoodCheckIn,
  epdsCheckpoints,
  weeklyMoodTrend,
  favoriteProviderName,
  onEnableProviderConsent,
  onSubmitThreeMonthEpds,
  onShareEpdsWithProvider,
  onOpenWarmHandoffHelp,
  onNavigateTab,
  feedLogs,
  onAddFeed,
  onRemoveFeed,
  userEmail,
  emailVerified,
  onOpenAccountSetup,
  onSignOut,
  onResendVerification,
}: MeScreenProps) {
  const [interestInput, setInterestInput] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);

  const handleAddInterestSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = interestInput.trim().toLowerCase();
    if (!cleaned) return;
    onAddInterest(cleaned);
    setInterestInput('');
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-[#E4D8F3]">
            <ResilientImage
              src={APP_IMAGES.mayaAvatar}
              alt="Maya and baby Leo"
              fallbackLabel="Maya & Leo"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-0.5">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#261C35]">
              {profile.name}
            </h1>
            <p className="text-[16px] text-[#4E3E66]">
              {profile.babyName} · {profile.babyAgeLabel} · {profile.city}
            </p>
            <p className="text-[14px] text-[#685780]">
              Focus: {onboarding.selectedGoals.join(' · ')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onReplayOnboarding}
          title="Demo shortcut to replay 60s onboarding"
          className="min-h-[44px] px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 border-2 border-dotted border-gray-400 font-semibold text-[15px] inline-flex items-center gap-2 self-start sm:self-center whitespace-nowrap shrink-0 transition-colors"
        >
          <RotateCcw className="w-4 h-4 shrink-0 text-gray-500" aria-hidden="true" />
          <span>Edit 60s setup (demo)</span>
        </button>
      </section>

      {/* Check-In, Mood Trend & EPDS */}
      <WellbeingEpdsSection
        motherName={profile.name}
        todayCheckIn={todayCheckIn}
        isCheckingIn={isCheckingIn}
        onMoodCheckIn={onMoodCheckIn}
        checkpoints={epdsCheckpoints}
        weeklyMoodTrend={weeklyMoodTrend}
        providerName={favoriteProviderName}
        privacy={privacy}
        onEnableProviderConsent={onEnableProviderConsent}
        onSubmitThreeMonthCheck={onSubmitThreeMonthEpds}
        onShareWithProvider={onShareEpdsWithProvider}
        onOpenWarmHandoffHelp={onOpenWarmHandoffHelp}
        onNavigateTab={onNavigateTab}
      />

      {/* Night Feed & Feeding Tracker */}
      <FeedTimelineCard
        babyName={profile.babyName}
        feedLogs={feedLogs}
        onAddFeed={onAddFeed}
        onRemoveFeed={onRemoveFeed}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* City, Interests & Optional Care Details (asked later when needed) */}
        <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-5">
          <h2 className="font-display text-xl font-semibold text-[#261C35]">
            About you
          </h2>

          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="me-city-input" className="block text-[14px] font-medium text-[#5B4C72]">
                City (city-level by default)
              </label>
              <input
                id="me-city-input"
                type="text"
                value={profile.city}
                onChange={(e) => onUpdateProfileDetails({ city: e.target.value })}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px]"
              />
            </div>

            <div className="space-y-2">
              <p className="text-[14px] font-medium text-[#5B4C72]">Interests</p>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => onRemoveInterest(interest)}
                    className="min-h-[38px] px-3 py-1 rounded-xl bg-[#EFE7FA] hover:bg-[#E3D5F5] text-[#3D275B] font-medium text-[14px] inline-flex items-center gap-1.5"
                  >
                    <span>{interest}</span>
                    <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </button>
                ))}
              </div>
              <form onSubmit={handleAddInterestSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  placeholder="Add interest..."
                  className="flex-1 min-h-[42px] px-3.5 py-1.5 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px]"
                />
                <button
                  type="submit"
                  disabled={!interestInput.trim()}
                  aria-label="Add interest"
                  className="min-h-[42px] px-3.5 py-1.5 rounded-xl bg-[#6D4C94] disabled:opacity-50 text-white inline-flex items-center justify-center shrink-0"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>

          {/* Asked later, only when needed */}
          <div className="pt-4 border-t border-[#ECE4F6] space-y-3">
            <p className="text-[14px] font-semibold text-[#6D4C94]">
              Details used only when needed
            </p>

            <div className="space-y-1">
              <label htmlFor="me-age-input" className="block text-[14px] text-[#5B4C72]">
                Age (confirms 18+ when needed)
              </label>
              <input
                id="me-age-input"
                type="text"
                value={profile.ageConfirmed}
                onChange={(e) => onUpdateProfileDetails({ ageConfirmed: e.target.value })}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="me-insurance-select" className="block text-[14px] text-[#5B4C72]">
                Insurance (used for therapy & rides)
              </label>
              <select
                id="me-insurance-select"
                value={profile.insurancePlan}
                onChange={(e) => onUpdateProfileDetails({ insurancePlan: e.target.value })}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px]"
              >
                {INSURANCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl bg-gray-100 border-2 border-dotted border-gray-400 p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-medium text-gray-700">
                  Hospital EHR connection
                </p>
                <p className="text-[13px] text-gray-500">
                  Future state / Demo only · Health data protected
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateProfileDetails({ ehrConnected: !profile.ehrConnected })}
                aria-pressed={profile.ehrConnected}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-[14px] font-semibold whitespace-nowrap transition-colors ${
                  profile.ehrConnected
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {profile.ehrConnected ? 'Connected (demo)' : 'Not connected'}
              </button>
            </div>
          </div>
        </section>

        {/* Privacy Center & Account */}
        <div className="space-y-6">
          <section
            aria-label="Account"
            className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="font-display text-xl font-semibold text-[#261C35] flex items-center gap-2">
                  <Mail className="w-5 h-5 text-[#6D4C94] shrink-0" aria-hidden="true" />
                  <span>MomLink account</span>
                </h2>
                <p className="text-[14px] text-[#5B4C72]">
                  {userEmail
                    ? `Signed in as ${userEmail}`
                    : 'Create an account with your email and password to save your privacy preferences.'}
                </p>
              </div>
              {userEmail && emailVerified && (
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2E5E4E] bg-[#ECF7F2] px-2.5 py-1 rounded-xl shrink-0">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Verified</span>
                </span>
              )}
            </div>

            {userEmail ? (
              <div className="flex flex-wrap items-center gap-2.5">
                {!emailVerified && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onResendVerification();
                      setVerificationSent(true);
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#F4EFFA] hover:bg-[#E7DCF5] text-[#432B66] font-semibold text-[14px]"
                  >
                    {verificationSent ? 'Verification email sent' : 'Verify email'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSignOut}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FFF4F7] border border-[#E7C2CE] hover:bg-[#FCE8EE] text-[#881337] font-semibold text-[14px] inline-flex items-center gap-1.5"
                >
                  <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenAccountSetup(5)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#6D4C94] hover:bg-[#593B7D] text-white font-semibold text-[14px] inline-flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Create account / Sign in</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAccountSetup(1)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F4EFFA] hover:bg-[#E7DCF5] text-[#432B66] font-semibold text-[14px]"
                >
                  Full onboarding
                </button>
              </div>
            )}
          </section>

          <section
            aria-label="Privacy center"
            className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-5"
          >
          <div className="space-y-1">
            <h2 className="font-display text-xl font-semibold text-[#261C35] flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#6D4C94] shrink-0" aria-hidden="true" />
              <span>Privacy center</span>
            </h2>
            <p className="text-[14px] text-[#5B4C72] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#6D4C94] shrink-0" aria-hidden="true" />
              <span>Health data is never sold or shared without consent.</span>
            </p>
          </div>

          <div className="space-y-3 pt-2 border-t border-[#ECE4F6]">
            <p className="text-[14px] font-semibold text-[#261C35]">What can be shared</p>
            <label className="flex items-center justify-between py-1 cursor-pointer">
              <span className="text-[15px] text-[#35264B]">Check-in & EPDS scores</span>
              <input
                type="checkbox"
                checked={privacy.shareCheckIns}
                onChange={(e) => onUpdatePrivacy({ shareCheckIns: e.target.checked })}
                className="w-5 h-5 accent-[#6D4C94]"
              />
            </label>
            <label className="flex items-center justify-between py-1 cursor-pointer">
              <span className="text-[15px] text-[#35264B]">Appointments</span>
              <input
                type="checkbox"
                checked={privacy.shareAppointments}
                onChange={(e) => onUpdatePrivacy({ shareAppointments: e.target.checked })}
                className="w-5 h-5 accent-[#6D4C94]"
              />
            </label>
          </div>

          <div className="space-y-3 pt-2 border-t border-[#ECE4F6]">
            <p className="text-[14px] font-semibold text-[#261C35]">Who can see it</p>
            <label className="flex items-center justify-between py-1 cursor-pointer">
              <span className="text-[15px] text-[#35264B]">OB / Midwife</span>
              <input
                type="checkbox"
                checked={privacy.shareWithOB}
                onChange={(e) => onUpdatePrivacy({ shareWithOB: e.target.checked })}
                className="w-5 h-5 accent-[#6D4C94]"
              />
            </label>
            <label className="flex items-center justify-between py-1 cursor-pointer">
              <span className="text-[15px] text-[#35264B]">Therapist</span>
              <input
                type="checkbox"
                checked={privacy.shareWithTherapist}
                onChange={(e) => onUpdatePrivacy({ shareWithTherapist: e.target.checked })}
                className="w-5 h-5 accent-[#6D4C94]"
              />
            </label>
            <label className="flex items-center justify-between py-1 cursor-pointer">
              <span className="text-[15px] text-[#35264B]">Partner (Jordan)</span>
              <input
                type="checkbox"
                checked={privacy.shareWithPartner}
                onChange={(e) => onUpdatePrivacy({ shareWithPartner: e.target.checked })}
                className="w-5 h-5 accent-[#6D4C94]"
              />
            </label>
          </div>

          <div className="space-y-3 pt-2 border-t border-[#ECE4F6]">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="privacy-expiry" className="text-[15px] text-[#35264B]">
                Optional expiry
              </label>
              <select
                id="privacy-expiry"
                value={privacy.expiryOption}
                onChange={(e) =>
                  onUpdatePrivacy({
                    expiryOption: e.target.value as PrivacySettings['expiryOption'],
                  })
                }
                className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[14px]"
              >
                <option value="30 days">30 days</option>
                <option value="90 days">90 days</option>
                <option value="Until revoked">Until revoked</option>
              </select>
            </div>

            <label className="flex items-center justify-between py-1 cursor-pointer">
              <span className="text-[15px] text-[#35264B]">Anonymous by default in Community</span>
              <input
                type="checkbox"
                checked={privacy.anonymousInCommunity}
                onChange={(e) => onUpdatePrivacy({ anonymousInCommunity: e.target.checked })}
                className="w-5 h-5 accent-[#6D4C94]"
              />
            </label>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onRevokeAllSharing}
              className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#FFF4F7] border border-[#E7C2CE] hover:bg-[#FCE8EE] text-[#881337] font-semibold text-[15px]"
            >
              Revoke all sharing anytime
            </button>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}
