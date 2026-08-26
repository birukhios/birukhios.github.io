/* Minimal GitHub contents-API client.
 *
 * Everything runs in the browser against api.github.com using a fine-grained
 * personal access token that the user pastes at sign-in. The token is held in
 * localStorage and sent only to api.github.com — it is never written into the
 * repository.
 */
(function () {
  'use strict';

  var REPO = 'birukhios/birukhios.github.io';
  var BRANCH = 'main';
  var API = 'https://api.github.com';
  var KEY = 'cms.token';

  function token() {
    try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch (e) {}
  }

  function req(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: {
        Authorization: 'Bearer ' + token(),
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      if (r.status === 401) throw new Error('Token rejected. It may be expired or revoked.');
      if (r.status === 403) throw new Error('Forbidden. The token likely lacks Contents: Read and write on this repository.');
      if (r.status === 404 && opts.softly404) return null;
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(j.message || 'GitHub returned ' + r.status);
        });
      }
      return r.status === 204 ? null : r.json();
    });
  }

  /* base64 <-> UTF-8, since GitHub returns/accepts base64 content */
  function decode(b64) {
    var bin = atob(b64.replace(/\n/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function encode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  window.GH = {
    repo: REPO,
    branch: BRANCH,
    getToken: token,
    setToken: setToken,
    hasToken: function () { return !!token(); },

    /** Verify the token and return the login name. */
    me: function () {
      return req('/user').then(function (u) { return u.login; });
    },

    /** Read a JSON file. Resolves { data, sha }. */
    readJson: function (path) {
      return req('/repos/' + REPO + '/contents/' + encodeURI(path) + '?ref=' + BRANCH)
        .then(function (r) {
          return { data: JSON.parse(decode(r.content)), sha: r.sha };
        });
    },

    /** Write a JSON file. `sha` must be the one from the last read. */
    writeJson: function (path, data, sha, message) {
      return req('/repos/' + REPO + '/contents/' + encodeURI(path), {
        method: 'PUT',
        body: {
          message: message,
          content: encode(JSON.stringify(data, null, 2) + '\n'),
          sha: sha,
          branch: BRANCH,
        },
      }).then(function (r) { return r.content.sha; });
    },

    /** Upload a binary file (images). Resolves the repo-relative path. */
    uploadBinary: function (path, base64, message) {
      return req('/repos/' + REPO + '/contents/' + encodeURI(path) + '?ref=' + BRANCH, { softly404: true })
        .then(function (existing) {
          return req('/repos/' + REPO + '/contents/' + encodeURI(path), {
            method: 'PUT',
            body: {
              message: message,
              content: base64,
              sha: existing ? existing.sha : undefined,
              branch: BRANCH,
            },
          });
        })
        .then(function () { return path; });
    },

    /** List image paths already in the repo, for the picker. */
    listImages: function (dir) {
      return req('/repos/' + REPO + '/contents/' + encodeURI(dir) + '?ref=' + BRANCH, { softly404: true })
        .then(function (items) {
          if (!Array.isArray(items)) return [];
          return items
            .filter(function (i) { return i.type === 'file' && /\.(png|jpe?g|gif|svg|webp)$/i.test(i.name); })
            .map(function (i) { return i.path; });
        });
    },

    /** Most recent commits, for the activity strip. */
    commits: function (n) {
      return req('/repos/' + REPO + '/commits?sha=' + BRANCH + '&per_page=' + (n || 5))
        .then(function (list) {
          return (list || []).map(function (c) {
            return {
              sha: c.sha.slice(0, 7),
              message: (c.commit.message || '').split('\n')[0],
              when: c.commit.author.date,
              url: c.html_url,
            };
          });
        });
    },
  };
})();
