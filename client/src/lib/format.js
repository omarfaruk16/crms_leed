export const money = (n, compact = false) => {
  const v = Number(n) || 0;
  if (compact && Math.abs(v) >= 1000) {
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(v % 1e6 ? 1 : 0)}M`;
    return `$${(v / 1e3).toFixed(v % 1e3 ? 1 : 0)}k`;
  }
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
};

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

export const relTime = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  const diff = (d - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const fmt = (n, unit) => `${Math.round(n)} ${unit}${Math.round(n) === 1 ? '' : 's'}`;
  let txt;
  if (abs < 60) txt = 'just now';
  else if (abs < 3600) txt = fmt(abs / 60, 'min');
  else if (abs < 86400) txt = fmt(abs / 3600, 'hr');
  else if (abs < 2592000) txt = fmt(abs / 86400, 'day');
  else txt = d.toLocaleDateString();
  if (abs < 60) return txt;
  return diff < 0 ? `${txt} ago` : `in ${txt}`;
};

export const dateLabel = (date) =>
  date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

// avatar-ish color from a string
export const hueOf = (s = '') => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};
