import { Anchor } from 'lucide-react';

const VALUE_POINTS = [
  ['Owners', 'A polished uniform proposal with a clear, approvable budget.'],
  ['Captains', 'Review crew readiness and sign off before anything is ordered.'],
  ['Chief stewardess', 'Build looks, manage crew sizing, and export supplier orders fast.'],
  ['Crew', 'See your assigned uniform and confirm your sizes in seconds.'],
  ['Suppliers', 'Receive clean, per-supplier purchase orders with SKUs and quantities.'],
];

export function AuthBrandPanel() {
  return (
    <aside className="auth-brand">
      <div className="auth-brand-mark">
        <span className="auth-brand-icon"><Anchor size={18} /></span>
        Yacht Uniform Lookbook
      </div>
      <h1 className="auth-brand-title">Maritime uniform planning, from first look to final order.</h1>
      <p className="auth-brand-sub">
        Compose crew looks, forecast budgets, and produce procurement-ready handoffs — all in one
        secure workspace per yacht.
      </p>
      <ul className="auth-brand-list">
        {VALUE_POINTS.map(([who, what]) => (
          <li key={who}>
            <strong>{who}</strong>
            <span>{what}</span>
          </li>
        ))}
      </ul>
      <p className="auth-brand-foot">
        Invite-only. Each yacht&rsquo;s data is isolated and private.
        {' '}
        <a href="/demo" style={{ color: 'var(--gold)', fontWeight: 800 }}>Try the demo</a> without signing in.
      </p>
    </aside>
  );
}
