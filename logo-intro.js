/* Home intro: a full-screen opening for the landing page.
   The bhios wordmark fills the screen and builds letter by letter, the square
   dot drops onto the i and the tagline appears; a red panel then sweeps up,
   the whole cover lifts away and the hero headline rises into place.

   Loaded synchronously in <head> (after the theme script) so the cover is up
   before the first paint. Plays on every fresh load of the home page only,
   never on other pages or case-study links, and never for visitors who ask
   for reduced motion. It waits for the app to render, with a hard cap so it
   can never block the page. */
(function () {
  var route = (location.hash || '').replace(/^#/, '');
  var isHome = location.pathname === '/' || /\/index\.html$/.test(location.pathname);
  if (!isHome || (route && route !== '/' && route !== '/home')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var P = [
    ['0 0', 'M 0 0 L 45 0 L 45 69 C 61 60 77 58 89 58 C 135 58 151 91 151 130 C 151 170 123 200 83 200 L 28 200 L 0 172 Z M 45 106 L 45 155 L 80 155 C 98 155 106 145 106 131 C 106 116 97 106 80 106 Z'],
    ['159 0', 'M 0 0 L 45 0 L 45 73 C 57 63 69 58 84 58 C 118 58 140 82 140 117 L 140 200 L 95 200 L 95 121 C 95 105 87 97 72 97 C 57 97 45 107 45 123 L 45 200 L 0 200 Z'],
    ['307 0', 'M 0 62 L 44 62 L 44 200 L 0 200 Z'],
    ['359 0', 'M 150 129 C 150 171 120 202 75 202 C 30 202 0 171 0 129 C 0 87 30 56 75 56 C 120 56 150 87 150 129 Z M 104 129 C 104 111 93 99 75 99 C 57 99 46 111 46 129 C 46 147 57 159 75 159 C 93 159 104 147 104 129 Z'],
    ['517 0', 'M 128 59 L 128 100 L 57 100 L 110 129 C 128 139 136 149 136 166 C 136 189 119 200 90 200 L 0 200 L 0 158 L 73 158 L 23 130 C 6 120 0 109 0 94 C 0 72 17 59 44 59 Z'],
    ['0 0', 'M 307 0 L 351 0 L 351 44 L 307 44 Z']   // the square dot
  ];
  var LOGO_MS = 1900;   // letters, dot and tagline have landed
  var MAX_MS = 4500;    // never hold the page longer than this
  var EASE = 'cubic-bezier(.7,0,.2,1)';

  var css =
    '#logo-intro{position:fixed;inset:0;z-index:9999;overflow:hidden;background:#F6F3EF;transition:transform .8s ' + EASE + '}' +
    'html[data-theme="dark"] #logo-intro{background:#16181a}' +
    '#logo-intro .li-stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4vh}' +
    '#logo-intro svg{width:min(84vw,1100px);height:auto;overflow:visible}' +
    '#logo-intro path{fill:#EF3340;opacity:0;animation:li-rise .7s cubic-bezier(.2,.8,.2,1) both}' +
    '#logo-intro path.dot{animation:li-drop .8s cubic-bezier(.2,.8,.2,1) .75s both}' +
    '#logo-intro .li-line{font:500 clamp(14px,1.6vw,22px)/1 Archivo,system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#171717;opacity:0;animation:li-fade .6s ease 1.3s both}' +
    'html[data-theme="dark"] #logo-intro .li-line{color:#ece9e7}' +
    '#logo-intro .li-curtain{position:absolute;inset:0;background:#EF3340;transform:translateY(100%);transition:transform .6s ' + EASE + '}' +
    '#logo-intro.sweep .li-curtain{transform:none}' +
    '#logo-intro.done{transform:translateY(-100%)}' +
    '@keyframes li-rise{from{opacity:0;transform:translateY(90px)}to{opacity:1;transform:none}}' +
    '@keyframes li-drop{0%{opacity:0;transform:translateY(-160px)}70%{opacity:1;transform:translateY(10px)}100%{opacity:1;transform:none}}' +
    '@keyframes li-fade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}' +
    // the hero rises in as the cover leaves
    'html.li-reveal .landing-intro>*,html.li-reveal .process-strip{animation:li-fade .8s cubic-bezier(.2,.8,.2,1) both}' +
    'html.li-reveal .landing-intro>:nth-child(2){animation-delay:.08s}html.li-reveal .landing-intro>:nth-child(3){animation-delay:.16s}' +
    'html.li-reveal .landing-intro>:nth-child(4){animation-delay:.24s}html.li-reveal .landing-intro>:nth-child(5){animation-delay:.32s}' +
    'html.li-reveal .process-strip{animation-delay:.4s}';

  var svg = '<svg viewBox="-10 -10 674 222" role="img" aria-label="bhios">';
  P.forEach(function (p, j) {
    var dot = j === P.length - 1;
    svg += '<g transform="translate(' + p[0] + ')"><path' + (dot ? ' class="dot"' : ' style="animation-delay:' + j * 100 + 'ms"') +
      ' fill-rule="evenodd" d="' + p[1] + '"/></g>';
  });
  svg += '</svg>';

  var style = document.createElement('style');
  style.textContent = css;
  var cover = document.createElement('div');
  cover.id = 'logo-intro';
  cover.setAttribute('aria-hidden', 'true');
  cover.innerHTML = '<div class="li-stage">' + svg + '<p class="li-line">Clarity, by design</p></div><div class="li-curtain"></div>';
  document.documentElement.appendChild(style);
  document.documentElement.appendChild(cover);

  var start = Date.now(), lifted = false;
  function lift() {
    if (lifted) return;
    lifted = true;
    cover.classList.add('sweep');                          // red panel fills the screen
    setTimeout(function () {
      document.documentElement.classList.add('li-reveal');
      cover.classList.add('done');                         // everything lifts away
      setTimeout(function () {
        cover.remove();
        setTimeout(function () { style.remove(); document.documentElement.classList.remove('li-reveal'); }, 1400);
      }, 850);
    }, 550);
  }
  (function wait() {
    var ready = document.querySelector('.brand-wordmark');   // the app has rendered
    var t = Date.now() - start;
    if ((ready && t >= LOGO_MS) || t >= MAX_MS) return lift();
    setTimeout(wait, 100);
  })();
})();
