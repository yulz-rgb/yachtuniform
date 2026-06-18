'use client';

import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Users } from 'lucide-react';

export function OperationalDashboard({
  tasks,
  budget,
  crewCount,
  warningCount,
  orderStatus,
  onAction,
  fmt,
}) {
  return (
    <section className="ops-dashboard no-print" aria-label="Operational dashboard">
      <div className="ops-dashboard-header">
        <div>
          <h2>Chief Stew Dashboard</h2>
          <p>Next actions for your {crewCount}-person crew — missing data, procurement risks, and approvals.</p>
        </div>
        <div className="ops-stats">
          <div className="ops-stat">
            <span className="ops-stat-label">Grand total</span>
            <strong>{fmt(budget.grandTotal)}</strong>
            {budget.budgetCap > 0 && (
              <small className={budget.overBudget ? 'ops-over' : 'ops-ok'}>
                Cap {fmt(budget.budgetCap)} {budget.overBudget ? `(+${fmt(budget.budgetDelta)})` : ''}
              </small>
            )}
          </div>
          <div className="ops-stat">
            <span className="ops-stat-label">Checks</span>
            <strong>{warningCount}</strong>
          </div>
          {orderStatus && (
            <div className="ops-stat">
              <span className="ops-stat-label">Order</span>
              <strong>{orderStatus.replace(/_/g, ' ')}</strong>
            </div>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="import-result ok" style={{ marginTop: 16 }}>
          <CheckCircle2 size={16} /> All clear — crew sizing, procurement checks, and budget look ready.
        </div>
      ) : (
        <div className="ops-task-grid">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className={`ops-task-card ${task.priority}`}
              onClick={() => onAction(task.action)}
            >
              <div className="ops-task-icon">
                {task.action === 'crew' && <Users size={18} />}
                {task.action === 'approval' && <ClipboardList size={18} />}
                {(task.action === 'procurement' || task.action === 'budget') && <AlertTriangle size={18} />}
                {task.action === 'looks' && <ArrowRight size={18} />}
              </div>
              <div className="ops-task-body">
                <span className={`ops-priority ${task.priority}`}>{task.priority}</span>
                <strong>{task.title}</strong>
                <p>{task.detail}</p>
              </div>
              <ArrowRight size={16} className="ops-task-arrow" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
