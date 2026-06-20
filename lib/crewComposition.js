// Crew count ↔ vessel size ↔ position breakdown heuristics for superyacht uniform planning.
// Based on typical LOA/crew ratios: small (24–35m, 4–7), medium (35–55m, 8–14),
// large (55–75m, 15–24), mega (75m+, 25+).

import { normalizeCrewMember, crewLookIds } from './crew.js';

export const VESSEL_SIZE_TIERS = [
  { code: 'small', minCrew: 1, maxCrew: 7, label: 'Small yacht', loaRange: '24–35m' },
  { code: 'medium', minCrew: 8, maxCrew: 14, label: 'Medium yacht', loaRange: '35–55m' },
  { code: 'large', minCrew: 15, maxCrew: 24, label: 'Large yacht', loaRange: '55–75m' },
  { code: 'mega', minCrew: 25, maxCrew: 999, label: 'Mega yacht', loaRange: '75m+' },
];

/** Anchor crew totals → typical department headcount (industry norms). */
const CREW_ANCHORS = [
  { total: 4, positions: { captain: 1, 'chief-stew': 1, interior: 1, deck: 1 } },
  { total: 6, positions: { captain: 1, 'chief-stew': 1, interior: 1, deck: 2, engineer: 1 } },
  { total: 8, positions: { captain: 1, 'chief-stew': 1, interior: 2, deck: 2, chef: 1, engineer: 1 } },
  { total: 10, positions: { captain: 1, 'chief-stew': 1, interior: 3, deck: 2, chef: 1, engineer: 1 } },
  { total: 12, positions: { captain: 1, 'chief-stew': 1, interior: 4, deck: 3, chef: 1, engineer: 1 } },
  { total: 15, positions: { captain: 1, 'chief-stew': 1, interior: 5, deck: 4, chef: 1, engineer: 1 } },
  { total: 18, positions: { captain: 1, 'chief-stew': 1, interior: 6, deck: 5, chef: 1, engineer: 2 } },
  { total: 22, positions: { captain: 1, 'chief-stew': 1, interior: 8, deck: 6, chef: 2, engineer: 2, spa: 1 } },
  { total: 30, positions: { captain: 1, 'chief-stew': 1, interior: 11, deck: 8, chef: 2, engineer: 3, spa: 1 } },
  { total: 40, positions: { captain: 1, 'chief-stew': 1, interior: 15, deck: 11, chef: 2, engineer: 4, spa: 2 } },
];

/** Typical uniform rotation sets per role (formal vs daily wear). */
export const DEFAULT_ROTATIONS = {
  captain: 3,
  'chief-stew': 3,
  interior: 2,
  deck: 2,
  chef: 2,
  engineer: 2,
  spa: 2,
};

const ROLE_BODY_TYPE = {
  captain: 'man',
  'chief-stew': 'woman',
  interior: 'woman',
  deck: 'man',
  chef: 'man',
  engineer: 'man',
  spa: 'woman',
};

const ROLE_LOOKS = {
  captain: ['arrival-look'],
  'chief-stew': ['arrival-look', 'evening-service-look'],
  interior: ['arrival-look', 'evening-service-look'],
  deck: ['day-deck-look'],
  chef: ['arrival-look'],
  engineer: ['day-deck-look'],
  spa: ['watersports-look'],
};

const ROLE_NAMES = {
  captain: 'Captain',
  'chief-stew': 'Chief Stew',
  interior: 'Interior',
  deck: 'Deck',
  chef: 'Chef',
  engineer: 'Engineer',
  spa: 'Spa / Wellness',
};

function clampCrewCount(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(999, n));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function interpolateAnchors(totalCrew) {
  const count = clampCrewCount(totalCrew);
  if (count <= CREW_ANCHORS[0].total) {
    const ratio = count / CREW_ANCHORS[0].total;
    const base = CREW_ANCHORS[0].positions;
    const scaled = {};
    for (const [role, qty] of Object.entries(base)) {
      scaled[role] = Math.max(role === 'captain' ? 1 : 0, Math.round(qty * ratio));
    }
    return balanceToTotal(scaled, count);
  }

  for (let i = 0; i < CREW_ANCHORS.length - 1; i += 1) {
    const low = CREW_ANCHORS[i];
    const high = CREW_ANCHORS[i + 1];
    if (count <= high.total) {
      const t = (count - low.total) / (high.total - low.total);
      const roles = new Set([...Object.keys(low.positions), ...Object.keys(high.positions)]);
      const blended = {};
      for (const role of roles) {
        const a = low.positions[role] || 0;
        const b = high.positions[role] || 0;
        blended[role] = Math.max(role === 'captain' ? 1 : 0, Math.round(lerp(a, b, t)));
      }
      return balanceToTotal(blended, count);
    }
  }

  const last = CREW_ANCHORS[CREW_ANCHORS.length - 1];
  const scale = count / last.total;
  const scaled = {};
  for (const [role, qty] of Object.entries(last.positions)) {
    scaled[role] = Math.max(role === 'captain' ? 1 : 0, Math.round(qty * scale));
  }
  return balanceToTotal(scaled, count);
}

function balanceToTotal(positions, targetTotal) {
  const next = { ...positions };
  let total = Object.values(next).reduce((sum, n) => sum + n, 0);
  if (total === targetTotal) return next;

  const adjustable = ['interior', 'deck', 'engineer', 'chef', 'spa', 'chief-stew'];
  while (total < targetTotal) {
    const role = adjustable.find((r) => (next[r] || 0) >= 0) || 'interior';
    next[role] = (next[role] || 0) + 1;
    total += 1;
  }
  while (total > targetTotal) {
    const role = [...adjustable].reverse().find((r) => (next[r] || 0) > (r === 'captain' ? 1 : 0));
    if (!role) break;
    next[role] -= 1;
    total -= 1;
  }
  return next;
}

export function getVesselTier(crewCount) {
  const count = clampCrewCount(crewCount);
  return VESSEL_SIZE_TIERS.find((tier) => count >= tier.minCrew && count <= tier.maxCrew)
    || VESSEL_SIZE_TIERS[VESSEL_SIZE_TIERS.length - 1];
}

export function rotationForRole(roleId, settings = {}) {
  const custom = settings?.roleRotations?.[roleId];
  if (Number.isFinite(custom) && custom > 0) return custom;
  return DEFAULT_ROTATIONS[roleId] || Math.max(1, Number(settings.setsPerCrew) || 2);
}

export function roleLabel(roleId, roleOptions = []) {
  const match = roleOptions.find((r) => r.id === roleId);
  if (match?.label) return match.label;
  return ROLE_NAMES[roleId] || roleId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function suggestPositionBreakdown(totalCrew, settings = {}) {
  const count = clampCrewCount(totalCrew);
  const tier = getVesselTier(count);
  const raw = interpolateAnchors(count);
  const positions = Object.entries(raw)
    .filter(([, qty]) => qty > 0)
    .map(([roleId, qty]) => ({
      roleId,
      count: qty,
      setsPerCrew: rotationForRole(roleId, settings),
    }))
    .sort((a, b) => a.roleId.localeCompare(b.roleId));

  return { totalCrew: count, tier, positions };
}

export function breakdownFromCrew(crew = [], roleOptions = []) {
  const counts = new Map();
  for (const member of crew) {
    const roleId = member.role || 'interior';
    counts.set(roleId, (counts.get(roleId) || 0) + 1);
  }

  const orderedRoleIds = [
    ...roleOptions.map((r) => r.id).filter((id) => counts.has(id)),
    ...[...counts.keys()].filter((id) => !roleOptions.some((r) => r.id === id)),
  ];

  const positions = orderedRoleIds.map((roleId) => ({
    roleId,
    count: counts.get(roleId) || 0,
    setsPerCrew: crew.find((m) => m.role === roleId && m.setsPerCrew)?.setsPerCrew || null,
  }));

  return {
    totalCrew: crew.length,
    tier: getVesselTier(crew.length),
    positions,
  };
}

function defaultLooksForRole(roleId, looks = []) {
  const preferred = ROLE_LOOKS[roleId] || ['arrival-look'];
  const lookIds = new Set(looks.map((l) => l.id));
  const assigned = preferred.filter((id) => lookIds.has(id));
  if (assigned.length) return assigned;
  const bodyType = ROLE_BODY_TYPE[roleId] || 'woman';
  const match = looks.find((l) => l.bodyType === bodyType);
  return match ? [match.id] : looks[0]?.id ? [looks[0].id] : [];
}

function placeholderName(roleId, index, roleOptions = []) {
  const label = roleLabel(roleId, roleOptions);
  if (roleId === 'captain' && index === 0) return 'Captain';
  if (index === 0) return label;
  return `${label} ${index + 1}`;
}

function pickMembersToKeep(existing = [], count) {
  if (count >= existing.length) return { keep: [...existing], need: count - existing.length };
  const sorted = [...existing].sort((a, b) => {
    if (Boolean(a.sizeConfirmed) !== Boolean(b.sizeConfirmed)) {
      return a.sizeConfirmed ? -1 : 1;
    }
    const aNamed = a.name && !/^New Crew|Interior|Deck|Chef|Engineer|Captain|Chief Stew|Spa/i.test(a.name);
    const bNamed = b.name && !/^New Crew|Interior|Deck|Chef|Engineer|Captain|Chief Stew|Spa/i.test(b.name);
    if (aNamed !== bNamed) return aNamed ? -1 : 1;
    return 0;
  });
  return { keep: sorted.slice(0, count), need: 0 };
}

export function syncCrewFromBreakdown(positions = [], existingCrew = [], looks = [], settings = {}, roleOptions = []) {
  const lookNameToId = new Map(looks.map((l) => [l.name, l.id]));
  const extraRoleIds = roleOptions.map((r) => r.id);
  const byRole = new Map();
  for (const member of existingCrew) {
    const list = byRole.get(member.role) || [];
    list.push(member);
    byRole.set(member.role, list);
  }

  const nextCrew = [];
  for (const { roleId, count, setsPerCrew } of positions) {
    if (count <= 0) continue;
    const pool = byRole.get(roleId) || [];
    const { keep, need } = pickMembersToKeep(pool, count);
    const rotation = setsPerCrew || rotationForRole(roleId, settings);
    const assignedLooks = defaultLooksForRole(roleId, looks);

    keep.forEach((member, index) => {
      nextCrew.push(normalizeCrewMember({
        ...member,
        role: roleId,
        name: member.name || placeholderName(roleId, index, roleOptions),
        setsPerCrew: rotation,
        assignedLooks: crewLookIds(member).length ? crewLookIds(member) : assignedLooks,
      }, lookNameToId, extraRoleIds));
    });

    for (let i = 0; i < need; i += 1) {
      const index = keep.length + i;
      nextCrew.push(normalizeCrewMember({
        id: `crew-${roleId}-${Date.now()}-${index}`,
        name: placeholderName(roleId, index, roleOptions),
        role: roleId,
        bodyType: ROLE_BODY_TYPE[roleId] || 'woman',
        assignedLooks,
        setsPerCrew: rotation,
        sizeConfirmed: false,
      }, lookNameToId, extraRoleIds));
    }
  }

  return nextCrew;
}

export function adjustBreakdownCount(breakdown, roleId, delta) {
  const positions = breakdown.positions.map((row) => ({ ...row }));
  const index = positions.findIndex((row) => row.roleId === roleId);
  if (index === -1 && delta > 0) {
    positions.push({ roleId, count: delta, setsPerCrew: null });
  } else if (index >= 0) {
    positions[index].count = Math.max(0, positions[index].count + delta);
    if (positions[index].count === 0) positions.splice(index, 1);
  }
  const totalCrew = positions.reduce((sum, row) => sum + row.count, 0);
  return {
    ...breakdown,
    totalCrew: Math.max(1, totalCrew),
    tier: getVesselTier(Math.max(1, totalCrew)),
    positions: positions.filter((row) => row.count > 0),
  };
}

export function addRoleToBreakdown(breakdown, roleId, settings = {}) {
  if (breakdown.positions.some((row) => row.roleId === roleId)) {
    return adjustBreakdownCount(breakdown, roleId, 1);
  }
  return adjustBreakdownCount({
    ...breakdown,
    positions: [
      ...breakdown.positions,
      { roleId, count: 1, setsPerCrew: rotationForRole(roleId, settings) },
    ],
  }, roleId, 0);
}

export function removeRoleFromBreakdown(breakdown, roleId) {
  return {
    ...breakdown,
    positions: breakdown.positions.filter((row) => row.roleId !== roleId),
    totalCrew: breakdown.positions
      .filter((row) => row.roleId !== roleId)
      .reduce((sum, row) => sum + row.count, 0),
    tier: getVesselTier(
      breakdown.positions
        .filter((row) => row.roleId !== roleId)
        .reduce((sum, row) => sum + row.count, 0) || 1,
    ),
  };
}
