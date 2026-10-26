export const sections = [
  { id: 'all', title: 'All items', icon: 'library', subtitle: 'Everything, in its own place.' },
  { id: 'links', title: 'Links', icon: 'link', subtitle: 'A little corner of the internet, saved.' },
  { id: 'upcoming', title: 'Upcoming', icon: 'calendar', subtitle: 'What is coming up, and where you saved it.' },
  { id: 'photos', title: 'Photos', icon: 'image', subtitle: 'Screenshots, photographs, and things worth keeping.' },
  { id: 'confidential', title: 'Confidential', icon: 'lock', subtitle: 'A private place for sensitive things.' },
];
export const titleFor = id => sections.find(section => section.id === id)?.title || ({ connect: 'Connect WhatsApp', account: 'Your account', help: 'About Engram', search: 'Search results', ask: 'Ask AI', source: 'Saved item' }[id] || 'Engram');
export const emptyFilters = { type: '', dateFrom: '', dateTo: '', category: '', status: '' };
export const errorMessage = error => error.response?.data?.error || (error.code === 'ECONNABORTED' ? 'This is taking longer than expected. Please try again.' : 'Could not reach Engram. Please try again.');
export const itemTitle = item => item.enrichment?.title || item.rawText?.slice(0, 100) || ({ image: 'Saved image', pdf: 'Saved PDF', link: 'Saved link', text: 'Saved note' }[item.type] || 'Saved item');
export const sourceLabel = source => ({ 'linked-device': 'Personal WhatsApp', whatsapp: 'Business number', web: 'Web', export: 'Import' }[source] || 'Saved item');
export function formatDate(value, dateOnly = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', ...(dateOnly ? {} : { hour: 'numeric', minute: '2-digit' }) });
}
export function Icon({ name, size = 20, ...props }) {
  const paths = {
    library: 'M4 4h5v16H4z M11 4h4v16h-4z M17 5l3-1 4 15-3 1z',
    link: 'M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-2 2 M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l2-2',
    calendar: 'M5 5h14a2 2 0 012 2v13H3V7a2 2 0 012-2z M7 3v5 M17 3v5 M3 11h18 M7 15h3 M14 15h3',
    image: 'M3 4h18v16H3z M3 17l6-6 4 4 3-3 5 5 M15 8h.01',
    lock: 'M6 10h12v11H6z M8 10V7a4 4 0 018 0v3 M12 14v3',
    search: 'M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z M16 16l5 5',
    spark: 'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z',
    connect: 'M8 3v5 M16 3v5 M6 8h12v4a6 6 0 01-12 0z M12 18v4',
    account: 'M12 12a4 4 0 110-8 4 4 0 010 8z M4 21v-2a8 8 0 0116 0v2',
    home: 'M3 11l9-8 9 8 M6 9v12h12V9 M10 21v-7h4v7',
    more: 'M5 12h.01 M12 12h.01 M19 12h.01',
    close: 'M6 6l12 12 M18 6L6 18',
    arrow: 'M5 12h14 M14 7l5 5-5 5',
    refresh: 'M20 7v5h-5 M4 17v-5h5 M6 6a8 8 0 0114 6 M18 18A8 8 0 014 12',
    file: 'M5 2h9l5 5v15H5z M14 2v6h5 M8 12h8 M8 16h6',
    text: 'M4 5h16 M12 5v15 M8 20h8',
    check: 'M5 12l4 4L19 6',
    chevron: 'M6 9l6 6 6-6',
    bell: 'M6 9a6 6 0 0112 0v5l3 3H3l3-3z M10 21h4',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.file} /></svg>;
}
export function Folder({ icon, locked = false }) {
  return <span className={`folder-picture ${locked ? 'folder-private' : ''}`} aria-hidden="true"><svg viewBox="0 0 72 60" fill="none"><path d="M5 14a5 5 0 015-5h17l7 7h28a5 5 0 015 5v30H5z" fill="currentColor" opacity=".72"/><path d="M5 25a5 5 0 015-5h52a5 5 0 015 5v26a5 5 0 01-5 5H10a5 5 0 01-5-5z" fill="currentColor"/><path d="M10 21h52" stroke="white" opacity=".55"/></svg><span><Icon name={icon} size={22}/></span></span>;
}
