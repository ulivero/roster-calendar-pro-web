let parsedEvents = [];
let parsedDebug = [];
let parsedText = '';
let icsText = '';

const $ = id => document.getElementById(id);

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items || [];

    // Keep PDF extraction roughly line-aware by grouping Y positions.
    const rows = new Map();
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: item.transform[4], str: item.str });
    }

    const text = Array.from(rows.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([y, arr]) => arr.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' '))
      .join('\n');

    pages.push(text);
  }

  return pages.join('\n');
}

function findTotals(text) {
  const tv = text.match(/\bTV\s*[:=]?\s*(\d{1,3}:\d{2})/i);
  const tsv = text.match(/\bTSV\s*[:=]?\s*(\d{1,3}:\d{2})/i);
  return {
    tv: tv ? tv[1] : '',
    tsv: tsv ? tsv[1] : ''
  };
}

function renderSummary(events, totals) {
  const flights = events.filter(e => e.type === 'flight').length;
  const guard = events.filter(e => /Guardia|🛡️/i.test(e.title || '')).length;
  const off = events.filter(e => /OFF|Libre|🏠/i.test(e.title || '')).length;
  const vac = events.filter(e => /Vacaciones|🏖️/i.test(e.title || '')).length;
  const ground = events.filter(e => /Curso|ESSYS|Actividad|NPR|RAAC|🎓/i.test(e.title || '')).length;
  $('summary').textContent =
    `✈️ Vuelos: ${flights} · 🛡️ Guardias: ${guard} · 🏠 OFF: ${off} · 🏖️ VAC: ${vac} · 🎓 Tierra: ${ground} · ⏱️ TV: ${totals.tv || '-'} · ⏱️ TSV: ${totals.tsv || '-'}`;
}

function renderEvents(events) {
  const box = $('events');
  box.innerHTML = '';
  for (const ev of events) {
    const div = document.createElement('div');
    div.className = 'event';
    const desc = (ev.description || '').split('\n').slice(0, 16).join('\n');
    div.innerHTML = `
      <h3>${escapeHtml(ev.title || '')}</h3>
      <div class="meta">${escapeHtml(fmtDate(ev.start))} → ${escapeHtml(fmtDate(ev.end))}
${escapeHtml(ev.location || '')}</div>
      <details>
        <summary>Descripción</summary>
        <div class="desc">${escapeHtml(desc)}</div>
      </details>
    `;
    box.appendChild(div);
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[c]));
}

$('processBtn').addEventListener('click', async () => {
  const file = $('pdfFile').files[0];
  if (!file) {
    alert('Elegí un PDF primero.');
    return;
  }

  $('status').textContent = 'Leyendo PDF...';
  $('downloadBtn').disabled = true;
  $('addAppleBtn').disabled = true;
  $('addAndroidBtn').disabled = true;
  $('debugBtn').disabled = true;

  try {
    parsedText = await extractPdfText(file);
    const parsed = window.RosterParser.parseRoster(parsedText, file.name);
    parsedEvents = parsed.events || [];
    parsedDebug = parsed.debug || [];
    const totals = findTotals(parsedText);

    icsText = window.RosterICS.buildICS(parsedEvents);

    renderSummary(parsedEvents, totals);
    renderEvents(parsedEvents);
    $('status').textContent = `PDF leído: ${parsedText.length} caracteres · Eventos: ${parsedEvents.length}`;
    $('downloadBtn').disabled = parsedEvents.length === 0;
    $('addAppleBtn').disabled = parsedEvents.length === 0;
    $('addAndroidBtn').disabled = parsedEvents.length === 0;
    $('debugBtn').disabled = false;
  } catch (err) {
    console.error(err);
    $('status').textContent = 'Error: ' + (err.message || err);
    $('debugText').textContent = String(err.stack || err);
    $('debug').classList.remove('hidden');
  }
});

$('downloadBtn').addEventListener('click', () => {
  if (!icsText) return;
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'roster-calendar-pro.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
});


function openICSForCalendar(filename = 'roster-calendar-pro.ics') {
  if (!icsText) return;
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
  const file = new File([blob], filename, { type: 'text/calendar' });

  // Best path on modern iPhone/Android: native share sheet.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({
      title: 'Roster Calendar Pro',
      text: 'Agregar roster al calendario',
      files: [file]
    }).catch(() => {
      const url = URL.createObjectURL(blob);
      window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
    return;
  }

  // Fallback: open/download the ICS.
  const url = URL.createObjectURL(blob);
  window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

$('addAppleBtn').addEventListener('click', () => {
  openICSForCalendar('roster-apple-calendar.ics');
});

$('addAndroidBtn').addEventListener('click', () => {
  alert('Android desactivado por ahora. Primero dejamos Apple 100% estable.');
});


$('debugBtn').addEventListener('click', () => {
  $('debug').classList.toggle('hidden');
  $('debugText').textContent = [
    'DEBUG:',
    ...parsedDebug,
    '',
    'TEXTO PDF:',
    parsedText.slice(0, 8000)
  ].join('\n');
});
