import api from '../api';
import { useDesktop } from './DesktopContext';
import { Icon, errorMessage, formatDate } from './shared';

export function Notifications() {
  const desktop = useDesktop();
  const { reminders, error, refresh } = desktop.activity;
  const dismiss = async reminder => {
    try { await api.post(`/items/${reminder.itemId}/dismiss-reminder`, { key: reminder.key }); await refresh(); }
    catch (err) { desktop.notice(errorMessage(err), true); }
  };
  return <aside className={`notification-center ${reminders.length ? 'has-reminders' : ''}`} aria-label="In-app reminders">
    <div className="notification-heading"><span><Icon name="bell" size={16}/>Reminders</span><button aria-label="Refresh reminders" onClick={refresh}><Icon name="refresh" size={14}/></button></div>
    {error && <div className="inline-error" role="alert"><p>{error}</p><button onClick={refresh}>Retry</button></div>}
    <div className="notification-list">{reminders.length ? reminders.map(reminder => <article className={`notification-card ${reminder.stage === 'hour' ? 'notification-urgent' : ''}`} key={`${reminder.itemId}:${reminder.key}`}>
      <div className="notification-type"><span>{reminder.stage === 'hour' ? 'URGENT · WITHIN AN HOUR' : 'DUE WITHIN 24 HOURS'}</span><button aria-label={`Dismiss reminder: ${reminder.label}`} onClick={() => dismiss(reminder)}><Icon name="close" size={14}/></button></div>
      <h3>{reminder.label}</h3><p>Event date · {formatDate(reminder.dueAt, reminder.dateOnly)}{reminder.dateOnly ? ' · Date only' : ' IST'}</p><button className="notification-link" onClick={() => desktop.open('upcoming')}>View Upcoming<Icon name="arrow" size={14}/></button>
    </article>) : !error && <div className="caught-up"><span className="caught-up-icon"><Icon name="check" size={20}/></span><h3>A little breathing room.</h3><p>No events due in the next 24 hours.</p></div>}</div>
    <p className="notification-footnote">In-app only. Reminders update while Engram is open.</p>
  </aside>;
}
export function ClassificationNotice() {
  const desktop = useDesktop();
  const { overview } = desktop.activity;
  const retry = async () => {
    try { await api.post('/items/retry-classification'); desktop.invalidate(); desktop.notice('Automatic classification queued.'); }
    catch (err) { desktop.notice(errorMessage(err), true); }
  };
  return <>{overview.classifying > 0 && <div className="classification-notice" role="status"><span className="spinner"/><p><strong>Classifying {overview.classifying} file{overview.classifying === 1 ? '' : 's'}</strong><br/>Privacy checks run automatically. Your files are still saved.</p></div>}{overview.classificationFailed > 0 && <div className="inline-note"><p>Your files are still saved. Retry automatic classification.</p><button onClick={retry}>Retry automatic classification</button></div>}</>;
}
