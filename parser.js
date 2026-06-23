function pad2(n) { return String(n).padStart(2, '0'); }

const MONTHS = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };
const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DOW_RE = '(MON|TUE|WED|THU|FRI|SAT|SUN)';
const ACTIVITY_RE = /^(A\/T|D\/L|GUA|GAB|MED|NPR|RAC|VAC|CRM|ESM|\*)$/;

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
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function timeToMinutes(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }
function minutesToTime(mins) { return `${pad2(Math.floor(mins/60))}:${pad2(mins%60)}`; }
function addDays(dateStr, days) { const d = new Date(`${dateStr}T00:00:00`); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function subtractOneHour(t) { return minutesToTime(Math.max(0, timeToMinutes(t)-60)); }
function fullDateTime(dateStr, timeStr, referenceMinutes=null) {
  if (timeStr === '24:00') return `${addDays(dateStr,1)}T00:00:00`;
  let date = dateStr;
  const mins = timeToMinutes(timeStr);
  if (referenceMinutes !== null && mins < referenceMinutes - 12*60) date = addDays(date, 1);
  return `${date}T${timeStr}:00`;
}
function minutesBetweenIso(a,b) { return Math.round((new Date(b)-new Date(a))/60000); }
function formatDuration(mins) { if (mins==null || Number.isNaN(mins)) return ''; const s=mins<0?'-':''; mins=Math.abs(mins); return `${s}${Math.floor(mins/60)}h${pad2(mins%60)}`; }
function classifyRest(mins) { if (mins==null || Number.isNaN(mins)) return 'unknown'; if (mins<600) return 'danger'; if (mins<720) return 'warning'; return 'ok'; }

function cleanCrew(s) { return (s||'').replace(/\s+/g,' ').replace(/\s*\([^)]*\)/g,'').trim(); }
function parseCrew(text) {
  const crew = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(/^(\d{2})([A-Z]{3})\.?([0-9]{2})\s+(AR\d+)\s+(.+)$/);
    if (!m) continue;
    const key = `${m[1]}${m[2]}${m[3]}-${m[4]}`;
    crew[key] = cleanCrew(m[5]);
  }
  return crew;
}
function getCrew(crewMap, dateKey, flight) { return crewMap[`${dateKey}-${flight}`] || ''; }
function classifyActivity(code) {
  const map = {
    '*': {title:'Día OFF', type:'off'}, 'D/L': {title:'Día Libre', type:'off'},
    'GUA': {title:'Guardia', type:'standby'}, 'A/T': {title:'Actividad en Tierra', type:'ground'},
    'GAB': {title:'INMAE', type:'medical'}, 'MED': {title:'Parte Médico', type:'medical'},
    'NPR': {title:'NPR', type:'ground'}, 'RAC': {title:'RAAC Parte 120', type:'ground'},
    'VAC': {title:'Vacaciones', type:'vacation'}, 'CRM': {title:'Curso CRM Mañana', type:'ground'},
    'ESM': {title:'ESSYS Mañana', type:'ground'}
  };
  return map[code] || {title:code, type:'other'};
}
function activityIcon(type) { return ({off:'🏠',standby:'🛡️',ground:'🎓',medical:'🩺',vacation:'🏖️',other:'📌'}[type] || '📌'); }
function compactFlights(legs) { return legs.map(l => l.flight.replace('AR','')).join('/'); }
function routeText(legs) { const p=[legs[0].orig]; for (const l of legs) p.push(l.dest); return p.join(' → '); }

const AIRPORT_ICAO = { AEP:'SABE',EZE:'SAEZ',EPA:'SADP',SFN:'SAAV',RSA:'SAZR',MDQ:'SAZM',MDZ:'SAME',NQN:'SAZN',CRD:'SAVC',COR:'SACO',SLA:'SASA',TUC:'SANT',JUJ:'SASJ',IGR:'SARI',BRC:'SAZS',FTE:'SAWC',USH:'SAWH',RGL:'SAWG',RGA:'SAWE',REL:'SAVT',VDM:'SAVV',BHI:'SAZB',ROS:'SAAR',PRA:'SAAP',FMA:'SARF',RES:'SARE',CNQ:'SARC',PSS:'SARP',IRJ:'SANL',CTC:'SANC',UAQ:'SANU',LUQ:'SAOU',AFA:'SAMR',CPC:'SAZY',EQS:'SAVE',PMY:'SAVY',GPO:'SAZG',RCU:'SAOC',VME:'SAOR',BUE:'SABE' };
function icaoFor(iata) { return AIRPORT_ICAO[String(iata||'').toUpperCase()] || ''; }
function metarTafUrl(icao) { return icao ? `https://metar-taf.com/${icao}` : ''; }
function wxBlock(orig,dest) { const o=icaoFor(orig), d=icaoFor(dest); const lines=['🌦 WX RÁPIDO','']; if(o) lines.push(`ORIGEN: ${o}`); if(d) lines.push(`DESTINO: ${d}`); lines.push(''); if(o) lines.push(metarTafUrl(o)); if(d) lines.push(metarTafUrl(d)); return lines.join('\n').trim(); }

function splitScheduleLines(text) {
  let scheduleText = text;
  for (const marker of ['Tripulación del vuelo','Day Notes','Activity Notes','Descripción']) {
    const idx = scheduleText.indexOf(marker);
    if (idx !== -1) scheduleText = scheduleText.slice(0, idx);
  }
  return scheduleText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
}
function tokenizeRosterLine(raw) {
  return raw.trim().replace(/\s+/g,' ').split(' ').filter(Boolean);
}
function parseMaybeDate(tokens) {
  if (!tokens.length) return null;
  const m = tokens[0].match(new RegExp(`^(\\d{2})${DOW_RE}$`));
  if (!m) return null;
  return { day:Number(m[1]), dow:m[2], rest:tokens.slice(1) };
}
function parseFlightTokens(tokens) {
  const opIndex = tokens.indexOf('OP');
  if (opIndex === -1) return null;
  const t = tokens.slice(opIndex);
  if (t[0] !== 'OP' || !/^AR\d{3,4}$/.test(t[1]||'')) return null;
  let i = 2;
  let ci = null;
  if (/^\d{2}:\d{2}$/.test(t[i]||'') && /^[A-Z]{3}$/.test(t[i+1]||'')) { ci = t[i]; i++; }
  const orig = t[i++];
  const std = t[i++];
  const dest = t[i++];
  const sta = t[i++];
  if (!/^[A-Z]{3}$/.test(orig||'') || !/^\d{2}:\d{2}$/.test(std||'') || !/^[A-Z]{3}$/.test(dest||'') || !/^\d{2}:\d{2}$/.test(sta||'')) return null;
  let co = null;
  if (/^\d{2}:\d{2}$/.test(t[i]||'')) { co = t[i]; i++; }
  let aircraft = 'E190';
  if (/^[A-Z]\d{2,3}$/.test(t[i]||'')) aircraft = t[i] === 'E90' ? 'E190' : t[i];
  return { flight:t[1], ci, orig, std, dest, sta, co, aircraft, raw:tokens.join(' ') };
}
function parseActivityTokens(tokens) {
  const idx = tokens.findIndex(x => ACTIVITY_RE.test(x));
  if (idx === -1) return null;
  const code = tokens[idx];
  const rest = tokens.slice(idx+1);
  const times = rest.filter(x => /^\d{2}:\d{2}$/.test(x));
  const airports = rest.filter(x => /^[A-Z]{3}$/.test(x));
  let start = times[0] || '00:00';
  let end = times[times.length-1] || '23:59';
  if ((code === '*' || code === 'D/L') && times.length) { start = times[0]; end = times[times.length-1]; }
  return { code, start, end, location: airports[0] || '', raw:tokens.join(' ') };
}

function parseRoster(text, filePath='') {
  const debug = [];
  const events = [];
  const baseYear = parseHeaderYear(text);
  let currentYear = baseYear;
  let currentMonth = monthFromHeader(text);
  if (currentMonth === null) currentMonth = new Date().getMonth();
  const crewMap = parseCrew(text);
  debug.push(`Año detectado: ${baseYear}`);
  debug.push(`Mes inicial detectado: ${currentMonth+1}`);
  debug.push(`Tripulaciones detectadas: ${Object.keys(crewMap).length}`);
  const lines = splitScheduleLines(text);

  let lastDaySeen = null, currentDay = null, currentDow = '', currentDateStr = '', currentDateKey = '';
  let currentDuty = null;

  function setCurrentDay(day, dow) {
    if (lastDaySeen !== null && day < lastDaySeen) { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } }
    lastDaySeen = day; currentDay = day; currentDow = dow;
    currentDateStr = dateFor(day, currentMonth, currentYear);
    currentDateKey = `${pad2(day)}${MONTH_NAMES[currentMonth]}${String(currentYear).slice(2)}`;
  }

  function flushDuty() {
    if (!currentDuty || !currentDuty.legs.length) { currentDuty = null; return; }
    const legs = currentDuty.legs;
    const first = legs[0], last = legs[legs.length-1];
    const dateStr = currentDuty.dateStr, dateKey = currentDuty.dateKey;
    const ci = currentDuty.checkIn || subtractOneHour(first.std);
    const co = currentDuty.checkOut || last.co || last.sta;
    const startMinutes = timeToMinutes(ci);
    const dutyId = `${dateStr}-duty-${compactFlights(legs)}-${first.orig}`;
    const dutyStart = fullDateTime(dateStr, ci);
    const dutyEnd = fullDateTime(dateStr, co, startMinutes);
    const dutyRoute = routeText(legs);
    const crewLines = legs.map(l => {
      const c = getCrew(crewMap, dateKey, l.flight);
      return c ? `${l.flight}: ${c}` : `${l.flight}: tripulación no informada`;
    });
    const dutyInfo = [
      `Duty: AR${compactFlights(legs)}`, `Ruta: ${dutyRoute}`, `Check-in / Report: ${ci}`, `Check-out: ${co}`, `Avión: ${first.aircraft || 'E190'}`,
      '', 'Tramos:', ...legs.map(l => `${l.flight}: ${l.orig} ${l.std} → ${l.dest} ${l.sta}`), '', 'Tripulación:', ...crewLines
    ];
    events.push({ id:`${dutyId}-report`, type:'report', dutyId, title:'🕐 REPORT', start:dutyStart, end:fullDateTime(dateStr, first.std), dutyStart, dutyEnd, location:first.orig, description:dutyInfo.join('\n') });
    for (const leg of legs) {
      const legCrew = getCrew(crewMap, dateKey, leg.flight);
      events.push({
        id:`${dutyId}-${leg.flight}-${leg.orig}-${leg.dest}-${leg.std.replace(':','')}`,
        type:'flight', dutyId, title:`✈️ ${leg.orig} - ${leg.dest} ${leg.flight} (${leg.std.replace(':','')}L)`,
        start:fullDateTime(dateStr, leg.std), end:fullDateTime(dateStr, leg.sta, timeToMinutes(leg.std)), dutyStart, dutyEnd,
        location:`${leg.orig}-${leg.dest}`,
        description:[legCrew ? `Tripulación: ${legCrew}` : 'Tripulación: no informada', '', wxBlock(leg.orig, leg.dest), '', '------------------------', '', `${leg.flight}`, `${leg.orig} → ${leg.dest}`, `STD: ${leg.std}`, `STA: ${leg.sta}`, `Avión: ${leg.aircraft || first.aircraft || 'E190'}`, '', ...dutyInfo].join('\n')
      });
    }
    currentDuty = null;
  }

  for (const raw of lines) {
    if (/^(Individual Roster|Página|BUE-CP|GIL |Date\s|Crew Web Portal|\d{2}[A-Z]{3}\.\d{2})/i.test(raw)) continue;
    let tokens = tokenizeRosterLine(raw);
    if (!tokens.length) continue;
    const dm = parseMaybeDate(tokens);
    if (dm) { flushDuty(); setCurrentDay(dm.day, dm.dow); tokens = dm.rest; }
    if (!currentDateStr || !tokens.length) continue;

    const leg = parseFlightTokens(tokens);
    if (leg) {
      if (!currentDuty) currentDuty = { dateStr:currentDateStr, dateKey:currentDateKey, checkIn:leg.ci || null, checkOut:leg.co || null, legs:[] };
      // Nueva fecha con vuelo ya hizo flush antes; si cambia por seguridad, flush y recomenzar.
      if (currentDuty.dateStr !== currentDateStr) { flushDuty(); currentDuty = { dateStr:currentDateStr, dateKey:currentDateKey, checkIn:leg.ci || null, checkOut:leg.co || null, legs:[] }; }
      currentDuty.legs.push(leg);
      if (leg.ci && !currentDuty.checkIn) currentDuty.checkIn = leg.ci;
      if (leg.co) currentDuty.checkOut = leg.co;
      continue;
    }

    const activity = parseActivityTokens(tokens);
    if (activity) {
      flushDuty();
      const cls = classifyActivity(activity.code);
      const startRef = timeToMinutes(activity.start === '24:00' ? '00:00' : activity.start);
      events.push({
        id:`${currentDateStr}-${activity.code.replace(/\W/g,'') || 'OFF'}-${activity.start}`,
        type:cls.type,
        title:`${activityIcon(cls.type)} ${cls.title}`,
        start:fullDateTime(currentDateStr, activity.start),
        end:fullDateTime(currentDateStr, activity.end, startRef),
        location:activity.location,
        description:`Actividad: ${cls.title}\nCódigo: ${activity.code}\nLínea original: ${activity.raw}`
      });
      continue;
    }
  }
  flushDuty();

  // Deduplicación fuerte por fecha/tipo/título/hora.
  const unique=[]; const seen=new Set();
  for (const ev of events) { const key=`${ev.type}|${ev.title}|${ev.start}|${ev.end}|${ev.location}`; if (!seen.has(key)) { seen.add(key); unique.push(ev); } }
  events.length=0; events.push(...unique);
  events.sort((a,b)=>a.start.localeCompare(b.start));

  // Descansos solo entre duties de vuelo.
  const dutyMap = new Map();
  for (const ev of events) {
    if (!ev.dutyId) continue;
    if (!dutyMap.has(ev.dutyId)) dutyMap.set(ev.dutyId, {start:ev.dutyStart||ev.start, end:ev.dutyEnd||ev.end, events:[]});
    const d = dutyMap.get(ev.dutyId); d.events.push(ev);
    if ((ev.dutyStart||ev.start).localeCompare(d.start) < 0) d.start = ev.dutyStart || ev.start;
    if ((ev.dutyEnd||ev.end).localeCompare(d.end) > 0) d.end = ev.dutyEnd || ev.end;
  }
  const duties = Array.from(dutyMap.values()).sort((a,b)=>a.start.localeCompare(b.start));
  for (let i=0;i<duties.length;i++) {
    const prev=duties[i-1]||null, curr=duties[i], next=duties[i+1]||null;
    const restPrev = prev ? formatDuration(minutesBetweenIso(prev.end, curr.start)) : '';
    const restNext = next ? formatDuration(minutesBetweenIso(curr.end, next.start)) : '';
    for (const ev of curr.events) {
      ev.restPrevious = restPrev; ev.restNext = restNext;
      const lines=[]; if (restPrev) lines.push(`Descanso previo: ${restPrev}`); if (restNext) lines.push(`Descanso posterior: ${restNext}`);
      if (lines.length) ev.description = `${lines.join('\n')}\n\n${ev.description || ''}`;
    }
  }

  debug.push('Parser: v8.0 fresh line-aware parser');
  debug.push(`Líneas leídas: ${lines.length}`);
  debug.push(`Eventos detectados: ${events.length}`);
  debug.push('Validación esperada PDF test: 23 A/T · 24 AR1824 duty único · 25 OFF · 28 GUA');
  return { events, debug };
}

window.RosterParser = { parseRoster, formatDuration };
