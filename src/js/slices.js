/* Interactive figure: slices of a planar set (markup in index.html).
   Left: the set A over the values of a linear functional f, its supporting line and the
   slice S(A, f, alpha). Right: the graph of f over A cut by the plane at height M(A,f) - alpha.
   Colors are read from the page's CSS variables, so the figure follows the theme. */
(function () {
  'use strict';
  var fig = document.getElementById('applet-slices');
  if (!fig) return;
  var c2 = fig.querySelector('.applet-2d');
  var c3 = fig.querySelector('.applet-3d');
  var range = fig.querySelector('.applet-alpha input');
  var buttons = Array.prototype.slice.call(fig.querySelectorAll('[data-shape]'));

  var R = 1.5;  // the plane is shown on [-R, R]^2

  function ring(n, radius) {
    var pts = [];
    for (var k = 0; k < n; k++) {
      var t = 2 * Math.PI * k / n, r = radius(t);
      pts.push([r * Math.cos(t), r * Math.sin(t)]);
    }
    return pts;
  }
  var SHAPES = {
    disk: ring(180, function () { return 1; }),
    square: [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]],
    triangle: [[-1.05, -0.75], [1.1, -0.45], [-0.25, 1.1]],
    blob: ring(240, function (t) { return 0.82 + 0.28 * Math.cos(3 * t); })
  };

  var state = { A: SHAPES.disk, f: [0.85, 0.5], t: 0.3, az: -0.65, el: 0.55, drawing: false, path: null };

  // ---------------------------------------------------------------- geometry
  function dot(f, p) { return f[0] * p[0] + f[1] * p[1]; }

  // the part of the polygon where f >= c (Sutherland-Hodgman against one half-plane)
  function clip(poly, f, c) {
    var res = [];
    for (var i = 0; i < poly.length; i++) {
      var P = poly[i], Q = poly[(i + 1) % poly.length];
      var fp = dot(f, P) - c, fq = dot(f, Q) - c;
      if (fp >= 0) res.push(P);
      if ((fp >= 0) !== (fq >= 0)) {
        var s = fp / (fp - fq);
        res.push([P[0] + s * (Q[0] - P[0]), P[1] + s * (Q[1] - P[1])]);
      }
    }
    return res;
  }

  function diameter(P) {
    var d = 0;
    for (var i = 0; i < P.length; i++)
      for (var j = i + 1; j < P.length; j++)
        d = Math.max(d, Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]));
    return d;
  }

  function geometry() {
    var f = state.f, vals = state.A.map(function (p) { return dot(f, p); });
    var M = Math.max.apply(null, vals), m = Math.min.apply(null, vals);
    var alpha = state.t * (M - m), level = M - alpha, eps = 1e-9 * (1 + Math.abs(M));
    var slice = clip(state.A, f, level);
    return {
      M: M, m: m, alpha: alpha, level: level, slice: slice,
      rest: clip(state.A, [-f[0], -f[1]], -level),
      face: state.A.filter(function (p) { return dot(f, p) >= M - eps; }),
      cut: slice.filter(function (p) { return Math.abs(dot(f, p) - level) <= eps * 10; }),
      diam: diameter(slice)
    };
  }

  // ---------------------------------------------------------------- drawing helpers
  function palette() {
    var cs = getComputedStyle(document.documentElement);
    function v(name) { return cs.getPropertyValue(name).trim(); }
    return { fg: v('--fg'), bg: v('--bg'), rule: v('--rule'), accent: v('--ref') };
  }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function fit(canvas) {
    var dpr = window.devicePixelRatio || 1, w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    if (canvas.width !== w || canvas.height !== w) { canvas.width = w; canvas.height = w; }
    return { ctx: canvas.getContext('2d'), W: w, dpr: dpr };
  }
  function shape(ctx, pts, fill, stroke, width, dash) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (pts.length > 2) ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) {
      ctx.setLineDash(dash || []);
      ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ---------------------------------------------------------------- left: the plane
  function draw2d(g, col) {
    var r = fit(c2), ctx = r.ctx, W = r.W, dpr = r.dpr, s = W / (2 * R);
    function X(p) { return [W / 2 + p[0] * s, W / 2 - p[1] * s]; }
    var f = state.f, n = Math.hypot(f[0], f[1]), u = [f[0] / n, f[1] / n], v = [-u[1], u[0]];

    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, W);
    // the values of f: a soft ramp along its gradient
    var a = X([-R * u[0] * 1.42, -R * u[1] * 1.42]), b = X([R * u[0] * 1.42, R * u[1] * 1.42]);
    var ramp = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    ramp.addColorStop(0, rgba(col.fg, 0)); ramp.addColorStop(1, rgba(col.fg, 0.15));
    ctx.fillStyle = ramp; ctx.fillRect(0, 0, W, W);
    // axes
    shape(ctx, [X([-R, 0]), X([R, 0])], null, col.rule, dpr);
    shape(ctx, [X([0, -R]), X([0, R])], null, col.rule, dpr);

    // A and the slice
    shape(ctx, state.A.map(X), rgba(col.fg, 0.06), col.fg, 1.3 * dpr);
    if (g.slice.length > 2) shape(ctx, g.slice.map(X), rgba(col.accent, 0.32), col.accent, 1.6 * dpr);

    // level lines {f = c}: the supporting line (dashed) and the cut
    function level(c, color, dash) {
      var p = [c / n * u[0], c / n * u[1]], L = 3 * R;
      shape(ctx, [X([p[0] - L * v[0], p[1] - L * v[1]]), X([p[0] + L * v[0], p[1] + L * v[1]])],
            null, color, 1.1 * dpr, dash);
    }
    level(g.M, col.fg, [5 * dpr, 4 * dpr]);
    level(g.level, col.accent);

    // where f attains its maximum on A
    if (g.face.length > 1) shape(ctx, [X(g.face[0]), X(g.face[g.face.length - 1])], null, col.fg, 3 * dpr);
    ctx.fillStyle = col.fg;
    g.face.slice(0, 2).forEach(function (p) {
      var q = X(p); ctx.beginPath(); ctx.arc(q[0], q[1], 3 * dpr, 0, 2 * Math.PI); ctx.fill();
    });

    // the functional, as the vector f
    var o = X([0, 0]), t = X(f), h = 9 * dpr, ang = Math.atan2(t[1] - o[1], t[0] - o[0]);
    shape(ctx, [o, [t[0] - 0.8 * h * Math.cos(ang), t[1] - 0.8 * h * Math.sin(ang)]], null, col.fg, 1.4 * dpr);
    shape(ctx, [t, [t[0] - h * Math.cos(ang - 0.4), t[1] - h * Math.sin(ang - 0.4)],
                [t[0] - h * Math.cos(ang + 0.4), t[1] - h * Math.sin(ang + 0.4)]], col.fg, null);
    ctx.font = 'italic ' + Math.round(16 * dpr) + 'px KaTeX_Math, serif';
    ctx.fillStyle = col.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('f', t[0] + 13 * dpr * Math.cos(ang), t[1] + 13 * dpr * Math.sin(ang));

    // a curve being drawn
    if (state.path) shape(ctx, state.path.map(X), null, col.fg, 1.3 * dpr, [3 * dpr, 3 * dpr]);
  }

  // ---------------------------------------------------------------- right: the graph of f
  function draw3d(g, col) {
    var r = fit(c3), ctx = r.ctx, W = r.W, dpr = r.dpr;
    var ca = Math.cos(state.az), sa = Math.sin(state.az), ce = Math.cos(state.el), se = Math.sin(state.el);
    var k = 0.9 / Math.max(Math.abs(g.M), Math.abs(g.m), 0.6);  // vertical scale
    var floor = -1.25, s = W / (2 * R * 1.5), f = state.f;
    function P(x, y, z) {
      var xr = x * ca - y * sa, yr = x * sa + y * ca;
      return [W / 2 + xr * s, W * 0.56 - (yr * se + z * ce) * s];
    }
    function lift(pts, z) {
      return pts.map(function (p) { return P(p[0], p[1], z === undefined ? dot(f, p) * k : z); });
    }
    var box = [[-R, -R], [R, -R], [R, R], [-R, R]];

    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, W);
    // the plane of A, with A and the slice
    shape(ctx, lift(box, floor), rgba(col.fg, 0.03), col.rule, dpr);
    shape(ctx, lift(state.A, floor), rgba(col.fg, 0.06), rgba(col.fg, 0.45), dpr);
    if (g.slice.length > 2) shape(ctx, lift(g.slice, floor), rgba(col.accent, 0.3), col.accent, dpr);
    // the graph of f below the cut, the cutting plane, and the graph above it
    if (g.rest.length > 2) shape(ctx, lift(g.rest), rgba(col.fg, 0.1), col.fg, 1.2 * dpr);
    shape(ctx, lift(box, g.level * k), rgba(col.accent, 0.09), rgba(col.accent, 0.55), dpr);
    if (g.slice.length > 2) shape(ctx, lift(g.slice), rgba(col.accent, 0.42), col.accent, 1.4 * dpr);
    // where the cut meets the graph, dropped to the plane of A
    g.cut.forEach(function (p) {
      shape(ctx, [P(p[0], p[1], g.level * k), P(p[0], p[1], floor)], null, rgba(col.accent, 0.7), dpr,
            [3 * dpr, 3 * dpr]);
    });
  }

  // ---------------------------------------------------------------- update
  var pending = false;
  function render() {
    pending = false;
    var g = geometry(), col = palette();
    draw2d(g, col);
    draw3d(g, col);
    function out(name, value) { fig.querySelector('[data-out="' + name + '"]').textContent = value; }
    out('f', state.f[0].toFixed(2) + ', ' + state.f[1].toFixed(2));
    out('M', g.M.toFixed(2));
    out('alpha', g.alpha.toFixed(2));
    out('diam', g.diam.toFixed(2));
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(render); }
  }

  function setShape(name) {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.shape === name)); });
    state.drawing = name === 'draw';
    c2.classList.toggle('is-drawing', state.drawing);
    if (SHAPES[name]) state.A = SHAPES[name];
    schedule();
  }
  buttons.forEach(function (b) {
    b.addEventListener('click', function () { setShape(b.dataset.shape); });
  });
  range.addEventListener('input', function () { state.t = parseFloat(range.value); schedule(); });

  // ---------------------------------------------------------------- left view: move f, or draw A
  function world(e) {
    var rect = c2.getBoundingClientRect(), s = rect.width / (2 * R);
    return [(e.clientX - rect.left - rect.width / 2) / s, (rect.height / 2 - (e.clientY - rect.top)) / s];
  }
  function setF(p) {
    var n = Math.hypot(p[0], p[1]);
    if (n < 1e-6) return;
    var m = Math.min(Math.max(n, 0.3), R * 0.95);
    state.f = [p[0] / n * m, p[1] / n * m];
    schedule();
  }
  // resample a traced curve to evenly spaced points
  function resample(path, count) {
    var len = [0];
    for (var i = 1; i < path.length; i++)
      len.push(len[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    var total = len[len.length - 1], out = [], j = 0;
    for (var k = 0; k < count; k++) {
      var d = total * k / count;
      while (j < len.length - 2 && len[j + 1] < d) j++;
      var s = (d - len[j]) / Math.max(len[j + 1] - len[j], 1e-12);
      out.push([path[j][0] + s * (path[j + 1][0] - path[j][0]), path[j][1] + s * (path[j + 1][1] - path[j][1])]);
    }
    return out;
  }
  function area(P) {
    var a = 0;
    for (var i = 0; i < P.length; i++) {
      var p = P[i], q = P[(i + 1) % P.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(a) / 2;
  }

  c2.addEventListener('pointerdown', function (e) {
    c2.setPointerCapture(e.pointerId);
    if (state.drawing) state.path = [world(e)];
    else setF(world(e));
  });
  c2.addEventListener('pointermove', function (e) {
    if (!c2.hasPointerCapture(e.pointerId)) return;
    var p = world(e);
    p = [Math.max(-R, Math.min(R, p[0])), Math.max(-R, Math.min(R, p[1]))];
    if (state.drawing && state.path) { state.path.push(p); schedule(); }
    else if (!state.drawing) setF(p);
  });
  c2.addEventListener('pointerup', function () {
    if (!state.drawing || !state.path) return;
    var path = state.path;
    state.path = null;
    if (path.length > 8) {
      var A = resample(path, 200);
      if (area(A) > 0.02) { state.A = A; setShape('none'); return; }
    }
    schedule();
  });
  c2.addEventListener('keydown', function (e) {
    var f = state.f, ang = Math.atan2(f[1], f[0]), n = Math.hypot(f[0], f[1]), step = Math.PI / 36;
    if (e.key === 'ArrowLeft') ang += step;
    else if (e.key === 'ArrowRight') ang -= step;
    else if (e.key === 'ArrowUp') n *= 1.1;
    else if (e.key === 'ArrowDown') n /= 1.1;
    else return;
    e.preventDefault();
    setF([n * Math.cos(ang), n * Math.sin(ang)]);
  });

  // ---------------------------------------------------------------- right view: turn the picture
  var last = null;
  c3.addEventListener('pointerdown', function (e) { c3.setPointerCapture(e.pointerId); last = [e.clientX, e.clientY]; });
  c3.addEventListener('pointermove', function (e) {
    if (!last) return;
    state.az += (e.clientX - last[0]) * 0.01;
    state.el = Math.max(0.1, Math.min(1.5, state.el + (e.clientY - last[1]) * 0.01));
    last = [e.clientX, e.clientY];
    schedule();
  });
  c3.addEventListener('pointerup', function () { last = null; });

  // ---------------------------------------------------------------- redraw on resize, theme and fonts
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(c2);
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.fonts) document.fonts.ready.then(schedule);
  render();
})();
