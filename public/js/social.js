// Social profile links (set in admin → Settings). Icons are simple stroke drawings, built with the DOM API.
import { h } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  tiktok: ['M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5', 'M14 4c.6 2.6 2.4 4.1 5 4.3'],
  instagram: ['M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z', 'M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z', 'M17.3 6.7h.01'],
  youtube: ['M3.5 8.2c.2-1.6 1.3-2.7 2.9-2.8C8.2 5.2 10.1 5 12 5s3.8.2 5.6.4c1.6.1 2.7 1.2 2.9 2.8.2 1.3.3 2.5.3 3.8s-.1 2.5-.3 3.8c-.2 1.6-1.3 2.7-2.9 2.8-1.8.2-3.7.4-5.6.4s-3.8-.2-5.6-.4c-1.6-.1-2.7-1.2-2.9-2.8C3.3 14.5 3.2 13.3 3.2 12s.1-2.5.3-3.8z', 'M10 9.2v5.6l4.8-2.8z'],
  x: ['M4 4l16 16', 'M20 4L4 20'],
};
export const NETWORKS = [['tiktok', 'TikTok'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['x', 'X']];

export function icon(name) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'ico');
  for (const d of ICONS[name]) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

// Buttons for every configured network. Returns null when none is set, so callers can skip the block.
export function socialLinks(profile = {}, { compact = false } = {}) {
  const items = NETWORKS.filter(([k]) => profile[k]);
  if (!items.length) return null;
  return h('div', { class: `socials${compact ? ' compact' : ''}` }, items.map(([k, label]) =>
    h('a', { class: 'social', href: profile[k], target: '_blank', rel: 'noopener me', 'aria-label': `${label} (öffnet in neuem Tab)` }, icon(k), compact ? null : h('span', {}, label))));
}
