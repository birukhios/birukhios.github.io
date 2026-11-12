/* Interface extras:
   - home: "Make the call", a real product decision the visitor answers
     before seeing what shipped
   - work: an index-table view with a preview that follows the cursor
   - case studies: a side rail whose red square travels to the current section

   The app renders pages after load and on every route change, so each part
   fills an empty placeholder (or attaches to <body>) whenever it appears. */
(function () {
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ── home: decision ─────────────────────────────────────────
  // Each one is the documented key decision of that case study.
  var DECISIONS = [
    { id: 'pep', name: 'PEP', q: 'Recruiters compare candidates all day. Which view would you ship?',
      opts: ['A comparison table', 'A kanban board'], pick: 0,
      why: 'A kanban makes stage movement visual, but recruiters needed to compare candidates side by side. The table shipped, with stage as a filter.' },
    { id: 'crm', name: 'Enterprise CRM', q: 'A new user opens the CRM for the first time. What do they see?',
      opts: ['A blank grid they configure', 'A dashboard built for their role'], pick: 1,
      why: 'Configuration offers control but adds setup work. Seven roles each start on a useful default, and customise afterwards.' },
    { id: 'complaint-management', name: 'Complaint Management', q: 'A service manager opens the complaint tool. Where do they land?',
      opts: ['Analytics, separate from the queue', 'The live case queue'], pick: 0,
      why: 'Opening on live cases turns the dashboard into another inbox. Managers get analytics; agents get the working queue.' }
  ];
  var at = 0;

  function drawDecision(box) {
    var d = DECISIONS[at];
    box.innerHTML = '<p class="eyebrow">Make the call · ' + (at + 1) + ' / ' + DECISIONS.length + '</p><h2>' + esc(d.q) + '</h2>' +
      '<div class="hd-opts">' + d.opts.map(function (o, i) { return '<button data-opt="' + i + '"><span>' + 'AB'[i] + '</span>' + esc(o) + '</button>'; }).join('') + '</div>' +
      '<div class="hd-reveal" aria-live="polite"></div>';
  }
  function buildHome(sec) {
    sec.dataset.ready = '1';
    sec.innerHTML = '<div class="hm-in"><div class="home-decision"></div></div>';
    var box = sec.querySelector('.home-decision');
    drawDecision(box);
    box.addEventListener('click', function (e) {
      var o = e.target.closest('[data-opt]'), d = DECISIONS[at];
      if (o && !box.classList.contains('answered')) {
        var right = +o.dataset.opt === d.pick;
        box.classList.add('answered');
        box.querySelectorAll('[data-opt]').forEach(function (b, i) { b.classList.add(i === d.pick ? 'shipped' : 'cut'); b.disabled = true; });
        box.querySelector('.hd-reveal').innerHTML = '<p><b>' + (right ? 'Same call I made.' : 'I went the other way.') + '</b> ' + esc(d.why) + '</p>' +
          '<div class="hd-foot"><a class="text-action" href="#/case/' + d.id + '">Read the ' + esc(d.name) + ' case study <i class="ph ph-arrow-up-right" aria-hidden="true"></i></a>' +
          '<button class="hd-next" data-next>Another decision →</button></div>';
      }
      if (e.target.closest('[data-next]')) { at = (at + 1) % DECISIONS.length; box.classList.remove('answered'); drawDecision(box); }
    });
  }

  // ── work: index table ────────────────────────────────────────────────
  var mode = 'index';
  try { mode = localStorage.getItem('workView') || 'index'; } catch (e) {}
  var preview = null;
  function setMode(m) { mode = m; root.classList.toggle('work-as-index', m === 'index'); try { localStorage.setItem('workView', m); } catch (e) {} }
  function syncWork(holder) {
    var rows = Array.prototype.slice.call(document.querySelectorAll('.project-list .project-row'));
    var sig = mode + '|' + rows.map(function (r) { var h = r.querySelector('h2'), im = r.querySelector('img'); return (h ? h.textContent : '') + (r.querySelector('.proto-tag') ? '*' : '') + (im && (im.getAttribute('src') || im.dataset.img) ? '+' : ''); }).join('|');
    if (holder.dataset.sig === sig) return;
    holder.dataset.sig = sig;
    holder.innerHTML = '<div class="wi-toggle" role="group" aria-label="Work layout"><button data-m="index" aria-pressed="' + (mode === 'index') + '">Index</button><button data-m="cards" aria-pressed="' + (mode === 'cards') + '">Cards</button></div>' +
      '<div class="wi-table">' + rows.map(function (r, i) {
        var t = function (s) { var e = r.querySelector(s); return e ? e.textContent.trim() : ''; };
        var meta = t('.project-meta'), year = (meta.match(/(19|20)\d{2}/) || [''])[0];
        var img = r.querySelector('img'), src = img ? (img.currentSrc || img.getAttribute('src') || img.dataset.img || '') : '';
        return '<button class="wi-row" data-i="' + i + '" data-src="' + esc(src) + '"><span class="wi-n">' + String(i + 1).padStart(2, '0') + '</span><b>' + esc(t('h2')) +
          (r.querySelector('.proto-tag') ? '<em>Prototype</em>' : '') + '</b><span class="wi-role">' + esc(t('.project-role')) + '</span><span class="wi-y">' + year + '</span><i class="ph ph-arrow-up-right" aria-hidden="true"></i></button>';
      }).join('') + '</div>';
  }
  function buildWork(holder) {
    holder.dataset.ready = '1';
    setMode(mode);
    holder.addEventListener('click', function (e) {
      var m = e.target.closest('[data-m]');
      if (m) { setMode(m.dataset.m); syncWork(holder); return; }
      var row = e.target.closest('.wi-row');
      if (row) {
        var src = document.querySelectorAll('.project-list .project-row')[row.dataset.i];
        var open = src && src.querySelector('.project-image-link, button.text-action');
        if (preview) preview.classList.remove('on');
        if (open) open.click();
      }
    });
    holder.addEventListener('mousemove', function (e) {
      var row = e.target.closest('.wi-row');
      if (!preview) { preview = document.createElement('div'); preview.id = 'wi-preview'; preview.innerHTML = '<img alt="">'; document.body.appendChild(preview); }
      if (!row || !row.dataset.src) { preview.classList.remove('on'); return; }
      var im = preview.firstChild; if (im.getAttribute('src') !== row.dataset.src) im.src = row.dataset.src;
      preview.classList.add('on');
      preview.style.transform = 'translate(' + Math.min(e.clientX + 28, innerWidth - 400) + 'px,' + Math.max(12, Math.min(e.clientY - 110, innerHeight - 240)) + 'px)';
    });
    holder.addEventListener('mouseleave', function () { if (preview) preview.classList.remove('on'); });
    syncWork(holder);
  }

  // ── case study: section rail ─────────────────────────────────────────
  var rail = null, targets = [];
  function buildRail() {
    var onCase = /^#\/case\//.test(location.hash);
    var links = onCase ? Array.prototype.slice.call(document.querySelectorAll('main nav a[href^="#"]')).filter(function (a) { return !/^#\//.test(a.getAttribute('href')); }) : [];
    var sig = location.hash + '|' + links.length;
    if (rail && rail.dataset.sig === sig) return;
    if (!rail) { rail = document.createElement('nav'); rail.id = 'case-rail'; rail.setAttribute('aria-label', 'Sections'); document.body.appendChild(rail); }
    rail.dataset.sig = sig;
    targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    if (links.length < 2 || targets.some(function (t) { return !t; })) { rail.innerHTML = ''; rail.classList.remove('on'); return; }
    rail.innerHTML = '<i></i>' + links.map(function (a, i) { return '<button data-i="' + i + '">' + esc(a.textContent.trim()) + '</button>'; }).join('');
    rail.onclick = function (e) { var b = e.target.closest('[data-i]'); if (b) targets[b.dataset.i].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); };
    spy();
  }
  function spy() {
    if (!rail || !targets.length || !rail.firstChild) return;
    var cur = -1;
    targets.forEach(function (t, i) { if (t.getBoundingClientRect().top < innerHeight * .4) cur = i; });
    rail.classList.toggle('on', cur >= 0 && targets[targets.length - 1].getBoundingClientRect().bottom > 0);
    var btns = rail.querySelectorAll('button');
    btns.forEach(function (b, i) { b.classList.toggle('on', i === cur); });
    if (cur >= 0) rail.firstChild.style.transform = 'translateY(' + (btns[cur].offsetTop + btns[cur].offsetHeight / 2 - 5) + 'px)';
  }
  addEventListener('scroll', spy, { passive: true });

  // ── wiring ───────────────────────────────────────────────────────────
  function scan() {
    var home = document.querySelector('.home-more:not([data-ready])'); if (home) buildHome(home);
    var work = document.querySelector('.work-index');
    if (work) { work.dataset.ready ? syncWork(work) : buildWork(work); }
    else if (preview) preview.classList.remove('on');
    buildRail();
  }
  new MutationObserver(function () { clearTimeout(scan._t); scan._t = setTimeout(scan, 60); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', scan);
  addEventListener('hashchange', function () { setTimeout(scan, 120); });
  setInterval(scan, 600);   // the app can swap sections in without a mutation we catch first
})();
