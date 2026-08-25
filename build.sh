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
      'sites':      v => { SITES = v; },      'sites-more': v => { SITES_MORE = v; },
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
    tracker = '''  /* Send a GA4 pageview per screen. The site never changes its URL, so without
     this GA would record one "/" view per visitor regardless of how much they
     browsed. Paths are virtual: /work, /play, /case/rad-reader, ... */
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

  componentDidUpdate() { this.fitAll(); this.trackView(); }'''
    src = src.replace('  componentDidUpdate() { this.fitAll(); }', tracker, 1)

open(path, 'w', encoding='utf-8').write(src)
print(f"  patched {path}")
PY

echo "built $OUT from '$SRC'  (GA4: $GA_ID)"
exit 0
