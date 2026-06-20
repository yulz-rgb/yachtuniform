import { describe, it, expect } from 'vitest';
import {
  suggestPositionBreakdown,
  breakdownFromCrew,
  syncCrewFromBreakdown,
  adjustBreakdownCount,
  getVesselTier,
  rotationForRole,
} from './crewComposition.js';

describe('crewComposition', () => {
  it('maps crew count to vessel tier', () => {
    expect(getVesselTier(6).code).toBe('small');
    expect(getVesselTier(10).code).toBe('medium');
    expect(getVesselTier(18).code).toBe('large');
    expect(getVesselTier(30).code).toBe('mega');
  });

  it('suggests positions that sum to crew total', () => {
    for (const total of [4, 6, 8, 12, 18, 30]) {
      const { positions, totalCrew } = suggestPositionBreakdown(total);
      const sum = positions.reduce((acc, row) => acc + row.count, 0);
      expect(sum).toBe(totalCrew);
      expect(positions.some((row) => row.roleId === 'captain' && row.count === 1)).toBe(true);
    }
  });

  it('assigns higher rotations to captain and chief stew', () => {
    expect(rotationForRole('captain')).toBeGreaterThan(rotationForRole('deck'));
    expect(rotationForRole('chief-stew')).toBeGreaterThan(rotationForRole('interior'));
  });

  it('derives breakdown from existing crew', () => {
    const crew = [
      { id: '1', role: 'captain' },
      { id: '2', role: 'deck' },
      { id: '3', role: 'deck' },
    ];
    const breakdown = breakdownFromCrew(crew, [{ id: 'captain', label: 'Captain' }, { id: 'deck', label: 'Deck' }]);
    expect(breakdown.totalCrew).toBe(3);
    expect(breakdown.positions.find((p) => p.roleId === 'deck')?.count).toBe(2);
  });

  it('syncs crew while preserving named members', () => {
    const existing = [
      { id: 'c1', name: 'James T.', role: 'deck', bodyType: 'man', topSize: 'L', assignedLooks: ['day-deck-look'] },
      { id: 'c2', name: 'Marcus H.', role: 'deck', bodyType: 'man', topSize: 'M', assignedLooks: ['day-deck-look'] },
    ];
    const positions = [{ roleId: 'deck', count: 2, setsPerCrew: 2 }];
    const next = syncCrewFromBreakdown(positions, existing, [{ id: 'day-deck-look', bodyType: 'man' }]);
    expect(next).toHaveLength(2);
    expect(next.some((m) => m.name === 'James T.')).toBe(true);
  });

  it('adjusts position counts via breakdown helper', () => {
    const base = suggestPositionBreakdown(6);
    const moreDeck = adjustBreakdownCount(base, 'deck', 1);
    expect(moreDeck.totalCrew).toBe(7);
    expect(moreDeck.positions.find((p) => p.roleId === 'deck')?.count).toBe(
      (base.positions.find((p) => p.roleId === 'deck')?.count || 0) + 1,
    );
  });
});
