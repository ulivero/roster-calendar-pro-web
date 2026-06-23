function sanitizeText(s) {
  // Apple/iCloud Calendar accepts UTF-8 in ICS, including emojis.
  // We only remove control characters that can break the file.
  return String(s || '')
    .replace(/→/g, '-')
    .replace(/·/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function escapeICS(s) {
  return sanitizeText(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function toUTC(iso) {
  // The app stores local Buenos Aires times without timezone.
  // Argentina is UTC-03:00, so we explicitly convert to UTC for Apple/iCloud compatibility.
  const d = new Date(`${iso}-03:00`);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function safeUid(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function hash32(str) {
  // Deterministic small hash. Used only for SEQUENCE changes, not for event identity.
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function stableEventUid(ev) {
  const date = String(ev.start || '').slice(0, 10).replace(/-/g, '');
  const title = String(ev.title || '');

  // Flights: stable by date + flight number + route.
  const flightMatch = title.match(/\b(AR\d{3,4})\b/);
  const routeMatch = title.match(/([A-Z]{3})\s*-\s*([A-Z]{3})/);
  if (flightMatch && routeMatch) {
    return `${date}-${flightMatch[1]}-${routeMatch[1]}-${routeMatch[2]}@rostercalendarpro.local`;
  }

  // Report/debrief: stable by date + dutyId.
  if (ev.type === 'report' || ev.type === 'debrief') {
    return `${date}-${safeUid(ev.type)}-${safeUid(ev.dutyId || ev.id)}@rostercalendarpro.local`;
  }

  // Activities: OFF / Guardia / INMAE / NPR / RAC stable by date + type + title.
  return `${date}-${safeUid(ev.type || 'event')}-${safeUid(title || ev.id)}@rostercalendarpro.local`;
}

function foldLine(line) {
  // Safer conservative folding for Apple/iCloud.
  const max = 70;
  if (line.length <= max) return line;
  let out = '';
  let rest = line;
  while (rest.length > max) {
    out += rest.slice(0, max) + '\r\n ';
    rest = rest.slice(max);
  }
  return out + rest;
}

function buildICS(events) {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Roster Calendar Pro//AR Roster//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:AR Roster',
    'X-WR-RELCALID:rostercalendarpro-ar-roster'
  ];

  for (const ev of events) {
    const uid = stableEventUid(ev);
    const sequence = 630000;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`SEQUENCE:${sequence}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`LAST-MODIFIED:${now}`);
    lines.push(`DTSTART:${toUTC(ev.start)}`);
    lines.push(`DTEND:${toUTC(ev.end)}`);
    lines.push(`SUMMARY:${escapeICS(ev.title)}`);
    if (ev.location) lines.push(`LOCATION:${escapeICS(ev.location)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeICS(ev.description)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

window.RosterICS = { buildICS };
