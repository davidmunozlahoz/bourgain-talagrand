/* Interactive figure: the unit ball of L_1[0,1] is not dentable (Example 2.13). Left: a
   function f of the unit ball, as a step function on N cells, and the point c that splits the
   area under |f| in two halves. Right: g = f + u and h = f - u, with f dashed. Dragging on the
   left graph redraws f; the slider sets its norm; the buttons choose a shape. The norms in the
   readout are computed exactly for the step functions drawn. Colors are read from the page's
   CSS variables, so the figure follows the theme. */
(function () {
  'use strict';
  var fig = document.getElementById('applet-l1');
  if (!fig) return;
  var left = fig.querySelector('.applet-f');
  var right = fig.querySelector('.applet-gh');
  var range = fig.querySelector('.applet-alpha input');
  var buttons = [].slice.call(fig.querySelectorAll('[data-shape]'));
  var out = {};
  [].forEach.call(fig.querySelectorAll('[data-out]'), function (el) { out[el.dataset.out] = el; });

  var N = 200;
  var SHAPES = {
    wave: function (t) { return Math.sin(2.5 * Math.PI * t) + 0.3; },
    bump: function (t) { return Math.exp(-Math.pow((t - 0.3) / 0.12, 2)); },
    ramp: function (t) { return t; },
    steps: function (t) { return t < 0.2 ? 0.6 : t < 0.45 ? -1 : t < 0.7 ? 0.3 : 1.2; }
  };

  // ---------------------------------------------------------------- helpers
  function l1(v) { var s = 0; for (var i = 0; i < N; i++) s += Math.abs(v[i]); return s / N; }
  function maxAbs(v) { var m = 0; for (var i = 0; i < N; i++) m = Math.max(m, Math.abs(v[i])); return m; }
  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }

  // f = r * shape, with ||shape||_1 = 1, so that the slider can bring back a shape from r = 0.
  // Y is the height of the plots: |g|, |h| <= (1 + r) |shape| <= 2 |shape|, so it does not
  // depend on r and the graphs keep their scale while the slider moves.
  var state = { shape: new Float64Array(N), r: 0.6, Y: 1, paint: null };
  function setShape(v) {
    var n = l1(v);
    for (var i = 0; i < N; i++) state.shape[i] = v[i] / n;
    state.Y = 1.1 * Math.max(2 * maxAbs(state.shape), 1);
  }
  function choose(name) {
    var v = new Float64Array(N);
    for (var i = 0; i < N; i++) v[i] = SHAPES[name]((i + 0.5) / N);
    setShape(v);
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.shape === name)); });
    schedule();
  }

  // ---------------------------------------------------------------- the construction
  // c with int_0^c |f| = ||f||_1 / 2, lambda = 1 / ||f||_1, and the norms of g, h and u = g - f;
  // each cell splits at c into a part in [0, c] and a part in (c, 1]
  function construct() {
    var f = new Float64Array(N);
    for (var i = 0; i < N; i++) f[i] = state.r * state.shape[i];
    var total = l1(f), c = null, lambda = null, ng = 0, nh = 0, nu = 0;
    if (total > 0) {
      var half = total / 2, cum = 0;
      for (i = 0; i < N; i++) {
        var a = Math.abs(f[i]) / N;
        if (cum + a >= half) { c = (i + (half - cum) / a) / N; break; }
        cum += a;
      }
      lambda = 1 / total;
      for (i = 0; i < N; i++) {
        var L = clamp(c - i / N, 0, 1 / N), R = 1 / N - L, m = Math.abs(f[i]);
        ng += m * ((1 + lambda) * L + Math.abs(1 - lambda) * R);
        nh += m * (Math.abs(1 - lambda) * L + (1 + lambda) * R);
        nu += m * lambda / N;
      }
    } else {
      ng = nh = nu = 1;  // f = 0: g and h are the constants 1 and -1
    }
    return { f: f, total: total, c: c, lambda: lambda, ng: ng, nh: nh, nu: nu };
  }
  // a step function as segments [t0, t1, value, side], side 0 on [0, c] and 1 on (c, 1];
  // k0 and k1 are the factors on the two sides (g: 1 + lambda and 1 - lambda)
  function segments(K, k0, k1) {
    var segs = [];
    if (K.c === null) return [[0, 1, k0, 0]];
    for (var i = 0; i < N; i++) {
      var t0 = i / N, t1 = (i + 1) / N;
      if (t1 <= K.c) segs.push([t0, t1, k0 * K.f[i], 0]);
      else if (t0 >= K.c) segs.push([t0, t1, k1 * K.f[i], 1]);
      else { segs.push([t0, K.c, k0 * K.f[i], 0]); segs.push([K.c, t1, k1 * K.f[i], 1]); }
    }
    return segs;
  }

  // ---------------------------------------------------------------- drawing helpers
  function palette() {
    var cs = getComputedStyle(document.documentElement);
    function v(name) { return cs.getPropertyValue(name).trim(); }
    return { fg: v('--fg'), bg: v('--bg'), g: v('--ref'), h: v('--url'), muted: v('--muted') };
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
  // both plots share the geometry: t in [0, 1] across, values in [-Y, Y] up and down
  var geo = { x0: 0, x1: 1, mid: 0, hh: 1, W: 1, dpr: 1 };
  function setGeo(W, dpr) { geo = { x0: 0.07 * W, x1: 0.95 * W, mid: 0.5 * W, hh: 0.4 * W, W: W, dpr: dpr }; }
  function px(t) { return geo.x0 + t * (geo.x1 - geo.x0); }
  function py(v) { return geo.mid - v / state.Y * geo.hh; }

  function axes(ctx, col, c) {
    var dpr = geo.dpr;
    ctx.strokeStyle = rgba(col.fg, 0.5); ctx.lineWidth = dpr;
    ctx.beginPath(); ctx.moveTo(geo.x0, geo.mid); ctx.lineTo(geo.x1, geo.mid); ctx.stroke();
    [0, 1].forEach(function (t) {
      ctx.beginPath(); ctx.moveTo(px(t), geo.mid - 3 * dpr); ctx.lineTo(px(t), geo.mid + 3 * dpr); ctx.stroke();
    });
    var yb = geo.mid + geo.hh + 0.05 * geo.W;
    [0, 1].forEach(function (t) {  // unless c is about to cover them
      if (c === null || Math.abs(c - t) > 0.06) text(ctx, String(t), px(t), yb, 12 * dpr, col.muted);
    });
    if (c === null) return;
    ctx.setLineDash([4 * dpr, 3 * dpr]);
    ctx.beginPath(); ctx.moveTo(px(c), geo.mid - geo.hh); ctx.lineTo(px(c), geo.mid + geo.hh); ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, 'c', px(c), yb, 15 * dpr, col.fg, 'italic');
  }
  // the points [t, value] that trace the segments of one side: the midpoints of the cells, and
  // the two ends, so that the graph is smooth where f is and the cells do not show as steps
  function trace(segs) {
    var pts = [[segs[0][0], segs[0][2]]];
    segs.forEach(function (s) { pts.push([(s[0] + s[1]) / 2, s[2]]); });
    pts.push([segs[segs.length - 1][1], segs[segs.length - 1][2]]);
    return pts;
  }
  function sides(segs) {
    return [0, 1].map(function (side) { return segs.filter(function (s) { return s[3] === side; }); })
      .filter(function (part) { return part.length; });
  }
  // the graph of a step function, broken at c, where g and h jump
  function graph(ctx, segs, color, width, dash) {
    ctx.beginPath();
    sides(segs).forEach(function (part) {
      trace(part).forEach(function (p, i) {
        if (i) ctx.lineTo(px(p[0]), py(p[1])); else ctx.moveTo(px(p[0]), py(p[1]));
      });
    });
    ctx.setLineDash(dash || []);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.setLineDash([]);
  }
  function legend(ctx, col, items) {
    var dpr = geo.dpr, x = geo.x0 + 4 * dpr, y = 0.06 * geo.W;
    items.forEach(function (it) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18 * dpr, y);
      ctx.setLineDash(it[2] || []);
      ctx.strokeStyle = it[1]; ctx.lineWidth = 1.8 * dpr; ctx.stroke();
      ctx.setLineDash([]);
      text(ctx, it[0], x + 26 * dpr, y, 15 * dpr, col.fg, 'italic', 'left');
      x += 46 * dpr;
    });
  }

  // ---------------------------------------------------------------- left: f and c
  function drawF(col, K) {
    var r = fit(left), ctx = r.ctx, W = r.W, dpr = r.dpr;
    setGeo(W, dpr);
    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, W);
    var segs = segments(K, 1, 1);
    if (K.c !== null) {
      // the area under |f|, in two halves of ||f||_1 / 2 each
      sides(segs).forEach(function (part) {
        ctx.beginPath(); ctx.moveTo(px(part[0][0]), geo.mid);
        trace(part).forEach(function (p) { ctx.lineTo(px(p[0]), py(p[1])); });
        ctx.lineTo(px(part[part.length - 1][1]), geo.mid); ctx.closePath();
        ctx.fillStyle = rgba(part[0][3] ? col.h : col.g, 0.2); ctx.fill();
      });
    }
    axes(ctx, col, K.c);
    if (K.c === null) {
      ctx.beginPath(); ctx.moveTo(px(0), geo.mid); ctx.lineTo(px(1), geo.mid);
      ctx.strokeStyle = col.fg; ctx.lineWidth = 1.8 * dpr; ctx.stroke();
    } else graph(ctx, segs, col.fg, 1.8 * dpr);
    legend(ctx, col, [['f', col.fg]]);
  }

  // ---------------------------------------------------------------- right: g and h
  function drawGH(col, K) {
    var r = fit(right), ctx = r.ctx, W = r.W, dpr = r.dpr;
    setGeo(W, dpr);
    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, W);
    axes(ctx, col, K.c);
    var dash = [5 * dpr, 4 * dpr];
    if (K.c === null) {
      graph(ctx, [[0, 1, 0, 0]], rgba(col.fg, 0.6), 1.4 * dpr, dash);
      graph(ctx, segments(K, 1, 1), col.g, 1.8 * dpr);
      graph(ctx, segments(K, -1, -1), col.h, 1.8 * dpr);
    } else {
      graph(ctx, segments(K, 1, 1), rgba(col.fg, 0.6), 1.4 * dpr, dash);
      graph(ctx, segments(K, 1 + K.lambda, 1 - K.lambda), col.g, 1.8 * dpr);
      graph(ctx, segments(K, 1 - K.lambda, 1 + K.lambda), col.h, 1.8 * dpr);
    }
    legend(ctx, col, [['g', col.g], ['h', col.h], ['f', rgba(col.fg, 0.6), dash]]);
  }

  // ---------------------------------------------------------------- update
  function fmt(x) { return x === null ? '–' : x.toFixed(2); }
  var pending = false;
  function render() {
    pending = false;
    var col = palette(), K = construct();
    drawF(col, K);
    drawGH(col, K);
    out.norm.textContent = fmt(K.total);
    out.c.textContent = fmt(K.c);
    out.lambda.textContent = fmt(K.lambda);
    out.g.textContent = fmt(K.ng);
    out.h.textContent = fmt(K.nh);
    out.u.textContent = fmt(K.nu);
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(render); }
  }

  // ---------------------------------------------------------------- drawing f
  // while the pointer is down, the plot keeps its scale; f may leave the unit ball for a moment,
  // and is scaled back into it when the pointer is released
  function local(e) {
    var r = left.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
    return [clamp((x - geo.x0) / (geo.x1 - geo.x0), 0, 1), clamp((geo.mid - y) / geo.hh, -1, 1) * state.Y];
  }
  function paintTo(p) {
    var work = state.paint.f, q = state.paint.last || p;
    var i0 = Math.min(N - 1, Math.floor(q[0] * N)), i1 = Math.min(N - 1, Math.floor(p[0] * N));
    var step = i1 >= i0 ? 1 : -1;
    for (var i = i0; ; i += step) {
      work[i] = i0 === i1 ? p[1] : q[1] + (p[1] - q[1]) * (i - i0) / (i1 - i0);
      if (i === i1) break;
    }
    state.paint.last = p;
    var n = l1(work);
    if (n > 0) { for (i = 0; i < N; i++) state.shape[i] = work[i] / n; }
    state.r = n;
    schedule();
  }
  left.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    left.setPointerCapture(e.pointerId);
    var work = new Float64Array(N);
    for (var i = 0; i < N; i++) work[i] = state.r * state.shape[i];
    state.paint = { f: work, last: null };
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    paintTo(local(e));
  });
  left.addEventListener('pointermove', function (e) { if (state.paint) paintTo(local(e)); });
  function release() {
    if (!state.paint) return;
    state.paint = null;
    if (state.r > 0) setShape(state.shape);
    state.r = Math.min(state.r, 1);
    range.value = state.r;
    schedule();
  }
  left.addEventListener('pointerup', release);
  left.addEventListener('pointercancel', release);

  range.addEventListener('input', function () { state.r = parseFloat(range.value); schedule(); });
  buttons.forEach(function (b) { b.addEventListener('click', function () { choose(b.dataset.shape); }); });

  if (window.ResizeObserver) new ResizeObserver(schedule).observe(left);
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.fonts) document.fonts.ready.then(schedule);
  range.value = state.r;
  choose('wave');
})();
