import { useCallback, useEffect, useRef, useState } from 'react';
import { sections } from './shared';

const allowed = new Set([...sections.map(section => section.id), 'search', 'ask', 'connect', 'account', 'help', 'source']);
function raise(windows, id, record = windows[id]) {
  const others = Object.entries(windows).filter(([key]) => key !== id).sort((a, b) => a[1].z - b[1].z);
  // Keep every window below the fixed menu/search/dock, even after many clicks.
  return Object.fromEntries([...others.map(([key, value], index) => [key, { ...value, z: 10 + index }]), [id, { ...record, z: 30 }]]);
}
export default function useDesktopWindows(userId) {
  const [windows, setWindows] = useState({});
  const [active, setActive] = useState(null);
  const layouts = useRef({});
  const lastSection = useRef('all');
  const focus = useCallback(id => { setActive(id); setWindows(current => current[id] ? raise(current, id) : current); }, []);
  const open = useCallback(id => {
    if (!allowed.has(id)) return;
    setWindows(current => {
      const saved = layouts.current[id] || {};
      const width = Math.max(340, Math.min(saved.width || 780, innerWidth - (innerWidth >= 1200 ? 490 : 190)));
      const next = current[id] || { x: Math.max(0, Math.min(saved.x ?? 146 + Object.keys(current).length * 24, Math.max(0, innerWidth - width))), y: Math.max(166, Math.min(saved.y ?? 190 + Object.keys(current).length * 18, innerHeight - 180)), width, height: Math.max(260, Math.min(saved.height || 570, innerHeight - 290)), maximized: Boolean(saved.maximized) };
      return raise(current, id, { ...next, minimized: false });
    });
    setActive(id);
    if (sections.some(section => section.id === id)) lastSection.current = id;
  }, []);
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`engram-desktop:${userId}`) || '{}');
      layouts.current = Object.fromEntries(Object.entries(saved.layouts || {}).filter(([id, value]) => allowed.has(id) && value && ['x', 'y', 'height'].every(key => Number.isFinite(value[key]))).map(([id, value]) => [id, { x: value.x, y: value.y, height: value.height, width: Number.isFinite(value.width) ? value.width : undefined, maximized: Boolean(value.maximized) }]));
      lastSection.current = sections.some(section => section.id === saved.lastSection) ? saved.lastSection : 'all';
    } catch { layouts.current = {}; }
    open(lastSection.current);
  }, [userId, open]);
  useEffect(() => {
    if (!userId || !Object.keys(windows).length) return;
    for (const [id, value] of Object.entries(windows)) layouts.current[id] = { x: value.x, y: value.y, height: value.height, width: value.width, maximized: Boolean(value.maximized) };
    const timer = setTimeout(() => {
      // Only window geometry and a section name are stored, never library content.
      try { localStorage.setItem(`engram-desktop:${userId}`, JSON.stringify({ layouts: layouts.current, lastSection: lastSection.current })); } catch { /* Layout persistence is optional. */ }
    }, 200);
    return () => clearTimeout(timer);
  }, [windows, userId]);
  useEffect(() => {
    const resize = () => {
      if (innerWidth < 768) return;
      setWindows(current => Object.fromEntries(Object.entries(current).map(([id, record]) => {
        const width = Math.min(record.width, Math.max(340, innerWidth - 180));
        const height = Math.min(record.height, Math.max(260, innerHeight - 290));
        return [id, { ...record, width, height, x: Math.max(0, Math.min(record.x, innerWidth - width - 12)), y: Math.max(166, Math.min(record.y, innerHeight - height - 95)) }];
      })));
    };
    window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);
  const close = id => { setWindows(current => { const next = { ...current }; delete next[id]; return next; }); setActive(current => current === id ? null : current); };
  const change = (id, patch) => setWindows(current => current[id] ? { ...current, [id]: { ...current[id], ...patch } } : current);
  return { windows, active, open, focus, close, home: () => { setWindows(current => Object.fromEntries(Object.entries(current).map(([id, record]) => [id, { ...record, minimized: true }]))); setActive(null); }, move: change, minimize: id => { change(id, { minimized: true }); setActive(null); }, maximize: id => change(id, { maximized: !windows[id]?.maximized }) };
}
