// ==UserScript==
// @name         OctoLink Bypass Loader — aozoracyrus fork
// @namespace    https://github.com/aozoracyrus/octolink-bypass
// @version      4.0.1
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
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_registerMenuCommand
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

/*
 * v4.0.0 — LOADER mỏng (fork aozoracyrus).
 *
 * Nhiệm vụ của file này (đúng kiến trúc bản gốc):
 *  1. Trên MIỀN ĐÍCH bất kì có ?redirect_to_octo=... : hiện màn hình
 *     "ĐANG ĐIỀU HƯỚNG TỐC ĐỘ CAO" rồi chuyển sang trang finish của
 *     octolink sau ~1s (chặng cuối của flow bypass).
 *  2. Trên các host hỗ trợ: nạp lõi octolink.js từ repo của bạn
 *     (raw.githubusercontent, fallback jsDelivr), cache vào GM storage
 *     để không fetch lại mỗi trang, rồi eval trong global scope.
 *  3. Tự kiểm tra cập nhật loader qua @version trên repo.
 *
 * Toàn bộ logic bypass (4 chặng /check/continue, live core, UI…) nằm ở
 * octolink.js — push CẢ HAI file lên nhánh main của repo.
 */
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
  if (window.__otlLoaderRunning) return;
  window.__otlLoaderRunning = true;

  // QUAN TRONG: dùng /refs/heads/main/ — raw.githubusercontent bỏ qua query
  // string khi tính cache key nên ?v=... không bust được cache /main/.
  var REPO_BASE = 'https://raw.githubusercontent.com/aozoracyrus/octolink-bypass/refs/heads/main/';
  var REPO_BASE_FB = 'https://cdn.jsdelivr.net/gh/aozoracyrus/octolink-bypass@main/';
  var CORE_URL = REPO_BASE + 'octolink.js';
  var CORE_URL_FB = REPO_BASE_FB + 'octolink.js';
  var LOADER_URL = REPO_BASE + 'loader.user.js';

  var CORE_CACHE_KEY = 'otl_core_cache_v4';
  var CORE_TS_KEY = 'otl_core_ts_v4';
  var CORE_TTL = 10 * 60 * 1000; // 10 phút

  // ---- GM API ----------------------------------------------------------
  function gm(n) { return (typeof GM !== 'undefined' && GM && typeof GM[n] === 'function') ? GM[n].bind(GM) : undefined; }
  var req = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : gm('xmlHttpRequest');
  var gGet = typeof GM_getValue === 'function' ? GM_getValue : gm('getValue');
  var gSet = typeof GM_setValue === 'function' ? GM_setValue : gm('setValue');
  var gNoti = typeof GM_notification === 'function' ? GM_notification : gm('notification');
  var gMenu = typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : gm('registerMenuCommand');
  var gOpen = typeof GM_openInTab === 'function' ? GM_openInTab : gm('openInTab');
  function storeGet(k, f) { try { var v = gGet ? gGet(k, f) : f; return (v == null) ? f : v; } catch (e) { return f; } }
  function storeSet(k, v) { try { if (gSet) gSet(k, v); } catch (e) {} }

  // ---- nạp lõi ----------------------------------------------------------
  function runCore(code) {
    try {
      // QUAN TRONG: eval TRỰC TIẾP (không (0,eval)) để lõi chạy trong scope
      // wrapper của Violentmonkey — nơi có GM_xmlhttpRequest + @connect.
      // Eval gián tiếp đẩy lõi ra global scope của trang -> mất GM API ->
      // fetch thường bị CORS chặn ở octolink.vip (api.github.com vẫn sống
      // vì GitHub có CORS) -> "Không với tới octolink.vip".
      eval(code);
      console.info('[otl-loader] Đã nạp lõi octolink.js (' + Math.round(code.length / 1024) + 'KB).');
    } catch (e) {
      console.error('[otl-loader] Lỗi khi chạy lõi:', e);
    }
  }

  function fetchCore(url, onSuccess, onFail) {
    if (!req) { onFail(); return; }
    try {
      req({
        method: 'GET', url: url, timeout: 15000,
        onload: function (r) {
          var code = r && r.responseText ? r.responseText : '';
          // sanity: phải giống userscript/core hợp lệ
          if (r.status === 200 && code.length > 1000 && code.indexOf('__otlBypassRunning') !== -1) onSuccess(code);
          else onFail();
        },
        onerror: onFail, ontimeout: onFail
      });
    } catch (e) { onFail(); }
  }

  function boot() {
    var cached = String(storeGet(CORE_CACHE_KEY, '') || '');
    var ts = parseInt(storeGet(CORE_TS_KEY, 0), 10) || 0;
    if (cached && Date.now() - ts < CORE_TTL) { runCore(cached); return; }

    fetchCore(CORE_URL, function (code) {
      storeSet(CORE_CACHE_KEY, code);
      storeSet(CORE_TS_KEY, String(Date.now()));
      runCore(code);
    }, function () {
      console.warn('[otl-loader] raw.githubusercontent lỗi — thử jsDelivr…');
      fetchCore(CORE_URL_FB, function (code) {
        storeSet(CORE_CACHE_KEY, code);
        storeSet(CORE_TS_KEY, String(Date.now()));
        runCore(code);
      }, function () {
        if (cached) { console.warn('[otl-loader] Dùng lõi cache cũ.'); runCore(cached); return; }
        console.error('[otl-loader] Không nạp được octolink.js. Push file lên repo aozoracyrus/octolink-bypass.');
      });
    });
  }

  // ---- tự cập nhật loader ----------------------------------------------
  function checkLoaderUpdate() {
    var last = parseInt(storeGet('otl_upd_ts_v4', 0), 10) || 0;
    if (Date.now() - last < 6 * 3600 * 1000) return;
    storeSet('otl_upd_ts_v4', String(Date.now()));
    if (!req) return;
    try {
      req({
        method: 'GET', url: LOADER_URL + '?t=' + Date.now(), timeout: 10000,
        onload: function (r) {
          var m = (r.responseText || '').match(/@version\s+([0-9.]+)/);
          if (m && m[1] !== '4.0.1') {
            console.warn('[otl-loader] Có bản mới ' + m[1] + ': ' + LOADER_URL);
            try { if (gNoti) gNoti({ title: 'OctoLink Bypass', text: 'Có bản mới ' + m[1] + ' — cập nhật trong Violentmonkey.', timeout: 8000 }); } catch (e) {}
          }
        }
      });
    } catch (e) {}
  }

  try {
    if (gMenu) {
      gMenu('Xoá cache lõi (buộc tải lại octolink.js)', function () {
        storeSet(CORE_CACHE_KEY, ''); storeSet(CORE_TS_KEY, '0');
        try { if (gNoti) gNoti({ title: 'OctoLink Bypass', text: 'Đã xoá cache lõi — tải lại trang.', timeout: 4000 }); } catch (e) {}
      });
      gMenu('Mở trang cập nhật loader', function () {
        try { if (gOpen) gOpen(LOADER_URL, { active: true }); else window.open(LOADER_URL, '_blank'); } catch (e) {}
      });
    }
  } catch (e) {}

  checkLoaderUpdate();
  boot();
})();
