import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="auth-screen">
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, textAlign: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Page not found</h2>
        <p style={{ color: '#64748b' }}>The page you are looking for does not exist.</p>
        <Link className="btn primary" href="/">Back to lookbook</Link>
      </div>
    </div>
  );
}
