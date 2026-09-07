// ==UserScript==
// @name         OctoLink Bypass Loader — aozoracyrus fork
// @namespace    https://github.com/aozoracyrus/octolink-bypass
// @version      5.0.0
// @description  Loader v5.0.0: theo đúng bản gốc - match tất cả domain, xử lý redirect trước
// @author       aozoracyrus (gốc: Chodenocto)
// @match        *://minuc.vn/*
// @match        *://linkhuongdan.online/*
// @match        *://totreview.com/*
// @match        *://octolink.vip/*
// @match        *://*.minuc.vn/*
// @match        *://*.linkhuongdan.online/*
// @match        *://*.totreview.com/*
// @match        *://*.octolink.vip/*
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        GM_getResourceText
// @grant        GM_addElement
// @grant        GM_openInTab
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.addStyle
// @grant        GM.setClipboard
// @grant        GM.notification
// @grant        GM.registerMenuCommand
// @grant        GM.getResourceText
// @grant        GM.addElement
// @grant        GM.openInTab
// @connect      *
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// @connect      octolink.vip
// @connect      api.github.com
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/aozoracyrus/octolink-bypass/main/loader.user.js
// @updateURL    https://raw.githubusercontent.com/aozoracyrus/octolink-bypass/main/loader.user.js
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  var currentHost = window.location.hostname;
  var hasRedirectTarget = new URLSearchParams(window.location.search).has('redirect_to_octo');
  
  // QUAN TRONG: check redirect TRUOC, vi redirect handler chay tren MOI domain
  if (hasRedirectTarget) {
    var redirectTarget = new URLSearchParams(window.location.search).get('redirect_to_octo');
    if (redirectTarget && /^https?:\/\//i.test(redirectTarget)) {
      try {
        document.body.innerHTML =
          '<div style="background:#0a0a0a;color:#e0e0e0;height:100vh;display:flex;flex-direction:column;' +
          'align-items:center;justify-content:center;font-family:sans-serif;font-size:18px;text-align:center;padding:20px">' +
          '🚀<br>ĐANG ĐIỀU HƯỚNG TỐC ĐỘ CAO<br><small>Xin vui lòng chờ trong giây lát…</small></div>';
      } catch (e) {}
      setTimeout(function () {
        try { window.location.href = redirectTarget; } catch (e) {}
      }, 1000);
      return;
    }
  }

  var isSupportedHost =
    currentHost === 'minuc.vn' ||
    currentHost.endsWith('.minuc.vn') ||
    currentHost === 'linkhuongdan.online' ||
    currentHost.endsWith('.linkhuongdan.online') ||
    currentHost === 'totreview.com' ||
    currentHost.endsWith('.totreview.com') ||
    currentHost === 'octolink.vip' ||
    currentHost.endsWith('.octolink.vip');

  if (!isSupportedHost) return;

  if (
    (currentHost === 'octolink.vip' || currentHost.endsWith('.octolink.vip')) &&
    /^\/+finish(\/|$)/i.test(window.location.pathname || '')
  ) {
    console.log('[Loader] Trang captcha — bo qua, khong nap script.');
    return;
  }
  if (window.__otlLoaderRunning) return;
  window.__otlLoaderRunning = true;

  var REPO_BASE = 'https://raw.githubusercontent.com/aozoracyrus/octolink-bypass/refs/heads/main/';
  var REPO_BASE_FALLBACK = 'https://cdn.jsdelivr.net/gh/aozoracyrus/octolink-bypass@main/';
  var SCRIPT_URL = REPO_BASE + 'octolink.js';
  var SCRIPT_URL_FALLBACK = REPO_BASE_FALLBACK + 'octolink.js';
  var LOADER_URL = REPO_BASE + 'loader.user.js';
  var MAX_ATTEMPTS = 3;
  var RETRY_DELAY = 1500;

  var PAYLOAD_CACHE_KEY = 'otl_payload_cache_v5';
  var PAYLOAD_TS_KEY = 'otl_payload_ts_v5';
  var UPDATE_CHECK_KEY = 'otl_loader_update_check_v5';
  var UPDATE_FOUND_KEY = 'otl_loader_update_found_v5';
  var UPDATE_CHECK_INTERVAL = 6 * 3600 * 1000;

  function modernApi(name) {
    if (typeof GM !== 'undefined' && GM && typeof GM[name] === 'function') {
      return GM[name].bind(GM);
    }
    return undefined;
  }

  var requestApi = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : modernApi('xmlHttpRequest');
  var getValueApi = typeof GM_getValue === 'function' ? GM_getValue : modernApi('getValue');
  var setValueApi = typeof GM_setValue === 'function' ? GM_setValue : modernApi('setValue');
  var notifyApi = typeof GM_notification === 'function' ? GM_notification : modernApi('notification');
  var menuApi = typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : modernApi('registerMenuCommand');
  var openTabApi = typeof GM_openInTab === 'function' ? GM_openInTab : modernApi('openInTab');

  function storeGet(key, fallback) {
    try {
      if (getValueApi) {
        var v = getValueApi(key, fallback);
        if (v !== undefined && v !== null) return v;
      }
    } catch (error) {}
    return fallback;
  }

  function storeSet(key, value) {
    try {
      if (setValueApi) setValueApi(key, value);
    } catch (error) {}
  }

  function currentVersion() {
    try {
      if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) {
        return String(GM_info.script.version || '0');
      }
    } catch (error) {}
    return '0';
  }

  function compareVersion(a, b) {
    var pa = String(a).split('.');
    var pb = String(b).split('.');
    var len = Math.max(pa.length, pb.length);
    for (var i = 0; i < len; i++) {
      var x = parseInt(pa[i], 10) || 0;
      var y = parseInt(pb[i], 10) || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }

  function openUpdatePage() {
    try {
      if (openTabApi) {
        openTabApi(LOADER_URL, { active: true, insert: true });
        return;
      }
    } catch (error) {}
    try {
      window.open(LOADER_URL, '_blank');
    } catch (error) {
      console.warn('[Loader] Khong mo duoc trang cap nhat: ' + LOADER_URL);
    }
  }

  function announceUpdate(remoteVersion) {
    var mine = currentVersion();
    console.warn('[Loader] Co ban moi: ' + mine + ' → ' + remoteVersion + '. ' + LOADER_URL);
    try {
      if (notifyApi) {
        notifyApi({
          title: 'OctoLink Bypass',
          text: 'Co ban cap nhat ' + remoteVersion + ' (dang dung ' + mine + '). Bam de cai.',
          timeout: 12000,
          onclick: openUpdatePage
        });
      }
    } catch (error) {}
    try {
      if (menuApi) {
        menuApi('⬆ Cai ban moi ' + remoteVersion, openUpdatePage);
      }
    } catch (error) {}
  }

  function checkLoaderUpdate(force) {
    var now = Date.now();
    if (!force) {
      var last = parseInt(storeGet(UPDATE_CHECK_KEY, 0), 10) || 0;
      if (now - last < UPDATE_CHECK_INTERVAL) {
        var known = String(storeGet(UPDATE_FOUND_KEY, '') || '');
        if (known && compareVersion(known, currentVersion()) > 0) announceUpdate(known);
        return;
      }
    }
    storeSet(UPDATE_CHECK_KEY, String(now));

    function handleHeader(text) {
      var match = String(text || '').match(/@version\s+([0-9][0-9.]*)/);
      if (!match) return;
      var remote = match[1];
      if (compareVersion(remote, currentVersion()) > 0) {
        storeSet(UPDATE_FOUND_KEY, remote);
        announceUpdate(remote);
      } else {
        storeSet(UPDATE_FOUND_KEY, '');
        if (force) console.log('[Loader] Dang dung ban moi nhat (' + currentVersion() + ').');
      }
    }

    var url = LOADER_URL + '?t=' + now;
    if (requestApi) {
      try {
        requestApi({
          method: 'GET',
          url: url,
          timeout: 15000,
          headers: { Accept: 'text/plain, */*', 'Cache-Control': 'no-cache' },
          onload: function (response) {
            if (response.status === 200) handleHeader(response.responseText);
          },
          onerror: function () {},
          ontimeout: function () {}
        });
        return;
      } catch (error) {}
    }
    if (typeof fetch === 'function') {
      fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit' })
        .then(function (response) {
          return response.ok ? response.text() : '';
        })
        .then(handleHeader)
        .catch(function () {});
    }
  }

  var apiNames = [
    'GM_xmlhttpRequest',
    'GM_getValue',
    'GM_setValue',
    'GM_addStyle',
    'GM_setClipboard',
    'GM_notification',
    'GM_registerMenuCommand',
    'GM_getResourceText',
    'GM_addElement'
  ];

  var apiValues = [
    requestApi,
    getValueApi,
    setValueApi,
    typeof GM_addStyle === 'function' ? GM_addStyle : modernApi('addStyle'),
    typeof GM_setClipboard === 'function' ? GM_setClipboard : modernApi('setClipboard'),
    notifyApi,
    menuApi,
    typeof GM_getResourceText === 'function' ? GM_getResourceText : modernApi('getResourceText'),
    typeof GM_addElement === 'function' ? GM_addElement : modernApi('addElement')
  ];

  function isValidPayload(source) {
    return (
      typeof source === 'string' &&
      source.length >= 1000 &&
      source.indexOf('var main = function') !== -1
    );
  }

  function executeSource(source) {
    if (!isValidPayload(source)) {
      throw new Error('Payload GitHub khong hop le');
    }
    var runner = Function.apply(null, apiNames.concat(source + '\n//# sourceURL=otl-octolink.js'));
    runner.apply(window, apiValues);
  }

  function cachePayload(source) {
    if (!setValueApi || !isValidPayload(source)) return;
    try {
      if (storeGet(PAYLOAD_CACHE_KEY, '') === source) {
        storeSet(PAYLOAD_TS_KEY, String(Date.now()));
        return;
      }
      storeSet(PAYLOAD_CACHE_KEY, source);
      storeSet(PAYLOAD_TS_KEY, String(Date.now()));
      console.log('[Loader] Da luu ban du phong (' + Math.round(source.length / 1024) + 'KB)');
    } catch (error) {}
  }

  function runCachedPayload(reason) {
    var cached = String(storeGet(PAYLOAD_CACHE_KEY, '') || '');
    if (!isValidPayload(cached)) return false;
    var ts = parseInt(storeGet(PAYLOAD_TS_KEY, 0), 10) || 0;
    var ageHours = ts ? Math.round((Date.now() - ts) / 3600000) : -1;
    console.warn('[Loader] ' + reason + ' → dung ban du phong' + (ageHours >= 0 ? ' (luu ' + ageHours + 'h truoc)' : ''));
    try {
      executeSource(cached);
      return true;
    } catch (error) {
      console.error('[Loader] Ban du phong loi:', error);
      return false;
    }
  }

  function loadWithFetch(url, onSuccess, onFailure) {
    if (typeof fetch !== 'function') {
      onFailure(new Error('Khong co API request tuong thich'));
      return;
    }
    fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
      })
      .then(onSuccess)
      .catch(onFailure);
  }

  function loadSource(attempt) {
    var base = attempt >= 3 ? SCRIPT_URL_FALLBACK : SCRIPT_URL;
    var url = base + '?t=' + Date.now() + '&attempt=' + attempt;
    var settled = false;

    function success(source, status) {
      if (settled) return;
      settled = true;
      try {
        console.log('[Loader] HTTP status:', status || 200, '·', base);
        executeSource(source);
        console.log('[Loader] Loaded script (' + Math.round(source.length / 1024) + 'KB)');
        cachePayload(source);
      } catch (error) {
        window.__otlLoaderRunning = false;
        console.error('[Loader] Execute error:', error);
      }
    }

    function retry(error) {
      if (settled) return;
      settled = true;
      if (attempt >= MAX_ATTEMPTS) {
        console.error('[Loader] Load failed after ' + attempt + ' attempts:', error);
        if (!runCachedPayload('Tai payload that bai')) {
          window.__otlLoaderRunning = false;
        }
        return;
      }
      console.warn('[Loader] Retry ' + (attempt + 1) + '/' + MAX_ATTEMPTS, error);
      setTimeout(function () {
        loadSource(attempt + 1);
      }, RETRY_DELAY * attempt);
    }

    if (!requestApi) {
      loadWithFetch(url, function (source) { success(source, 200); }, retry);
      return;
    }

    try {
      var requestResult = requestApi({
        method: 'GET',
        url: url,
        timeout: 20000,
        headers: {
          Accept: 'text/javascript, */*',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        },
        onload: function (response) {
          if (response.status !== 200) {
            retry(new Error('HTTP ' + response.status));
            return;
          }
          success(response.responseText, response.status);
        },
        onerror: function (error) {
          retry(error || new Error('Network error'));
        },
        ontimeout: function () {
          retry(new Error('Request timeout'));
        }
      });

      if (requestResult && typeof requestResult.then === 'function') {
        requestResult
          .then(function (response) {
            if (settled || !response) return;
            if (response.status !== 200) {
              retry(new Error('HTTP ' + response.status));
              return;
            }
            success(response.responseText, response.status);
          })
          .catch(retry);
      }
    } catch (error) {
      loadWithFetch(url, function (source) { success(source, 200); }, retry);
    }
  }

  try {
    if (menuApi) {
      menuApi('Xoa cache loi (buoc tai lai octolink.js)', function () {
        storeSet(PAYLOAD_CACHE_KEY, '');
        storeSet(PAYLOAD_TS_KEY, '0');
        try { if (notifyApi) notifyApi({ title: 'OctoLink Bypass', text: 'Da xoa cache loi — tai lai trang.', timeout: 4000 }); } catch (e) {}
      });
      menuApi('Kiem tra cap nhat', function () {
        console.log('[Loader] Dang kiem tra cap nhat...');
        checkLoaderUpdate(true);
      });
    }
  } catch (error) {}

  loadSource(1);
  setTimeout(function () {
    checkLoaderUpdate(false);
  }, 4000);
})();
