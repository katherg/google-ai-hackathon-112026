import { Phone } from 'lucide-react';
import { CRISIS_RESOURCES } from '../data/demoData';

interface CrisisResourcesCardProps {
  urgentMode?: boolean;
  heading?: string;
  highlightedTierIds?: string[];
  onResumeSafeChat?: () => void;
}

export function CrisisResourcesCard({
  urgentMode = false,
  heading = 'Help & 24/7 support',
  highlightedTierIds = [],
  onResumeSafeChat,
}: CrisisResourcesCardProps) {
  return (
    <section
      aria-label={urgentMode ? 'Please reach out now crisis support' : 'Immediate help resources'}
      className={`rounded-3xl p-5 sm:p-6 border ${
        urgentMode
          ? 'bg-[#FFF3F6] border-[#DF9FB2]'
          : 'bg-[#FBF5F8] border-[#E8CED9]'
      }`}
    >
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-semibold text-[#4C0D24]">
          {urgentMode ? 'Please reach out now' : heading}
        </h2>
        <p className="text-[16px] text-[#5F2137]">
          {urgentMode
            ? 'Free, confidential 24/7 human support. Call or text right now.'
            : 'Tiered by urgency — one tap to call or text.'}
        </p>
      </div>

      <div className="mt-4 divide-y divide-[#EAD3DC]">
        {CRISIS_RESOURCES.map((item) => {
          const isHighlighted = highlightedTierIds.includes(item.id);
          const isUrgent = item.tierNumber <= 2;
          return (
            <div
              key={item.id}
              className={`py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isHighlighted ? 'bg-white/80 rounded-2xl px-3.5 my-1' : ''
              }`}
            >
              <div className="space-y-0.5">
                <p className="text-[17px] font-semibold text-[#3B0A1D] tabular-nums">
                  {item.tierNumber}. {item.shortTitle}
                </p>
                <p className="text-[15px] text-[#683247]">{item.shortDetail}</p>
              </div>
              <a
                href={item.href}
                className={`min-h-[44px] px-4 py-2 rounded-xl font-semibold text-[15px] inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                  isUrgent || urgentMode || isHighlighted
                    ? 'bg-[#9F1239] text-white hover:bg-[#881337]'
                    : 'bg-white text-[#881337] border border-[#D9A7B8] hover:bg-[#FCE8EE]'
                }`}
              >
                <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.actionLabel}</span>
              </a>
            </div>
          );
        })}
      </div>

      {urgentMode && onResumeSafeChat && (
        <div className="mt-4 pt-3 border-t border-[#EAD3DC] flex justify-end">
          <button
            type="button"
            onClick={onResumeSafeChat}
            className="min-h-[44px] px-4 py-2 rounded-xl text-[15px] font-medium text-[#5F2137] bg-white border border-[#DFB5C3] hover:bg-[#FDF2F6] transition-colors whitespace-nowrap shrink-0"
          >
            I am safe — return to chat
          </button>
        </div>
      )}
    </section>
  );
}
