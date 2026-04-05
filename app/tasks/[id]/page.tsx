'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { id as instantId } from '@instantdb/react';
import db from '@/lib/instant';
import Sidebar from '@/app/components/Sidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskType   = 'Patch Development' | 'Config Fix' | 'Monitoring Rule' | 'Code Review' | 'Documentation' | 'Other';
type TaskStatus = 'Open' | 'In Progress' | 'Blocked' | 'Ready for Review' | 'Done';
type Priority   = 'P1' | 'P2' | 'P3' | 'P4';

interface ChecklistItem { id: string; text: string; done: boolean; }

interface TaskDraft {
  title: string;
  description: string;
  taskType: TaskType | '';
  assignedTeam: string;
  assignedOwner: string;
  priority: Priority;
  dueDate: string;
  jiraLink: string;
  githubLink: string;
  agileplacLink: string;
  notes: string;
  checklist: ChecklistItem[];
}

interface PersistedTask extends TaskDraft {
  id: string;
  taskNumber: string;
  status: TaskStatus;
  createdAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_TYPES: TaskType[] = ['Patch Development', 'Config Fix', 'Monitoring Rule', 'Code Review', 'Documentation', 'Other'];
const TEAMS = ['Security', 'Development', 'DevOps', 'CloudOps', 'Platform', 'QA', 'Compliance'];

const TASK_TYPE_ICONS: Record<TaskType, string> = {
  'Patch Development': '🔧',
  'Config Fix':        '⚙',
  'Monitoring Rule':   '📡',
  'Code Review':       '🔍',
  'Documentation':     '📄',
  'Other':             '📌',
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  'Open':              'bg-slate-700 text-slate-300 border-slate-600',
  'In Progress':       'bg-orange-500/10 text-orange-400 border-orange-500/30',
  'Blocked':           'bg-red-500/10 text-red-400 border-red-500/30',
  'Ready for Review':  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  'Done':              'bg-green-500/10 text-green-400 border-green-500/30',
};

const PRIORITY_STYLE: Record<Priority, string> = {
  P1: 'bg-red-500/10 border-red-500/40 text-red-400',
  P2: 'bg-orange-500/10 border-orange-500/40 text-orange-400',
  P3: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400',
  P4: 'bg-slate-700 border-slate-600 text-slate-300',
};

const ALL_STATUSES: TaskStatus[] = ['Open', 'In Progress', 'Blocked', 'Ready for Review', 'Done'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyDraft(): TaskDraft {
  return {
    title: '', description: '', taskType: '',
    assignedTeam: '', assignedOwner: '',
    priority: 'P2',
    dueDate: '',
    jiraLink: '', githubLink: '', agileplacLink: '',
    notes: '', checklist: [],
  };
}

function taskNumberFor(index: number): string {
  return `TASK-${String(index + 1).padStart(3, '0')}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-300 mb-1.5">
      {children}
      {hint && <span className="text-slate-500 font-normal ml-1.5 text-xs">{hint}</span>}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition" />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} rows={3}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition resize-none" />
  );
}



function LifecycleBar({ active }: { active: number }) {
  const steps = ['Log Vulnerability', 'Impact Assessment', 'Triage', 'Task Creation', 'Remediation'];
  return (
    <div className="flex items-center gap-0 overflow-x-auto mb-8">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center shrink-0">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              i < active  ? 'border-green-500 bg-green-500/10 text-green-400'
              : i === active ? 'border-red-500 bg-red-500 text-white'
              : 'border-slate-700 bg-slate-800 text-slate-500'
            }`}>
              {i < active ? '✓' : i + 1}
            </div>
            <span className={`text-xs whitespace-nowrap hidden sm:block ${i === active ? 'text-white' : 'text-slate-500'}`}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-10 mx-1 mb-4 ${i < active ? 'bg-green-500/40' : 'bg-slate-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Task Form Modal ──────────────────────────────────────────────────────────

function TaskFormPanel({
  draft, onChange, onSave, onCancel, saving, isEdit,
}: {
  draft: TaskDraft;
  onChange: <K extends keyof TaskDraft>(key: K, val: TaskDraft[K]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isEdit: boolean;
}) {
  const [checkInput, setCheckInput] = useState('');

  function addChecklistItem() {
    if (!checkInput.trim()) return;
    onChange('checklist', [
      ...draft.checklist,
      { id: instantId(), text: checkInput.trim(), done: false },
    ]);
    setCheckInput('');
  }

  function toggleChecklistItem(id: string) {
    onChange('checklist', draft.checklist.map((c) => c.id === id ? { ...c, done: !c.done } : c));
  }

  function removeChecklistItem(id: string) {
    onChange('checklist', draft.checklist.filter((c) => c.id !== id));
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-end z-50 overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-950 border-l border-slate-800 min-h-screen p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-base">{isEdit ? 'Edit Task' : 'New Remediation Task'}</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition text-xl">✕</button>
        </div>

        <div className="space-y-5">
          {/* Title */}
          <div>
            <Label>Task Title <span className="text-red-500">*</span></Label>
            <Input value={draft.title} onChange={(e) => onChange('title', e.target.value)}
              placeholder="e.g. Patch OpenSSL to 3.1.4 on all prod servers" />
          </div>

          {/* Task Type */}
          <div>
            <Label>Task Type <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {TASK_TYPES.map((t) => (
                <button key={t} onClick={() => onChange('taskType', t)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-lg border-2 text-xs font-medium transition ${
                    draft.taskType === t
                      ? 'border-red-500 bg-red-500/10 text-red-300'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                  }`}>
                  <span className="text-lg">{TASK_TYPE_ICONS[t]}</span>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea value={draft.description} onChange={(e) => onChange('description', e.target.value)}
              placeholder="Describe what needs to be done, acceptance criteria, and any relevant context…" />
          </div>

          {/* Priority + Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Priority</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['P1','P2','P3','P4'] as Priority[]).map((p) => (
                  <button key={p} onClick={() => onChange('priority', p)}
                    className={`py-2 text-xs font-semibold rounded-lg border-2 transition ${
                      draft.priority === p ? PRIORITY_STYLE[p] : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={draft.dueDate} onChange={(e) => onChange('dueDate', e.target.value)} />
            </div>
          </div>

          {/* Assignment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Team</Label>
              <select value={draft.assignedTeam} onChange={(e) => onChange('assignedTeam', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition appearance-none">
                <option value="">Select team…</option>
                {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Owner</Label>
              <Input value={draft.assignedOwner} onChange={(e) => onChange('assignedOwner', e.target.value)}
                placeholder="Name or email…" />
            </div>
          </div>

          {/* External Links */}
          <div>
            <Label hint="Optional — sync with external tools">External Links</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs w-20 shrink-0">Jira</span>
                <Input value={draft.jiraLink} onChange={(e) => onChange('jiraLink', e.target.value)}
                  placeholder="https://your-org.atlassian.net/browse/PROJ-123" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs w-20 shrink-0">GitHub</span>
                <Input value={draft.githubLink} onChange={(e) => onChange('githubLink', e.target.value)}
                  placeholder="https://github.com/org/repo/issues/456" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs w-20 shrink-0">Agileplace</span>
                <Input value={draft.agileplacLink} onChange={(e) => onChange('agileplacLink', e.target.value)}
                  placeholder="https://app.leankit.com/card/…" />
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div>
            <Label hint="Track sub-steps for this task">Checklist</Label>
            <div className="flex gap-2 mb-2">
              <Input value={checkInput} onChange={(e) => setCheckInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                placeholder="Add a checklist item…" />
              <button onClick={addChecklistItem}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition shrink-0">
                Add
              </button>
            </div>
            {draft.checklist.length > 0 && (
              <ul className="space-y-1.5 mt-2">
                {draft.checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                    <button onClick={() => toggleChecklistItem(item.id)}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${
                        item.done ? 'bg-green-500 border-green-500 text-white' : 'border-slate-500'
                      }`}>
                      {item.done && <span className="text-xs leading-none">✓</span>}
                    </button>
                    <span className={`flex-1 text-sm ${item.done ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                      {item.text}
                    </span>
                    <button onClick={() => removeChecklistItem(item.id)}
                      className="text-slate-600 hover:text-red-400 transition text-xs">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label hint="Internal notes for this task">Notes</Label>
            <Textarea value={draft.notes} onChange={(e) => onChange('notes', e.target.value)}
              placeholder="Additional context, blockers, or handoff notes…" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onCancel}
              className="flex-1 border border-slate-700 text-slate-300 hover:text-white py-2.5 rounded-lg text-sm transition">
              Cancel
            </button>
            <button onClick={onSave} disabled={saving || !draft.title || !draft.taskType}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
              {saving
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                : isEdit ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task, onEdit, onStatusChange, onDelete,
}: {
  task: PersistedTask;
  onEdit: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onDelete: () => void;
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const doneItems  = task.checklist.filter((c) => c.done).length;
  const totalItems = task.checklist.length;
  const isOverdue  = task.dueDate && task.status !== 'Done' && new Date(task.dueDate) < new Date();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-500 font-mono text-xs shrink-0">{task.taskNumber}</span>
          <span className="text-lg shrink-0">{TASK_TYPE_ICONS[task.taskType as TaskType] ?? '📌'}</span>
          <span className={`text-xs font-bold shrink-0 ${
            task.priority === 'P1' ? 'text-red-400'
            : task.priority === 'P2' ? 'text-orange-400'
            : task.priority === 'P3' ? 'text-yellow-400'
            : 'text-slate-400'
          }`}>{task.priority}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Status dropdown */}
          <div className="relative">
            <button onClick={() => setShowStatusMenu(!showStatusMenu)}
              className={`text-xs px-2.5 py-1 rounded-full border transition ${STATUS_STYLE[task.status]}`}>
              {task.status} ▾
            </button>
            {showStatusMenu && (
              <div className="absolute right-0 top-8 z-10 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden w-44">
                {ALL_STATUSES.map((s) => (
                  <button key={s} onClick={() => { onStatusChange(s); setShowStatusMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-800 transition ${
                      task.status === s ? 'text-white bg-slate-800' : 'text-slate-300'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={onEdit}
            className="text-slate-400 hover:text-white text-xs px-2 py-1 border border-slate-700 rounded-lg hover:border-slate-500 transition">
            Edit
          </button>
          <button onClick={onDelete}
            className="text-slate-600 hover:text-red-400 text-xs px-2 py-1 border border-slate-800 hover:border-red-900 rounded-lg transition">
            ✕
          </button>
        </div>
      </div>

      {/* Title + type */}
      <h4 className="text-white font-medium text-sm mb-1 leading-snug">{task.title}</h4>
      <p className="text-slate-500 text-xs mb-3">{task.taskType}</p>

      {/* Description */}
      {task.description && (
        <p className="text-slate-400 text-xs leading-relaxed mb-3 line-clamp-2">{task.description}</p>
      )}

      {/* Checklist progress */}
      {totalItems > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Checklist</span>
            <span>{doneItems}/{totalItems}</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${totalItems ? (doneItems / totalItems) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-2">
          {task.assignedTeam && (
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
              {task.assignedTeam}
            </span>
          )}
          {task.assignedOwner && (
            <span className="text-xs text-slate-400">{task.assignedOwner}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* External links */}
          {task.jiraLink && (
            <a href={task.jiraLink} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded transition">
              Jira ↗
            </a>
          )}
          {task.githubLink && (
            <a href={task.githubLink} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-purple-400 hover:text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded transition">
              GitHub ↗
            </a>
          )}
          {task.agileplacLink && (
            <a href={task.agileplacLink} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-green-400 hover:text-green-300 border border-green-500/20 px-2 py-0.5 rounded transition">
              Agileplace ↗
            </a>
          )}
          {task.dueDate && (
            <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
              {isOverdue ? '⚠ ' : ''}Due {task.dueDate}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TaskCreationPage() {
  const router = useRouter();
  const { id: vulnInstantId } = useParams<{ id: string }>();

  const { isLoading: authLoading, user } = db.useAuth();
  const { data: vulnData }   = db.useQuery({ vulnerabilities: { $: { where: { id: vulnInstantId } } } });
  const { data: triageData } = db.useQuery({ triages: { $: { where: { vulnerabilityRef: vulnInstantId } } } });
  const { data: tasksData }  = db.useQuery({ tasks: { $: { where: { vulnerabilityRef: vulnInstantId } } } });

  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [draft,     setDraft]     = useState<TaskDraft>(emptyDraft());
  const [saving,    setSaving]    = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, user, router]);

  const changeDraft = useCallback(<K extends keyof TaskDraft>(key: K, val: TaskDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }, []);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const vuln   = vulnData?.vulnerabilities?.[0];
  const triage = triageData?.triages?.[0];
  const tasks  = [...(tasksData?.tasks ?? [])].sort((a, b) => (a.createdAt as number) - (b.createdAt as number)) as PersistedTask[];

  if (!vuln) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Task stats
  const totalTasks = tasks.length;
  const doneTasks  = tasks.filter((t) => t.status === 'Done').length;
  const blockedTasks = tasks.filter((t) => t.status === 'Blocked').length;

  // ── Open form for new task
  function handleNewTask() {
    setEditId(null);
    setDraft(emptyDraft());
    setShowForm(true);
  }

  // ── Open form for editing
  function handleEdit(task: PersistedTask) {
    setEditId(task.id);
    setDraft({
      title:          task.title,
      description:    task.description,
      taskType:       task.taskType as TaskType | '',
      assignedTeam:   task.assignedTeam,
      assignedOwner:  task.assignedOwner,
      priority:       task.priority as Priority,
      dueDate:        task.dueDate,
      jiraLink:       task.jiraLink,
      githubLink:     task.githubLink,
      agileplacLink:  task.agileplacLink,
      notes:          task.notes ?? '',
      checklist:      task.checklist,
    });
    setShowForm(true);
  }

  // ── Save task (create or update)
  async function handleSave() {
    if (!draft.title || !draft.taskType) return;
    setSaving(true);
    try {
      const tid = editId ?? instantId();
      const taskNum = editId
        ? tasks.find((t) => t.id === editId)?.taskNumber ?? taskNumberFor(tasks.length)
        : taskNumberFor(tasks.length);

      await db.transact(
        db.tx.tasks[tid].update({
          vulnerabilityRef: vulnInstantId,
          taskNumber:       taskNum,
          title:            draft.title,
          description:      draft.description,
          taskType:         draft.taskType,
          assignedTeam:     draft.assignedTeam,
          assignedOwner:    draft.assignedOwner,
          priority:         draft.priority,
          status:           editId ? (tasks.find((t) => t.id === editId)?.status ?? 'Open') : 'Open',
          dueDate:          draft.dueDate,
          jiraLink:         draft.jiraLink,
          githubLink:       draft.githubLink,
          agileplacLink:    draft.agileplacLink,
          notes:            draft.notes,
          checklist:        draft.checklist,
          dependencies:     [],
          updatedAt:        Date.now(),
          createdAt:        editId ? (tasks.find((t) => t.id === editId)?.createdAt ?? Date.now()) : Date.now(),
          createdBy:        user?.email ?? '',
        })
      );
      setShowForm(false);
      setEditId(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Update task status
  async function handleStatusChange(taskId: string, status: TaskStatus) {
    await db.transact(db.tx.tasks[taskId].update({ status, updatedAt: Date.now() }));
  }

  // ── Delete task
  async function handleDelete(taskId: string) {
    setDeletingId(taskId);
    try {
      await db.transact(db.tx.tasks[taskId].delete());
    } finally {
      setDeletingId(null);
    }
  }

  // ── Render
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-6 flex-wrap">
            <Link href="/dashboard"          className="text-slate-400 hover:text-white transition">Dashboard</Link>
            <span className="text-slate-700">/</span>
            <Link href="/vulnerabilities"    className="text-slate-400 hover:text-white transition">Vulnerabilities</Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-400 font-mono text-xs">{vuln.vulnerabilityId as string}</span>
            <span className="text-slate-700">/</span>
            <span className="text-slate-300">Task Creation</span>
          </div>

          {/* Vulnerability summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-slate-400 font-mono text-xs">{vuln.vulnerabilityId as string}</span>
                {vuln.cveId && <span className="text-slate-500 text-xs">{vuln.cveId as string}</span>}
                {vuln.isZeroDay && (
                  <span className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />Zero-Day
                  </span>
                )}
                {triage?.severity && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    triage.severity === 'Critical' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : triage.severity === 'High'   ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                    : triage.severity === 'Medium' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  }`}>{triage.severity as string}</span>
                )}
              </div>
              <h2 className="text-white font-semibold text-base">{vuln.title as string}</h2>
              {triage && (
                <p className="text-slate-400 text-xs mt-1">
                  Assigned to {triage.assignedTeam as string}
                  {triage.assignedOwner ? ` · ${triage.assignedOwner as string}` : ''}
                  {triage.slaDeadline ? ` · SLA: ${new Date(triage.slaDeadline as string).toLocaleDateString()}` : ''}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs px-3 py-1 rounded-full border bg-slate-800 text-slate-300 border-slate-700">
              {vuln.status as string}
            </span>
          </div>

          {/* Lifecycle bar */}
          <LifecycleBar active={3} />

          {/* Progress summary */}
          {totalTasks > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Total Tasks',   value: totalTasks,   color: 'text-white' },
                { label: 'Done',          value: doneTasks,    color: 'text-green-400' },
                { label: 'Blocked',       value: blockedTasks, color: 'text-red-400' },
              ].map((c) => (
                <div key={c.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                  <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                  <p className="text-slate-400 text-xs mt-1">{c.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tasks header + add button */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">
              Remediation Tasks
              {totalTasks > 0 && <span className="text-slate-500 font-normal ml-2 text-sm">({totalTasks})</span>}
            </h2>
            <button onClick={handleNewTask}
              className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2">
              <span>+</span> Add Task
            </button>
          </div>

          {/* Empty state */}
          {tasks.length === 0 ? (
            <div className="bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl p-14 text-center">
              <div className="text-4xl mb-4">🔧</div>
              <h3 className="text-white font-semibold mb-2">No tasks yet</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
                Break down the remediation work into actionable tasks. Each task can be assigned to a specific team with a due date and external ticket link.
              </p>
              <button onClick={handleNewTask}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition">
                + Create First Task
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className={deletingId === task.id ? 'opacity-40 pointer-events-none' : ''}>
                  <TaskCard
                    task={task}
                    onEdit={() => handleEdit(task)}
                    onStatusChange={(s) => handleStatusChange(task.id, s)}
                    onDelete={() => handleDelete(task.id)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Navigation */}
          {tasks.length > 0 && (
            <div className="mt-8 flex justify-between items-center">
              <Link href={`/triage/${vulnInstantId}`}
                className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-4 py-2.5 rounded-lg transition">
                ← Back to Triage
              </Link>
              <Link href="/dashboard"
                className="text-sm bg-green-600 hover:bg-green-500 text-white font-medium px-5 py-2.5 rounded-lg transition">
                Continue to Remediation →
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* Slide-in task form */}
      {showForm && (
        <TaskFormPanel
          draft={draft}
          onChange={changeDraft}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditId(null); }}
          saving={saving}
          isEdit={!!editId}
        />
      )}
    </div>
  );
}
