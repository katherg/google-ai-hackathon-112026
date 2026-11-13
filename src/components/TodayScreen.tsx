import { FormEvent, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  MessageCircle,
  Mic,
  Moon,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { APP_IMAGES } from '../assets/media';
import {
  AgentActionItem,
  AssistantTodoItem,
  CalendarEvent,
  CareSubTab,
  MayaProfile,
  OnboardingState,
  PeerAwakeState,
  SupportGroup,
  TabId,
  TimeOverrideMode,
} from '../types';
import {
  getHomeWelcomeContent,
  getTodayTipForStage,
} from '../utils/supportLogic';
import { ResilientImage } from './ResilientImage';

interface TodayScreenProps {
  profile: MayaProfile;
  onboarding: OnboardingState;
  onOpenOnboarding: () => void;
  onOpenNia: (startInVoiceMode?: boolean) => void;
  effectiveHour: number;
  timeMode: TimeOverrideMode;
  onChangeTimeMode: (mode: TimeOverrideMode) => void;
  peerAwakeRoom: PeerAwakeState;
  onToggleJoinAwakeRoom: () => void;
  onSendGentleWave: () => void;
  nextAppointment: CalendarEvent | null;
  assistantTodos: AssistantTodoItem[];
  onToggleTodo: (todoId: string) => void;
  onAddTodo: (title: string, kind: AssistantTodoItem['kind']) => void;
  agentActions: AgentActionItem[];
  onAgentDecision: (actionId: string, decision: 'accepted' | 'dismissed') => void;
  groups: SupportGroup[];
  onToggleJoinGroup: (groupId: string) => void;
  onNavigateTab: (tab: TabId, careSubTab?: CareSubTab) => void;
}

export function TodayScreen({
  profile,
  onboarding,
  onOpenOnboarding,
  onOpenNia,
  effectiveHour,
  timeMode,
  onChangeTimeMode,
  peerAwakeRoom,
  onToggleJoinAwakeRoom,
  onSendGentleWave,
  nextAppointment,
  assistantTodos,
  onToggleTodo,
  onAddTodo,
  agentActions,
  onAgentDecision,
  groups,
  onToggleJoinGroup,
  onNavigateTab,
}: TodayScreenProps) {
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoKind, setNewTodoKind] = useState<AssistantTodoItem['kind']>('todo');
  const [eveningHandoffSent, setEveningHandoffSent] = useState(false);

  const welcome = getHomeWelcomeContent(effectiveHour, profile.name);
  const matchedTip = getTodayTipForStage(profile.babyAgeMonths, onboarding.selectedGoals);
  const pendingActions = agentActions.filter((a) => a.status === 'pending');
  const suggestedGroups = groups.filter((g) => onboarding.suggestedGroupIds.includes(g.id));

  const goToWellbeingCheck = () => {
    onNavigateTab(TabId.Me);
  };

  const handleTodoSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    onAddTodo(newTodoText.trim(), newTodoKind);
    setNewTodoText('');
  };

  return (
    <div className="space-y-6">
      {/* Modern Sanctuary Hero with Overlaid Text */}
      <section className="relative rounded-[28px] border border-[#DFD4EE] overflow-hidden shadow-[0_14px_38px_-14px_rgba(38,28,53,0.24)] min-h-[340px] sm:min-h-[380px] flex flex-col justify-between bg-[#241937]">
        {/* Full-bleed Sanctuary Photography + Directional Scrim */}
        <ResilientImage
          src={APP_IMAGES.homeSanctuary}
          alt="Calm sunlit armchair with a soft throw blanket and warm cup of tea"
          fallbackLabel="Calm Sanctuary"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[#1A1026]/82 via-[#1A1026]/74 to-[#1A1026]/90 lg:bg-gradient-to-r lg:from-[#1A1026]/92 lg:via-[#1A1026]/76 lg:to-[#1A1026]/28"
        />

        <div className="relative z-10 p-6 sm:p-8 flex flex-col justify-between flex-1 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] text-[#E6DAF7] font-medium tracking-wide">
                {profile.name} · {profile.babyName} ({profile.babyAgeLabel})
              </p>

              {/* Demo-Only Time-of-Day Preview Switcher */}
              <div
                role="group"
                aria-label="Demo time of day switcher"
                title="Demo control only"
                className="flex flex-wrap items-center gap-1 bg-gray-100/95 border-2 border-dotted border-gray-400 p-1 rounded-xl shadow-xs"
              >
                <span className="px-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Demo
                </span>
                {(
                  [
                    { id: 'live', label: 'Live' },
                    { id: 'late_night', label: '12–6am' },
                    { id: 'morning', label: '6am–12pm' },
                    { id: 'afternoon', label: '12–6pm' },
                    { id: 'evening', label: '6pm–12am' },
                  ] as { id: TimeOverrideMode; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeTimeMode(opt.id)}
                    aria-pressed={timeMode === opt.id}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      timeMode === opt.id
                        ? 'bg-gray-600 text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-w-2xl">
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] leading-tight font-semibold text-white">
                {welcome.greeting}
              </h1>
              <p className="text-[16px] sm:text-[18px] text-[#EFE7FA] leading-relaxed">
                {welcome.subtitle}
              </p>
            </div>

            {/* 12–6am: Who's awake live, quiet peer room */}
            {welcome.isLateNight && (
              <div
                aria-label="Who's awake quiet peer room"
                className="rounded-2xl bg-[#181026]/85 backdrop-blur-md border border-white/15 text-[#F5EFFC] p-5 space-y-3 max-w-2xl"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-xl font-semibold text-white">
                    Who’s awake · {peerAwakeRoom.awakeCount} moms here
                  </h2>
                  <span className="text-[13px] text-[#D5C2F0]">Low-light · Anonymous</span>
                </div>

                {!peerAwakeRoom.joinedRoom ? (
                  <button
                    type="button"
                    onClick={onToggleJoinAwakeRoom}
                    className="min-h-[46px] px-4 py-2 rounded-2xl bg-[#8F6BC0] hover:bg-[#7D58B0] text-white font-semibold text-[15px] inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Moon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Join quiet room</span>
                  </button>
                ) : (
                  <div className="space-y-3 pt-2 border-t border-white/15">
                    <div className="space-y-1.5">
                      {peerAwakeRoom.peers.map((peer) => (
                        <p key={peer.id} className="text-[15px] text-[#EDE5FA]">
                          <strong>{peer.anonymousHandle}</strong> ·{' '}
                          <span className="text-[#CBB8E8]">{peer.activity}</span>
                        </p>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={onSendGentleWave}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[14px] font-semibold whitespace-nowrap shrink-0"
                      >
                        Send quiet glow ({peerAwakeRoom.gentleWavesSent})
                      </button>
                      <button
                        type="button"
                        onClick={goToWellbeingCheck}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-white hover:bg-[#F3ECFB] text-[#2A1B42] text-[14px] font-semibold whitespace-nowrap shrink-0"
                      >
                        Check in now
                      </button>
                      <button
                        type="button"
                        onClick={onToggleJoinAwakeRoom}
                        className="min-h-[44px] px-3 py-2 rounded-xl text-[#D5C2F0] hover:text-white text-[14px] whitespace-nowrap shrink-0"
                      >
                        Leave
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6pm–12am: Evening wind-down & partner handoff */}
            {welcome.period === 'evening' && (
              <div className="rounded-2xl bg-white/12 backdrop-blur-md border border-white/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-2xl">
                <div className="space-y-0.5">
                  <p className="text-[15px] font-semibold text-white">
                    Evening handoff to Jordan (Partner)
                  </p>
                  <p className="text-[14px] text-[#E6DAF7]">
                    {eveningHandoffSent
                      ? 'Handoff note sent to Jordan for the first night stretch.'
                      : 'Pass off the 9 PM–1 AM stretch so you can rest.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEveningHandoffSent((v) => !v)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl font-semibold text-[14px] whitespace-nowrap shrink-0 transition-colors ${
                    eveningHandoffSent
                      ? 'bg-white text-[#261C35]'
                      : 'bg-[#8F6BC0] text-white hover:bg-[#7D58B0]'
                  }`}
                >
                  {eveningHandoffSent ? 'Handoff sent' : 'Request night handoff'}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => onOpenNia(false)}
              className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-white hover:bg-[#F5F0FB] text-[#261C35] shadow-sm font-semibold text-[16px] inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <MessageCircle className="w-5 h-5 shrink-0 text-[#6D4C94]" aria-hidden="true" />
              <span>{welcome.ctaLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenNia(true)}
              className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 text-white font-semibold text-[15px] inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Voice</span>
            </button>

            <button
              type="button"
              onClick={onOpenOnboarding}
              title="Demo shortcut to preview 60s onboarding"
              className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-gray-100/95 hover:bg-gray-200 text-gray-700 border-2 border-dotted border-gray-400 font-semibold text-[15px] inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <Sparkles className="w-4 h-4 shrink-0 text-gray-500" aria-hidden="true" />
              <span>{onboarding.completed ? 'Update 60s setup (demo)' : '60s setup (demo)'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Personalized Focus Row (Shown After 60-Second Onboarding) */}
      {onboarding.completed && (
        <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold text-[#261C35]">
              Your focus: {onboarding.selectedGoals.join(' & ')}
            </h2>
            <span className="text-[14px] text-[#685780]">{onboarding.babyDateLabel}</span>
          </div>
          <div className="divide-y divide-[#EFE9F8]">
            {suggestedGroups.map((group) => (
              <div
                key={group.id}
                className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-[16px] font-semibold text-[#261C35]">{group.name}</p>
                  <p className="text-[14px] text-[#66557E]">{group.meetingSchedule}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleJoinGroup(group.id)}
                  aria-pressed={group.joined}
                  className={`min-h-[42px] px-4 py-1.5 rounded-xl font-semibold text-[14px] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    group.joined
                      ? 'bg-[#EAE0F7] text-[#432B66]'
                      : 'bg-[#6D4C94] text-white hover:bg-[#593B7D]'
                  }`}
                >
                  {group.joined && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                  <span>{group.joined ? 'Joined' : 'Join'}</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Today's Plan: Next Appointment, Matched Tip, and Personal Assistant */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Next Appointment + One Matched Tip */}
        <div className="lg:col-span-5 space-y-6">
          <section
            aria-label="Next appointment"
            className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold text-[#261C35] flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#F4EFFB] text-[#6D4C94] inline-flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                </span>
                <span>Next appointment</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab(TabId.Care, 'calendar')}
                className="text-[14px] font-semibold text-[#6D4C94] hover:underline whitespace-nowrap"
              >
                Open calendar
              </button>
            </div>
            {nextAppointment ? (
              <div className="space-y-1">
                <p className="text-[17px] font-semibold text-[#261C35]">{nextAppointment.title}</p>
                <p className="text-[15px] text-[#6D4C94] font-medium">
                  {nextAppointment.dateTimeLabel}
                </p>
                <p className="text-[15px] text-[#5B4C72]">{nextAppointment.locationOrFormat}</p>
              </div>
            ) : (
              <p className="text-[15px] text-[#5B4C72]">No upcoming appointments.</p>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab(TabId.Care, 'rides')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#F5F0FB] hover:bg-[#EAE0F7] text-[#4C3270] font-semibold text-[14px] inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <span>Need a ride?</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </section>

          <section
            aria-label="Tip for today"
            className="bg-gradient-to-br from-white to-[#FAF6FE] rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-2"
          >
            <p className="text-[13px] font-semibold uppercase tracking-wide text-[#6D4C94]">
              Today’s tip · {profile.babyAgeLabel}
            </p>
            <p className="text-[17px] text-[#261C35] leading-relaxed">{matchedTip}</p>
          </section>
        </div>

        {/* Right: Personal Assistant (Meds, To-dos & Optional Nia Suggestions) */}
        <section
          aria-label="Personal assistant reminders and suggestions"
          className="lg:col-span-7 bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold text-[#261C35]">
              Personal assistant
            </h2>
            <span className="text-[14px] text-[#6A5A82]">Meds & to-dos</span>
          </div>

          <div className="divide-y divide-[#EFE9F8]">
            {assistantTodos.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggleTodo(item.id)}
                aria-pressed={item.done}
                className="w-full py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-left group"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                      item.done
                        ? 'bg-[#6D4C94] border-[#6D4C94] text-white'
                        : 'border-[#CBBBE4] bg-white group-hover:border-[#6D4C94]'
                    }`}
                  >
                    {item.done && <Check className="w-4 h-4" aria-hidden="true" />}
                  </span>
                  <span
                    className={`text-[16px] ${
                      item.done ? 'line-through text-[#837399]' : 'text-[#261C35] font-medium'
                    }`}
                  >
                    {item.title}
                  </span>
                </div>
                <span className="text-[13px] text-[#6D4C94] whitespace-nowrap shrink-0">
                  {item.kind === 'medication' ? 'Med' : 'To-do'} · {item.timeLabel}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={handleTodoSubmit} className="flex flex-wrap sm:flex-nowrap gap-2">
            <label htmlFor="new-todo-kind" className="sr-only">
              Reminder type
            </label>
            <select
              id="new-todo-kind"
              value={newTodoKind}
              onChange={(e) => setNewTodoKind(e.target.value as AssistantTodoItem['kind'])}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[14px] text-[#261C35]"
            >
              <option value="todo">To-do</option>
              <option value="medication">Med</option>
            </select>
            <label htmlFor="new-todo-text" className="sr-only">
              Add reminder
            </label>
            <input
              id="new-todo-text"
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="Add medication or to-do..."
              className="flex-1 min-w-[180px] min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px] text-[#261C35]"
            />
            <button
              type="submit"
              disabled={!newTodoText.trim()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F4EFFA] hover:bg-[#E7DCF5] disabled:opacity-50 text-[#482F6B] font-semibold text-[14px] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Add</span>
            </button>
          </form>

          {pendingActions.length > 0 && (
            <div className="pt-4 border-t border-[#ECE4F6] space-y-3">
              <p className="text-[14px] font-semibold text-[#6D4C94]">
                Prepared by Nia (confirm first)
              </p>
              <div className="divide-y divide-[#EFE9F8]">
                {pendingActions.slice(0, 2).map((act) => (
                  <div
                    key={act.id}
                    className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-[15px] font-semibold text-[#261C35]">{act.title}</p>
                      <p className="text-[14px] text-[#5B4C72]">{act.mockResultHeadline}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onAgentDecision(act.id, 'accepted')}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#6D4C94] hover:bg-[#593B7D] text-white text-[14px] font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                      >
                        <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Accept</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onAgentDecision(act.id, 'dismissed')}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F5F0FB] hover:bg-[#EAE0F7] text-[#4E3C69] text-[14px] font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                      >
                        <X className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Dismiss</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
