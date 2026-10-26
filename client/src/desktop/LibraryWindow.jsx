import { useState } from 'react';
import { useDesktop } from './DesktopContext';
import useLibrary from './useLibrary';
import SavedItemCard from './SavedItemCard';
import { Icon, sections } from './shared';

export function Skeletons() { return <div className="skeletons" role="status" aria-label="Loading saved items">{[0, 1, 2].map(key => <div className="skeleton-card" key={key}><span/><span/><span/></div>)}</div>; }
export function EmptyState({ title = 'A little space for your saved things.', children }) {
  const desktop = useDesktop();
  return <div className="empty-state"><span className="empty-glyph"><Icon name="library" size={30}/></span><h3>{title}</h3><p>{children || 'Send a new note, link, photo or PDF to Message Yourself with your connector running.'}</p><button onClick={() => desktop.open('connect')}>Connect WhatsApp<Icon name="arrow" size={16}/></button></div>;
}
export default function LibraryWindow({ section, filters }) {
  const desktop = useDesktop();
  const [localQuery, setLocalQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const privateSection = section === 'confidential';
  const library = useLibrary(section, privateSection ? { q: submittedQuery } : filters, !privateSection || desktop.unlocked, desktop.version);
  const visibleItems = library.items.filter(item => !desktop.removed.has(item._id) && (privateSection || !desktop.protectedItems.has(item._id)));
  const unlock = async event => {
    event.preventDefault(); setUnlocking(true); setUnlockError('');
    try { await desktop.unlock(password); setPassword(''); }
    catch (error) { setUnlockError(error.response?.status === 403 ? "That password didn't match. Try again." : 'Could not unlock. Please try again.'); }
    finally { setUnlocking(false); }
  };
  const seconds = Math.max(0, Math.ceil((desktop.unlockUntil - desktop.now) / 1000));
  return <>
    <div className="library-intro"><span className="eyebrow">YOUR PERSONAL LIBRARY</span><h3>{sections.find(value => value.id === section)?.title}</h3><p>{sections.find(value => value.id === section)?.subtitle}</p></div>
    {privateSection && !desktop.unlocked ? <div className="vault-locked"><div className="lock-illustration"><Icon name="lock" size={42}/></div><h3>{desktop.vaultExpired ? 'Locked after 5 minutes' : 'Just for you.'}</h3><p>Re-enter your Engram password to view protected items. Classification happens automatically.</p><form onSubmit={unlock}><label htmlFor="vault-password">Account password</label><input id="vault-password" type="password" value={password} autoComplete="current-password" onChange={event => setPassword(event.target.value)} required maxLength={72}/>{unlockError && <p className="inline-error" role="alert">{unlockError}</p>}<button className="primary" disabled={unlocking}>{unlocking ? 'Unlocking…' : 'Unlock Confidential'}<Icon name="lock" size={16}/></button></form></div> : <>
      {privateSection && <div className="vault-controls"><span><Icon name="lock" size={15}/> Unlocked · <time>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</time></span><button onClick={desktop.lock}>Lock now</button><form onSubmit={event => { event.preventDefault(); setSubmittedQuery(localQuery); }}><label className="sr-only" htmlFor="private-search">Search protected items by exact text</label><input id="private-search" value={localQuery} maxLength={500} onChange={event => setLocalQuery(event.target.value)} placeholder="Exact text search, only here"/><button aria-label="Search Confidential"><Icon name="search" size={17}/></button></form></div>}
      <div className="library-toolbar"><span>{visibleItems.length ? `${visibleItems.length} saved item${visibleItems.length === 1 ? '' : 's'}` : 'Your saved content'}{library.refreshing && !library.loading && <span className="refreshing-label"> · Refreshing</span>}</span><button className="quiet-button" onClick={() => library.load()} disabled={library.refreshing}><Icon name="refresh" size={15}/>Refresh</button></div>
      {library.error && <div className="inline-error" role="alert"><p>{library.error}</p><button onClick={() => library.load()}>Try again</button></div>}
      {library.loading ? <Skeletons/> : !visibleItems.length ? <EmptyState title={privateSection ? 'No protected items here.' : section === 'upcoming' ? 'Nothing on the horizon.' : undefined}>{privateSection ? 'Sensitive content will appear here automatically. An exact-text search may narrow your results.' : section === 'upcoming' ? 'Future dates found in your saved messages will appear here. Try a wider filter if you expected an event.' : undefined}</EmptyState> : <div className="saved-items">{visibleItems.map(item => <SavedItemCard key={item._id} item={item}/>)}</div>}
      {library.cursor && <button className="load-more" disabled={library.refreshing} onClick={() => library.load(library.cursor)}>{library.refreshing ? 'Loading…' : 'Load more'}<Icon name="chevron" size={15}/></button>}
    </>}
    {privateSection && <p className="vault-footnote">Password lock, not end-to-end encryption. Detection can be wrong. Unmarked media uses external AI.</p>}
  </>;
}
