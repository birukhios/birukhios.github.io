/* Writing: Biruk's Medium articles on the About page, from content/writing.json.
   The latest piece is featured large; the rest sit in a grid. Every card links
   to the article on Medium.

   The app renders pages after load and on every route change, so this
   watches for the empty <section class="writing"> and fills it in. */
(function () {
  var dataP = null;

  function data() {
    if (!dataP) dataP = fetch(new URL('content/writing.json', document.baseURI).href)
      .then(function (r) { return r.json(); })
      .catch(function () { return { items: [] }; });
    return dataP;
  }

  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function meta(a) { return esc(a.date) + (a.minutes ? ' · ' + a.minutes + ' min read' : ''); }

  function card(a, big) {
    return '<a class="wr-card' + (big ? ' wr-big' : '') + '" href="' + esc(a.url) + '" target="_blank" rel="noopener">' +
      (a.cover ? '<span class="wr-cover"><img src="' + esc(a.cover) + '" alt="" loading="lazy" decoding="async"></span>' : '') +
      '<span class="wr-body"><small>' + meta(a) + '</small><b>' + esc(a.title) + '</b>' +
      (big || a.excerpt ? '<span class="wr-ex">' + esc(a.excerpt) + '</span>' : '') +
      '<span class="wr-tags">' + (a.tags || []).map(function (t) { return '<i>' + esc(t) + '</i>'; }).join('') + '</span>' +
      '<span class="wr-go">Read on Medium ↗</span></span></a>';
  }

  function build(root) {
    root.dataset.ready = '1';
    data().then(function (d) {
      var L = d.items || [];
      if (!L.length) return;
      root.innerHTML =
        '<div class="wr-head"><h2>Writing<span class="red-period">.</span></h2>' +
        '<p>Notes on product, design and building for Ethiopia: fintech teardowns, payments, coffee and craft. ' + L.length + ' articles on Medium.</p></div>' +
        card(L[0], true) +
        '<div class="wr-grid">' + L.slice(1).map(function (a) { return card(a, false); }).join('') + '</div>' +
        '<a class="text-action wr-all" href="' + esc(d.profile) + '" target="_blank" rel="noopener">All writing on Medium <i class="ph ph-arrow-up-right" aria-hidden="true"></i></a>';
    });
  }

  function scan() {
    var root = document.querySelector('.writing:not([data-ready])');
    if (root) build(root);
  }
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', scan);
  setInterval(scan, 500);   // the app can swap the section in without a mutation we catch first
})();
