import { FormEvent, useState } from 'react';
import { Check, HeartHandshake, Phone, Share2, ShieldAlert } from 'lucide-react';
import { CRISIS_RESOURCES, EPDS_QUESTIONS } from '../data/demoData';
import {
  CareSubTab,
  CheckInEntry,
  EpdsCheckpoint,
  MoodOption,
  PrivacySettings,
  TabId,
  WeeklyMoodPoint,
} from '../types';
import { EpdsEvaluationResult, evaluateEpdsResponses } from '../utils/supportLogic';

const MOOD_OPTIONS: MoodOption[] = ['Okay', 'Tired', 'Overwhelmed', 'Sad', 'Anxious', 'Hopeful'];
const DEFAULT_CALM_ANSWERS = [0, 1, 1, 1, 0, 1, 1, 0, 0, 0];
const FLAGGED_DEMO_ANSWERS = [2, 2, 2, 2, 2, 2, 2, 2, 1, 0];

interface WellbeingEpdsSectionProps {
  motherName: string;
  todayCheckIn: CheckInEntry | null;
  isCheckingIn: boolean;
  onMoodCheckIn: (mood: MoodOption, note?: string) => void;
  checkpoints: EpdsCheckpoint[];
  weeklyMoodTrend: WeeklyMoodPoint[];
  providerName: string;
  privacy: PrivacySettings;
  onEnableProviderConsent: () => void;
  onSubmitThreeMonthCheck: (answers: number[], evaluation: EpdsEvaluationResult) => void;
  onShareWithProvider: () => void;
  onOpenWarmHandoffHelp: (recommendedTierIds: string[]) => void;
  onNavigateTab: (tab: TabId, careSubTab?: CareSubTab) => void;
}

export function WellbeingEpdsSection({
  motherName,
  todayCheckIn,
  isCheckingIn,
  onMoodCheckIn,
  checkpoints,
  weeklyMoodTrend,
  providerName,
  privacy,
  onEnableProviderConsent,
  onSubmitThreeMonthCheck,
  onShareWithProvider,
  onOpenWarmHandoffHelp,
  onNavigateTab,
}: WellbeingEpdsSectionProps) {
  const [quickNote, setQuickNote] = useState('');
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [answers, setAnswers] = useState<number[]>(DEFAULT_CALM_ANSWERS);
  const [latestEvaluation, setLatestEvaluation] = useState<EpdsEvaluationResult | null>(null);

  const threeMonthCheckpoint = checkpoints.find((c) => c.id === '3m');
  const isShared = Boolean(threeMonthCheckpoint?.sharedWithProvider);
  const hasConsent = privacy.shareCheckIns && (privacy.shareWithOB || privacy.shareWithTherapist);

  const handleSelectOption = (qIndex: number, score: number) => {
    setAnswers((prev) => prev.map((val, idx) => (idx === qIndex ? score : val)));
  };

  const handleCompleteCheck = (overrideAnswers?: number[]) => {
    const usedAnswers = overrideAnswers ?? answers;
    if (overrideAnswers) {
      setAnswers(overrideAnswers);
    }
    const evaluation = evaluateEpdsResponses(usedAnswers);
    setLatestEvaluation(evaluation);
    onSubmitThreeMonthCheck(usedAnswers, evaluation);
    setQuestionnaireOpen(false);
  };

  const handleNoteSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim()) return;
    onMoodCheckIn(todayCheckIn?.mood ?? 'Okay', quickNote.trim());
    setQuickNote('');
  };

  return (
    <section
      id="wellbeing-epds-section"
      aria-label="Daily check-in and EPDS wellbeing"
      className="bg-white rounded-3xl border border-[#E7DFF2] p-6 sm:p-7 space-y-6"
    >
      {/* Daily Quick Check-In */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold text-[#261C35]">
            How are you feeling, {motherName}?
          </h2>
          <span className="text-[14px] text-[#6A5A82]">Daily check-in</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {MOOD_OPTIONS.map((mood) => {
            const isSelected = todayCheckIn?.mood === mood;
            return (
              <button
                key={mood}
                type="button"
                disabled={isCheckingIn}
                onClick={() => onMoodCheckIn(mood, quickNote.trim() || undefined)}
                aria-pressed={isSelected}
                className={`min-h-[46px] px-3 py-2 rounded-2xl text-[15px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-[#6D4C94] text-white'
                    : 'bg-[#F6F1FC] text-[#35264B] hover:bg-[#EBE0F8]'
                }`}
              >
                {mood}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleNoteSubmit} className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="checkin-quick-note" className="sr-only">
            Optional short note
          </label>
          <input
            id="checkin-quick-note"
            type="text"
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder="Optional: add one line about today or last night..."
            className="flex-1 min-h-[46px] px-4 py-2 rounded-2xl border border-[#E2D8F0] bg-[#FCFAFF] text-[15px] text-[#261C35] placeholder:text-[#86769C] focus:outline-none focus:border-[#6D4C94]"
          />
          {quickNote.trim() && (
            <button
              type="submit"
              disabled={isCheckingIn}
              className="min-h-[46px] px-4 py-2 rounded-2xl bg-[#6D4C94] hover:bg-[#593B7D] text-white text-[15px] font-semibold whitespace-nowrap shrink-0"
            >
              Save note
            </button>
          )}
        </form>

        {isCheckingIn && (
          <p className="text-[15px] text-[#6D4C94]">Saving your check-in…</p>
        )}

        {todayCheckIn && !isCheckingIn && (
          <div className="bg-[#F6F1FC] rounded-2xl p-4 space-y-1.5">
            <p className="text-[15px] font-semibold text-[#543877]">
              Logged: {todayCheckIn.mood}
            </p>
            <p className="text-[16px] text-[#2D2040]">{todayCheckIn.note}</p>
            <p className="text-[15px] text-[#5B3D80]">
              <strong>Tiny step:</strong> {todayCheckIn.tinyStepSuggested}
            </p>
          </div>
        )}
      </div>

      {/* Mood Trend + Scheduled EPDS Row */}
      <div className="pt-5 border-t border-[#ECE4F6] grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 6-Week Mood Trend Line Graph */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[17px] font-semibold text-[#261C35]">Mood trend</h3>
            <span className="text-[13px] text-[#6A5A82]">Last 6 weeks</span>
          </div>

          <div
            role="img"
            aria-label={`Weekly mood trend line graph: ${weeklyMoodTrend
              .map((p) => `${p.weekLabel} ${p.moodLabel}`)
              .join(', ')}`}
            className="bg-[#FAF8FC] rounded-2xl border border-[#ECE4F6] p-3.5 space-y-2"
          >
            {(() => {
              const count = Math.max(weeklyMoodTrend.length, 1);
              const coords = weeklyMoodTrend.map((point, idx) => {
                const xPct = ((idx + 0.5) / count) * 100;
                const yPct = 82 - ((Math.min(5, Math.max(1, point.wellbeingIndex)) - 1) / 4) * 64;
                return {
                  ...point,
                  xPct,
                  yPct,
                  xSvg: (xPct / 100) * 360,
                  ySvg: yPct,
                };
              });

              const linePoints = coords.map((c) => `${c.xSvg},${c.ySvg}`).join(' ');
              const areaPoints =
                coords.length > 0
                  ? `${coords[0].xSvg},96 ${linePoints} ${coords[coords.length - 1].xSvg},96`
                  : '';

              return (
                <>
                  <div className="relative w-full h-24">
                    <svg
                      viewBox="0 0 360 100"
                      preserveAspectRatio="none"
                      className="w-full h-full overflow-visible"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id="moodTrendArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6D4C94" stopOpacity="0.18" />
                          <stop offset="100%" stopColor="#6D4C94" stopOpacity="0.01" />
                        </linearGradient>
                      </defs>

                      {[18, 50, 82].map((yLine) => (
                        <line
                          key={yLine}
                          x1="0"
                          y1={yLine}
                          x2="360"
                          y2={yLine}
                          stroke="#E8DFF3"
                          strokeWidth="1"
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}

                      {areaPoints && <polygon points={areaPoints} fill="url(#moodTrendArea)" />}

                      {linePoints && (
                        <polyline
                          points={linePoints}
                          fill="none"
                          stroke="#6D4C94"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                    </svg>

                    {coords.map((c, idx) => {
                      const isLatest = idx === coords.length - 1;
                      return (
                        <span
                          key={c.id}
                          title={`${c.weekLabel}: ${c.moodLabel}`}
                          style={{ left: `${c.xPct}%`, top: `${c.yPct}%` }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[#FAF8FC] ${
                            isLatest
                              ? 'w-3.5 h-3.5 bg-[#543877]'
                              : 'w-2.5 h-2.5 bg-[#6D4C94]'
                          }`}
                        />
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-6 gap-1 pt-1 border-t border-[#ECE4F6]">
                    {coords.map((c) => (
                      <div key={c.id} className="flex flex-col items-center text-center min-w-0">
                        <span className="text-[12px] font-semibold text-[#332447] tabular-nums">
                          {c.weekLabel}
                        </span>
                        <span className="text-[11px] text-[#5A4A70] truncate max-w-full">
                          {c.moodLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Scheduled EPDS Checkpoints (2w, 6w, 3m) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[17px] font-semibold text-[#261C35]">
              EPDS check-ins (2 wks · 6 wks · 3 mos)
            </h3>
            <span className="text-[13px] text-[#6A5A82]">Supportive check, not a diagnosis</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {checkpoints.map((cp) => {
              const isFlagged = cp.status === 'flagged';
              const isCompleted = cp.status === 'completed';
              return (
                <div
                  key={cp.id}
                  className={`rounded-2xl p-3 border space-y-0.5 ${
                    isFlagged
                      ? 'bg-[#FFF4F7] border-[#E3ACC0]'
                      : isCompleted
                      ? 'bg-[#FAF8FC] border-[#E7DFF2]'
                      : 'bg-[#F5EFFC] border-[#D7C6EE]'
                  }`}
                >
                  <p className="text-[14px] font-semibold text-[#261C35]">{cp.milestoneLabel}</p>
                  <p
                    className={`text-[13px] tabular-nums ${
                      isFlagged ? 'text-[#881337] font-semibold' : 'text-[#5F4F76]'
                    }`}
                  >
                    {cp.completedDate ?? 'Due now'}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setQuestionnaireOpen((prev) => !prev)}
              aria-expanded={questionnaireOpen}
              className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#6D4C94] hover:bg-[#593B7D] text-white font-semibold text-[15px] whitespace-nowrap shrink-0 transition-colors"
            >
              {questionnaireOpen ? 'Hide 3-month check' : 'Take 3-month check'}
            </button>

            <button
              type="button"
              onClick={() => handleCompleteCheck(FLAGGED_DEMO_ANSWERS)}
              title="Demo shortcut to preview flagged check-in handoff"
              className="min-h-[44px] px-4 py-2 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 border-2 border-dotted border-gray-400 font-semibold text-[15px] whitespace-nowrap shrink-0 transition-colors"
            >
              Demo flagged result
            </button>

            {hasConsent ? (
              <button
                type="button"
                onClick={onShareWithProvider}
                className="min-h-[44px] px-4 py-2 rounded-2xl bg-white border border-[#DED2EF] hover:bg-[#FAF7FE] text-[#432B66] font-semibold text-[15px] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {isShared ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Shared with {providerName.split(' ')[0]}</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Share with provider</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onEnableProviderConsent}
                className="min-h-[44px] px-4 py-2 rounded-2xl bg-white border border-[#DED2EF] hover:bg-[#FAF7FE] text-[#5B4C72] font-medium text-[14px] whitespace-nowrap shrink-0"
              >
                Allow sharing in Me to send
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable 10-Question EPDS Check */}
      {questionnaireOpen && (
        <div className="bg-[#FAF8FC] rounded-2xl border border-[#E7DFF2] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#EAE1F5]">
            <p className="text-[15px] font-medium text-[#4E3E66]">
              Over the past 7 days:
            </p>
            <button
              type="button"
              onClick={() => setAnswers(FLAGGED_DEMO_ANSWERS)}
              title="Demo shortcut to prefill answers"
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 border-2 border-dotted border-gray-400 text-gray-700 text-[14px] font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              Prefill heavy week (demo)
            </button>
          </div>

          <div className="divide-y divide-[#ECE4F6]">
            {EPDS_QUESTIONS.map((q, qIdx) => (
              <div key={q.id} className="py-3.5 first:pt-1 last:pb-1 space-y-2">
                <p className="text-[16px] font-semibold text-[#261C35]">{q.prompt}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt) => {
                    const selected = answers[qIdx] === opt.score;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => handleSelectOption(qIdx, opt.score)}
                        aria-pressed={selected}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-left text-[15px] font-medium transition-colors ${
                          selected
                            ? 'bg-[#6D4C94] text-white'
                            : 'bg-white border border-[#E4D9F2] text-[#3B2B52] hover:bg-[#F3ECF9]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => handleCompleteCheck()}
              className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-[#6D4C94] hover:bg-[#593B7D] text-white font-semibold text-[16px] whitespace-nowrap shrink-0"
            >
              Submit check
            </button>
          </div>
        </div>
      )}

      {/* Result & Escalated Warm Handoff to Care */}
      {latestEvaluation && (
        <div
          aria-live="polite"
          className={`rounded-2xl p-5 border space-y-4 ${
            latestEvaluation.flagged
              ? 'bg-[#FFF4F7] border-[#DF9FB2]'
              : 'bg-[#F6F1FC] border-[#DED0F0]'
          }`}
        >
          <div className="space-y-1">
            <h4 className="font-display text-xl font-semibold text-[#261C35] flex items-center gap-2">
              {latestEvaluation.flagged ? (
                <>
                  <ShieldAlert className="w-5 h-5 text-[#9F1239] shrink-0" aria-hidden="true" />
                  <span className="tabular-nums">
                    Flagged ({latestEvaluation.totalScore}/30) — Let’s connect you to care
                  </span>
                </>
              ) : (
                <>
                  <HeartHandshake className="w-5 h-5 text-[#6D4C94] shrink-0" aria-hidden="true" />
                  <span className="tabular-nums">
                    Saved ({latestEvaluation.totalScore}/30)
                  </span>
                </>
              )}
            </h4>
            <p className="text-[16px] text-[#3B2135]">{latestEvaluation.summaryMessage}</p>
          </div>

          {latestEvaluation.flagged && (
            <div className="space-y-3 pt-2 border-t border-[#EAD1DA]">
              <div className="divide-y divide-[#EDD7DF] bg-white rounded-2xl px-4 border border-[#E7C2CE]">
                {CRISIS_RESOURCES.slice(0, 3).map((tier) => (
                  <div
                    key={tier.id}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <p className="text-[15px] font-semibold text-[#3B0A1D] tabular-nums">
                      {tier.tierNumber}. {tier.shortTitle}
                    </p>
                    <a
                      href={tier.href}
                      className="min-h-[42px] px-3.5 py-1.5 rounded-xl bg-[#9F1239] hover:bg-[#881337] text-white font-semibold text-[14px] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{tier.actionLabel}</span>
                    </a>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenWarmHandoffHelp(latestEvaluation.recommendedTierIds)}
                  className="min-h-[46px] px-4 py-2 rounded-2xl bg-[#9F1239] hover:bg-[#881337] text-white font-semibold text-[15px] whitespace-nowrap shrink-0"
                >
                  See all 5 Help tiers
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab(TabId.Care, 'find_care')}
                  className="min-h-[46px] px-4 py-2 rounded-2xl bg-white border border-[#D8B2C0] text-[#5F2137] hover:bg-[#FDF2F6] font-semibold text-[15px] whitespace-nowrap shrink-0"
                >
                  Find PMH-C therapist
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
