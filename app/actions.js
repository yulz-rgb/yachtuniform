'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getActiveContext, assertMembership, ACTIVE_YACHT_COOKIE_NAME } from '../lib/auth';
import {
  persistWorkspace,
  createOrderSnapshot,
  advanceOrderStatus,
  getOrder,
  recordArtifact,
  findUserByEmail,
  addMembership,
  setMemberRole,
  removeMember,
  countOwners,
  listMembers,
  updateYacht,
  logAudit,
} from '../lib/repository';
import { backendEnabled, hasBlob } from '../lib/config';
import { can, canAdvance, ROLES } from '../lib/permissions';
import { uploadBlob } from '../lib/blob';

// Persist the entire operational workspace for the caller's active yacht.
export async function saveWorkspaceAction(snapshot) {
  if (!backendEnabled) return { ok: false, mode: 'local' };
  const ctx = await getActiveContext();
  if (!ctx) return { ok: false, mode: 'local' };
  if (!can(ctx.role, 'workspace.edit')) {
    return { ok: false, mode: 'server', error: 'Read-only role: changes are not saved.' };
  }
  try {
    await persistWorkspace(ctx.yachtId, snapshot);
    await logAudit(ctx.yachtId, ctx.user.id, 'SAVE', 'Workspace', ctx.yachtId, {
      products: snapshot.products?.length || 0,
      looks: snapshot.looks?.length || 0,
      crew: snapshot.crew?.length || 0,
    });
    return { ok: true, mode: 'server' };
  } catch (err) {
    return { ok: false, mode: 'server', error: String(err?.message || err) };
  }
}

export async function setActiveYachtAction(yachtId) {
  if (!backendEnabled) return { ok: false };
  await assertMembership(yachtId);
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_YACHT_COOKIE_NAME, yachtId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/');
  return { ok: true };
}

export async function createOrderAction({ name, totals, snapshot }) {
  if (!backendEnabled) return { ok: false, mode: 'local' };
  const ctx = await getActiveContext();
  if (!ctx) return { ok: false, mode: 'local' };
  if (!can(ctx.role, 'order.create')) {
    return { ok: false, error: 'Insufficient permissions to create an order.' };
  }
  const order = await createOrderSnapshot(ctx.yachtId, {
    name,
    totals,
    snapshot,
    userId: ctx.user.id,
  });
  revalidatePath('/');
  return { ok: true, orderId: order.id, status: order.status };
}

export async function advanceOrderAction({ orderId, notes }) {
  if (!backendEnabled) return { ok: false, mode: 'local' };
  const ctx = await getActiveContext();
  if (!ctx) return { ok: false, mode: 'local' };
  const current = await getOrder(ctx.yachtId, orderId);
  if (!current) return { ok: false, error: 'Order not found.' };
  if (current.status === 'APPROVED') {
    return { ok: false, error: 'Order is already approved.' };
  }
  // Stage-specific authority: captain review requires captain/owner, final
  // owner approval requires owner.
  if (!canAdvance(ctx.role, current.status)) {
    return { ok: false, error: `Your role cannot advance an order from ${current.status.replace('_', ' ')}.` };
  }
  const order = await advanceOrderStatus(ctx.yachtId, orderId, { userId: ctx.user.id, notes });
  revalidatePath('/');
  return { ok: true, status: order.status };
}

// Persist a generated export (PDF/CSV/JSON) to Blob and record it against the
// active yacht (and order, when one is supplied) for procurement traceability.
export async function recordArtifactAction({ type, filename, contentBase64, contentType, orderId }) {
  if (!backendEnabled) return { ok: false, mode: 'local' };
  if (!hasBlob) return { ok: false, error: 'Blob storage is not configured.' };
  const ctx = await getActiveContext();
  if (!ctx) return { ok: false, error: 'Unauthorized' };
  if (!can(ctx.role, 'order.create')) {
    return { ok: false, error: 'Insufficient permissions to archive exports.' };
  }
  try {
    const buffer = Buffer.from(String(contentBase64 || ''), 'base64');
    const safeName = `exports/${(filename || 'artifact').replace(/[^a-zA-Z0-9._-]+/g, '-')}`;
    const url = await uploadBlob(safeName, buffer, { contentType: contentType || 'application/octet-stream' });
    const artifact = await recordArtifact(ctx.yachtId, {
      type, blobUrl: url, orderProjectId: orderId || null, userId: ctx.user.id,
    });
    await logAudit(ctx.yachtId, ctx.user.id, 'EXPORT', 'ExportArtifact', artifact.id, { type, filename });
    revalidatePath('/');
    return { ok: true, url, id: artifact.id };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

// ── Team / membership management (owner & captain) ─────────────────────────
function ensureRole(role) {
  return ROLES.includes(role) ? role : 'MEMBER';
}

export async function addMemberAction({ email, role }) {
  if (!backendEnabled) return { ok: false, mode: 'local' };
  const ctx = await getActiveContext();
  if (!ctx) return { ok: false, error: 'Unauthorized' };
  if (!can(ctx.role, 'member.manage')) return { ok: false, error: 'Insufficient permissions.' };
  const clean = String(email || '').toLowerCase().trim();
  if (!clean) return { ok: false, error: 'Email is required.' };
  const user = await findUserByEmail(clean);
  if (!user) {
    return {
      ok: false,
      pending: true,
      error: 'No account found for that email yet. Ask them to sign up first, then add them here.',
    };
  }
  await addMembership(ctx.yachtId, user.id, ensureRole(role));
  await logAudit(ctx.yachtId, ctx.user.id, 'MEMBER_ADD', 'Membership', user.id, { email: clean, role });
  revalidatePath('/');
  return { ok: true, members: await listMembers(ctx.yachtId) };
}

export async function updateMemberRoleAction({ membershipId, role }) {
  if (!backendEnabled) return { ok: false, mode: 'local' };
  const ctx = await getActiveContext();
  if (!ctx) return { ok: false, error: 'Unauthorized' };
  if (!can(ctx.role, 'member.manage')) return { ok: false, error: 'Insufficient permissions.' };
  const nextRole = ensureRole(role);
  const members = await listMembers(ctx.yachtId);
  const target = members.find((m) => m.id === membershipId);
  if (!target) return { ok: false, error: 'Member not found.' };
  if (target.role === 'OWNER' && nextRole !== 'OWNER' && (await countOwners(ctx.yachtId)) <= 1) {
    return { ok: false, error: 'Cannot demote the last owner.' };
  }
  await setMemberRole(ctx.yachtId, membershipId, nextRole);
  await logAudit(ctx.yachtId, ctx.user.id, 'MEMBER_ROLE', 'Membership', membershipId, { role: nextRole });
  revalidatePath('/');
  return { ok: true, members: await listMembers(ctx.yachtId) };
}

export async function removeMemberAction({ membershipId }) {
  if (!backendEnabled) return { ok: false, mode: 'local' };
  const ctx = await getActiveContext();
  if (!ctx) return { ok: false, error: 'Unauthorized' };
  if (!can(ctx.role, 'member.manage')) return { ok: false, error: 'Insufficient permissions.' };
  const members = await listMembers(ctx.yachtId);
  const target = members.find((m) => m.id === membershipId);
  if (!target) return { ok: false, error: 'Member not found.' };
  if (target.role === 'OWNER' && (await countOwners(ctx.yachtId)) <= 1) {
    return { ok: false, error: 'Cannot remove the last owner.' };
  }
  await removeMember(ctx.yachtId, membershipId);
  await logAudit(ctx.yachtId, ctx.user.id, 'MEMBER_REMOVE', 'Membership', membershipId, {});
  revalidatePath('/');
  return { ok: true, members: await listMembers(ctx.yachtId) };
}

export async function updateYachtNameAction({ name }) {
  if (!backendEnabled) return { ok: false, mode: 'local' };
  const ctx = await getActiveContext();
  if (!ctx) return { ok: false, error: 'Unauthorized' };
  if (!can(ctx.role, 'yacht.manage')) return { ok: false, error: 'Insufficient permissions.' };
  const clean = String(name || '').trim();
  if (!clean) return { ok: false, error: 'Name is required.' };
  await updateYacht(ctx.yachtId, { name: clean });
  await logAudit(ctx.yachtId, ctx.user.id, 'YACHT_UPDATE', 'Yacht', ctx.yachtId, { name: clean });
  revalidatePath('/');
  return { ok: true };
}
