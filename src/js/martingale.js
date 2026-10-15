/* Interactive figure: the tree of values of a martingale (Proof 2 of the main theorem).
   Left: the atoms of Sigma_0, Sigma_1, ... as nested intervals of [0,1]. Right: the value of
   Y_n on each atom, a point of A; every value is the convex combination of the values on the
   atoms one level down, with weights |J_l| / |I|. Hovering an atom (or a point) shows it.
   Colors are read from the page's CSS variables, so the figure follows the theme. */
(function () {
  'use strict';
  var fig = document.getElementById('applet-martingale');
  if (!fig) return;
  var left = fig.querySelector('.applet-tree');
  var right = fig.querySelector('.applet-plane');
  var range = fig.querySelector('.applet-levels input');
  var renew = fig.querySelector('[data-action="new"]');
  var readout = fig.querySelector('[data-out="combination"]');

  var MAXDEPTH = 6;
  var A = { c: [1.05, 0.95], a: 0.9, b: 0.62, rot: 0.35 };  // an ellipse in the positive quadrant
  var VIEW = { x0: -0.15, x1: 2.15, y0: -0.15, y1: 2.15 };

  // ---------------------------------------------------------------- helpers
  function add(p, q, t) { return [p[0] + (t === undefined ? 1 : t) * q[0], p[1] + (t === undefined ? 1 : t) * q[1]]; }
  function sub(p, q) { return [p[0] - q[0], p[1] - q[1]]; }
  function norm(p) { return Math.hypot(p[0], p[1]); }
  function inA(p) {
    var d = sub(p, A.c), c = Math.cos(A.rot), s = Math.sin(A.rot);
    var u = (c * d[0] + s * d[1]) / A.a, v = (-s * d[0] + c * d[1]) / A.b;
    return u * u + v * v <= 1;
  }
  function rng(seed) {  // mulberry32: a small seeded generator, so a martingale can be redrawn
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- the martingale
  // each atom [a, b) of Sigma_n splits into 2 or 3 atoms of Sigma_{n+1}; the values on them
  // are random points of A whose weighted mean is exactly the value on [a, b)
  function build(seed) {
    var rand = rng(seed), nodes = [];
    function grow(node) {
      nodes.push(node);
      if (node.level === MAXDEPTH) return;
      var k = rand() < 0.5 ? 2 : 3, w = [], total = 0;
      for (var i = 0; i < k; i++) { w.push(0.35 + rand()); total += w[i]; }
      w = w.map(function (x) { return x / total; });
      var start = rand() * 2 * Math.PI, d = [];
      for (var j = 0; j < k; j++) {
        var ang = start + 2 * Math.PI * j / k + (rand() - 0.5) * 1.2, r = 0.6 + 0.4 * rand();
        d.push([r * Math.cos(ang), r * Math.sin(ang)]);
      }
      var mean = [0, 0];
      d.forEach(function (x, i) { mean = add(mean, x, w[i]); });
      d = d.map(function (x) { return sub(x, mean); });  // now sum w_i d_i = 0
      // the largest step keeping every child in A, then a bit less
      var lo = 0, hi = 2;
      for (var it = 0; it < 30; it++) {
        var mid = (lo + hi) / 2;
        if (d.every(function (x) { return inA(add(node.value, x, mid)); })) lo = mid; else hi = mid;
      }
      var step = 0.85 * lo, a = node.a;
      node.children = d.map(function (x, i) {
        var b = i === k - 1 ? node.b : a + w[i] * (node.b - node.a);
        var child = { level: node.level + 1, a: a, b: b, weight: w[i], value: add(node.value, x, step), parent: node, children: [] };
        a = b;
        return child;
      });
      node.children.forEach(grow);
    }
    var root = { level: 0, a: 0, b: 1, weight: 1, value: [A.c[0] - 0.05, A.c[1] + 0.02], parent: null, children: [] };
    grow(root);
    return { root: root, nodes: nodes };
  }

  var state = { seed: 7, depth: 3, tree: null, sel: null };
  function regenerate() {
    state.tree = build(state.seed);
    state.sel = state.tree.root;
    schedule();
  }
  function shown(node) { return node.level <= state.depth; }
  function isDescendant(node, of) {
    for (var p = node.parent; p; p = p.parent) if (p === of) return true;
    return false;
  }

  // ---------------------------------------------------------------- drawing helpers
  function palette() {
    var cs = getComputedStyle(document.documentElement);
    function v(name) { return cs.getPropertyValue(name).trim(); }
    return { fg: v('--fg'), bg: v('--bg'), rule: v('--rule'), accent: v('--ref'), muted: v('--muted') };
  }
  function rgba(hex, al) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + al + ')';
  }
  function fit(canvas) {
    var dpr = window.devicePixelRatio || 1, w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    if (canvas.width !== w || canvas.height !== w) { canvas.width = w; canvas.height = w; }
    return { ctx: canvas.getContext('2d'), W: w, dpr: dpr };
  }
  function text(ctx, str, x, y, size, color, font, align) {
    ctx.font = (font || '') + ' ' + Math.round(size) + 'px ' + (font === 'italic' ? 'KaTeX_Math' : 'NewCM10, KaTeX_Main') + ', serif';
    ctx.fillStyle = color; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  // ---------------------------------------------------------------- left: the atoms
  var rows = { x0: 0, x1: 0, y0: 0, h: 0 };
  function drawAtoms(col) {
    var r = fit(left), ctx = r.ctx, W = r.W, dpr = r.dpr, n = state.depth + 1;
    rows = { x0: 0.13 * W, x1: W - 0.05 * W, y0: 0.07 * W, h: (W * 0.82) / n };
    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, W);
    var sel = state.sel, gap = 1.5 * dpr;
    state.tree.nodes.forEach(function (node) {
      if (!shown(node)) return;
      var x = rows.x0 + node.a * (rows.x1 - rows.x0), w = (node.b - node.a) * (rows.x1 - rows.x0);
      var y = rows.y0 + node.level * rows.h, h = rows.h * 0.62;
      var fill = rgba(col.fg, 0.07), stroke = rgba(col.fg, 0.55);
      if (node === sel) { fill = rgba(col.accent, 0.4); stroke = col.accent; }
      else if (node.parent === sel) { fill = rgba(col.accent, 0.2); stroke = col.accent; }
      else if (isDescendant(node, sel)) { fill = rgba(col.accent, 0.08); stroke = rgba(col.accent, 0.6); }
      ctx.fillStyle = fill; ctx.fillRect(x + gap / 2, y, w - gap, h);
      ctx.strokeStyle = stroke; ctx.lineWidth = dpr; ctx.strokeRect(x + gap / 2, y, w - gap, h);
      // the weights |J_l| / |I| of the children of the selected atom
      if (node.parent === sel && w > 34 * dpr) text(ctx, node.weight.toFixed(2), x + w / 2, y + h / 2, 11 * dpr, col.fg);
    });
    for (var level = 0; level < n; level++) {  // row labels Sigma_n
      var yy = rows.y0 + level * rows.h + rows.h * 0.31;
      text(ctx, 'Σ', rows.x0 - 0.075 * W, yy, 15 * dpr, col.fg, '', 'center');
      text(ctx, String(level), rows.x0 - 0.045 * W, yy + 5 * dpr, 10.5 * dpr, col.fg, '', 'center');
    }
    var yb = rows.y0 + n * rows.h + 2 * dpr;
    text(ctx, '0', rows.x0, yb, 12 * dpr, col.muted);
    text(ctx, '1', rows.x1, yb, 12 * dpr, col.muted);
  }
  function atomAt(sx, sy) {
    var level = Math.floor((sy - rows.y0) / rows.h);
    if (level < 0 || level > state.depth) return null;
    var t = (sx - rows.x0) / (rows.x1 - rows.x0);
    if (t < 0 || t > 1) return null;
    return state.tree.nodes.find(function (nd) { return nd.level === level && nd.a <= t && t <= nd.b; }) || null;
  }

  // ---------------------------------------------------------------- right: the values in A
  var plane = { W: 1, dpr: 1 };
  function X(p) {
    var W = plane.W;
    return [(p[0] - VIEW.x0) / (VIEW.x1 - VIEW.x0) * W, W - (p[1] - VIEW.y0) / (VIEW.y1 - VIEW.y0) * W];
  }
  function hull(P) {
    P = P.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function turn(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [];
    P.forEach(function (p) { while (lo.length > 1 && turn(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
    P.reverse().forEach(function (p) { while (up.length > 1 && turn(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); });
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function path(ctx, pts, close) {
    ctx.beginPath();
    pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    if (close) ctx.closePath();
  }
  function dotAt(ctx, p, r, fill, stroke, width) {
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 2 * Math.PI);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function drawPlane(col) {
    var r = fit(right), ctx = r.ctx, W = r.W, dpr = r.dpr, sel = state.sel;
    plane = { W: W, dpr: dpr };
    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, W);
    // A
    var ell = [];
    for (var k = 0; k < 120; k++) {
      var t = 2 * Math.PI * k / 120, c = Math.cos(A.rot), s = Math.sin(A.rot);
      var u = A.a * Math.cos(t), v = A.b * Math.sin(t);
      ell.push(X([A.c[0] + c * u - s * v, A.c[1] + s * u + c * v]));
    }
    path(ctx, ell, true);
    ctx.fillStyle = rgba(col.fg, 0.04); ctx.fill();
    ctx.strokeStyle = rgba(col.fg, 0.6); ctx.lineWidth = 1.1 * dpr; ctx.stroke();
    // the label A, just outside the ellipse at its lower right, away from the tree
    var t0 = -0.75, cr = Math.cos(A.rot), sr = Math.sin(A.rot);
    var edge = [A.c[0] + cr * A.a * Math.cos(t0) - sr * A.b * Math.sin(t0), A.c[1] + sr * A.a * Math.cos(t0) + cr * A.b * Math.sin(t0)];
    var out = X(add(A.c, sub(edge, A.c), 1.12));
    text(ctx, 'A', out[0], out[1], 16 * dpr, col.fg, 'italic');
    // C: the closed convex hull of the values
    var nodes = state.tree.nodes.filter(shown);
    var H = hull(nodes.map(function (nd) { return nd.value; })).map(X);
    if (H.length > 2) {
      path(ctx, H, true);
      ctx.fillStyle = rgba(col.fg, 0.05); ctx.fill();
      ctx.setLineDash([4 * dpr, 3 * dpr]);
      ctx.strokeStyle = rgba(col.fg, 0.5); ctx.lineWidth = dpr; ctx.stroke();
      ctx.setLineDash([]);
    }
    // the tree
    nodes.forEach(function (nd) {
      if (!nd.parent || !shown(nd)) return;
      var hot = nd.parent === sel || isDescendant(nd, sel);
      path(ctx, [X(nd.parent.value), X(nd.value)]);
      ctx.strokeStyle = nd.parent === sel ? col.accent : hot ? rgba(col.accent, 0.45) : rgba(col.fg, 0.22);
      ctx.lineWidth = (nd.parent === sel ? 1.6 : 1) * dpr; ctx.stroke();
    });
    nodes.forEach(function (nd) {
      var rad = Math.max(1.6, 4.6 - 0.7 * nd.level) * dpr, p = X(nd.value);
      if (nd === sel) return;
      if (nd.parent === sel) dotAt(ctx, p, rad + 1 * dpr, col.bg, col.accent, 1.5 * dpr);
      else if (isDescendant(nd, sel)) dotAt(ctx, p, rad, rgba(col.accent, 0.75));
      else dotAt(ctx, p, rad, rgba(col.fg, 0.7));
    });
    // the selected value, its children and their weights
    var ps = X(sel.value);
    dotAt(ctx, ps, Math.max(1.6, 4.6 - 0.7 * sel.level) * dpr + 1.5 * dpr, col.accent);
    if (sel.level < state.depth) sel.children.forEach(function (ch) {
      var pc = X(ch.value), d = sub(pc, ps), l = norm(d) || 1;
      text(ctx, ch.weight.toFixed(2), pc[0] + d[0] / l * 16 * dpr, pc[1] + d[1] / l * 16 * dpr, 11 * dpr, col.fg);
    });
  }
  function nodeAt(sx, sy) {
    var best = null, bd = 12 * plane.dpr;
    state.tree.nodes.forEach(function (nd) {
      if (!shown(nd)) return;
      var p = X(nd.value), d = Math.hypot(p[0] - sx, p[1] - sy);
      if (d < bd) { bd = d; best = nd; }
    });
    return best;
  }

  // ---------------------------------------------------------------- the readout
  function sym(name, index) {
    return '<span class="mi">' + name + '</span><sub>' + index + '</sub>';
  }
  function describe() {
    var sel = state.sel, n = sel.level;
    var atom = ' for <span class="mi">t</span> ∈ [' + sel.a.toFixed(2) + ', ' + sel.b.toFixed(2) + ')';
    if (n >= state.depth) {
      readout.innerHTML = sym('Y', n) + '(<span class="mi">t</span>)' + atom +
        ': a value of the last level drawn.';
      return;
    }
    var terms = sel.children.map(function (ch, i) { return ch.weight.toFixed(2) + ' ' + sym('z', i + 1); });
    readout.innerHTML = sym('Y', n) + '(<span class="mi">t</span>) = ' + terms.join(' + ') + atom + ', where ' +
      sel.children.map(function (ch, i) { return sym('z', i + 1); }).join(', ') +
      ' are the values of ' + sym('Y', n + 1) + ' on the atoms inside.';
  }

  // ---------------------------------------------------------------- update
  var pending = false;
  function render() {
    pending = false;
    var col = palette();
    drawAtoms(col);
    drawPlane(col);
    describe();
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(render); }
  }
  function select(node) {
    if (node && node !== state.sel) { state.sel = node; schedule(); }
  }

  function local(canvas, e) {
    var r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr];
  }
  left.addEventListener('pointermove', function (e) { var p = local(left, e); select(atomAt(p[0], p[1])); });
  left.addEventListener('pointerdown', function (e) { var p = local(left, e); select(atomAt(p[0], p[1])); });
  right.addEventListener('pointermove', function (e) { var p = local(right, e); select(nodeAt(p[0], p[1])); });
  right.addEventListener('pointerdown', function (e) { var p = local(right, e); select(nodeAt(p[0], p[1])); });
  // keyboard: down to the first child, up to the parent, left and right along a level
  left.addEventListener('keydown', function (e) {
    var sel = state.sel, level = state.tree.nodes.filter(function (nd) { return nd.level === sel.level; });
    var i = level.indexOf(sel), next = null;
    if (e.key === 'ArrowDown' && sel.level < state.depth) next = sel.children[0];
    else if (e.key === 'ArrowUp') next = sel.parent;
    else if (e.key === 'ArrowLeft') next = level[i - 1];
    else if (e.key === 'ArrowRight') next = level[i + 1];
    else return;
    e.preventDefault();
    select(next);
  });
  range.addEventListener('input', function () {
    state.depth = parseInt(range.value, 10);
    if (state.sel.level > state.depth) state.sel = state.tree.root;
    schedule();
  });
  renew.addEventListener('click', function () { state.seed = Math.floor(Math.random() * 1e9); regenerate(); });

  if (window.ResizeObserver) new ResizeObserver(schedule).observe(left);
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.fonts) document.fonts.ready.then(schedule);
  regenerate();
})();
