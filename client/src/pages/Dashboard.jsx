import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const message = error => error.response?.data?.error || (error.message === 'File exceeds 10 MB' ? error.message : 'Could not reach the server. Please try again.');
const icons = { link: '🔗', image: '🖼️', pdf: '📄', text: '📝' };

function ItemCard({ item, onEdit, onDelete, onRetry, onError }) {
  const [mediaUrl, setMediaUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const tags = item.userEdits?.tags ?? item.enrichment?.tags ?? [];
  const category = item.userEdits?.category ?? item.enrichment?.category;
  const title = item.enrichment?.title || item.rawText?.slice(0, 80) || (item.type === 'pdf' ? 'Saved PDF' : 'Saved image');
  const openMedia = async () => {
    setBusy(true);
    try { const { data } = await api.get(`/items/${item._id}/media`); setMediaUrl(data.url); }
    catch (error) { onError(message(error)); }
    finally { setBusy(false); }
  };
  return <article id={`item-${item._id}`} className="item-card">
    <div className="item-top"><div className="item-heading"><span aria-hidden="true">{icons[item.type]}</span>
      <h2>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{title}</a> : title}</h2>
    </div><span className={`status-pill status-${item.status}`}>{item.status}</span></div>
    <p className="item-summary">{item.enrichment?.summary || item.rawText || 'Content will appear after processing.'}</p>
    {item.partial && <p className="notice">Page unavailable. Original content is still saved.</p>}
    <div className="item-tags">{category && <span>{category}</span>}{tags.map(tag => <span key={tag}>#{tag}</span>)}</div>
    {item.error && <p className="alert alert-error" role="status">{item.error}</p>}
    {mediaUrl && item.type === 'image' && <img className="media-preview" src={mediaUrl} alt={item.enrichment?.description || title} onError={() => { setMediaUrl(''); onError('Preview expired or unavailable. Click View file to try again.'); }} />}
    {mediaUrl && <p><a href={mediaUrl} target="_blank" rel="noreferrer">Open {item.type === 'pdf' ? 'PDF' : 'image'} in a new tab ↗</a></p>}
    {item.enrichment?.extractedText && <details><summary>Extracted text</summary><p className="extracted-text">{item.enrichment.extractedText}</p></details>}
    <div className="item-footer"><time>{new Date(item.originalTimestamp || item.createdAt).toLocaleString('en-IN')}</time>
      <div className="item-actions">
        {item.media?.key && <button disabled={busy} onClick={openMedia}>{busy ? 'Loading…' : 'View file'}</button>}
        {['failed', 'done'].includes(item.status) && <button onClick={() => onRetry(item._id)}>{item.status === 'failed' ? 'Retry' : 'Reprocess'}</button>}
        <button onClick={() => onEdit(item)}>Edit</button>
        <button onClick={() => onDelete(item._id)}>Delete</button>
      </div>
    </div>
  </article>;
}

function EditModal({ item, onClose, onSave }) {
  const [category, setCategory] = useState(item.userEdits?.category ?? item.enrichment?.category ?? '');
  const [tags, setTags] = useState((item.userEdits?.tags ?? item.enrichment?.tags ?? []).join(', '));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try { await onSave(item._id, { category, tags: [...new Set(tags.split(',').map(t => t.trim()).filter(Boolean))] }); onClose(); }
    catch (err) { setError(message(err)); }
    finally { setSaving(false); }
  };
  return <div className="modal-backdrop"><form className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title" onSubmit={save} onKeyDown={e => { if (e.key === 'Escape' && !saving) onClose(); }}>
    <h2 id="edit-title">Edit saved item</h2><p>Your changes stay when AI processes this item again.</p>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <label>Category<input value={category} maxLength={80} onChange={e => setCategory(e.target.value)} autoFocus /></label>
    <label>Tags, separated by commas<input value={tags} onChange={e => setTags(e.target.value)} /></label>
    <div className="dialog-actions"><button type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
  </form></div>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [quickAdd, setQuickAdd] = useState('');
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [askMode, setAskMode] = useState(false);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [view, setView] = useState('timeline');
  const [filters, setFilters] = useState({ type: '', dateFrom: '', dateTo: '', category: '', status: '' });
  const [cursor, setCursor] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [linkCode, setLinkCode] = useState(null);
  const requestVersion = useRef(0);

  const params = useCallback(() => Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), [filters]);
  const loadIdentity = useCallback(async () => {
    try { const { data } = await api.get('/auth/me'); setUser(data); }
    catch (err) { if (err.response?.status === 401) navigate('/login'); else setError(message(err)); }
  }, [navigate]);
  useEffect(() => { loadIdentity(); }, [loadIdentity]);

  const loadItems = useCallback(async (nextCursor = null, quiet = false) => {
    const version = ++requestVersion.current;
    if (!quiet) setLoading(true);
    try {
      const { data } = await api.get('/items', { params: { ...params(), limit: 15, ...(nextCursor ? { cursor: nextCursor } : {}) } });
      if (version !== requestVersion.current) return;
      setItems(prev => nextCursor ? [...prev, ...data.items] : data.items);
      setCursor(data.nextCursor);
    } catch (err) { if (version === requestVersion.current) setError(message(err)); }
    finally { if (version === requestVersion.current && !quiet) setLoading(false); }
  }, [params]);
  useEffect(() => { if (view === 'timeline' && user) loadItems(); }, [loadItems, view, user?.userId]);
  useEffect(() => {
    // Do not replace a search or a multi-page timeline during background refresh.
    if (view !== 'timeline' || items.length > 15 || !items.some(i => ['pending', 'processing'].includes(i.status))) return;
    const timer = setInterval(() => loadItems(null, true), 5000);
    return () => clearInterval(timer);
  }, [items, view, loadItems]);
  useEffect(() => {
    if (!linkCode || user?.whatsappPhone) return;
    const timer = setInterval(loadIdentity, 5000);
    return () => clearInterval(timer);
  }, [linkCode, user?.whatsappPhone, loadIdentity]);

  const runAction = async fn => {
    setError(''); setSuccess('');
    try { await fn(); } catch (err) { setError(message(err)); }
  };
  const handleAdd = e => {
    e.preventDefault();
    runAction(async () => {
      if (!quickAdd.trim() && !file) return;
      setAdding(true);
      try {
        if (file) {
          if (file.size > 10 * 1024 * 1024) throw new Error('File exceeds 10 MB');
          const data = await new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file);
          });
          await api.post('/items/upload', { data, mime: file.type, caption: quickAdd });
        } else await api.post('/items', { text: quickAdd });
        setQuickAdd(''); setFile(null); if (fileRef.current) fileRef.current.value = '';
        setSuccess('Saved. Processing in the background.'); setAnswer(null); setView('timeline'); await loadItems();
      } finally { setAdding(false); }
    });
  };
  const handleSearch = e => {
    e.preventDefault();
    runAction(async () => {
      if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) { setError('Start date must be before end date.'); return; }
      if (!query.trim() && !askMode) { setView('timeline'); setAnswer(null); setWarnings([]); return loadItems(); }
      if (!query.trim()) { setError('Enter a question first.'); return; }
      const version = ++requestVersion.current;
      setAsking(true); setAnswer(null); setWarnings([]);
      try {
        const searchParams = { ...params(), q: query }; delete searchParams.status;
        const { data } = askMode ? await api.post('/items/ask', searchParams) : await api.get('/items/search', { params: searchParams });
        if (version !== requestVersion.current) return;
        setItems(data.items || []); setCursor(null); setWarnings(data.warnings || []);
        setView('search'); if (askMode) setAnswer(data);
      } finally { setAsking(false); setLoading(false); }
    });
  };
  const retry = id => runAction(async () => { await api.post(`/items/${id}/retry`); setSuccess('Queued for processing.'); setItems(prev => prev.map(item => item._id === id ? { ...item, status: 'pending', error: null } : item)); });
  const remove = id => {
    if (!confirm('Delete this item and its stored file?')) return;
    runAction(async () => { await api.delete(`/items/${id}`); setItems(prev => prev.filter(item => item._id !== id)); setSuccess('Item deleted.'); });
  };
  const saveEdit = async (id, edits) => { const { data } = await api.patch(`/items/${id}`, edits); setItems(prev => prev.map(item => item._id === id ? data : item)); setSuccess('Changes saved.'); };
  const changeFilter = (key, value) => { requestVersion.current++; setFilters(prev => ({ ...prev, [key]: value })); setView('timeline'); setAnswer(null); setWarnings([]); };

  return <div className="dashboard">
    <header className="dashboard-header"><div className="brand"><div className="brand-dot" /><span className="brand-name">Engram</span></div>
      <div className="header-actions"><span>{user?.email}</span><button className="btn btn-ghost" onClick={() => runAction(async () => { await api.post('/auth/logout'); navigate('/login'); })}>Sign out</button></div>
    </header>
    <main className="workspace">
      <div className="workspace-intro"><h1>Your saved things, found again.</h1><p>Save a note, link, screenshot or PDF. Search by meaning when you need it.</p></div>
      {error && <div className="alert alert-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
      {success && <div className="alert alert-success" role="status">{success}</div>}
      {warnings.map(warning => <div className="notice" role="status" key={warning}>{warning}</div>)}
      <section className="capture-panel" aria-labelledby="save-title"><h2 id="save-title">Save something</h2>
        <form onSubmit={handleAdd}><textarea id="quick-add-input" value={quickAdd} maxLength={20000} onChange={e => setQuickAdd(e.target.value)} placeholder="Paste a link, write a note, or add a caption to your file…" aria-label="Note, link or caption" />
          <div className="capture-actions"><label className="file-label">Attach image or PDF<input ref={fileRef} id="file-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => {
            const selected = e.target.files?.[0];
            if (selected?.size > 10 * 1024 * 1024) { setError('Choose a file smaller than 10 MB.'); e.target.value = ''; return; }
            setFile(selected || null);
          }} /></label><button id="quick-add-btn" className="btn" disabled={adding || (!quickAdd.trim() && !file)}>{adding ? 'Saving…' : 'Save'}</button></div>
          <p className="field-hint">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : 'JPEG, PNG, WebP or PDF · up to 10 MB · stored privately'}</p>
        </form>
      </section>
      <section className="search-panel" aria-label="Search saved items"><form onSubmit={handleSearch} className="search-row"><input id="search-input" value={query} maxLength={500} onChange={e => setQuery(e.target.value)} placeholder={askMode ? 'Ask a question about your saved items…' : 'Try “wifi screenshot” or “links from August”…'} aria-label="Search query" />
        <button id="ask-toggle-btn" type="button" className={askMode ? 'mode-active' : ''} aria-pressed={askMode} onClick={() => { setAskMode(!askMode); setAnswer(null); }}>Ask AI</button>
        <button id="search-btn" className="btn" disabled={asking}>{asking ? 'Searching…' : askMode ? 'Ask' : 'Search'}</button></form>
        <div className="filters"><label>Type<select value={filters.type} onChange={e => changeFilter('type', e.target.value)}><option value="">All types</option>{['link', 'image', 'pdf', 'text'].map(type => <option key={type}>{type}</option>)}</select></label>
          <label>From<input type="date" value={filters.dateFrom} onChange={e => changeFilter('dateFrom', e.target.value)} /></label><label>To<input type="date" value={filters.dateTo} onChange={e => changeFilter('dateTo', e.target.value)} /></label>
          <label>Category<input value={filters.category} maxLength={80} placeholder="Any category" onChange={e => changeFilter('category', e.target.value)} /></label>
          <label>Status<select value={filters.status} onChange={e => changeFilter('status', e.target.value)}><option value="">All statuses</option>{['pending', 'processing', 'done', 'failed'].map(status => <option key={status}>{status}</option>)}</select></label>
        </div><p className="field-hint">Dates use UTC. Status applies to the timeline; search and Ask use type, date and category.</p>
      </section>
      <section className="whatsapp-panel"><div><strong>{user?.whatsappPhone ? `WhatsApp linked: ${user.whatsappPhone}` : 'Save straight from WhatsApp'}</strong><p>Forward to the Engram business number. Test mode requires your number to be whitelisted.</p></div>
        {!user?.whatsappPhone && <div>{linkCode && <p className="link-code">{linkCode}<small>Send this code to the bot within 10 minutes.</small></p>}<button id="link-whatsapp-btn" onClick={() => runAction(async () => { const { data } = await api.post('/auth/link-code'); setLinkCode(data.code); })}>{linkCode ? 'New code' : 'Get Link Code'}</button></div>}
      </section>
      {answer && <section className="answer-panel"><h2>Answer from your saved items</h2><p>{answer.answer}</p><div className="source-links">{answer.sources?.map(source => <a key={source._id} href={`#item-${source._id}`}>{source.title}</a>)}</div></section>}
      <div className="results-heading"><h2>{view === 'search' ? 'Search results' : 'Your timeline'}</h2><button onClick={() => { setView('timeline'); setQuery(''); setAnswer(null); setWarnings([]); loadItems(); }}>Refresh timeline</button></div>
      {loading && <p role="status">Loading saved items…</p>}
      {!loading && !items.length && <div className="empty-state"><h2>{error ? 'Could not load your items' : view === 'search' ? 'No matching items' : 'Nothing saved here yet'}</h2><p>{view === 'search' ? 'Try fewer words or a wider date range.' : 'Save a note, link or file above, or adjust your filters.'}</p><button onClick={() => loadItems()}>Try again</button></div>}
      <div className="items-list">{items.map(item => <ItemCard key={item._id} item={item} onEdit={setEditItem} onDelete={remove} onRetry={retry} onError={setError} />)}</div>
      {cursor && view === 'timeline' && <button className="btn load-more" disabled={loading} onClick={() => loadItems(cursor)}>{loading ? 'Loading…' : 'Load more'}</button>}
      <p className="field-hint">Pending items on the first timeline page refresh every 5 seconds.</p>
    </main>
    {editItem && <EditModal item={editItem} onClose={() => setEditItem(null)} onSave={saveEdit} />}
  </div>;
}
