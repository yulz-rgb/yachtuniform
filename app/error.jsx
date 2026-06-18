'use client';

export default function Error({ error, reset }) {
  return (
    <div className="auth-screen">
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, textAlign: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
        <p style={{ color: '#64748b' }}>{error?.message || 'An unexpected error occurred.'}</p>
        <button className="btn primary" onClick={() => reset()}>Try again</button>
      </div>
    </div>
  );
}
