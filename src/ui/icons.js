export const SPEAKER = (size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>`;

export const LOCK = `<svg class="lock" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>`;

/** Edistymisrengas jaksokortin oikeaan reunaan. */
export function ring(pct) {
  const r = 14.5;
  const c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 34 34" aria-hidden="true"><circle class="bg" cx="17" cy="17" r="${r}"/><circle class="fg" cx="17" cy="17" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}" transform="rotate(-90 17 17)"/></svg>`;
}
