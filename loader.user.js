// ==UserScript==
// @name         OctoLink Bypass Loader — aozoracyrus fork
// @namespace    https://github.com/aozoracyrus/octolink-bypass
// @version      4.3.1
// @description  Cổng nạp: xử lý chặng chuyển hướng ?redirect_to_octo trên miền đích, rồi nạp lõi octolink.js từ repo aozoracyrus/octolink-bypass (có cache + fallback jsDelivr).
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
// @connect      *
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// @connect      octolink.vip
// @connect      api.github.com
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/aozoracyrus/octolink-bypass/main/loader.user.js
// @updateURL    https://raw.githubusercontent.com/aozoracyrus/octolink-bypass/main/loader.user.js
// ==/UserScript==

(function () {
  'use strict';

  var currentHost = String(window.location.hostname || '').toLowerCase();

  // ---- 1) chặng chuyển hướng trên miền đích ---------------------------
  var redirectTarget = new URLSearchParams(window.location.search || '').get('redirect_to_octo');
  if (redirectTarget && /^https?:\/\//i.test(redirectTarget)) {
    try {
      document.body.innerHTML =
        '<div style="background:#0a0a0a;color:#e0e0e0;height:100vh;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;font-family:sans-serif;font-size:18px;text-align:center;padding:20px">' +
        '🚀<br>ĐANG ĐIỀU HƯỚNG TỐC ĐỘ CAO<br><small>Xin vui lòng chờ trong giây lát…</small></div>';
    } catch (e) {}
    setTimeout(function () { try { window.location.href = redirectTarget; } catch (e) {} }, 1000);
    return;
  }

  // ---- 2) chỉ nạp lõi trên host hỗ trợ --------------------------------
  function matchHost(h, d) { return h === d || (h.length > d.length && h.slice(-(d.length + 1)) === '.' + d); }
  var isSupported =
    matchHost(currentHost, 'octolink.vip') ||
    matchHost(currentHost, 'minuc.vn') ||
    matchHost(currentHost, 'linkhuongdan.online') ||
    matchHost(currentHost, 'totreview.com');
  if (!isSupported) return;

  // Trang captcha: KHÔNG nạp payload
  if (matchHost(currentHost, 'octolink.vip') && /^\/+finish(\/|$)/i.test(window.location.pathname || '')) {
    console.log('[Loader] Trang captcha — bo qua, khong nap script.');
    return;
  }

  if (window.__otlLoaderRunning) return;
  window.__otlLoaderRunning = true;

  var REPO_BASE = 'https://raw.githubusercontent.com/aozoracyrus/octolink-bypass/refs/heads/main/';
  var REPO_BASE_FB = 'https://cdn.jsdelivr.net/gh/aozoracyrus/octolink-bypass@main/';
  var SCRIPT_URL = REPO_BASE + 'octolink.js';
  var SCRIPT_URL_FB = REPO_BASE_FB + 'octolink.js';
  var LOADER_URL = REPO_BASE + 'loader.user.js';

  var PAYLOAD_CACHE_KEY = 'otl_payload_cache_v4';
  var PAYLOAD_TS_KEY = 'otl_payload_ts_v4';
  var UPDATE_CHECK_KEY = 'otl_loader_update_check_v4';
  var UPDATE_FOUND_KEY = 'otl_loader_update_found_v4';
  var UPDATE_CHECK_INTERVAL = 6 * 3600 * 1000;

  // ---- GM API ----------------------------------------------------------
  function modernApi(name) {
    if (typeof GM !== 'undefined' && GM && typeof GM[name] === 'function') return GM[name].bind(GM);
    return undefined;
  }

  var requestApi = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : modernApi('xmlHttpRequest');
  var getValueApi = typeof GM_getValue === 'function' ? GM_getValue : modernApi('getValue');
  var setValueApi = typeof GM_setValue === 'function' ? GM_setValue : modernApi('setValue');
  var notifyApi = typeof GM_notification === 'function' ? GM_notification : modernApi('notification');
  var menuApi = typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : modernApi('registerMenuCommand');
  var openTabApi = typeof GM_openInTab === 'function' ? GM_openInTab : modernApi('openInTab');
  var addStyleApi = typeof GM_addStyle === 'function' ? GM_addStyle : modernApi('addStyle');
  var clipboardApi = typeof GM_setClipboard === 'function' ? GM_setClipboard : modernApi('setClipboard');
  var resourceApi = typeof GM_getResourceText === 'function' ? GM_getResourceText : modernApi('getResourceText');
  var addElementApi = typeof GM_addElement === 'function' ? GM_addElement : modernApi('addElement');

  function storeGet(key, fallback) {
    try { if (getValueApi) { var v = getValueApi(key, fallback); if (v !== undefined && v !== null) return v; } } catch (e) {}
    return fallback;
  }
  function storeSet(key, value) { try { if (setValueApi) setValueApi(key, value); } catch (e) {} }

  function currentVersion() {
    try { if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) return String(GM_info.script.version || '0'); } catch (e) {}
    return '0';
  }
  function compareVersion(a, b) {
    var pa = String(a).split('.'), pb = String(b).split('.');
    var len = Math.max(pa.length, pb.length);
    for (var i = 0; i < len; i++) {
      var x = parseInt(pa[i], 10) || 0, y = parseInt(pb[i], 10) || 0;
      if (x > y) return 1; if (x < y) return -1;
    }
    return 0;
  }

  function openUpdatePage() {
    try { if (openTabApi) { openTabApi(LOADER_URL, { active: true, insert: true }); return; } } catch (e) {}
    try { window.open(LOADER_URL, '_blank'); } catch (e) {}
  }

  function announceUpdate(remote) {
    var mine = currentVersion();
    try { if (notifyApi) notifyApi({ title: 'OctoLink Bypass', text: 'Có bản mới ' + remote + ' (đang dùng ' + mine + ').', timeout: 12000, onclick: openUpdatePage }); } catch (e) {}
    try { if (menuApi) menuApi('⬆ Cài bản mới ' + remote, openUpdatePage); } catch (e) {}
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
      if (compareVersion(remote, currentVersion()) > 0) { storeSet(UPDATE_FOUND_KEY, remote); announceUpdate(remote); }
      else storeSet(UPDATE_FOUND_KEY, '');
    }
    var url = LOADER_URL + '?t=' + now;
    if (requestApi) {
      try {
        requestApi({
          method: 'GET', url: url, timeout: 15000,
          headers: { Accept: 'text/plain, */*', 'Cache-Control': 'no-cache' },
          onload: function (r) { if (r.status === 200) handleHeader(r.responseText); },
          onerror: function () {}, ontimeout: function () {}
        });
        return;
      } catch (e) {}
    }
  }

  // Danh sách API sẽ được truyền vào payload (giống bản gốc)
  var API_NAMES = [
    'GM_xmlhttpRequest', 'GM_getValue', 'GM_setValue', 'GM_addStyle',
    'GM_setClipboard', 'GM_notification', 'GM_registerMenuCommand',
    'GM_getResourceText', 'GM_addElement'
  ];
  var API_VALUES = [
    requestApi, getValueApi, setValueApi, addStyleApi, clipboardApi, notifyApi, menuApi, resourceApi, addElementApi
  ];

  function isValidPayload(source) {
    return typeof source === 'string' &&
           source.length >= 1000 &&
           source.indexOf('var main = function') !== -1;
  }

  function executeSource(source) {
    if (!isValidPayload(source)) throw new Error('Payload GitHub không hợp lệ');
    // Chạy payload ở global scope, truyền GM API làm tham số
    var runner = Function.apply(null, API_NAMES.concat([source + '\n//# sourceURL=otl-octolink.js']));
    runner.apply(window, API_VALUES);
  }

  function cachePayload(source) {
    if (!setValueApi || !isValidPayload(source)) return;
    try { storeSet(PAYLOAD_CACHE_KEY, source); storeSet(PAYLOAD_TS_KEY, String(Date.now()));
      console.log('[Loader] Đã lưu bản dự phòng (' + Math.round(source.length / 1024) + 'KB)');
    } catch (e) {}
  }

  function runCachedPayload(reason) {
    var cached = String(storeGet(PAYLOAD_CACHE_KEY, '') || '');
    if (!isValidPayload(cached)) return false;
    var ts = parseInt(storeGet(PAYLOAD_TS_KEY, 0), 10) || 0;
    var ageHours = ts ? Math.round((Date.now() - ts) / 3600000) : -1;
    console.warn('[Loader] ' + reason + ' → dùng bản dự phòng' + (ageHours >= 0 ? ' (lưu ' + ageHours + 'h trước)' : ''));
    try { executeSource(cached); return true; } catch (e) { console.error('[Loader] Bản dự phòng lỗi:', e); return false; }
  }

  function loadWithFetch(url, onSuccess, onFailure) {
    if (typeof fetch !== 'function') { onFailure(new Error('Không có API request tương thích')); return; }
    fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(onSuccess).catch(onFailure);
  }

  function loadSource(attempt) {
    var base = attempt >= 3 ? SCRIPT_URL_FB : SCRIPT_URL;
    var url = base + '?t=' + Date.now() + '&attempt=' + attempt;
    var settled = false;
    function success(source, status) {
      if (settled) return; settled = true;
      try {
        console.log('[Loader] HTTP status:', status || 200, '·', base);
        executeSource(source);
        console.log('[Loader] Loaded script (' + Math.round(source.length / 1024) + 'KB)');
        cachePayload(source);
      } catch (e) { window.__otlLoaderRunning = false; console.error('[Loader] Execute error:', e); }
    }
    function retry(err) {
      if (settled) return; settled = true;
      if (attempt >= 3) {
        console.error('[Loader] Load failed after ' + attempt + ' attempts:', err);
        if (!runCachedPayload('Tải payload thất bại')) window.__otlLoaderRunning = false;
        return;
      }
      console.warn('[Loader] Retry ' + (attempt + 1) + '/3', err);
      setTimeout(function () { loadSource(attempt + 1); }, 1500 * attempt);
    }
    if (!requestApi) { loadWithFetch(url, function (s) { success(s, 200); }, retry); return; }
    try {
      requestApi({
        method: 'GET', url: url, timeout: 20000,
        headers: { Accept: 'text/javascript, */*', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        onload: function (r) { if (r.status !== 200) { retry(new Error('HTTP ' + r.status)); return; } success(r.responseText, r.status); },
        onerror: function (e) { retry(e || new Error('Network error')); },
        ontimeout: function () { retry(new Error('Request timeout')); }
      });
    } catch (e) { loadWithFetch(url, function (s) { success(s, 200); }, retry); }
  }

  try {
    if (menuApi) {
      menuApi('Xoá cache lõi (buộc tải lại octolink.js)', function () {
        storeSet(PAYLOAD_CACHE_KEY, ''); storeSet(PAYLOAD_TS_KEY, '0');
        try { if (notifyApi) notifyApi({ title: 'OctoLink Bypass', text: 'Đã xoá cache lõi — tải lại trang.', timeout: 4000 }); } catch (e) {}
      });
      menuApi('Kiểm tra cập nhật', function () { checkLoaderUpdate(true); });
    }
  } catch (e) {}

  loadSource(1);
  setTimeout(function () { checkLoaderUpdate(false); }, 4000);
})();
