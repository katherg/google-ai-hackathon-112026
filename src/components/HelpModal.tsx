import { ArrowRight, X } from 'lucide-react';
import { CareSubTab, TabId } from '../types';
import { CrisisResourcesCard } from './CrisisResourcesCard';

interface HelpModalProps {
  open: boolean;
  warmHandoffMode?: boolean;
  highlightedTierIds?: string[];
  onClose: () => void;
  onNavigateTab: (tab: TabId, careSubTab?: CareSubTab) => void;
  onOpenNia: () => void;
}

export function HelpModal({
  open,
  warmHandoffMode = false,
  highlightedTierIds = [],
  onClose,
  onNavigateTab,
  onOpenNia,
}: HelpModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#221533]/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Help and 24/7 support tiers"
    >
      <div className="bg-[#FAF8FC] w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[#E4D8F3] p-5 sm:p-6 space-y-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-semibold text-[#261C35]">
              {warmHandoffMode ? 'Warm handoff to care' : 'Help'}
            </h2>
            <p className="text-[16px] text-[#55456B]">
              {warmHandoffMode
                ? 'Your check-in felt heavy. Connect with live support or find a therapist nearby.'
                : 'One tap away, 24/7.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Help"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white border border-[#E2D6F2] text-[#3D2B56] hover:bg-[#F3ECF9] inline-flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {warmHandoffMode && (
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateTab(TabId.Care, 'find_care');
              }}
              className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#6D4C94] hover:bg-[#593B7D] text-white font-semibold text-[15px] inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <span>Find PMH-C therapist</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNia();
              }}
              className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-white border border-[#DFD2F0] hover:bg-[#F4EFFA] text-[#4C3270] font-semibold text-[15px] whitespace-nowrap shrink-0"
            >
              Talk to Nia
            </button>
          </div>
        )}

        <CrisisResourcesCard
          heading="Choose what fits right now"
          highlightedTierIds={highlightedTierIds}
        />
      </div>
    </div>
  );
}
