#!/usr/bin/env python3
"""Pre-render one static page per case study: case/<id>/index.html.

WHY
  The site is a single page that routes on the hash (#/case/pep). Link
  previews (LinkedIn, Slack, WhatsApp) never run JavaScript and never see the
  hash, so every shared case study showed the generic homepage card.

  Each generated page is index.html plus:
    - <base href="/"> so relative assets and content/*.json still resolve
    - its own <title>, description, canonical and Open Graph / Twitter tags
    - a 1200x630 JPG preview image (og/<id>.jpg; Pillow needed, else skipped)
    - a <noscript> summary of the case for crawlers and no-JS readers
    - a tiny script that moves the visitor to /#/case/<id> in the app
  Also writes sitemap.xml and robots.txt.

Run after build.sh (build.sh calls it). Usage: python3 tools/prerender.py
"""
import html, json, os, re, shutil, sys

SITE = 'https://birukhios.github.io'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

esc = lambda s: html.escape(str(s or ''), quote=True)


def og_image(src, pid):
    """Crop the case's preview image to 1200x630 JPG. LinkedIn is unreliable
    with WebP, so previews get their own JPG."""
    try:
        from PIL import Image
    except ImportError:
        return src
    if not src or not os.path.isfile(src):
        return src
    os.makedirs('og', exist_ok=True)
    out = f'og/{pid}.jpg'
    im = Image.open(src).convert('RGB')
    w, h = im.size
    scale = max(1200 / w, 630 / h)
    im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    im.crop((0, 0, 1200, 630)).save(out, 'JPEG', quality=82, optimize=True)  # top-left: keeps nav + title of the UI
    return out


def set_meta(src, attr, key, value):
    pat = re.compile(r'<meta %s="%s" content="[^"]*" />' % (attr, re.escape(key)))
    tag = f'<meta {attr}="{key}" content="{esc(value)}" />'
    if not pat.search(src):
        sys.exit(f'prerender: <meta {attr}="{key}"> not found in index.html')
    return pat.sub(lambda _: tag, src, count=1)


def render(base, p):
    pid = p['id']
    url = f'{SITE}/case/{pid}/'
    title = f"{p['name']} — Case study | Biruk Habtamu"
    desc = p.get('summary') or p.get('blurb') or ''
    desc = desc if len(desc) <= 200 else desc[:197].rsplit(' ', 1)[0] + '…'
    img = og_image(p.get('previewImage') or p.get('cover') or p.get('heroImage'), pid)

    s = base
    s = s.replace('<head>', '<head>\n<base href="/" />', 1)
    s = re.sub(r'<title>[^<]*</title>', lambda _: f'<title>{esc(title)}</title>', s)
    s = s.replace('<link rel="canonical" href="https://birukhios.github.io/" />',
                  f'<link rel="canonical" href="{url}" />', 1)
    s = set_meta(s, 'name', 'description', desc)
    s = set_meta(s, 'property', 'og:type', 'article')
    s = set_meta(s, 'property', 'og:url', url)
    s = set_meta(s, 'property', 'og:title', title)
    s = set_meta(s, 'property', 'og:description', desc)
    s = set_meta(s, 'property', 'og:image', f'{SITE}/{img}')
    s = set_meta(s, 'name', 'twitter:card', 'summary_large_image')
    s = set_meta(s, 'name', 'twitter:title', title)
    s = set_meta(s, 'name', 'twitter:description', desc)
    s = set_meta(s, 'name', 'twitter:image', f'{SITE}/{img}')

    # Hand visitors to the app at /#/case/<id> before anything loads. The
    # router only reads the hash and writes URLs relative to the page, so it
    # misroutes when it runs under /case/<id>/. Crawlers keep this page's HTML.
    route = f'<script>history.replaceState(null,"","/#/case/{pid}");</script>\n'
    s = s.replace('<head>', '<head>\n' + route, 1)

    pm = p.get('pm') or {}
    rows = [('Role', p.get('role')), ('Year', p.get('year')), ('Platform', p.get('platform')),
            ('Who it serves', pm.get('audience')), ('Priority decision', pm.get('decision')),
            ('Trade-off', pm.get('tradeoff'))]
    article = (
        '<noscript><article style="max-width:720px;margin:40px auto;padding:0 16px">\n'
        f'<p><a href="/">Biruk Habtamu</a> / Case study</p>\n<h1>{esc(p["name"])}</h1>\n'
        f'<p>{esc(p.get("summary"))}</p>\n'
        + ''.join(f'<p><strong>{k}:</strong> {esc(v)}</p>\n' for k, v in rows if v)
        + f'<h2>The problem</h2>\n<p>{esc(p.get("problem"))}</p>\n'
        f'<h2>How I solved it</h2>\n<p>{esc(p.get("solve"))}</p>\n'
        '</article></noscript>\n')
    s = s.replace('<body>', '<body>\n' + article, 1)
    return url, s


def main():
    base = open('index.html', encoding='utf-8').read()
    raw = json.load(open('content/projects.json', encoding='utf-8'))
    projects = raw if isinstance(raw, list) else raw['items']

    shutil.rmtree('case', ignore_errors=True)
    urls = [f'{SITE}/']
    for p in projects:
        url, page = render(base, p)
        os.makedirs(f'case/{p["id"]}', exist_ok=True)
        open(f'case/{p["id"]}/index.html', 'w', encoding='utf-8').write(page)
        urls.append(url)
        print('prerendered', url)

    open('sitemap.xml', 'w').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + ''.join(f'  <url><loc>{u}</loc></url>\n' for u in urls) + '</urlset>\n')
    open('robots.txt', 'w').write(
        f'User-agent: *\nDisallow: /admin/\nSitemap: {SITE}/sitemap.xml\n')


if __name__ == '__main__':
    main()
