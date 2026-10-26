import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';
import { errorMessage } from './shared';

export default function useLibrary(section, filters, enabled, version) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const busy = useRef(false);
  const abort = useRef(null);
  const filterKey = JSON.stringify(filters);
  const load = useCallback(async (nextCursor = null, quiet = false) => {
    if (!enabled || (quiet && busy.current)) return;
    const selectedFilters = JSON.parse(filterKey);
    if (selectedFilters.dateFrom && selectedFilters.dateTo && selectedFilters.dateFrom > selectedFilters.dateTo) {
      setError('Saved from must be before saved through.'); setLoading(false); setRefreshing(false); return;
    }
    const generation = ++request.current;
    abort.current?.abort(); abort.current = new AbortController(); busy.current = true;
    setRefreshing(true); setError('');
    try {
      const params = { section, timezone: 'Asia/Kolkata', limit: 15, ...Object.fromEntries(Object.entries(selectedFilters).filter(([, value]) => value)), ...(nextCursor ? { cursor: nextCursor } : {}) };
      const { data } = await api.get('/items', { params, signal: abort.current.signal, timeout: 15000 });
      if (generation !== request.current) return;
      setItems(current => nextCursor ? [...current, ...data.items] : data.items); setCursor(data.nextCursor);
    } catch (err) { if (generation === request.current && err.code !== 'ERR_CANCELED') setError(errorMessage(err)); }
    finally { if (generation === request.current) { busy.current = false; setLoading(false); setRefreshing(false); } }
  }, [section, filterKey, enabled]);
  useEffect(() => {
    request.current++; abort.current?.abort(); busy.current = false;
    setItems([]); setCursor(null); setLoading(enabled); setError('');
    if (enabled) load();
    return () => { request.current++; abort.current?.abort(); busy.current = false; };
  }, [load, enabled]);
  useEffect(() => { if (enabled && version) load(); }, [version]);
  useEffect(() => {
    if (!enabled || cursor) return;
    const refresh = () => { if (document.visibilityState === 'visible') load(null, true); };
    const timer = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load, enabled, cursor]);
  return { items, cursor, loading, refreshing, error, load };
}
