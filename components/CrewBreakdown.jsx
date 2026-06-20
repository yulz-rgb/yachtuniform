'use client';

import { useMemo, useState, useEffect } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import {
  suggestPositionBreakdown,
  breakdownFromCrew,
  syncCrewFromBreakdown,
  adjustBreakdownCount,
  addRoleToBreakdown,
  removeRoleFromBreakdown,
  roleLabel,
} from '../lib/crewComposition';

export function CrewBreakdown({
  crew,
  looks,
  settings,
  roleOptions,
  customRoleIds,
  onCrewChange,
  disabled = false,
}) {
  const breakdown = useMemo(
    () => breakdownFromCrew(crew, roleOptions),
    [crew, roleOptions],
  );
  const [crewInput, setCrewInput] = useState(String(breakdown.totalCrew));
  const [addRoleId, setAddRoleId] = useState('');

  useEffect(() => {
    setCrewInput(String(breakdown.totalCrew));
  }, [breakdown.totalCrew]);

  const availableRoles = useMemo(
    () => roleOptions.filter((role) => !breakdown.positions.some((row) => row.roleId === role.id)),
    [roleOptions, breakdown.positions],
  );

  function applyBreakdown(nextBreakdown) {
    const synced = syncCrewFromBreakdown(
      nextBreakdown.positions,
      crew,
      looks,
      settings,
      roleOptions,
    );
    onCrewChange(synced);
    setCrewInput(String(nextBreakdown.totalCrew));
  }

  function handleCrewTotalChange(rawValue) {
    setCrewInput(rawValue);
    const total = Number(rawValue);
    if (!Number.isFinite(total) || total < 1) return;
    const suggested = suggestPositionBreakdown(total, settings);
    applyBreakdown(suggested);
  }

  function handleAdjust(roleId, delta) {
    const next = adjustBreakdownCount(breakdown, roleId, delta);
    if (next.totalCrew < 1) return;
    applyBreakdown(next);
  }

  function handleAddRole() {
    if (!addRoleId) return;
    applyBreakdown(addRoleToBreakdown(breakdown, addRoleId, settings));
    setAddRoleId('');
  }

  function handleRemoveRole(roleId) {
    const next = removeRoleFromBreakdown(breakdown, roleId);
    if (next.totalCrew < 1) return;
    applyBreakdown(next);
  }

  const tierHint = `${breakdown.tier.label} · ${breakdown.tier.loaRange}`;

  return (
    <div className="crew-breakdown">
      <div className="budget-row">
        <label>Crew Members</label>
        <input
          className="budget-input"
          type="number"
          min="1"
          max="999"
          value={crewInput}
          disabled={disabled}
          onChange={(e) => handleCrewTotalChange(e.target.value)}
          onBlur={() => setCrewInput(String(breakdown.totalCrew))}
        />
      </div>
      <p className="crew-breakdown-hint">{tierHint} — positions auto-suggested from typical crew ratios</p>

      <div className="crew-breakdown-header">
        <span>Position breakdown</span>
        <span className="crew-breakdown-total">{breakdown.totalCrew} total</span>
      </div>

      <div className="crew-breakdown-rows">
        {breakdown.positions.map((row) => {
          const isCustom = customRoleIds.has(row.roleId);
          const canRemove = row.roleId !== 'captain' || row.count > 1;
          return (
            <div key={row.roleId} className="crew-breakdown-row">
              <span className="crew-breakdown-label">{roleLabel(row.roleId, roleOptions)}</span>
              <div className="crew-breakdown-controls">
                <button
                  type="button"
                  className="look-item-stepper-btn"
                  disabled={disabled || row.count <= (row.roleId === 'captain' ? 1 : 0)}
                  onClick={() => handleAdjust(row.roleId, -1)}
                  aria-label={`Decrease ${roleLabel(row.roleId, roleOptions)}`}
                >
                  <Minus size={12} />
                </button>
                <span className="look-item-stepper-value">{row.count}</span>
                <button
                  type="button"
                  className="look-item-stepper-btn"
                  disabled={disabled}
                  onClick={() => handleAdjust(row.roleId, 1)}
                  aria-label={`Increase ${roleLabel(row.roleId, roleOptions)}`}
                >
                  <Plus size={12} />
                </button>
                {canRemove && (
                  <button
                    type="button"
                    className="crew-breakdown-remove"
                    disabled={disabled}
                    onClick={() => handleRemoveRole(row.roleId)}
                    title={isCustom ? 'Remove custom position' : 'Remove position from breakdown'}
                    aria-label={`Remove ${roleLabel(row.roleId, roleOptions)}`}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {availableRoles.length > 0 && (
        <div className="crew-breakdown-add">
          <select
            className="crew-breakdown-select"
            value={addRoleId}
            disabled={disabled}
            onChange={(e) => setAddRoleId(e.target.value)}
          >
            <option value="">Add position…</option>
            {availableRoles.map((role) => (
              <option key={role.id} value={role.id}>{role.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="crew-breakdown-add-btn"
            disabled={disabled || !addRoleId}
            onClick={handleAddRole}
          >
            <Plus size={12} /> Add
          </button>
        </div>
      )}
    </div>
  );
}
