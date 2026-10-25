import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

// ── STATUS BADGE ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    pending:    { background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' },
    processing: { background: '#3b82f622', color: '#3b82f6', border: '1px solid #3b82f644' },
    done:       { background: '#10b98122', color: '#10b981', border: '1px solid #10b98144' },
    failed:     { background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444' },
  };
  return (
    <span style={{
      ...styles[status],
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px'
    }}>
      {status}
    </span>
  );
}

// ── TYPE ICON ─────────────────────────────────────────────────────────────────
function TypeIcon({ type }) {
  const icons = { link: '🔗', image: '🖼️', pdf: '📄', text: '📝', unsupported: '❓' };
  return <span style={{ fontSize: 18 }}>{icons[type] || '📝'}</span>;
}

// ── ITEM CARD ─────────────────────────────────────────────────────────────────
function ItemCard({ item, onDelete, onRetry, onEdit }) {
  const title = item.enrichment?.title || item.rawText?.slice(0, 60) || 'Untitled';
  const summary = item.enrichment?.summary || item.rawText?.slice(0, 120) || '';
  const tags = item.userEdits?.tags?.length ? item.userEdits.tags : (item.enrichment?.tags || []);
  const category = item.userEdits?.category || item.enrichment?.category;

  return (
    <div className="item-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <TypeIcon type={item.type} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)', lineHeight: 1.3, marginBottom: 4 }}>
              {title}
            </div>
            {summary && (
              <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0, lineHeight: 1.5 }}>
                {summary.slice(0, 150)}{summary.length > 150 ? '…' : ''}
              </p>
            )}
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              <StatusBadge status={item.status} />
              {category && (
                <span style={{ background: '#8b5cf622', color: '#8b5cf6', border: '1px solid #8b5cf644', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                  {category}
                </span>
              )}
              {tags.map(tag => (
                <span key={tag} style={{ background: 'var(--color-surface)', padding: '2px 8px', borderRadius: 999, fontSize: 11, color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
                  #{tag}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 6 }}>
              {new Date(item.originalTimestamp || item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {item.status === 'failed' && (
            <button onClick={() => onRetry(item._id)} title="Retry" style={{ background: 'none', border: '1px solid #f59e0b', color: '#f59e0b', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
              ↺ Retry
            </button>
          )}
          <button onClick={() => onEdit(item)} title="Edit tags" style={{ background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-muted)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
            ✏️
          </button>
          <button onClick={() => onDelete(item._id)} title="Delete" style={{ background: 'none', border: '1px solid #ef444444', color: '#ef4444', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
            🗑
          </button>
        </div>
      </div>
      {item.error && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: '#ef444411', borderRadius: 6, fontSize: 12, color: '#ef4444' }}>
          ⚠ {item.error}
        </div>
      )}
    </div>
  );
}

// ── EDIT MODAL ────────────────────────────────────────────────────────────────
function EditModal({ item, onClose, onSave }) {
  const [category, setCategory] = useState(item.userEdits?.category || item.enrichment?.category || '');
  const [tags, setTags] = useState((item.userEdits?.tags || item.enrichment?.tags || []).join(', '));

  const handleSave = async () => {
    await onSave(item._id, { category, tags: tags.split(',').map(t => t.trim()).filter(Boolean) });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24, width: 380, maxWidth: '90vw' }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--color-text)' }}>Edit Item</h3>
        <label style={{ fontSize: 13, color: 'var(--color-muted)' }}>Category</label>
        <input value={category} onChange={e => setCategory(e.target.value)} className="input" style={{ marginBottom: 12 }} />
        <label style={{ fontSize: 13, color: 'var(--color-muted)' }}>Tags (comma-separated)</label>
        <input value={tags} onChange={e => setTags(e.target.value)} className="input" placeholder="e.g. study, finance, important" />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ width: 'auto', padding: '8px 16px' }}>Cancel</button>
          <button onClick={handleSave} className="btn" style={{ width: 'auto', padding: '8px 16px' }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [user, setUser]           = useState(null);
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [searchQ, setSearchQ]     = useState('');
  const [quickAdd, setQuickAdd]   = useState('');
  const [adding, setAdding]       = useState(false);
  const [searching, setSearching] = useState(false);
  const [linkCode, setLinkCode]   = useState(null);
  const [editItem, setEditItem]   = useState(null);
  const [filterType, setFilterType] = useState('');
  const [hasMore, setHasMore]     = useState(false);
  const [cursor, setCursor]       = useState(null);
  const navigate = useNavigate();

  // Fetch identity
  useEffect(() => {
    api.get('/auth/me')
      .then(r => setUser(r.data))
      .catch(() => navigate('/login'));
  }, [navigate]);

  // Load items
  const loadItems = useCallback(async (reset = true) => {
    setLoading(true);
    try {
      const params = { limit: 15 };
      if (filterType) params.type = filterType;
      if (!reset && cursor) params.cursor = cursor;
      const { data } = await api.get('/items', { params });
      setItems(prev => reset ? data.items : [...prev, ...data.items]);
      setHasMore(!!data.nextCursor);
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [filterType, cursor]);

  useEffect(() => { loadItems(true); }, [filterType]); // eslint-disable-line

  // Auto-refresh pending/processing items every 5s
  useEffect(() => {
    const iv = setInterval(() => {
      const needsRefresh = items.some(i => i.status === 'pending' || i.status === 'processing');
      if (needsRefresh) loadItems(true);
    }, 5000);
    return () => clearInterval(iv);
  }, [items]); // eslint-disable-line

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQ.trim()) return loadItems(true);
    setSearching(true);
    try {
      const { data } = await api.get('/items/search', { params: { q: searchQ, type: filterType } });
      setItems(data.items);
      setHasMore(false);
    } finally {
      setSearching(false);
    }
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!quickAdd.trim()) return;
    setAdding(true);
    try {
      await api.post('/items', { text: quickAdd });
      setQuickAdd('');
      loadItems(true);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this item?')) return;
    await api.delete(`/items/${id}`);
    setItems(prev => prev.filter(i => i._id !== id));
  };

  const handleRetry = async (id) => {
    await api.post(`/items/${id}/retry`);
    loadItems(true);
  };

  const handleEdit = (item) => setEditItem(item);

  const handleSaveEdit = async (id, { category, tags }) => {
    const { data } = await api.patch(`/items/${id}`, { category, tags });
    setItems(prev => prev.map(i => i._id === id ? data : i));
  };

  const handleLinkCode = async () => {
    const { data } = await api.post('/auth/link-code');
    setLinkCode(data.code);
  };

  const handleLogout = async () => {
    await api.post('/auth/logout');
    navigate('/login');
  };

  const phoneLinked = user?.whatsappPhone;

  return (
    <div className="dashboard">
      {/* ── HEADER ── */}
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

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '24px 16px' }}>

        {/* ── QUICK ADD ── */}
        <form onSubmit={handleQuickAdd} style={{ marginBottom: 24, display: 'flex', gap: 8 }}>
          <input
            id="quick-add-input"
            className="input"
            style={{ flex: 1, margin: 0 }}
            value={quickAdd}
            onChange={e => setQuickAdd(e.target.value)}
            placeholder="Paste a link, or type a note to save…"
          />
          <button id="quick-add-btn" type="submit" className="btn" style={{ width: 'auto', padding: '10px 20px' }} disabled={adding}>
            {adding ? '…' : 'Save'}
          </button>
        </form>

        {/* ── SEARCH ── */}
        <form onSubmit={handleSearch} style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <input
            id="search-input"
            className="input"
            style={{ flex: 1, margin: 0 }}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search your saved items…"
          />
          <button id="search-btn" type="submit" className="btn btn-ghost" style={{ width: 'auto', padding: '10px 20px' }} disabled={searching}>
            {searching ? '…' : '🔍'}
          </button>
        </form>

        {/* ── FILTERS ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {['', 'link', 'image', 'pdf', 'text'].map(t => (
            <button key={t} onClick={() => { setFilterType(t); setSearchQ(''); }}
              style={{
                padding: '4px 14px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
                background: filterType === t ? 'var(--color-accent)' : 'var(--color-surface)',
                color: filterType === t ? '#fff' : 'var(--color-muted)',
                border: '1px solid var(--color-border)',
                transition: 'all 0.15s',
              }}>
              {t || 'All'} {t === 'link' ? '🔗' : t === 'image' ? '🖼️' : t === 'pdf' ? '📄' : t === 'text' ? '📝' : ''}
            </button>
          ))}
        </div>

        {/* ── WHATSAPP LINK SECTION ── */}
        {!phoneLinked && (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--color-muted)' }}>
              📱 Link your WhatsApp number to save content by forwarding messages to the Engram bot.
            </p>
            {!linkCode ? (
              <button id="link-whatsapp-btn" className="btn" style={{ width: 'auto', padding: '8px 18px' }} onClick={handleLinkCode}>
                Get Link Code
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 4, color: 'var(--color-accent)' }}>{linkCode}</span>
                <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Send this code to your Engram WhatsApp bot! Expires in 10 min.</span>
              </div>
            )}
          </div>
        )}
        {phoneLinked && (
          <p style={{ fontSize: 13, color: '#10b981', marginBottom: 16 }}>
            ✅ WhatsApp linked: {phoneLinked}
          </p>
        )}

        {/* ── ITEMS LIST ── */}
        {loading && items.length === 0 && (
          <div className="page-center" style={{ minHeight: 200 }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="empty-state">
            <h2>No items yet</h2>
            <p style={{ marginTop: 8, color: 'var(--color-muted)', fontSize: 14 }}>
              Paste a link above, or link your WhatsApp and forward content to the bot.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => (
            <ItemCard
              key={item._id}
              item={item}
              onDelete={handleDelete}
              onRetry={handleRetry}
              onEdit={handleEdit}
            />
          ))}
        </div>

        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button className="btn btn-ghost" style={{ width: 'auto', padding: '8px 24px' }} onClick={() => loadItems(false)}>
              Load more
            </button>
          </div>
        )}
      </main>

      {editItem && (
        <EditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
