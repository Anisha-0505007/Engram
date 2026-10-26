import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { useDesktop } from './DesktopContext';
import { Icon, errorMessage, itemTitle } from './shared';

export default function ItemDialog({ kind, item, onClose, dark = false }) {
  const desktop = useDesktop();
  const ref = useRef(null);
  const [title, setTitle] = useState(item.userEdits?.title ?? '');
  const [category, setCategory] = useState(item.userEdits?.category ?? item.enrichment?.category ?? '');
  const [tags, setTags] = useState((item.userEdits?.tags ?? item.enrichment?.tags ?? []).join(', '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (kind === 'delete') { await api.delete(`/items/${item._id}`); desktop.removeItem(item._id); }
      else {
        const { data } = await api.patch(`/items/${item._id}`, { title: title.trim() || null, category, tags: [...new Set(tags.split(',').map(tag => tag.trim()).filter(Boolean))] });
        desktop.updateItem(data);
      }
      desktop.notice(kind === 'delete' ? 'Item and stored media deleted.' : 'Changes saved.'); desktop.invalidate(); onClose();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  return <dialog className={`item-dialog ${dark ? 'window-dark' : ''}`} ref={ref} aria-labelledby="item-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="dialog-title"><h2 id="item-dialog-title">{kind === 'delete' ? 'Delete this saved item?' : 'Make it your own.'}</h2><button aria-label="Close dialog" disabled={busy} onClick={onClose}><Icon name="close" size={18}/></button></div>
    <p>{kind === 'delete' ? `“${itemTitle(item)}” and its stored media will be removed. This cannot be undone.` : 'Your heading, category and tags stay when AI processes this item again.'}</p>
    <form onSubmit={submit}>{kind === 'edit' && <><label>Message heading<input value={title} placeholder={item.enrichment?.title || itemTitle({ ...item, userEdits: {} })} maxLength={160} onChange={event => setTitle(event.target.value)} autoFocus/></label><p className="heading-hint">Leave blank to use the automatic heading. {title.length}/160</p><label>Category<input value={category} maxLength={80} onChange={event => setCategory(event.target.value)}/></label><label>Tags, separated by commas<input value={tags} onChange={event => setTags(event.target.value)}/></label></>}
      {error && <p className="inline-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" disabled={busy} onClick={onClose} autoFocus={kind === 'delete'}>Cancel</button><button className={kind === 'delete' ? 'danger' : 'primary'} disabled={busy}>{busy ? 'Working…' : kind === 'delete' ? 'Delete item & media' : 'Save changes'}</button></div>
    </form>
  </dialog>;
}
