import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';
import { errorMessage } from './shared';

export default function useActivity(userId, version) {
  const [reminders, setReminders] = useState([]);
  const [overview, setOverview] = useState({ confidential: 0, classifying: 0, classificationFailed: 0 });
  const [error, setError] = useState('');
  const busy = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!userId || busy.current) return;
    const request = ++generation.current; busy.current = true;
    try {
      const [events, counts] = await Promise.all([api.get('/items/reminders', { timeout: 15000 }), api.get('/items/overview', { timeout: 15000 })]);
      if (request === generation.current) { setReminders(events.data.reminders); setOverview(counts.data); setError(''); }
    } catch (err) { if (request === generation.current) setError(errorMessage(err)); }
    finally { if (request === generation.current) busy.current = false; }
  }, [userId]);
  useEffect(() => {
    refresh(); const focus = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = setInterval(focus, 30000); window.addEventListener('focus', focus);
    return () => { clearInterval(timer); window.removeEventListener('focus', focus); generation.current++; busy.current = false; };
  }, [refresh]);
  useEffect(() => { if (version) refresh(); }, [version, refresh]);
  return { reminders, overview, error, refresh };
}
