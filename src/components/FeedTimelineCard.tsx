import { FormEvent, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, ChevronUp, Clock, Milk, Plus, Trash2 } from 'lucide-react';
import { FeedLogEntry, FeedSideOrType } from '../types';

interface FeedTimelineCardProps {
  babyName: string;
  feedLogs: FeedLogEntry[];
  onAddFeed: (entry: Omit<FeedLogEntry, 'id'>) => void;
  onRemoveFeed: (feedId: string) => void;
}

const SIDE_OR_TYPE_OPTIONS: FeedSideOrType[] = ['Left', 'Right', 'Bottle'];
const DURATION_PRESETS = ['10 min', '15 min', '20 min'];
const BOTTLE_PRESETS = ['3 oz', '4 oz', '5 oz'];

function getCurrentTimeInputValue(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatTimeInputToLabel(time24: string): string {
  const [hRaw, mRaw] = time24.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h) || Number.isNaN(m)) return 'Just now';
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function buildTimestampFromTimeInput(time24: string, latestExistingMs?: number): number {
  const [hRaw, mRaw] = time24.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  const base = latestExistingMs ? new Date(latestExistingMs) : new Date();
  if (Number.isNaN(h) || Number.isNaN(m)) return Date.now();

  const candidate = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    h,
    m,
    0,
    0
  );

  // If logging a morning/daytime feed right after a late-night reference entry, keep it chronological
  if (latestExistingMs && candidate.getTime() < latestExistingMs - 12 * 60 * 60 * 1000) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
}

function formatGapLabel(newerMs: number, olderMs: number): string {
  const diffMins = Math.max(0, Math.round((newerMs - olderMs) / 60000));
  if (diffMins < 60) {
    return `${diffMins}m gap`;
  }
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins === 0 ? `${hours}h gap` : `${hours}h ${mins}m gap`;
}

function AnimatedBabyBottle({ animKey }: { animKey: string }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative w-14 h-20 shrink-0 flex items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 64 92" className="w-14 h-20 overflow-visible">
        <defs>
          <clipPath id={`bottle-cavity-${animKey}`}>
            <rect x="14" y="28" width="36" height="56" rx="10" />
          </clipPath>
        </defs>

        {/* Nipple */}
        <path
          d="M27 8 C27 4, 37 4, 37 8 L39 18 L25 18 Z"
          fill="#E9DDF8"
          stroke="#8F6BC0"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Collar Ring */}
        <rect
          x="19"
          y="18"
          width="26"
          height="9"
          rx="4"
          fill="#F4EFFC"
          stroke="#8F6BC0"
          strokeWidth="2"
        />

        {/* Bottle Glass Background */}
        <rect
          x="14"
          y="28"
          width="36"
          height="56"
          rx="10"
          fill="#FCFAFF"
          stroke="#8F6BC0"
          strokeWidth="2.2"
        />

        {/* Animated Lavender Liquid Fill + Wave */}
        <g clipPath={`url(#bottle-cavity-${animKey})`}>
          <motion.g
            key={animKey}
            initial={prefersReducedMotion ? { y: 40 } : { y: 84 }}
            animate={{ y: 40 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { duration: 0.85, ease: [0.22, 1, 0.36, 1] }
            }
          >
            <motion.path
              d="M -24 6 Q -12 1, 0 6 T 24 6 T 48 6 T 72 6 T 96 6 L 96 65 L -24 65 Z"
              fill="#B89EE3"
              fillOpacity="0.65"
              animate={prefersReducedMotion ? undefined : { x: [0, -24] }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 2.2, repeat: Infinity, ease: 'linear' }
              }
            />
            <motion.path
              d="M -24 8 Q -12 12, 0 8 T 24 8 T 48 8 T 72 8 T 96 8 L 96 65 L -24 65 Z"
              fill="#7E5CAE"
              fillOpacity="0.82"
              animate={prefersReducedMotion ? undefined : { x: [-24, 0] }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 2.8, repeat: Infinity, ease: 'linear' }
              }
            />
          </motion.g>
        </g>

        {/* Measurement Ticks */}
        <line x1="38" y1="42" x2="46" y2="42" stroke="#6D4C94" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="40" y1="53" x2="46" y2="53" stroke="#6D4C94" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="38" y1="64" x2="46" y2="64" stroke="#6D4C94" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="40" y1="75" x2="46" y2="75" stroke="#6D4C94" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function FeedTimelineCard({
  babyName,
  feedLogs,
  onAddFeed,
  onRemoveFeed,
}: FeedTimelineCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [sideOrType, setSideOrType] = useState<FeedSideOrType>('Left');
  const [amountOrDuration, setAmountOrDuration] = useState<string>('15 min');
  const [timeInput, setTimeInput] = useState<string>(() => getCurrentTimeInputValue());
  const [lastLoggedFeed, setLastLoggedFeed] = useState<FeedLogEntry | null>(null);
  const [timelineOpen, setTimelineOpen] = useState<boolean>(false);

  const sortedFeeds = [...feedLogs].sort((a, b) => b.timestampMs - a.timestampMs);
  const presets = sideOrType === 'Bottle' ? BOTTLE_PRESETS : DURATION_PRESETS;

  const handleSelectSideOrType = (next: FeedSideOrType) => {
    setSideOrType(next);
    if (next === 'Bottle' && !amountOrDuration.includes('oz')) {
      setAmountOrDuration('4 oz');
    } else if (next !== 'Bottle' && amountOrDuration.includes('oz')) {
      setAmountOrDuration('15 min');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedAmount =
      amountOrDuration.trim() || (sideOrType === 'Bottle' ? '4 oz' : '15 min');
    const timeLabel = formatTimeInputToLabel(timeInput);
    const newestExistingMs = sortedFeeds[0]?.timestampMs;
    const timestampMs = buildTimestampFromTimeInput(timeInput, newestExistingMs);

    const newEntry: Omit<FeedLogEntry, 'id'> = {
      sideOrType,
      amountOrDuration: trimmedAmount,
      timeLabel,
      timestampMs,
    };

    onAddFeed(newEntry);
    setLastLoggedFeed({
      id: `logged-${Date.now()}`,
      ...newEntry,
    });
    setTimelineOpen(true);
    setTimeInput(getCurrentTimeInputValue());
  };

  return (
    <section
      aria-label="Night Feed & Feeding Tracker"
      className="bg-white rounded-3xl border border-[#E7DFF2] p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#ECE4F6]">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#261C35] flex items-center gap-2">
            <Milk className="w-5 h-5 text-[#6D4C94] shrink-0" aria-hidden="true" />
            <span>Night Feed &amp; Feeding Tracker</span>
          </h2>
          <p className="text-[14px] text-[#685780]">
            Log {babyName}’s nursing side or bottle and track time between feeds.
          </p>
        </div>
      </div>

      {/* Quick Feed Logger */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {SIDE_OR_TYPE_OPTIONS.map((option) => {
            const active = sideOrType === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleSelectSideOrType(option)}
                aria-pressed={active}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-[14px] font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#6D4C94] text-white'
                    : 'bg-[#F5F0FB] text-[#473561] hover:bg-[#EAE0F7]'
                }`}
              >
                {option}
              </button>
            );
          })}

          <div className="h-5 w-px bg-[#E4DBF2] mx-0.5 hidden sm:block" aria-hidden="true" />

          {presets.map((preset) => {
            const active = amountOrDuration === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setAmountOrDuration(preset)}
                aria-pressed={active}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-[13px] font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#EAE0F7] text-[#3F2761] ring-1 ring-[#6D4C94]/40'
                    : 'bg-[#FAF7FE] text-[#5B4C72] hover:bg-[#F2EBFB]'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
          <input
            type="text"
            value={amountOrDuration}
            onChange={(e) => setAmountOrDuration(e.target.value)}
            aria-label={sideOrType === 'Bottle' ? 'Ounces' : 'Duration'}
            placeholder={sideOrType === 'Bottle' ? 'e.g. 4 oz' : 'e.g. 15 min'}
            className="flex-1 min-w-[130px] min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px] text-[#261C35]"
          />

          <div className="relative flex items-center">
            <Clock
              className="w-4 h-4 text-[#6D4C94] absolute left-3 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="time"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              aria-label="Feed time"
              className="min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px] text-[#261C35]"
            />
          </div>

          <button
            type="submit"
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#6D4C94] hover:bg-[#593B7D] text-white font-semibold text-[15px] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Log feed</span>
          </button>
        </div>
      </form>

      {/* Animated Baby Bottle & Feed Logged Summary (appears right after logging a feed) */}
      <AnimatePresence>
        {lastLoggedFeed && (
          <motion.div
            key={lastLoggedFeed.id}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl bg-[#FAF7FE] border border-[#E4D8F4] p-4 flex items-center gap-4"
          >
            <AnimatedBabyBottle animKey={lastLoggedFeed.id} />

            <div className="space-y-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#5C3A88]">
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Feed logged</span>
              </div>
              <p className="text-[17px] font-semibold text-[#261C35]">
                {lastLoggedFeed.sideOrType} · {lastLoggedFeed.amountOrDuration} ·{' '}
                {lastLoggedFeed.timeLabel}
              </p>
              <p className="text-[13px] text-[#685780]">
                Added to {babyName}’s feeding timeline below.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Past Feeds Collapsible Toggle Link */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setTimelineOpen((prev) => !prev)}
          aria-expanded={timelineOpen}
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#5C3A88] hover:text-[#3D2460] py-1 transition-colors"
        >
          <span>Past feeds ({sortedFeeds.length})</span>
          {timelineOpen ? (
            <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
        </button>

        {/* Chronological Past Feeds Timeline */}
        <AnimatePresence initial={false}>
          {timelineOpen && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pl-3">
                {sortedFeeds.length === 0 ? (
                  <p className="text-[14px] text-[#685780] py-2">No feeds logged yet.</p>
                ) : (
                  <ol className="relative border-l-2 border-[#E4D8F4] space-y-4 pl-5 py-1">
                    {sortedFeeds.map((feed, idx) => {
                      const nextOlder = sortedFeeds[idx + 1];
                      const gapLabel = nextOlder
                        ? formatGapLabel(feed.timestampMs, nextOlder.timestampMs)
                        : null;
                      const isLatest = idx === 0;

                      return (
                        <li key={feed.id} className="relative">
                          <span
                            aria-hidden="true"
                            className={`absolute -left-[27px] top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${
                              isLatest ? 'bg-[#6D4C94]' : 'bg-[#C4AEE6]'
                            }`}
                          />

                          <div className="flex items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2 text-[15px]">
                              <span className="font-semibold text-[#261C35]">
                                {feed.timeLabel}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-lg bg-[#F5F0FB] text-[#4C3270] text-[13px] font-semibold">
                                {feed.sideOrType}
                              </span>
                              <span className="text-[#4E3E66] font-medium">
                                {feed.amountOrDuration}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => onRemoveFeed(feed.id)}
                              aria-label={`Remove ${feed.timeLabel} feed`}
                              className="min-h-[34px] min-w-[34px] rounded-lg text-[#7E6E96] hover:bg-[#F5F0FB] hover:text-[#4C3270] inline-flex items-center justify-center shrink-0 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>

                          {gapLabel && (
                            <p className="mt-1.5 text-[12px] font-medium text-[#7A6894]">
                              {gapLabel}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
