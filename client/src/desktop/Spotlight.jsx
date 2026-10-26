import { useEffect, useRef, useState } from 'react';
import { Icon } from './shared';

export default function Spotlight({ inputRef, query, setQuery, mode, setMode, filters, setFilters, onSubmit, busy, timeline }) {
  const [popover, setPopover] = useState(null);
  const root = useRef(null);
  useEffect(() => {
    const outside = event => { if (!root.current?.contains(event.target)) setPopover(null); };
    const keyboard = event => { if (event.key === 'Escape') setPopover(null); };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keyboard); };
  }, []);
  const update = (key, value) => setFilters({ ...filters, [key]: value });
  const labels = [['type', filters.type || 'Content type'], ['date', filters.dateFrom || filters.dateTo ? 'Saved dates · Set' : 'Saved date range'], ['category', filters.category || 'Category'], ['status', filters.status || 'Processing status']];
  return <div className="spotlight" ref={root}>
    <form className="spotlight-bar" onSubmit={event => { event.preventDefault(); setPopover(null); onSubmit(); }}>
      <Icon name={mode === 'ask' ? 'spark' : 'search'} size={22}/><label className="sr-only" htmlFor="spotlight-query">Search your non-confidential library</label><input ref={inputRef} id="spotlight-query" autoComplete="off" maxLength={500} value={query} onChange={event => setQuery(event.target.value)} placeholder={mode === 'ask' ? 'Ask something about your saved world…' : 'Find a little thing you saved…'}/>
      <div className="mode-switch" aria-label="Search mode"><button type="button" aria-pressed={mode === 'search'} className={mode === 'search' ? 'selected' : ''} onClick={() => setMode('search')}>Search</button><button type="button" aria-pressed={mode === 'ask'} className={mode === 'ask' ? 'selected' : ''} onClick={() => setMode('ask')}>Ask AI</button></div>
      <button className="spotlight-submit" aria-label={mode === 'ask' ? 'Ask your saved items' : 'Search saved items'} disabled={busy || !query.trim()}>{busy ? <span className="spinner"/> : <Icon name="arrow" size={19}/>}</button>
    </form>
    <div className="filter-chips">{labels.map(([key, label]) => <div className="filter-anchor" key={key}>
      <button className={`filter-chip ${filters[key] || (key === 'date' && (filters.dateFrom || filters.dateTo)) ? 'filter-set' : ''}`} aria-label={label} aria-expanded={popover === key} aria-controls={`filter-${key}`} disabled={key === 'status' && !timeline} title={key === 'status' ? 'Processing status applies to timeline browsing only' : undefined} onClick={() => setPopover(popover === key ? null : key)}><span className="chip-label-full">{label}</span><span className="chip-label-short">{key === 'type' && !filters.type ? 'Type' : key === 'status' && !filters.status ? 'Status' : key === 'date' && !filters.dateFrom && !filters.dateTo ? 'Saved dates' : label}</span><Icon name="chevron" size={12}/></button>
      {popover === key && <div className="filter-popover" id={`filter-${key}`}>
        {key === 'type' && <label>Content type<select value={filters.type} onChange={event => { update('type', event.target.value); setPopover(null); }}><option value="">All types</option>{['link', 'image', 'pdf', 'text'].map(type => <option key={type} value={type}>{type === 'pdf' ? 'PDF' : type}</option>)}</select></label>}
        {key === 'date' && <><label>Saved from<input type="date" value={filters.dateFrom} onChange={event => update('dateFrom', event.target.value)}/></label><label>Saved through<input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={event => update('dateTo', event.target.value)}/></label><p>Original message date, in IST.</p></>}
        {key === 'category' && <label>Category<input value={filters.category} maxLength={80} onChange={event => update('category', event.target.value)} placeholder="e.g. education"/></label>}
        {key === 'status' && <label>Processing status<select value={filters.status} onChange={event => { update('status', event.target.value); setPopover(null); }}><option value="">All statuses</option>{['pending', 'processing', 'done', 'failed'].map(status => <option key={status}>{status}</option>)}</select></label>}
        <button className="popover-done" onClick={() => setPopover(null)}>Done</button>
      </div>}
    </div>)}{Object.values(filters).some(Boolean) && <button className="clear-filters" onClick={() => setFilters({ type: '', dateFrom: '', dateTo: '', category: '', status: '' })}>Clear</button>}</div>
    <p className="search-helper">Saved dates use India time. Confidential items are never searched.<kbd>/</kbd></p>
  </div>;
}
