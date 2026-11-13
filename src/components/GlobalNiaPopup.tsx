import { FormEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  LifeBuoy,
  Maximize2,
  MessageCircleHeart,
  Mic,
  Send,
  X,
} from 'lucide-react';
import { ChatMessage, MayaProfile, MoodOption } from '../types';
import { detectSelfHarmIntent } from '../utils/supportLogic';

interface GlobalNiaPopupProps {
  visible: boolean;
  profile: MayaProfile;
  messages: ChatMessage[];
  isSending: boolean;
  crisisLockActive: boolean;
  onSendMessage: (text: string, mood?: MoodOption) => void;
  onOpenFullDrawer: (startInVoice?: boolean) => void;
  onOpenHelp: () => void;
}

export function GlobalNiaPopup({
  visible,
  profile,
  messages,
  isSending,
  crisisLockActive,
  onSendMessage,
  onOpenFullDrawer,
  onOpenHelp,
}: GlobalNiaPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!visible) {
      setIsOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isOpen, messages, isSending]);

  if (!visible) return null;

  const isCrisisDraft = detectSelfHarmIntent(draft);
  const recentMessages = messages.slice(-8);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || crisisLockActive) return;
    if (isSending && !isCrisisDraft) return;
    onSendMessage(trimmed);
    setDraft('');
  };

  return (
    <div className="fixed bottom-20 right-4 sm:right-6 z-40 flex flex-col items-end">
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.section
            key="nia-popup-card"
            aria-label="Quick chat with Nia"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-[calc(100vw-2rem)] sm:w-[360px] max-h-[430px] bg-white rounded-3xl border border-[#DFD2F0] shadow-2xl shadow-[#261C35]/15 flex flex-col overflow-hidden"
          >
            {/* Compact Header */}
            <div className="px-4 py-3 bg-[#FAF7FE] border-b border-[#ECE4F6] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <MessageCircleHeart className="w-4 h-4 text-[#6D4C94] shrink-0" aria-hidden="true" />
                  <h2 className="font-display text-[17px] font-semibold text-[#261C35] truncate">
                    Nia
                  </h2>
                </div>
                <p className="text-[11px] text-[#685780] truncate">
                  Support only · Never diagnoses
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenFullDrawer(true);
                  }}
                  aria-label="Talk to Nia by voice"
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-[#EAE0F7] hover:bg-[#DDD0F2] text-[#3F2761] text-[12px] font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                >
                  <Mic className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Voice</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenFullDrawer(false);
                  }}
                  aria-label="Expand Nia chat"
                  className="min-h-[36px] min-w-[36px] rounded-xl hover:bg-[#EAE0F7] text-[#5B4C72] inline-flex items-center justify-center transition-colors"
                >
                  <Maximize2 className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close Nia popup"
                  className="min-h-[36px] min-w-[36px] rounded-xl hover:bg-[#EAE0F7] text-[#5B4C72] inline-flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Crisis Safety Banner */}
            {crisisLockActive ? (
              <div className="p-4 space-y-3 overflow-y-auto">
                <div className="rounded-2xl bg-[#FFF5F6] border border-[#F5B7C2] p-3.5 space-y-2.5">
                  <p className="text-[14px] font-semibold text-[#7F1D1D]">
                    Immediate support is here for you, {profile.name}.
                  </p>
                  <div className="flex flex-col gap-2">
                    <a
                      href="tel:988"
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-[#9F1239] text-white text-[13px] font-semibold text-center"
                    >
                      Call or text 988 (24/7 Lifeline)
                    </a>
                    <a
                      href="tel:18338526262"
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-white border border-[#E5B8C2] text-[#7F1D1D] text-[13px] font-semibold text-center"
                    >
                      1-833-TLC-MAMA (24/7 Maternal)
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenHelp();
                      }}
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-[#FDE8EC] text-[#7F1D1D] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"
                    >
                      <LifeBuoy className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>All 5 Help tiers</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Mini Chat History */}
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 min-h-[190px] max-h-[270px] bg-white"
                >
                  {recentMessages.map((msg) => {
                    const isUser = msg.sender === 'user';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${
                            isUser
                              ? 'bg-[#6D4C94] text-white rounded-br-sm'
                              : 'bg-[#F5F0FB] text-[#261C35] rounded-bl-sm'
                          }`}
                        >
                          <p>{msg.text}</p>
                          {!isUser && msg.tinyStep && (
                            <p className="mt-1.5 pt-1.5 border-t border-[#E2D6F2] text-[12px] text-[#5B3D80] font-medium">
                              Tiny step: {msg.tinyStep}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {isSending && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl px-3.5 py-2 bg-[#F5F0FB] text-[#685780] text-[13px]">
                        Nia is thinking…
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Composer */}
                <form
                  onSubmit={handleSubmit}
                  className="p-2.5 border-t border-[#ECE4F6] bg-[#FCFAFF] flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Ask Nia anything, ${profile.name}...`}
                    aria-label="Message Nia"
                    className="flex-1 min-w-0 min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D8C9EC] bg-white text-[14px] text-[#261C35] focus:outline-none focus:ring-2 focus:ring-[#6D4C94]"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || (isSending && !isCrisisDraft)}
                    aria-label="Send message to Nia"
                    className="min-h-[40px] min-w-[40px] rounded-xl bg-[#6D4C94] hover:bg-[#593B7D] disabled:opacity-45 text-white inline-flex items-center justify-center shrink-0 transition-colors"
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                  </button>
                </form>
              </>
            )}
          </motion.section>
        ) : (
          <motion.button
            key="nia-popup-launcher"
            type="button"
            onClick={() => setIsOpen(true)}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.16 }}
            aria-label="Open quick chat with Nia"
            className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#6D4C94] hover:bg-[#593B7D] text-white font-semibold text-[15px] shadow-lg shadow-[#261C35]/20 inline-flex items-center gap-2 whitespace-nowrap transition-colors"
          >
            <MessageCircleHeart className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>Talk to Nia</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
