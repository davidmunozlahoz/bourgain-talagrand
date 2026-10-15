/* Interactive figure: extreme points of convex sets in the plane and in space.
   Click a point x of C: either x is extreme, or it is shown as the midpoint of two
   distinct points y, z of C (the longest such segment through x).
   Colors are read from the page's CSS variables, so the figure follows the theme. */
(function () {
  'use strict';
  var fig = document.getElementById('applet-extreme');
  if (!fig) return;
  var canvas = fig.querySelector('.applet-stage');
  var buttons = Array.prototype.slice.call(fig.querySelectorAll('[data-shape]'));
  var statuses = Array.prototype.slice.call(fig.querySelectorAll('[data-status]'));

  var E = 1e-7;          // membership tolerance: points of the boundary belong to C
  // run f with no tolerance, so that a picked point lies in C, not just outside its boundary
  function strictly(f) { var e = E; E = 0; try { return f(); } finally { E = e; } }
  var EXTREME = 2e-3;    // half-length below which no segment through x fits in C
  var TAU = 2 * Math.PI;

  // ---------------------------------------------------------------- vectors
  function add(a, b, t) { return a.map(function (v, i) { return v + (t === undefined ? 1 : t) * b[i]; }); }
  function sub(a, b) { return a.map(function (v, i) { return v - b[i]; }); }
  function dot(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  function norm(a) { return Math.sqrt(dot(a, a)); }
  function scale(a, t) { return a.map(function (v) { return v * t; }); }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function unit(a) { return scale(a, 1 / norm(a)); }

  // ---------------------------------------------------------------- sets in the plane
  // boundary pieces in counterclockwise order: segments and circular arcs (angles in radians)
  function seg(a, b) { return { seg: [a, b] }; }
  function arc(c, r, a0, a1) { return { arc: { c: c, r: r, a0: a0, a1: a1 } }; }
  function convexPolygon(V) {
    return function (p) {
      for (var i = 0; i < V.length; i++) {
        var a = V[i], b = V[(i + 1) % V.length], e = sub(b, a);
        if (e[0] * (p[1] - a[1]) - e[1] * (p[0] - a[0]) < -E * norm(e)) return false;
      }
      return true;
    };
  }
  function polygonSet(V) {
    return {
      inside: convexPolygon(V), directions: function (x) { return planeDirections(this, x); },
      pieces: V.map(function (a, i) { return seg(a, V[(i + 1) % V.length]); }),
      dots: V, arcs: []
    };
  }
  var SQ = 0.9, TRI = [[-1.0, -0.8], [1.05, -0.62], [-0.12, 1.0]];
  var ST = { a: 0.55, r: 0.6 }, HD = { c: [0, -0.42], r: 1.05 };
  var stadiumLeft = arc([-ST.a, 0], ST.r, Math.PI / 2, 3 * Math.PI / 2);
  var stadiumRight = arc([ST.a, 0], ST.r, -Math.PI / 2, Math.PI / 2);
  var halfArc = arc(HD.c, HD.r, 0, Math.PI);
  var circle = arc([0, 0], 0.95, 0, TAU);
  var PLANE = {
    square: polygonSet([[-SQ, -SQ], [SQ, -SQ], [SQ, SQ], [-SQ, SQ]]),
    triangle: polygonSet(TRI),
    disk: {
      inside: function (p) { return norm(p) <= 0.95 + E; },
      directions: function (x) { return planeDirections(this, x); },
      pieces: [circle], dots: [], arcs: [circle]
    },
    stadium: {
      inside: function (p) {
        var t = Math.max(-ST.a, Math.min(ST.a, p[0]));
        return Math.hypot(p[0] - t, p[1]) <= ST.r + E;
      },
      directions: function (x) { return planeDirections(this, x); },
      pieces: [seg([ST.a, ST.r], [-ST.a, ST.r]), stadiumLeft, seg([-ST.a, -ST.r], [ST.a, -ST.r]), stadiumRight],
      dots: [], arcs: [stadiumLeft, stadiumRight]
    },
    'half-disk': {
      inside: function (p) { return p[1] >= HD.c[1] - E && norm(sub(p, HD.c)) <= HD.r + E; },
      directions: function (x) { return planeDirections(this, x); },
      pieces: [halfArc, seg([-HD.r, HD.c[1]], [HD.r, HD.c[1]])],
      dots: [], arcs: [halfArc]
    }
  };
  PLANE.square.start = [0.3, 0.2]; PLANE.triangle.start = [0.05, -0.1]; PLANE.disk.start = [0.3, 0.25];
  PLANE.stadium.start = [0.15, 0.2]; PLANE['half-disk'].start = [0.2, 0.05];

  // the flat directions of C at x: interior points can move anywhere (sampled), a point of
  // exactly one segment moves along it, and vertices and points of arcs cannot move at all
  function planeDirections(set, x) {
    var on = set.pieces.filter(function (pc) { return norm(sub(project(pc, x), x)) < 1e-6; });
    if (on.length === 0) return DIRS2;
    if (on.length === 1 && on[0].seg) return [unit(sub(on[0].seg[1], on[0].seg[0]))];
    return [];
  }
  // a traced curve: resampled, then its convex hull (counterclockwise), with nearly straight
  // stretches merged so that hand-drawn sides become single edges
  function resample(path, count) {
    var len = [0];
    for (var i = 1; i < path.length; i++) len.push(len[i - 1] + norm(sub(path[i], path[i - 1])));
    var total = len[len.length - 1], out = [], j = 0;
    for (var k = 0; k <= count; k++) {
      var d = total * k / count;
      while (j < len.length - 2 && len[j + 1] < d) j++;
      var t = (d - len[j]) / Math.max(len[j + 1] - len[j], 1e-12);
      out.push(add(path[j], sub(path[j + 1], path[j]), t));
    }
    return out;
  }
  function hull(P) {
    P = P.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function turn(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lower = [], upper = [];
    P.forEach(function (p) {
      while (lower.length > 1 && turn(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    });
    P.slice().reverse().forEach(function (p) {
      while (upper.length > 1 && turn(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    });
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }
  // Douglas-Peucker on the closed hull: keep only the corners needed to stay within tol of it,
  // so wobbly sides become single edges and curved stretches get evenly spaced corners
  function simplify(H, tol) {
    function chain(P) {
      var a = P[0], b = P[P.length - 1], e = sub(b, a), l = norm(e) || 1, far = 0, k = 0;
      for (var i = 1; i < P.length - 1; i++) {
        var d = Math.abs(e[0] * (P[i][1] - a[1]) - e[1] * (P[i][0] - a[0])) / l;
        if (d > far) { far = d; k = i; }
      }
      if (far <= tol) return [a];
      return chain(P.slice(0, k + 1)).concat(chain(P.slice(k)));
    }
    var far = 0, k = 0;  // split the closed curve at the two corners farthest apart
    H.forEach(function (p, i) { var d = norm(sub(p, H[0])); if (d > far) { far = d; k = i; } });
    var out = chain(H.slice(0, k + 1)).concat(chain(H.slice(k).concat([H[0]])));
    return out.filter(function (p, i) { return i === 0 || norm(sub(p, out[i - 1])) > 0.05; });
  }
  function area(P) {
    var s2 = 0;
    for (var i = 0; i < P.length; i++) { var p = P[i], q = P[(i + 1) % P.length]; s2 += p[0] * q[1] - q[0] * p[1]; }
    return Math.abs(s2) / 2;
  }
  function arcPoint(A, t) { return [A.c[0] + A.r * Math.cos(t), A.c[1] + A.r * Math.sin(t)]; }
  // nearest point of a boundary piece
  function project(piece, p) {
    if (piece.seg) {
      var a = piece.seg[0], e = sub(piece.seg[1], a);
      var t = Math.max(0, Math.min(1, dot(sub(p, a), e) / dot(e, e)));
      return add(a, e, t);
    }
    var A = piece.arc, ang = Math.atan2(p[1] - A.c[1], p[0] - A.c[0]);
    while (ang < A.a0) ang += TAU;
    while (ang > A.a0 + TAU) ang -= TAU;
    if (ang > A.a1) {  // outside the arc: the nearer endpoint
      var d0 = norm(sub(p, arcPoint(A, A.a0))), d1 = norm(sub(p, arcPoint(A, A.a1)));
      ang = d0 < d1 ? A.a0 : A.a1;
    }
    return arcPoint(A, ang);
  }

  // ---------------------------------------------------------------- sets in space
  // a mesh with outward normals (all sets contain the origin, which orients the faces)
  function mesh(V, F) {
    var faces = F.map(function (f) {
      var c = [0, 0, 0];
      f.forEach(function (i) { c = add(c, V[i]); });
      c = scale(c, 1 / f.length);
      var n = unit(cross(sub(V[f[1]], V[f[0]]), sub(V[f[2]], V[f[0]])));
      if (dot(n, c) < 0) n = scale(n, -1);
      return { idx: f, n: n };
    });
    var edges = {}, list = [];
    faces.forEach(function (face, k) {
      face.idx.forEach(function (i, j) {
        var a = i, b = face.idx[(j + 1) % face.idx.length], key = Math.min(a, b) + ',' + Math.max(a, b);
        if (!edges[key]) { edges[key] = { a: a, b: b, faces: [] }; list.push(edges[key]); }
        edges[key].faces.push(k);
      });
    });
    list.forEach(function (e) {  // creases: sharp edges, drawn even when not on the outline
      e.crease = e.faces.length < 2 || dot(faces[e.faces[0]].n, faces[e.faces[1]].n) < Math.cos(25 * Math.PI / 180);
    });
    return { V: V, faces: faces, edges: list };
  }
  // unit vectors in the plane orthogonal to n
  function inPlane(n, count) {
    var a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = unit(cross(n, a)), e2 = cross(n, e1), out = [];
    for (var k = 0; k < count; k++) {
      var t = Math.PI * k / count;
      out.push(add(scale(e1, Math.cos(t)), e2, Math.sin(t)));
    }
    return out;
  }
  var ON = 1e-6;  // a point is on a piece of the boundary if it is this close to it
  function polytope(V, F) {
    var m = mesh(V, F);
    var planes = m.faces.map(function (f) { return { n: f.n, d: dot(f.n, V[f.idx[0]]) }; });
    return {
      mesh: m, dots: V, rings: [],
      directions: function (x) {  // inside a face, along an edge, or nothing at a vertex
        var on = planes.filter(function (h) { return Math.abs(dot(h.n, x) - h.d) < ON; });
        if (on.length === 0) return DIRS3;
        if (on.length === 1) return inPlane(on[0].n, 90);
        if (on.length === 2) return [unit(cross(on[0].n, on[1].n))];
        return [];
      },
      inside: function (p) { return planes.every(function (h) { return dot(h.n, p) <= h.d + E; }); }
    };
  }
  function ringPts(r, z, n) {
    var pts = [];
    for (var k = 0; k < n; k++) pts.push([r * Math.cos(TAU * k / n), r * Math.sin(TAU * k / n), z]);
    return pts;
  }
  var C = 0.7, CUBE = [];
  for (var i = 0; i < 8; i++) CUBE.push([i & 1 ? C : -C, i & 2 ? C : -C, i & 4 ? C : -C]);
  var T = 0.62, TET = [[T, T, T], [T, -T, -T], [-T, T, -T], [-T, -T, T]];
  var CY = { r: 0.72, h: 0.72 }, CO = { r: 0.85, top: 0.9, bottom: -0.65 }, N = 64;

  function cylinder() {
    var V = ringPts(CY.r, -CY.h, N).concat(ringPts(CY.r, CY.h, N)), F = [], bottom = [], top = [];
    for (var k = 0; k < N; k++) {
      F.push([k, (k + 1) % N, N + (k + 1) % N, N + k]);
      bottom.push(k); top.push(N + k);
    }
    F.push(bottom, top);
    return {
      mesh: mesh(V, F), dots: [], rings: [{ r: CY.r, z: -CY.h }, { r: CY.r, z: CY.h }],
      directions: function (x) {  // vertical on the side, horizontal on the caps, none on the rims
        var side = Math.abs(Math.hypot(x[0], x[1]) - CY.r) < ON, cap = Math.abs(Math.abs(x[2]) - CY.h) < ON;
        if (side && cap) return [];
        if (side) return [[0, 0, 1]];
        if (cap) return inPlane([0, 0, 1], 90);
        return DIRS3;
      },
      inside: function (p) { return Math.hypot(p[0], p[1]) <= CY.r + E && Math.abs(p[2]) <= CY.h + E; }
    };
  }
  function cone() {
    var V = ringPts(CO.r, CO.bottom, N).concat([[0, 0, CO.top]]), F = [], base = [];
    for (var k = 0; k < N; k++) { F.push([k, (k + 1) % N, N]); base.push(k); }
    F.push(base);
    var H = CO.top - CO.bottom;
    return {
      mesh: mesh(V, F), dots: [[0, 0, CO.top]], rings: [{ r: CO.r, z: CO.bottom }],
      directions: function (x) {  // towards the apex on the side, horizontal on the base
        var apex = [0, 0, CO.top];
        if (norm(sub(x, apex)) < ON) return [];
        var side = Math.abs(Math.hypot(x[0], x[1]) - CO.r * (CO.top - x[2]) / H) < ON;
        var base = Math.abs(x[2] - CO.bottom) < ON;
        if (side && base) return [];
        if (side) return [unit(sub(apex, x))];
        if (base) return inPlane([0, 0, 1], 90);
        return DIRS3;
      },
      inside: function (p) {
        return p[2] >= CO.bottom - E && p[2] <= CO.top + E &&
               Math.hypot(p[0], p[1]) <= CO.r * (CO.top - p[2]) / H + E;
      }
    };
  }
  var SPACE = {
    cube: polytope(CUBE, [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]]),
    tetrahedron: polytope(TET, [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]),
    cylinder: cylinder(), cone: cone()
  };
  // first points, on parts of the boundary that face the initial view
  var toward = unit([0.564, -0.825]);  // horizontal direction of the initial viewer
  SPACE.cube.start = [C, 0.15, -0.1];
  SPACE.tetrahedron.start = add(add(scale(TET[0], 0.5), TET[1], 0.3), TET[3], 0.2);
  SPACE.cylinder.start = [CY.r * toward[0], CY.r * toward[1], 0.15];
  SPACE.cone.start = (function () {
    var z = 0.25, r = CO.r * (CO.top - z) / (CO.top - CO.bottom);
    return [r * toward[0], r * toward[1], z];
  })();


  // ---------------------------------------------------------------- the midpoint search
  // largest t in [0, 3] with x + t d in C (an interval, since C is convex and x is in C)
  function reach(set, x, d) {
    if (set.inside(add(x, d, 3))) return 3;
    var lo = 0, hi = 3;
    for (var k = 0; k < 42; k++) {
      var mid = (lo + hi) / 2;
      if (set.inside(add(x, d, mid))) lo = mid; else hi = mid;
    }
    return lo;
  }
  var DIRS2 = [], DIRS3 = [];
  for (var a = 0; a < 180; a++) DIRS2.push([Math.cos(Math.PI * a / 180), Math.sin(Math.PI * a / 180)]);
  for (var q = 0; q < 500; q++) {  // a Fibonacci half-sphere
    var zq = 1 - (q + 0.5) / 500, rq = Math.sqrt(1 - zq * zq), th = q * Math.PI * (3 - Math.sqrt(5));
    DIRS3.push([rq * Math.cos(th), rq * Math.sin(th), zq]);
  }
  // the longest segment [y, z] in C with midpoint x
  function midpoint(set, x) {
    var best = { h: 0, d: null };
    set.directions(x).forEach(function (d) {
      var h = Math.min(reach(set, x, d), reach(set, x, scale(d, -1)));
      if (h > best.h) best = { h: h, d: d };
    });
    if (best.h < EXTREME) return null;
    return { y: add(x, best.d, best.h), z: add(x, best.d, -best.h) };
  }

  // ---------------------------------------------------------------- state
  var state = { name: 'square', x: null, seg: null, az: -0.6, el: 0.45, drawing: false, path: null, trace: null };
  function current() { return PLANE[state.name] || SPACE[state.name]; }
  function is3d() { return !!SPACE[state.name] && !state.drawing; }
  function choose(x) {
    state.x = x;
    state.seg = x ? midpoint(current(), x) : null;
    statuses.forEach(function (s) {
      s.hidden = s.dataset.status !== (state.drawing ? 'draw' : !x ? 'none' : state.seg ? 'mid' : 'extreme');
    });
    schedule();
  }

  // ---------------------------------------------------------------- drawing helpers
  function palette() {
    var cs = getComputedStyle(document.documentElement);
    function v(name) { return cs.getPropertyValue(name).trim(); }
    return { fg: v('--fg'), bg: v('--bg'), rule: v('--rule'), accent: v('--ref') };
  }
  function rgba(hex, al) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + al + ')';
  }
  // the opaque color a of the way from hex color c0 to hex color c1
  function mix(c0, c1, a) {
    var p = parseInt(c0.slice(1), 16), q = parseInt(c1.slice(1), 16), out = [];
    for (var sh = 16; sh >= 0; sh -= 8) out.push(Math.round(((p >> sh) & 255) * (1 - a) + ((q >> sh) & 255) * a));
    return 'rgb(' + out.join(',') + ')';
  }
  var view = { W: 0, H: 0, dpr: 1, s: 1 };
  function fit() {
    var dpr = window.devicePixelRatio || 1;
    var W = Math.max(1, Math.round(canvas.clientWidth * dpr)), H = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    view = { W: W, H: H, dpr: dpr, s: H / (is3d() ? 2.75 : 2.5) };
    return canvas.getContext('2d');
  }
  function line(ctx, pts, color, width, dash) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.setLineDash(dash || []);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function dot2(ctx, p, r, fill, stroke) {
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.3 * view.dpr; ctx.stroke(); }
  }
  function label(ctx, text, p, away, color) {
    ctx.font = 'italic ' + Math.round(15 * view.dpr) + 'px KaTeX_Math, serif';
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, p[0] + away[0] * 13 * view.dpr, p[1] + away[1] * 13 * view.dpr);
  }
  // the segment y--z with its midpoint x, labelled on the side away from the segment
  function drawSegment(ctx, X, x, s, col, hidden) {
    var px = X(x);
    if (s) {
      var py = X(s.y), pz = X(s.z), e = sub(py, pz), l = norm(e) || 1, perp = [-e[1] / l, e[0] / l];
      line(ctx, [py, pz], col.fg, 1.5 * view.dpr, hidden ? [4 * view.dpr, 3 * view.dpr] : null);
      dot2(ctx, py, 3.5 * view.dpr, col.bg, col.fg);
      dot2(ctx, pz, 3.5 * view.dpr, col.bg, col.fg);
      label(ctx, 'y', py, perp, col.fg);
      label(ctx, 'z', pz, perp, col.fg);
      label(ctx, 'x', px, scale(perp, -1), col.fg);
    } else {
      label(ctx, 'x', px, [0.75, -0.75], col.fg);
    }
    dot2(ctx, px, 4 * view.dpr, col.fg, null);
  }

  // ---------------------------------------------------------------- the plane
  function X2(p) { return [view.W / 2 + p[0] * view.s, view.H / 2 - p[1] * view.s]; }
  function W2(sx, sy) { return [(sx - view.W / 2) / view.s, (view.H / 2 - sy) / view.s]; }
  function tracePieces(ctx, pieces) {
    ctx.beginPath();
    pieces.forEach(function (pc, k) {
      if (pc.seg) {
        var a = X2(pc.seg[0]), b = X2(pc.seg[1]);
        if (k === 0) ctx.moveTo(a[0], a[1]); else ctx.lineTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      } else {
        var A = pc.arc, c = X2(A.c);
        ctx.arc(c[0], c[1], A.r * view.s, -A.a0, -A.a1, true);
      }
    });
    ctx.closePath();
  }
  function draw2d(ctx, col) {
    var set = PLANE[state.name], dpr = view.dpr;
    // axes
    line(ctx, [X2([-3, 0]), X2([3, 0])], col.rule, dpr);
    line(ctx, [X2([0, -3]), X2([0, 3])], col.rule, dpr);
    if (state.drawing) {
      if (state.path && state.path.length > 1) line(ctx, state.path.map(X2), col.fg, 1.3 * dpr, [3 * dpr, 3 * dpr]);
      return;
    }
    if (set.trace) line(ctx, set.trace.map(X2), rgba(col.fg, 0.35), dpr, [3 * dpr, 3 * dpr]);
    tracePieces(ctx, set.pieces);
    ctx.fillStyle = rgba(col.fg, 0.06); ctx.fill();
    ctx.strokeStyle = col.fg; ctx.lineWidth = 1.3 * dpr; ctx.stroke();
    // the extreme points
    set.arcs.forEach(function (A) {
      var c = X2(A.arc.c);
      ctx.beginPath(); ctx.arc(c[0], c[1], A.arc.r * view.s, -A.arc.a0, -A.arc.a1, true);
      ctx.strokeStyle = col.accent; ctx.lineWidth = 3.5 * dpr; ctx.lineCap = 'round'; ctx.stroke();
    });
    set.dots.forEach(function (p) { dot2(ctx, X2(p), 4.5 * dpr, col.accent, null); });
    if (state.x) drawSegment(ctx, X2, state.x, state.seg, col, false);
  }
  // the point of C under the pointer, snapped to extreme points and to the boundary
  function pick2d(sx, sy) {
    var set = PLANE[state.name], p = W2(sx, sy), px = 10 * view.dpr / view.s;
    for (var k = 0; k < set.dots.length; k++) if (norm(sub(set.dots[k], p)) < px) return set.dots[k];
    var best = null, bd = Infinity;
    set.pieces.forEach(function (pc) {
      var q = project(pc, p), d = norm(sub(q, p));
      if (d < bd) { bd = d; best = q; }
    });
    if (bd < 0.8 * px) return best;
    return set.inside(p) ? p : null;
  }

  // ---------------------------------------------------------------- space
  function axes() {
    var ca = Math.cos(state.az), sa = Math.sin(state.az), ce = Math.cos(state.el), se = Math.sin(state.el);
    return { u: [ca, -sa, 0], v: [sa * se, ca * se, ce], c: [-sa * ce, -ca * ce, se] };
  }
  function X3(p) {
    var ax = axes();
    return [view.W / 2 + dot(p, ax.u) * view.s, view.H / 2 - dot(p, ax.v) * view.s];
  }
  // a point of the boundary is visible if moving towards the viewer leaves C
  function visible(set, p, c) { return !set.inside(add(p, c, 0.02)); }
  function draw3d(ctx, col) {
    var set = SPACE[state.name], m = set.mesh, ax = axes(), dpr = view.dpr;
    var light = unit(add(add(scale(ax.c, 0.8), ax.v, 0.55), ax.u, -0.35));
    var front = m.faces.map(function (f) { return dot(f.n, ax.c) > 1e-9; });
    var P = m.V.map(X3);
    // the visible faces (C is convex, so they never overlap), in opaque colors so that the
    // seams between the pieces of curved surfaces do not show
    var tint = col.fg;
    m.faces.forEach(function (f, k) {
      if (!front[k]) return;
      ctx.beginPath();
      f.idx.forEach(function (i, j) { if (j) ctx.lineTo(P[i][0], P[i][1]); else ctx.moveTo(P[i][0], P[i][1]); });
      ctx.closePath();
      var shade = mix(col.bg, tint, 0.05 + 0.16 * Math.max(0, dot(f.n, light)));
      ctx.fillStyle = shade; ctx.fill();
      ctx.strokeStyle = shade; ctx.lineWidth = 0.6 * dpr; ctx.stroke();  // hides the seams
    });
    // hidden creases, dashed, then visible creases and the outline
    m.edges.forEach(function (e) {
      var anyFront = e.faces.some(function (k) { return front[k]; });
      if (e.crease && !anyFront) line(ctx, [P[e.a], P[e.b]], rgba(col.fg, 0.35), dpr, [4 * dpr, 3 * dpr]);
    });
    m.edges.forEach(function (e) {
      var n = e.faces.filter(function (k) { return front[k]; }).length;
      var outline = n === 1 && e.faces.length === 2;
      if ((e.crease && n > 0) || outline) line(ctx, [P[e.a], P[e.b]], col.fg, 1.2 * dpr);
    });
    // the extreme points: rims and vertices, solid when visible
    set.rings.forEach(function (R) {
      var pts = ringPts(R.r, R.z, 180);
      pts.forEach(function (p, k) {
        var q = pts[(k + 1) % pts.length], vis = visible(set, scale(add(p, q), 0.5), ax.c);
        line(ctx, [X3(p), X3(q)], vis ? col.accent : rgba(col.accent, 0.45), (vis ? 3.5 : 1.5) * dpr, vis ? null : [3 * dpr, 4 * dpr]);
      });
    });
    set.dots.forEach(function (p) {
      if (visible(set, p, ax.c)) dot2(ctx, X3(p), 4.5 * dpr, col.accent, null);
      else dot2(ctx, X3(p), 3.5 * dpr, col.bg, rgba(col.accent, 0.6));
    });
    if (state.x) drawSegment(ctx, X3, state.x, state.seg, col, !visible(set, state.x, ax.c));
  }
  function pick3d(sx, sy) {
    var set = SPACE[state.name], ax = axes(), r = 10 * view.dpr;
    function near(p) { var q = X3(p); return Math.hypot(q[0] - sx, q[1] - sy); }
    for (var k = 0; k < set.dots.length; k++)
      if (visible(set, set.dots[k], ax.c) && near(set.dots[k]) < r) return set.dots[k];
    var best = null, bd = 0.8 * r;
    set.rings.forEach(function (R) {
      ringPts(R.r, R.z, 720).forEach(function (p) {
        var d = near(p);
        if (d < bd && visible(set, p, ax.c)) { bd = d; best = p; }
      });
    });
    if (best) return best;
    // near a visible edge of a polytope: the nearest point of that edge
    var P = set.mesh.V.map(X3), edge = null, ed = 0.8 * r;
    if (set.dots.length) set.mesh.edges.forEach(function (e) {
      if (!e.faces.some(function (k) { return dot(set.mesh.faces[k].n, ax.c) > 1e-9; })) return;
      var a = P[e.a], b = P[e.b], ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub([sx, sy], a), ab) / dot(ab, ab)));
      var d = norm(sub([sx, sy], add(a, ab, t)));
      if (d < ed) { ed = d; edge = add(set.mesh.V[e.a], sub(set.mesh.V[e.b], set.mesh.V[e.a]), t); }
    });
    if (edge) return edge;
    // otherwise, the first point of C along the line of sight
    var o = add(scale(ax.u, (sx - view.W / 2) / view.s), ax.v, (view.H / 2 - sy) / view.s);
    return strictly(function () {
      for (var t = 3; t > -3; t -= 0.01) {
        if (set.inside(add(o, ax.c, t))) {
          var lo = t, hi = t + 0.01;
          for (var j = 0; j < 50; j++) {
            var mid = (lo + hi) / 2;
            if (set.inside(add(o, ax.c, mid))) lo = mid; else hi = mid;
          }
          return add(o, ax.c, lo);
        }
      }
      return null;
    });
  }

  // ---------------------------------------------------------------- update
  var pending = false;
  function render() {
    pending = false;
    var ctx = fit(), col = palette();
    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, view.W, view.H);
    if (is3d()) draw3d(ctx, col); else draw2d(ctx, col);
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(render); }
  }

  function setShape(name) {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.shape === name)); });
    state.drawing = name === 'draw';
    state.path = null;
    if (!state.drawing) state.name = name;
    canvas.classList.toggle('is-3d', is3d() && !state.drawing);
    choose(state.drawing ? null : current().start);
  }
  // the closed convex hull of a traced curve becomes the set C
  function finishDrawing(path) {
    if (path.length < 8) return;
    var H = simplify(hull(resample(path, 240)), 0.015);
    if (H.length < 3 || area(H) < 0.03) return;
    var set = polygonSet(H), c = [0, 0];
    H.forEach(function (p) { c = add(c, p, 1 / H.length); });
    set.trace = path;
    set.start = add(c, sub(H[0], c), 0.4);
    PLANE.drawn = set;
    state.drawing = false;
    state.name = 'drawn';
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    canvas.classList.remove('is-3d');
    choose(set.start);
  }
  buttons.forEach(function (b) { b.addEventListener('click', function () { setShape(b.dataset.shape); }); });

  // ---------------------------------------------------------------- pointer: pick (and drag) x; turn solids
  function local(e) {
    var r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * view.dpr, (e.clientY - r.top) * view.dpr];
  }
  var press = null;
  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    press = { start: [e.clientX, e.clientY], last: [e.clientX, e.clientY], moved: false };
    if (state.drawing) { var q = local(e); state.path = [W2(q[0], q[1])]; schedule(); return; }
    if (!is3d()) { var p = local(e), x = pick2d(p[0], p[1]); if (x) choose(x); }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!press) return;
    if (Math.hypot(e.clientX - press.start[0], e.clientY - press.start[1]) > 4) press.moved = true;
    if (state.drawing) {
      var q = local(e), w = W2(q[0], q[1]), lim = view.W / 2 / view.s;
      if (state.path) state.path.push([Math.max(-lim, Math.min(lim, w[0])), Math.max(-1.25, Math.min(1.25, w[1]))]);
      schedule();
    } else if (is3d()) {
      if (press.moved) {
        state.az += (e.clientX - press.last[0]) * 0.01;
        state.el = Math.max(-1.4, Math.min(1.4, state.el + (e.clientY - press.last[1]) * 0.01));
        schedule();
      }
    } else {
      var p = local(e), x = pick2d(p[0], p[1]);
      if (x) choose(x);
    }
    press.last = [e.clientX, e.clientY];
  });
  canvas.addEventListener('pointerup', function (e) {
    if (state.drawing) {
      if (state.path) finishDrawing(state.path);
      state.path = null;
      schedule();
    } else if (press && !press.moved && is3d()) { var p = local(e), x = pick3d(p[0], p[1]); if (x) choose(x); }
    press = null;
  });

  // ---------------------------------------------------------------- redraw on resize, theme and fonts
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(canvas);
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.fonts) document.fonts.ready.then(schedule);
  fit();
  setShape('square');
})();
