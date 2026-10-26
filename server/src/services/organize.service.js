// Conservative local checks run before AI; users can also protect an item manually.
export function looksConfidential(text = '') {
  return /\b(aadhaar|aadhar|adhar|passport|pan\s*card|credit\s*card|debit\s*card|card\s*(no|number)|cvv|password|confidential|bank\s*account)\b/i.test(text)
    || /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/.test(text)
    || /\b(?:\d[ -]?){15,19}\b/.test(text);
}

export function verifiedEvents(events = [], source = '') {
  return events.filter(event => {
    if (!source.toLowerCase().includes(event.evidence.toLowerCase())) return false;
    if (!/\d|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(event.evidence)) return false;
    const years = event.evidence.match(/\b(?:19|20)\d{2}\b/g);
    if (years && !years.includes(event.date.slice(0, 4))) return false;
    const explicitDates = event.evidence.match(/\b\d{4}-\d{2}-\d{2}\b/g);
    return !explicitDates || explicitDates.includes(event.date);
  })
    .map(event => {
      // Date-only events remain visible through the end of their day in India.
      const time = event.time || '23:59:59';
      const dueAt = new Date(`${event.date}T${time}+05:30`);
      return { label: event.label, evidence: event.evidence, dueAt, dateOnly: !event.time };
    }).filter(event => Number.isFinite(event.dueAt.getTime()));
}

export function reminderStage(dueAt, now = Date.now()) {
  const remaining = new Date(dueAt).getTime() - now;
  if (remaining < 0 || remaining > 86400_000) return null;
  return remaining <= 3600_000 ? 'hour' : 'day';
}
