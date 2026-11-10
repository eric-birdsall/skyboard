// Weather condition icons (inline SVG) + WMO weather-code helpers.

const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
  return `<line x1="${(c * 16).toFixed(1)}" y1="${(s * 16).toFixed(1)}" x2="${(c * 21).toFixed(1)}" y2="${(s * 21).toFixed(1)}"/>`;
}).join('');

const sun = (x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><g class="wi-rays">${RAYS}</g><circle r="11" class="wi-sun"/></g>`;
const moon = (x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path class="wi-moon" d="M5 -12A13 13 0 1 0 12 5A10 10 0 0 1 5 -12Z"/></g>`;
const orb = (day, x, y, s) => (day ? sun(x, y, s) : moon(x, y, s * 1.15));

const CLOUD = 'M20 46a10 10 0 0 1 0-20a14 14 0 0 1 26.5-3a11.5 11.5 0 1 1-.5 23z';
const cloud = (t = '', dark = false) =>
  `<path class="${dark ? 'wi-cloud2' : 'wi-cloud'}" transform="${t}" d="${CLOUD}"/>`;

const drops = (xs, y1 = 45, len = 9) =>
  xs.map((x, k) =>
    `<line class="wi-drop" style="animation-delay:${(k * 0.27).toFixed(2)}s" x1="${x}" y1="${y1}" x2="${x - 3}" y2="${y1 + len}"/>`
  ).join('');
const flakes = (pts) =>
  pts.map(([x, y], k) =>
    `<circle class="wi-flake" style="animation-delay:${(k * 0.4).toFixed(1)}s" cx="${x}" cy="${y}" r="2.6"/>`
  ).join('');
const BOLT = '<path class="wi-bolt" d="M34 34 23 51h8l-4 12 14-18h-8l5-11z"/>';
const FOG = '<g class="wi-fogl"><line x1="12" y1="45" x2="46" y2="45"/><line x1="18" y1="52" x2="52" y2="52"/><line x1="14" y1="59" x2="40" y2="59"/></g>';

const BUILD = {
  clear: (d) => orb(d, 32, 32, 1.05),
  mostly: (d) => orb(d, 25, 24, 0.85) + cloud('translate(14 14) scale(.72)'),
  partly: (d) => orb(d, 22, 22, 0.8) + cloud('translate(4 6)'),
  overcast: () => cloud('translate(12 -4) scale(.8)', true) + cloud('translate(-2 8)'),
  fog: () => cloud('translate(0 -9)') + FOG,
  drizzle: () => cloud('translate(0 -9)') + drops([24, 34, 44], 45, 4) + drops([29, 39], 53, 4),
  rain: () => cloud('translate(0 -9)') + drops([24, 34, 44]),
  heavy: () => cloud('translate(0 -9)', true) + drops([20, 28, 36, 44], 44, 12),
  showers: (d) => orb(d, 20, 18, 0.7) + cloud('translate(4 -3)') + drops([26, 36, 46], 49, 8),
  snow: () => cloud('translate(0 -9)') + flakes([[22, 46], [34, 49], [46, 46], [28, 57], [40, 58]]),
  sleet: () => cloud('translate(0 -9)') + drops([24, 40], 45, 9) + flakes([[32, 50], [46, 55], [22, 58]]),
  thunder: () => cloud('translate(0 -10)', true) + BOLT + drops([20, 48], 44, 8),
};

// WMO weather interpretation codes → [label, icon type]
const WMO = {
  0: ['Clear', 'clear'], 1: ['Mostly clear', 'mostly'], 2: ['Partly cloudy', 'partly'], 3: ['Overcast', 'overcast'],
  45: ['Fog', 'fog'], 48: ['Freezing fog', 'fog'],
  51: ['Light drizzle', 'drizzle'], 53: ['Drizzle', 'drizzle'], 55: ['Heavy drizzle', 'drizzle'],
  56: ['Freezing drizzle', 'sleet'], 57: ['Freezing drizzle', 'sleet'],
  61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'heavy'],
  66: ['Freezing rain', 'sleet'], 67: ['Freezing rain', 'sleet'],
  71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'snow'],
  80: ['Light showers', 'showers'], 81: ['Showers', 'showers'], 82: ['Violent showers', 'heavy'],
  85: ['Snow showers', 'snow'], 86: ['Heavy snow showers', 'snow'],
  95: ['Thunderstorm', 'thunder'], 96: ['Thunderstorm, hail', 'thunder'], 99: ['Severe thunderstorm', 'thunder'],
};

export function wmo(code, isDay = 1) {
  const e = WMO[code] || ['Cloudy', 'overcast'];
  let label = e[0];
  if (isDay && code === 0) label = 'Sunny';
  if (isDay && code === 1) label = 'Mostly sunny';
  return { label, type: e[1] };
}

export function icon(code, isDay = 1, cls = '') {
  const { type, label } = wmo(code, isDay);
  return `<svg class="wi ${cls}" viewBox="0 0 64 64" role="img" aria-label="${label}">${BUILD[type](!!isDay)}</svg>`;
}

export function skyOf(code) {
  const t = wmo(code).type;
  if (t === 'clear' || t === 'mostly') return 'clear';
  if (t === 'partly' || t === 'overcast') return 'cloudy';
  if (t === 'fog') return 'fog';
  if (t === 'snow' || t === 'sleet') return 'snow';
  if (t === 'thunder') return 'storm';
  return 'rain';
}

export const isSnowy = (code) => ['snow', 'sleet'].includes(wmo(code).type);
