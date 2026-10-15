/* The behaviour of the page, in three independent parts: the scrolling title screen, the
   reading-progress bar, and the light/dark switch. The interactive figures have their own
   scripts (slices.js, extreme.js, martingale.js), loaded next to each figure. */

/* The title screen: while its stage scrolls past, the composition stays in place, the title
   fades out and the disclaimer fades into its place. --stage-title and --stage-note (0 to 1)
   drive the CSS (src/css/05-landing.css). */
(function () {
  'use strict';
  var stage = document.querySelector('.landing-stage');
  if (!stage) return;
  function ramp(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  var pending = false;
  function update() {
    pending = false;
    var r = stage.getBoundingClientRect(), range = r.height - window.innerHeight;
    var u = range > 0 ? Math.min(1, Math.max(0, -r.top / range)) : 0;  // 0 at the top, 1 when it leaves
    var title = 1 - ramp(0.06, 0.38, u), note = ramp(0.32, 0.62, u);
    stage.style.setProperty('--stage-title', title.toFixed(3));
    stage.style.setProperty('--stage-note', note.toFixed(3));
    stage.classList.toggle('note-on', note > 0.5);
  }
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
})();

/* Reading progress below the contents, with an eye to hide it (remembered per browser). */
(function () {
  'use strict';
  var box = document.querySelector('.reading-progress');
  if (!box) return;
  var bar = box.querySelector('.progress-bar');
  var fill = box.querySelector('.progress-fill');
  var label = box.querySelector('.progress-label');
  var eye = box.querySelector('.progress-eye');

  // the reading starts at the first section (0% while it is at the top of the window, after
  // the landing screens) and ends where the references start (100% once they come into view)
  var start = document.querySelector('.sec');
  var end = document.getElementById('references');
  var pending = false;
  function update() {
    pending = false;
    var top = start ? start.getBoundingClientRect().top + window.scrollY : 0;
    var bottom = end ? end.getBoundingClientRect().top + window.scrollY : document.documentElement.scrollHeight;
    var max = bottom - window.innerHeight - top;
    var p = max > 0 ? Math.min(1, Math.max(0, (window.scrollY - top) / max)) : 1;
    var pct = Math.round(p * 100);
    fill.style.width = (100 * p) + '%';
    label.textContent = pct + '%';
    bar.setAttribute('aria-valuenow', String(pct));
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);

  function setHidden(hidden, remember) {
    box.classList.toggle('is-hidden', hidden);
    var text = hidden ? 'Show reading progress' : 'Hide reading progress';
    eye.setAttribute('aria-pressed', String(hidden));
    eye.setAttribute('aria-label', text);
    eye.title = text;
    if (remember) {
      try { localStorage.setItem('progress-hidden', hidden ? '1' : '0'); } catch (e) {}
    }
  }
  var stored = false;
  try { stored = localStorage.getItem('progress-hidden') === '1'; } catch (e) {}
  setHidden(stored, false);
  eye.addEventListener('click', function () { setHidden(!box.classList.contains('is-hidden'), true); });
  update();
})();

/* The light/dark switch (the button at the top of index.html). The choice is kept in
   the browser; index.html applies it again before the first paint of the next visit. */
(function () {
  'use strict';
  var root = document.documentElement, button = document.querySelector('.theme-toggle');
  if (!button) return;
  function label() {
    var text = root.dataset.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    button.setAttribute('aria-label', text);
    button.title = text;
  }
  label();
  button.addEventListener('click', function () {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
    label();
  });
})();
