'use client';

import { useState } from 'react';
import { X, UserPlus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { ROLES, ROLE_LABELS } from '../lib/permissions';
import {
  addMemberAction, updateMemberRoleAction, removeMemberAction, updateYachtNameAction,
} from '../app/actions';

export function TeamPanel({
  initialMembers = [], yachtName = '', currentUserId = '', onClose, checklist = [],
}) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [name, setName] = useState(yachtName);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true); setErr(''); setMsg('');
    const res = await addMemberAction({ email, role });
    setBusy(false);
    if (res?.ok) { setMembers(res.members); setEmail(''); setMsg('Member added.'); }
    else setErr(res?.error || 'Could not add member.');
  }

  async function changeRole(membershipId, nextRole) {
    setErr(''); setMsg('');
    const res = await updateMemberRoleAction({ membershipId, role: nextRole });
    if (res?.ok) { setMembers(res.members); setMsg('Role updated.'); }
    else setErr(res?.error || 'Could not update role.');
  }

  async function remove(membershipId) {
    setErr(''); setMsg('');
    const res = await removeMemberAction({ membershipId });
    if (res?.ok) { setMembers(res.members); setMsg('Member removed.'); }
    else setErr(res?.error || 'Could not remove member.');
  }

  async function saveName() {
    setErr(''); setMsg('');
    const res = await updateYachtNameAction({ name });
    if (res?.ok) setMsg('Yacht name saved.');
    else setErr(res?.error || 'Could not save name.');
  }

  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="admin-overlay no-print" onClick={onClose}>
      <div className="admin-panel" style={{ position: 'relative', maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close-admin" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <h2>Team &amp; Yacht</h2>

        <div className="control-group" style={{ marginBottom: 16 }}>
          <label>Yacht name</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} />
            <button type="button" className="btn" onClick={saveName}>Save</button>
          </div>
        </div>

        <h3 style={{ margin: '4px 0 8px', fontSize: 14 }}>Invite / add member</h3>
        <div className="team-invite-row">
          <input className="text-input" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button type="button" className="btn primary" disabled={busy || !email.trim()} onClick={add}>
            <UserPlus size={14} /> Add
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
          The person must have signed up once (so an account exists). New roles take effect on their next load.
        </p>

        {err && <p style={{ color: 'var(--danger)', fontWeight: 700 }}>{err}</p>}
        {msg && <p style={{ color: '#15803d', fontWeight: 700 }}>{msg}</p>}

        <div className="team-list">
          {members.map((m) => (
            <div key={m.id} className="team-row">
              <div className="team-row-id">
                <strong>{m.name || m.email}</strong>
                <span>{m.email}</span>
              </div>
              <select className="select" value={m.role} onChange={(e) => changeRole(m.id, e.target.value)}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <button type="button" className="btn danger" style={{ padding: '6px 10px' }}
                onClick={() => remove(m.id)} title="Remove member"
                disabled={m.userId === currentUserId}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {members.length === 0 && <p style={{ color: 'var(--muted)' }}>No members yet.</p>}
        </div>

        {checklist.length > 0 && (
          <div className="launch-checklist">
            <h3 style={{ fontSize: 14, margin: '6px 0' }}>
              Launch checklist <span className="result-count">{doneCount}/{checklist.length}</span>
            </h3>
            {checklist.map((c) => (
              <div key={c.id} className={`launch-item ${c.done ? 'done' : ''}`}>
                {c.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
