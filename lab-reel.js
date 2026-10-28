/* Lab showreel: a full-width slideshow of every Lab image at the top of the
   Lab page, built from content/mood.json and content/branding.json so it
   always matches the moodboard below. Auto-advances, pauses on hover or
   focus, and never auto-plays for visitors who ask for reduced motion.

   The app renders pages after load and on every route change, so this
   watches for the empty <section class="lab-reel"> and fills it in. */
(function () {
  var SLIDE_MS = 3200;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var itemsP = null;

  function items() {
    if (itemsP) return itemsP;
    var base = new URL('content/', document.baseURI).href;
    var get = function (f) {
      return fetch(base + f + '.json').then(function (r) { return r.json(); })
        .then(function (d) { return Array.isArray(d) ? d : (d && d.items) || []; })
        .catch(function () { return []; });
    };
    itemsP = Promise.all([get('mood'), get('branding')]).then(function (r) {
      return r[0].concat(r[1].map(function (b) { return { src: b.src, hq: b.hq, device: 'brand', title: b.title || 'Sorenie identity', note: b.note }; }));
    });
    return itemsP;
  }

  // Each piece sits in the device it was made for: website and app screens in
  // a desktop browser, mobile screens in phones; finished mockups and brand
  // boards are shown as they are.
  function frame(it, lazy) {
    var L = lazy ? ' loading="lazy"' : '';
    var host = (it.title || '').split(/\s+[—-]\s+/)[0].toLowerCase().replace(/[^a-z0-9]+/g, '') || 'site';
    if (it.device === 'desktop') {
      return '<div class="lr-desk"><div class="lr-chrome"><i></i><i></i><i></i><span>' + esc(host) + '.com</span></div>' +
        '<div class="lr-screen"><img src="' + esc(it.hq || it.src) + '" alt="' + esc(it.title) + '"' + L + ' decoding="async"></div></div><div class="lr-base"></div>';
    }
    if (it.device === 'phone' && it.screens) {
      return '<div class="lr-phones">' + it.screens.map(function (s, k) {
        return '<div class="lr-phone"><div class="lr-notch"></div><img src="' + esc(s) + '" alt="' + (k ? '' : esc(it.title)) + '"' + L + ' decoding="async"></div>';
      }).join('') + '</div>';
    }
    return '<img class="lr-flat" src="' + esc(it.hq || it.src) + '" alt="' + esc(it.title) + '"' + L + ' decoding="async">';
  }

  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function build(root) {
    root.dataset.ready = '1';
    items().then(function (list) {
      if (!list.length) return;
      root.innerHTML =
        '<div class="lr-stage" tabindex="0" aria-roledescription="carousel" aria-label="Lab showreel">' +
          list.map(function (it, i) {
            return '<figure class="lr-slide lr-is-' + (it.device || 'mockup') + '" aria-hidden="true"><div class="lr-art">' + frame(it, i > 1) + '</div>' +
              '<figcaption><span></span><b>' + esc(it.title) + '</b><small>' + String(i + 1).padStart(2, '0') + ' / ' + list.length + '</small></figcaption></figure>';
          }).join('') +
          '<button class="lr-btn lr-prev" aria-label="Previous image">‹</button><button class="lr-btn lr-next" aria-label="Next image">›</button>' +
          '<div class="lr-bar"><i></i></div>' +
        '</div>' +
        '<p>Showreel · every piece in the Lab, ' + list.length + ' images. Hover to pause, use the arrows to browse.</p>';

      var stage = root.querySelector('.lr-stage'), slides = root.querySelectorAll('.lr-slide'), bar = root.querySelector('.lr-bar i');
      var at = 0, timer = null, paused = reduce;
      function show(n) {
        slides[at].classList.remove('on'); slides[at].setAttribute('aria-hidden', 'true');
        at = (n + slides.length) % slides.length;
        slides[at].classList.add('on'); slides[at].removeAttribute('aria-hidden');
        var ms = +slides[at].dataset.ms || SLIDE_MS;
        bar.style.transition = 'none'; bar.style.width = '0';
        if (!paused) { bar.offsetWidth; bar.style.transition = 'width ' + ms + 'ms linear'; bar.style.width = '100%'; }
        clearTimeout(timer);
        if (!paused) timer = setTimeout(function () { if (document.body.contains(root)) show(at + 1); }, ms);
      }
      function pause(p) { paused = reduce || p; show(at); }
      root.querySelector('.lr-prev').onclick = function () { show(at - 1); };
      root.querySelector('.lr-next').onclick = function () { show(at + 1); };
      stage.addEventListener('mouseenter', function () { pause(true); });
      stage.addEventListener('mouseleave', function () { pause(false); });
      stage.addEventListener('focusin', function () { pause(true); });
      stage.addEventListener('focusout', function () { pause(false); });
      stage.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') show(at - 1);
        if (e.key === 'ArrowRight') show(at + 1);
      });
      var x0 = null;
      stage.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      stage.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1));
      });
      // Full-page website captures scroll inside the browser, so they stay longer.
      root.querySelectorAll('.lr-screen img').forEach(function (img) {
        var fit = function () {
          var s = img.closest('.lr-slide'), tall = img.naturalHeight / img.naturalWidth > 1.2;
          s.dataset.ms = tall ? 8000 : SLIDE_MS;
          s.style.setProperty('--lr-ms', (tall ? 7000 : SLIDE_MS - 700) + 'ms');
        };
        img.complete ? fit() : img.addEventListener('load', fit);
      });
      slides[0].classList.add('on'); slides[0].removeAttribute('aria-hidden');
      show(0);
    });
  }

  function scan() {
    var root = document.querySelector('.lab-reel:not([data-ready])');
    if (root) build(root);
  }
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', scan);
  setInterval(scan, 500);   // the app can swap the section in without a mutation we catch first
})();
