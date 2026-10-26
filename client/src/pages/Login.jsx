import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/login', { email, password });
      navigate('/dashboard', { state: { welcome: false } });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-login">
      <a className="auth-brand" href="/" aria-label="Engram home">
        <span className="auth-brand-mark" aria-hidden="true">e</span><span>Engram</span>
      </a>
      <main className="auth-layout">
        <section className="auth-story" aria-labelledby="auth-story-title">
          <span className="eyebrow">YOUR PERSONAL MEMORY</span>
          <h1 id="auth-story-title">Keep what matters<br/><em>within reach.</em></h1>
          <p>Notes, links and documents, gathered in one place and ready when you need them.</p>
          <div className="memory-stack" aria-hidden="true">
            <div className="memory-card memory-note"><span className="memory-card-icon">✳</span><span>Small things,<br/>easy to find.</span><small>NOTE · JUST NOW</small></div>
            <div className="memory-card memory-link"><span className="memory-link-dot"/><span><strong>Saved for later</strong><small>your next good idea</small></span><span className="memory-arrow">↗</span></div>
            <div className="memory-card memory-photo"><span className="photo-sun"/><span className="photo-hill photo-hill-back"/><span className="photo-hill photo-hill-front"/><span className="photo-caption">A moment worth keeping</span></div>
          </div>
          <div className="auth-story-footer"><span className="auth-story-spark">✳</span> A little more found.</div>
        </section>

        <section className="auth-card" aria-labelledby="login-title">
          <span className="auth-card-kicker">WELCOME BACK</span>
          <h2 id="login-title">Sign in</h2>
          <p className="auth-card-copy">Your saved things are right where you left them.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} id="login-form">
            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <input id="login-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input id="login-password" type="password" autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button id="login-btn" className="btn btn-primary auth-submit" type="submit" disabled={loading}>
              {loading ? <><span className="spinner" />Signing in…</> : <>Sign in <span aria-hidden="true">→</span></>}
            </button>
          </form>

          <div className="switch-link auth-switch">New to Engram? <Link to="/register">Create an account <span aria-hidden="true">↗</span></Link></div>
          <p className="auth-card-footnote"><span aria-hidden="true">⌁</span> Your personal library, just for you.</p>
        </section>
      </main>
    </div>
  );
}
