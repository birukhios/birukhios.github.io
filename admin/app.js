/* Portfolio CMS.
 *
 * Static-site CMS: reads and writes content/*.json straight through the GitHub
 * contents API using a personal access token held in localStorage. No server,
 * no build step, no third-party CMS.
 *
 * Routes (hash-based):
 *   #/                     collections
 *   #/c/<collection>       entry list
 *   #/c/<collection>/<i>   entry editor
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var app = $('#app');

  var state = {
    user: null,
    col: null,        // active collection definition
    items: [],        // working copy of the entries
    sha: null,        // sha of the file we loaded (needed to write)
    dirty: false,
  };

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function colBy(name) {
    return window.SCHEMA.filter(function (c) { return c.name === name; })[0];
  }
  function summaryOf(col, v, i) {
    try { var s = col.summary && col.summary(v); if (s) return s; } catch (e) {}
    return 'Item ' + (i + 1);
  }
  function blank(fields) {
    var o = {};
    fields.forEach(function (f) {
      o[f.key] = f.type === 'strings' || f.type === 'list' ? [] : f.type === 'bool' ? false : '';
    });
    return o;
  }
  function markDirty() {
    state.dirty = true;
    $('#savebar').classList.add('on');
    $('#saveMsg').textContent = 'Unsaved changes';
  }

  /* ── save ────────────────────────────────────────────────────────────── */
  function save() {
    var btn = $('#saveBtn');
    btn.disabled = true;
    $('#saveMsg').innerHTML = '<span class="spin"></span> Committing…';
    var msg = 'CMS: update ' + state.col.label.toLowerCase();
    GH.writeJson(state.col.file, { items: state.items }, state.sha, msg)
      .then(function (sha) {
        state.sha = sha;
        state.dirty = false;
        $('#saveMsg').innerHTML = '<span class="ok">Committed.</span> Live in about a minute.';
        setTimeout(function () {
          if (!state.dirty) $('#savebar').classList.remove('on');
        }, 4000);
      })
      .catch(function (e) {
        var conflict = /sha|conflict|409/i.test(e.message);
        $('#saveMsg').innerHTML = '<span class="err">' +
          (conflict ? 'This file changed on GitHub since you opened it. Reload to get the latest, then re-apply your edit.'
                    : e.message) + '</span>';
      })
      .then(function () { btn.disabled = false; });
  }

  /* ── field renderers ─────────────────────────────────────────────────── */
  function fieldNode(f, obj) {
    var id = 'f' + Math.random().toString(36).slice(2, 8);
    var wrap = el('div', { class: 'field' });
    if (f.type !== 'bool') wrap.appendChild(el('label', { for: id, text: f.label }));

    if (f.type === 'text' || f.type === 'area') {
      var input = el(f.type === 'area' ? 'textarea' : 'input', { id: id });
      if (f.type !== 'area') input.type = 'text';
      input.value = obj[f.key] == null ? '' : obj[f.key];
      input.addEventListener('input', function () { obj[f.key] = input.value; markDirty(); });
      wrap.appendChild(input);

    } else if (f.type === 'select') {
      var sel = el('select', { id: id });
      f.options.forEach(function (o) {
        var op = el('option', { value: o, text: o });
        if (obj[f.key] === o) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener('change', function () { obj[f.key] = sel.value; markDirty(); });
      wrap.appendChild(sel);

    } else if (f.type === 'bool') {
      var cb = el('input', { id: id });
      cb.type = 'checkbox';
      cb.checked = !!obj[f.key];
      cb.addEventListener('change', function () { obj[f.key] = cb.checked; markDirty(); });
      wrap.appendChild(el('label', { class: 'check', for: id }, [cb, el('span', { text: f.label })]));

    } else if (f.type === 'image') {
      wrap.appendChild(imageField(f, obj));

    } else if (f.type === 'strings') {
      wrap.appendChild(stringsField(f, obj));

    } else if (f.type === 'list') {
      return listField(f, obj);
    }

    if (f.hint) wrap.appendChild(el('p', { class: 'fhint', text: f.hint }));
    return wrap;
  }

  function imageField(f, obj) {
    var box = el('div', { class: 'imgf' });
    var prev = el('div', { class: 'prev' });
    var input = el('input', { });
    input.type = 'text';
    input.value = obj[f.key] || '';

    function paint() {
      var v = input.value;
      prev.style.backgroundImage = v ? 'url("../' + v + '")' : '';
      prev.textContent = v ? '' : 'none';
    }
    input.addEventListener('input', function () { obj[f.key] = input.value; paint(); markDirty(); });
    paint();

    var pick = el('button', { class: 'tiny', type: 'button', text: 'Choose', onclick: function () {
      openPicker(function (path) { input.value = path; obj[f.key] = path; paint(); markDirty(); });
    } });

    var up = el('button', { class: 'tiny', type: 'button', text: 'Upload', onclick: function () {
      var file = el('input', {});
      file.type = 'file';
      file.accept = 'image/*';
      file.addEventListener('change', function () {
        var fl = file.files[0];
        if (!fl) return;
        var rd = new FileReader();
        rd.onload = function () {
          var b64 = String(rd.result).split(',')[1];
          var safe = fl.name.replace(/[^a-zA-Z0-9._-]/g, '-');
          var path = 'uploads/cms/' + Date.now() + '-' + safe;
          up.disabled = true; up.textContent = 'Uploading…';
          GH.uploadBinary(path, b64, 'CMS: upload ' + safe)
            .then(function (p) {
              input.value = p; obj[f.key] = p; paint(); markDirty();
            })
            .catch(function (e) { alert('Upload failed: ' + e.message); })
            .then(function () { up.disabled = false; up.textContent = 'Upload'; });
        };
        rd.readAsDataURL(fl);
      });
      file.click();
    } });

    box.appendChild(prev);
    box.appendChild(el('div', { class: 'ctl' }, [input, el('div', { class: 'btns' }, [pick, up])]));
    return box;
  }

  function stringsField(f, obj) {
    if (!Array.isArray(obj[f.key])) obj[f.key] = [];
    var arr = obj[f.key];
    var host = el('div', { class: 'strings' });

    function draw() {
      host.innerHTML = '';
      arr.forEach(function (val, i) {
        var row = el('div', { class: 'srow' });
        var inp;
        if (f.of === 'image') {
          var holder = { v: val };
          inp = imageField({ key: 'v' }, holder);
          // keep the array in step with the sub-field's object
          var obs = setInterval(function () {
            if (holder.v !== arr[i]) { arr[i] = holder.v; }
          }, 400);
          row.addEventListener('remove', function () { clearInterval(obs); });
        } else {
          inp = el(f.of === 'area' ? 'textarea' : 'input', {});
          if (f.of !== 'area') inp.type = 'text';
          inp.value = val;
          inp.addEventListener('input', function () { arr[i] = inp.value; markDirty(); });
        }
        row.appendChild(inp);
        row.appendChild(el('button', { class: 'tiny danger', type: 'button', text: '✕',
          title: 'Remove', onclick: function () { arr.splice(i, 1); draw(); markDirty(); } }));
        host.appendChild(row);
      });
      host.appendChild(el('button', { class: 'tiny', type: 'button', text: '+ Add',
        onclick: function () { arr.push(''); draw(); markDirty(); } }));
    }
    draw();
    return host;
  }

  function listField(f, obj) {
    if (!Array.isArray(obj[f.key])) obj[f.key] = [];
    var arr = obj[f.key];
    var fs = el('fieldset');
    fs.appendChild(el('legend', { text: f.label }));
    var host = el('div');

    function draw() {
      host.innerHTML = '';
      arr.forEach(function (item, i) {
        var d = el('details', { class: 'item' });
        var label = (function () {
          try { return (f.summary && f.summary(item)) || ''; } catch (e) { return ''; }
        })() || (f.label + ' ' + (i + 1));

        var sum = el('summary', {}, [
          el('span', { class: 'grow', text: label }),
          el('button', { class: 'tiny', type: 'button', text: '↑', title: 'Move up',
            onclick: function (e) { e.preventDefault(); if (i > 0) { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); draw(); markDirty(); } } }),
          el('button', { class: 'tiny', type: 'button', text: '↓', title: 'Move down',
            onclick: function (e) { e.preventDefault(); if (i < arr.length - 1) { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); draw(); markDirty(); } } }),
          el('button', { class: 'tiny danger', type: 'button', text: '✕', title: 'Remove',
            onclick: function (e) {
              e.preventDefault();
              if (confirm('Remove “' + label + '”?')) { arr.splice(i, 1); draw(); markDirty(); }
            } }),
        ]);
        var body = el('div', { class: 'body' });
        f.fields.forEach(function (sub) { body.appendChild(fieldNode(sub, item)); });
        d.appendChild(sum);
        d.appendChild(body);
        host.appendChild(d);
      });
      host.appendChild(el('button', { class: 'tiny', type: 'button', text: '+ Add ' + f.label.toLowerCase(),
        onclick: function () { arr.push(blank(f.fields)); draw(); markDirty(); } }));
    }
    draw();
    fs.appendChild(host);
    return fs;
  }

  /* ── image picker ────────────────────────────────────────────────────── */
  var DIRS = ['uploads/cms', 'play', 'adler', 'crm-shots', 'radreader', 'posters',
              'uploads/profile', 'uploads/client-websites'];
  function openPicker(onPick) {
    var dlg = el('dialog', { class: 'picker' });
    var grid = el('div', { class: 'grid' });
    dlg.appendChild(el('div', { class: 'dhead' }, [
      el('strong', { text: 'Choose an image' }),
      el('span', { class: 'sp', style: 'margin-left:auto' }),
      el('button', { class: 'tiny', type: 'button', text: 'Close', onclick: function () { dlg.close(); } }),
    ]));
    dlg.appendChild(grid);
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.addEventListener('close', function () { dlg.remove(); });

    grid.appendChild(el('p', { html: '<span class="spin"></span> Loading…' }));
    Promise.all(DIRS.map(function (d) { return GH.listImages(d).catch(function () { return []; }); }))
      .then(function (all) {
        var paths = [].concat.apply([], all);
        grid.innerHTML = '';
        if (!paths.length) { grid.appendChild(el('p', { text: 'No images found.' })); return; }
        paths.forEach(function (p) {
          var b = el('button', { type: 'button', title: p, onclick: function () { onPick(p); dlg.close(); } });
          var im = el('img', { loading: 'lazy', alt: '', src: '../' + p });
          b.appendChild(im);
          grid.appendChild(b);
        });
      });
  }

  /* ── views ───────────────────────────────────────────────────────────── */
  function chrome(inner) {
    app.innerHTML = '';
    app.appendChild(el('header', { class: 'bar' }, [
      el('a', { class: 'brand', href: '#/', text: 'Portfolio CMS', style: 'text-decoration:none;color:inherit' }),
      el('span', { class: 'sp' }),
      el('span', { class: 'who', text: state.user ? '@' + state.user : '' }),
      el('button', { class: 'ghost', type: 'button', text: '◐', title: 'Toggle theme',
        onclick: function () {
          var n = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', n);
          try { localStorage.setItem('theme', n); } catch (e) {}
        } }),
      el('a', { class: 'btn', href: '#/',
                style: /#\/analytics/.test(location.hash) ? '' : 'background:var(--accent);border-color:var(--accent);color:#fff',
                text: 'Content' }),
      el('a', { class: 'btn', href: '#/analytics',
                style: /#\/analytics/.test(location.hash) ? 'background:var(--accent);border-color:var(--accent);color:#fff' : '',
                text: 'Analytics' }),
      el('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener', text: 'View site ↗' }),
      el('button', { type: 'button', text: 'Sign out', onclick: function () {
        if (state.dirty && !confirm('You have unsaved changes. Sign out anyway?')) return;
        GH.setToken(''); location.hash = '#/'; location.reload();
      } }),
    ]));
    app.appendChild(el('div', { class: 'wrap' }, [inner]));
    var bar = el('div', { class: 'savebar', id: 'savebar' }, [
      el('span', { class: 'msg', id: 'saveMsg' }),
      el('button', { type: 'button', text: 'Discard', onclick: function () {
        if (confirm('Discard your unsaved changes?')) location.reload();
      } }),
      el('button', { class: 'primary', id: 'saveBtn', type: 'button', text: 'Commit to GitHub', onclick: save }),
    ]);
    app.appendChild(bar);
  }

  function sideNav(active) {
    return el('nav', { class: 'side' }, [
      el('ul', {}, window.SCHEMA.map(function (c) {
        return el('li', {}, [
          el('a', { href: '#/c/' + c.name, class: c.name === active ? 'on' : '', }, [
            el('span', { text: c.label }),
          ]),
        ]);
      })),
      el('ul', { style: 'margin-top:18px;border-top:2px solid var(--rule);padding-top:4px' }, [
        el('li', { style: 'border-top:0' }, [
          el('a', { href: '#/analytics', class: active === 'analytics' ? 'on' : '' }, [
            el('span', { text: 'Analytics' }),
          ]),
        ]),
      ]),
    ]);
  }

  /* Analytics lives in the same shell as the content editor — one app, two
     tabs — rather than a separate page you have to navigate away to. */
  function viewAnalytics() {
    var panel = el('div', { class: 'panel' });
    chrome(el('div', { class: 'cols' }, [sideNav('analytics'), panel]));
    if (window.Analytics) window.Analytics.mount(panel);
    else panel.appendChild(el('p', { class: 'err', text: 'Analytics module failed to load.' }));
  }

  function viewHome() {
    var list = el('ul', { class: 'rows' });
    window.SCHEMA.forEach(function (c) {
      list.appendChild(el('li', {}, [
        el('span', { class: 'row-t' }, [
          el('a', { href: '#/c/' + c.name, text: c.label, style: 'text-decoration:none;color:inherit;font-weight:600' }),
          c.hint ? el('div', { class: 'fhint', text: c.hint }) : null,
        ]),
        el('a', { class: 'btn tiny', href: '#/c/' + c.name, text: 'Edit' }),
      ]));
    });

    var recent = el('ul', { class: 'commits' });
    GH.commits(5).then(function (cs) {
      cs.forEach(function (c) {
        recent.appendChild(el('li', {}, [
          el('span', { html: '<code>' + c.sha + '</code> ' + c.message + ' · ' +
            new Date(c.when).toLocaleString() }),
        ]));
      });
    }).catch(function () {});

    chrome(el('div', { class: 'cols' }, [
      sideNav(null),
      el('div', { class: 'panel' }, [
        el('div', { class: 'head' }, [el('h1', { text: 'Content' })]),
        el('p', { class: 'hint', text: 'Edits commit straight to ' + GH.repo +
          '. GitHub Pages redeploys in about a minute.' }),
        list,
        el('p', { class: 'kicker', text: 'Recent commits', style: 'margin-top:28px' }),
        recent,
      ]),
    ]));
  }

  function viewList(name) {
    var col = colBy(name);
    if (!col) return (location.hash = '#/');
    chrome(el('div', { class: 'cols' }, [
      sideNav(name),
      el('div', { class: 'panel' }, [el('p', { html: '<span class="spin"></span> Loading…' })]),
    ]));

    GH.readJson(col.file).then(function (r) {
      var items = Array.isArray(r.data) ? r.data : (r.data.items || []);
      state.col = col; state.items = items; state.sha = r.sha; state.dirty = false;

      var list = el('ul', { class: 'rows' });
      function draw() {
        list.innerHTML = '';
        items.forEach(function (v, i) {
          list.appendChild(el('li', {}, [
            el('span', { class: 'row-i', text: String(i + 1).padStart(2, '0') }),
            el('a', { class: 'row-t', href: '#/c/' + name + '/' + i, text: summaryOf(col, v, i),
                      style: 'text-decoration:none;color:inherit' }),
            el('span', { class: 'row-actions' }, [
              el('button', { class: 'tiny', type: 'button', text: '↑', title: 'Move up',
                onclick: function () { if (i > 0) { items.splice(i - 1, 0, items.splice(i, 1)[0]); draw(); markDirty(); } } }),
              el('button', { class: 'tiny', type: 'button', text: '↓', title: 'Move down',
                onclick: function () { if (i < items.length - 1) { items.splice(i + 1, 0, items.splice(i, 1)[0]); draw(); markDirty(); } } }),
              el('button', { class: 'tiny danger', type: 'button', text: 'Delete',
                onclick: function () {
                  if (confirm('Delete “' + summaryOf(col, v, i) + '”? This is committed on save.')) {
                    items.splice(i, 1); draw(); markDirty();
                  }
                } }),
            ]),
          ]));
        });
      }
      draw();

      chrome(el('div', { class: 'cols' }, [
        sideNav(name),
        el('div', { class: 'panel' }, [
          el('div', { class: 'head' }, [
            el('h1', { text: col.label }),
            el('span', { class: 'kicker', text: items.length + ' entries' }),
          ]),
          col.hint ? el('p', { class: 'hint', text: col.hint }) : null,
          list,
          el('p', {}, [
            el('button', { class: 'tiny', type: 'button', text: '+ Add entry', onclick: function () {
              items.push(blank(col.fields)); markDirty(); location.hash = '#/c/' + name + '/' + (items.length - 1);
            } }),
          ]),
        ]),
      ]));
    }).catch(function (e) {
      chrome(el('div', { class: 'panel' }, [el('p', { class: 'err', text: e.message })]));
    });
  }

  function viewEdit(name, idx) {
    var col = colBy(name);
    if (!col) return (location.hash = '#/');

    function render() {
      var item = state.items[idx];
      if (!item) return (location.hash = '#/c/' + name);
      var form = el('div');
      col.fields.forEach(function (f) { form.appendChild(fieldNode(f, item)); });

      chrome(el('div', { class: 'cols' }, [
        sideNav(name),
        el('div', { class: 'panel' }, [
          el('div', { class: 'head' }, [
            el('a', { href: '#/c/' + name, class: 'kicker', text: '← ' + col.label,
                      style: 'text-decoration:none' }),
          ]),
          el('div', { class: 'head' }, [el('h1', { text: summaryOf(col, item, idx) })]),
          form,
        ]),
      ]));
      if (state.dirty) markDirty();
    }

    if (state.col === col && state.items.length && state.sha) return render();
    chrome(el('div', { class: 'panel' }, [el('p', { html: '<span class="spin"></span> Loading…' })]));
    GH.readJson(col.file).then(function (r) {
      var items = Array.isArray(r.data) ? r.data : (r.data.items || []);
      state.col = col; state.items = items; state.sha = r.sha; state.dirty = false;
      render();
    }).catch(function (e) {
      chrome(el('div', { class: 'panel' }, [el('p', { class: 'err', text: e.message })]));
    });
  }

  /* ── login ───────────────────────────────────────────────────────────── */
  function viewLogin(err) {
    var input = el('input', { placeholder: 'github_pat_…' });
    input.type = 'password';
    var msg = el('p', { class: 'err', text: err || '' });

    function go() {
      var t = input.value.trim();
      if (!t) return;
      GH.setToken(t);
      msg.innerHTML = '<span class="spin"></span> Checking…';
      GH.me().then(function (login) {
        state.user = login;
        route();
      }).catch(function (e) {
        GH.setToken('');
        msg.textContent = e.message;
      });
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });

    app.innerHTML = '';
    app.appendChild(el('div', { class: 'center' }, [
      el('div', { class: 'login' }, [
        el('p', { class: 'kicker', text: 'Portfolio' }),
        el('h1', { text: 'CMS' }),
        el('p', { class: 'hint', text:
          'Sign in with a GitHub personal access token. It is stored only in this ' +
          'browser and sent only to github.com — never committed to the repo.' }),
        el('div', { class: 'field', style: 'margin-top:18px' }, [
          el('label', { text: 'Access token' }), input,
        ]),
        el('button', { class: 'primary', type: 'button', text: 'Sign in', onclick: go }),
        msg,
        el('details', { style: 'margin-top:22px' }, [
          el('summary', { class: 'kicker', text: 'How to create one', style: 'cursor:pointer' }),
          el('ol', { html:
            '<li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a></li>' +
            '<li><b>Repository access</b> → Only select repositories → <code>' + GH.repo + '</code></li>' +
            '<li><b>Permissions</b> → Repository permissions → <b>Contents: Read and write</b></li>' +
            '<li>Generate, copy, and paste it above.</li>' }),
        ]),
      ]),
    ]));
  }

  /* ── router ──────────────────────────────────────────────────────────── */
  function route() {
    if (!GH.hasToken()) return viewLogin();
    if (!state.user) {
      return GH.me().then(function (l) { state.user = l; route(); })
        .catch(function (e) { GH.setToken(''); viewLogin(e.message); });
    }
    // strip any query suffix (#/analytics?demo=1) before matching segments
    var h = (location.hash || '#/').replace(/^#\/?/, '').split('?')[0];
    var parts = h.split('/').filter(Boolean);
    if (parts[0] === 'analytics') return viewAnalytics();
    if (parts[0] === 'c' && parts[1] && parts[2] !== undefined) return viewEdit(parts[1], +parts[2]);
    if (parts[0] === 'c' && parts[1]) return viewList(parts[1]);
    return viewHome();
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', function (e) {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  route();
})();
