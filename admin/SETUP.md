# Admin

| URL | What it is |
|---|---|
| `/admin/` | **CMS** — edit every piece of content on the site |
| `/admin/analytics.html` | **Analytics** — where your visitors come from |

No password is stored anywhere in this repository.

---

## 1. The CMS

Purpose-built for this site — no third-party CMS, no CDN dependency, no build
step. It reads and writes `content/*.json` directly through the GitHub contents
API from your browser.

### Signing in

You authenticate as **yourself on GitHub** with a fine-grained personal access
token. Edits land as ordinary commits you can review, revert or blame.

1. Open <https://github.com/settings/personal-access-tokens/new>
2. Configure:
   - **Token name:** `Portfolio CMS`
   - **Expiration:** 90 days (renew when it lapses)
   - **Repository access:** *Only select repositories* → `birukhios/birukhios.github.io`
   - **Permissions → Repository permissions → Contents:** **Read and write**
     *(the only permission needed)*
3. Generate, copy, and paste it into `/admin/`.

The token is kept in this browser's local storage and sent only to
`api.github.com`. It is never committed. To revoke it — if you paste it
somewhere public, or lose the laptop — go to
<https://github.com/settings/tokens?type=beta>. **Sign out** in the CMS also
clears it from the browser.

### Editing

- Pick a collection in the sidebar, then an entry.
- Reorder or delete entries with the controls that appear on each row.
- Nested content (case-study sections, their side points, images and tradeoffs)
  expands inline — each level reorders and deletes independently.
- Images: **Choose** picks an existing file from the repo; **Upload** adds a new
  one to `uploads/cms/` and commits it immediately.
- Nothing is written until you press **Commit to GitHub**. Until then the save
  bar tracks unsaved changes, and closing the tab warns you.
- After committing, GitHub Pages redeploys in about a minute.

If someone else (or another tab) changed the same file after you opened it, the
save is refused rather than silently overwriting — reload and re-apply.

### Collections

`Case Studies · Moodboard · Branding · Posters · Client sites · Experience ·
Education · How I can help · How I work`

To change a form — add a field, reword a label, add a collection — edit
`admin/schema.js`. The forms are generated from it; there is no other place to
update.

### How content reaches the site

`content/*.json` is fetched at runtime by `index.html`. The arrays hardcoded
inside `index.html` are a **fallback** used only if a fetch fails, so the site
can never render empty.

---

## 2. Analytics — inside the CMS

`/admin/analytics.html` draws your GA4 numbers natively: visitors, sessions,
page views, engagement, who's on the site right now, a per-day trend, and ranked
lists of **countries**, **channels** and **screens**.

Google blocks its dashboard from being embedded in an iframe, so this queries the
**Analytics Data API** directly instead. Everything stays client-side.

### Preview it first

<https://birukhios.github.io/admin/analytics.html?demo=1> renders the whole
dashboard from sample figures — no setup, no network calls. Useful for seeing the
layout before wiring anything up.

### One-time setup (~10 min)

1. In [Google Cloud Console](https://console.cloud.google.com/), create or pick a project.
2. **APIs & Services → Library** → enable **Google Analytics Data API**.
3. **OAuth consent screen** → External → add your own Google account under **Test users**.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   Authorised JavaScript origins:
   - `https://birukhios.github.io`
   - `http://localhost:4173` (for local testing)
5. Copy the **Client ID**. There is no secret to handle — browser apps don't use one,
   and the client ID is public by design.
6. Get your **Property ID**: GA → **Admin → Property details**. It's the numeric one
   (e.g. `447… `), *not* the measurement ID `G-GJ4L5PVGNK`.
7. Paste both into `/admin/analytics.html` and click **Save and connect**.

The two IDs are stored in your browser. The access token is held in memory only and
never written to disk; it lasts about an hour, after which you click Connect again.

> Because the consent screen stays in **Testing** mode, only the accounts you list
> as test users can authorise — which is what you want for a private dashboard.

### Reading it

| Question | Where |
|---|---|
| Where are my visitors? | **Where visitors are** — by country |
| How did they find me? | **How they found you** — direct, search, referral, social |
| What did they read? | **What they looked at** — per screen and case study |
| Is anyone here now? | **Active now** tile |

Every chart has a **Table** toggle, so the numbers are readable without relying on
the chart.

### Still prefer Google's own UI?

<https://analytics.google.com/> — Reports → User attributes (countries),
Acquisition → Traffic acquisition (referrers), Engagement → Pages and screens.

The site is one page with client-side routing, so pageviews are sent manually
per screen using virtual paths — `/work`, `/play`, `/case/<id>` and so on.
Without that, GA would record a single `/` view per visitor.

To change the measurement ID: `GA_ID=G-XXXXXXXXXX ./build.sh`

> **Cookies.** GA4 sets cookies and generally needs a consent banner for EU/UK
> visitors. A cookieless alternative or a banner can be added if that matters.

---

## 3. Dark mode

Follows the OS by default; the toggle (bottom-right of the site) overrides it
and the choice persists. The CMS follows the same setting.

The theme lives in `theme.css` and works by overriding the design's inline
colours under `[data-theme="dark"]`.

⚠️ **If you add colour rules**, note that browsers re-serialise colours in the
style attribute: `#f3f2f2` in the source is `rgb(243, 242, 242)` in the DOM, and
`rgba(32,30,29,0.4)` becomes `rgba(32, 30, 29, 0.4)`. Selectors written against
the source form match nothing. Run this after editing:

```bash
node tools/normalize-color-selectors.js theme.css responsive.css
```

---

## 4. Rebuilding after a Claude Design re-export

`Biruk Habtamu Portfolio.dc.html` is the design source of truth. `index.html` is
the deployed build — that file plus patches for the responsive layer, dark mode,
analytics and CMS content loading. `build.sh` re-applies all of them:

```bash
./build.sh
```

If you changed content *in the design file* and want that to become the new CMS
content:

```bash
node tools/extract-content.js
```

⚠️ That **overwrites** `content/*.json`, discarding edits made through the CMS.
Normally you edit content in the CMS and layout in Claude Design — only run this
when you deliberately want the design file's content to win.
