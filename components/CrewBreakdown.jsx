'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { ChevronDown, Minus, Plus, Trash2 } from 'lucide-react';
import {
  suggestPositionBreakdown,
  breakdownFromCrew,
  syncCrewFromBreakdown,
  adjustBreakdownCount,
  addRoleToBreakdown,
  removeRoleFromBreakdown,
  roleLabel,
} from '../lib/crewComposition';

function PositionStepper({ value, min = 0, disabled, onChange, label }) {
  return (
    <div className="crew-breakdown-stepper">
      <button
        type="button"
        className="look-item-stepper-btn"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label={`Decrease ${label}`}
      >
        <Minus size={12} />
      </button>
      <span className="look-item-stepper-value">{value}</span>
      <button
        type="button"
        className="look-item-stepper-btn"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        aria-label={`Increase ${label}`}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

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
  const [syncedTotalCrew, setSyncedTotalCrew] = useState(breakdown.totalCrew);
  const [open, setOpen] = useState(false);
  const [addRoleId, setAddRoleId] = useState('');
  const menuRef = useRef(null);

  // Keep the text input in sync with externally-driven changes to
  // breakdown.totalCrew without a useEffect: adjusting state during
  // render (rather than after commit) avoids the extra render pass
  // an effect would cause. See https://react.dev/learn/you-might-not-need-an-effect
  if (breakdown.totalCrew !== syncedTotalCrew) {
    setSyncedTotalCrew(breakdown.totalCrew);
    setCrewInput(String(breakdown.totalCrew));
  }

  useEffect(() => {
    if (!open) return undefined;
    function handleClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const availableRoles = useMemo(
    () => roleOptions.filter((role) => !breakdown.positions.some((row) => row.roleId === role.id)),
    [roleOptions, breakdown.positions],
  );

  const summaryText = useMemo(() => {
    if (!breakdown.positions.length) return 'No positions';
    return breakdown.positions
      .map((row) => `${roleLabel(row.roleId, roleOptions)} ${row.count}`)
      .join(', ');
  }, [breakdown.positions, roleOptions]);

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

      <div className="budget-row crew-breakdown-picker-row">
        <label>Position breakdown</label>
        <div className="crew-breakdown-picker" ref={menuRef}>
          <button
            type="button"
            className="crew-breakdown-trigger"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <span className="crew-breakdown-trigger-value">{summaryText}</span>
            <ChevronDown size={14} className={open ? 'open' : ''} />
          </button>
          {open && (
            <div className="crew-breakdown-menu">
              {breakdown.positions.map((row) => {
                const label = roleLabel(row.roleId, roleOptions);
                const isCustom = customRoleIds.has(row.roleId);
                const minCount = row.roleId === 'captain' ? 1 : 0;
                const canRemove = row.roleId !== 'captain' || row.count > 1;
                return (
                  <div key={row.roleId} className="crew-breakdown-menu-row">
                    <span className="crew-breakdown-menu-label">{label}</span>
                    <PositionStepper
                      label={label}
                      value={row.count}
                      min={minCount}
                      disabled={disabled}
                      onChange={(nextCount) => handleAdjust(row.roleId, nextCount - row.count)}
                    />
                    {canRemove && (
                      <button
                        type="button"
                        className="crew-breakdown-remove"
                        disabled={disabled}
                        onClick={() => handleRemoveRole(row.roleId)}
                        title={isCustom ? 'Remove custom position' : 'Remove position'}
                        aria-label={`Remove ${label}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
              {availableRoles.length > 0 && (
                <div className="crew-breakdown-menu-add">
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
                    <Plus size={12} />
                  </button>
                </div>
              )}
              <p className="crew-breakdown-menu-meta">
                {tierHint} · {breakdown.totalCrew} crew — auto-suggested from typical ratios
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
