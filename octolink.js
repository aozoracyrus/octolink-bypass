// ==UserScript==
// @name         OctoLink Bypass Core — aozoracyrus fork
// @namespace    https://github.com/aozoracyrus/octolink-bypass
// @version      4.1.1
// @description  Lõi bypass: giao thức 4 chặng /check/continue với LIVE CORE từ octolink.vip — iframe môi-trường-thật (script src thật, không sandbox, shim top/frameElement, đủ rd/dm/nad), fallback eval GM. Nạp bởi loader.user.js.
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
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @connect      *
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

/*
 * v4.1.1 — SỬA LỖI SyntaxError khi eval (v4.1.0 có typo trong chuỗi CSS)
 *        + SỬA LỖI "Core live khởi tạo thất bại (30s)" của v4.0.0.
 *
 * Thay đổi so với v4.1.0:
 *  - Sửa CSS typo: width:9px;9px; → width:9px;height:9px;
 *  - Kiểm tra kỹ cú pháp toàn file trước khi eval.
 */
(function () {
  'use strict';

  var host = String(window.location.hostname || '').toLowerCase();
  var path = String(window.location.pathname || '');
  function matchHost(h, d) { return h === d || (h.length > d.length && h.slice(-(d.length + 1)) === '.' + d); }
  var isOcto = matchHost(host, 'octolink.vip');
  var isGuideHost = matchHost(host, 'linkhuongdan.online') || matchHost(host, 'totreview.com') || matchHost(host, 'minuc.vn');

  var isFinish = isOcto && /^\/+finish(\/|$)/i.test(path);
  function is404Page() {
    var t = (document.title || '') + ' ' + (document.body ? (document.body.innerText || '').slice(0, 300) : '');
    return /404/.test(t) && /not\s*found|nginx/i.test(t);
  }
  if (isFinish && !is404Page()) { console.log('[otl-bypass] Trang captcha — tự tắt.'); return; }
  if (!isGuideHost && !isOcto) return;
  if (window.__otlBypassRunning) return;
  window.__otlBypassRunning = true;

  var MY_VERSION = '4.1.1';
  var KEY_LAST = 'otl_last_target_v4';

  // =====================================================================
  // GM API + safeRequest
  // =====================================================================
  function gm(n) { return (typeof GM !== 'undefined' && GM && typeof GM[n] === 'function') ? GM[n].bind(GM) : undefined; }
  var gGet = typeof GM_getValue === 'function' ? GM_getValue : gm('getValue');
  var gSet = typeof GM_setValue === 'function' ? GM_setValue : gm('setValue');
  var gClip = typeof GM_setClipboard === 'function' ? GM_setClipboard : gm('setClipboard');
  var gNoti = typeof GM_notification === 'function' ? GM_notification : gm('notification');
  var gMenu = typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : gm('registerMenuCommand');
  function storeGet(k, f) { try { var v = gGet ? gGet(k, f); return (v == null) ? f : v; } catch (e) { return f; } }
  function storeSet(k, v) { try { if (gSet) gSet(k, v); } catch (e) {} }

  function safeRequest(opts) {
    var fired = false;
    var onLoad = opts.onload, onErr = opts.onerror, onTmo = opts.ontimeout;
    var timeout = opts.timeout || 30000;
    function done(fn, arg) { if (fired) return; fired = true; clearTimeout(safety); try { fn && fn(arg); } catch (e) {} }
    opts.onload = function (r) { done(onLoad, r); };
    opts.onerror = function (e) { done(onErr, e); };
    opts.ontimeout = function () { done(onTmo); };
    function fallback() {
      if (fired) return;
      var fOpts = { method: opts.method || 'GET', headers: {} };
      if (opts.headers) for (var k in opts.headers) fOpts.headers[k] = opts.headers[k];
      if (opts.data) fOpts.body = opts.data;
      window.fetch(opts.url, fOpts).then(function (resp) {
        return resp.text().then(function (txt) {
          done(onLoad, { status: resp.status, responseText: txt, response: txt,
            responseHeaders: Array.from(resp.headers.entries()).map(function (h) { return h[0] + ': ' + h[1]; }).join('\n') });
        });
      }).catch(function (err) { done(onErr, { statusText: 'fetch_failed: ' + (err.message || err) }); });
    }
    var safety = setTimeout(fallback, Math.max(timeout * 1.5, 12000));
    if (typeof GM_xmlhttpRequest === 'function') { try { GM_xmlhttpRequest(opts); } catch (e) { fallback(); } }
    else fallback();
  }

  var cookieJar = { from_google: 'true' }, cookieHeader = '';
  function collectCookies(rawHeaders) {
    if (!rawHeaders) return;
    String(rawHeaders).split('\x0a').forEach(function (item) {
      var m = /set-cookie:\s*([^=;]+)=([^;\r\n]*)/i.exec(item);
      if (m) cookieJar[m[1].trim()] = m[2].trim();
    });
    var pairs = [];
    for (var k in cookieJar) pairs.push(k + '=' + cookieJar[k]);
    cookieHeader = pairs.join(';\x20') + (pairs.length ? ';\x20' : '');
  }

  // =====================================================================
  // FINGERPRINT THẬT + SPOOF
  // =====================================================================
  var REAL_UA = ''; try { REAL_UA = String(navigator.userAgent || ''); } catch (e) {}
  var USER_AGENT = REAL_UA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
  var IS_MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile/i.test(USER_AGENT);
  function jsLiteral(v) { return JSON.stringify(v == null ? '' : v); }
  var FP_REAL = (function () {
    var nav = {}; try { nav = navigator || {}; } catch (e) {}
    function num(v, f) { var n = parseInt(v, 10); return isNaN(n) ? f : n; }
    var scr = { width: 1920, height: 1080 }; try { if (screen && screen.width) scr = screen; } catch (e) {}
    return {
      platform: String(nav.platform || (IS_MOBILE_UA ? 'Linux armv8l' : 'Win32')),
      deviceMemory: num(nav.deviceMemory, 8),
      hardwareConcurrency: num(nav.hardwareConcurrency, 4),
      maxTouchPoints: num(nav.maxTouchPoints, IS_MOBILE_UA ? 5 : 0),
      language: String(nav.language || 'vi'),
      languages: (function () { try { if (nav.languages && nav.languages.length) return Array.prototype.slice.call(nav.languages); } catch (e) {} return ['vi-VN', 'vi', 'en-US', 'en']; })(),
      mobile: IS_MOBILE_UA,
      screen: (scr.width || 1920) + 'x' + (scr.height || 1080)
    };
  })();

  function buildSpoofScript() {
    return '(function(){function _def(o,k,v){try{Object.defineProperty(o,k,{get:function(){return v;},' +
      'configurable:true});return;}catch(e){}try{var p=Object.getPrototypeOf(o);if(p){' +
      'Object.defineProperty(p,k,{get:function(){return v;},configurable:true});}}catch(e2){}}' +
      'try{var _n=navigator,_c=document.createElement("canvas");_c.width=1280;_c.height=720;' +
      'var _ctx=_c.getContext("2d");_ctx.textBaseline="top";_ctx.font="14px Arial";' +
      '_ctx.fillStyle="#f60";_ctx.fillRect(125,1,62,20);_ctx.fillStyle="#069";' +
      '_ctx.fillText("Fingerprint "+Date.now(),2,15);_ctx.fillStyle="rgba(102,204,0,0.7)";' +
      '_ctx.fillText("Spoofed Canvas",4,45);var _cv=_c.toDataURL();' +
      'HTMLCanvasElement.prototype.toDataURL=function(){return _cv;};' +
      'HTMLCanvasElement.prototype.toBlob=function(cb,type,enc){_c.toBlob(cb,type,enc);};' +
      '_def(_n,"deviceMemory",' + FP_REAL.deviceMemory + ');_def(_n,"hardwareConcurrency",' + FP_REAL.hardwareConcurrency + ');' +
      '_def(_n,"maxTouchPoints",' + FP_REAL.maxTouchPoints + ');_def(_n,"language",' + jsLiteral(FP_REAL.language) + ');' +
      '_def(_n,"languages",' + JSON.stringify(FP_REAL.languages) + ');_def(_n,"platform",' + jsLiteral(FP_REAL.platform) + ');' +
      'try{Object.defineProperty(document,"referrer",{get:function(){return "https://www.google.com/";},configurable:true});' +
      'document.cookie="from_google=true; path=/";}catch(e){}}catch(e){}})();';
  }

  var SEAL_SCRIPT = '(function(){function _sealCd(){try{var d=window.directjscd;if(!d||typeof d!=="object")return;' +
    'try{if(d.userscript!==undefined)d.userscript=0;}catch(e){}try{if("userscript_score"in d&&d.userscript_score)d.userscript_score=0;}catch(e){}' +
    'try{if(d.gm_apis)d.gm_apis=false;}catch(e){}try{if(d.extension_runtime)d.extension_runtime=false;}catch(e){}' +
    'try{var lu=d.layered_userscript;if(lu&&typeof lu==="object"){if(lu.score)lu.score=0;' +
    'if(Array.isArray(lu.detections)&&lu.detections.length)lu.detections=lu.detections.filter(function(x){' +
    'return !/userscript|tampermonkey|greasemonkey|violentmonkey/i.test(String((x&&x.kind)||x.name||x));});}}catch(e){}' +
    'try{var tm=d.timing;if(tm&&typeof tm==="object"&&tm.score&&tm.score>100)tm.score=0;}catch(e){}}catch(e){}}' +
    'var _iv=setInterval(function(){if(typeof window.__b110671==="function"&&!window.__b110671.__sealed){' +
    'var _o=window.__b110671;window.__b110671=function(){_sealCd();return _o();};' +
    'try{Object.defineProperty(window.__b110671,"__sealed",{value:true});}catch(e){}clearInterval(_iv);}},80);})();';

  var SHIM_SCRIPT =
    '(function(){' +
    'try{Object.defineProperty(window,"top",{get:function(){return window;},configurable:true});}catch(e){}' +
    'try{Object.defineProperty(window,"parent",{get:function(){return window;},configurable:true});}catch(e){}' +
    'try{Object.defineProperty(window,"frameElement",{get:function(){return null;},configurable:true});}catch(e){}' +
    'try{Object.defineProperty(window,"opener",{get:function(){return null;},configurable:true});}catch(e){}' +
    'try{Object.defineProperty(document,"hidden",{get:function(){return false;},configurable:true});}catch(e){}' +
    'try{Object.defineProperty(document,"visibilityState",{get:function(){return "visible";},configurable:true});}catch(e){}' +
    'try{Object.defineProperty(document,"hasFocus",{value:function(){return true;},configurable:true});}catch(e){}' +
    '})();';

  // =====================================================================
  // UI
  // =====================================================================
  var UI = null;
  function initUI() {
    if (UI) return UI;
    var st = document.createElement('style');
    st.textContent =
      ':root{--oc-accent:#a855f7;--oc-accent2:#22d3ee;--oc-text:#e9e6f5;--oc-dim:#9b93b8;' +
      '--oc-ok:#34d399;--oc-warn:#fbbf24;--oc-err:#fb7185;--oc-sys:#60a5fa;}' +
      '@keyframes oc-in{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}' +
      '@keyframes oc-pop{0%{opacity:0;transform:translateY(10px) scale(.96)}60%{transform:translateY(-2px) scale(1.01)}100%{opacity:1;transform:none}}' +
      '@keyframes oc-ring{0%{box-shadow:0 0 0 0 rgba(168,85,247,.55)}100%{box-shadow:0 0 0 12px rgba(168,85,247,0)}}' +
      '@keyframes oc-sheen{0%{background-position:-200% 0}100%{background-position:200% 0}}' +
      '.lux-panel{position:fixed;bottom:22px;right:22px;width:min(410px,calc(100vw - 24px));height:400px;z-index:2147483647;' +
      'display:flex;flex-direction:column;color:var(--oc-text);font:13px/1.5 system-ui,sans-serif;border-radius:18px;' +
      'background:linear-gradient(180deg,rgba(20,16,34,.95),rgba(8,6,15,.97));border:1px solid rgba(168,85,247,.25);' +
      'box-shadow:0 24px 60px -12px rgba(0,0,0,.85);animation:oc-pop .45s cubic-bezier(.2,.9,.25,1) both}' +
      '.lux-panel.oc-collapsed{height:56px!important}' +
      '.lux-panel.oc-collapsed .lux-body,.lux-panel.oc-collapsed .oc-rail{display:none}' +
      '.lux-header{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.07)}' +
      '.oc-dot{width:9px;height:9px;border-radius:50%;background:var(--oc-ok);box-shadow:0 0 10px var(--oc-ok);animation:oc-ring 2.2s ease-out infinite;flex:none}' +
      '.oc-dot.busy{background:var(--oc-accent2);box-shadow:0 0 10px var(--oc-accent2)}' +
      '.oc-dot.bad{background:var(--oc-err);box-shadow:0 0 10px var(--oc-err)}' +
      '.oc-title{font-weight:800;font-size:12.5px;letter-spacing:.12em;background:linear-gradient(92deg,#fff,#d8b4fe 35%,#67e8f9 65%,#fff);' +
      'background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:oc-sheen 6s linear infinite}' +
      '.oc-sub{font-size:10px;color:var(--oc-dim);letter-spacing:.05em}' +
      '.lux-header .sp{flex:1}' +
      '.lux-btn{width:26px;height:26px;display:grid;place-items:center;border-radius:8px;cursor:pointer;background:rgba(255,255,255,.05);' +
      'border:1px solid rgba(255,255,255,.08);color:var(--oc-dim);font-size:13px;font-weight:700;transition:all .18s}' +
      '.lux-btn:hover{background:rgba(168,85,247,.2);border-color:rgba(168,85,247,.5);color:#fff}' +
      '.oc-rail{height:2px;background:rgba(255,255,255,.06);overflow:hidden}' +
      '.oc-rail>i{display:block;height:100%;width:0%;background:linear-gradient(90deg,var(--oc-accent),var(--oc-accent2));box-shadow:0 0 8px rgba(168,85,247,.7);transition:width .5s linear}' +
      '.lux-body{flex:1;min-height:0;padding:10px;overflow-y:auto;scrollbar-width:thin}' +
      '.log-entry{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;padding:7px 10px;border-radius:10px;' +
      'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.05);animation:oc-in .3s both;font-size:12px}' +
      '.log-entry .t{color:#6b6488;font:9.5px ui-monospace,monospace;flex:none;padding-top:1px}' +
      '.log-entry.success{border-color:rgba(52,211,153,.35)}.log-entry.success .tx::before{content:"✓ ";color:var(--oc-ok);font-weight:700}' +
      '.log-entry.warn{border-color:rgba(251,191,36,.35)}.log-entry.warn .tx::before{content:"⚠ ";color:var(--oc-warn)}' +
      '.log-entry.error{border-color:rgba(251,113,133,.4)}.log-entry.error .tx::before{content:"✗ ";color:var(--oc-err)}' +
      '.log-entry.system .tx::before{content:"› ";color:var(--oc-sys)}' +
      '.log-entry.detect{border-color:rgba(34,211,238,.3)}.log-entry.detect .tx::before{content:"◈ ";color:var(--oc-accent2)}' +
      '.oc-form{margin-top:4px;padding:10px;border-radius:12px;background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.3)}' +
      '.oc-form label{display:block;font-size:10px;letter-spacing:.14em;color:var(--oc-dim);margin-bottom:6px}' +
      '.oc-form .row{display:flex;gap:8px}' +
      '.oc-form input{flex:1;min-width:0;background:#0a0716;border:1px solid rgba(168,85,247,.4);border-radius:8px;color:#fff;' +
      'padding:8px 10px;font:12.5px ui-monospace,monospace;outline:none}' +
      '.oc-form input:focus{border-color:var(--oc-accent2);box-shadow:0 0 0 3px rgba(34,211,238,.15)}' +
      '.oc-form button{background:linear-gradient(135deg,var(--oc-accent),#7c3aed);color:#fff;border:none;border-radius:8px;' +
      'padding:8px 14px;font-weight:700;font-size:12px;cursor:pointer;transition:transform .15s,box-shadow .2s}' +
      '.oc-form button:hover{transform:translateY(-1px);box-shadow:0 8px 20px -6px rgba(168,85,247,.6)}';
    (document.head || document.documentElement).appendChild(st);

    var p = document.createElement('div');
    p.className = 'lux-panel';
    p.innerHTML =
      '<div class="lux-header"><span class="oc-dot" id="ocDot"></span>' +
      '<div><div class="oc-title">OCTO BYPASS</div><div class="oc-sub" id="ocStt">aozoracyrus · v' + MY_VERSION + '</div></div>' +
      '<span class="sp"></span>' +
      '<button class="lux-btn" id="ocMin" title="Thu gọn">–</button>' +
      '<button class="lux-btn" id="ocX" title="Đóng">✕</button></div>' +
      '<div class="oc-rail"><i id="ocRail"></i></div>' +
      '<div class="lux-body" id="ocBody"></div>';
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
      setRail: function (pct) { UI.rail.style.width = Math.max(0, Math.min(100, pct)) + '%'; },
      form: function (onSubmit) {
        var f = document.createElement('div');
        f.className = 'oc-form';
        f.innerHTML = '<label>NHẬP TÊN MIỀN ĐÍCH</label><div class="row">' +
          '<input type="text" spellcheck="false" placeholder="vidu.com"><button>Xác nhận</button></div>';
        UI.body.appendChild(f);
        var inp = f.querySelector('input'), btn = f.querySelector('button');
        function go() {
          var v = inp.value.trim().replace(/^https?:\/\//i, '').replace(/[\/\s].*$/, '');
          if (!v || v.indexOf('.') < 1) { inp.focus(); return; }
          f.remove(); onSubmit(v);
        }
        btn.onclick = go;
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
        UI.body.scrollTop = UI.body.scrollHeight;
        setTimeout(function () { inp.focus(); }, 60);
      }
    };
    p.querySelector('#ocMin').onclick = function () { p.classList.toggle('oc-collapsed'); };
    p.querySelector('#ocX').onclick = function () { p.style.display = 'none'; };
    return UI;
  }

  function notify(t) { try { if (gNoti) gNoti({ title: 'OctoLink Bypass', text: t, timeout: 4000 }); } catch (e) {} }

  // =====================================================================
  // LIVE CORE v4.1.1 — iframe môi-trường-thật
  // =====================================================================
  var coreCtx = null;
  var lastProbe = 'chưa probe';

  function readJsConfig(text) {
    function num(name) { var m = text.match(new RegExp('(?:var\\s+)?' + name + '\\s*=\\s*(\\d+)')); return m ? parseInt(m[1], 10) : null; }
    function str(name) { var m = text.match(new RegExp('var\\s+' + name + '\\s*=\\s*"([^"]*)"')); return m ? m[1] : null; }
    function bool(name) { var m = text.match(new RegExp('var\\s+' + name + '\\s*=\\s*(true|false)')); return m ? m[1] === 'true' : null; }
    return { rd: str('rd') || '', dm: str('dm') || '', fk: str('fk'), fr: str('fr'),
      nad: bool('nad'), w1: num('w1'), w2: num('w2'), w3: num('w3'), ad: num('ad') };
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

  function diagCore(w) {
    var miss = [];
    ['__hf', '__b110671', '__se4ce', '__se331'].forEach(function (n) {
      try { if (typeof w[n] !== 'function') miss.push(n); } catch (e) { miss.push(n); }
    });
    UI.log('diag: thiếu [' + (miss.join(', ') || 'không') + '] · ' + lastProbe, 'warn');
  }

  function bootLiveCore(done) {
    UI.log('Khởi động siêu hệ thống…', 'system');
    UI.status('đang nạp core…', 'busy');
    var t0 = Date.now();
    safeRequest({
      method: 'GET', url: 'https://octolink.vip/statics/jsconfig.js', timeout: 20000,
      headers: { accept: '*/*', referer: 'https://octolink.vip/', 'user-agent': USER_AGENT },
      onload: function (resp) {
        collectCookies(resp.responseHeaders);
        UI.log('Mạng OK → octolink.vip/statics/jsconfig.js (' + resp.status + ', ' + (Date.now() - t0) + 'ms)', 'detect');
        var cfg = readJsConfig(resp.responseText || '');
        UI.log('jsconfig live: rd=' + (cfg.rd ? cfg.rd.slice(0, 16) + '…' : '(trống)') + ' nad=' + cfg.nad + ' dm=' + (cfg.dm || '(mặc định)'), 'system');

        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        (document.body || document.documentElement).appendChild(iframe);
        var w = iframe.contentWindow;
        try { if (!w || !w.document) throw new Error('blocked'); } catch (e) {
          UI.log('Không truy cập được iframe core trên trình duyệt này.', 'error'); return done(null);
        }
        try {
          w.addEventListener('error', function (ev) {
            try { UI.log('Lõi iframe ném lỗi: ' + (ev && ev.message ? ev.message : '?') + ' (dòng ' + (ev && ev.lineno ? ev.lineno : '?') + ')', 'error'); } catch (e2) {}
          }, true);
        } catch (e) {}

        var cfgScript = 'var rd=' + jsLiteral(cfg.rd || '') + ';var dm=' + jsLiteral(cfg.dm || 'https://octolink.vip') +
          ';var nad=' + (cfg.nad === false ? 'false' : 'true') + ';';
        if (cfg.fk) cfgScript += 'var fk=' + jsLiteral(cfg.fk) + ';';
        if (cfg.fr) cfgScript += 'var fr=' + jsLiteral(cfg.fr) + ';';
        if (cfg.w1 != null) cfgScript += 'var w1=' + cfg.w1 + ';';
        if (cfg.w2 != null) cfgScript += 'var w2=' + cfg.w2 + ';';
        if (cfg.w3 != null) cfgScript += 'var w3=' + cfg.w3 + ';';

        var coreUrl = 'https://octolink.vip/js/shortearn.live.js?v=' + Date.now();
        var doc = w.document;
        doc.open();
        doc.write('<!DOCTYPE html><html><head></head><body>' +
          '<script>' + SHIM_SCRIPT + '<\/script>' +
          '<script>' + buildSpoofScript() + '<\/script>' +
          '<script>' + SEAL_SCRIPT + '<\/script>' +
          '<script>' + cfgScript + '<\/script>' +
          '<script src="' + coreUrl + '"><\/script>' +
          '</body></html>');
        doc.close();
        UI.log('Đã dựng iframe core: script src thật, không sandbox, shim top/frameElement.', 'system');

        var settled = false;
        function succeed() {
          if (settled) return; settled = true;
          coreCtx = { rd: cfg.rd, w: w };
          UI.log('Fingerprint thật đã sẵn sàng.', 'success');
          UI.log('Core live sẵn sàng.', 'success');
          done(coreCtx);
        }
        function failoverEval() {
          if (settled) return;
          UI.log('Script src không khởi tạo được core — thử GM_fetch + eval trong iframe…', 'warn');
          safeRequest({
            method: 'GET', url: coreUrl, timeout: 20000,
            headers: { accept: '*/*', referer: 'https://octolink.vip/', 'user-agent': USER_AGENT },
            onload: function (r2) {
              collectCookies(r2.responseHeaders);
              var src = r2.responseText || '';
              if (src.length < 200) { UI.log('Core live rỗng (' + src.length + 'B).', 'error'); diagCore(w); return done(null); }
              UI.log('Đã nạp core live (' + Math.round(src.length / 1024) + 'KB) — eval trong iframe.', 'success');
              try { w.eval(src); } catch (e) {
                UI.log('Lõi ném lỗi khi eval: ' + (e && e.message ? e.message : e), 'error');
              }
              pollCore(w, 30, function (ok) {
                if (ok) return succeed();
                UI.log('Core live khởi tạo thất bại (cả 2 cách).', 'error');
                diagCore(w); done(null);
              });
            },
            onerror: function () { UI.log('Không tải được shortearn.live.js.', 'error'); done(null); },
            ontimeout: function () { UI.log('Hết hạn tải core.', 'error'); done(null); }
          });
        }
        pollCore(w, 40, function (ok) { if (ok) succeed(); else failoverEval(); });
      },
      onerror: function () { UI.log('Không với tới octolink.vip (kiểm tra mạng/VPN).', 'error'); done(null); },
      ontimeout: function () { UI.log('Hết hạn jsconfig.', 'error'); done(null); }
    });
  }

  // =====================================================================
  // GIAO THỨC: /check/job -> 4 chặng /check/continue
  // =====================================================================
  function toBytes(input) {
    if (!input) return null;
    if (typeof input === 'string') {
      if (!input.length) return null;
      var b = new Uint8Array(input.length);
      for (var i = 0; i < input.length; i++) b[i] = input.charCodeAt(i) & 0xff;
      return b;
    }
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
        method: 'POST', url: url, headers: headers, timeout: 30000,
        responseType: rt, data: payload,
        onload: function (resp) {
          collectCookies(resp.responseHeaders);
          var bytes = toBytes(resp.response) || toBytes(resp.responseText);
          if (!bytes && !retried) { retried = true; return attempt('text'); }
          onDone({ response: bytes, headers: resp.headers || resp.responseHeaders || '' });
        },
        onerror: onErr, ontimeout: onTmo
      });
    }
    attempt('arraybuffer');
  }

  function decryptJob(w, body) {
    var job = null;
    var wb = body;
    try { if (w && w.Uint8Array) { wb = new w.Uint8Array(body.length); for (var i0 = 0; i0 < body.length; i0++) wb[i0] = body[i0]; } } catch (e) {}
    try { if (typeof w.__se331 === 'function') w.__se331(wb); if (typeof w.__se4ce === 'function') job = w.__se4ce(wb); } catch (e) {}
    if (!job) {
      try {
        var out = new Uint8Array(body.length);
        for (var i = 0; i < body.length; i++) out[i] = body[i] ^ 0x02;
        job = JSON.parse(new TextDecoder('utf-8').decode(out));
        if (job) UI.log('Giải mã mới (byte-0x02) thành công!', 'success');
      } catch (e) {}
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
    safeRequest({
      method: 'GET', url: 'https://octolink.vip/statics/jsconfig.js', timeout: 20000, anonymous: true,
      headers: { accept: '*/*', referer: 'https://octolink.vip/', 'user-agent': USER_AGENT },
      onload: function (resp) {
        collectCookies(resp.responseHeaders);
        var cfg = readJsConfig(resp.responseText || '');
        if (cfg.rd) { coreCtx.rd = cfg.rd; try { w.rd = cfg.rd; } catch (e) {} UI.log('Mã hóa đã làm mới: ' + cfg.rd.slice(0, 16) + '…', 'success'); }
        else UI.log('Không thể làm mới mã hóa, dùng giá trị cũ.', 'warn');
        try {
          if (cfg.nad != null) w.nad = cfg.nad;
          if (cfg.w1 != null) w.w1 = cfg.w1; if (cfg.w2 != null) w.w2 = cfg.w2; if (cfg.w3 != null) w.w3 = cfg.w3;
          if (cfg.ad != null) w.ad = cfg.ad; if (cfg.fk) w.fk = cfg.fk; if (cfg.fr != null) w.fr = cfg.fr; if (cfg.dm) w.dm = cfg.dm;
        } catch (e) {}
        done(cfg);
      },
      onerror: function () { done(null); }, ontimeout: function () { done(null); }
    });
  }

  var missionHalted = false;

  function checkJob(targetUrl, attempt) {
    if (missionHalted || !coreCtx) return;
    var w = coreCtx.w;
    if (attempt > 3) { UI.log('Tên miền lưu trữ đã hết hạn hoặc bị từ chối. Vui lòng cập nhật tên miền mới.', 'error'); return; }
    refreshConfig(w, function () {
      var payload;
      try { payload = w.__b110671(); } catch (e) { payload = null; }
      if (!payload) { UI.log('Core không tạo được payload.', 'error'); return; }
      var headers = buildGuardHeaders(w, '/check/job', payload);
      UI.log('Đang kiểm tra định tuyến cho: ' + targetUrl, 'system');
      UI.log('Truy cập ẩn ' + targetUrl + ' để xác định domain thật…', 'system');
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
    if (attempt > 3) { UI.log('Phát sinh lỗi vượt chặng ' + step + '. Tạm dừng.', 'error'); return; }
    if (waitRound > 6) { UI.log('Server chờ mãi ở chặng ' + step + '. Tạm dừng.', 'error'); return; }

    var payload;
    try { payload = w.__b110671(); } catch (e) { payload = null; }
    if (!payload) { UI.log('Core không tạo được payload continue.', 'error'); return; }

    UI.log('Hết chờ, gửi continue chặng ' + step + '…', 'system');
    UI.log('Gửi /check/continue (chặng ' + step + ', lần ' + (attempt + 1) + '/4' + (waitRound ? ', chờ ' + waitRound + '/6' : '') + ')…', 'system');
    var headers = buildGuardHeaders(w, '/check/continue', payload);

    postBinary('https://octolink.vip/check/continue', payload, headers, function (result) {
      var body = stripDecoy(result.response);
      var job = body ? decryptJob(w, body) : null;
      if (!job) {
        UI.log('Xử lý tiếp tục lỗi (Thử lại ' + (attempt + 1) + '/4)…', 'warn');
        return setTimeout(function () { sendContinue(targetUrl, step, attempt + 1, waitRound); }, 3000);
      }
      if (job.status === 'finish') {
        UI.setRail(100);
        UI.status('hoàn tất', null);
        UI.log('Mở khóa thành công!', 'success');
        var fin = job.url || '';
        storeSet(KEY_LAST, fin);
        setTimeout(function () {
          window.location.href = targetUrl + '/?redirect_to_octo=' + encodeURIComponent(fin);
        }, 1000);
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

  // =====================================================================
  // Điều phối
  // =====================================================================
  function startMission(domain) {
    var targetUrl = 'https://' + domain;
    bootLiveCore(function (ctx) {
      if (!ctx) { UI.status('lỗi core', 'bad'); return; }
      UI.log('Đang kiểm tra giao thức định tuyến tại jsconfig…', 'system');
      UI.log('Mã hóa hợp lệ. Cho phép tiến hành bước tiếp theo.', 'success');
      checkJob(targetUrl, 0);
    });
  }

  function recover404() {
    UI.log('Trang /finish/ trả 404 — bật recovery.', 'warn');
    UI.status('404 — recovery', 'bad');
    var last = String(storeGet(KEY_LAST, '') || '');
    UI.log('Link finish gần nhất: ' + (last || '(không có)') + ' — nhập miền để chạy lại nhiệm vụ.', 'warn');
    UI.form(function (domain) {
      UI.log('Chạy lại nhiệm vụ với miền: ' + domain, 'system');
      startMission(domain);
    });
  }

  function main() {
    initUI();
    if (isFinish && is404Page()) { recover404(); return; }

    var seg = path.split('/').filter(Boolean);
    var missionId = seg.length ? seg[seg.length - 1].replace(/\.html$/i, '') : '';
    if (missionId) UI.log('Đã nhận diện mã nhiệm vụ: ' + location.origin + '/' + missionId + '/?qq=complete', 'detect');

    var netT0 = Date.now();
    safeRequest({
      method: 'GET', url: 'https://api.github.com/repos/aozoracyrus/octolink-bypass', timeout: 10000,
      onload: function (r) { UI.log('Mạng OK → api.github.com (' + r.status + ', ' + (Date.now() - netT0) + 'ms)', 'detect'); },
      onerror: function () { UI.log('api.github.com không với tới — bỏ qua.', 'warn'); }
    });

    UI.log('Nhiệm vụ mới. Vui lòng nhập tên miền thủ công.', 'warn');
    UI.status('chờ nhập miền…', 'busy');
    UI.form(startMission);
  }

  try {
    if (gMenu) {
      gMenu('Copy link finish gần nhất', function () {
        var last = storeGet(KEY_LAST, '');
        if (last && gClip) { gClip(last); notify('Đã copy: ' + last); } else notify('Chưa có link finish nào.');
      });
    }
  } catch (e) {}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
