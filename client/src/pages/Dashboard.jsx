import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Dashboard() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // On mount, ask the server "who am I?".
    // If the cookie is missing or invalid, the server returns 401,
    // and we redirect to /login. This is the protected-route guard.
    api.get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = async () => {
    await api.post('/auth/logout');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="page-center">
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="brand">
          <div className="brand-dot" />
          <span className="brand-name">Engram</span>
        </div>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="user-badge">
              <div className="avatar">{user.email[0].toUpperCase()}</div>
              <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{user.email}</span>
            </div>
            <button id="logout-btn" className="btn btn-ghost" style={{ width: 'auto', padding: '8px 16px' }} onClick={handleLogout}>
              Sign out
            </button>
          </div>
        )}
      </header>

      <main>
        <div className="empty-state">
          <h2>Your saved items will appear here</h2>
          <p style={{ marginTop: 8 }}>
            Forward a link, image, or PDF to the Engram WhatsApp number to save it.
            <br />Search comes next — for now, everything is working! 🎉
          </p>
        </div>
      </main>
    </div>
  );
}
