import { useEffect, useState } from 'react';
import api from '../api';
import { useDesktop } from './DesktopContext';
import { Icon, errorMessage, itemTitle } from './shared';
import SavedItemCard from './SavedItemCard';
import { EmptyState, Skeletons } from './LibraryWindow';

export function ConnectWindow() {
  const desktop = useDesktop();
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!code || desktop.user.whatsappPhone) return;
    const timer = setInterval(desktop.loadIdentity, 5000); return () => clearInterval(timer);
  }, [code, desktop.user.whatsappPhone]);
  const link = async () => {
    setBusy(true); setError('');
    try { const { data } = await api.post('/auth/link-code'); setCode(data.code); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return <div className="connection-content"><span className="eyebrow">A BRIDGE TO YOUR LIBRARY</span><h3>Save the way you already do.</h3><p>Choose how WhatsApp sends things to Engram.</p>
    <article className="connection-card"><div className="connection-heading"><span className="connection-icon"><Icon name="connect" size={24}/></span><h4>Personal connector</h4><span className="status-pill">Status unavailable</span></div><p>Runs on your computer and saves new messages from your own Message Yourself chat.</p><details open><summary>Set up your connector</summary><ol><li>Open the <code>connector</code> folder in a terminal and run <code>npm start</code>.</li><li>Enter this server’s URL, <code>{location.origin}</code>, and sign in to Engram.</li><li>On your phone, go to WhatsApp → Linked Devices → Link a device → Link with phone number. Use the pairing code from your terminal.</li><li>Keep the terminal running. Send a new note, link, image or PDF to Message Yourself.</li></ol></details><p className="footnote">The website cannot check whether your local connector is running or pair it for you. Only new messages are captured, not history. This is an unofficial local integration.</p></article>
    <article className="connection-card"><div className="connection-heading"><span className="connection-icon"><Icon name="file" size={24}/></span><h4>Business number</h4><span className={`status-pill ${desktop.user.whatsappPhone ? 'status-done' : ''}`}>{desktop.user.whatsappPhone ? 'Phone linked' : 'Not linked'}</span></div><p>Send or forward content to Engram’s business number. Link your phone to your account with a one-time code.</p>{desktop.user.whatsappPhone ? <p>Linked phone: {desktop.user.whatsappPhone}</p> : <><button onClick={link} disabled={busy}>{busy ? 'Getting code…' : code ? 'Get a new code' : 'Get link code'}<Icon name="arrow" size={16}/></button>{code && <div className="link-code"><strong>{code}</strong><p>Send this code to the business number within 10 minutes.</p></div>}</>}{error && <p className="inline-error" role="alert">{error}</p>}<p className="footnote">Meta test mode requires your phone number to be whitelisted. A linked phone does not confirm that every external service is available.</p></article>
  </div>;
}

export function SearchWindow({ state, ask = false, retry }) {
  const desktop = useDesktop();
  if (state.busy) return <><div className="library-intro"><span className="eyebrow">{ask ? 'ASK YOUR LIBRARY' : 'LOOKING THROUGH YOUR LIBRARY'}</span><h3>{state.query}</h3></div><Skeletons/></>;
  return <><div className="library-intro"><span className="eyebrow">{ask ? 'AN ANSWER, WITH ITS SOURCES' : 'FOUND IN YOUR SAVED WORLD'}</span><h3>{state.query || (ask ? 'Ask your saved things.' : 'Search your saved things.')}</h3><p>Non-confidential items only.</p></div>
    {state.error && <div className="inline-error" role="alert"><p>{state.error}</p><button onClick={retry}>Try again</button></div>}
    {state.warnings?.map(warning => <p className="inline-note" key={warning}>{warning}</p>)}
    {ask ? <div className="ask-layout"><div className="answer-content"><Icon name="spark" size={26}/><h4>From your saved items</h4><p>{state.answer || "I couldn't find that in your saved items."}</p><span className="footnote">Answers use retrieved items. Check the sources for context.</span></div><aside className="answer-sources"><h4>Sources</h4>{state.sources?.length ? state.sources.map(source => {
      const item = state.items?.find(value => value._id === source._id);
      return <article className="source-card" key={source._id}><Icon name={source.type === 'pdf' ? 'file' : source.type} size={20}/><a href={`#item-${source._id}`} onClick={event => { event.preventDefault(); if (item) desktop.openSource(item); }}>{source.title || (item ? itemTitle(item) : 'Saved item')}</a><p>{item?.enrichment?.description || item?.rawText?.slice(0, 160)}</p></article>;
    }) : <p className="footnote">No relevant sources found.</p>}</aside></div> : state.items?.length ? <div className="saved-items">{state.items.filter(item => !desktop.removed.has(item._id) && !desktop.protectedItems.has(item._id)).map(item => <SavedItemCard key={item._id} item={item}/>)}</div> : !state.error && <EmptyState title="No matching items.">Try fewer words, a broader topic, or a wider saved-date range.</EmptyState>}
  </>;
}

export function AccountWindow() {
  const desktop = useDesktop();
  return <div className="account-content"><div className="account-avatar"><Icon name="account" size={34}/></div><span className="eyebrow">YOUR ENGRAM ACCOUNT</span><h3>A library of your own.</h3><p className="account-email">{desktop.user.email}</p><p>Saved content belongs to this account. Confidential needs a separate password unlock to view.</p><button className="primary" onClick={desktop.signOut}>Sign out<Icon name="arrow" size={16}/></button></div>;
}
export function HelpWindow() {
  return <div className="help-content"><span className="eyebrow">A LITTLE LESS LOST</span><h3>Meet your second memory.</h3><p>Engram organizes the notes, links, screenshots and PDFs you save through WhatsApp.</p><h4>Find by meaning</h4><p>Try a topic such as “garden photo” or “internship link”. Search combines keywords with semantic matching. Ask AI adds an answer with saved sources.</p><h4>A date has two meanings</h4><p>Saved date is when the original message was sent. Event date is a deadline or event mentioned inside it. Dates are shown in India time.</p><h4>Private things stay apart</h4><p>Classification is automatic. Sensitive items go to Confidential and never enter AI search or answers. Password lock is not end-to-end encryption.</p><h4>Make yourself at home</h4><p>Double-click a folder, or select it and press Enter. Dock icons open with one click. Press / to search. Focus a window title bar and use arrow keys to move it; Shift moves it farther. Escape closes a focused title bar.</p></div>;
}
