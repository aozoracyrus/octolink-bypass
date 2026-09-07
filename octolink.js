// ==UserScript==
// @name         OctoLink Bypass Core — aozoracyrus fork
// @namespace    https://github.com/aozoracyrus/octolink-bypass
// @version      5.0.0
// @description  Lõi bypass v5.0.0: theo đúng kiến trúc bản gốc - auto-detect mission, directjscd fingerprint, inject top page
// @author       aozoracyrus (gốc: Chodenocto)
// @match        *://minuc.vn/*
// @match        *://linkhuongdan.online/*
// @match        *://totreview.com/*
// @match        *://octolink.vip/*
// @match        *://*.minuc.vn/*
// @match        *://*.linkhuongdan.online/*
// @match        *://*.totreview.com/*
// @match        *://*.octolink.vip/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @connect      *
// @run-at       document-idle
// @noframes     false
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ====================================================================
  // THOÁT SỚM TRÊN TRANG CAPTCHA — octolink.vip/finish/...
  // ====================================================================
  try {
    var _h = String(window.location.hostname || '').toLowerCase();
    var _p = String(window.location.pathname || '');
    var _isOcto = _h === 'octolink.vip' || _h.slice(-13) === '.octolink.vip';
    if (_isOcto && /^\/+finish(\/|$)/i.test(_p)) {
      console.log('[Octo] Trang captcha — script tự tắt để không cản việc giải captcha.');
      return;
    }
  } catch (err) {}

  // ==================================================================
  // NETWORK DIAGNOSTICS — auto-log every GM_xmlhttpRequest call
  // ==================================================================
  (function () {
    if (typeof GM_xmlhttpRequest !== 'function') return;
    var _orig = GM_xmlhttpRequest;
    var _reqCounter = 0;
    GM_xmlhttpRequest = function (opts) {
      var id = ++_reqCounter;
      var url = opts.url || '?';
      var method = (opts.method || 'GET').toUpperCase();
      var t0 = Date.now();
      var shortUrl = url.length > 80 ? url.substring(0, 77) + '...' : url;
      console.log('[NET#' + id + '] → ' + method + ' ' + shortUrl);
      if (opts.headers) {
        try {
          var hdrKeys = Object.keys(opts.headers);
          var safeH = hdrKeys.filter(function (k) {
            return k.toLowerCase().indexOf('authorization') < 0 && k.toLowerCase().indexOf('cookie') < 0;
          }).map(function (k) { return k + ': ' + String(opts.headers[k]).substring(0, 60); });
          if (safeH.length) console.log('[NET#' + id + ']   headers: ' + safeH.join(' | '));
        } catch (e) {}
      }
      var origOnload = opts.onload;
      var origOnerror = opts.onerror;
      var origOntimeout = opts.ontimeout;
      opts.onload = function (resp) {
        var elapsed = Date.now() - t0;
        var status = resp.status || 0;
        var bodyLen = (resp.responseText || '').length;
        var hdrs = '';
        try {
          hdrs = (resp.responseHeaders || '').split('\n').filter(function (l) {
            return l.toLowerCase().indexOf('content-type') === 0 ||
                   l.toLowerCase().indexOf('set-cookie') === 0;
          }).map(function (l) { return l.trim(); }).join('; ');
        } catch (e) {}
        var msg = '[NET#' + id + '] ← ' + status + ' ' + elapsed + 'ms ' + bodyLen + 'B';
        if (hdrs) msg += ' [' + hdrs + ']';
        if (status >= 400) {
          msg += '\n  Body(200): ' + (resp.responseText || '').substring(0, 200);
          console.warn(msg);
        } else {
          console.log(msg);
        }
        if (origOnload) origOnload(resp);
      };
      opts.onerror = function (e) {
        var elapsed = Date.now() - t0;
        var errMsg = (e && (e.statusText || e.message || e.error)) || 'unknown';
        console.error('[NET#' + id + '] ✕ ONERROR ' + elapsed + 'ms\n  URL: ' + shortUrl + '\n  Error: ' + errMsg);
        if (origOnerror) origOnerror(e);
      };
      opts.ontimeout = function () {
        var elapsed = Date.now() - t0;
        var timeoutSec = ((opts.timeout || 0) / 1000);
        console.error('[NET#' + id + '] ✕ TIMEOUT ' + elapsed + 'ms (limit ' + timeoutSec + 's)\n  URL: ' + shortUrl);
        if (origOntimeout) origOntimeout();
      };
      return _orig(opts);
    };
    if (typeof window.__origFetch === 'undefined') {
      window.__origFetch = window.fetch;
      window.fetch = function () {
        var args = arguments;
        var url2 = (typeof args[0] === 'string' ? args[0] : args[0] && args[0].url) || '?';
        var t0f = Date.now();
        console.log('[FETCH] → ' + url2);
        return window.__origFetch.apply(window, args).then(function (resp) {
          var el = Date.now() - t0f;
          console.log('[FETCH] ← ' + resp.status + ' ' + el + 'ms ' + url2);
          return resp;
        }, function (err) {
          var el = Date.now() - t0f;
          console.error('[FETCH] ✕ ' + el + 'ms ' + url2 + '\n  ' + (err.message || err));
          throw err;
        });
      };
    }
  })();

  // ==================================================================
  // POLYFILLS + LỚP CHỐNG PHÁT HIỆN (top-level, chạy TRƯỚC main)
  // ==================================================================
  if (typeof window.TextEncoder === 'undefined') {
    window.TextEncoder = function () {
      this.encode = function (arg) {
        arg = unescape(encodeURIComponent(arg));
        var bytes = new Uint8Array(arg.length);
        for (var i = 0; i < arg.length; i++) bytes[i] = arg.charCodeAt(i) & 255;
        return bytes;
      };
    };
  }
  if (typeof window.TextDecoder === 'undefined') {
    window.TextDecoder = function () {
      this.decode = function (arg) {
        try { arg = new Uint8Array(arg.buffer || arg); } catch (err) {}
        var text = '';
        for (var j = 0; j < arg.length; j++) text += String.fromCharCode(arg[j]);
        return decodeURIComponent(escape(text));
      };
    };
  }
  try {
    Object.defineProperty(document, 'referrer', { get: function () { return 'https://www.google.com/'; }, configurable: true });
    document.cookie = 'from_google=true; path=/';
  } catch (err) {}
  try {
    Object.defineProperty(document, 'hidden', { get: function () { return false; }, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: function () { return 'visible'; }, configurable: true });
  } catch (err) {}
  try {
    var NativeError = Error;
    var scrubStack = function (arg) {
      if (!arg) return arg;
      return arg.replace(/userscript|tampermonkey|violentmonkey|greasemonkey|GM_xmlhttpRequest|unsafeWindow|@grant|==UserScript==/gi, 'native');
    };
    Error = function () {
      var errInstance = new (Function.prototype.bind.apply(NativeError, [null].concat(Array.prototype.slice.call(arguments))))();
      var stack = errInstance.stack;
      Object.defineProperty(errInstance, 'stack', { get: function () { return scrubStack(stack); }, configurable: true });
      return errInstance;
    };
    Error.prototype = NativeError.prototype;
    Error.captureStackTrace = NativeError.captureStackTrace;
    Error.stackTraceLimit = NativeError.stackTraceLimit;
  } catch (err) {}
  try {
    var nativeQSA = document.querySelectorAll.bind(document);
    document.querySelectorAll = function (arg) {
      var list = nativeQSA(arg);
      if (arg === 'script' || arg === 'SCRIPT') {
        return Array.prototype.filter.call(list, function (el) {
          return !(el.textContent && /==UserScript==|@grant\s+GM_|GM_xmlhttpRequest|unsafeWindow/i.test(el.textContent));
        });
      }
      return list;
    };
  } catch (err) {}

  // ==================================================================
  // MAIN — payload marker (không nhận tham số, dùng GM API từ global)
  // ==================================================================
  var main = function () {
    var SPOOF_ENABLED = true;
    var MY_VERSION = '5.0.0';
    var KEY_LAST = 'otl_last_target_v5';
    var RD_DEMO = 'Ym90Z3VhcmQtY29udGFjdEBnb29nbGUuY29t';

    if (window.location.hostname.includes('minuc.vn')) return;

    var MISSION_FALLBACK_URL = 'https://minuc.vn/home/mission/shorten-link?task=bypass';
    var pageText = document.body ? document.body.innerText.toLowerCase() : '';
    if (document.title.includes('404') || (pageText.includes('404') && (pageText.includes('không tìm thấy') || pageText.includes('not found')))) {
      window.location.href = MISSION_FALLBACK_URL;
      return;
    }

    var pageUrl = window.location.href;
    var queryParams = new URLSearchParams(window.location.search);
    var hostname = window.location.hostname;
    var pathSegments = window.location.pathname.split('/').filter(Boolean);
    var missionId = null;
    if (pathSegments.length > 0) {
      var slug2 = pathSegments[pathSegments.length - 1].replace(/\.html$/i, '');
      missionId = hostname.includes('totreview.com') ? 'totreview-' + slug2 : slug2;
    }

    var cookieHeader = '';
    var cookieJar = { from_google: 'true' };
    var apiOrigin = '';
    var coreCtx = null;
    var demoRetried = 0;
    var DEMO_MAX_RETRY = 4;
    var missionHalted = false;

    // ==================================================================
    // safeRequest — GM_xmlhttpRequest wrapper + fetch() fallback
    // ==================================================================
    function safeRequest(opts) {
      var _fired = false;
      var _t0 = Date.now();
      var _url = opts.url || '?';
      var _method = (opts.method || 'GET').toUpperCase();
      var _origLoad = opts.onload;
      var _origErr = opts.onerror;
      var _origTmo = opts.ontimeout;
      var _timeout = opts.timeout || 30000;
      var _safety;
      function _done(fn, arg) {
        if (_fired) return;
        _fired = true;
        clearTimeout(_safety);
        try { if (fn) fn(arg); } catch (e) { console.error('[safeRequest] callback err:', e); }
      }
      opts.onload = function (r) { _done(_origLoad, r); };
      opts.onerror = function (e) { _done(_origErr, e); };
      opts.ontimeout = function () { _done(_origTmo); };
      _safety = setTimeout(function () {
        if (_fired) return;
        console.warn('[safeRequest] GM_xmlhttpRequest SILENT ' + (Date.now()-_t0) + 'ms → fetch fallback: ' + _url);
        _fetchFallback();
      }, Math.max(_timeout * 1.5, 12000));
      function _fetchFallback() {
        if (_fired) return;
        var _fOpts = { method: _method, headers: {} };
        if (opts.headers) {
          var hk = Object.keys(opts.headers);
          for (var i = 0; i < hk.length; i++) {
            var k = hk[i].toLowerCase();
            if (k === 'x-requested-with' || k === 'sec-fetch-dest' || k === 'sec-fetch-mode' || k === 'sec-fetch-site') continue;
            _fOpts.headers[hk[i]] = opts.headers[hk[i]];
          }
        }
        if (opts.data) _fOpts.body = opts.data;
        if (opts.responseType === 'arraybuffer') _fOpts.responseType = 'arraybuffer';
        fetch(_url, _fOpts)
          .then(function (resp) {
            if (_fired) return;
            var ct = resp.headers.get('content-type') || '';
            if (ct.indexOf('json') >= 0 || ct.indexOf('text') >= 0 || ct.indexOf('javascript') >= 0 || ct.indexOf('html') >= 0) {
              return resp.text().then(function (txt) {
                _done(_origLoad, {
                  status: resp.status,
                  statusText: resp.statusText,
                  responseText: txt,
                  responseHeaders: Array.from(resp.headers.entries()).map(function (h) { return h[0] + ': ' + h[1]; }).join('\n')
                });
              });
            } else {
              return resp.arrayBuffer().then(function (ab) {
                _done(_origLoad, {
                  status: resp.status,
                  statusText: resp.statusText,
                  response: ab,
                  responseText: '',
                  responseHeaders: Array.from(resp.headers.entries()).map(function (h) { return h[0] + ': ' + h[1]; }).join('\n')
                });
              });
            }
          }).catch(function (err) {
            if (_fired) return;
            console.error('[safeRequest] fetch ALSO FAILED: ' + _url + ' — ' + (err.message || err));
            _done(_origErr, { statusText: 'fetch_failed: ' + (err.message || err) });
          });
      }
      if (typeof GM_xmlhttpRequest === 'function') {
        try { GM_xmlhttpRequest(opts); } catch (e) { console.warn('[safeRequest] GM_xmlhttpRequest threw: ' + e.message + ' → fetch fallback'); _fetchFallback(); }
      } else {
        console.warn('[safeRequest] GM_xmlhttpRequest NOT AVAILABLE → fetch fallback: ' + _url);
        _fetchFallback();
      }
    }

    function collectCookies(rawHeaders) {
      if (!rawHeaders) return;
      String(rawHeaders).split('\x0a').forEach(function (item) {
        var match = /set-cookie:\s*([^=;]+)=([^;\r\n]*)/i.exec(item);
        if (match) cookieJar[match[1].trim()] = match[2].trim();
      });
      var cookiePairs = [];
      for (var cookieName in cookieJar) cookiePairs.push(cookieName + '=' + cookieJar[cookieName]);
      cookieHeader = cookiePairs.join(';\x20') + (cookiePairs.length ? ';\x20' : '');
    }

    // ==================================================================
    // USER-AGENT + FINGERPRINT
    // ==================================================================
    var REAL_UA = '';
    try { REAL_UA = String(navigator.userAgent || ''); } catch (err) {}
    var USER_AGENT = REAL_UA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
    window.__OCTO_UA = USER_AGENT;
    var IS_MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile/i.test(USER_AGENT);

    function jsLiteral(value) { return JSON.stringify(value == null ? '' : value); }

    var FP_REAL = (function () {
      var nav = {};
      try { nav = navigator || {}; } catch (err) {}
      function num(value, fallback) { var n = parseInt(value, 10); return isNaN(n) ? fallback : n; }
      var scr = { width: 1920, height: 1080 };
      try { if (screen && screen.width) scr = screen; } catch (err) {}
      return {
        platform: String(nav.platform || (IS_MOBILE_UA ? 'Linux armv8l' : 'Win32')),
        deviceMemory: num(nav.deviceMemory, 8),
        hardwareConcurrency: num(nav.hardwareConcurrency, 4),
        maxTouchPoints: num(nav.maxTouchPoints, IS_MOBILE_UA ? 5 : 0),
        language: String(nav.language || 'vi'),
        languages: (function () { try { if (nav.languages && nav.languages.length) return Array.prototype.slice.call(nav.languages); } catch (err) {} return ['vi-VN', 'vi', 'en-US', 'en']; })(),
        mobile: IS_MOBILE_UA,
        screen: (scr.width || 1920) + 'x' + (scr.height || 1080)
      };
    })();

    function buildSpoofScript() {
      return '(function(){function _def(o,k,v){try{Object.defineProperty(o,k,{get:function(){return v;},configurable:true});return;}catch(e){}try{var p=Object.getPrototypeOf(o);if(p){Object.defineProperty(p,k,{get:function(){return v;},configurable:true});}}catch(e2){}}try{var _n=navigator,_c=document.createElement("canvas");_c.width=1280;_c.height=720;var _ctx=_c.getContext("2d");_ctx.textBaseline="top";_ctx.font="14px Arial";_ctx.fillStyle="#f60";_ctx.fillRect(125,1,62,20);_ctx.fillStyle="#069";_ctx.fillText("Fingerprint "+Date.now(),2,15);_ctx.fillStyle="rgba(102,204,0,0.7)";_ctx.fillText("Spoofed Canvas",4,45);var _cv=_c.toDataURL();HTMLCanvasElement.prototype.toDataURL=function(){return _cv;};HTMLCanvasElement.prototype.toBlob=function(cb,type,enc){_c.toBlob(cb,type,enc);};_def(_n,"deviceMemory",' + FP_REAL.deviceMemory + ');_def(_n,"hardwareConcurrency",' + FP_REAL.hardwareConcurrency + ');_def(_n,"maxTouchPoints",' + FP_REAL.maxTouchPoints + ');_def(_n,"language",' + jsLiteral(FP_REAL.language) + ');_def(_n,"languages",' + JSON.stringify(FP_REAL.languages) + ');_def(_n,"platform",' + jsLiteral(FP_REAL.platform) + ');try{Object.defineProperty(document,"referrer",{get:function(){return "https://www.google.com/";},configurable:true});document.cookie="from_google=true; path=/";}catch(e){}}catch(e){}})();';
    }

    function buildDirectjscdScript() {
      return '(function(){try{var _tm=function(){var a=[],i;for(i=0;i<3;i++){a.push(String(1000+Math.floor(Math.random()*8000)));}return a.join(",");};var _tz="Asia/Saigon";try{_tz=Intl.DateTimeFormat().resolvedOptions().timeZone;}catch(e){}var _ua=(window.__OCTO_UA||navigator.userAgent||"").substring(0,80);var _p=' + jsLiteral(FP_REAL.platform) + ';var _dm=' + FP_REAL.deviceMemory + ';var _hc=' + FP_REAL.hardwareConcurrency + ';var _mt=' + FP_REAL.maxTouchPoints + ';var _lang=' + jsLiteral(FP_REAL.language) + ';var _langs=' + JSON.stringify(FP_REAL.languages) + ';var _mob=' + (FP_REAL.mobile ? 'true' : 'false') + ';var _scr=' + jsLiteral(FP_REAL.screen) + ';window.directjscd={platform:_p,deviceMemory:_dm,hardwareConcurrency:_hc,maxTouchPoints:_mt,language:_lang,languages:_langs,mobile:_mob,screen:_scr,userAgent:_ua,timeZone:_tz,timing:_tm(),userscript:0,userscript_score:0,gm_apis:false,extension_runtime:false,layered_userscript:{score:0,detections:[]},version:"5.0.0",timestamp:Date.now()};}catch(e){console.error("[directjscd]",e);}})();';
    }

    var SEAL_SCRIPT = '(function(){function _sealCd(){try{var d=window.directjscd;if(!d||typeof d!=="object")return;try{if(d.userscript!==undefined)d.userscript=0;}catch(e){}try{if("userscript_score"in d&&d.userscript_score)d.userscript_score=0;}catch(e){}try{if(d.gm_apis)d.gm_apis=false;}catch(e){}try{if(d.extension_runtime)d.extension_runtime=false;}catch(e){}try{var lu=d.layered_userscript;if(lu&&typeof lu==="object"){if(lu.score)lu.score=0;if(Array.isArray(lu.detections)&&lu.detections.length)lu.detections=lu.detections.filter(function(x){return !/userscript|tampermonkey|greasemonkey|violentmonkey/i.test(String((x&&x.kind)||x.name||x));});}}catch(e){}try{var tm=d.timing;if(tm&&typeof tm==="object"&&tm.score&&tm.score>100)tm.score=0;}catch(e){}}catch(e){}}var _iv=setInterval(function(){if(typeof window.__b110671==="function"&&!window.__b110671.__sealed){var _o=window.__b110671;window.__b110671=function(){_sealCd();return _o();};try{Object.defineProperty(window.__b110671,"__sealed",{value:true});}catch(e){}clearInterval(_iv);}},80);})();';

    // ==================================================================
    // UI — panel log
    // ==================================================================
    var UI = null;
    function initUI() {
      if (UI) return UI;
      var st = document.createElement('style');
      st.textContent = ':root{--oc-accent:#a855f7;--oc-accent2:#22d3ee;--oc-text:#e9e6f5;--oc-dim:#9b93b8;--oc-ok:#34d399;--oc-warn:#fbbf24;--oc-err:#fb7185;--oc-sys:#60a5fa;}@keyframes oc-in{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}@keyframes oc-pop{0%{opacity:0;transform:translateY(10px) scale(.96)}60%{transform:translateY(-2px) scale(1.01)}100%{opacity:1;transform:none}}@keyframes oc-ring{0%{box-shadow:0 0 0 0 rgba(168,85,247,.55)}100%{box-shadow:0 0 0 12px rgba(168,85,247,0)}}@keyframes oc-sheen{0%{background-position:-200% 0}100%{background-position:200% 0}}.lux-panel{position:fixed;bottom:22px;right:22px;width:min(410px,calc(100vw - 24px));height:400px;z-index:2147483647;display:flex;flex-direction:column;color:var(--oc-text);font:13px/1.5 system-ui,sans-serif;border-radius:18px;background:linear-gradient(180deg,rgba(20,16,34,.95),rgba(8,6,15,.97));border:1px solid rgba(168,85,247,.25);box-shadow:0 24px 60px -12px rgba(0,0,0,.85);animation:oc-pop .45s cubic-bezier(.2,.9,.25,1) both}.lux-panel.oc-collapsed{height:56px!important}.lux-panel.oc-collapsed .lux-body,.lux-panel.oc-collapsed .oc-rail{display:none}.lux-header{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.07)}.oc-dot{width:9px;height:9px;border-radius:50%;background:var(--oc-ok);box-shadow:0 0 10px var(--oc-ok);animation:oc-ring 2.2s ease-out infinite;flex:none}.oc-dot.busy{background:var(--oc-accent2);box-shadow:0 0 10px var(--oc-accent2)}.oc-dot.bad{background:var(--oc-err);box-shadow:0 0 10px var(--oc-err)}.oc-title{font-weight:800;font-size:12.5px;letter-spacing:.12em;background:linear-gradient(92deg,#fff,#d8b4fe 35%,#67e8f9 65%,#fff);background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:oc-sheen 6s linear infinite}.oc-sub{font-size:10px;color:var(--oc-dim);letter-spacing:.05em}.lux-header .sp{flex:1}.lux-btn{width:26px;height:26px;display:grid;place-items:center;border-radius:8px;cursor:pointer;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:var(--oc-dim);font-size:13px;font-weight:700;transition:all .18s}.lux-btn:hover{background:rgba(168,85,247,.2);border-color:rgba(168,85,247,.5);color:#fff}.oc-rail{height:2px;background:rgba(255,255,255,.06);overflow:hidden}.oc-rail>i{display:block;height:100%;width:0%;background:linear-gradient(90deg,var(--oc-accent),var(--oc-accent2));box-shadow:0 0 8px rgba(168,85,247,.7);transition:width .5s linear}.lux-body{flex:1;min-height:0;padding:10px;overflow-y:auto;scrollbar-width:thin}.log-entry{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;padding:7px 10px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.05);animation:oc-in .3s both;font-size:12px}.log-entry .t{color:#6b6488;font:9.5px ui-monospace,monospace;flex:none;padding-top:1px}.log-entry.success{border-color:rgba(52,211,153,.35)}.log-entry.success .tx::before{content:"✓ ";color:var(--oc-ok);font-weight:700}.log-entry.warn{border-color:rgba(251,191,36,.35)}.log-entry.warn .tx::before{content:"⚠ ";color:var(--oc-warn)}.log-entry.error{border-color:rgba(251,113,133,.4)}.log-entry.error .tx::before{content:"✗ ";color:var(--oc-err)}.log-entry.system .tx::before{content:"› ";color:var(--oc-sys)}.log-entry.detect{border-color:rgba(34,211,238,.3)}.log-entry.detect .tx::before{content:"◈ ";color:var(--oc-accent2)}.oc-form{margin-top:4px;padding:10px;border-radius:12px;background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.3)}.oc-form label{display:block;font-size:10px;letter-spacing:.14em;color:var(--oc-dim);margin-bottom:6px}.oc-form .row{display:flex;gap:8px}.oc-form input{flex:1;min-width:0;background:#0a0716;border:1px solid rgba(168,85,247,.4);border-radius:8px;color:#fff;padding:8px 10px;font:12.5px ui-monospace,monospace;outline:none}.oc-form input:focus{border-color:var(--oc-accent2);box-shadow:0 0 0 3px rgba(34,211,238,.15)}.oc-form button{background:linear-gradient(135deg,var(--oc-accent),#7c3aed);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-weight:700;font-size:12px;cursor:pointer;transition:transform .15s,box-shadow .2s}.oc-form button:hover{transform:translateY(-1px);box-shadow:0 8px 20px -6px rgba(168,85,247,.6)}';
      (document.head || document.documentElement).appendChild(st);
      var p = document.createElement('div');
      p.className = 'lux-panel';
      p.innerHTML = '<div class="lux-header"><span class="oc-dot" id="ocDot"></span><div><div class="oc-title">OCTO BYPASS</div><div class="oc-sub" id="ocStt">aozoracyrus · v' + MY_VERSION + '</div></div><span class="sp"></span><button class="lux-btn" id="ocMin" title="Thu gọn">–</button><button class="lux-btn" id="ocX" title="Đóng">✕</button></div><div class="oc-rail"><i id="ocRail"></i></div><div class="lux-body" id="ocBody"></div>';
      document.documentElement.appendChild(p);
      UI = {
        body: p.querySelector('#ocBody'),
        dot: p.querySelector('#ocDot'),
        stt: p.querySelector('#ocStt'),
        rail: p.querySelector('#ocRail'),
        log: function (text, type) {
          var e = document.createElement('div');
          e.className = 'log-entry ' + (type || '');
          var d = new Date();
          var ts = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
          e.innerHTML = '<span class="t">' + ts + '</span><span class="tx"></span>';
          e.querySelector('.tx').textContent = text;
          UI.body.appendChild(e);
          UI.body.scrollTop = UI.body.scrollHeight;
          while (UI.body.children.length > 60) UI.body.removeChild(UI.body.firstChild);
          return e;
        },
        status: function (text, mode) { UI.stt.textContent = text; UI.dot.className = 'oc-dot' + (mode ? ' ' + mode : ''); },
        setRail: function (pct) { UI.rail.style.width = Math.max(0, Math.min(100, pct)) + '%'; }
      };
      p.querySelector('#ocMin').onclick = function () { p.classList.toggle('oc-collapsed'); };
      p.querySelector('#ocX').onclick = function () { p.style.display = 'none'; };
      return UI;
    }

    function notify(t) { try { if (GM_notification) GM_notification({ title: 'OctoLink Bypass', text: t, timeout: 4000 }); } catch (e) {} }
    function storeGet(k, f) { try { var v = GM_getValue ? GM_getValue(k, f) : f; return (v == null) ? f : v; } catch (e) { return f; } }
    function storeSet(k, v) { try { if (GM_setValue) GM_setValue(k, v); } catch (e) {} }

    // ==================================================================
    // LIVE CORE — probe session + jsconfig + inject top page
    // ==================================================================
    var lastProbe = 'chưa probe';

    function readJsConfig(text) {
      function num(name) { var m = text.match(new RegExp('(?:var\\s+)?' + name + '\\s*=\\s*(\\d+)')); return m ? parseInt(m[1], 10) : null; }
      function str(name) { var m = text.match(new RegExp('var\\s+' + name + '\\s*=\\s*"([^"]*)"')); return m ? m[1] : null; }
      function bool(name) { var m = text.match(new RegExp('var\\s+' + name + '\\s*=\\s*(true|false)')); return m ? m[1] === 'true' : null; }
      return { rd: str('rd') || '', dm: str('dm') || '', fk: str('fk'), fr: str('fr'), nad: bool('nad'), w1: num('w1'), w2: num('w2'), w3: num('w3'), ad: num('ad') };
    }

    function probeDomainSession(done) {
      UI.log('Đang probe phiên octolink.vip…', 'system');
      safeRequest({
        method: 'GET', url: 'https://octolink.vip/', timeout: 20000,
        headers: { accept: 'text/html,*/*', referer: 'https://www.google.com/', 'user-agent': USER_AGENT },
        onload: function (r) {
          collectCookies(r.responseHeaders);
          UI.log('Phiên octolink: status=' + r.status + ', cookie=' + (cookieHeader ? 'OK' : 'EMPTY'), r.status === 200 ? 'success' : 'warn');
          done(r.status === 200);
        },
        onerror: function (e) {
          UI.log('Phiên octolink: ONERROR ' + (e && e.statusText ? e.statusText : '?') + ' — octolink.vip có thể bị chặn.', 'error');
          done(false);
        },
        ontimeout: function () { UI.log('Phiên octolink: TIMEOUT 20s.', 'error'); done(false); }
      });
    }

    function fetchJsConfig(done) {
      UI.log('Đang xin jsconfig.js…', 'system');
      var hdr = { accept: '*/*', referer: 'https://octolink.vip/', 'user-agent': USER_AGENT };
      if (cookieHeader) hdr.cookie = cookieHeader;
      safeRequest({
        method: 'GET', url: 'https://octolink.vip/statics/jsconfig.js', timeout: 20000, headers: hdr,
        onload: function (resp) {
          collectCookies(resp.responseHeaders);
          var text = resp.responseText || '';
          if (resp.status !== 200) { UI.log('jsconfig: HTTP ' + resp.status, 'error'); return done(null); }
          if (text.length < 10) { UI.log('jsconfig: body rỗng (' + text.length + 'B)', 'error'); return done(null); }
          var cfg = readJsConfig(text);
          if (!cfg.rd) { UI.log('jsconfig: parse fail (không tìm thấy var rd)', 'error'); return done(null); }
          UI.log('jsconfig: rd=' + cfg.rd.slice(0, 16) + '… nad=' + cfg.nad + (cfg.rd === RD_DEMO ? ' (RD DEMO!)' : ' (rd thật)'), cfg.rd === RD_DEMO ? 'warn' : 'detect');
          done(cfg);
        },
        onerror: function (e) { UI.log('jsconfig: ONERROR ' + (e && e.statusText ? e.statusText : '?'), 'error'); done(null); },
        ontimeout: function () { UI.log('jsconfig: TIMEOUT 20s.', 'error'); done(null); }
      });
    }

    function addPageScript(text) {
      var s = document.createElement('script');
      s.textContent = text;
      (document.head || document.documentElement).appendChild(s);
      return s;
    }

    function probeCore(w) {
      try {
        if (typeof w.__hf === 'function') {
          var sig = w.__hf('/check/job', new w.Uint8Array(0));
          if (sig && typeof sig['x-guard-sig'] === 'string' && sig['x-guard-sig'].length > 0) { lastProbe = 'ready'; return 'ready'; }
          lastProbe = 'có __hf nhưng sig hỏng'; return 'bad-sig';
        }
        lastProbe = 'chưa có __hf';
      } catch (e) { lastProbe = 'probe lỗi: ' + (e && e.message ? e.message : e); }
      return 'loading';
    }

    function pollCore(w, maxTicks, onDone) {
      var t = 0;
      var iv = setInterval(function () {
        t++;
        var s = probeCore(w);
        if (s === 'ready') { clearInterval(iv); onDone(true); }
        else if (t >= maxTicks) { clearInterval(iv); onDone(false); }
      }, 500);
    }

    function bootLiveCore(done) {
      UI.log('Khởi động siêu hệ thống…', 'system');
      UI.status('đang nạp core…', 'busy');
      probeDomainSession(function (sessionOK) {
        if (!sessionOK) { UI.log('Không thiết lập được phiên octolink — dừng.', 'error'); return done(null); }
        fetchJsConfig(function (cfg) {
          if (!cfg || !cfg.rd) return done(null);
          if (cfg.rd === RD_DEMO) {
            demoRetried++;
            if (demoRetried > DEMO_MAX_RETRY) { UI.log('rd DEMO mãi — dừng.', 'error'); return done(null); }
            UI.log('rd DEMO (lần ' + demoRetried + '/' + DEMO_MAX_RETRY + ') — probe lại phiên…', 'warn');
            setTimeout(function () {
              probeDomainSession(function () { fetchJsConfig(function (cfg2) { if (cfg2 && cfg2.rd && cfg2.rd !== RD_DEMO) cfg = cfg2; injectCore(cfg, done); }); });
            }, 3000 * demoRetried);
            return;
          }
          injectCore(cfg, done);
        });
      });
    }

    function injectCore(cfg, done) {
      var cfgScript = 'var rd=' + jsLiteral(cfg.rd || '') + ';var dm=' + jsLiteral(cfg.dm || 'https://octolink.vip') + ';var nad=' + (cfg.nad === false ? 'false' : 'true') + ';';
      if (cfg.fk) cfgScript += 'var fk=' + jsLiteral(cfg.fk) + ';';
      if (cfg.fr) cfgScript += 'var fr=' + jsLiteral(cfg.fr) + ';';
      if (cfg.w1 != null) cfgScript += 'var w1=' + cfg.w1 + ';';
      if (cfg.w2 != null) cfgScript += 'var w2=' + cfg.w2 + ';';
      if (cfg.w3 != null) cfgScript += 'var w3=' + cfg.w3 + ';';
      addPageScript(buildSpoofScript());
      addPageScript(buildDirectjscdScript());
      addPageScript(SEAL_SCRIPT);
      addPageScript(cfgScript);
      UI.log('Đã inject spoof/directjscd/seal/config vào top page.', 'system');
      var coreUrl = 'https://octolink.vip/js/shortearn.live.js?v=' + Date.now();
      var hdr = { accept: '*/*', referer: 'https://octolink.vip/', 'user-agent': USER_AGENT };
      if (cookieHeader) hdr.cookie = cookieHeader;
      safeRequest({
        method: 'GET', url: coreUrl, timeout: 20000, headers: hdr,
        onload: function (r) {
          collectCookies(r.responseHeaders);
          var src = r.responseText || '';
          if (r.status !== 200) { UI.log('Core live: HTTP ' + r.status, 'error'); return done(null); }
          if (src.length < 200) { UI.log('Core live rỗng (' + src.length + 'B).', 'error'); return done(null); }
          UI.log('Đã nạp core live (' + Math.round(src.length / 1024) + 'KB) — inject top page.', 'success');
          try { addPageScript(src); } catch (e) { UI.log('Lỗi khi inject core: ' + (e && e.message ? e.message : e), 'error'); return done(null); }
          pollCore(window, 60, function (ok) {
            if (ok) {
              coreCtx = { rd: cfg.rd, w: window };
              UI.log('Fingerprint thật đã sẵn sàng.', 'success');
              UI.log('Core live sẵn sàng.', 'success');
              done(coreCtx);
            } else {
              UI.log('Core live khởi tạo thất bại (60s).', 'error');
              var miss = [];
              ['__hf', '__b110671', '__se4ce', '__se331'].forEach(function (n) { try { if (typeof window[n] !== 'function') miss.push(n); } catch (e) { miss.push(n); } });
              UI.log('diag: thiếu [' + (miss.join(', ') || 'không') + '] · ' + lastProbe, 'warn');
              done(null);
            }
          });
        },
        onerror: function (e) { UI.log('Core live: ONERROR ' + (e && e.statusText ? e.statusText : '?'), 'error'); done(null); },
        ontimeout: function () { UI.log('Core live: TIMEOUT 20s.', 'error'); done(null); }
      });
    }

    // ==================================================================
    // GIAO THỨC: /check/job + 4 chặng /check/continue
    // ==================================================================
    function toBytes(input) {
      if (!input) return null;
      if (typeof input === 'string') { if (!input.length) return null; var b = new Uint8Array(input.length); for (var i = 0; i < input.length; i++) b[i] = input.charCodeAt(i) & 0xff; return b; }
      if (input instanceof Uint8Array) return input;
      if (input instanceof ArrayBuffer) return new Uint8Array(input);
      return null;
    }

    function buildGuardHeaders(w, pathName, payload) {
      var headers = {};
      try { var gh = w.__hf(pathName, payload); for (var k in gh) headers[k] = String(gh[k]); } catch (e) {}
      headers.accept = 'application/json, text/javascript, */*; q=0.01';
      headers.origin = 'https://octolink.vip';
      headers.referer = 'https://octolink.vip/';
      headers['user-agent'] = USER_AGENT;
      headers['X-Requested-With'] = 'XMLHttpRequest';
      headers['x-ce'] = headers['x-guard-sig'] ? '3' : '2';
      if (cookieHeader) headers.cookie = cookieHeader;
      if (!headers['content-type']) headers['content-type'] = 'application/octet-stream';
      return headers;
    }

    function postBinary(url, payload, headers, onDone, onErr, onTmo) {
      var retried = false;
      function attempt(rt) {
        safeRequest({
          method: 'POST', url: url, headers: headers, timeout: 30000, responseType: rt, data: payload,
          onload: function (resp) {
            collectCookies(resp.responseHeaders);
            var bytes = toBytes(resp.response) || toBytes(resp.responseText);
            if (!bytes && !retried) { retried = true; return attempt('text'); }
            onDone({ response: bytes, headers: resp.responseHeaders || '' });
          },
          onerror: onErr, ontimeout: onTmo
        });
      }
      attempt('arraybuffer');
    }

    function decryptJob(w, body) {
      var job = null;
      try { if (typeof w.__se331 === 'function') w.__se331(body); if (typeof w.__se4ce === 'function') job = w.__se4ce(body); } catch (e) {}
      if (!job) {
        try { var out = new Uint8Array(body.length); for (var i = 0; i < body.length; i++) out[i] = body[i] ^ 0x02; job = JSON.parse(new TextDecoder('utf-8').decode(out)); if (job) UI.log('Giải mã mới (byte-0x02) thành công!', 'success'); } catch (e) {}
      }
      return job;
    }

    function stripDecoy(body) {
      if (!body || !body.length) return body;
      var DECOY = 'co trinh khong ma reverse vay em dung dung AI LLM de reverse';
      var dec = new TextEncoder().encode(DECOY);
      if (body.length > dec.length) {
        var pre = true;
        for (var i = 0; i < dec.length; i++) if (body[i] !== dec[i]) { pre = false; break; }
        if (pre) return body.slice(dec.length);
      }
      return body;
    }

    function refreshConfig(w, done) {
      var hdr = { accept: '*/*', referer: 'https://octolink.vip/', 'user-agent': USER_AGENT };
      if (cookieHeader) hdr.cookie = cookieHeader;
      safeRequest({
        method: 'GET', url: 'https://octolink.vip/statics/jsconfig.js', timeout: 20000, headers: hdr,
        onload: function (resp) {
          collectCookies(resp.responseHeaders);
          var cfg = readJsConfig(resp.responseText || '');
          if (cfg.rd) { coreCtx.rd = cfg.rd; try { w.rd = cfg.rd; } catch (e) {} UI.log('Mã hóa đã làm mới: ' + cfg.rd.slice(0, 16) + '…', 'success'); }
          else UI.log('Không thể làm mới mã hóa.', 'warn');
          try { if (cfg.nad != null) w.nad = cfg.nad; if (cfg.dm) w.dm = cfg.dm; } catch (e) {}
          done(cfg);
        },
        onerror: function () { done(null); }, ontimeout: function () { done(null); }
      });
    }

    function checkJob(targetUrl, attempt) {
      if (missionHalted || !coreCtx) return;
      var w = coreCtx.w;
      if (attempt > 3) { UI.log('Tên miền lưu trữ đã hết hạn.', 'error'); return; }
      refreshConfig(w, function () {
        var payload;
        try { payload = w.__b110671(); } catch (e) { payload = null; }
        if (!payload) { UI.log('Core không tạo được payload.', 'error'); return; }
        var headers = buildGuardHeaders(w, '/check/job', payload);
        UI.log('Đang kiểm tra định tuyến cho: ' + targetUrl, 'system');
        postBinary('https://octolink.vip/check/job', payload, headers, function (result) {
          var body = stripDecoy(result.response);
          var job = body ? decryptJob(w, body) : null;
          if (!job) {
            UI.log('Phản hồi rỗng/lệch (Thử lại ' + (attempt + 1) + '/4)…', 'warn');
            return setTimeout(function () { checkJob(targetUrl, attempt + 1); }, 3000);
          }
          UI.log('Định tuyến OK — bắt đầu 4 chặng.', 'success');
          runStage(targetUrl, 1);
        }, function () {
          UI.log('Mất kết nối /check/job (Thử lại ' + (attempt + 1) + '/4)…', 'error');
          setTimeout(function () { checkJob(targetUrl, attempt + 1); }, 3000);
        }, function () {
          UI.log('Hết hạn /check/job (Thử lại ' + (attempt + 1) + '/4)…', 'error');
          setTimeout(function () { checkJob(targetUrl, attempt + 1); }, 3000);
        });
      });
    }

    function stageWait(step) {
      var ranges = [[40, 50], [20, 25], [10, 15], [5, 10]];
      var r = ranges[Math.min(step - 1, 3)];
      return r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
    }

    function runStage(targetUrl, step) {
      if (missionHalted || step > 4) return;
      var total = stageWait(step);
      var left = total;
      UI.log('Bộ đếm ngược (~' + left + 's) cho chặng ' + step + '…', 'system');
      UI.status('chặng ' + step + ' · còn ' + left + 's', 'busy');
      var cdEntry = UI.log('Đang xử lý chặng ' + step + ' — giữ nguyên tab này…', 'system');
      var iv = setInterval(function () {
        left--;
        cdEntry.querySelector('.tx').textContent = 'Đang xử lý chặng ' + step + ' — còn ' + Math.max(left, 0) + 's…';
        UI.status('chặng ' + step + ' · còn ' + Math.max(left, 0) + 's', 'busy');
        UI.setRail(((step - 1) / 4) * 100 + (1 - left / total) * 25);
        if (left <= 0) { clearInterval(iv); sendContinue(targetUrl, step, 0, 0); }
      }, 1000);
    }

    function sendContinue(targetUrl, step, attempt, waitRound) {
      if (missionHalted || !coreCtx) return;
      var w = coreCtx.w;
      if (attempt > 3) { UI.log('Phát sinh lỗi vượt chặng ' + step + '.', 'error'); return; }
      if (waitRound > 20) { UI.log('Server chờ mãi ở chặng ' + step + '.', 'error'); return; }
      var payload;
      try { payload = w.__b110671(); } catch (e) { payload = null; }
      if (!payload) { UI.log('Core không tạo được payload continue.', 'error'); return; }
      UI.log('Gửi /check/continue (chặng ' + step + ', lần ' + (attempt + 1) + '/4' + (waitRound ? ', chờ ' + waitRound + '/20' : '') + ')…', 'system');
      var headers = buildGuardHeaders(w, '/check/continue', payload);
      postBinary('https://octolink.vip/check/continue', payload, headers, function (result) {
        var body = stripDecoy(result.response);
        var job = body ? decryptJob(w, body) : null;
        if (!job) {
          UI.log('Xử lý tiếp tục lỗi (Thử lại ' + (attempt + 1) + '/4)…', 'warn');
          return setTimeout(function () { sendContinue(targetUrl, step, attempt + 1, waitRound); }, 3000);
        }
        if (job.status === 'finish') {
          UI.setRail(100); UI.status('hoàn tất', null); UI.log('🏆 Mở khóa thành công!', 'success');
          var fin = job.url || '';
          storeSet(KEY_LAST, fin);
          setTimeout(function () { window.location.href = targetUrl + '/?redirect_to_octo=' + encodeURIComponent(fin); }, 1000);
        } else if (job.status === 'success') {
          UI.log('Hoàn tất chặng ' + step + ', tiếp tục di chuyển…', 'success');
          UI.setRail((step / 4) * 100);
          setTimeout(function () { runStage(targetUrl, step + 1); }, 8000);
        } else {
          var serverWait = parseInt(job.wait, 10);
          var delay = serverWait > 0 ? serverWait * 1000 : Math.min(30000, 5000 + waitRound * 2500);
          UI.log('Server báo chờ: ' + (job.message || 'chưa đủ thời gian chặng') + ' — thử lại sau ' + Math.round(delay / 1000) + 's', 'warn');
          setTimeout(function () { sendContinue(targetUrl, step, attempt, waitRound + 1); }, delay);
        }
      }, function () {
        UI.log('Mất kết nối continue (Thử lại ' + (attempt + 1) + '/4)…', 'error');
        setTimeout(function () { sendContinue(targetUrl, step, attempt + 1, waitRound); }, 3000);
      }, function () {
        UI.log('Hết hạn continue (Thử lại ' + (attempt + 1) + '/4)…', 'error');
        setTimeout(function () { sendContinue(targetUrl, step, attempt + 1, waitRound); }, 3000);
      });
    }

    function startMission() {
      var targetHost = hostname;
      var targetUrl = 'https://' + targetHost;
      UI.log('Bắt đầu nhiệm vụ: ' + targetHost + '/' + missionId, 'system');
      bootLiveCore(function (ctx) {
        if (!ctx) { UI.status('lỗi core', 'bad'); return; }
        UI.log('Mã hóa hợp lệ. Cho phép tiến hành bước tiếp theo.', 'success');
        checkJob(targetUrl, 0);
      });
    }

    // ==================================================================
    // AUTO-START: không bắt user nhập, tự detect mission ID
    // ==================================================================
    function doMain() {
      initUI();
      if (missionId) {
        UI.log('Đã nhận diện mã nhiệm vụ: ' + missionId, 'detect');
        UI.log('Tự động bắt đầu bypass…', 'system');
        startMission();
      } else {
        UI.log('Không tìm thấy mã nhiệm vụ trên trang này.', 'warn');
        UI.status('không có nhiệm vụ', 'bad');
      }
    }

    try {
      if (GM_registerMenuCommand) {
        GM_registerMenuCommand('Copy link finish gần nhất', function () {
          var last = storeGet(KEY_LAST, '');
          if (last && GM_setClipboard) { GM_setClipboard(last); notify('Đã copy: ' + last); } else notify('Chưa có link finish nào.');
        });
      }
    } catch (e) {}

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', doMain);
    else doMain();
  };

  main();
})();
