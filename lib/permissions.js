// Central role/permission matrix shared by server guards (app/actions.js,
// API routes) and the UI (components/Workspace.jsx). Keeping it framework-free
// means it can be unit tested and reused on both client and server.

export const ROLES = ['OWNER', 'CAPTAIN', 'CHIEF_STEW', 'MEMBER'];

export const ROLE_LABELS = {
  OWNER: 'Owner',
  CAPTAIN: 'Captain',
  CHIEF_STEW: 'Chief Stewardess',
  MEMBER: 'Crew',
};

// Capabilities each role is granted. MEMBER (crew) is intentionally read-only
// except for confirming their own sizing.
const MATRIX = {
  OWNER: new Set([
    'workspace.edit', 'catalog.import', 'product.upload', 'order.create',
    'order.advance.captain', 'order.advance.owner', 'member.manage',
    'yacht.manage', 'crew.sizing',
  ]),
  CAPTAIN: new Set([
    'workspace.edit', 'catalog.import', 'product.upload', 'order.create',
    'order.advance.captain', 'member.manage', 'crew.sizing',
  ]),
  CHIEF_STEW: new Set([
    'workspace.edit', 'catalog.import', 'product.upload', 'order.create',
    'crew.sizing',
  ]),
  MEMBER: new Set([
    'crew.sizing',
  ]),
};

export function can(role, action) {
  const set = MATRIX[role] || MATRIX.MEMBER;
  return set.has(action);
}

// Which capability is required to advance an order OUT of its current status.
export const ADVANCE_PERMISSION = {
  DRAFT: 'order.create', // draft -> captain review (the submitter forwards it)
  CAPTAIN_REVIEW: 'order.advance.captain', // captain review -> owner approval
  OWNER_APPROVAL: 'order.advance.owner', // owner approval -> approved (owner only)
};

// Human-readable description of who can act at each stage (for UI hints).
export const STAGE_ACTOR = {
  DRAFT: 'Submitter forwards to captain review',
  CAPTAIN_REVIEW: 'Captain forwards to owner approval',
  OWNER_APPROVAL: 'Owner gives final approval',
  APPROVED: 'Approved and locked for ordering',
};

export function canAdvance(role, status) {
  const action = ADVANCE_PERMISSION[status];
  if (!action) return false;
  return can(role, action);
}

// A compact capability object handy to pass to client components.
export function capabilitiesFor(role) {
  return {
    role,
    label: ROLE_LABELS[role] || 'Crew',
    canEdit: can(role, 'workspace.edit'),
    canImport: can(role, 'catalog.import'),
    canUploadImages: can(role, 'product.upload'),
    canCreateOrder: can(role, 'order.create'),
    canAdvanceCaptain: can(role, 'order.advance.captain'),
    canAdvanceOwner: can(role, 'order.advance.owner'),
    canManageMembers: can(role, 'member.manage'),
    canManageYacht: can(role, 'yacht.manage'),
  };
}
