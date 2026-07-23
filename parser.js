function pad2(n) { return String(n).padStart(2, '0'); }

const MONTHS = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
};
const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DOW_RE = '(MON|TUE|WED|THU|FRI|SAT|SUN)';
function normalizeSpanishMonths(text) {
  return String(text||'')
    .replace(/ENE/g,'JAN')
    .replace(/ABR/g,'APR')
    .replace(/AGO/g,'AUG')
    .replace(/SET/g,'SEP')
    .replace(/DIC/g,'DEC');
}

const ACTIVITY_RE = /^(A\/T|D\/L|GUA|GAB|MED|NPR|RAC|VAC|CRM|ESM|REM|ELR|\*)(.*)$/;

function parseHeaderYear(text) {
  const m = text.match(/(\d{2})([A-Z]{3})(\d{2})\s*-\s*(\d{2})([A-Z]{3})(\d{2})/);
  if (m) return 2000 + Number(m[3]);
  const m2 = text.match(/\b(\d{2})([A-Z]{3})\.(\d{2})\b/);
  if (m2) return 2000 + Number(m2[3]);
  return new Date().getFullYear();
}

function monthFromHeader(text) {
  const m = text.match(/\b\d{2}([A-Z]{3})\d{2}\s*-/);
  return m ? MONTHS[m[1]] : null;
}

function dateFor(day, month, year) {
  const d = new Date(year, month, day);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}


function minutesBetweenIso(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return Math.round((db - da) / 60000);
}

function formatDuration(mins) {
  if (mins === null || mins === undefined || Number.isNaN(mins)) return '';
  const sign = mins < 0 ? '-' : '';
  mins = Math.abs(mins);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${sign}${h}h${pad2(m)}`;
}

function classifyRest(mins) {
  if (mins === null || mins === undefined || Number.isNaN(mins)) return 'unknown';
  if (mins < 10 * 60) return 'danger';
  if (mins < 12 * 60) return 'warning';
  return 'ok';
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function subtractOneHour(t) {
  const mins = timeToMinutes(t);
  return minutesToTime(Math.max(0, mins - 60));
}

function fullDateTime(dateStr, timeStr, referenceMinutes = null) {
  let date = dateStr;
  if (timeStr === '24:00') return `${addDays(date, 1)}T00:00:00`;
  const minutes = timeToMinutes(timeStr);
  if (referenceMinutes !== null && minutes < referenceMinutes - 12 * 60) {
    date = addDays(date, 1);
  }
  return `${date}T${timeStr}:00`;
}

function cleanCrew(s) {
  return (s || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
}

function parseCrew(text) {
  const crew = {};
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(\d{2})([A-Z]{3})\.?([0-9]{2})\s+(AR\d+)\s+(.+)$/);
    if (!m) continue;
    const key = `${m[1]}${m[2]}${m[3]}-${m[4]}`;
    crew[key] = cleanCrew(m[5]);
  }
  return crew;
}

function getCrew(crewMap, dateKey, flight) {
  return crewMap[`${dateKey}-${flight}`] || '';
}

function classifyActivity(code) {
  const map = {
    '*': { title: 'Día OFF', type: 'off' },
    'D/L': { title: 'Día Libre', type: 'off' },
    'GUA': { title: 'Guardia', type: 'standby' },
    'A/T': { title: 'Actividad en Tierra', type: 'ground' },
    'GAB': { title: 'INMAE', type: 'medical' },
    'MED': { title: 'Parte Médico', type: 'medical' },
    'NPR': { title: 'NPR', type: 'ground' },
    'RAC': { title: 'RAAC Parte 120', type: 'ground' },
    'VAC': { title: 'Vacaciones', type: 'vacation' },
    'CRM': { title: 'Curso CRM Mañana', type: 'ground' },
    'ESM': { title: 'ESSYS Mañana', type: 'ground' },
    'REM': { title: 'REM', type: 'ground' },
    'ELR': { title: 'ELR', type: 'ground' }
  };
  return map[code] || { title: code, type: 'other' };
}


function activityIcon(type) {
  const icons = {
    off: '🏠',
    standby: '🛡️',
    ground: '🎓',
    medical: '🩺',
    vacation: '🏖️',
    other: '📌'
  };
  return icons[type] || '📌';
}

function compactFlights(legs) {
  return legs.map(l => l.flight.replace('AR', '')).join('/');
}

function routeText(legs) {
  if (!legs.length) return '';
  const parts = [legs[0].orig];
  for (const leg of legs) parts.push(leg.dest);
  return parts.join(' → ');
}

function normalizeRosterText(text) {
  return text
    .replace(/\r/g, '')
    .replace(/OP\s+AR/g, 'OPAR')
    .replace(/OPAR/g, '\nOPAR')
    .replace(new RegExp(`(\\d{2})${DOW_RE}`, 'g'), '\n$1$2')
    .replace(/\n+/g, '\n');
}

function readToken(rest, re) {
  const m = rest.match(re);
  if (!m) return null;
  return { value: m[1], rest: rest.slice(m[0].length) };
}

function parseFlightLine(rawLine) {
  const line = rawLine.replace(/\s+/g, '');
  const m = line.match(/^OPAR(\d{4})(.+)$/);
  if (!m) return null;
  const flight = `AR${m[1]}`;
  let rest = m[2];

  let ci = null;
  let tk = readToken(rest, /^(\d{2}:\d{2})/);
  if (tk) { ci = tk.value; rest = tk.rest; }

  tk = readToken(rest, /^([A-Z]{3})/);
  if (!tk) return null;
  const orig = tk.value; rest = tk.rest;

  tk = readToken(rest, /^(\d{2}:\d{2})/);
  if (!tk) return null;
  const std = tk.value; rest = tk.rest;

  tk = readToken(rest, /^([A-Z]{3})/);
  if (!tk) return null;
  const dest = tk.value; rest = tk.rest;

  tk = readToken(rest, /^(\d{2}:\d{2})/);
  if (!tk) return null;
  const sta = tk.value; rest = tk.rest;

  let co = null;
  tk = readToken(rest, /^(\d{2}:\d{2})/);
  if (tk) { co = tk.value; rest = tk.rest; }

  let aircraft = 'E190';
  const ac = rest.match(/^([A-Z]\d{2,3})/);
  if (ac) aircraft = ac[1] === 'E90' ? 'E190' : ac[1];

  return { flight, ci, orig, std, dest, sta, co, aircraft, raw: rawLine };
}

function parseActivityLine(rawLine) {
  const line = rawLine.replace(/\s+/g, '');
  const m = line.match(ACTIVITY_RE);
  if (!m) return null;
  const code = m[1];
  const rest = m[2] || '';
  const times = rest.match(/\d{2}:\d{2}/g) || [];
  const airports = rest.match(/[A-Z]{3}/g) || [];
  let start = times[0] || '00:00';
  let end = times[times.length - 1] || '23:59';
  if ((code === '*' || code === 'D/L') && times.length >= 2) {
    start = times[0];
    end = times[times.length - 1];
  }
  return { code, start, end, location: airports[0] || '', raw: rawLine };
}


const AIRPORT_ICAO = {
  AEP: 'SABE',
  EZE: 'SAEZ',
  EPA: 'SADP',
  SFN: 'SAAV',
  RSA: 'SAZR',
  MDQ: 'SAZM',
  MDZ: 'SAME',
  NQN: 'SAZN',
  CRD: 'SAVC',
  COR: 'SACO',
  SLA: 'SASA',
  TUC: 'SANT',
  JUJ: 'SASJ',
  IGR: 'SARI',
  BRC: 'SAZS',
  FTE: 'SAWC',
  USH: 'SAWH',
  RGL: 'SAWG',
  RGA: 'SAWE',
  REL: 'SAVT',
  VDM: 'SAVV',
  BHI: 'SAZB',
  ROS: 'SAAR',
  PRA: 'SAAP',
  FMA: 'SARF',
  RES: 'SARE',
  CNQ: 'SARC',
  PSS: 'SARP',
  IRJ: 'SANL',
  CTC: 'SANC',
  UAQ: 'SANU',
  LUQ: 'SAOU',
  AFA: 'SAMR',
  CPC: 'SAZY',
  EQS: 'SAVE',
  PMY: 'SAVY',
  GPO: 'SAZG',
  RCU: 'SAOC',
  VME: 'SAOR',
  BUE: 'SABE'
};

function icaoFor(iata) {
  return AIRPORT_ICAO[String(iata || '').toUpperCase()] || '';
}

function metarTafUrl(icao) {
  return icao ? `https://metar-taf.com/${icao}` : '';
}

function wxBlock(orig, dest) {
  const o = icaoFor(orig);
  const d = icaoFor(dest);

  const lines = [
    '🌦 WX RÁPIDO',
    ''
  ];

  if (o) lines.push(`ORIGEN: ${o}`);
  if (d) lines.push(`DESTINO: ${d}`);

  lines.push('');

  if (o) lines.push(metarTafUrl(o));
  if (d) lines.push(metarTafUrl(d));

  return lines.join('\n').trim();
}

function parseRoster(text, filePath = '') {
  const debug = [];
  const events = [];
  const normalizedText = normalizeSpanishMonths(text);
  const baseYear = parseHeaderYear(normalizedText);
  let currentYear = baseYear;
  let currentMonth = monthFromHeader(normalizedText);
  if (currentMonth === null) currentMonth = new Date().getMonth();

  const crewMap = parseCrew(normalizedText);
  debug.push(`Año detectado: ${baseYear}`);
  debug.push(`Mes inicial detectado: ${currentMonth + 1}`);
  debug.push(`Tripulaciones detectadas: ${Object.keys(crewMap).length}`);

  // IMPORTANTE: el PDF trae al final tripulaciones y leyendas de códigos.
  // Si las parseamos como si fueran programación, aparecen eventos falsos
  // en el último día leído (por ejemplo 30 TUE con GUA/MED/GAB/etc.).
  // Por eso usamos el texto completo para tripulaciones, pero para eventos
  // cortamos antes de esa sección.
  const cutMarkers = ['Tripulación del vuelo', 'Day Notes', 'Activity Notes', 'Descripción'];
  let scheduleText = normalizedText;
  for (const marker of cutMarkers) {
    const idx = scheduleText.indexOf(marker);
    if (idx !== -1) scheduleText = scheduleText.slice(0, idx);
  }

  const normalized = normalizeRosterText(scheduleText);
  const lines = normalized.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let currentDay = null;
  let currentDow = '';
  let currentDateStr = '';
  let currentDateKey = '';
  let lastDaySeen = null;
  let current = null;

  function setCurrentDay(day, dow) {
    if (lastDaySeen !== null && day < lastDaySeen) {
      currentMonth += 1;
      if (currentMonth > 11) { currentMonth = 0; currentYear += 1; }
    }
    lastDaySeen = day;
    currentDay = day;
    currentDow = dow;
    currentDateStr = dateFor(day, currentMonth, currentYear);
    currentDateKey = `${pad2(day)}${MONTH_NAMES[currentMonth]}${String(currentYear).slice(2)}`;
  }

  function addMinutesIso(iso, mins) {
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() + mins);
    return d.toISOString().slice(0, 19);
  }

  function flightTitle(leg) {
    return `✈️ ${leg.flight} ${leg.orig}→${leg.dest} 🛫${leg.std} 🛬${leg.sta}`;
  }

  function flushDuty() {
    if (!current) return;
    if (current.kind === 'flight' && current.legs.length) {
      const first = current.legs[0];
      const last = current.legs[current.legs.length - 1];
      const dateStr = current.dateStr;
      const ci = current.checkIn || subtractOneHour(first.std);
      const co = current.checkOut || last.co || last.sta;
      const startMinutes = timeToMinutes(ci);
      const dutyId = `${dateStr}-duty-${compactFlights(current.legs)}`;
      const dutyRoute = routeText(current.legs);
      const dutyStart = fullDateTime(dateStr, ci);
      const dutyEnd = fullDateTime(dateStr, co, startMinutes);
      const crewLines = current.legs.map(l => {
        const c = getCrew(crewMap, current.dateKey, l.flight);
        return c ? `${l.flight}: ${c}` : `${l.flight}: tripulación no informada`;
      });

      const lastLanding = last.sta;
      const dutyInfo = [
        `Duty: AR${compactFlights(current.legs)}`,
        `Ruta: ${dutyRoute}`,
        `Report: ${ci}`,
        `Last landing: ${lastLanding}`,
        `Avión: ${first.aircraft || 'E190'}`,
        '',
        'Tramos:',
        ...current.legs.map(l => `${l.flight}: ${l.orig} ${l.std} → ${l.dest} ${l.sta}`),
        '',
        'Tripulación:',
        ...crewLines
      ];

      events.push({
        id: `${dutyId}-report`,
        type: 'report',
        dutyId,
        title: `🕘 REPORT ${ci}`,
        start: dutyStart,
        end: fullDateTime(dateStr, first.std),
        dutyStart,
        dutyEnd,
        location: first.orig,
        description: dutyInfo.join('\n')
      });

      for (const leg of current.legs) {
        const legStartMinutes = timeToMinutes(leg.std);
        events.push({
          id: `${dutyId}-${leg.flight}-${leg.orig}-${leg.dest}`,
          type: 'flight',
          dutyId,
          title: flightTitle(leg),
          start: fullDateTime(dateStr, leg.std),
          end: fullDateTime(dateStr, leg.sta, legStartMinutes),
          dutyStart,
          dutyEnd,
          location: `${leg.orig}-${leg.dest}`,
          description: [
            '🌦 WX RÁPIDO',
            '',
            wxBlock(leg.orig, leg.dest),
            '',
            '------------------------',
            '',
            `${leg.flight}`,
            `${leg.orig} → ${leg.dest}`,
            `STD: ${leg.std}`,
            `STA: ${leg.sta}`,
            `Avión: ${leg.aircraft || first.aircraft || 'E190'}`,
            '',
            ...dutyInfo
          ].join('\n')
        });
      }

      events.push({
        id: `${dutyId}-last-landing`,
        type: 'lastLanding',
        dutyId,
        title: `🛬 LAST LANDING ${last.sta}`,
        start: fullDateTime(dateStr, last.sta, timeToMinutes(last.std)),
        end: addMinutesIso(fullDateTime(dateStr, last.sta, timeToMinutes(last.std)), 30),
        dutyStart,
        dutyEnd,
        location: last.dest,
        description: dutyInfo.join('\n')
      });
    }
    current = null;
  }

  function processRosterLine(rawLine) {
    const compact = rawLine.replace(/\s+/g, '');

    const inlineDay = compact.match(new RegExp(`^(\\d{2})${DOW_RE}(.+)$`));
    let line = rawLine;
    if (inlineDay) {
      flushDuty();
      setCurrentDay(Number(inlineDay[1]), inlineDay[2]);
      line = inlineDay[3];
    }

    if (!currentDateStr) return;

    const leg = parseFlightLine(line);
    if (leg) {
      if (!current || current.kind !== 'flight') {
        current = {
          kind: 'flight',
          day: currentDay,
          dow: currentDow,
          dayLabel: `${pad2(currentDay)} ${currentDow}`,
          dateStr: currentDateStr,
          dateKey: currentDateKey,
          checkIn: leg.ci || null,
          checkOut: leg.co || null,
          legs: []
        };
      }
      current.legs.push({
        flight: leg.flight,
        orig: leg.orig,
        std: leg.std,
        dest: leg.dest,
        sta: leg.sta,
        co: leg.co,
        aircraft: leg.aircraft
      });
      if (leg.ci && !current.checkIn) current.checkIn = leg.ci;
      if (leg.co) current.checkOut = leg.co;
      return;
    }

    const activity = parseActivityLine(line);
    if (activity) {
      flushDuty();
      const cls = classifyActivity(activity.code);
      const startMinutes = timeToMinutes(activity.start === '24:00' ? '00:00' : activity.start);
      events.push({
        id: `${currentDateStr}-${activity.code.replace(/\W/g, '') || 'OFF'}`,
        type: cls.type,
        title: `${activityIcon(cls.type)} ${cls.title}`,
        start: fullDateTime(currentDateStr, activity.start),
        end: fullDateTime(currentDateStr, activity.end, startMinutes),
        location: activity.location,
        description: `Actividad: ${cls.title}\nCódigo: ${activity.code}\nLínea original: ${activity.raw}`
      });
      return;
    }
  }

  // v8.1: parser con línea diferida real.
  // PDF.js a veces extrae el primer contenido de una fila ANTES de su fecha:
  //   OP AR1824 ...
  //   24WED
  // En ese caso la línea pendiente se procesa recién al ver 24WED.
  // Si la fecha viene normal/inline (24WED OP AR1824...), se procesa directo.
  let pendingLine = null;
  function flushPendingWithCurrentDate() {
    if (!pendingLine) return;
    processRosterLine(pendingLine);
    pendingLine = null;
  }

  for (const rawLine of lines) {
    const compact = rawLine.replace(/\s+/g, '');

    const dayMatch = compact.match(new RegExp(`^(\\d{2})${DOW_RE}$`));
    if (dayMatch) {
      // Si justo antes vino una línea de vuelo/actividad sin fecha, esa línea pertenece
      // a esta fecha. Esto corrige el corrimiento de vuelos, A/T, OFF y guardias.
      flushDuty();
      setCurrentDay(Number(dayMatch[1]), dayMatch[2]);
      flushPendingWithCurrentDate();
      continue;
    }

    const inlineDay = compact.match(new RegExp(`^(\\d{2})${DOW_RE}(.+)$`));
    if (inlineDay) {
      flushPendingWithCurrentDate();
      processRosterLine(rawLine);
      continue;
    }

    // Antes de procesar una línea sin fecha esperamos a ver si la próxima línea
    // es una fecha pura. Si no lo es, la línea pendiente queda con la fecha actual.
    if (pendingLine) flushPendingWithCurrentDate();
    pendingLine = rawLine;
  }

  flushPendingWithCurrentDate();

  flushDuty();

  // Quitar duplicados exactos por seguridad.
  const unique = [];
  const seen = new Set();
  for (const ev of events) {
    const key = `${ev.id}|${ev.start}|${ev.end}|${ev.title}`;
    if (!seen.has(key)) { seen.add(key); unique.push(ev); }
  }
  events.length = 0;
  events.push(...unique);

  events.sort((a, b) => a.start.localeCompare(b.start));

  // Descanso entre duties: C/O del duty anterior a C/I del próximo duty.
  // La vista v5.2 separa REPORT / tramos / DEBRIEF, pero el descanso se calcula por duty completo.
  const dutyMap = new Map();
  for (const ev of events) {
    if (!ev.dutyId) continue;
    if (!dutyMap.has(ev.dutyId)) {
      dutyMap.set(ev.dutyId, { dutyId: ev.dutyId, start: ev.dutyStart || ev.start, end: ev.dutyEnd || ev.end, events: [] });
    }
    const d = dutyMap.get(ev.dutyId);
    d.events.push(ev);
    if ((ev.dutyStart || ev.start).localeCompare(d.start) < 0) d.start = ev.dutyStart || ev.start;
    if ((ev.dutyEnd || ev.end).localeCompare(d.end) > 0) d.end = ev.dutyEnd || ev.end;
  }

  const duties = Array.from(dutyMap.values()).sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < duties.length; i++) {
    const prev = duties[i - 1] || null;
    const curr = duties[i];
    const next = duties[i + 1] || null;
    let restPrevious = '';
    let restNext = '';
    let restPreviousStatus = 'ok';
    let restNextStatus = 'ok';

    if (prev) {
      const mins = minutesBetweenIso(prev.end, curr.start);
      restPrevious = formatDuration(mins);
      restPreviousStatus = classifyRest(mins);
    }
    if (next) {
      const mins = minutesBetweenIso(curr.end, next.start);
      restNext = formatDuration(mins);
      restNextStatus = classifyRest(mins);
    }

    for (const ev of curr.events) {
      ev.restPrevious = restPrevious;
      ev.restNext = restNext;
      ev.restPreviousStatus = restPreviousStatus;
      ev.restNextStatus = restNextStatus;
      const restLines = [];
      if (restPrevious) restLines.push(`Descanso previo: ${restPrevious}`);
      if (restNext) restLines.push(`Descanso posterior: ${restNext}`);
      if (restLines.length) ev.description = `${restLines.join('\n')}\n\n${ev.description || ''}`;
    }
  }

  debug.push('Parser: v8.1 v6.6 base + delayed-line safe');
  debug.push(`Líneas normalizadas: ${lines.length}`);
  debug.push(`Eventos detectados: ${events.length}`);
  if (events.length === 0) debug.push('No se detectaron eventos. Revisar el texto crudo en la vista Debug.');
  return { events, debug };
}

window.RosterParser = { parseRoster, formatDuration };
