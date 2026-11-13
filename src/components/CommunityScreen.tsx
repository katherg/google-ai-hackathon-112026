import { FormEvent, useState } from 'react';
import { Check, Heart, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import {
  MayaProfile,
  PrivacySettings,
  SocialPost,
  SupportCircleMember,
  SupportCircleState,
  SupportCircleTask,
  SupportGroup,
} from '../types';
import { SupportCircleSection } from './SupportCircleSection';

interface CommunityScreenProps {
  profile: MayaProfile;
  privacy: PrivacySettings;
  groups: SupportGroup[];
  posts: SocialPost[];
  supportCircle: SupportCircleState;
  onToggleJoinGroup: (groupId: string) => void;
  onCreatePost: (content: string, groupName: string, isAnonymous: boolean) => void;
  onToggleWarmth: (postId: string) => void;
  onAddReply: (postId: string, replyText: string) => void;
  onInviteCircleMember: (
    name: string,
    relationship: SupportCircleMember['relationship'],
    note: string
  ) => void;
  onToggleClaimCircleTask: (taskId: string, helperLabel: string) => void;
  onAddCircleTask: (
    kind: SupportCircleTask['kind'],
    title: string,
    dateTimeLabel: string
  ) => void;
}

export function CommunityScreen({
  groups,
  posts,
  privacy,
  supportCircle,
  onToggleJoinGroup,
  onCreatePost,
  onToggleWarmth,
  onAddReply,
  onInviteCircleMember,
  onToggleClaimCircleTask,
  onAddCircleTask,
}: CommunityScreenProps) {
  const [sectionView, setSectionView] = useState<'feed' | 'groups' | 'circle'>('groups');
  const [newPostText, setNewPostText] = useState('');
  const [selectedGroupName, setSelectedGroupName] = useState('First-time mothers');
  const [postAnonymously, setPostAnonymously] = useState(privacy.anonymousInCommunity);
  const [activeReplyPostId, setActiveReplyPostId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');

  const handlePostSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newPostText.trim();
    if (!trimmed) return;
    onCreatePost(trimmed, selectedGroupName, postAnonymously);
    setNewPostText('');
  };

  const handleReplySubmit = (e: FormEvent, postId: string) => {
    e.preventDefault();
    const trimmed = replyDraft.trim();
    if (!trimmed) return;
    onAddReply(postId, trimmed);
    setReplyDraft('');
    setActiveReplyPostId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header + Segmented Switcher */}
      <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold text-[#261C35]">Community</h1>
            <p className="text-[15px] text-[#685780] flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-4 h-4 text-[#6D4C94] shrink-0" aria-hidden="true" />
              <span>Trained peer moderators · Clinician review for health claims</span>
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Community sections"
            className="flex items-center gap-1 p-1 bg-[#F5F0FB] rounded-2xl self-start"
          >
            {(
              [
                { id: 'groups', label: 'Groups' },
                { id: 'feed', label: 'Feed' },
                { id: 'circle', label: 'Support circle' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={sectionView === tab.id}
                onClick={() => setSectionView(tab.id)}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-[15px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  sectionView === tab.id
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

      {/* Groups by life stage & identity */}
      {sectionView === 'groups' && (
        <section
          aria-label="Support groups"
          className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 divide-y divide-[#ECE4F6]"
        >
          {groups.map((group) => (
            <div
              key={group.id}
              className="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-0.5 max-w-2xl">
                <h2 className="text-[18px] font-semibold text-[#261C35]">{group.name}</h2>
                <p className="text-[14px] text-[#6D4C94] tabular-nums">
                  {group.memberCount} members · {group.meetingSchedule}
                  {group.moderationBadge ? ` · ${group.moderationBadge}` : ''}
                </p>
                <p className="text-[15px] text-[#4E3E66]">{group.description}</p>
              </div>

              <button
                type="button"
                onClick={() => onToggleJoinGroup(group.id)}
                aria-pressed={group.joined}
                className={`min-h-[44px] px-4 py-2 rounded-xl font-semibold text-[15px] inline-flex items-center gap-1.5 self-start sm:self-center whitespace-nowrap shrink-0 ${
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
        </section>
      )}

      {/* Feed with anonymous posting option */}
      {sectionView === 'feed' && (
        <div className="space-y-6">
          <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 space-y-4">
            <form onSubmit={handlePostSubmit} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <select
                  aria-label="Group"
                  value={selectedGroupName}
                  onChange={(e) => setSelectedGroupName(e.target.value)}
                  className="min-h-[42px] px-3.5 py-1.5 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px] text-[#261C35]"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>

                <label className="inline-flex items-center gap-2 text-[15px] text-[#4E3E66] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postAnonymously}
                    onChange={(e) => setPostAnonymously(e.target.checked)}
                    className="w-4 h-4 accent-[#6D4C94]"
                  />
                  <span>Post anonymously</span>
                </label>
              </div>

              <textarea
                rows={2}
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="Share what’s on your mind..."
                className="w-full p-3.5 rounded-2xl border border-[#D8C9EC] bg-[#FCFAFF] text-[16px] text-[#261C35] placeholder:text-[#86769C] focus:outline-none focus:border-[#6D4C94]"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newPostText.trim()}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#6D4C94] hover:bg-[#593B7D] disabled:opacity-50 text-white font-semibold text-[15px] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Send className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Post</span>
                </button>
              </div>
            </form>
          </section>

          <section className="bg-white rounded-[26px] border border-[#E7DFF2] shadow-[0_6px_24px_-12px_rgba(38,28,53,0.08)] p-6 divide-y divide-[#ECE4F6]">
            {posts.map((post) => {
              const isReplying = activeReplyPostId === post.id;
              return (
                <article key={post.id} className="py-5 first:pt-1 last:pb-1 space-y-3">
                  <div>
                    <p className="text-[16px] font-semibold text-[#261C35]">
                      {post.authorName}{' '}
                      <span className="font-normal text-[14px] text-[#685780]">
                        · {post.babyInfo} · {post.timeAgo}
                        {post.groupTag ? ` · ${post.groupTag}` : ''}
                      </span>
                    </p>
                  </div>

                  <p className="text-[16px] text-[#322447] leading-relaxed">{post.content}</p>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onToggleWarmth(post.id)}
                      aria-pressed={post.warmthSent}
                      className={`min-h-[42px] px-3.5 py-1.5 rounded-xl text-[14px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${
                        post.warmthSent
                          ? 'bg-[#EBE0F8] text-[#4E3275]'
                          : 'bg-[#F7F3FC] text-[#55456B] hover:bg-[#EDE4F8]'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 shrink-0 ${post.warmthSent ? 'fill-current' : ''}`}
                        aria-hidden="true"
                      />
                      <span>{post.warmthCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveReplyPostId(isReplying ? null : post.id);
                        setReplyDraft('');
                      }}
                      className="min-h-[42px] px-3.5 py-1.5 rounded-xl bg-[#F7F3FC] hover:bg-[#EDE4F8] text-[#55456B] text-[14px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Reply ({post.replies.length})</span>
                    </button>
                  </div>

                  {post.replies.length > 0 && (
                    <div className="pt-2 pl-4 border-t border-[#F2ECF9] space-y-1.5">
                      {post.replies.map((rep) => (
                        <p key={rep.id} className="text-[15px] text-[#43335A]">
                          <strong>{rep.authorName}</strong> · {rep.text}
                        </p>
                      ))}
                    </div>
                  )}

                  {isReplying && (
                    <form
                      onSubmit={(e) => handleReplySubmit(e, post.id)}
                      className="flex gap-2 pt-1"
                    >
                      <input
                        type="text"
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Write a kind reply..."
                        className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px]"
                      />
                      <button
                        type="submit"
                        disabled={!replyDraft.trim()}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-[#6D4C94] text-white font-semibold text-[14px]"
                      >
                        Send
                      </button>
                    </form>
                  )}
                </article>
              );
            })}
          </section>
        </div>
      )}

      {/* Support Circle */}
      {sectionView === 'circle' && (
        <SupportCircleSection
          circle={supportCircle}
          onInviteMember={onInviteCircleMember}
          onToggleClaimTask={onToggleClaimCircleTask}
          onAddTask={onAddCircleTask}
        />
      )}
    </div>
  );
}
