/* Analytics dashboard — GA4 Data API, straight from the browser.
 *
 * Google blocks its own dashboard from being iframed, so instead of embedding
 * we query the Data API and render natively. Auth is Google Identity Services
 * token flow: the OAuth *client ID* is public by design (browser apps have no
 * client secret), and the access token lives in memory only — never stored.
 *
 * Needs two values, entered once and kept in localStorage:
 *   ga.clientId    OAuth 2.0 Web client ID  (…apps.googleusercontent.com)
 *   ga.propertyId  GA4 property ID — the NUMERIC one, not G-XXXXXXX
 */
(function () {
  'use strict';

  var SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
  var API = 'https://analyticsdata.googleapis.com/v1beta/properties/';
  var host = document.getElementById('view');

  var cfg = {
    get clientId() { try { return localStorage.getItem('ga.clientId') || ''; } catch (e) { return ''; } },
    get propertyId() { try { return localStorage.getItem('ga.propertyId') || ''; } catch (e) { return ''; } },
    save: function (c, p) {
      try { localStorage.setItem('ga.clientId', c); localStorage.setItem('ga.propertyId', p); } catch (e) {}
    },
    clear: function () {
      try { localStorage.removeItem('ga.clientId'); localStorage.removeItem('ga.propertyId'); } catch (e) {}
    },
  };

  var token = null;       // access token, memory only
  var tokenClient = null;
  var days = 28;

  /* ── tiny dom helper ─────────────────────────────────────────────────── */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  var svgNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs) {
    var n = document.createElementNS(svgNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  /* auto-compact: 1,284 / 12.9K / 1.2M */
  function fmt(v) {
    v = +v || 0;
    if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 1e4) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return v.toLocaleString();
  }

  /* ── demo mode ───────────────────────────────────────────────────────────
     ?demo=1 renders the dashboard from sample figures, so the layout can be
     previewed (and reviewed) before the OAuth setup is done. Never touches
     the network. */
  var DEMO = /[?&]demo=1/.test(location.search);
  function demoReport(body, realtime) {
    var mk = function (pairs) {
      return { rows: pairs.map(function (p) {
        return { dimensionValues: [{ value: p[0] }], metricValues: [{ value: String(p[1]) }] };
      }) };
    };
    if (realtime) return mk([['x', 3]]);
    var dims = (body.dimensions || []).map(function (d) { return d.name; });
    if (!dims.length) {
      return { rows: [{ metricValues: [
        { value: '1284' }, { value: '1663' }, { value: '4102' }, { value: '0.62' }] }] };
    }
    if (dims[0] === 'date') {
      var out = [], base = 28, today = new Date();
      for (var i = days - 1; i >= 0; i--) {
        var d = new Date(today.getTime() - i * 864e5);
        var iso = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
        out.push([iso, Math.max(4, Math.round(base + 22 * Math.sin(i / 3.1) + 14 * Math.random()))]);
      }
      return mk(out);
    }
    if (dims[0] === 'country') {
      return mk([['Ethiopia', 412], ['United States', 268], ['United Kingdom', 143],
                 ['Germany', 96], ['Kenya', 74], ['India', 58], ['Canada', 41], ['Nigeria', 33]]);
    }
    if (dims[0] === 'sessionDefaultChannelGroup') {
      return mk([['Direct', 702], ['Organic Search', 511], ['Referral', 244],
                 ['Organic Social', 138], ['Email', 68]]);
    }
    return mk([['/work', 1420], ['/case/rad-reader', 612], ['/play', 498],
               ['/case/adler-ds', 401], ['/about', 355], ['/case/crm', 288],
               ['/resume', 201], ['/contact', 164]]);
  }

  /* ── API ─────────────────────────────────────────────────────────────── */
  function report(body, realtime) {
    if (DEMO) return Promise.resolve(demoReport(body, realtime));
    return fetch(API + cfg.propertyId + ':' + (realtime ? 'runRealtimeReport' : 'runReport'), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) {
      if (r.status === 401) { token = null; throw new Error('AUTH'); }
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          var m = (j.error && j.error.message) || ('HTTP ' + r.status);
          if (r.status === 403) {
            m = 'Access denied. Check that the Google Analytics Data API is enabled in your ' +
                'Cloud project, and that this Google account can view the property.';
          }
          throw new Error(m);
        });
      }
      return r.json();
    });
  }
  function rows(res, dim) {
    return ((res && res.rows) || []).map(function (r) {
      return {
        key: r.dimensionValues[0].value,
        val: +r.metricValues[0].value,
        dim: dim,
      };
    });
  }
  function ranked(dimension, metric, limit) {
    return report({
      dateRanges: [{ startDate: days + 'daysAgo', endDate: 'today' }],
      dimensions: [{ name: dimension }],
      metrics: [{ name: metric }],
      orderBys: [{ metric: { metricName: metric }, desc: true }],
      limit: limit || 8,
    }).then(function (r) { return rows(r, dimension); });
  }

  /* ── renderers ───────────────────────────────────────────────────────── */
  function tile(label, value, sub, hero) {
    return el('div', { class: 'tile' + (hero ? ' hero' : '') }, [
      el('div', { class: 'lab', text: label }),
      el('div', { class: 'val', text: value }),
      sub ? el('div', { class: 'sub', html: sub }) : null,
    ]);
  }

  /* Ranked horizontal bars: magnitude by identity. Value sits in its own
     right-hand column so it can never collide with or be clipped by the mark. */
  function barList(data, unit) {
    if (!data.length) return el('p', { class: 'empty', text: 'No data for this period yet.' });
    var max = Math.max.apply(null, data.map(function (d) { return d.val; })) || 1;
    var wrap = el('div', { class: 'blist' });
    data.forEach(function (d) {
      wrap.appendChild(el('div', { class: 'brow', title: d.key + ' — ' + d.val.toLocaleString() + ' ' + unit }, [
        el('div', { class: 'blabel', text: d.key || '(not set)' }),
        el('div', { class: 'btrack' }, [
          el('div', { class: 'bfill', style: 'width:' + Math.max(1, (d.val / max) * 100) + '%' }),
        ]),
        el('div', { class: 'bval', text: fmt(d.val) }),
      ]));
    });
    return wrap;
  }

  /* Accessibility: every chart's numbers are also available as a table. */
  function tableView(data, dimLabel, metricLabel) {
    var t = el('table', { class: 'dv' });
    t.appendChild(el('thead', {}, [el('tr', {}, [
      el('th', { text: dimLabel }), el('th', { class: 'n', text: metricLabel }),
    ])]));
    var tb = el('tbody');
    data.forEach(function (d) {
      tb.appendChild(el('tr', {}, [
        el('td', { text: d.key || '(not set)' }),
        el('td', { class: 'n', text: d.val.toLocaleString() }),
      ]));
    });
    t.appendChild(tb);
    return t;
  }

  function chartBlock(title, sub, body, data, dimLabel, metricLabel, wide) {
    var showing = false;
    var slot = el('div', {}, [body]);
    var toggle = el('button', { class: 'tiny', type: 'button', text: 'Table', onclick: function () {
      showing = !showing;
      slot.innerHTML = '';
      slot.appendChild(showing ? tableView(data, dimLabel, metricLabel) : body);
      toggle.textContent = showing ? 'Chart' : 'Table';
    } });
    return el('section', { class: 'chart' + (wide ? ' wide' : '') }, [
      el('div', { class: 'chead' }, [
        el('h2', { text: title }),
        el('span', { class: 'csub', text: sub || '' }),
        toggle,
      ]),
      slot,
    ]);
  }

  /* Trend line with crosshair + tooltip. */
  function trend(series) {
    var box = el('div', { class: 'trend' });
    if (!series.length) { box.appendChild(el('p', { class: 'empty', text: 'No data yet.' })); return box; }

    var W = 720, H = 190, PL = 38, PR = 10, PT = 12, PB = 22;
    var max = Math.max.apply(null, series.map(function (d) { return d.val; })) || 1;
    // round the axis top to a clean number
    var step = Math.pow(10, Math.floor(Math.log10(max || 1)));
    var top = Math.ceil(max / step) * step || 1;
    var x = function (i) { return PL + (i / Math.max(1, series.length - 1)) * (W - PL - PR); };
    var y = function (v) { return PT + (1 - v / top) * (H - PT - PB); };

    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', role: 'img' });
    svg.setAttribute('aria-label', 'Visitors per day over the last ' + days + ' days');

    [0, 0.5, 1].forEach(function (f) {
      var v = top * f, yy = y(v);
      var ln = s('line', { class: 'gl', x1: PL, x2: W - PR, y1: yy, y2: yy });
      svg.appendChild(ln);
      var tx = s('text', { class: 'tick', x: 0, y: yy + 3 });
      tx.textContent = fmt(v);
      svg.appendChild(tx);
    });

    var d = series.map(function (p, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(p.val); }).join(' ');
    svg.appendChild(s('path', { class: 'ar', d: d + ' L' + x(series.length - 1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + ' Z' }));
    svg.appendChild(s('path', { class: 'ln', d: d }));

    // end marker only — labelling every point is noise
    var last = series[series.length - 1];
    svg.appendChild(s('circle', { class: 'dot', cx: x(series.length - 1), cy: y(last.val), r: 4.5 }));

    var cross = s('line', { class: 'cross', x1: 0, x2: 0, y1: PT, y2: H - PB, opacity: 0 });
    svg.appendChild(cross);
    var hit = s('rect', { class: 'hit', x: PL, y: 0, width: W - PL - PR, height: H });
    svg.appendChild(hit);

    var tip = el('div', { class: 'tip' });
    box.appendChild(svg);
    box.appendChild(tip);

    hit.addEventListener('mousemove', function (e) {
      var r = svg.getBoundingClientRect();
      var rel = (e.clientX - r.left) / r.width * W;
      var i = Math.round((rel - PL) / ((W - PL - PR) / Math.max(1, series.length - 1)));
      i = Math.max(0, Math.min(series.length - 1, i));
      var p = series[i];
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity', 1);
      tip.innerHTML = p.label + ' · <b>' + p.val.toLocaleString() + '</b>';
      tip.style.left = (x(i) / W * r.width) + 'px';
      tip.style.top = (y(p.val) / H * r.height) + 'px';
      tip.classList.add('on');
    });
    hit.addEventListener('mouseleave', function () {
      cross.setAttribute('opacity', 0); tip.classList.remove('on');
    });
    return box;
  }

  /* ── views ───────────────────────────────────────────────────────────── */
  function setupView(err) {
    var ci = el('input', { type: 'text', placeholder: '1234-abc.apps.googleusercontent.com', value: cfg.clientId });
    var pi = el('input', { type: 'text', placeholder: '123456789', value: cfg.propertyId });
    host.innerHTML = '';
    host.appendChild(el('div', { class: 'setup' }, [
      el('h1', { text: 'Connect Google Analytics' }),
      el('p', { class: 'hint', text:
        'Google does not allow its dashboard to be embedded, so this reads the ' +
        'Analytics Data API directly and draws the numbers here. One-time setup:' }),
      el('ol', { html:
        '<li>In <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a>, create (or pick) a project.</li>' +
        '<li><b>APIs &amp; Services → Library</b> → enable <b>Google Analytics Data API</b>.</li>' +
        '<li><b>OAuth consent screen</b> → External → add yourself under <b>Test users</b>.</li>' +
        '<li><b>Credentials → Create credentials → OAuth client ID → Web application</b>.<br>' +
        'Authorised JavaScript origins: <code>https://birukhios.github.io</code> ' +
        'and <code>http://localhost:4173</code></li>' +
        '<li>Copy the <b>Client ID</b> below. (There is no secret to paste — browser apps don\'t use one.)</li>' +
        '<li>Your <b>Property ID</b> is the numeric one in GA under <b>Admin → Property details</b> — not <code>G-GJ4L5PVGNK</code>.</li>' }),
      el('div', { class: 'field' }, [el('label', { text: 'OAuth client ID' }), ci]),
      el('div', { class: 'field' }, [el('label', { text: 'GA4 property ID (numeric)' }), pi]),
      err ? el('p', { class: 'err', text: err }) : null,
      el('button', { class: 'primary', type: 'button', text: 'Save and connect', onclick: function () {
        if (!ci.value.trim() || !pi.value.trim()) return;
        cfg.save(ci.value.trim(), pi.value.trim());
        boot();
      } }),
    ]));
  }

  function connectView(err) {
    host.innerHTML = '';
    host.appendChild(el('div', { class: 'setup' }, [
      el('h1', { text: 'Analytics' }),
      el('p', { class: 'hint', text: 'Authorise with the Google account that can view this property.' }),
      err ? el('p', { class: 'err', text: err }) : null,
      el('button', { class: 'primary', type: 'button', text: 'Connect Google Analytics',
        onclick: function () { authorize(true); } }),
      el('p', {}, [el('button', { class: 'tiny', type: 'button', text: 'Change setup',
        onclick: function () { setupView(); } })]),
    ]));
  }

  function dashboard() {
    host.innerHTML = '';
    var filters = el('div', { class: 'filters' }, [
      el('span', { class: 'kicker', text: 'Last' }),
      el('span', { class: 'range' }, [7, 28, 90].map(function (d) {
        return el('button', { class: 'tiny' + (d === days ? ' on' : ''), type: 'button',
          text: d + ' days', onclick: function () { days = d; dashboard(); } });
      })),
      el('span', { class: 'sp' }),
      el('a', { class: 'btn tiny', href: 'https://analytics.google.com/', target: '_blank',
        rel: 'noopener', text: 'Open GA ↗' }),
      el('button', { class: 'tiny', type: 'button', text: 'Change setup', onclick: function () { setupView(); } }),
    ]);
    host.appendChild(filters);
    var body = el('div', {}, [el('p', { html: '<span class="spin"></span> Loading…' })]);
    host.appendChild(body);

    var range = { startDate: days + 'daysAgo', endDate: 'today' };
    Promise.all([
      report({ dateRanges: [range], metrics: [
        { name: 'totalUsers' }, { name: 'sessions' },
        { name: 'screenPageViews' }, { name: 'engagementRate' }] }),
      report({ metrics: [{ name: 'activeUsers' }] }, true),
      report({ dateRanges: [range], dimensions: [{ name: 'date' }],
               metrics: [{ name: 'totalUsers' }],
               orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400 }),
      ranked('country', 'totalUsers', 8),
      ranked('sessionDefaultChannelGroup', 'sessions', 6),
      ranked('pagePath', 'screenPageViews', 8),
    ]).then(function (r) {
      var tot = (r[0].rows && r[0].rows[0]) ? r[0].rows[0].metricValues.map(function (m) { return +m.value; }) : [0, 0, 0, 0];
      var live = (r[1].rows && r[1].rows[0]) ? +r[1].rows[0].metricValues[0].value : 0;
      var series = ((r[2].rows) || []).map(function (row) {
        var d = row.dimensionValues[0].value; // YYYYMMDD
        return {
          label: d.slice(6, 8) + '/' + d.slice(4, 6),
          val: +row.metricValues[0].value,
        };
      });

      body.innerHTML = '';
      body.appendChild(el('div', { class: 'tiles' }, [
        tile('Visitors', fmt(tot[0]), 'in the last ' + days + ' days', true),
        tile('Sessions', fmt(tot[1]), ''),
        tile('Page views', fmt(tot[2]), 'across all screens'),
        tile('Engagement', Math.round(tot[3] * 100) + '%', 'of sessions engaged'),
        tile('Active now', String(live), '<span class="live-dot"></span>last 30 min'),
      ]));

      body.appendChild(el('div', { class: 'charts' }, [
        chartBlock('Visitors per day', 'last ' + days + ' days', trend(series),
                   series.map(function (p) { return { key: p.label, val: p.val }; }), 'Date', 'Visitors', true),
        chartBlock('Where visitors are', 'by country', barList(r[3], 'visitors'),
                   r[3], 'Country', 'Visitors'),
        chartBlock('How they found you', 'by channel', barList(r[4], 'sessions'),
                   r[4], 'Channel', 'Sessions'),
        chartBlock('What they looked at', 'by screen', barList(r[5], 'views'),
                   r[5], 'Screen', 'Views', true),
      ]));
    }).catch(function (e) {
      if (e.message === 'AUTH') return connectView('Session expired — reconnect.');
      body.innerHTML = '';
      body.appendChild(el('p', { class: 'err', text: e.message }));
    });
  }

  /* ── auth ────────────────────────────────────────────────────────────── */
  function authorize(interactive) {
    if (!window.google || !google.accounts || !google.accounts.oauth2) {
      return connectView('Google sign-in library did not load.');
    }
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: cfg.clientId,
        scope: SCOPE,
        callback: function (resp) {
          if (resp && resp.access_token) { token = resp.access_token; dashboard(); }
          else connectView('Authorisation failed.');
        },
        error_callback: function (err) {
          connectView((err && err.type === 'popup_closed')
            ? 'Sign-in window closed before finishing.'
            : 'Authorisation failed. Check the client ID and that this origin is authorised.');
        },
      });
    }
    // '' asks silently when already granted; 'consent' forces the prompt
    tokenClient.requestAccessToken({ prompt: interactive ? '' : 'none' });
  }

  function boot() {
    if (DEMO) return dashboard();
    if (!cfg.clientId || !cfg.propertyId) return setupView();
    connectView();
    // try a silent grant so a return visit lands straight on the dashboard
    setTimeout(function () { authorize(true); }, 60);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
