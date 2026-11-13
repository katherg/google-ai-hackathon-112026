import { FormEvent, useState } from 'react';
import { Check, Plus, RotateCcw, UserPlus } from 'lucide-react';
import { PARTNER_WATCH_TIPS } from '../data/demoData';
import { SupportCircleMember, SupportCircleState, SupportCircleTask } from '../types';

interface SupportCircleSectionProps {
  circle: SupportCircleState;
  onInviteMember: (
    name: string,
    relationship: SupportCircleMember['relationship'],
    note: string
  ) => void;
  onToggleClaimTask: (taskId: string, helperLabel: string) => void;
  onAddTask: (
    kind: SupportCircleTask['kind'],
    title: string,
    dateTimeLabel: string
  ) => void;
}

export function SupportCircleSection({
  circle,
  onInviteMember,
  onToggleClaimTask,
  onAddTask,
}: SupportCircleSectionProps) {
  const [inviteName, setInviteName] = useState('');
  const [inviteRelation, setInviteRelation] =
    useState<SupportCircleMember['relationship']>('Friend');

  const [selectedHelper, setSelectedHelper] = useState<string>('Jordan (Partner)');
  const [newTaskKind, setNewTaskKind] = useState<SupportCircleTask['kind']>('meal');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskWhen, setNewTaskWhen] = useState('');

  const helperOptions = circle.members.map((m) => `${m.name} (${m.relationship})`);

  const handleInviteSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inviteName.trim();
    if (!trimmed) return;
    onInviteMember(trimmed, inviteRelation, 'Invited');
    setSelectedHelper(`${trimmed} (${inviteRelation})`);
    setInviteName('');
  };

  const handleAddTaskSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask(newTaskKind, newTaskTitle.trim(), newTaskWhen.trim() || 'This week');
    setNewTaskTitle('');
    setNewTaskWhen('');
  };

  return (
    <section
      aria-label="Support circle for meals, rides, and visits"
      className="bg-white rounded-3xl border border-[#E7DFF2] p-6 space-y-5"
    >
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-semibold text-[#261C35]">
          Support circle
        </h2>
        <p className="text-[15px] text-[#5B4C72]">
          Invite partner, friends, and family for meals, rides, and visits.
        </p>
      </div>

      {/* Members + Quick Invite */}
      <div className="space-y-3 pt-2 border-t border-[#ECE4F6]">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[15px] text-[#261C35]">
          {circle.members.map((m) => (
            <span key={m.id}>
              <strong>{m.name}</strong> · {m.relationship}
            </span>
          ))}
        </div>

        <form onSubmit={handleInviteSubmit} className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="circle-invite-name" className="sr-only">
            Person's name
          </label>
          <input
            id="circle-invite-name"
            type="text"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Invite partner, friend, or family..."
            className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px] text-[#261C35]"
          />
          <label htmlFor="circle-invite-relation" className="sr-only">
            Relationship
          </label>
          <select
            id="circle-invite-relation"
            value={inviteRelation}
            onChange={(e) =>
              setInviteRelation(e.target.value as SupportCircleMember['relationship'])
            }
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px] text-[#261C35]"
          >
            <option value="Partner">Partner</option>
            <option value="Friend">Friend</option>
            <option value="Family">Family</option>
            <option value="Neighbor">Neighbor</option>
          </select>
          <button
            type="submit"
            disabled={!inviteName.trim()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#6D4C94] hover:bg-[#593B7D] disabled:opacity-50 text-white font-semibold text-[15px] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Invite</span>
          </button>
        </form>
      </div>

      {/* Sign-ups */}
      <div className="space-y-3 pt-3 border-t border-[#ECE4F6]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[17px] font-semibold text-[#261C35]">
            Meals, rides & visits
          </h3>
          <select
            aria-label="Signing up as"
            value={selectedHelper}
            onChange={(e) => setSelectedHelper(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[14px] text-[#261C35]"
          >
            {helperOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="divide-y divide-[#EFE9F8]">
          {circle.tasks.map((task) => {
            const isClaimed = Boolean(task.claimedBy);
            return (
              <div
                key={task.id}
                className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <p className="text-[16px] font-semibold text-[#261C35]">{task.title}</p>
                  <p className="text-[14px] text-[#685780]">
                    {task.kind} · {task.dateTimeLabel}
                    {isClaimed ? ` · Claimed by ${task.claimedBy}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleClaimTask(task.id, selectedHelper)}
                  aria-pressed={isClaimed}
                  className={`min-h-[42px] px-4 py-2 rounded-xl font-semibold text-[14px] inline-flex items-center gap-1.5 self-start sm:self-center whitespace-nowrap shrink-0 ${
                    isClaimed
                      ? 'bg-[#EAE0F7] text-[#432B66]'
                      : 'bg-[#6D4C94] text-white hover:bg-[#593B7D]'
                  }`}
                >
                  {isClaimed ? (
                    <>
                      <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Signed up</span>
                      <RotateCcw className="w-3.5 h-3.5 opacity-75 shrink-0" aria-hidden="true" />
                    </>
                  ) : (
                    <span>Sign up</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddTaskSubmit} className="flex flex-wrap sm:flex-nowrap gap-2 pt-1">
          <select
            aria-label="Need type"
            value={newTaskKind}
            onChange={(e) => setNewTaskKind(e.target.value as SupportCircleTask['kind'])}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[14px]"
          >
            <option value="meal">Meal</option>
            <option value="ride">Ride</option>
            <option value="visit">Visit</option>
          </select>
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add meal, ride, or visit..."
            className="flex-1 min-w-[160px] min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px]"
          />
          <input
            type="text"
            value={newTaskWhen}
            onChange={(e) => setNewTaskWhen(e.target.value)}
            placeholder="When (e.g. Wed 6 PM)"
            className="sm:w-36 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D8C9EC] bg-[#FCFAFF] text-[15px]"
          />
          <button
            type="submit"
            disabled={!newTaskTitle.trim()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F4EFFA] hover:bg-[#E7DCF5] disabled:opacity-50 text-[#482F6B] font-semibold text-[14px] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* Tips for partners on what to watch for */}
      <div className="pt-3 border-t border-[#ECE4F6] space-y-2">
        <h3 className="text-[16px] font-semibold text-[#261C35]">
          Tips for partners on what to watch for
        </h3>
        <ul className="space-y-1 text-[15px] text-[#4E3E66] list-disc pl-5">
          {PARTNER_WATCH_TIPS.map((tip, idx) => (
            <li key={idx}>{tip}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
