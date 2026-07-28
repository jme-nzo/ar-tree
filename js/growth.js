// growth.js
// The single number that drives the whole artwork.
//
// Right now this lives in localStorage so the prototype runs with no backend.
// When you are ready for a real shared tree, only the two functions marked
// SWAP POINT need to change. Nothing else in the codebase touches storage.

const KEY = 'tree.scans';
const BIRD_KEY = 'tree.bird';

// The growth ceiling. Past this the tree stops getting bigger and only
// gets denser. Tune this once you know roughly how many scans an
// exhibition run will actually produce.
export const CEILING = 400;

/* ---------- SWAP POINT 1: read the shared count ---------- */
export async function getScans() {
  const forced = new URLSearchParams(location.search).get('growth');
  if (forced !== null) return Math.max(0, parseInt(forced, 10) || 0);
  return parseInt(localStorage.getItem(KEY) || '0', 10);

  // Server version:
  // const r = await fetch('/api/tree');
  // return (await r.json()).scans;
}

/* ---------- SWAP POINT 2: register one more scan ---------- */
export async function addScan() {
  if (new URLSearchParams(location.search).has('growth')) return getScans();
  const n = (parseInt(localStorage.getItem(KEY) || '0', 10)) + 1;
  localStorage.setItem(KEY, String(n));
  return n;

  // Server version:
  // const r = await fetch('/api/tree/grow', { method: 'POST' });
  // return (await r.json()).scans;
}

export function setScans(n) {
  localStorage.setItem(KEY, String(Math.max(0, n | 0)));
}

export function reset() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(BIRD_KEY);
}

// Logarithmic growth curve, returns 0..1.
// Linear growth looks fine at 50 scans and absurd at 5000. This flattens out.
export function growthT(scans) {
  const t = Math.log(1 + scans) / Math.log(1 + CEILING);
  return Math.max(0, Math.min(1, t));
}

/* ---------- the 24 hour bird ---------- */

export function getBird() {
  try {
    const raw = localStorage.getItem(BIRD_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw);
    if (Date.now() > b.expires) { localStorage.removeItem(BIRD_KEY); return null; }
    return b;
  } catch { return null; }
}

export function grantBird(variant) {
  const b = { variant, expires: Date.now() + 24 * 60 * 60 * 1000 };
  localStorage.setItem(BIRD_KEY, JSON.stringify(b));
  return b;
}

export function birdHoursLeft() {
  const b = getBird();
  if (!b) return 0;
  return Math.max(0, (b.expires - Date.now()) / 3600000);
}
