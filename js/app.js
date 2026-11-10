import { icon, wmo, skyOf, isSnowy } from './icons.js';

/* ───────────────────────── Config ───────────────────────── */
const STATE_KEY = 'skyboard:state';
const CACHE_KEY = 'skyboard:cache';
const FRESH_MS = 10 * 60 * 1000;   // reuse cached data for 10 min
const REFRESH_MS = 15 * 60 * 1000; // auto refresh every 15 min

const API = {
  forecast: 'https://api.open-meteo.com/v1/forecast',
  air: 'https://air-quality-api.open-meteo.com/v1/air-quality',
  geocode: 'https://geocoding-api.open-meteo.com/v1/search',
  reverse: 'https://api.bigdatacloud.net/data/reverse-geocode-client',
};

const DEFAULT_LOCATION = { id: '5128581', name: 'New York', admin: 'New York', country: 'United States', cc: 'US', lat: 40.71427, lon: -74.00597 };

const L = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const UI = {
  resize: L('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
  close: L('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: L('<path d="M12 5v14M5 12h14"/>'),
  trash: L('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  sun: L('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: L('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  auto: L('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'),
};

const TILES = {
  current:    { title: 'Now',              sizes: ['m', 'l', 's'], icon: UI.sun },
  hourly:     { title: 'Hourly forecast',  sizes: ['w', 'm'],      icon: L('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') },
  daily:      { title: '10-day forecast',  sizes: ['l', 'm', 'w'], icon: L('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>') },
  precip:     { title: 'Precipitation',    sizes: ['m', 'w'],      icon: L('<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12v7a2 2 0 0 0 4 0"/>') },
  wind:       { title: 'Wind',             sizes: ['s', 'm'],      icon: L('<path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>') },
  uv:         { title: 'UV index',         sizes: ['s', 'm'],      icon: L('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>') },
  sun:        { title: 'Sunrise & sunset', sizes: ['m', 's'],      icon: L('<path d="M17 18a5 5 0 0 0-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4"/>') },
  aqi:        { title: 'Air quality',      sizes: ['s', 'm'],      icon: L('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/>') },
  humidity:   { title: 'Humidity',         sizes: ['s', 'm'],      icon: L('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>') },
  feels:      { title: 'Feels like',       sizes: ['s', 'm'],      icon: L('<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/>') },
  pressure:   { title: 'Pressure',         sizes: ['s', 'm'],      icon: L('<path d="M3.3 15a9 9 0 1 1 17.4 0"/><path d="m12 13 4-5"/><circle cx="12" cy="13" r="1.5"/>') },
  visibility: { title: 'Visibility',       sizes: ['s', 'm'],      icon: L('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>') },
  places:     { title: 'Saved places',     sizes: ['m', 'l', 's'], icon: L('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>') },
};

const DEFAULT_LAYOUT = [
  ['current', 'm'], ['wind', 's'], ['uv', 's'],
  ['hourly', 'w'],
  ['daily', 'l'], ['precip', 'm'], ['aqi', 's'], ['humidity', 's'],
  ['sun', 'm'], ['feels', 's'], ['pressure', 's'],
  ['places', 'm'], ['visibility', 's'],
].map(([id, size]) => ({ id, size }));

/* ───────────────────────── Helpers ───────────────────────── */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const imperial = () => state.units === 'imperial';
const T = (v) => (v == null || Number.isNaN(v) ? '--' : `${Math.round(v)}°`);
const spdU = () => (imperial() ? 'mph' : 'km/h');
const hourLabel = (t) => { const h = +t.slice(11, 13); return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`; };
const timeLabel = (t) => { const h = +t.slice(11, 13); return `${h % 12 || 12}:${t.slice(14, 16)} ${h < 12 ? 'AM' : 'PM'}`; };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = (t, i) => (i === 0 ? 'Today' : DAYS[new Date(`${t.slice(0, 10)}T12:00:00Z`).getUTCDay()]);
const minutesOf = (t) => +t.slice(11, 13) * 60 + +t.slice(14, 16);
const localNow = (offsetSec) => new Date(Date.now() + offsetSec * 1000); // read with getUTC*
const localClock = (offsetSec) => {
  const d = localNow(offsetSec), h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const compass = (d) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(d / 22.5) % 16];
const dur = (m) => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60); return h ? `${h}h ${m % 60}m` : `${m % 60}m`; };
const flag = (cc) => (cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : '📍');
const subtitle = (l) => [l.admin, l.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
const nowIdx = (w) => { const k = w.current.time.slice(0, 13); const i = w.hourly.time.findIndex((t) => t.startsWith(k)); return i < 0 ? 0 : i; };

async function getJSON(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ───────────────────────── State ───────────────────────── */
const firstVisit = !localStorage.getItem(STATE_KEY);
const state = loadState();
let D = null;            // { loc, w, aq } for the active location
let places = {};         // id → { temp, code, isDay, hi, lo, offset }
let lastUpdated = 0;
let loadToken = 0;

function loadState() {
  const def = {
    v: 1,
    locations: [DEFAULT_LOCATION],
    activeId: DEFAULT_LOCATION.id,
    units: 'imperial', // °F, mph, inches by default; users can switch to °C
    theme: 'auto',
    layout: DEFAULT_LAYOUT.map((t) => ({ ...t })),
  };
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY));
    if (!s || s.v !== 1) return def;
    const seen = new Set();
    const layout = (Array.isArray(s.layout) ? s.layout : def.layout)
      .filter((t) => t && TILES[t.id] && !seen.has(t.id) && seen.add(t.id))
      .map((t) => ({ id: t.id, size: TILES[t.id].sizes.includes(t.size) ? t.size : TILES[t.id].sizes[0] }));
    const locations = (Array.isArray(s.locations) ? s.locations : [])
      .filter((l) => l && l.id != null && Number.isFinite(l.lat) && Number.isFinite(l.lon))
      .map((l) => ({ ...l, id: String(l.id) }));
    const out = {
      ...def,
      units: s.units === 'metric' || s.units === 'imperial' ? s.units : def.units,
      theme: ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto',
      layout,
      locations: locations.length ? locations : def.locations,
      activeId: String(s.activeId),
    };
    if (!out.locations.some((l) => l.id === out.activeId)) out.activeId = out.locations[0].id;
    return out;
  } catch {
    return def;
  }
}
function save() { try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ } }
const activeLoc = () => state.locations.find((l) => l.id === state.activeId) || state.locations[0];

function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; } }
function writeCache(id, entry) {
  const c = readCache();
  c[id] = entry;
  for (const k of Object.keys(c)) if (!state.locations.some((l) => l.id === k)) delete c[k];
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ [id]: entry })); } catch { /* ignore */ } }
}

/* ───────────────────────── Data ───────────────────────── */
function unitParams(p) {
  if (imperial()) { p.set('temperature_unit', 'fahrenheit'); p.set('wind_speed_unit', 'mph'); p.set('precipitation_unit', 'inch'); }
  return p;
}
function forecastURL(loc) {
  const p = new URLSearchParams({
    latitude: loc.lat, longitude: loc.lon, timezone: 'auto', forecast_days: '10',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,is_day,uv_index,visibility,pressure_msl,dew_point_2m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum,daylight_duration,wind_speed_10m_max',
  });
  return `${API.forecast}?${unitParams(p)}`;
}
const airURL = (loc) => `${API.air}?${new URLSearchParams({ latitude: loc.lat, longitude: loc.lon, timezone: 'auto', current: 'us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide' })}`;

async function load(force = false) {
  const loc = activeLoc();
  const token = ++loadToken;
  const cached = readCache()[loc.id];
  if (cached && cached.units === state.units && cached.w) {
    D = { loc, w: cached.w, aq: cached.aq };
    lastUpdated = cached.t;
  } else {
    D = null;
  }
  renderAll();
  if (D && !force && Date.now() - lastUpdated < FRESH_MS) { loadPlaces(); return; }

  document.body.classList.add('busy');
  try {
    const [w, aq] = await Promise.all([getJSON(forecastURL(loc)), getJSON(airURL(loc)).catch(() => null)]);
    if (token !== loadToken) return;
    D = { loc, w, aq };
    lastUpdated = Date.now();
    writeCache(loc.id, { t: lastUpdated, units: state.units, w, aq });
    renderAll();
  } catch (e) {
    if (token === loadToken) {
      toast(navigator.onLine === false ? 'You appear to be offline.' : 'Couldn’t load the forecast. Try again shortly.');
      if (!D) renderAll();
    }
  } finally {
    if (token === loadToken) document.body.classList.remove('busy');
  }
  loadPlaces();
}

async function loadPlaces() {
  const locs = state.locations.slice();
  if (!locs.length) return;
  const p = unitParams(new URLSearchParams({
    latitude: locs.map((l) => l.lat).join(','), longitude: locs.map((l) => l.lon).join(','),
    current: 'temperature_2m,weather_code,is_day', daily: 'temperature_2m_max,temperature_2m_min', forecast_days: '1', timezone: 'auto',
  }));
  try {
    let r = await getJSON(`${API.forecast}?${p}`);
    if (!Array.isArray(r)) r = [r];
    const next = {};
    r.forEach((x, i) => {
      if (!locs[i] || !x.current) return;
      next[locs[i].id] = {
        temp: x.current.temperature_2m, code: x.current.weather_code, isDay: x.current.is_day,
        hi: x.daily?.temperature_2m_max?.[0], lo: x.daily?.temperature_2m_min?.[0], offset: x.utc_offset_seconds || 0,
      };
    });
    places = next;
    renderChips();
    renderBody('places');
    renderSaved();
  } catch { /* non-critical */ }
}

/* ───────────────────────── Tile renderers ───────────────────────── */
const R = {};

function summaryText(w) {
  const h = w.hourly, i = nowIdx(w), d = w.daily;
  const { label } = wmo(w.current.weather_code, w.current.is_day);
  let s = `${label} right now. `;
  let k = -1;
  for (let j = i; j < Math.min(i + 24, h.time.length); j++) if ((h.precipitation_probability[j] ?? 0) >= 50) { k = j; break; }
  if (k === i) s += `${isSnowy(h.weather_code[k]) ? 'Snow' : 'Rain'} is likely to continue. `;
  else if (k > i) s += `${isSnowy(h.weather_code[k]) ? 'Snow' : 'Rain'} likely around ${hourLabel(h.time[k])}. `;
  else s += 'No precipitation expected in the next 24 hours. ';
  s += `High of ${T(d.temperature_2m_max[0])}, low of ${T(d.temperature_2m_min[0])}, with winds up to ${Math.round(d.wind_speed_10m_max[0])} ${spdU()}.`;
  return s;
}

R.current = ({ w }, size) => {
  const c = w.current, d = w.daily, h = w.hourly, i = nowIdx(w);
  const { label } = wmo(c.weather_code, c.is_day);
  const extra = size === 'l' ? `
    <p class="cur-summary">${esc(summaryText(w))}</p>
    <div class="cur-stats">
      <div><small>Humidity</small><b>${Math.round(c.relative_humidity_2m)}%</b></div>
      <div><small>Wind</small><b>${Math.round(c.wind_speed_10m)} ${spdU()}</b></div>
      <div><small>UV index</small><b>${Math.round(h.uv_index[i] ?? 0)}</b></div>
      <div><small>Rain chance</small><b>${d.precipitation_probability_max[0] ?? 0}%</b></div>
    </div>` : '';
  return `<div class="cur">
    <div class="cur-top"><div class="cur-temp">${T(c.temperature_2m)}</div><div class="cur-icon">${icon(c.weather_code, c.is_day, 'wi-anim')}</div></div>
    <div class="cur-cond">${label}</div>
    <div class="cur-meta">H ${T(d.temperature_2m_max[0])} · L ${T(d.temperature_2m_min[0])}${size === 's' ? '' : ` · Feels like ${T(c.apparent_temperature)}`}</div>
    ${extra}
  </div>`;
};

function smoothPath(pts) {
  const f = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  let d = `M${f(pts[0])}`;
  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = pts[k - 1] || pts[k], p1 = pts[k], p2 = pts[k + 1], p3 = pts[k + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1)} ${f(c2)} ${f(p2)}`;
  }
  return d;
}

R.hourly = ({ w }) => {
  const h = w.hourly, i = nowIdx(w), n = Math.min(25, h.time.length - i), COL = 62, W = n * COL, H = 58;
  const idx = Array.from({ length: n }, (_, k) => i + k);
  const temps = idx.map((j) => (j === i ? w.current.temperature_2m : h.temperature_2m[j]));
  const mn = Math.min(...temps), mx = Math.max(...temps);
  const pts = temps.map((t, k) => [k * COL + COL / 2, 22 + (mx === mn ? 0.5 : (mx - t) / (mx - mn)) * 28]);
  const line = smoothPath(pts);
  const cols = `grid-template-columns:repeat(${n},${COL}px)`;
  const dayMarks = idx.map((j, k) => (k > 0 && h.time[j].slice(11, 13) === '00'
    ? `<span class="hr-day" style="left:${k * COL}px"><i>${dayLabel(h.time[j], 1)}</i></span>` : '')).join('');
  return `<div class="hscroll"><div class="hr" style="width:${W}px">
    ${dayMarks}
    <div class="hr-row" style="${cols}">${idx.map((j, k) => `<span class="${k ? '' : 'now'}">${k ? hourLabel(h.time[j]) : 'Now'}</span>`).join('')}</div>
    <div class="hr-row hr-icons" style="${cols}">${idx.map((j) => `<span>${icon(h.weather_code[j], h.is_day[j])}</span>`).join('')}</div>
    <svg class="hr-curve" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <defs><linearGradient id="hr-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.22"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
      <path d="${line} L${pts[n - 1][0]},${H} L${pts[0][0]},${H} Z" fill="url(#hr-fill)"/>
      <path class="ln" d="${line}"/>
      ${pts.map((p, k) => `<circle cx="${p[0]}" cy="${p[1].toFixed(1)}" r="${k ? 2.6 : 4}"/><text x="${p[0]}" y="${(p[1] - 9).toFixed(1)}">${T(temps[k])}</text>`).join('')}
    </svg>
    <div class="hr-row hr-pop" style="${cols}">${idx.map((j) => { const v = h.precipitation_probability[j] ?? 0; return `<span>${v >= 10 ? `${v}%` : ''}</span>`; }).join('')}</div>
  </div></div>`;
};

R.daily = ({ w }, size) => {
  const d = w.daily, n = d.time.length;
  const lows = d.temperature_2m_min, highs = d.temperature_2m_max;
  if (size === 'w') {
    return `<div class="days-row">${d.time.map((t, k) => `<div>
      <span>${dayLabel(t, k)}</span>${icon(d.weather_code[k], 1)}
      <span class="day-p">${(d.precipitation_probability_max[k] ?? 0) >= 20 ? `${d.precipitation_probability_max[k]}%` : ''}</span>
      <b>${T(highs[k])}</b><small>${T(lows[k])}</small></div>`).join('')}</div>`;
  }
  const mn = Math.min(...lows), mx = Math.max(...highs), span = mx - mn || 1;
  return `<ul class="days">${d.time.slice(0, n).map((t, k) => {
    const lo = lows[k], hi = highs[k];
    const left = ((lo - mn) / span) * 100, wid = Math.max(((hi - lo) / span) * 100, 4);
    const pos = wid >= 100 ? 0 : (left * 100) / (100 - wid);
    const pop = d.precipitation_probability_max[k] ?? 0;
    const dot = k === 0 ? `<i class="dot" style="left:${clamp(((w.current.temperature_2m - mn) / span) * 100, 0, 100)}%"></i>` : '';
    return `<li class="day">
      <span class="day-n">${dayLabel(t, k)}</span>
      <span class="day-i">${icon(d.weather_code[k], 1)}</span>
      <span class="day-p">${pop >= 20 ? `${pop}%` : ''}</span>
      <span class="day-lo">${T(lo)}</span>
      <span class="track"><span class="bar" style="left:${left.toFixed(1)}%;width:${wid.toFixed(1)}%;background-size:${(10000 / wid).toFixed(1)}% 100%;background-position:${pos.toFixed(1)}% 0"></span>${dot}</span>
      <span class="day-hi">${T(hi)}</span>
    </li>`;
  }).join('')}</ul>`;
};

R.precip = ({ w }, size) => {
  const h = w.hourly, i = nowIdx(w), n = Math.min(size === 'w' ? 48 : 24, h.time.length - i);
  const idx = Array.from({ length: n }, (_, k) => i + k);
  const probs = idx.map((j) => h.precipitation_probability[j] ?? 0);
  const total = idx.reduce((a, j) => a + (h.precipitation[j] || 0), 0);
  const k = probs.findIndex((p) => p >= 50);
  const max = Math.max(...probs);
  const kind = (j) => (isSnowy(h.weather_code[j]) ? 'Snow' : 'Rain');
  let msg;
  if (k === 0) msg = `${kind(i)} likely now`;
  else if (k > 0) msg = `${kind(i + k)} likely around ${hourLabel(h.time[i + k])}`;
  else if (max >= 20) msg = `Slight chance of precipitation (${max}%)`;
  else msg = `No precipitation expected in the next ${n} hours`;
  const amt = total > 0 ? `${total.toFixed(imperial() ? 2 : 1)} ${imperial() ? 'in' : 'mm'} expected over the next ${n}h` : 'Dry conditions ahead';
  const step = n / 4;
  const labels = [0, 1, 2, 3].map((q) => (q === 0 ? 'Now' : hourLabel(h.time[i + Math.round(q * step)]))).concat(hourLabel(h.time[i + n - 1]));
  return `<div class="p-sum">${msg}</div>
    <div class="note" style="margin-top:2px">${amt}</div>
    <div class="pbars" role="img" aria-label="Chance of precipitation by hour">${probs.map((p, q) => `<span class="${p >= 50 ? 'hi' : ''}" style="height:${Math.max(p, 3)}%" title="${hourLabel(h.time[i + q])}: ${p}%"></span>`).join('')}</div>
    <div class="pax">${labels.map((l) => `<span>${l}</span>`).join('')}</div>`;
};

function beaufort(v) {
  const kmh = imperial() ? v * 1.609 : v;
  const s = [[1, 'Calm'], [6, 'Light air'], [12, 'Light breeze'], [20, 'Gentle breeze'], [29, 'Moderate breeze'], [39, 'Fresh breeze'], [50, 'Strong breeze'], [62, 'Near gale'], [75, 'Gale'], [89, 'Strong gale'], [103, 'Storm']];
  return (s.find(([m]) => kmh < m) || [0, 'Hurricane force'])[1];
}

R.wind = ({ w }, size) => {
  const c = w.current, dir = c.wind_direction_10m ?? 0;
  const ticks = Array.from({ length: 12 }, (_, k) => { const a = (k * 30 * Math.PI) / 180; return `<line class="tick" x1="${50 + Math.sin(a) * 37}" y1="${50 - Math.cos(a) * 37}" x2="${50 + Math.sin(a) * 41}" y2="${50 - Math.cos(a) * 41}"/>`; }).join('');
  const svg = `<svg class="compass" viewBox="0 0 100 100" role="img" aria-label="Wind from ${compass(dir)}">
    <circle class="ring" cx="50" cy="50" r="44"/>${ticks}
    <text x="50" y="6">N</text><text x="94" y="50">E</text><text x="50" y="94">S</text><text x="6" y="50">W</text>
    <g class="arrow" style="transform:rotate(${dir + 180}deg);transform-origin:50px 50px"><path d="M50 12 56 24H44z"/><rect x="48.6" y="22" width="2.8" height="12" rx="1.4"/><rect x="48.6" y="66" width="2.8" height="16" rx="1.4"/></g>
    <text class="spd" x="50" y="47">${Math.round(c.wind_speed_10m)}</text><text class="spu" x="50" y="62">${spdU()}</text>
  </svg>`;
  if (size === 's') return `<div class="centered">${svg}<div class="note">${compass(dir)} · Gusts ${Math.round(c.wind_gusts_10m)}</div></div>`;
  return `<div class="split">${svg}<div class="kv">
    <div><span>Speed</span><b>${Math.round(c.wind_speed_10m)} ${spdU()}</b></div>
    <div><span>Gusts</span><b>${Math.round(c.wind_gusts_10m)} ${spdU()}</b></div>
    <div><span>Direction</span><b>${Math.round(dir)}° ${compass(dir)}</b></div>
    <div><span>Conditions</span><b>${beaufort(c.wind_speed_10m)}</b></div>
  </div></div>`;
};

function gauge(frac, id, stops, value, unit = '') {
  const a = Math.PI * (1 - clamp(frac, 0, 1)), r = 46, cx = 60, cy = 58;
  const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
  return `<svg class="gauge" viewBox="0 0 120 66" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" x2="1">${stops.map((c, k) => `<stop offset="${k / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>
    <path class="g-track" d="M14 58A46 46 0 0 1 106 58" stroke="url(#${id})"/>
    <circle class="g-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5"/>
    <text x="60" y="${unit ? 50 : 60}">${value}</text>${unit ? `<text class="u" x="60" y="63">${unit}</text>` : ''}
  </svg>`;
}

R.uv = ({ w }, size) => {
  const i = nowIdx(w), v = w.hourly.uv_index[i] ?? 0, max = w.daily.uv_index_max[0] ?? 0;
  const cat = v < 3 ? 'Low' : v < 6 ? 'Moderate' : v < 8 ? 'High' : v < 11 ? 'Very high' : 'Extreme';
  const advice = v < 3 ? 'No protection needed.' : v < 6 ? 'Wear sunscreen if outside for long.' : v < 8 ? 'Sunscreen, hat and shade advised.' : 'Avoid the midday sun.';
  const g = gauge(v / 11, 'g-uv', ['#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7'], Math.round(v));
  if (size === 's') return `<div class="centered">${g}<div class="lbl">${cat}</div><div class="note">Peak ${Math.round(max)} today</div></div>`;
  return `<div class="split"><div style="width:140px;flex:none">${g}</div><div><div class="lbl">${cat}</div><p class="note">${advice}</p><p class="note">Peak UV ${Math.round(max)} today.</p></div></div>`;
};

R.aqi = ({ aq }, size) => {
  const a = aq?.current;
  if (!a || a.us_aqi == null) return '<div class="empty-msg">Air quality data isn’t available for this location.</div>';
  const v = a.us_aqi;
  const cat = v <= 50 ? 'Good' : v <= 100 ? 'Moderate' : v <= 150 ? 'Unhealthy for sensitive groups' : v <= 200 ? 'Unhealthy' : v <= 300 ? 'Very unhealthy' : 'Hazardous';
  const g = gauge(v / 300, 'g-aqi', ['#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#7f1d1d'], Math.round(v), 'US AQI');
  if (size === 's') return `<div class="centered">${g}<div class="lbl" style="font-size:14px">${cat}</div></div>`;
  const f = (x) => (x == null ? '--' : Math.round(x));
  return `<div class="split"><div style="width:140px;flex:none" class="centered">${g}<div class="lbl" style="font-size:13.5px">${cat}</div></div><div class="kv">
    <div><span>PM2.5</span><b>${f(a.pm2_5)} µg/m³</b></div>
    <div><span>PM10</span><b>${f(a.pm10)} µg/m³</b></div>
    <div><span>Ozone</span><b>${f(a.ozone)} µg/m³</b></div>
    <div><span>NO₂</span><b>${f(a.nitrogen_dioxide)} µg/m³</b></div>
  </div></div>`;
};

R.humidity = ({ w }, size) => {
  const c = w.current, dew = w.hourly.dew_point_2m[nowIdx(w)];
  const dc = imperial() ? ((dew - 32) * 5) / 9 : dew;
  const feel = dc < 10 ? 'Dry and crisp' : dc < 16 ? 'Comfortable' : dc < 21 ? 'A bit humid' : 'Muggy';
  const rh = Math.round(c.relative_humidity_2m);
  return `<div class="stack">
    <div class="big">${rh}<small>%</small></div>
    <div class="lbl" style="font-size:14px">${feel}</div>
    <div class="meter"><i style="width:${rh}%"></i></div>
    <p class="note">Dew point is ${T(dew)} right now.${size === 'm' ? ` Cloud cover ${Math.round(c.cloud_cover)}%.` : ''}</p>
  </div>`;
};

R.feels = ({ w }) => {
  const c = w.current, a = c.apparent_temperature, t = c.temperature_2m, diff = a - t;
  const thr = imperial() ? 3 : 2;
  let why;
  if (Math.abs(diff) < thr) why = 'Similar to the actual temperature.';
  else if (diff < 0) why = c.wind_speed_10m > (imperial() ? 8 : 13) ? 'Wind is making it feel colder.' : 'Feels cooler than the actual temperature.';
  else why = c.relative_humidity_2m >= 60 ? 'Humidity is making it feel warmer.' : 'Sunshine and calm air make it feel warmer.';
  return `<div class="stack">
    <div class="big">${T(a)}</div>
    <div class="note" style="margin-top:2px">Actual ${T(t)}</div>
    <p class="note">${why}</p>
  </div>`;
};

R.pressure = ({ w }, size) => {
  const h = w.hourly, i = nowIdx(w), p = w.current.pressure_msl;
  const later = h.pressure_msl[Math.min(i + 3, h.time.length - 1)];
  const delta = later - p;
  const trend = delta > 1 ? 'Rising' : delta < -1 ? 'Falling' : 'Steady';
  const arrow = delta > 1 ? '↑' : delta < -1 ? '↓' : '→';
  const val = imperial() ? (p * 0.02953).toFixed(2) : Math.round(p);
  const unit = imperial() ? 'inHg' : 'hPa';
  const g = gauge((p - 970) / 80, 'g-pr', ['#60a5fa', '#818cf8', '#c084fc'], val, unit);
  const tip = trend === 'Falling' ? 'Falling pressure can signal unsettled weather.' : trend === 'Rising' ? 'Rising pressure usually means improving weather.' : 'No major change expected soon.';
  if (size === 's') return `<div class="centered">${g}<div class="lbl" style="font-size:14px">${arrow} ${trend}</div></div>`;
  return `<div class="split"><div style="width:140px;flex:none">${g}</div><div><div class="lbl">${arrow} ${trend}</div><p class="note">${tip}</p></div></div>`;
};

R.visibility = ({ w }) => {
  let m = w.hourly.visibility[nowIdx(w)];
  if (m == null) return '<div class="empty-msg">No visibility data.</div>';
  if ((w.hourly_units?.visibility || '').includes('ft')) m *= 0.3048;
  const km = m / 1000;
  const v = imperial() ? km * 0.621371 : km;
  const shown = v >= 10 ? Math.round(v) : v.toFixed(1);
  const desc = km >= 10 ? 'Perfectly clear view.' : km >= 5 ? 'Good visibility.' : km >= 2 ? 'Moderate — some haze.' : km >= 1 ? 'Poor visibility.' : 'Very poor — fog likely.';
  return `<div class="stack"><div class="big">${shown}<small>${imperial() ? 'mi' : 'km'}</small></div><p class="note">${desc}</p></div>`;
};

R.sun = ({ w }, size) => {
  const d = w.daily, now = localNow(w.utc_offset_seconds), nm = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (!d.sunrise[0] || !d.sunset[0]) return '<div class="empty-msg">No sunrise/sunset today.</div>';
  const sr = minutesOf(d.sunrise[0]), ss = minutesOf(d.sunset[0]);
  const isDayNow = nm >= sr && nm <= ss;
  const f = clamp((nm - sr) / (ss - sr || 1), 0, 1);
  let next;
  if (nm < sr) next = `Sunrise in ${dur(sr - nm)}`;
  else if (nm <= ss) next = `Sunset in ${dur(ss - nm)}`;
  else next = d.sunrise[1] ? `Sunrise in ${dur(24 * 60 - nm + minutesOf(d.sunrise[1]))}` : 'Night';
  const dl = d.daylight_duration[0] || 0;
  const daylight = `${Math.floor(dl / 3600)}h ${Math.round((dl % 3600) / 60)}m of daylight`;
  if (size === 's') {
    return `<div class="stack"><div class="big" style="font-size:26px">${timeLabel(isDayNow ? d.sunset[0] : nm < sr ? d.sunrise[0] : (d.sunrise[1] || d.sunrise[0]))}</div>
      <div class="lbl" style="font-size:14px">${isDayNow ? 'Sunset' : 'Sunrise'}</div><p class="note">${next}</p></div>`;
  }
  const th = Math.PI * (1 - f), x = 100 + 84 * Math.cos(th), y = 78 - 62 * Math.sin(th);
  const ox = isDayNow ? x : nm < sr ? 16 : 184, oy = isDayNow ? y : 78;
  return `<svg class="sun-svg" viewBox="0 0 200 92" aria-hidden="true">
      <line class="hz" x1="4" y1="78" x2="196" y2="78"/>
      <path class="arc" d="M16 78A84 62 0 0 1 184 78"/>
      <path class="arc-on" d="M16 78A84 62 0 0 1 184 78" pathLength="100" stroke-dasharray="${(f * 100).toFixed(1)} 100"/>
      <circle class="orb ${isDayNow ? '' : 'night'}" cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="7"/>
    </svg>
    <div class="sun-row"><div>Sunrise<b>${timeLabel(d.sunrise[0])}</b></div><div style="text-align:center">${next}<b>${daylight}</b></div><div>Sunset<b>${timeLabel(d.sunset[0])}</b></div></div>`;
};

R.places = () => {
  const rows = state.locations.map((l) => {
    const p = places[l.id];
    const sub = p ? `${localClock(p.offset)} · H ${T(p.hi)} L ${T(p.lo)}` : subtitle(l);
    return `<li><button class="place ${l.id === state.activeId ? 'active' : ''}" data-place="${esc(l.id)}">
      <span><b>${esc(l.name)}</b><small>${esc(sub)}</small></span>
      <span>${p ? icon(p.code, p.isDay) : ''}</span>
      <span class="pt">${p ? T(p.temp) : '--'}</span>
    </button></li>`;
  }).join('');
  return `<ul class="places">${rows}<li><button class="place add" data-act="addplace">+ Add a place</button></li></ul>`;
};
R.places.noData = true; // can render before forecast arrives

/* ───────────────────────── Rendering ───────────────────────── */
const grid = $('#grid');
const SKELETON = '<div class="skel"><span></span><span></span><span></span></div>';

function makeTile(id) {
  const def = TILES[id];
  const el = document.createElement('section');
  el.dataset.id = id;
  el.setAttribute('aria-label', def.title);
  el.innerHTML = `<header class="tile-head">
      <h2 class="tile-title">${def.icon}<span>${def.title}</span></h2>
      <div class="tile-actions">
        <button class="t-btn" data-act="size" title="Resize" aria-label="Resize ${def.title}">${UI.resize}</button>
        <button class="t-btn" data-act="remove" title="Remove" aria-label="Remove ${def.title}">${UI.close}</button>
      </div>
    </header><div class="tile-body"></div>`;
  return el;
}

function syncGrid() {
  const existing = new Map([...grid.children].map((el) => [el.dataset.id, el]));
  for (const t of state.layout) {
    const el = existing.get(t.id) || makeTile(t.id);
    el.className = `tile s-${t.size}`;
    const resizeBtn = el.querySelector('[data-act="size"]');
    resizeBtn.hidden = TILES[t.id].sizes.length < 2;
    grid.appendChild(el);
    existing.delete(t.id);
  }
  existing.forEach((el) => el.remove());
}

function renderBody(id) {
  const t = state.layout.find((x) => x.id === id);
  const body = grid.querySelector(`[data-id="${id}"] .tile-body`);
  if (!t || !body) return;
  const keepScroll = body.querySelector('.hscroll, .days, .places');
  const scroll = keepScroll ? [keepScroll.scrollLeft, keepScroll.scrollTop] : null;
  if (!D && !R[id].noData) { body.innerHTML = SKELETON; return; }
  try {
    body.innerHTML = R[id](D || {}, t.size);
  } catch (e) {
    console.error(`Tile "${id}" failed to render`, e);
    body.innerHTML = '<div class="empty-msg">Data unavailable.</div>';
  }
  if (scroll) { const el = body.querySelector('.hscroll, .days, .places'); if (el) [el.scrollLeft, el.scrollTop] = scroll; }
}

function renderHeader() {
  const loc = activeLoc();
  $('#locName').textContent = loc.name;
  const clock = D?.w ? ` · ${localClock(D.w.utc_offset_seconds)}` : '';
  $('#locSub').textContent = `${subtitle(loc)}${clock}`;
  $('#unitBtn').textContent = imperial() ? '°F' : '°C';
  $('#unitBtn').title = `Switch to ${imperial() ? 'Celsius' : 'Fahrenheit'}`;
  const th = { auto: ['auto', 'Theme: automatic'], light: ['sun', 'Theme: light'], dark: ['moon', 'Theme: dark'] }[state.theme];
  $('#themeBtn').innerHTML = UI[th[0]];
  $('#themeBtn').title = th[1];
  $('#themeBtn').setAttribute('aria-label', th[1]);
  document.title = D?.w ? `${T(D.w.current.temperature_2m)} ${loc.name} · Skyboard` : 'Skyboard';
}

function renderChips() {
  $('#chips').innerHTML = state.locations.map((l) => {
    const p = places[l.id];
    return `<button class="chip ${l.id === state.activeId ? 'active' : ''}" data-place="${esc(l.id)}" title="${esc(subtitle(l))}">
      ${p ? icon(p.code, p.isDay) : '<span style="width:6px"></span>'}<span>${esc(l.name)}</span>${p ? `<b>${T(p.temp)}</b>` : ''}</button>`;
  }).join('') + `<button class="chip add" data-act="addplace" aria-label="Add a place">${UI.plus}<span>Add</span></button>`;
}

function applySky() {
  const root = document.documentElement;
  if (D?.w) {
    root.dataset.sky = skyOf(D.w.current.weather_code);
    root.dataset.night = D.w.current.is_day ? '0' : '1';
  }
}

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'auto') delete root.dataset.theme; else root.dataset.theme = state.theme;
  const dark = state.theme === 'dark' || (state.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name="theme-color"]').setAttribute('content', dark ? '#080c17' : '#eef2f8');
}

function renderUpdated() {
  const el = $('#updated');
  if (!lastUpdated) { el.textContent = ''; return; }
  const m = Math.round((Date.now() - lastUpdated) / 60000);
  el.textContent = `Updated ${m < 1 ? 'just now' : m === 1 ? '1 minute ago' : m < 60 ? `${m} minutes ago` : `${Math.round(m / 60)}h ago`}`;
}

function renderAll() {
  applySky();
  renderHeader();
  renderChips();
  syncGrid();
  state.layout.forEach((t) => renderBody(t.id));
  renderUpdated();
}

/* ───────────────────────── Interactions ───────────────────────── */
function setActive(id) {
  if (!state.locations.some((l) => l.id === id)) return;
  state.activeId = id;
  save();
  load();
}

function removeTile(id) {
  const at = state.layout.findIndex((t) => t.id === id);
  if (at < 0) return;
  const [removed] = state.layout.splice(at, 1);
  save();
  syncGrid();
  renderToggles();
  toast(`Removed “${TILES[id].title}”`, {
    label: 'Undo',
    fn: () => { if (!state.layout.some((t) => t.id === id)) { state.layout.splice(at, 0, removed); save(); syncGrid(); renderBody(id); renderToggles(); } },
  });
}

function cycleSize(id) {
  const t = state.layout.find((x) => x.id === id);
  const sizes = TILES[id].sizes;
  t.size = sizes[(sizes.indexOf(t.size) + 1) % sizes.length];
  save();
  syncGrid();
  renderBody(id);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act],[data-place]');
  if (!b) return;
  if (b.dataset.place) { setActive(b.dataset.place); return; }
  const id = b.closest('.tile')?.dataset.id;
  if (b.dataset.act === 'size') cycleSize(id);
  else if (b.dataset.act === 'remove') removeTile(id);
  else if (b.dataset.act === 'addplace') openLocations();
});

// Drag-to-reorder tiles (SortableJS, loaded from CDN)
if (window.Sortable) {
  window.Sortable.create(grid, {
    animation: 220,
    easing: 'cubic-bezier(.2,.9,.3,1)',
    handle: '.tile-head',
    filter: '.t-btn',
    preventOnFilter: false,
    delay: 160,
    delayOnTouchOnly: true,
    ghostClass: 'tile-ghost',
    chosenClass: 'tile-chosen',
    dragClass: 'tile-drag',
    onEnd() {
      const order = [...grid.children].map((el) => el.dataset.id);
      state.layout.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      save();
    },
  });
}

// Mouse drag-to-scroll for horizontal strips
grid.addEventListener('pointerdown', (e) => {
  const sc = e.target.closest('.hscroll, .days-row');
  if (!sc || e.pointerType !== 'mouse' || e.button !== 0) return;
  const x0 = e.clientX, s0 = sc.scrollLeft;
  const move = (ev) => { sc.scrollLeft = s0 - (ev.clientX - x0); if (Math.abs(ev.clientX - x0) > 3) sc.classList.add('dragging'); };
  const up = () => { sc.classList.remove('dragging'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
});

$('#refreshBtn').addEventListener('click', () => load(true));
$('#unitBtn').addEventListener('click', () => {
  state.units = imperial() ? 'metric' : 'imperial';
  save();
  places = {};
  load(true);
});
$('#themeBtn').addEventListener('click', () => {
  state.theme = { auto: 'light', light: 'dark', dark: 'auto' }[state.theme];
  save();
  applyTheme();
  renderHeader();
  toast(`Theme: ${state.theme === 'auto' ? 'matches your system' : state.theme}`);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

/* Sheets */
const locDialog = $('#locDialog');
const tileDialog = $('#tileDialog');
for (const dlg of [locDialog, tileDialog]) {
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
  });
}

function openLocations() {
  renderSaved();
  $('#results').innerHTML = '';
  $('#searchInput').value = '';
  locDialog.showModal();
  if (matchMedia('(hover: hover)').matches) $('#searchInput').focus();
}
$('#locBtn').addEventListener('click', openLocations);

function renderSaved() {
  const one = state.locations.length <= 1;
  $('#savedList').innerHTML = state.locations.map((l) => {
    const p = places[l.id];
    return `<li class="${l.id === state.activeId ? 'active' : ''}">
      <button class="sel" data-sel="${esc(l.id)}">${p ? icon(p.code, p.isDay) : `<span class="flag" style="font-size:22px;width:32px;text-align:center">${flag(l.cc)}</span>`}
        <span><b>${esc(l.name)}${l.geo ? ' <small style="display:inline">· current</small>' : ''}</b><small>${esc(subtitle(l))}</small></span>
        <span class="t">${p ? T(p.temp) : ''}</span></button>
      <button class="rm" data-rm="${esc(l.id)}" ${one ? 'disabled' : ''} aria-label="Remove ${esc(l.name)}" title="Remove">${UI.trash}</button>
    </li>`;
  }).join('');
}

$('#savedList').addEventListener('click', (e) => {
  const sel = e.target.closest('[data-sel]');
  const rm = e.target.closest('[data-rm]');
  if (sel) { locDialog.close(); setActive(sel.dataset.sel); }
  if (rm && state.locations.length > 1) {
    const id = rm.dataset.rm;
    state.locations = state.locations.filter((l) => l.id !== id);
    delete places[id];
    const wasActive = state.activeId === id;
    if (wasActive) state.activeId = state.locations[0].id;
    save();
    renderSaved();
    renderChips();
    renderBody('places');
    if (wasActive) load();
  }
});

function addLocation(loc) {
  const dup = state.locations.find((l) => l.id === loc.id || (Math.abs(l.lat - loc.lat) < 0.01 && Math.abs(l.lon - loc.lon) < 0.01));
  if (dup) Object.assign(dup, loc, { id: dup.id });
  else state.locations.push(loc);
  state.activeId = dup ? dup.id : loc.id;
  save();
  locDialog.close();
  load();
}

let searchTimer = 0, searchCtl = null, lastResults = [];
const searchInput = $('#searchInput');
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) { $('#results').innerHTML = ''; lastResults = []; return; }
  searchTimer = setTimeout(() => search(q), 250);
});
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && lastResults[0]) { e.preventDefault(); pickResult(0); }
});
async function search(q) {
  searchCtl?.abort();
  searchCtl = new AbortController();
  try {
    const r = await getJSON(`${API.geocode}?${new URLSearchParams({ name: q, count: '8', language: 'en', format: 'json' })}`, { signal: searchCtl.signal });
    lastResults = r.results || [];
    $('#results').innerHTML = lastResults.length
      ? lastResults.map((x, k) => `<li><button data-res="${k}" class="${k === 0 ? 'kb' : ''}"><span class="flag">${flag(x.country_code)}</span><span><b>${esc(x.name)}</b><small>${esc([x.admin1, x.country].filter(Boolean).join(', '))}</small></span></button></li>`).join('')
      : '<li class="empty">No places found.</li>';
  } catch (e) {
    if (e.name !== 'AbortError') $('#results').innerHTML = '<li class="empty">Search failed — check your connection.</li>';
  }
}
function pickResult(k) {
  const x = lastResults[k];
  if (!x) return;
  addLocation({ id: String(x.id), name: x.name, admin: x.admin1 || '', country: x.country || '', cc: x.country_code || '', lat: x.latitude, lon: x.longitude });
}
$('#results').addEventListener('click', (e) => { const b = e.target.closest('[data-res]'); if (b) pickResult(+b.dataset.res); });

$('#geoBtn').addEventListener('click', () => {
  const btn = $('#geoBtn'), label = btn.querySelector('span');
  if (!navigator.geolocation) { toast('Location isn’t supported by this browser.'); return; }
  btn.disabled = true;
  label.textContent = 'Locating…';
  const done = () => { btn.disabled = false; label.textContent = 'Use my current location'; };
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = +pos.coords.latitude.toFixed(4), lon = +pos.coords.longitude.toFixed(4);
    const loc = { id: 'geo', name: 'My location', admin: '', country: '', cc: '', lat, lon, geo: true };
    try {
      const r = await getJSON(`${API.reverse}?${new URLSearchParams({ latitude: lat, longitude: lon, localityLanguage: 'en' })}`);
      loc.name = r.city || r.locality || loc.name;
      loc.admin = r.principalSubdivision || '';
      loc.country = r.countryName || '';
      loc.cc = r.countryCode || '';
    } catch { /* keep generic name */ }
    // Replace any previous "current location" entry
    const prev = state.locations.find((l) => l.id === 'geo');
    if (prev) Object.assign(prev, loc);
    done();
    addLocation(loc);
  }, (err) => {
    done();
    toast(err.code === 1 ? 'Location permission was denied.' : 'Couldn’t get your location.');
  }, { timeout: 12000, maximumAge: 10 * 60 * 1000 });
});

/* Customize */
function renderToggles() {
  const on = new Set(state.layout.map((t) => t.id));
  $('#tileToggles').innerHTML = Object.entries(TILES).map(([id, d]) => `<li><label>${d.icon}<span>${d.title}</span>
    <input type="checkbox" data-tile="${id}" ${on.has(id) ? 'checked' : ''}><span class="switch" aria-hidden="true"></span></label></li>`).join('');
}
$('#customizeBtn').addEventListener('click', () => { renderToggles(); tileDialog.showModal(); });
$('#tileToggles').addEventListener('change', (e) => {
  const id = e.target.dataset.tile;
  if (!id) return;
  if (e.target.checked) {
    if (!state.layout.some((t) => t.id === id)) state.layout.push({ id, size: TILES[id].sizes[0] });
  } else {
    state.layout = state.layout.filter((t) => t.id !== id);
  }
  save();
  syncGrid();
  renderBody(id);
});
$('#resetLayout').addEventListener('click', () => {
  state.layout = DEFAULT_LAYOUT.map((t) => ({ ...t }));
  save();
  grid.innerHTML = '';
  renderAll();
  renderToggles();
  toast('Layout reset');
});

/* Edit mode (shows tile controls on touch devices) */
function setEditing(on) {
  document.body.classList.toggle('editing', on);
}
$('#editLayout').addEventListener('click', () => { tileDialog.close(); setEditing(true); });
$('#doneEditing').addEventListener('click', () => setEditing(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('editing') && !document.querySelector('dialog[open]')) setEditing(false); });

/* Toast */
let toastTimer = 0;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { action.fn(); t.classList.remove('show'); };
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), action ? 6000 : 3000);
}

/* Refresh cadence */
setInterval(() => {
  renderUpdated();
  if (D?.w) renderHeader();
  if (document.visibilityState === 'visible' && Date.now() - lastUpdated > REFRESH_MS) load(true);
}, 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && lastUpdated && Date.now() - lastUpdated > FRESH_MS) load(true);
});

/* ───────────────────────── Boot ───────────────────────── */
applyTheme();
load();
if (firstVisit) setTimeout(() => toast('Tip: drag tiles by their header to rearrange them'), 1200);
