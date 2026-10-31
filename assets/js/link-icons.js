/* Local, dependency-free social icon detection and rendering for Linkora. */
const icon = (body, viewBox = '0 0 24 24') =>
  `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

const ICONS = {
  instagram: {
    color: '#E1306C',
    svg: icon('<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2.1"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.1"/><circle cx="17.7" cy="6.5" r="1.25" fill="currentColor"/>')
  },
  facebook: {
    color: '#1877F2',
    svg: icon('<path fill="currentColor" d="M13.65 21v-8.2h2.76l.41-3.2h-3.17V7.56c0-.93.26-1.56 1.59-1.56h1.7V3.14C16.11 3.05 15.27 3 14.28 3c-2.45 0-4.13 1.5-4.13 4.26V9.6H7.38v3.2h2.77V21h3.5Z"/>')
  },
  whatsapp: {
    color: '#25D366',
    svg: icon('<path d="M20.2 11.7a8.2 8.2 0 0 1-12.1 7.2L3.5 20l1.1-4.4a8.2 8.2 0 1 1 15.6-3.9Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.4 7.8c.2-.5.5-.5.8-.5h.6c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.7l-.6.7c-.2.2-.2.4 0 .7.5.9 1.2 1.6 2.1 2.1.3.2.5.2.7-.1l.8-.9c.2-.2.4-.3.7-.2l1.7.8c.3.1.4.3.4.6 0 .5-.2 1.2-.7 1.6-.5.5-1.2.7-2 .6-1.1-.2-2.6-.9-4.1-2.3-1.3-1.2-2.1-2.7-2.3-3.8-.2-.9.1-1.7.7-2.2Z" fill="currentColor"/>')
  },
  linkedin: {
    color: '#0A66C2',
    svg: icon('<path fill="currentColor" d="M5.2 8.4a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3.5 10h3.4v10.5H3.5V10Zm5.5 0h3.3v1.4h.1c.5-.9 1.6-1.8 3.3-1.8 3.5 0 4.2 2.2 4.2 5v5.9h-3.4v-5.2c0-1.2 0-2.8-1.8-2.8s-2.1 1.3-2.1 2.7v5.3H9V10Z"/>')
  },
  youtube: {
    color: '#FF0033',
    svg: icon('<path fill="currentColor" d="M23 7.1a3 3 0 0 0-2.1-2.2C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7.1 31 31 0 0 0 .5 12c0 1.7.2 3.3.5 4.9a3 3 0 0 0 2.1 2.2c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.2c.3-1.6.5-3.2.5-4.9s-.2-3.3-.5-4.9ZM9.6 15.9V8.1l6.5 3.9-6.5 3.9Z"/>')
  },
  tiktok: {
    color: '#111111',
    svg: icon('<path fill="currentColor" d="M19.6 7.1a6.2 6.2 0 0 1-3.8-1.3v8.1a6.1 6.1 0 1 1-5.3-6.1v3.3a2.8 2.8 0 1 0 2 2.7V2.5h3.3c.2 2 1.7 3.7 3.8 4v.6Z"/>')
  },
  telegram: {
    color: '#26A5E4',
    svg: icon('<path fill="currentColor" d="m21.7 4.2-3.2 15.1c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.2-8.3c.4-.4-.1-.6-.6-.2L6 12.9 1.1 11.4c-1.1-.3-1.1-1 .2-1.5L20.4 2.6c.9-.3 1.7.2 1.3 1.6Z"/>')
  },
  github: {
    color: '#8B949E',
    svg: icon('<path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.5 21.6c.6.1.8-.2.8-.6v-2.1c-3.2.7-3.9-1.3-3.9-1.3-.5-1.3-1.3-1.6-1.3-1.6-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.1v3.1c0 .4.2.7.8.6A11.1 11.1 0 0 0 12 .9Z"/>')
  },
  x: {
    color: '#111111',
    svg: icon('<path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.7 5.6 22H2.4l7.3-8.4L1.8 2h6.5l4.5 6.7L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z"/>')
  },
  snapchat: {
    color: '#F5E642',
    svg: icon('<path fill="currentColor" d="M12 2.2c-2.5 0-4.2 1.8-4.2 4.5 0 .8.1 1.8-.1 2.3-.2.4-.7.2-1.1-.1-.5-.3-1.1-.6-1.5-.4-.5.2-.5.9 0 1.2.4.3 1.2.4 1.5 1 .2.4.1.8-.2 1.2-.6.9-1.8 2-3.3 2.5-.5.2-.5.8.1 1 .5.2 1.2.3 1.5.5.2.2.2.6.4.8.2.2.6.2 1 .2.6 0 1.1.2 1.5.5.5.4 1.1 1 2.4 1h4c1.3 0 1.9-.6 2.4-1 .4-.3.9-.5 1.5-.5.4 0 .8 0 1-.2.2-.2.2-.6.4-.8.3-.2 1-.3 1.5-.5.6-.2.6-.8.1-1-1.5-.5-2.7-1.6-3.3-2.5-.3-.4-.4-.8-.2-1.2.3-.6 1.1-.7 1.5-1 .5-.3.5-1 0-1.2-.4-.2-1 .1-1.5.4-.4.3-.9.5-1.1.1-.2-.5-.1-1.5-.1-2.3 0-2.7-1.7-4.5-4.2-4.5Z"/>')
  },
  discord: {
    color: '#5865F2',
    svg: icon('<path fill="currentColor" d="M19.7 5.2A18 18 0 0 0 15.3 4l-.5 1a16 16 0 0 0-5.6 0l-.5-1a18 18 0 0 0-4.4 1.2C1.5 9.3.7 13.3 1.1 17.2a18 18 0 0 0 5.4 2.7l1.2-2a11 11 0 0 1-1.9-.9l.5-.4c3.7 1.7 7.7 1.7 11.4 0l.5.4a11 11 0 0 1-1.9.9l1.2 2a18 18 0 0 0 5.4-2.7c.5-4.5-.8-8.5-3.2-12ZM8.7 14.7c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm6.6 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z"/>')
  },
  pinterest: {
    color: '#E60023',
    svg: icon('<path fill="currentColor" d="M12 1.8a10.2 10.2 0 0 0-3.7 19.7c0-.8 0-1.8.2-2.6l1.3-5.3s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.8 0 1.2.6 1.2 1.4 0 .9-.6 2.3-.9 3.6-.3 1.1.5 2 1.6 2 1.9 0 3.3-2.4 3.3-5.2 0-2.2-1.5-3.9-4.2-3.9-3.1 0-5 2.3-5 4.8 0 .9.3 1.8.8 2.3.2.2.2.3.2.6l-.2.9c-.1.3-.3.4-.6.3-1.3-.5-1.9-2-1.9-3.7 0-2.7 2.3-6 6.9-6 3.7 0 6.1 2.7 6.1 5.6 0 3.9-2.2 6.8-5.5 6.8-1.1 0-2.2-.6-2.6-1.3l-.7 2.7c-.2.9-.7 1.8-1 2.4A10.2 10.2 0 1 0 12 1.8Z"/>')
  },
  spotify: {
    color: '#1DB954',
    svg: icon('<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M5.8 9.2c4.1-1.2 8.9-.8 12.3 1.2M6.5 12.4c3.5-1 7.5-.6 10.4 1.1M7.2 15.4c2.9-.8 6-.5 8.4 1" fill="none" stroke="#101321" stroke-width="1.5" stroke-linecap="round"/>')
  },
  twitch: {
    color: '#9146FF',
    svg: icon('<path fill="currentColor" d="M4 2h18v13l-5 5h-4l-3 3v-3H4V2Zm2 2v14h5v2l2-2h4l3-3V4H6Zm5 3h2v6h-2V7Zm5 0h2v6h-2V7Z"/>')
  },
  threads: {
    color: '#111111',
    svg: icon('<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M17.8 8.4c-.7-2.5-2.7-3.8-5.7-3.8-4.1 0-6.6 2.8-6.6 7.3 0 4.6 2.4 7.5 6.5 7.5 3.2 0 5.2-1.7 5.2-4.2 0-2.2-1.6-3.5-4.2-3.5-2 0-3.2 1-3.2 2.5 0 1.2.9 2 2.2 2 2.9 0 4.5-2.6 4.5-6.3 0-3.7-1.7-6-4.7-6"/>')
  },
  reddit: {
    color: '#FF4500',
    svg: icon('<circle cx="12" cy="13" r="8.5" fill="currentColor"/><path d="m9 13 1.8 1.4a2 2 0 0 0 2.4 0L15 13" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><circle cx="9" cy="11" r="1" fill="#fff"/><circle cx="15" cy="11" r="1" fill="#fff"/><path d="m14 5 1-3 3 1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="18" cy="3" r="1.3" fill="currentColor"/>')
  },
  behance: {
    color: '#1769FF',
    svg: icon('<path fill="currentColor" d="M3 5h8c3 0 4.5 1.3 4.5 3.5 0 1.4-.7 2.4-1.8 2.9 1.6.4 2.5 1.6 2.5 3.3 0 2.6-1.9 4.3-4.8 4.3H3V5Zm3 2.4v3.1h4.5c1.3 0 2-.6 2-1.6s-.7-1.5-2-1.5H6Zm0 5.4v3.7h4.8c1.4 0 2.2-.7 2.2-1.8s-.8-1.9-2.2-1.9H6ZM17 7h5v1.8h-5V7Zm2.5 3c3 0 4.7 2 4.5 5.2h-6.8c.1 1.3.9 2 2.3 2 .9 0 1.6-.4 1.8-1h2.5c-.6 2.1-2.2 3.1-4.4 3.1-3 0-4.8-2-4.8-4.7S16.5 10 19.5 10Z"/>')
  },
  dribbble: {
    color: '#EA4C89',
    svg: icon('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 4.7c4.4 4.1 7.4 8.9 9 14.5M3.5 9.5c5.5.2 11.1-1.2 15.3-4M4.3 17c4.2-4 10.1-5.2 16.2-3.5" fill="none" stroke="currentColor" stroke-width="1.5"/>')
  },
  stackoverflow: {
    color: '#F48024',
    svg: icon('<path fill="currentColor" d="M5 17.2h2v3.1h10v-3.1h2v5H5v-5Zm2.2-1.1.4-2 9.7 2-.4 2-9.7-2Zm1.2-4.1 1-1.8 8.8 4.8-1 1.8-8.8-4.8Zm2.4-3.5 1.5-1.4 6.6 7.3-1.5 1.4-6.6-7.3Zm4-3.1 1.9-.8 3.8 8.9-1.9.8-3.8-8.9ZM5 3h2v9H5V3Z"/>')
  },
  website: {
    color: '#8A7CFF',
    svg: icon('<circle cx="12" cy="12" r="9.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2.9 12h18.2M12 2.7c2.4 2.5 3.6 5.6 3.6 9.3s-1.2 6.8-3.6 9.3C9.6 18.8 8.4 15.7 8.4 12s1.2-6.8 3.6-9.3Z" fill="none" stroke="currentColor" stroke-width="1.5"/>')
  },
  email: {
    color: '#E5A93D',
    svg: icon('<rect x="2.5" y="4.5" width="19" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m3.5 6 8.5 7 8.5-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>')
  },
  phone: {
    color: '#35B982',
    svg: icon('<path d="M7.1 3.2 9.8 7l-1.7 2.2a15 15 0 0 0 6.7 6.7l2.2-1.7 3.8 2.7-.8 3.1c-.2.8-1 1.3-1.8 1.2C9.4 20.1 3.9 14.6 2.8 5.8c-.1-.8.4-1.6 1.2-1.8l3.1-.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>')
  },
  link: {
    color: '#8A7CFF',
    svg: icon('<path d="M10 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7M14 10.2a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.9l1.7-1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>')
  }
};

const aliases = {
  twitter: 'x', 'fa-instagram': 'instagram', 'fa-facebook': 'facebook', 'fa-facebook-f': 'facebook',
  'fa-whatsapp': 'whatsapp', 'fa-linkedin': 'linkedin', 'fa-linkedin-in': 'linkedin',
  'fa-youtube': 'youtube', 'fa-tiktok': 'tiktok', 'fa-telegram': 'telegram', 'fa-github': 'github',
  'fa-x-twitter': 'x', 'fa-snapchat': 'snapchat', 'fa-discord': 'discord', 'fa-pinterest': 'pinterest',
  'fa-spotify': 'spotify', 'fa-twitch': 'twitch', 'fa-threads': 'threads', 'fa-reddit': 'reddit',
  '◎': 'instagram', 'in': 'linkedin', 'f': 'facebook', '◉': 'whatsapp', '⌘': 'github',
  '▶': 'youtube', '♪': 'tiktok', '➤': 'telegram', '✉': 'email', '☎': 'phone'
};
const GENERIC = new Set(['', '↗', '→', '➜', 'link', 'website', 'url', 'auto', 'تلقائي']);
const hostRules = [
  [/((^|\.)instagram\.com|instagr\.am)$/i, 'instagram'],
  [/((^|\.)facebook\.com|(^|\.)fb\.com|(^|\.)fb\.watch|(^|\.)m\.me)$/i, 'facebook'],
  [/((^|\.)whatsapp\.com|(^|\.)wa\.me|(^|\.)whatsapp\.net)$/i, 'whatsapp'],
  [/((^|\.)linkedin\.com)$/i, 'linkedin'],
  [/((^|\.)youtube\.com|(^|\.)youtu\.be)$/i, 'youtube'],
  [/((^|\.)tiktok\.com)$/i, 'tiktok'],
  [/((^|\.)t\.me|(^|\.)telegram\.me|(^|\.)telegram\.org)$/i, 'telegram'],
  [/((^|\.)github\.com|(^|\.)github\.io|(^|\.)github\.dev)$/i, 'github'],
  [/((^|\.)x\.com|(^|\.)twitter\.com)$/i, 'x'],
  [/((^|\.)snapchat\.com)$/i, 'snapchat'],
  [/((^|\.)discord\.com|(^|\.)discord\.gg|(^|\.)discordapp\.com)$/i, 'discord'],
  [/((^|\.)pinterest\.com|(^|\.)pin\.it)$/i, 'pinterest'],
  [/((^|\.)spotify\.com)$/i, 'spotify'],
  [/((^|\.)twitch\.tv)$/i, 'twitch'],
  [/((^|\.)threads\.net)$/i, 'threads'],
  [/((^|\.)reddit\.com|(^|\.)redd\.it)$/i, 'reddit'],
  [/((^|\.)behance\.net)$/i, 'behance'],
  [/((^|\.)dribbble\.com)$/i, 'dribbble'],
  [/((^|\.)stackoverflow\.com|((^|\.)stackexchange\.com))$/i, 'stackoverflow']
];
const labelRules = [
  [/instagram|انستجرام|إنستجرام|انستا/i, 'instagram'],
  [/facebook|فيس ?بوك/i, 'facebook'],
  [/whats ?app|واتس ?اب|واتساب/i, 'whatsapp'],
  [/linkedin|لينكد ?إن/i, 'linkedin'],
  [/youtube|يوتيوب/i, 'youtube'],
  [/tiktok|تيك ?توك/i, 'tiktok'],
  [/telegram|تيليجرام|تليجرام/i, 'telegram'],
  [/github|جيت ?هاب/i, 'github'],
  [/twitter|(^|\W)x(\W|$)|تويتر/i, 'x'],
  [/snapchat|سناب ?شات/i, 'snapchat'],
  [/discord/i, 'discord'], [/pinterest/i, 'pinterest'], [/spotify/i, 'spotify'],
  [/twitch/i, 'twitch'], [/threads/i, 'threads'], [/reddit/i, 'reddit'],
  [/behance/i, 'behance'], [/dribbble/i, 'dribbble'], [/stackoverflow|stack overflow/i, 'stackoverflow'],
  [/email|e-mail|بريد|ايميل|إيميل/i, 'email'], [/phone|call|هاتف|موبايل|اتصال/i, 'phone'],
  [/website|site|موقع|الموقع/i, 'website']
];

function clean(value) { return String(value ?? '').trim(); }
function normalizeKey(value) {
  const key = clean(value).toLowerCase().replace(/^#/, '');
  if (aliases[key]) return aliases[key];
  // Also understand common Font Awesome class strings saved by older editors.
  for (const token of key.split(/\s+/)) {
    if (aliases[token]) return aliases[token];
    if (ICONS[token]) return token;
  }
  return key;
}
function detectFromUrl(value) {
  const raw = clean(value);
  if (/^mailto:/i.test(raw)) return 'email';
  if (/^tel:/i.test(raw)) return 'phone';
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    return hostRules.find(([pattern]) => pattern.test(host))?.[1] || '';
  } catch { return ''; }
}

export function resolveLinkIcon(url, label, savedIcon) {
  const saved = clean(savedIcon);
  const normalized = normalizeKey(saved);
  if (ICONS[normalized] && normalized !== 'link' && normalized !== 'website') {
    return { key: normalized, color: ICONS[normalized].color, custom: '' };
  }
  if (saved && !GENERIC.has(saved.toLowerCase()) && !ICONS[normalized]) {
    return { key: 'custom', color: 'currentColor', custom: saved };
  }
  const detected = detectFromUrl(url) || labelRules.find(([pattern]) => pattern.test(clean(label)))?.[1] || '';
  const key = detected || (normalized === 'website' ? 'website' : 'link');
  return { key, color: ICONS[key].color, custom: '' };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function renderLinkIcon(url, label, savedIcon, extraClass = '') {
  const result = resolveLinkIcon(url, label, savedIcon);
  const cls = `link-icon${extraClass ? ` ${extraClass}` : ''}`;
  if (result.custom) return `<span class="${cls} link-icon-custom" style="--link-brand:${result.color}" aria-hidden="true">${escapeHtml(result.custom)}</span>`;
  const glyph = ICONS[result.key] || ICONS.link;
  return `<span class="${cls} link-icon-${result.key}" style="--link-brand:${glyph.color}" aria-hidden="true">${glyph.svg}</span>`;
}
