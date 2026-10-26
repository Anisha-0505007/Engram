import { useState } from 'react';
import api from '../api';
import { useDesktop } from './DesktopContext';
import { Icon, errorMessage, formatDate, itemTitle, sourceLabel } from './shared';

const statusText = { pending: 'Saved, waiting to process', processing: 'Processing your saved content', done: 'Ready to find again', partial: "Some info unavailable, e.g. a page couldn't be opened", failed: 'Still saved. Retry available', classifying: 'Privacy check running; hidden from ordinary views until done' };
export default function SavedItemCard({ item, full = false }) {
  const desktop = useDesktop();
  const [expanded, setExpanded] = useState(full);
  const [media, setMedia] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const title = itemTitle(item);
  const tags = item.userEdits?.tags ?? item.enrichment?.tags ?? [];
  const category = item.userEdits?.category ?? item.enrichment?.category;
  const status = item.privacyPending ? 'classifying' : item.status === 'failed' ? 'failed' : item.partial ? 'partial' : item.status;
  const url = /^https?:\/\//i.test(item.url || '') ? item.url : item.rawText?.match(/https?:\/\/[^\s<>]+/i)?.[0];
  const invoke = async (action, notice) => {
    setBusy(true); setError('');
    try { await action(); if (notice) desktop.notice(notice); desktop.invalidate(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  const viewFile = async () => {
    setBusy(true); setError('');
    try { const { data } = await api.get(`/items/${item._id}/media`); setMedia(data.url); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  const menuAction = (event, action) => { event.currentTarget.closest('details').removeAttribute('open'); action(); };
  return <article className={`saved-card ${full ? 'saved-card-full' : ''}`} id={full ? `item-${item._id}` : undefined} data-item-id={item._id}>
    <div className="saved-card-heading"><span className={`file-symbol file-${item.type}`}><Icon name={item.type === 'pdf' ? 'file' : item.type}/></span>
      <div className="saved-card-name"><span className="eyebrow">{item.type === 'pdf' ? 'PDF document' : item.type === 'text' ? 'Note' : item.type}</span><button className="item-title" onClick={() => desktop.openSource(item)}>{title}</button></div>
      <span title={statusText[status]} className={`status-pill status-${status}`}>{status || 'Pending'}</span>
    </div>
    <p className={`saved-summary ${expanded ? 'summary-expanded' : ''}`}>{item.enrichment?.summary || item.rawText || (item.status === 'failed' ? 'Your file is still saved. Processing can be retried.' : 'Saved safely. Content will appear after processing.')}</p>
    <div className="item-tags">{category && <span className="category-tag">{category}</span>}{tags.slice(0, full ? 20 : 4).map(tag => <span key={tag}>{tag}</span>)}</div>
    {item.events?.filter(event => new Date(event.dueAt) >= new Date()).map((event, index) => <div className="event-strip" key={event._id || index}>
      <Icon name="calendar" size={17}/><div><strong>{event.label}</strong><p>Event date · {formatDate(event.dueAt, event.dateOnly)}{event.dateOnly ? ' · Date only' : ' IST'}</p><details><summary>Supporting quote</summary><blockquote>{event.evidence}</blockquote></details></div>
    </div>)}
    {item.partial && <p className="inline-note">Some page information was unavailable. Your original content is saved.</p>}
    {item.error && <details className="item-error"><summary>Processing details · Retry available</summary><p>{item.error}</p></details>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {expanded && <div className="extracted-content"><h4>Saved content</h4><p>{item.enrichment?.extractedText || item.rawText || item.enrichment?.description || 'No extracted text is available.'}</p></div>}
    {media && <div className="media-content">{item.type === 'image' && <img src={media} alt={item.enrichment?.description || title} onError={() => { setMedia(''); setError('This file link expired. Choose View file again.'); }}/>}<a href={media} target="_blank" rel="noreferrer">Open original {item.type === 'pdf' ? 'PDF' : 'file'} <Icon name="arrow" size={14}/></a></div>}
    <div className="saved-card-footer"><div className="saved-metadata"><time dateTime={item.originalTimestamp || item.createdAt}>Saved {formatDate(item.originalTimestamp || item.createdAt)} IST</time><span>{sourceLabel(item.source)}</span></div>
      <div className="card-actions">{item.media?.key ? <button className="small-primary" disabled={busy} onClick={viewFile}>{busy ? 'Opening…' : 'View file'}<Icon name="arrow" size={14}/></button> : url ? <a className="small-primary" href={url} target="_blank" rel="noreferrer">Open link<Icon name="arrow" size={14}/></a> : <button onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : 'Read note'}</button>}
        <details className="actions-menu" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.removeAttribute('open'); event.currentTarget.querySelector('summary').focus(); } }}><summary aria-label={`More actions for ${title}`}><Icon name="more"/></summary><div className="dropdown card-dropdown">
          <button onClick={event => menuAction(event, () => setExpanded(value => !value))}>{expanded ? 'Hide extracted text' : 'Extracted text'}</button>
          <button onClick={event => menuAction(event, () => desktop.setDialog({ kind: 'edit', item }))}>Edit category & tags</button>
          {['done', 'failed'].includes(item.status) && <button disabled={busy} onClick={event => menuAction(event, () => invoke(() => api.post(`/items/${item._id}/retry`), 'Queued for processing.'))}>{item.status === 'failed' ? 'Retry processing' : 'Reprocess'}</button>}
          {!item.confidential && <button disabled={!desktop.unlocked || busy} title={!desktop.unlocked ? 'Unlock Confidential first' : undefined} onClick={event => menuAction(event, () => invoke(async () => { await api.post(`/items/${item._id}/confidential`); desktop.hideItem(item._id); }, 'Moved to Confidential.'))}>Mark confidential</button>}
          <button className="danger-text" onClick={event => menuAction(event, () => desktop.setDialog({ kind: 'delete', item }))}>Delete…</button>
        </div></details>
      </div>
    </div>
  </article>;
}
