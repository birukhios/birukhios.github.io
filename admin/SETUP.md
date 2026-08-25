# Admin setup

Two things live under `/admin`:

| URL | What it is |
|---|---|
| `/admin/` | **Sveltia CMS** — edit case studies, moodboard, experience, etc. |
| `/admin/analytics.html` | **Analytics** — where your visitors come from |

Neither stores a password anywhere in this repository.

---

## 1. CMS login (GitHub Personal Access Token)

There is no portfolio password. You authenticate as **yourself on GitHub**, and
your edits are committed to this repo as normal commits.

1. Go to <https://github.com/settings/personal-access-tokens/new>
   (Settings → Developer settings → Personal access tokens → **Fine-grained tokens**)
2. Configure:
   - **Token name:** `Portfolio CMS`
   - **Expiration:** 90 days (renew when it lapses)
   - **Repository access:** *Only select repositories* → `birukhios/birukhios.github.io`
   - **Permissions → Repository permissions → Contents:** **Read and write**
     *(this is the only permission needed)*
3. Click **Generate token** and copy it.
4. Open <https://birukhios.github.io/admin/>, choose **Sign In Using Access Token**,
   and paste it.

The token is stored in your browser's local storage only. It is never written to
this repo. If you ever paste it somewhere public, revoke it immediately at
<https://github.com/settings/tokens?type=beta>.

> **Editing locally instead:** the CMS also offers *"Work with Local Repository"*,
> which edits the files on your Mac with no token at all. Handy for bulk changes.

### How editing works

Content lives in `content/*.json`. Saving in the CMS commits to `main`, GitHub
Pages rebuilds, and the change is live in ~1 minute. The site reads these files
at runtime — the copies hardcoded inside `index.html` are only a fallback used
if a fetch fails, so the site can never render empty.

---

## 2. Analytics (GoatCounter)

1. Sign up at <https://www.goatcounter.com/signup> and pick a code, e.g. `birukhios`.
2. Set that code in **two** places:
   - `admin/analytics.html` → `var GOATCOUNTER_CODE = "birukhios";`
   - the tracking snippet in `index.html` — easiest via a rebuild:
     ```bash
     GOATCOUNTER_CODE=birukhios ./build.sh
     ```
3. Commit and push.

You'll then see countries, referrers, top pages and browsers — no cookies, no
consent banner required.

---

## 3. Rebuilding after a Claude Design re-export

`Biruk Habtamu Portfolio.dc.html` is the design source of truth.
`index.html` is the deployed build = that file **plus** two patches:

1. content arrays load from `content/*.json`
2. the GoatCounter snippet

`build.sh` re-applies both:

```bash
GOATCOUNTER_CODE=yourcode ./build.sh
```

If you changed content *in the design file* and want that to become the new CMS
content, regenerate the JSON from it:

```bash
node tools/extract-content.js
```

⚠️ That **overwrites** `content/*.json` with whatever is in the design file, so
it will discard edits made through the CMS. Normally you edit content in the CMS
and layout in Claude Design — only run this when you deliberately want the
design file's content to win.
