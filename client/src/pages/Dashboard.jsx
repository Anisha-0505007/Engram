import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { DesktopContext } from '../desktop/DesktopContext';
import DesktopWindow from '../desktop/DesktopWindow';
import useDesktopWindows from '../desktop/useDesktopWindows';
import useActivity from '../desktop/useActivity';
import Spotlight from '../desktop/Spotlight';
import LibraryWindow from '../desktop/LibraryWindow';
import SavedItemCard from '../desktop/SavedItemCard';
import ItemDialog from '../desktop/ItemDialog';
import { AccountWindow, ConnectWindow, HelpWindow, SearchWindow } from '../desktop/AuxiliaryWindows';
import { ClassificationNotice, Notifications } from '../desktop/Activity';
import { emptyFilters, errorMessage, Folder, Icon, sections, titleFor } from '../desktop/shared';

const initialSearch = { items: [], sources: [], answer: '', query: '', busy: false, error: '', warnings: [] };
export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [identityError, setIdentityError] = useState('');
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState('all');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('search');
  const [filterSets, setFilterSets] = useState({});
  const [searches, setSearches] = useState({ search: initialSearch, ask: initialSearch });
  const [searchHost, setSearchHost] = useState(null);
  const [source, setSource] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const [removed, setRemoved] = useState(new Set());
  const [protectedItems, setProtectedItems] = useState(new Set());
  const [unlockUntil, setUnlockUntil] = useState(0);
  const [vaultExpired, setVaultExpired] = useState(false);
  const [now, setNow] = useState(Date.now());
  const searchRef = useRef(null);
  const generations = useRef({ search: 0, ask: 0 });
  const desktop = useDesktopWindows(user?.userId);
  const activity = useActivity(user?.userId, version);
  const unlocked = unlockUntil > now;
  const notice = useCallback((text, error = false) => setToast({ text, error }), []);
  const invalidate = useCallback(() => setVersion(value => value + 1), []);
  const loadIdentity = useCallback(async () => {
    try { const { data } = await api.get('/auth/me', { timeout: 15000 }); setUser(data); setIdentityError(''); }
    catch (err) { if (err.response?.status === 401) navigate('/login'); else setIdentityError(errorMessage(err)); }
  }, [navigate]);
  useEffect(() => { loadIdentity(); }, [loadIdentity]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(null), 6000); return () => clearTimeout(timer); } }, [toast]);
  useEffect(() => {
    const keyboard = event => {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !document.querySelector('dialog[open]') && !event.target.closest('input, textarea, select, [contenteditable="true"]')) { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === 'Escape') document.querySelectorAll('.menubar-menu[open]').forEach(menu => { menu.removeAttribute('open'); menu.querySelector('summary').focus(); });
    };
    const outside = event => document.querySelectorAll('.menubar-menu[open]').forEach(menu => { if (!menu.contains(event.target)) menu.removeAttribute('open'); });
    window.addEventListener('keydown', keyboard); document.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', keyboard); document.removeEventListener('pointerdown', outside); };
  }, []);
  const clearVault = useCallback(expired => {
    setUnlockUntil(0); setVaultExpired(expired);
    setDialog(current => current?.item?.confidential ? null : current);
    setSource(current => current?.confidential ? null : current);
  }, []);
  useEffect(() => {
    const tick = () => { const time = Date.now(); setNow(time); if (unlockUntil && time >= unlockUntil) clearVault(true); };
    const timer = setInterval(tick, unlockUntil ? 1000 : 30000);
    const expiry = unlockUntil ? setTimeout(tick, Math.max(0, unlockUntil - Date.now())) : null;
    const focus = async () => {
      tick();
      if (unlockUntil) { try { const { data } = await api.get('/vault'); if (!data.unlocked) clearVault(true); } catch { clearVault(true); } }
    };
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); clearTimeout(expiry); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', tick); };
  }, [unlockUntil, clearVault]);
  const unlock = async password => { await api.post('/vault/unlock', { password }); const time = Date.now(); setNow(time); setUnlockUntil(time + 300000); setVaultExpired(false); };
  const lock = async () => { clearVault(false); try { await api.post('/vault/lock'); } catch (err) { notice(errorMessage(err), true); } };
  const signOut = async () => { try { await api.post('/auth/logout'); clearVault(false); navigate('/login'); } catch (err) { notice(errorMessage(err), true); } };
  const open = (id, keepSearch = false) => { if (!keepSearch && id === searchHost) setSearchHost(null); setSelected(id); desktop.open(id); if (innerWidth < 768) window.scrollTo(0, 0); };
  const home = () => { desktop.home(); window.scrollTo(0, 0); };
  const close = id => { if (id === 'confidential') lock(); if (id === 'source') setSource(null); if (id === searchHost) setSearchHost(null); desktop.close(id); searchRef.current?.focus(); };
  const openSource = item => { setSource(item); open('source'); };
  const forgetSearchItem = id => setSearches(current => Object.fromEntries(Object.entries(current).map(([key, value]) => {
    const affected = value.items?.some(item => item._id === id);
    return [key, { ...value, items: value.items?.filter(item => item._id !== id), sources: value.sources?.filter(item => item._id !== id), ...(affected && key === 'ask' ? { answer: '', error: 'A source changed. Ask again to refresh this answer.' } : {}) }];
  })));
  const hideItem = id => { setProtectedItems(current => new Set([...current, id])); setSource(current => current?._id === id ? null : current); forgetSearchItem(id); };
  const removeItem = id => { setRemoved(current => new Set([...current, id])); setSource(current => current?._id === id ? null : current); forgetSearchItem(id); };
  const filterTarget = sections.some(section => section.id === desktop.active && section.id !== 'confidential') ? desktop.active : 'search';
  const filters = filterSets[filterTarget] || emptyFilters;
  const setFilters = value => setFilterSets(current => ({ ...current, [filterTarget]: value }));
  const submit = async (requestedMode = mode, requestedQuery = query, requestedFilters = filters) => {
    if (!requestedQuery.trim()) { searchRef.current?.focus(); return; }
    if (requestedFilters.dateFrom && requestedFilters.dateTo && requestedFilters.dateFrom > requestedFilters.dateTo) { notice('Saved from must be before saved through.', true); return; }
    const id = requestedMode === 'ask' ? 'ask' : 'search';
    const request = ++generations.current[id];
    setSearches(current => ({ ...current, [id]: { ...initialSearch, query: requestedQuery, filters: requestedFilters, busy: true } }));
    const host = id === 'search' && sections.some(section => section.id === desktop.active && section.id !== 'confidential') ? desktop.active : id;
    if (id === 'search') setSearchHost(host);
    open(host, true);
    try {
      const params = { ...Object.fromEntries(Object.entries(requestedFilters).filter(([key, value]) => key !== 'status' && value)), q: requestedQuery, section: 'all', timezone: 'Asia/Kolkata' };
      const { data } = id === 'ask' ? await api.post('/items/ask', params, { timeout: 120000 }) : await api.get('/items/search', { params, timeout: 120000 });
      if (request === generations.current[id]) setSearches(current => ({ ...current, [id]: { ...data, query: requestedQuery, filters: requestedFilters, busy: false, error: '' } }));
    } catch (err) { if (request === generations.current[id]) setSearches(current => ({ ...current, [id]: { ...current[id], busy: false, error: errorMessage(err) } })); }
  };
  const context = { user, activity, loadIdentity, version, invalidate, notice, open, openSource, setDialog, signOut, removed, protectedItems, removeItem, hideItem, unlocked, unlockUntil, vaultExpired, now, unlock, lock };
  const chooseMenu = (event, action) => { event.currentTarget.closest('details')?.removeAttribute('open'); action(); };
  const date = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' }).format(now);
  const renderWindow = id => {
    if (sections.some(section => section.id === id)) {
      if (id === searchHost) return <><button className="back-to-library" onClick={() => setSearchHost(null)}>Back to {titleFor(id)}</button><SearchWindow state={searches.search} retry={() => submit('search', searches.search.query, searches.search.filters)}/></>;
      return <><ClassificationNotice/><LibraryWindow section={id} filters={filterSets[id] || emptyFilters}/></>;
    }
    if (id === 'connect') return <ConnectWindow/>;
    if (id === 'account') return <AccountWindow/>;
    if (id === 'help') return <HelpWindow/>;
    if (id === 'search' || id === 'ask') return <SearchWindow state={searches[id]} ask={id === 'ask'} retry={() => submit(id, searches[id].query, searches[id].filters)}/>;
    if (id === 'source' && source && (!source.confidential || unlocked)) return <SavedItemCard key={source._id} item={source} full/>;
    return <p className="footnote">Open a saved item from your library.</p>;
  };
  return <DesktopContext.Provider value={context}><div className={`engram-desktop ${desktop.active && !desktop.windows[desktop.active]?.minimized ? 'desktop-has-window' : ''}`}>
    <header className="menu-bar"><a className="menu-brand" href="/dashboard" onClick={event => { event.preventDefault(); home(); }}>Engram</a><nav aria-label="Application menu">
      <details className="menubar-menu"><summary>File</summary><div className="dropdown"><button onClick={event => chooseMenu(event, () => open('all'))}>Open library</button><button onClick={event => chooseMenu(event, invalidate)}>Refresh windows</button><button disabled={!desktop.active} onClick={event => chooseMenu(event, () => close(desktop.active))}>Close window</button></div></details>
      <details className="menubar-menu"><summary>View</summary><div className="dropdown"><button onClick={event => chooseMenu(event, home)}>Desktop / Home</button>{sections.map(section => <button key={section.id} onClick={event => chooseMenu(event, () => open(section.id))}>{section.title}</button>)}</div></details>
      <button onClick={() => open('connect')}>Connect</button><button onClick={() => open('help')}>Help</button>
    </nav><div className="menu-right"><span className="timezone-label">Times in IST</span><details className="menubar-menu account-menu"><summary aria-label="Account menu">{user?.email || 'Your account'}<Icon name="chevron" size={11}/></summary><div className="dropdown"><span className="menu-identity">{user?.email}</span><button onClick={event => chooseMenu(event, () => open('account'))}>Account details</button><button onClick={event => chooseMenu(event, signOut)}>Sign out</button></div></details><time>{date}</time></div></header>
    <Spotlight inputRef={searchRef} query={query} setQuery={setQuery} mode={mode} setMode={setMode} filters={filters} setFilters={setFilters} onSubmit={() => submit()} busy={searches[mode === 'ask' ? 'ask' : 'search'].busy} timeline={desktop.active !== searchHost && sections.some(section => section.id === desktop.active && section.id !== 'confidential')}/>
    {user && <Notifications/>}
    <nav className="folder-rail" aria-label="Library folders">{sections.map(section => <button key={section.id} className={`desktop-folder ${selected === section.id ? 'folder-selected' : ''}`} aria-label={`Open ${section.title}`} aria-pressed={selected === section.id} onClick={() => { if (innerWidth < 768) open(section.id); else setSelected(section.id); }} onDoubleClick={() => open(section.id)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); open(section.id); } }}><Folder icon={section.icon} locked={section.id === 'confidential'}/><span>{section.title}</span>{section.id === 'confidential' && <small>{unlocked ? 'Unlocked' : 'Locked'}</small>}</button>)}</nav>
    <div className="desktop-welcome" aria-hidden="true"><span>YOUR EVERYDAY, REMEMBERED.</span><p>A little<br/>less lost.</p><small>A home for the things you save.</small></div>
    {!user && <div className="desktop-loading" role="status">{identityError ? <><p>{identityError}</p><button onClick={loadIdentity}>Try again</button></> : <><span className="spinner"/>Opening your library…</>}</div>}
    {user && Object.entries(desktop.windows).map(([id, record]) => <DesktopWindow key={id} id={id} title={id === searchHost ? 'Search results' : titleFor(id)} record={record} active={desktop.active === id} onFocus={desktop.focus} onClose={close} onMove={desktop.move} onMinimize={desktop.minimize} onMaximize={desktop.maximize}>
      {renderWindow(id)}
    </DesktopWindow>)}
    <nav className="desktop-dock" aria-label="Application dock"><button className="dock-button mobile-home" aria-label="Home" onClick={home}><Icon name="home" size={24}/><span className="dock-tooltip">Home</span></button>{sections.map(section => <button key={section.id} className={`dock-button dock-${section.id} ${desktop.active === section.id ? 'dock-active' : ''}`} aria-label={section.title} aria-current={desktop.active === section.id ? 'page' : undefined} onClick={() => open(section.id)}><Icon name={section.icon} size={25}/><span className="dock-tooltip">{section.title}</span>{desktop.windows[section.id] && <span className="dock-dot"/>}{section.id === 'upcoming' && activity.reminders.length > 0 && <span className="dock-badge">{activity.reminders.length}</span>}</button>)}<span className="dock-divider"/>{[['connect', 'connect'], ['account', 'account']].map(([id, icon]) => <button key={id} className="dock-button" aria-label={id === 'connect' ? 'Connect WhatsApp' : 'Account'} onClick={() => open(id)}><Icon name={icon} size={24}/><span className="dock-tooltip">{id === 'connect' ? 'Connect' : 'Account'}</span></button>)}</nav>
    <span className="desktop-signature">Engram<span>A second memory.</span></span>
    {toast && <div className={`desktop-toast ${toast.error ? 'toast-error' : ''}`} role={toast.error ? 'alert' : 'status'}><Icon name={toast.error ? 'bell' : 'check'} size={18}/><span>{toast.text}</span><button aria-label="Dismiss message" onClick={() => setToast(null)}><Icon name="close" size={15}/></button></div>}
    {dialog && (!dialog.item.confidential || unlocked) && <ItemDialog key={`${dialog.kind}:${dialog.item._id}`} {...dialog} onClose={() => setDialog(null)}/>}
  </div></DesktopContext.Provider>;
}
