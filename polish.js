/* Motion polish, in the spirit of Awwwards portfolio winners:
   - page transitions: a red panel wipes over the page between routes
   - headline reveals: page titles rise from behind a mask
   - scroll reveals: sections, cards and project rows fade up into view
   - a custom cursor that grows over links and says "View" over work
   - a thin red reading-progress line at the top

   Everything is progressive: without JavaScript the site renders as normal,
   touch devices keep their native behaviour, and visitors who ask for reduced
   motion get no transitions or reveals. */
(function () {
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  var css =
    // reading progress
    '#pl-progress{position:fixed;left:0;top:0;height:2px;width:100%;transform-origin:0 50%;transform:scaleX(0);background:#EF3340;z-index:9000;pointer-events:none}' +
    // page transition panel
    '#pl-wipe{position:fixed;inset:0;background:#EF3340;z-index:9500;transform:translateY(100%);pointer-events:none}' +
    '#pl-wipe.in{transition:transform .38s cubic-bezier(.7,0,.3,1);transform:none}' +
    '#pl-wipe.out{transition:transform .5s cubic-bezier(.7,0,.3,1);transform:translateY(-100%)}' +
    // scroll + headline reveals
    'html.pl .pl-rv{opacity:0;transform:translateY(28px);transition:opacity .8s cubic-bezier(.2,.8,.2,1),transform .8s cubic-bezier(.2,.8,.2,1)}' +
    'html.pl .pl-rv.pl-in{opacity:1;transform:none}' +
    'html.pl .pl-split{clip-path:inset(0 0 100% 0);transform:translateY(.35em);transition:clip-path 1s cubic-bezier(.2,.8,.2,1),transform 1s cubic-bezier(.2,.8,.2,1)}' +
    'html.pl .pl-split.pl-in{clip-path:inset(-10% -5% -15% -5%);transform:none}' +
    // hover depth on work
    '.project-image-link img,.product-hero img{transition:transform .8s cubic-bezier(.2,.8,.2,1)}' +
    '.project-image-link:hover img{transform:scale(1.035)}' +
    // custom cursor
    'html.pl-cur,html.pl-cur a,html.pl-cur button,html.pl-cur [role=button]{cursor:none}' +
    'html.pl-cur input,html.pl-cur textarea,html.pl-cur select,html.pl-cur iframe{cursor:auto}' +
    '#pl-dot,#pl-ring{position:fixed;left:0;top:0;pointer-events:none;z-index:9600;border-radius:50%}' +
    '#pl-dot{width:6px;height:6px;margin:-3px 0 0 -3px;background:#EF3340}' +
    '#pl-ring{width:34px;height:34px;margin:-17px 0 0 -17px;border:1px solid rgba(239,51,64,.6);display:grid;place-items:center;' +
      'transition:width .25s,height .25s,margin .25s,background .25s,border-color .25s,opacity .2s}' +
    '#pl-ring span{font:600 11px/1 Archivo,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#fff;opacity:0;transition:opacity .2s}' +
    '#pl-ring.link{width:54px;height:54px;margin:-27px 0 0 -27px;border-color:#EF3340}' +
    '#pl-ring.view{width:92px;height:92px;margin:-46px 0 0 -46px;background:#EF3340;border-color:#EF3340}' +
    '#pl-ring.view span{opacity:1}' +
    '#pl-ring.hide,#pl-dot.hide{opacity:0}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── reading progress ────────────────────────────────────────────────
  var bar = document.createElement('div'); bar.id = 'pl-progress';
  function progress() {
    var h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
  }
  addEventListener('scroll', progress, { passive: true });
  addEventListener('resize', progress);

  if (reduce) { document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(bar); }); return; }
  root.classList.add('pl');

  // ── scroll + headline reveals ───────────────────────────────────────
  var REVEAL = '.home-decision,.page-heading,.about-intro>*,.about-practice,.practice-grid>div,.principles li,.project-row,.product-brief,' +
    '.product-hero,.proto-intro,.proto-embed,.wr-card,.page-contact,.contact-intro>*,.case-section,section>h2';
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('pl-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });

  // The headline rises from behind a mask. It only adds a class: the app owns
  // the headline's text nodes, and rewriting them breaks its re-renders.
  function split(h) {
    if (h.dataset.pl) return; h.dataset.pl = '1';
    h.classList.add('pl-split');
    requestAnimationFrame(function () { requestAnimationFrame(function () { h.classList.add('pl-in'); }); });
  }

  function scan() {
    document.querySelectorAll('main h1:not([data-pl])').forEach(function (h) {
      // The home intro already reveals the headline it lands on.
      if (h.id === 'home-title' && (document.getElementById('logo-intro') || root.classList.contains('li-reveal'))) { h.dataset.pl = 'intro'; return; }
      split(h);
    });
    document.querySelectorAll(REVEAL).forEach(function (el) {
      if (el.classList.contains('pl-rv') || el.closest('#pl-wipe')) return;
      el.classList.add('pl-rv');
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight * .92 && r.bottom > 0) setTimeout(function () { el.classList.add('pl-in'); }, 60);
      else io.observe(el);
    });
    progress();
  }
  new MutationObserver(function () { clearTimeout(scan._t); scan._t = setTimeout(scan, 40); })
    .observe(document.documentElement, { childList: true, subtree: true });

  // ── page transitions ────────────────────────────────────────────────
  var wipe = document.createElement('div'); wipe.id = 'pl-wipe'; wipe.setAttribute('aria-hidden', 'true');
  var busy = false;
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#/"]');
    if (!a || busy || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var to = a.getAttribute('href');
    if (to === location.hash) return;
    e.preventDefault(); busy = true;
    wipe.className = ''; wipe.offsetWidth; wipe.className = 'in';
    setTimeout(function () {
      location.hash = to; scrollTo(0, 0);
      setTimeout(function () {
        wipe.className = 'out';
        setTimeout(function () { wipe.className = ''; busy = false; }, 520);
      }, 80);
    }, 400);
  }, true);

  // ── custom cursor ───────────────────────────────────────────────────
  function cursor() {
    if (!fine) return;
    root.classList.add('pl-cur');
    var dot = document.createElement('div'); dot.id = 'pl-dot';
    var ring = document.createElement('div'); ring.id = 'pl-ring'; ring.innerHTML = '<span>View</span>';
    document.body.appendChild(ring); document.body.appendChild(dot);
    var x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    addEventListener('mousemove', function (e) {
      x = e.clientX; y = e.clientY;
      dot.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      var t = e.target;
      var view = t.closest && t.closest('.project-image-link,.wr-card,.product-hero a,.wi-row');
      var link = !view && t.closest && t.closest('a,button,[role=button],select,label');
      ring.classList.toggle('view', !!view);
      ring.classList.toggle('link', !!link);
      ring.querySelector('span').textContent = view && view.classList.contains('wr-card') ? 'Read' : 'View';
      var hide = t.closest && t.closest('iframe,input,textarea');
      ring.classList.toggle('hide', !!hide); dot.classList.toggle('hide', !!hide);
    }, { passive: true });
    document.addEventListener('mouseleave', function () { ring.classList.add('hide'); dot.classList.add('hide'); });
    document.addEventListener('mouseenter', function () { ring.classList.remove('hide'); dot.classList.remove('hide'); });
    (function loop() {
      rx += (x - rx) * .18; ry += (y - ry) * .18;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      requestAnimationFrame(loop);
    })();
  }

  function start() {
    document.body.appendChild(bar); document.body.appendChild(wipe);
    cursor(); scan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
