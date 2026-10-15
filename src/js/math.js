/* The formulas. index.html writes them in TeX, \( … \) inline and \[ … \] displayed, and this
   script typesets them with KaTeX (katex.min.js, loaded just before it) once the page has been
   read. Every formula becomes KaTeX's HTML, which keeps its TeX in an <annotation> element.

   Laying out the page with all its formulas takes the browser around half a second, so it is
   done in two steps: first the formulas of the title screen, which is then shown (class
   math-title), and then those of the paper, a little after each frame so that the title
   screen keeps moving meanwhile (class math-ready when they are all done; the whole page is
   ready about one second after it is opened). Until its class is set, each part stays hidden
   rather than showing TeX (07-math.css). The paper lies below the 2.5 screens of the title
   screen, so it is ready before it is reached; a page opened at an anchor (#…) or restored at
   some scroll position does both steps at once. */
(function () {
  'use strict';
  var root = document.documentElement;

  // the macros of the paper
  var MACROS = {
    '\\R': '\\mathbb{R}',
    '\\N': '\\mathbb{N}',
    '\\Q': '\\mathbb{Q}',
    '\\one': '\\mathbb{1}',
    '\\id': '\\operatorname{id}',
    '\\ext': '\\operatorname{ext}',
    '\\co': '\\mathop{\\overline{\\mathrm{co}}}\\nolimits',
    '\\rawco': '\\operatorname{co}',
    '\\supp': '\\operatorname{supp}',
    '\\bm': '\\boldsymbol{#1}'
  };
  var FORMULA = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;

  // the text nodes that contain formulas
  function find(where) {
    var nodes = [];
    if (!where || !window.katex) return nodes;  // without KaTeX the TeX stays as it is written
    var walker = document.createTreeWalker(where, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentNode.nodeName;
        if (parent === 'SCRIPT' || parent === 'STYLE') return NodeFilter.FILTER_REJECT;
        return /\\[([]/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  // typesets the formulas of nodes[from], nodes[from + 1], … for about budget ms, and returns
  // where it stopped. Each node is split into text and formulas; the formulas are rendered as
  // HTML and parsed all at once, which is faster than building them node by node.
  function typeset(nodes, from, budget) {
    var start = performance.now(), parts = [], html = [], to = from;
    while (to < nodes.length && (to === from || performance.now() - start < budget)) {
      var text = nodes[to++].nodeValue, pieces = [], last = 0, m;
      FORMULA.lastIndex = 0;
      while ((m = FORMULA.exec(text))) {
        if (m.index > last) pieces.push(text.slice(last, m.index));
        pieces.push(html.length);
        html.push(katex.renderToString(m[1] !== undefined ? m[1] : m[2], {
          displayMode: m[1] === undefined,
          macros: Object.assign({}, MACROS),
          output: 'htmlAndMathml',
          throwOnError: false,
          strict: 'ignore'
        }));
        last = FORMULA.lastIndex;
      }
      if (last < text.length) pieces.push(text.slice(last));
      parts.push(pieces);
    }
    var parsed = document.createElement('template');
    parsed.innerHTML = html.join('');
    var formulas = Array.prototype.slice.call(parsed.content.children);  // one element each

    // put them in place of the TeX
    parts.forEach(function (pieces, i) {
      var node = nodes[from + i], fragment = document.createDocumentFragment();
      pieces.forEach(function (piece) {
        fragment.appendChild(typeof piece === 'number' ? formulas[piece] : document.createTextNode(piece));
      });
      node.parentNode.replaceChild(fragment, node);
    });
    return to;
  }

  // typesets everything in where, at once or in pieces of 30 ms after each frame (so that the
  // title screen keeps moving meanwhile), and then sets the class done
  function step(where, done, gradually) {
    var nodes = find(where), i = 0;
    function later() { requestAnimationFrame(function () { setTimeout(next, 0); }); }
    function next() {
      try {
        i = typeset(nodes, i, gradually ? 30 : Infinity);
      } catch (e) {
        i = nodes.length;  // give up, and show the rest as TeX
        throw e;
      } finally {
        if (i < nodes.length) later(); else root.classList.add(done);
      }
    }
    if (gradually) later(); else next();
  }

  var navigation = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
  var atTop = !location.hash && (!navigation || navigation.type === 'navigate');
  step(document.querySelector('.title-block'), 'math-title', false);
  step(document.body, 'math-ready', atTop);
})();
