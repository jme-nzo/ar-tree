// ui.js
// All DOM work lives here so the AR files stay about AR.

import { getScans, setScans, reset, growthT, birdHoursLeft } from './growth.js';
import { BIRD_VARIANTS } from './scene.js';

/* ---------- the letters ----------
   Placeholder texts. Replace with your own, or fetch them from a table
   once you decide whether visitors write these. */

export const LETTERS = [
  {
    title: 'To whoever is standing here',
    body: 'The tree you are looking at is not finished. It cannot be. Every person who stops here adds a little to it, and then walks away without seeing what they made.\n\nYou are somewhere in the middle of a very long sentence.',
    from: 'Left on the third branch',
  },
  {
    title: 'A small confession',
    body: 'I planted this without knowing if anyone would come. For a while it was one stem and nothing else. I checked it more often than I would like to admit.\n\nIt is taller now. That was you, and everyone before you.',
    from: 'Left near the roots',
  },
  {
    title: 'On patience',
    body: 'Nothing here grows while you watch. That is the arrangement. You give it one scan, and the growing happens later, to someone else, somewhere you are not.\n\nCome back tomorrow. See what the others did.',
    from: 'Left where the light gets in',
  },
  {
    title: 'For the one who almost kept walking',
    body: 'Thank you for stopping. It costs nothing and it changes the shape of the thing.\n\nTake a bird with you. It stays a day.',
    from: 'Left under the leaves',
  },
];

export function letterFor(scans) {
  return LETTERS[scans % LETTERS.length];
}

/* ---------- HUD ---------- */

export function status(text, autoDim = false) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('dim');
  if (autoDim) setTimeout(() => el.classList.add('dim'), 3200);
}

export function renderCount(scans) {
  const el = document.getElementById('count');
  if (el) el.textContent = scans;
  const label = document.getElementById('count-label');
  if (!label) return;
  const h = birdHoursLeft();
  label.textContent = h > 0
    ? `scans · bird ${Math.ceil(h)}h left`
    : (scans === 1 ? 'scan' : 'scans');
}

/* ---------- letter overlay ---------- */

let onLetterClosed = null;

export function openLetter(letter, onClose) {
  onLetterClosed = onClose;
  document.getElementById('letter-title').textContent = letter.title;
  document.getElementById('letter-body').textContent = letter.body;
  document.getElementById('letter-from').textContent = letter.from;
  document.getElementById('letter-scrim').classList.add('open');
}

export function closeLetter() {
  document.getElementById('letter-scrim').classList.remove('open');
  const cb = onLetterClosed;
  onLetterClosed = null;
  if (cb) setTimeout(cb, 380);
}

export function isLetterOpen() {
  return document.getElementById('letter-scrim').classList.contains('open');
}

/* ---------- dev panel ----------
   Tap the scan counter to open it. This is the tool for deciding your
   growth curve: drag through the whole range and watch the tree change. */

export function initDev(onGrowthChange) {
  const count = document.getElementById('count');
  const panel = document.getElementById('dev');
  const slider = document.getElementById('dev-slider');
  const read = document.getElementById('dev-read');
  if (!count || !panel) return;

  count.addEventListener('click', async () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      const n = await getScans();
      slider.value = n;
      read.textContent = `${n} scans · stage ${(growthT(n) * 100) | 0}%`;
    }
  });

  slider.addEventListener('input', () => {
    const n = parseInt(slider.value, 10);
    read.textContent = `${n} scans · stage ${(growthT(n) * 100) | 0}%`;
    setScans(n);
    renderCount(n);
    onGrowthChange(n);
  });

  document.getElementById('dev-reset').addEventListener('click', () => {
    reset();
    slider.value = 0;
    read.textContent = '0 scans · stage 0%';
    renderCount(0);
    onGrowthChange(0);
  });

  document.getElementById('dev-close')
    .addEventListener('click', () => panel.classList.remove('open'));
}

export function birdName(i) {
  return BIRD_VARIANTS[i % BIRD_VARIANTS.length].name;
}
