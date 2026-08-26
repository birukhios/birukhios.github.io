#!/usr/bin/env bash
# Rebuild index.html from the Claude Design export.
#
# WHY THIS EXISTS
#   "Biruk Habtamu Portfolio.dc.html" is the design source of truth (edit it in
#   Claude Design). index.html is the deployed build: the same file plus two
#   patches that Claude Design doesn't know about —
#     1. content arrays load from content/*.json  (so the CMS at /admin can edit them)
#     2. the GoatCounter analytics snippet
#
#   Run this after re-exporting from Claude Design to re-apply both patches.
#   Then run  node tools/extract-content.js  if the design's content changed and
#   you want the JSON regenerated from it.
set -euo pipefail
cd "$(dirname "$0")"

SRC="Biruk Habtamu Portfolio.dc.html"
OUT="index.html"
GA_ID="${GA_ID:-G-GJ4L5PVGNK}"

[ -f "$SRC" ] || { echo "error: '$SRC' not found"; exit 1; }
cp "$SRC" "$OUT"

python3 - "$OUT" "$GA_ID" <<'PY'
import re, sys
path, ga_id = sys.argv[1], sys.argv[2]
src = open(path, encoding='utf-8').read()

# ── patch 0: responsive layer ─────────────────────────────────────────────
# Must come last in the head so it can override the design's inline styles.
if 'responsive.css' not in src:
    src = src.replace(
        '</style>\n</helmet>',
        '</style>\n\n<link rel="stylesheet" href="responsive.css" />\n</helmet>', 1)

# ── patch 0b: dark mode ───────────────────────────────────────────────────
# Goes in the REAL <head>, not <helmet>: the runtime injects helmet content
# only after React boots, which would flash the light theme first.
if 'theme.css' not in src:
    head = (
        # ── discovery: link previews and search results ──────────────────
        # Without these a shared link renders as a bare URL — no title, no
        # image, no description. og:image must be an ABSOLUTE url; LinkedIn,
        # Slack and WhatsApp all reject relative ones.
        '<meta name="description" content="Product manager and designer in Addis '
        'Ababa. Seven years building HR, ERP, CRM and healthcare products." />\n'
        '<link rel="canonical" href="https://birukhios.github.io/" />\n'
        '<link rel="icon" type="image/png" href="/uploads/brand/favicon-64.png" />\n'
        '<link rel="apple-touch-icon" href="/uploads/brand/apple-touch-icon.png" />\n'
        '<meta property="og:type" content="website" />\n'
        '<meta property="og:url" content="https://birukhios.github.io/" />\n'
        '<meta property="og:site_name" content="Biruk Habtamu" />\n'
        '<meta property="og:title" content="Biruk Habtamu — Product Manager &amp; Designer" />\n'
        '<meta property="og:description" content="Seven years building HR, ERP, CRM '
        'and healthcare products. Selected case studies, experience and contact." />\n'
        '<meta property="og:image" content="https://birukhios.github.io/uploads/brand/biruk-habtamu-icon.png" />\n'
        '<meta name="twitter:card" content="summary" />\n'
        '<meta name="twitter:title" content="Biruk Habtamu — Product Manager &amp; Designer" />\n'
        '<meta name="twitter:description" content="Seven years building HR, ERP, CRM '
        'and healthcare products." />\n'
        '<meta name="twitter:image" content="https://birukhios.github.io/uploads/brand/biruk-habtamu-icon.png" />\n'
        '<link rel="stylesheet" href="theme.css" />\n'
        '<script>\n'
        '  /* set the theme before first paint */\n'
        '  (function(){try{var t=localStorage.getItem("theme")||\n'
        '    (matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");\n'
        '    document.documentElement.setAttribute("data-theme",t);}catch(e){}})();\n'
        '</script>\n'
        '<script src="./theme.js" defer></script>\n'
        '</head>'
    )
    src = src.replace('</head>', head, 1)

# ── patch 1: Google Analytics (GA4) ───────────────────────────────────────
if 'googletagmanager.com' not in src:
    snippet = (
        '\n<!-- Google Analytics (GA4) -->\n'
        f'<script async src="https://www.googletagmanager.com/gtag/js?id={ga_id}"></script>\n'
        '<script>\n'
        '  window.dataLayer = window.dataLayer || [];\n'
        '  function gtag(){dataLayer.push(arguments);}\n'
        "  gtag('js', new Date());\n"
        '  // send_page_view:false — client-side-routed site; pageviews are sent\n'
        '  // manually by trackView() so each screen is counted.\n'
        f"  gtag('config', '{ga_id}', {{ send_page_view: false }});\n"
        '</script>\n'
    )
    src = src.replace('</style>\n</helmet>', '</style>\n' + snippet + '</helmet>', 1)

# ── patch 2: content arrays become overridable, and load from content/*.json ──
for name in ['P','POSTERS','BRANDING','MOOD','SITES','SITES_MORE',
             'SERVICES','EDU','EXPERIENCE','PROCESS']:
    src = re.sub(r'^const (%s) = \[' % name, r'let \1 = [', src, flags=re.M)

if 'loadContent' not in src:
    loader = '''  /* ── CMS content loading (added by build.sh) ─────────────────────────
     Content lives in content/*.json so the CMS at /admin can edit it. The
     arrays above are the built-in fallback: if a fetch fails the site still
     renders exactly as shipped. */
  loadContent = async () => {
    const assign = {
      'projects':   v => { P = v; },          'posters':    v => { POSTERS = v; },
      'branding':   v => { BRANDING = v; },   'mood':       v => { MOOD = v; },
      'services':   v => { SERVICES = v; },   'education':  v => { EDU = v; },
      'experience': v => { EXPERIENCE = v; }, 'process':    v => { PROCESS = v; },
    };
    const base = new URL('content/', location.href).href;
    await Promise.all(Object.entries(assign).map(async ([file, set]) => {
      try {
        const r = await fetch(base + file + '.json', { cache: 'no-cache' });
        if (!r.ok) return;
        const raw = await r.json();
        const data = Array.isArray(raw) ? raw : raw && raw.items;
        if (Array.isArray(data) && data.length) set(data);
      } catch (e) { /* keep built-in fallback */ }
    }));
    this.setState({ __contentLoaded: true });
  };

  componentDidMount() {'''
    src = src.replace('  componentDidMount() {', loader, 1)
    src = src.replace(
        "    this._fitTimer = setInterval(this.fitAll, 400);\n  }",
        "    this._fitTimer = setInterval(this.fitAll, 400);\n"
        "    this.loadContent();\n    this.trackView();\n  }", 1)

# ── patch 3: GA4 virtual pageviews for the client-side router ──────────────
# NB: guard on the *definition*, not the name — patch 2 already inserted a
# `this.trackView()` call into componentDidMount, so a bare 'trackView' check
# would skip this patch and ship a call with no function behind it.
if 'trackView = () =>' not in src:
    tracker = '''  /* ── URL routing ──────────────────────────────────────────────────────
     The design keeps the current screen in component state only, so every
     reload — and every shared link — landed back on Work. These sync the
     screen to the hash (#/play, #/case/rad-reader), which also makes the
     browser's back/forward buttons work and lets a case study be linked. */
  SCREENS = ['work', 'play', 'about', 'resume', 'contact', '404'];

  pathFor = (screen, caseId) =>
    screen === 'case' ? '/case/' + caseId : '/' + screen;

  readHash = () => {
    const h = (location.hash || '').replace(/^#/, '');
    if (!h || h === '/') return null;
    const m = h.match(/^\\/case\\/(.+)$/);
    if (m) return { screen: 'case', caseId: decodeURIComponent(m[1]) };
    const s = h.replace(/^\\//, '');
    return this.SCREENS.indexOf(s) >= 0 ? { screen: s } : null;
  };

  onHashChange = () => {
    if (this._fromSelf) { this._fromSelf = false; return; }
    const r = this.readHash();
    if (!r) return;
    if (r.screen !== this.state.screen ||
        (r.caseId && r.caseId !== this.state.caseId)) {
      this.setState(r);
      window.scrollTo(0, 0);
    }
  };

  syncUrl = () => {
    const p = this.pathFor(this.state.screen, this.state.caseId);
    if (location.hash === '#' + p) return;
    if (!this._urlReady) {
      // first paint: don't push a history entry for the landing screen
      this._urlReady = true;
      history.replaceState(null, '', '#' + p);
    } else {
      this._fromSelf = true;   // our own change; don't echo it back
      location.hash = p;
    }
  };

  /* Send a GA4 pageview per screen. The site never changes its path, so
     without this GA would record one "/" view per visitor regardless of how
     much they browsed. Paths match the hash routes above. */
  trackView = () => {
    if (typeof gtag !== 'function') return;
    const s = this.state.screen;
    const path = s === 'case' ? '/case/' + this.state.caseId : '/' + s;
    if (this._lastView === path) return;
    this._lastView = path;
    const title = s === 'case'
      ? ((P.find(p => p.id === this.state.caseId) || {}).name || 'Case study')
      : s.charAt(0).toUpperCase() + s.slice(1);
    gtag('event', 'page_view', {
      page_title: title,
      page_path: path,
      page_location: location.origin + path,
    });
  };

  componentDidUpdate() { this.fitAll(); this.syncUrl(); this.trackView(); }'''
    src = src.replace('  componentDidUpdate() { this.fitAll(); }', tracker, 1)

# ── patch 4: restore the screen from the URL on load ──────────────────────
if 'onHashChange' in src and 'addEventListener(\'hashchange\'' not in src:
    src = src.replace(
        "    this.loadContent();\n    this.trackView();\n  }",
        "    this.loadContent();\n"
        "    const fromUrl = this.readHash();\n"
        "    if (fromUrl) this.setState(fromUrl);\n"
        "    window.addEventListener('hashchange', this.onHashChange);\n"
        "    this.syncUrl();\n"
        "    this.trackView();\n  }", 1)

open(path, 'w', encoding='utf-8').write(src)
print(f"  patched {path}")
PY

echo "built $OUT from '$SRC'  (GA4: $GA_ID)"
exit 0
