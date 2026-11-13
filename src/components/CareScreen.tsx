import { FormEvent, useState } from 'react';
import {
  Bookmark,
  Calendar,
  Car,
  Check,
  ExternalLink,
  MapPin,
  MessageCircleHeart,
  Plus,
  RotateCcw,
  RotateCw,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { STAGE_IMAGES } from '../assets/media';
import {
  BABY_STAGES,
  INSURANCE_OPTIONS,
  MOOD_CHANGES_AFTER_BIRTH,
} from '../data/demoData';
import {
  CalendarEvent,
  CareSubTab,
  CheckInEntry,
  HospitalItem,
  MayaProfile,
  OnboardingGoal,
  SupportServiceItem,
  TherapistItem,
  UberRideDraft,
  WeeklyMoodPoint,
} from '../types';
import { ResilientImage } from './ResilientImage';

const APPOINTMENT_TIME_SLOTS = ['Tuesday, 10:00 AM', 'Thursday, 2:00 PM', 'Friday, 11:15 AM'];

function resolveInitialStageId(babyAgeMonths: number): string {
  if (babyAgeMonths < 0) return 'prenatal-trimester-3';
  if (babyAgeMonths < 1) return 'newborn';
  if (babyAgeMonths < 2.5) return 'month-1-2';
  if (babyAgeMonths < 4) return 'month-3';
  if (babyAgeMonths < 7) return 'month-4-6';
  return 'month-7-12';
}

interface CareScreenProps {
  activeSubTab: CareSubTab;
  onChangeSubTab: (sub: CareSubTab) => void;
  profile: MayaProfile;
  onboardingGoals: OnboardingGoal[];
  latestCheckIn: CheckInEntry | null;
  weeklyMoodTrend: WeeklyMoodPoint[];
  recentFeedCount: number;
  onTogglePhoneCalendarSync: () => void;
  onUpdateInsurance: (plan: string) => void;
  calendarEvents: CalendarEvent[];
  onAddCalendarEvent: (title: string, dateTimeLabel: string, category: CalendarEvent['category']) => void;
  onRemoveCalendarEvent: (eventId: string) => void;
  hospitals: HospitalItem[];
  favoriteHospitalId: string | null;
  onToggleFavoriteHospital: (hospitalId: string) => void;
  therapists: TherapistItem[];
  onTherapistDecision: (therapistId: string, status: TherapistItem['status']) => void;
  supportServices: SupportServiceItem[];
  uberDraft: UberRideDraft;
  onUpdateUberMode: (mode: UberRideDraft['mode']) => void;
  onUpdateUberDraftSlot: (hospitalId: string, timeLabel: string) => void;
  onUberDecision: (decision: 'accepted' | 'dismissed' | 'reset') => void;
  savedStageIds: string[];
  onToggleSaveStage: (stageId: string) => void;
  onRemoveNiaInsight: (insight: string) => void;
  onOpenNia: (startInVoiceMode?: boolean) => void;
}

export function CareScreen({
  activeSubTab,
  onChangeSubTab,
  profile,
  onboardingGoals,
  latestCheckIn,
  weeklyMoodTrend,
  recentFeedCount,
  onTogglePhoneCalendarSync,
  onUpdateInsurance,
  calendarEvents,
  onAddCalendarEvent,
  onRemoveCalendarEvent,
  hospitals,
  favoriteHospitalId,
  onToggleFavoriteHospital,
  therapists,
  onTherapistDecision,
  supportServices,
  uberDraft,
  onUpdateUberMode,
  onUpdateUberDraftSlot,
  onUberDecision,
  savedStageIds,
  onToggleSaveStage,
  onRemoveNiaInsight,
  onOpenNia,
}: CareScreenProps) {
  const [selectedInsurance, setSelectedInsurance] = useState<string>(profile.insurancePlan || 'All');
  const [selectedStageId, setSelectedStageId] = useState<string>(() =>
    resolveInitialStageId(profile.babyAgeMonths)
  );
  const [flippedMoodIds, setFlippedMoodIds] = useState<Record<string, boolean>>({});
  const [savedServices, setSavedServices] = useState<string[]>([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventWhen, setNewEventWhen] = useState('');

  const selectedHospital =
    hospitals.find((h) => h.id === uberDraft.destinationHospitalId) ?? hospitals[0];

  const visibleTherapists = therapists.filter((t) => {
    if (t.status === 'dismissed') return false;
    if (selectedInsurance === 'All') return true;
    return t.insurances.includes(selectedInsurance);
  });

  const activeStage =
    BABY_STAGES.find((stage) => stage.id === selectedStageId) ?? BABY_STAGES[3];
  const isStageSaved = savedStageIds.includes(activeStage.id);
  const activeStageImage = STAGE_IMAGES[activeStage.imageKey];

  const latestMood =
    latestCheckIn?.mood ?? weeklyMoodTrend[weeklyMoodTrend.length - 1]?.moodLabel ?? 'Hopeful';

  const personalizedContextNotes: string[] = [];
  if (onboardingGoals.length > 0) {
    personalizedContextNotes.push(
      `Your focus right now: ${onboardingGoals.join(' & ')} with ${profile.babyName}.`
    );
  }
  if (latestMood === 'Tired' || latestMood === 'Overwhelmed' || recentFeedCount >= 3) {
    personalizedContextNotes.push(
      `Recent nights have been busy (${latestMood.toLowerCase()} check-in · ${recentFeedCount} recent feeds logged)—protect gentle rest over extra tasks today.`
    );
  } else if (latestMood === 'Anxious' || latestMood === 'Sad') {
    personalizedContextNotes.push(
      `You checked in feeling ${latestMood.toLowerCase()} recently—pair one calm 5-minute grounding reset with reaching out to a trusted person.`
    );
  }
  if (profile.interests.length > 0) {
    personalizedContextNotes.push(
      `Quick recharge ideas tailored to you: lean on ${profile.interests.slice(0, 3).join(', ')}.`
    );
  }

  const toggleMoodCard = (topicId: string) => {
    setFlippedMoodIds((prev) => ({
      ...prev,
      [topicId]: !prev[topicId],
    }));
  };

  const handleAddEvent = (e: FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    onAddCalendarEvent(newEventTitle.trim(), newEventWhen.trim() || 'This week', 'appointment');
    setNewEventTitle('');
    setNewEventWhen('');
  };

  return (
    <div className="space-y-6">
      {/* Header + 4-Part Sub-Navigation */}
      <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold text-[#261C35]">Care</h1>
            <p className="text-[15px] text-[#685780]">
              Appointments, providers, rides, and stage guidance.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Care sections"
            className="flex flex-wrap items-center gap-1 p-1 bg-[#F5F0FB] rounded-2xl self-start"
          >
            {(
              [
                { id: 'calendar', label: 'Calendar' },
                { id: 'find_care', label: 'Find care' },
                { id: 'rides', label: 'Rides' },
                { id: 'learn', label: 'Learn' },
              ] as { id: CareSubTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeSubTab === tab.id}
                onClick={() => onChangeSubTab(tab.id)}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-[15px] font-semibold transition-all whitespace-nowrap shrink-0 ${
                  activeSubTab === tab.id
                    ? 'bg-white text-[#261C35] shadow-sm'
                    : 'text-[#5B4C72] hover:text-[#261C35]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SUB-TAB 1: CALENDAR */}
      {activeSubTab === 'calendar' && (
        <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#ECE4F6]">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#261C35] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#6D4C94] shrink-0" aria-hidden="true" />
                <span>Calendar</span>
              </h2>
              <p className="text-[14px] text-[#685780]">
                Postnatal visits, well-child checks & baby milestones · EHR sync (future)
              </p>
            </div>

            <button
              type="button"
              onClick={onTogglePhoneCalendarSync}
              aria-pressed={profile.phoneCalendarSynced}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-[14px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                profile.phoneCalendarSynced
                  ? 'bg-[#EAE0F7] text-[#432B66]'
                  : 'bg-[#F5F0FB] text-[#5B4C72]'
              }`}
            >
              {profile.phoneCalendarSynced ? 'Phone calendar synced' : 'Sync phone calendar'}
            </button>
          </div>

          <div className="divide-y divide-[#ECE4F6]">
            {calendarEvents.map((ev) => (
              <div
                key={ev.id}
                className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-[16px] font-semibold text-[#261C35]">{ev.title}</p>
                  <p className="text-[14px] text-[#6D4C94]">
                    {ev.dateTimeLabel} · {ev.locationOrFormat}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveCalendarEvent(ev.id)}
                  aria-label={`Remove ${ev.title}`}
                  className="min-h-[42px] min-w-[42px] rounded-xl text-[#6A5A82] hover:bg-[#F5F0FB] inline-flex items-center justify-center shrink-0"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddEvent} className="flex flex-wrap sm:flex-nowrap gap-2 pt-2">
            <input
              type="text"
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              placeholder="Add appointment or well-child visit..."
              className="flex-1 min-w-[180px] min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px]"
            />
            <input
              type="text"
              value={newEventWhen}
              onChange={(e) => setNewEventWhen(e.target.value)}
              placeholder="Day & time"
              className="sm:w-40 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px]"
            />
            <button
              type="submit"
              disabled={!newEventTitle.trim()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#6D4C94] hover:bg-[#593B7D] disabled:opacity-50 text-white font-semibold text-[14px] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Add</span>
            </button>
          </form>
        </section>
      )}

      {/* SUB-TAB 2: FIND CARE */}
      {activeSubTab === 'find_care' && (
        <div className="space-y-6">
          {/* PMH-C Therapists */}
          <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold text-[#261C35]">
                  Perinatal therapists (PMH-C)
                </h2>
                <p className="text-[14px] text-[#685780]">
                  PSI Provider Directory & Psychology Today
                </p>
              </div>
              <div className="flex items-center gap-2 text-[14px]">
                <a
                  href="https://psidirectory.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F5F0FB] text-[#4C3270] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <span>PSI Directory</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
                <a
                  href="https://www.psychologytoday.com/us/therapists"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F5F0FB] text-[#4C3270] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <span>Psychology Today</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Insurance Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              {['All', ...INSURANCE_OPTIONS].map((ins) => {
                const active = selectedInsurance === ins;
                return (
                  <button
                    key={ins}
                    type="button"
                    onClick={() => {
                      setSelectedInsurance(ins);
                      if (ins !== 'All') onUpdateInsurance(ins);
                    }}
                    aria-pressed={active}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-[14px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-[#6D4C94] text-white'
                        : 'bg-[#F5F0FB] text-[#473561] hover:bg-[#EAE0F7]'
                    }`}
                  >
                    {ins}
                  </button>
                );
              })}
            </div>

            <div className="divide-y divide-[#ECE4F6]">
              {visibleTherapists.map((therapist) => {
                const isSaved = therapist.status === 'saved';
                return (
                  <div
                    key={therapist.id}
                    className="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <h3 className="text-[17px] font-semibold text-[#261C35]">{therapist.name}</h3>
                      <p className="text-[14px] text-[#6D4C94]">
                        {therapist.credentials} · {therapist.nextOpeningDemo}
                      </p>
                      <p className="text-[15px] text-[#4E3E66]">
                        {therapist.specialty} · {therapist.insurances.join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onTherapistDecision(therapist.id, isSaved ? 'available' : 'saved')
                        }
                        aria-pressed={isSaved}
                        className={`min-h-[42px] px-4 py-2 rounded-xl font-semibold text-[14px] inline-flex items-center gap-1.5 whitespace-nowrap ${
                          isSaved
                            ? 'bg-[#EAE0F7] text-[#432B66]'
                            : 'bg-[#6D4C94] text-white hover:bg-[#593B7D]'
                        }`}
                      >
                        {isSaved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                        <span>{isSaved ? 'Saved' : 'Save'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onTherapistDecision(therapist.id, 'dismissed')}
                        aria-label={`Dismiss ${therapist.name}`}
                        className="min-h-[42px] min-w-[42px] rounded-xl bg-[#F4EFFA] text-[#5A4873] inline-flex items-center justify-center"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Nearby Hospitals & Clinics */}
          <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-4">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#261C35]">
                Hospitals & clinics nearby
              </h2>
              <p className="text-[14px] text-[#685780]">
                Star your favorite hospital · Directions via Google Maps
              </p>
            </div>

            <div className="divide-y divide-[#ECE4F6]">
              {hospitals.map((hosp) => {
                const isFav = favoriteHospitalId === hosp.id;
                return (
                  <div
                    key={hosp.id}
                    className="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <h3 className="text-[17px] font-semibold text-[#261C35]">{hosp.name}</h3>
                      <p className="text-[14px] text-[#6D4C94]">
                        {hosp.category} · {hosp.distance} · {hosp.hours}
                      </p>
                      <p className="text-[15px] text-[#4E3E66]">{hosp.maternalSpecialty}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={hosp.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F5F0FB] hover:bg-[#EAE0F7] text-[#4C3270] font-semibold text-[14px] inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Maps</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => onToggleFavoriteHospital(hosp.id)}
                        aria-pressed={isFav}
                        className={`min-h-[42px] px-4 py-2 rounded-xl font-semibold text-[14px] inline-flex items-center gap-1.5 whitespace-nowrap ${
                          isFav
                            ? 'bg-[#6D4C94] text-white'
                            : 'bg-[#F5F0FB] text-[#43305E] hover:bg-[#EAE0F7]'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} aria-hidden="true" />
                        <span>{isFav ? 'Favorited' : 'Favorite'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Local Essentials: Lactation, Doulas, WIC, Food, Childcare */}
          <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-3">
            <h2 className="font-display text-2xl font-semibold text-[#261C35]">
              Lactation, doulas, WIC, food & childcare
            </h2>
            <div className="divide-y divide-[#ECE4F6]">
              {supportServices.map((svc) => {
                const isSaved = savedServices.includes(svc.id);
                return (
                  <div
                    key={svc.id}
                    className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-[#6D4C94]">{svc.category}</p>
                      <p className="text-[16px] font-semibold text-[#261C35]">{svc.name}</p>
                      <p className="text-[14px] text-[#5B4C72]">{svc.detail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSavedServices((prev) =>
                          prev.includes(svc.id) ? prev.filter((x) => x !== svc.id) : [...prev, svc.id]
                        )
                      }
                      aria-pressed={isSaved}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-[14px] font-semibold whitespace-nowrap shrink-0 ${
                        isSaved ? 'bg-[#EAE0F7] text-[#432B66]' : 'bg-[#F5F0FB] text-[#4C3270]'
                      }`}
                    >
                      {isSaved ? 'Saved' : 'Save'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* SUB-TAB 3: RIDES (Medicaid NEMT + Rideshare fallback) */}
      {activeSubTab === 'rides' && (
        <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-5">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#261C35] flex items-center gap-2">
              <Car className="w-5 h-5 text-[#6D4C94] shrink-0" aria-hidden="true" />
              <span>Rides to appointments</span>
            </h2>
            <p className="text-[15px] text-[#5B4C72]">
              Medicaid non-emergency medical transport (NEMT) first, with rideshare fallback.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['Medicaid NEMT', 'Rideshare (Uber)'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onUpdateUberMode(mode)}
                aria-pressed={uberDraft.mode === mode}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-[15px] font-semibold whitespace-nowrap ${
                  uberDraft.mode === mode
                    ? 'bg-[#6D4C94] text-white'
                    : 'bg-[#F5F0FB] text-[#473561]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              aria-label="Destination clinic"
              value={uberDraft.destinationHospitalId}
              onChange={(e) =>
                onUpdateUberDraftSlot(e.target.value, uberDraft.appointmentTimeLabel)
              }
              className="min-h-[46px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px]"
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.distance})
                </option>
              ))}
            </select>

            <select
              aria-label="Appointment window"
              value={uberDraft.appointmentTimeLabel}
              onChange={(e) =>
                onUpdateUberDraftSlot(uberDraft.destinationHospitalId, e.target.value)
              }
              className="min-h-[46px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px]"
            >
              {APPOINTMENT_TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-[#FAF7FE] rounded-2xl p-4 border border-[#EAE1F6] space-y-1">
            <p className="text-[16px] font-semibold text-[#261C35]">
              {uberDraft.mode} → {selectedHospital.name}
            </p>
            <p className="text-[15px] text-[#5B4C72]">
              {uberDraft.appointmentTimeLabel} ·{' '}
              {uberDraft.mode === 'Medicaid NEMT'
                ? 'Covered $0 ride · Stroller-ready'
                : 'Rideshare fallback ($14 est. demo)'}
            </p>
          </div>

          {uberDraft.status === 'draft' ? (
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => onUberDecision('accepted')}
                className="min-h-[46px] px-5 py-2 rounded-2xl bg-[#6D4C94] hover:bg-[#593B7D] text-white font-semibold text-[15px] inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Confirm ride</span>
              </button>
              <button
                type="button"
                onClick={() => onUberDecision('dismissed')}
                className="min-h-[46px] px-4 py-2 rounded-2xl bg-[#F4EFFA] text-[#43315E] font-semibold text-[15px]"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-semibold text-[#4E3275]">
                {uberDraft.status === 'accepted'
                  ? 'Confirmed and added to your Calendar.'
                  : 'Ride draft dismissed.'}
              </p>
              <button
                type="button"
                onClick={() => onUberDecision('reset')}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F4EFFA] text-[#4C3270] font-semibold text-[14px] inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Change</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* SUB-TAB 4: LEARN */}
      {activeSubTab === 'learn' && (
        <div className="space-y-6">
          {/* Baby by stage (3rd trimester onward) */}
          <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-2xl font-semibold text-[#261C35]">
                Baby by stage
              </h2>
              <span className="text-[14px] text-[#685780]">3rd trimester through year one</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {BABY_STAGES.map((stage) => {
                const active = stage.id === activeStage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setSelectedStageId(stage.id)}
                    aria-pressed={active}
                    className={`min-h-[42px] px-3.5 py-1.5 rounded-xl text-[14px] font-semibold whitespace-nowrap transition-all ${
                      active
                        ? 'bg-[#6D4C94] text-white shadow-sm'
                        : 'bg-[#F5F0FB] text-[#3F2E56] hover:bg-[#EAE0F7]'
                    }`}
                  >
                    {stage.id === 'month-3' ? `3 Months (${profile.babyName})` : stage.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Dynamic Stage Photograph with Overlaid Text */}
            <div className="relative rounded-2xl overflow-hidden bg-[#241937] min-h-[250px] sm:min-h-[290px] flex flex-col justify-between shadow-[0_12px_32px_-12px_rgba(38,28,53,0.28)]">
              <ResilientImage
                key={activeStage.id}
                src={activeStageImage}
                alt={activeStage.imageAlt}
                fallbackLabel={activeStage.shortLabel}
                className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#190F24]/92 via-[#190F24]/50 to-[#190F24]/25"
              />

              <div className="relative z-10 p-5 sm:p-6 flex items-start justify-between gap-3">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-[#E6DAF7] drop-shadow-xs">
                  {activeStage.id === 'month-3'
                    ? `${profile.babyName}’s stage · 3 months`
                    : activeStage.ageBadge}
                </p>

                <button
                  type="button"
                  onClick={() => onToggleSaveStage(activeStage.id)}
                  aria-pressed={isStageSaved}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-[14px] font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors shadow-xs ${
                    isStageSaved
                      ? 'bg-[#EAE0F7] text-[#351F54]'
                      : 'bg-white/95 hover:bg-white text-[#261C35]'
                  }`}
                >
                  {isStageSaved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  <span>{isStageSaved ? 'Saved' : 'Save'}</span>
                </button>
              </div>

              <div className="relative z-10 p-5 sm:p-6 pt-12 space-y-1.5 max-w-2xl">
                <h3 className="font-display text-2xl sm:text-3xl font-semibold text-white">
                  {activeStage.title}
                </h3>
                <p className="text-[15px] sm:text-[16px] text-[#EFE7FA] leading-relaxed">
                  {activeStage.summary}
                </p>
              </div>
            </div>

            {/* Stage Expectations & For You Note */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-8 rounded-2xl bg-[#FAF7FE] border border-[#EAE2F5] p-5 space-y-2.5">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-[#6D4C94]">
                  What to expect
                </p>
                <ul className="space-y-1.5 text-[15px] text-[#35264B] list-disc pl-5">
                  {activeStage.whatToExpect.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>

              <div className="lg:col-span-4 rounded-2xl bg-[#F3ECFB] border border-[#E2D4F4] p-5 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-[#5B3D80]">
                    For you right now
                  </p>
                  <p className="text-[15px] font-medium text-[#2F1F47] leading-relaxed">
                    {activeStage.motherCareReminder}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Dynamic Mother's Recovery + Personalized Nia Context */}
          <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-[#ECE4F6]">
              <div>
                <h2 className="font-display text-2xl font-semibold text-[#261C35]">
                  Mother’s recovery
                </h2>
                <p className="text-[14px] text-[#685780]">
                  Stage guidance ({activeStage.shortLabel}) · Personalized as Nia learns about you
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenNia(false)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#F5F0FB] hover:bg-[#EAE0F7] text-[#4C3270] text-[14px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <MessageCircleHeart className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Share update with Nia</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activeStage.recoveryPoints.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl bg-[#FAF7FE] border border-[#EAE2F5] p-4 space-y-1.5"
                >
                  <h3 className="text-[16px] font-semibold text-[#261C35]">{item.title}</h3>
                  <p className="text-[14px] text-[#4E3E66] leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>

            {/* Personalized Layer Driven by Nia Conversation + Check-ins + Goals */}
            <div className="rounded-2xl bg-gradient-to-br from-[#F7F2FC] to-[#EFE6FA] border border-[#E1D2F3] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[15px] font-semibold text-[#3B245D] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#6D4C94] shrink-0" aria-hidden="true" />
                  <span>Personalized for {profile.name} from Nia</span>
                </p>
                <span className="text-[12px] text-[#685780]">
                  Updates as you chat or check in
                </span>
              </div>

              {profile.niaInsights.length > 0 && (
                <ul className="space-y-2">
                  {profile.niaInsights.map((insight) => (
                    <li
                      key={insight}
                      className="rounded-xl bg-white/85 border border-[#E4D7F4] px-3.5 py-2.5 flex items-center justify-between gap-3 text-[14px] text-[#312247]"
                    >
                      <span>{insight}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveNiaInsight(insight)}
                        aria-label={`Remove learned note: ${insight}`}
                        className="min-h-[32px] min-w-[32px] rounded-lg text-[#7A6992] hover:bg-[#F3ECFB] hover:text-[#35264B] inline-flex items-center justify-center shrink-0"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {personalizedContextNotes.length > 0 && (
                <div className="space-y-1 pt-1">
                  {personalizedContextNotes.map((line) => (
                    <p key={line} className="text-[14px] text-[#4C3869]">
                      · {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Mood Changes After Birth — Interactive Flip Cards */}
          <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-4">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#261C35]">
                Mood changes after birth
              </h2>
              <p className="text-[14px] text-[#685780]">
                Common, treatable shifts — information only, not a diagnosis. Tap a card to flip.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MOOD_CHANGES_AFTER_BIRTH.map((topic) => {
                const isFlipped = Boolean(flippedMoodIds[topic.id]);
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => toggleMoodCard(topic.id)}
                    aria-pressed={isFlipped}
                    aria-label={`${topic.title}. ${isFlipped ? 'Showing explanation. Tap to show title.' : 'Tap card to read explanation.'}`}
                    className="flip-perspective w-full min-h-[215px] text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D4C94]"
                  >
                    <div className={`flip-card-inner min-h-[215px] ${isFlipped ? 'is-flipped' : ''}`}>
                      {/* Front Face: Diagnosis / Condition Name */}
                      <div
                        className={`flip-card-face absolute inset-0 rounded-2xl bg-gradient-to-br from-[#FAF7FE] to-[#F3ECFB] hover:from-[#F4EEFC] hover:to-[#EAE0F7] border border-[#E2D4F4] p-5 flex flex-col justify-between transition-opacity duration-200 ${
                          isFlipped ? 'opacity-0 pointer-events-none' : 'opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-semibold uppercase tracking-wide text-[#6D4C94]">
                            Postpartum mood guide
                          </span>
                          <RotateCw className="w-4 h-4 text-[#6D4C94] shrink-0" aria-hidden="true" />
                        </div>

                        <h3 className="font-display text-2xl font-semibold text-[#261C35]">
                          {topic.title}
                        </h3>

                        <p className="text-[13px] font-medium text-[#5B4C72]">
                          Tap to read explanation
                        </p>
                      </div>

                      {/* Back Face: Explanation & Common Signs */}
                      <div
                        className={`flip-card-face flip-card-back absolute inset-0 rounded-2xl bg-[#261C35] text-white p-5 flex flex-col justify-between transition-opacity duration-200 ${
                          isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-semibold text-[#DEC9FA]">
                              {topic.title}
                            </span>
                            <span className="text-[12px] text-[#C8B5E6] inline-flex items-center gap-1 shrink-0">
                              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Flip back</span>
                            </span>
                          </div>
                          <p className="text-[15px] text-white leading-snug">{topic.summary}</p>
                        </div>

                        <p className="text-[13px] text-[#DDD0F2] pt-2 border-t border-white/15 leading-snug">
                          {topic.signs.join(' · ')}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
