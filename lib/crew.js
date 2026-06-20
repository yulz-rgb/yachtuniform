// Crew helpers: normalization, look assignment, CSV import.

import { parseCsv } from './csv.js';

export const CREW_CSV_COLUMNS = [
  'name',
  'role',
  'bodyType',
  'topSize',
  'bottomSize',
  'shoeSize',
  'assignedLooks',
  'setsPerCrew',
  'fitNotes',
  'sizeConfirmed',
  'alterations',
  'preferredFit',
  'bust',
  'waist',
  'hips',
  'height',
];

export const VALID_ROLES = new Set([
  'captain', 'chief-stew', 'interior', 'deck', 'chef', 'engineer', 'spa',
]);
const VALID_BODY = new Set(['woman', 'man']);
const VALID_FIT = new Set(['regular', 'slim', 'relaxed']);

export function crewLookIds(member = {}) {
  if (Array.isArray(member.assignedLooks) && member.assignedLooks.length) {
    return member.assignedLooks.filter(Boolean);
  }
  if (member.assignedLookId) return [member.assignedLookId];
  if (member.assignedLook) return [member.assignedLook];
  return [];
}

export function memberSets(member, settings = {}) {
  const personal = Number(member?.setsPerCrew);
  if (Number.isFinite(personal) && personal > 0) return personal;
  return Math.max(1, Number(settings.setsPerCrew) || 1);
}

export function normalizeCrewMember(member = {}, lookNameToId = new Map(), extraRoleIds = []) {
  const validRoles = new Set([...VALID_ROLES, ...extraRoleIds.filter(Boolean)]);
  let assignedLooks = crewLookIds(member);
  if (typeof member.assignedLooks === 'string' && member.assignedLooks.trim()) {
    assignedLooks = member.assignedLooks.split(/[|;]/).map((s) => s.trim()).filter(Boolean);
  }
  assignedLooks = assignedLooks.map((idOrName) => {
    if (lookNameToId.has(idOrName)) return lookNameToId.get(idOrName);
    return idOrName;
  });

  const confirmed = String(member.sizeConfirmed || '').toLowerCase();
  const sizeConfirmed = ['1', 'true', 'yes', 'y', 'confirmed'].includes(confirmed);

  return {
    id: member.id || `crew-${Math.random().toString(36).slice(2, 9)}`,
    name: String(member.name || 'New Crew').trim(),
    role: validRoles.has(member.role) ? member.role : 'interior',
    bodyType: VALID_BODY.has(member.bodyType) ? member.bodyType : 'woman',
    topSize: member.topSize || '',
    bottomSize: member.bottomSize || '',
    shoeSize: member.shoeSize || '',
    assignedLooks: assignedLooks.length ? assignedLooks : (member.assignedLook ? [member.assignedLook] : []),
    assignedLook: assignedLooks[0] || member.assignedLook || '',
    setsPerCrew: member.setsPerCrew ? Number(member.setsPerCrew) : null,
    fitNotes: member.fitNotes || '',
    sizeConfirmed,
    alterations: member.alterations || '',
    preferredFit: VALID_FIT.has(member.preferredFit) ? member.preferredFit : 'regular',
    bust: member.bust || '',
    waist: member.waist || '',
    hips: member.hips || '',
    height: member.height || '',
  };
}

export function parseCrewCsv(text, looks = []) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { records: [], errors: [] };

  const headers = rows[0].map((h) => h.trim());
  const lookNameToId = new Map(looks.map((l) => [l.name, l.id]));

  const records = [];
  const errors = [];

  rows.slice(1).forEach((cells, idx) => {
    const rowNum = idx + 2;
    const raw = {};
    headers.forEach((h, i) => { raw[h] = (cells[i] ?? '').trim(); });
    if (!raw.name) {
      errors.push({ row: rowNum, message: 'name is required' });
      return;
    }
    records.push(normalizeCrewMember(raw, lookNameToId));
  });

  return { records, errors };
}

export function buildCrewCsvTemplate() {
  return `${CREW_CSV_COLUMNS.join(',')}\nEmma J.,chief-stew,woman,S,36,38,Arrival / Guest Meet|Evening Service,2,Prefers slim fit,true,Shorten dress hem,slim,86,66,92,168`;
}
