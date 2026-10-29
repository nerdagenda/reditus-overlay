/* The Reditus Campaign — browser overlay engine
   URL options:
     ?scene=main | spotlight | map | gm | intro
     &focus=darius        (spotlight: which character is featured)
     &guides=1            (shows labelled camera boxes with exact pixel positions)
     &preview=1           (fills camera holes with character art — for checking the look outside OBS)
     &ticker=0 / &logos=0 (force off)   &ticker=1 (force on)
*/
(function () {
  "use strict";
  var W = 1920, H = 1080;
  var q = new URLSearchParams(location.search);
  var SCENE = (q.get("scene") || "main").toLowerCase();
  var FOCUS = (q.get("focus") || "").toLowerCase();
  var GUIDES = q.get("guides") === "1" || q.get("guides") === "true";
  var PREVIEW = q.get("preview") === "1" || q.get("preview") === "true";
  // ?layer=under → the bottom OBS layer: only the looping character videos, placed exactly where the cameras go
  var UNDER = (q.get("layer") || "").toLowerCase() === "under";
  var POLL_MS = +(q.get("poll") || 4000);

  var stage = document.getElementById("stage");
  var D = null, BUILD = null, lastSig = "";

  /* ---------------- helpers ---------------- */
  function el(tag, cls, parent, style) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) for (var k in style) e.style[k] = style[k];
    if (parent) parent.appendChild(e);
    return e;
  }
  function px(n) { return Math.round(n * 100) / 100 + "px"; }
  function place(e, x, y, w, h) { e.style.left = px(x); e.style.top = px(y); if (w != null) e.style.width = px(w); if (h != null) e.style.height = px(h); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fit() { var s = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = "scale(" + s + ")"; }
  addEventListener("resize", fit); fit();

  /* ---------------- data loading (works from a web host AND from a local file in OBS) ---------------- */
  function loadData(cb) {
    var s = document.createElement("script");
    s.src = "data.js?t=" + Date.now();
    s.onload = function () { s.remove(); cb && cb(window.REDITUS); };
    s.onerror = function () { s.remove(); };
    document.head.appendChild(s);
  }
  var LOCAL_PREVIEW = false;   // set when the control panel is driving this page with unsaved data
  function poll() {
    if (LOCAL_PREVIEW) return;
    loadData(function (d) {
      if (!d) return;
      if (BUILD != null && d.build !== BUILD) { location.reload(); return; }
      var sig = JSON.stringify(d);
      if (sig !== lastSig) { lastSig = sig; D = d; render(); }
    });
  }

  /* ---------------- layout maths ---------------- */
  // Fit n boxes of a given aspect into an area as a grid; last row centred.
  function grid(n, area, cols, aspect, gx, gy) {
    var out = []; if (!n) return out;
    var c = Math.min(cols, n), r = Math.ceil(n / c);
    var wW = (area.w - (c - 1) * gx) / c, wH = ((area.h - (r - 1) * gy) / r) * aspect;
    var w = Math.min(wW, wH), h = w / aspect;
    var totH = r * h + (r - 1) * gy, y0 = area.y + (area.h - totH) / 2;
    for (var i = 0; i < n; i++) {
      var row = Math.floor(i / c), inRow = Math.min(c, n - row * c), idx = i - row * c;
      var totW = inRow * w + (inRow - 1) * gx, x0 = area.x + (area.w - totW) / 2;
      out.push({ x: x0 + idx * (w + gx), y: y0 + row * (h + gy), w: w, h: h });
    }
    return out;
  }
  // Stack n boxes vertically in a column.
  function column(n, x, y, maxW, maxH, aspect, areaH, minGap) {
    var out = []; if (!n) return out;
    var h = Math.min(maxH, (areaH - (n - 1) * minGap) / n), w = Math.min(maxW, h * aspect); h = w / aspect;
    var gap = n > 1 ? (areaH - n * h) / (n - 1) : 0; gap = Math.min(gap, minGap * 3);
    var tot = n * h + (n - 1) * gap, y0 = y + (areaH - tot) / 2;
    for (var i = 0; i < n; i++) out.push({ x: x + (maxW - w) / 2, y: y0 + i * (h + gap), w: w, h: h });
    return out;
  }

  function seated(order) {
    var party = (D.party || []).filter(function (p) { return p.seat !== false; });
    if (order && order.length) {
      var byId = {}; (D.party || []).forEach(function (p) { byId[p.id] = p; });
      party = order.map(function (id) { return byId[id]; }).filter(Boolean);
    }
    return party;
  }

  var S = { s: { k: .16, t: 2, np: "s" }, m: { k: .2, t: 2, np: "m" }, l: { k: .27, t: 3, np: "l" } };

  function layout() {
    var cfg = (D.scenes && D.scenes[SCENE]) || {};
    var gm = D.gm || {}, gmLabel = gm.label || "Grand Master";
    var party = seated(cfg.order), slots = [], L = { slots: slots, ticker: false, logos: false, lines: "main", holes: true };
    function gmSlot(r, size, npPos) { slots.push({ id: "gm", label: gmLabel, who: gm, x: r.x, y: r.y, w: r.w, h: r.h, size: size, npPos: npPos }); }
    function pSlot(p, r, size, npPos) { slots.push({ id: p.id, label: p.name, who: p, x: r.x, y: r.y, w: r.w, h: r.h, size: size, npPos: npPos || "bottom" }); }

    if (SCENE === "main") {
      L.ticker = L.logos = true;
      // GM window: slides right by gmShift × its width (control panel slider), never closer than 46px to the party
      var pg = grid(party.length, { x: 486, y: 115, w: 1388, h: 636 }, party.length <= 4 ? 2 : party.length <= 6 ? 3 : 4, 432 / 281, 46, 74);
      var gridLeft = pg.reduce(function (m, r) { return Math.min(m, r.x); }, 1920);
      var shiftPx = 386 * (cfg.gmShift != null ? +cfg.gmShift : 0.2);
      shiftPx = Math.max(0, Math.min(shiftPx, gridLeft - 46 - 386 - 49));
      gmSlot({ x: 49 + shiftPx, y: 120, w: 386, h: 627 }, "m", "top");
      pg.forEach(function (r, i) { pSlot(party[i], r, "s"); });
    } else if (SCENE === "spotlight") {
      L.lines = "fan";
      var f = party.filter(function (p) { return p.id === FOCUS; })[0] || party[0];
      gmSlot({ x: 79, y: 91, w: 506, h: 750 }, "m", "top");
      if (f) pSlot(f, { x: 660, y: 155, w: 896, h: 582 }, "l");
      // the spotlighted character's stat card sits under their window the whole time
      if (f) { L.ticker = true; L.tickerOnly = f.id; }
      var rest = party.filter(function (p) { return p !== f; });
      column(rest.length, 1649, 46, 224, 146, 224 / 146, 822, 17).forEach(function (r, i) { pSlot(rest[i], r, "s"); });
    } else if (SCENE === "map") {
      L.ticker = L.logos = true;
      slots.push({ id: "map", label: "Battle Map", map: true, x: 439, y: 108, w: 1040, h: 675, size: "l" });
      gmSlot({ x: 808, y: 41, w: 304, h: 203 }, "s", "bottom");
      var nl = Math.ceil(party.length / 2);
      column(nl, 34, 63, 362, 235, 362 / 235, 767, 30).forEach(function (r, i) { pSlot(party[i], r, "s"); });
      column(party.length - nl, 1523, 63, 362, 235, 362 / 235, 767, 30).forEach(function (r, i) { pSlot(party[nl + i], r, "s"); });
    } else if (SCENE === "gm") {
      L.ticker = L.logos = true; L.lines = "fan";
      gmSlot({ x: 423, y: 151, w: 1075, h: 699 }, "l", "top");
      var nl2 = Math.ceil(party.length / 2);
      column(nl2, 64, 191, 291, 189, 291 / 189, 611, 22).forEach(function (r, i) { pSlot(party[i], r, "s"); });
      column(party.length - nl2, 1565, 191, 291, 189, 291 / 189, 611, 22).forEach(function (r, i) { pSlot(party[nl2 + i], r, "s"); });
    } else if (SCENE === "break") {
      L.lines = "fan"; L.holes = false; L.brk = true;
    } else if (SCENE === "intro") {
      L.lines = "fan"; L.holes = false; L.intro = true;
    }
    if (cfg.ticker != null) L.ticker = !!cfg.ticker;
    if (cfg.logos != null) L.logos = !!cfg.logos;
    if (q.get("ticker") != null) L.ticker = q.get("ticker") === "1";
    if (q.get("logos") != null) L.logos = q.get("logos") === "1";
    return L;
  }

  /* ---------------- background (built once; holes updated on render) ---------------- */
  var bg, bgClip, linesSvg, starsCanvas;
  var LINESETS = {
    main: [
      [-60, 430, 790, -60], [-60, 250, 450, -60],
      [1010, 1140, 1980, 600], [1420, 1140, 1980, 820],
      [-60, 700, 400, 1140], [1980, 700, 1520, 1140]
    ],
    fan: [
      [-60, 1000, 640, -60], [-60, 760, 520, -60], [180, 1140, 760, -60], [-60, 1140, 700, -60],
      [1980, 1000, 1280, -60], [1980, 760, 1400, -60], [1740, 1140, 1160, -60], [1980, 1140, 1220, -60]
    ]
  };
  function buildBackground(kind) {
    bg = el("div", "", stage); bg.id = "bg";
    el("div", "base", bg);
    var NS = "http://www.w3.org/2000/svg";
    // faint hex pattern
    var hex = document.createElementNS(NS, "svg");
    hex.setAttribute("viewBox", "0 0 1920 1080");
    hex.innerHTML = '<defs><pattern id="hexp" width="240" height="415.7" patternUnits="userSpaceOnUse">' +
      '<polygon points="120,0 240,69.3 240,207.8 120,277.1 0,207.8 0,69.3" fill="rgba(70,110,210,.045)"/>' +
      '<polygon points="0,277.1 120,346.4 120,484.9 0,554.2 -120,484.9 -120,346.4" fill="rgba(70,110,210,.035)"/>' +
      '<polygon points="240,277.1 360,346.4 360,484.9 240,554.2 120,484.9 120,346.4" fill="rgba(70,110,210,.035)"/></pattern>' +
      '<radialGradient id="hexfade" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<mask id="hexmask"><rect width="1920" height="1080" fill="url(#hexfade)"/></mask></defs>' +
      '<rect width="1920" height="1080" fill="url(#hexp)" mask="url(#hexmask)"/>';
    bg.appendChild(hex);

    starsCanvas = el("canvas", "", bg); starsCanvas.width = W; starsCanvas.height = H;
    startStars(starsCanvas);

    linesSvg = document.createElementNS(NS, "svg");
    linesSvg.setAttribute("viewBox", "0 0 1920 1080");
    bg.appendChild(linesSvg);
    drawLines(kind);
    el("div", "vignette", bg);
  }
  function drawLines(kind) {
    var set = LINESETS[kind] || LINESETS.main, h = "<defs>";
    var body = "";
    set.forEach(function (L, i) {
      var x1 = L[0], y1 = L[1], x2 = L[2], y2 = L[3];
      var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), nx = -dy / len, ny = dx / len, off = 9;
      h += '<linearGradient id="lg' + i + '" gradientUnits="userSpaceOnUse" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' +
        '<stop offset="0" stop-color="#8e4d2c"/><stop offset=".3" stop-color="#f0b877"/><stop offset=".5" stop-color="#ffe9b8"/>' +
        '<stop offset=".72" stop-color="#d08a52"/><stop offset="1" stop-color="#7a3f22"/></linearGradient>';
      var dur = (26 + (i * 3.7) % 12).toFixed(1), del = (-(i * 7.3) % 26).toFixed(1);
      body += '<g class="gl">' +
        '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="url(#lg' + i + ')" stroke-width="2.6" opacity=".95"/>' +
        '<line x1="' + (x1 + nx * off) + '" y1="' + (y1 + ny * off) + '" x2="' + (x2 + nx * off) + '" y2="' + (y2 + ny * off) + '" stroke="url(#lg' + i + ')" stroke-width="1.3" opacity=".75"/>' +
        '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#fff6dc" stroke-width="2.6" stroke-linecap="round" opacity=".38" ' +
        'stroke-dasharray="140 ' + Math.round(len * 2) + '" filter="url(#glow)">' +
        '<animate attributeName="stroke-dashoffset" from="140" to="' + (-Math.round(len)) + '" dur="' + dur + 's" begin="' + del + 's" repeatCount="indefinite"/></line></g>';
    });
    if (kind === "main") {
      body = '<polygon points="0,700 0,1080 380,1080" fill="url(#panel)"/><polygon points="1920,700 1920,1080 1540,1080" fill="url(#panel)"/>' + body;
    }
    h += '<linearGradient id="panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2462" stop-opacity=".85"/><stop offset="1" stop-color="#081a4c" stop-opacity=".95"/></linearGradient>';
    h += '<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5"/></filter></defs>';
    linesSvg.innerHTML = h + body;
  }
  function startStars(c) {
    var ctx = c.getContext("2d"), dots = [], sparks = [], dust = [], i, R = Math.random;
    for (i = 0; i < 320; i++) dots.push({ x: R() * W, y: R() * H * (R() < .75 ? .7 : 1), r: R() * 1.3 + .3, a: R() * .55 + .15, gold: R() < .55, p: R() * 6.28, s: R() * .8 + .2 });
    for (i = 0; i < 26; i++) sparks.push({ x: R() * W, y: R() * H * .75, size: R() * 14 + 8, p: R() * 6.28, s: R() * .5 + .25 });
    for (i = 0; i < 60; i++) dust.push({ x: R() * W, y: R() * H, r: R() * 1.6 + .4, vy: -(R() * .25 + .05), vx: (R() - .5) * .12, a: R() * .5 + .2 });
    var last = 0;
    function frame(t) {
      requestAnimationFrame(frame);
      if (t - last < 33) return; last = t; var tt = t / 1000;
      ctx.clearRect(0, 0, W, H);
      dots.forEach(function (d) {
        var a = d.a * (.6 + .4 * Math.sin(tt * d.s + d.p));
        ctx.fillStyle = d.gold ? "rgba(255,214,150," + a + ")" : "rgba(220,230,255," + a + ")";
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill();
      });
      dust.forEach(function (d) {
        d.y += d.vy; d.x += d.vx; if (d.y < -5) { d.y = H + 5; d.x = R() * W; }
        ctx.fillStyle = "rgba(255,200,120," + d.a * .6 + ")"; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill();
      });
      sparks.forEach(function (s) {
        var a = Math.max(0, Math.sin(tt * s.s + s.p)); a = a * a * a; if (a < .02) return;
        var L = s.size * (.6 + .4 * a);
        var g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, L * .5);
        g.addColorStop(0, "rgba(255,246,220," + .9 * a + ")"); g.addColorStop(1, "rgba(255,220,160,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, L * .5, 0, 6.283); ctx.fill();
        ctx.strokeStyle = "rgba(255,240,205," + .85 * a + ")"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.x - L, s.y); ctx.lineTo(s.x + L, s.y); ctx.moveTo(s.x, s.y - L); ctx.lineTo(s.x, s.y + L); ctx.stroke();
      });
    }
    requestAnimationFrame(frame);
  }
  function setHoles(slots) {
    // An SVG mask: white = background visible, black = see-through camera window. Overlapping windows union cleanly.
    if (!slots.length) { bg.style.webkitMaskImage = bg.style.maskImage = "none"; return; }
    var r = slots.map(function (s) { return '<rect x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '" fill="black"/>'; }).join("");
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">' +
      '<rect width="1920" height="1080" fill="white"/>' + r + '</mask></defs><rect width="1920" height="1080" fill="white" mask="url(#m)"/></svg>';
    var url = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
    ["webkitMaskImage", "maskImage"].forEach(function (k) { bg.style[k] = url; });
    ["webkitMaskSize", "maskSize"].forEach(function (k) { bg.style[k] = "1920px 1080px"; });
    ["webkitMaskRepeat", "maskRepeat"].forEach(function (k) { bg.style[k] = "no-repeat"; });
  }

  /* ---------------- frames & nameplates ---------------- */
  var VIDS = {};
  var NP = { xs: { h: 22, f: 12, minW: 96, pad: 14, k: .04 }, s: { h: 34, f: 17, minW: 148, pad: 22, k: .055 }, m: { h: 44, f: 22, minW: 205, pad: 30, k: .07 }, l: { h: 56, f: 32, minW: 220, pad: 34, k: .085 } };
  function corners(parent, k, which) {
    var C = {
      tl: { w: 287, h: 337, l: -42.5, t: -51 }, tr: { w: 287, h: 337, r: -42.5, t: -51 },
      br: { w: 290, h: 341, r: -46.75, b: -53.5 }, bl: { w: 290, h: 341, l: -46.75, b: -53.5 }
    };
    which.forEach(function (c) {
      var g = C[c], e = el("div", "corner " + c, parent);
      e.style.width = px(g.w * k); e.style.height = px(g.h * k);
      if (g.l != null) e.style.left = px(g.l * k); if (g.r != null) e.style.right = px(g.r * k);
      if (g.t != null) e.style.top = px(g.t * k); if (g.b != null) e.style.bottom = px(g.b * k);
    });
  }
  function nameplate(parent, text, cx, cy, size) {
    var n = NP[size] || NP.s, e = el("div", "np", parent);
    e.style.height = px(n.h); e.style.minWidth = px(n.minW); e.style.padding = "0 " + px(n.pad);
    e.style.left = px(cx); e.style.top = px(cy); e.style.transform = "translate(-50%,-50%)";
    var t = el("span", "label gold-text", e); t.textContent = text; t.style.fontSize = px(n.f);
    corners(e, n.k, ["tl", "br"]);
    return e;
  }
  function frame(parent, s, idx) {
    var z = S[s.size] || S.s, t = z.t, f = el("div", "frame", parent);
    place(f, s.x - t, s.y - t, s.w + 2 * t, s.h + 2 * t);
    var mode = s.map ? "cam" : ((s.who && s.who.mode) || "cam");
    if (mode === "art") {
      var vid = s.who && s.who.video;
      if (vid) {
        // looping idle animation for an off-cam player; reuse the playing element across data refreshes so it never restarts
        var key = s.id + "|" + vid, vv = VIDS[key];
        if (!vv) {
          vv = document.createElement("video"); vv.className = "art"; vv.muted = true; vv.loop = true; vv.autoplay = true; vv.playsInline = true;
          vv.setAttribute("muted", ""); vv.setAttribute("playsinline", ""); vv.preload = "auto"; vv.src = vid;
          var poster = s.who.art || s.who.portrait; if (poster) vv.poster = poster;
          VIDS[key] = vv;
        }
        f.appendChild(vv); place(vv, t, t, s.w, s.h); vv.style.objectFit = "cover";
        var pr = vv.play && vv.play(); if (pr && pr.catch) pr.catch(function () {});
      } else {
        var src = (s.who && (s.who.art || s.who.portrait)) || "";
        var a = el("div", "art still", f); place(a, t, t, s.w, s.h); a.style.backgroundImage = "url('" + src + "')";
      }
    }
    var v = el("div", "vig", f); place(v, t, t, s.w, s.h);
    var vs = s.map ? .35 : .62;
    v.style.background = "radial-gradient(ellipse 72% 70% at 50% 50%, rgba(0,0,0,0) 40%, rgba(4,6,10," + vs + ") 100%)";
    var e = el("div", "edge", f); e.style.borderWidth = px(t);
    var sh = el("div", "shine", f); sh.style.padding = px(t);
    sh.style.setProperty("--sweep-delay", (-(idx * 2.1) % 14).toFixed(1) + "s");
    corners(f, z.k, ["tl", "tr", "br", "bl"]);
    if (!s.map && s.label) {
      var cx = s.x + s.w / 2, cy = s.npPos === "top" ? s.y - t / 2 : s.y + s.h + t / 2;
      var npSize = s.w < 260 ? "xs" : z.np;
      nameplate(parent, s.label, cx, cy, npSize);
      if (s.id !== "gm" && s.npPos !== "top" && s.who) hpBar(parent, s, cy - (NP[npSize] || NP.s).h / 2);
    }
    return f;
  }
  /* ---------------- live hit points (D&D Beyond via the HP relay, plus battle mode + manual overrides) ---------------- */
  var HP = {};       // ddb id → { max, current, temp, deathSaves } from the relay
  var MANUAL = {};   // party id → { current, temp, max } set from the control panel's Battle tab
  var BATTLE = null; // battle mode from the relay (null = relay has no storage; fall back to data.js)
  var MAPBARS = null; // battle-map screen has its own switch, on unless turned off
  var HPSHOWN = {};  // party id → HP last drawn, so a change can be animated
  var HPBARS = [];   // bars on screen right now
  var HPSIG = "";
  function ddbId(p) { var t = String((p && p.ddb) || ""), m = t.match(/characters\/(\d+)/) || t.match(/^\s*(\d{3,12})\s*$/); return m ? m[1] : ""; }
  function hpCfg() { return (D && D.hpRelay) || {}; }
  function battleOn() {
    if (SCENE === "map") return MAPBARS != null ? MAPBARS : hpCfg().mapBars !== false;
    return BATTLE != null ? BATTLE : !!hpCfg().battle;
  }
  function hpOn() { var c = hpCfg(); return !!c.url && c.bars !== false && battleOn(); }
  function hpFor(p) {
    if (!p) return null;
    var dd = HP[ddbId(p)], m = MANUAL[p.id];
    var ddOk = dd && !dd.error && dd.max ? dd : null;
    if (m) return { max: m.max || (ddOk && ddOk.max) || p.hp || 1, current: m.current, temp: m.temp || 0, manual: true };
    return ddOk;
  }
  function hpEligible(p) { return !!(p && (MANUAL[p.id] || ddbId(p))); }
  function hpBar(parent, s, npTop) {
    if (!hpOn() || !hpEligible(s.who)) return;
    var big = s.w >= 380;
    var bw = Math.min(s.w * (big ? .58 : .66), 420), bh = big ? 16 : 12;
    var b = el("div", "hpbar" + (big ? " big" : ""), parent);
    place(b, s.x + (s.w - bw) / 2, npTop - bh - (big ? 12 : 8), bw, bh);
    b.innerHTML = '<div class="trk"><i class="lag"></i><i class="fill"></i><i class="tmp"></i></div><div class="num"></div><div class="ds"></div>';
    b._p = s.who; HPBARS.push(b);
    drawBar(b, false);
  }
  function drawBar(b, animate) {
    var h = hpFor(b._p);
    if (!h || !h.max) { b.classList.add("nodata"); return; }
    b.classList.remove("nodata");
    var max = h.max, cur = Math.max(0, Math.min(max, h.current)), tmp = Math.max(0, h.temp || 0);
    var pct = cur / max, tpct = Math.min(1 - pct, tmp / max);
    var fill = b.querySelector(".fill"), lag = b.querySelector(".lag"), tm = b.querySelector(".tmp");
    if (!animate) { fill.style.transition = lag.style.transition = "none"; }
    fill.style.width = (pct * 100) + "%";
    tm.style.left = (pct * 100) + "%"; tm.style.width = (tpct * 100) + "%";
    lag.style.width = (pct * 100) + "%";
    if (!animate) { void b.offsetWidth; fill.style.transition = lag.style.transition = ""; }
    b.querySelector(".num").textContent = cur + (tmp ? " +" + tmp : "") + " / " + max;
    b.classList.toggle("low", cur > 0 && pct <= .25);
    b.classList.toggle("down", cur === 0);
    var ds = h.deathSaves || {}, sc = Math.min(3, ds.success || 0), fc = Math.min(3, ds.fail || 0);
    b.querySelector(".ds").innerHTML = cur === 0 && !ds.stable && (sc || fc)
      ? '<span class="s">' + "●".repeat(sc) + "○".repeat(3 - sc) + '</span><span class="f">' + "●".repeat(fc) + "○".repeat(3 - fc) + "</span>" : "";
  }
  function popNumber(b, delta) {
    var p = el("div", "hppop " + (delta < 0 ? "dmg" : "heal"), b);
    p.textContent = (delta > 0 ? "+" : "") + delta;
    setTimeout(function () { p.remove(); }, 1800);
    if (delta < 0) { b.classList.remove("hit"); void b.offsetWidth; b.classList.add("hit"); }
  }
  function hpTick() {
    var c = hpCfg();
    if (!c.url || UNDER || !D) return;
    var ids = (D.party || []).map(ddbId).filter(Boolean);
    var u = c.url.replace(/\/+$/, "") + "/hp?ids=" + ids.join(",") + "&t=" + Date.now();
    fetch(u, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j) return;
      HP = j.chars || {}; MANUAL = j.manual || {}; BATTLE = typeof j.battle === "boolean" ? j.battle : null;
      MAPBARS = typeof j.mapBars === "boolean" ? j.mapBars : null;
      // battle switched or someone gained/lost a bar → rebuild the screen; otherwise just animate the bars
      var sig = hpOn() + "|" + (D.party || []).filter(hpEligible).map(function (p) { return p.id; }).join(",");
      if (sig !== HPSIG) { HPSIG = sig; render(); }
      (D.party || []).forEach(function (p) {
        var h = hpFor(p); if (!h) return;
        var now = (h.current || 0) + (h.temp || 0), prev = HPSHOWN[p.id];
        HPSHOWN[p.id] = now;
        HPBARS.forEach(function (b) {
          if (b._p.id !== p.id || !b.isConnected) return;
          drawBar(b, true);
          if (prev != null && prev !== now) popNumber(b, now - prev);
        });
      });
      HPBARS = HPBARS.filter(function (b) { return b.isConnected; });
      refreshHeartBadges();
    }).catch(function () {});
  }
  function refreshHeartBadges() {
    document.querySelectorAll(".badge.hp[data-pid]").forEach(function (e) {
      var p = (D.party || []).filter(function (x) { return x.id === e.getAttribute("data-pid"); })[0];
      var h = hpOn() && hpFor(p), b = e.querySelector("b");
      b.textContent = h ? Math.max(0, h.current) : stat(p && p.hp);
    });
  }
  /* D&D Beyond is the source of truth: for every character with a sheet link, level / race / class / AC / max HP /
     ability scores come from the sheet (checked once a minute) and override what's typed in data.js. */
  var SHEET = {}, SHEETSIG = "";
  function applySheets() {
    (D && D.party || []).forEach(function (p) {
      var sh = SHEET[ddbId(p)]; if (!sh || sh.error || p.sheetSync === false) return;
      ["level", "race", "cls", "ac", "hp"].forEach(function (k) { if (sh[k] !== "" && sh[k] != null) p[k] = sh[k]; });
      if (sh.stats) p.stats = Object.assign({}, p.stats || {}, sh.stats);
      if (!p.portrait && !p.art && sh.avatar) p.portrait = sh.avatar;
    });
  }
  function sheetTick() {
    var c = hpCfg(); if (!c.url || UNDER || !D) return;
    var ids = (D.party || []).map(ddbId).filter(Boolean); if (!ids.length) return;
    var base = c.url.replace(/\/+$/, "");
    Promise.all(ids.map(function (id) {
      return fetch(base + "/sheet?id=" + id + "&t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { SHEET[id] = j; }).catch(function () {});
    })).then(function () {
      var sig = JSON.stringify(SHEET);
      if (sig !== SHEETSIG) { SHEETSIG = sig; render(); }
    });
  }
  (function sheetLoop() { sheetTick(); setTimeout(sheetLoop, 60000); })();

  (function hpLoop() { hpTick(); setTimeout(hpLoop, Math.max(2, +(hpCfg().seconds || 4)) * 1000); })();

  // When a later window sits on top of an earlier frame (GM cam over the battle map), cut it out of the earlier frame.
  function cutOverlaps(frames, slots) {
    frames.forEach(function (f, i) {
      var a = slots[i], t = S[a.size] ? S[a.size].t : 2, ox = a.x - t, oy = a.y - t, fw = a.w + 2 * t, fh = a.h + 2 * t, r = "";
      slots.forEach(function (b, j) {
        if (j <= i) return;
        var bt = S[b.size] ? S[b.size].t : 2;
        if (b.x - bt < ox + fw && b.x + b.w + bt > ox && b.y - bt < oy + fh && b.y + b.h + bt > oy)
          r += '<rect x="' + (b.x - bt - ox) + '" y="' + (b.y - bt - oy) + '" width="' + (b.w + 2 * bt) + '" height="' + (b.h + 2 * bt) + '" fill="black"/>';
      });
      if (!r) return;
      var P = 120, MW = fw + 2 * P, MH = fh + 2 * P;
      r = r.replace(/x="(-?[\d.]+)" y="(-?[\d.]+)"/g, function (_, x, y) { return 'x="' + (+x + P) + '" y="' + (+y + P) + '"'; });
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + MW + '" height="' + MH + '"><defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="' + MW + '" height="' + MH + '">' +
        '<rect width="' + MW + '" height="' + MH + '" fill="white"/>' + r + '</mask></defs><rect width="' + MW + '" height="' + MH + '" fill="white" mask="url(#m)"/></svg>';
      var url = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
      f.style.webkitMaskImage = f.style.maskImage = url;
      f.style.webkitMaskRepeat = f.style.maskRepeat = "no-repeat";
      f.style.webkitMaskSize = f.style.maskSize = MW + "px " + MH + "px";
      f.style.webkitMaskPosition = f.style.maskPosition = (-P) + "px " + (-P) + "px";
      f.style.webkitMaskClip = f.style.maskClip = "no-clip";
    });
  }

  /* ---------------- SVG bits ---------------- */
  var DIE = {
    tri: { p: "50,8 95,88 5,88", f: "M50 8L50 62M5 88L50 62M95 88L50 62" },
    sq: { p: "14,14 86,14 86,86 14,86", f: "M26 26H74V74H26ZM14 14L26 26M86 14L74 26M86 86L74 74M14 86L26 74" },
    d8: { p: "50,4 96,50 50,96 4,50", f: "M4 50H96M50 4L30 50L50 96L70 50Z" },
    d10: { p: "50,4 95,42 50,96 5,42", f: "M5 42L50 60L95 42M50 60V96M50 4L32 46M50 4L68 46" },
    d12: { p: "50,4 96,38 79,93 21,93 4,38", f: "M50 24L72 40L64 70H36L28 40ZM50 4V24M96 38L72 40M79 93L64 70M21 93L36 70M4 38L28 40" },
    d20: { p: "50,3 93,27 93,73 50,97 7,73 7,27", f: "M50 22L78 68H22ZM50 3V22M93 27L78 68M7 27L22 68M93 73L78 68M7 73L22 68M50 97L22 68M50 97L78 68" }
  };
  var STAT_SHAPES = { str: "tri", dex: "sq", con: "d8", int: "d10", wis: "d12", cha: "d20" };
  var SHARED_DEFS = '<svg width="0" height="0" style="position:absolute"><defs>' +
    '<radialGradient id="dieFill" cx="45%" cy="32%" r="75%"><stop offset="0" stop-color="#bfe6ff"/><stop offset=".25" stop-color="#4fa4ff"/><stop offset=".65" stop-color="#1d50d8"/><stop offset="1" stop-color="#0a1c78"/></radialGradient>' +
    '<linearGradient id="tileFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d2a7a"/><stop offset="1" stop-color="#050d33"/></linearGradient>' +
    '<linearGradient id="shieldFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd8ff"/><stop offset=".45" stop-color="#2f7fe6"/><stop offset="1" stop-color="#103b9a"/></linearGradient>' +
    '<linearGradient id="silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#a9b4c6"/><stop offset="1" stop-color="#eef3fb"/></linearGradient>' +
    '<radialGradient id="heartFill" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#ff9a9a"/><stop offset=".4" stop-color="#ef2b2b"/><stop offset="1" stop-color="#8d0710"/></radialGradient>' +
    '<linearGradient id="teal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0e9f8f"/><stop offset="1" stop-color="#35e6bd"/></linearGradient>' +
    '</defs></svg>';
  function dieSVG(shape) {
    var d = DIE[shape];
    return '<svg viewBox="0 0 100 100"><rect x="1" y="1" width="98" height="98" rx="12" fill="url(#tileFill)" stroke="#2f6cff" stroke-opacity=".55" stroke-width="2"/>' +
      '<polygon points="' + d.p + '" fill="url(#dieFill)" stroke="#d8f1ff" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="' + d.f + '" fill="none" stroke="#e6f6ff" stroke-opacity=".55" stroke-width="1.6"/>' +
      '<polygon points="' + d.p + '" fill="none" stroke="#7cc8ff" stroke-width="1" transform="translate(50 50) scale(.9) translate(-50 -50)" opacity=".5"/></svg>';
  }
  var SHIELD = '<svg viewBox="0 0 100 106"><path d="M50 3L94 16C94 60 77 86 50 103C23 86 6 60 6 16Z" fill="url(#shieldFill)" stroke="url(#silver)" stroke-width="5" stroke-linejoin="round"/><path d="M50 12L85 22C84 58 70 79 50 93Z" fill="#fff" opacity=".14"/></svg>';
  var HEART = '<svg viewBox="0 0 100 100"><path d="M50 92C19 70 4 53 4 32C4 16 16 6 30 6C40 6 46 12 50 20C54 12 60 6 70 6C84 6 96 16 96 32C96 53 81 70 50 92Z" fill="url(#heartFill)" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><ellipse cx="30" cy="27" rx="12" ry="7" fill="#fff" opacity=".35" transform="rotate(-30 30 27)"/></svg>';
  var ICONS = {
    like: { bg: "radial-gradient(circle at 50% 35%, #5aa9ff, #1565d8 70%)", svg: '<svg viewBox="0 0 100 100" fill="#fff"><path d="M12 44h15v42H12zM33 86V45l17-29c4-7 14-3 12 5l-4 20h23c7 0 11 6 9 12l-9 26c-1 4-5 7-10 7z"/></svg>' },
    comment: { bg: "linear-gradient(135deg,#0e9f8f,#35e6bd)", svg: '<svg viewBox="0 0 100 100" fill="#fff"><path d="M22 16h56a12 12 0 0 1 12 12v34a12 12 0 0 1-12 12H48L28 90V74h-6a12 12 0 0 1-12-12V28a12 12 0 0 1 12-12z"/></svg>' },
    heart: { bg: "radial-gradient(circle at 50% 35%, #ff6b85, #ee2a52 70%)", svg: '<svg viewBox="0 0 100 100" fill="#fff"><path d="M50 88C20 66 8 51 8 33C8 19 19 10 31 10C40 10 46 15 50 22C54 15 60 10 69 10C81 10 92 19 92 33C92 51 80 66 50 88Z"/></svg>' },
    bell: { bg: "radial-gradient(circle at 50% 35%, #ffd27a, #e0901f 70%)", svg: '<svg viewBox="0 0 100 100" fill="#fff"><path d="M50 8c-4 0-7 3-7 7v2C31 20 23 31 23 45v16l-9 11v5h72v-5l-9-11V45c0-14-8-25-20-28v-2c0-4-3-7-7-7zM39 82a11 11 0 0 0 22 0z"/></svg>' }
  };
  function iconHTML(icon) {
    if (icon === "emblem") return '<div class="cta-icon emblem"><i></i></div>';
    if (ICONS[icon]) return '<div class="cta-icon" style="background:' + ICONS[icon].bg + '">' + ICONS[icon].svg + "</div>";
    return '<div class="cta-icon img" style="background-image:url(\'' + esc(icon) + '\')"></div>';
  }

  /* ---------------- ticker ----------------
     Matches the original: the whole card (icon box + bar) whips off to the right with motion blur,
     and the next card whips in from the left. Character cards hold ~36s, messages ~40s.        */
  var tk = { idx: +(q.get("tick") || 0), timer: null, gleamTimer: null, root: null, unit: null, n: 0 };
  function tickerItems() {
    var t = D.ticker || {}, msgs = (t.messages || []).slice(), ppl = (D.party || []).filter(function (p) { return p.ticker; });
    var out = [], i, r;
    if (tk.only) { var who = (D.party || []).filter(function (p) { return p.id === tk.only; })[0]; return who ? [{ p: who }] : []; }
    if (!t.pattern || t.pattern === "mix") {
      // default: a message, then `charactersBetween` character cards, then the next message… starting on a message
      var every = Math.max(1, +(t.charactersBetween || 2)), mi = 0, pi = 0, guard = 0;
      if (!ppl.length) return msgs.map(function (m) { return { m: m }; });
      if (!msgs.length) return ppl.map(function (p) { return { p: p }; });
      do {
        out.push({ m: msgs[mi % msgs.length] }); mi++;
        for (i = 0; i < every; i++) { out.push({ p: ppl[pi % ppl.length] }); pi++; }
      } while ((mi % msgs.length || pi % ppl.length) && ++guard < 200);
      return out;
    }
    if (t.pattern === "alternate") {
      var n = Math.max(msgs.length, ppl.length);
      for (i = 0; i < n; i++) { if (msgs.length) out.push({ m: msgs[i % msgs.length] }); if (ppl.length) out.push({ p: ppl[i % ppl.length] }); }
    } else if (t.pattern === "messages-then-party") {
      msgs.forEach(function (m) { out.push({ m: m }); }); ppl.forEach(function (p) { out.push({ p: p }); });
    } else { // "party-then-messages" (default, like the original): every character, then a couple of messages
      var per = Math.max(1, +(t.messagesBetween || 2)), rounds = msgs.length ? msgs.length : 1;
      for (r = 0; r < rounds; r++) {
        ppl.forEach(function (p) { out.push({ p: p }); });
        for (i = 0; i < per && msgs.length; i++) out.push({ m: msgs[(r * per + i) % msgs.length] });
      }
    }
    return out;
  }
  function stat(v) { return v == null || v === "" ? "–" : v; }
  function buildUnit(it) {
    var id = "mb" + (tk.n++ % 4);
    var u = el("div", "unit");
    u.innerHTML = '<svg width="0" height="0" style="position:absolute"><filter id="' + id + '" x="-60%" y="-10%" width="220%" height="120%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 0"/></filter></svg>';
    u._blur = u.querySelector("feGaussianBlur"); u._fid = id;
    var box = el("div", "box", u), face = el("div", "face", box);
    corners(box, .13, ["tl", "br"]);
    var bar = el("div", "bar", u), inner = el("div", "slide", bar); u._gleam = el("div", "gleam", bar);
    if (it.m) {
      face.innerHTML = iconHTML(it.m.icon || "emblem");
      inner.innerHTML = '<div class="cta-text">' + esc(it.m.text) + "</div>";
    } else {
      var p = it.p, st = p.stats || {};
      var cardVid = p.cardVideo === false ? "" : (p.cardVideo || p.video || "");
      if (cardVid) {
        face.innerHTML = '<div class="portrait vid intro"><video src="' + esc(cardVid) + '" muted autoplay loop playsinline' +
          (p.art ? ' poster="' + esc(p.art) + '"' : '') + '></video><i class="sweep"></i></div>';
        var pv = face.querySelector(".portrait");
        // open wide on the waist-up shot, then push in to head and shoulders once the card has landed
        setTimeout(function () { pv.classList.remove("intro"); }, 900);
      }
      else face.innerHTML = '<div class="portrait" style="background-image:url(\'' + esc(p.portrait || p.art || "") + '\')"></div>';
      var sub = "Level " + esc(p.level) + " " + esc([p.race, p.cls].filter(Boolean).join(" "));
      var dice = ["str", "dex", "con", "int", "wis", "cha"].map(function (k) {
        var sh = STAT_SHAPES[k];
        return '<div class="die"><div class="g ' + sh + '">' + dieSVG(sh) + "<b>" + esc(stat(st[k])) + '</b></div><div class="lb">' + k.toUpperCase() + "</div></div>";
      }).join("");
      inner.innerHTML = '<div class="char" style="display:flex;align-items:center;width:100%"><div class="who"><div class="nm">' + esc(p.fullName || p.name) +
        '</div><div class="sub">' + sub + '</div></div><div class="dice">' + dice + "</div></div>";
      var b = el("div", "badges", box);
      b.innerHTML = '<div class="badge ac">' + SHIELD + "<b>" + esc(stat(p.ac)) + '</b></div><div class="badge hp" data-pid="' + esc(p.id) + '">' + HEART + "<b>" + esc(stat(p.hp)) + "</b></div>";
      setTimeout(refreshHeartBadges, 0);
    }
    return u;
  }
  function fitText(u) {
    var txt = u.querySelector(".cta-text");
    if (txt) { var size = parseFloat(getComputedStyle(txt).fontSize) || 27; while (txt.scrollWidth > 790 && size > 16) { size -= 1; txt.style.fontSize = size + "px"; } }
    var nm = u.querySelector(".nm");
    if (nm) { var s2 = 34; while (nm.scrollWidth > 330 && s2 > 20) { s2 -= 1; nm.style.fontSize = s2 + "px"; } }
  }
  // dir: +1 = leaving to the right, -1 = arriving from the left
  function whip(u, out, dur, done) {
    var D0 = 1500, t0 = null;
    u.style.filter = "url(#" + u._fid + ")";
    function ease(t) { return out ? t * t * t : 1 - Math.pow(1 - t, 3); }
    function vel(t) { return out ? 3 * t * t : 3 * Math.pow(1 - t, 2); }
    function step(ts) {
      if (t0 == null) t0 = ts;
      var t = Math.min(1, (ts - t0) / dur), e = ease(t);
      var x = out ? e * D0 : (e - 1) * D0;
      u.style.transform = "translateX(" + x.toFixed(1) + "px)";
      u.style.opacity = out ? (1 - Math.max(0, (t - .55) / .45)).toFixed(3) : Math.min(1, t / .35).toFixed(3);
      u._blur.setAttribute("stdDeviation", Math.min(46, vel(t) * 26).toFixed(1) + " 0");
      if (t < 1) requestAnimationFrame(step);
      else { u.style.filter = "none"; u._blur.setAttribute("stdDeviation", "0 0"); done && done(); }
    }
    requestAnimationFrame(step);
  }
  function gleam(u) { if (!u || !u._gleam) return; u._gleam.classList.remove("go"); void u._gleam.offsetWidth; u._gleam.classList.add("go"); }
  function buildTicker(parent) {
    var r = el("div", "", parent); r.id = "ticker"; tk.root = r; tk.unit = null;
    showTicker(true);
  }
  function showTicker(first) {
    var items = tickerItems(); if (!items.length || !tk.root) return;
    var it = items[tk.idx % items.length], t = D.ticker || {};
    var u = buildUnit(it); tk.root.appendChild(u); fitText(u);
    var old = tk.unit; tk.unit = u;
    if (first || !old) { u.style.opacity = 1; if (old) old.remove(); }
    else {
      u.style.opacity = 0;
      whip(old, true, 750, function () { old.remove(); });
      setTimeout(function () { whip(u, false, 800, function () { gleam(u); }); }, 420);
    }
    clearTimeout(tk.timer); clearInterval(tk.gleamTimer);
    tk.gleamTimer = setInterval(function () { gleam(tk.unit); }, 12000);
    var secs = it.m ? +(t.messageSeconds || t.seconds || 40) : +(t.seconds || 36);
    if (items.length > 1) tk.timer = setTimeout(function () { tk.idx++; showTicker(false); }, Math.max(4, secs) * 1000);
  }
  // when data changes, refresh the card on screen in place (e.g. a level-up shows immediately)
  function refreshTickerInPlace() {
    if (!tk.root || !tk.unit) return;
    var items = tickerItems(); if (!items.length) return;
    var u = buildUnit(items[tk.idx % items.length]);
    tk.root.replaceChild(u, tk.unit); tk.unit = u; u.style.opacity = 1; fitText(u);
  }

  /* ---------------- break screen: a collage of campaign art; one photo at a time is plucked out,
     floats up front, then settles back into the collage — forever. ---------------- */
  var brk = { timers: [] };
  function brkClear() { brk.timers.forEach(clearTimeout); brk.timers = []; }
  function later(fn, ms) { brk.timers.push(setTimeout(fn, ms)); }
  function seeded(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  // collage pool: the Discord export (break-images.js) plus any extra images listed in data.js
  function breakPool() {
    var B = D.breakScreen || {}, pool = [];
    if (B.useDiscordArt !== false && window.REDITUS_BREAK) pool = window.REDITUS_BREAK.slice();
    (B.images || []).forEach(function (x) { pool.push(typeof x === "string" ? { src: x, title: "", sub: "" } : x); });
    if (!pool.length) pool = (D.party || []).map(function (p) { return { src: p.portrait, title: p.fullName || p.name, sub: "" }; });
    return pool.filter(function (x) { return x && x.src; });
  }
  function loadBreakList(cb) {
    if (window.REDITUS_BREAK) return cb();
    var sc = document.createElement("script"); sc.src = "break-images.js?t=" + Date.now();
    sc.onload = sc.onerror = function () { sc.remove(); cb(); };
    document.head.appendChild(sc);
  }
  function buildBreak(parent) {
    brkClear();
    var B = D.breakScreen || {};
    if (B.background) { var bgi = el("div", "brk-bg", parent); bgi.style.backgroundImage = "url('" + B.background + "')"; }
    var scene3d = el("div", "brk-scene", parent);
    var ban = el("div", "brk-banner", parent);
    ban.innerHTML = '<svg viewBox="0 0 760 110" preserveAspectRatio="none"><defs>' +
      '<linearGradient id="bgold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c2"/><stop offset=".35" stop-color="#e9c46f"/><stop offset=".55" stop-color="#b8862f"/><stop offset="1" stop-color="#f3d78c"/></linearGradient>' +
      '<linearGradient id="bwing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff3c8"/><stop offset=".5" stop-color="#c9952f"/><stop offset="1" stop-color="#6e4a12"/></linearGradient></defs>' +
      '<polygon points="0,55 70,18 92,40 92,70 70,92" fill="url(#bwing)" stroke="#4a3208" stroke-width="2"/>' +
      '<polygon points="760,55 690,18 668,40 668,70 690,92" fill="url(#bwing)" stroke="#4a3208" stroke-width="2"/>' +
      '<polygon points="40,55 82,30 82,80" fill="#fff6d6" opacity=".55"/><polygon points="720,55 678,30 678,80" fill="#fff6d6" opacity=".55"/>' +
      '<rect x="88" y="28" width="584" height="54" fill="url(#bgold)" stroke="#4a3208" stroke-width="2"/>' +
      '<rect x="94" y="33" width="572" height="44" fill="none" stroke="#fff4cf" stroke-opacity=".6" stroke-width="1.5"/></svg>' +
      '<span>' + esc(B.text || "..On a short break") + "</span>";

    var P = 1600, pan = { x: 0, y: 0 }, world = null, dimmer = null;
    var SIZE = Math.max(8, +(B.collageSize || 18)), PER_SET = Math.max(2, +(B.plucksPerSet || 6));
    var CX = 1190, CY = 455, MAXW = 1000, MAXH = 690;
    // slow "camera" drift across the floating collage
    (function drift() {
      var t0 = performance.now();
      function f(ts) {
        if (!scene3d.isConnected) return;
        var t = (ts - t0) / 1000;
        pan.x = Math.sin(t / 47 * 6.283) * 110 + Math.sin(t / 19 * 6.283) * 14;
        pan.y = Math.sin(t / 39 * 6.283) * 45;
        var ry = Math.sin(t / 61 * 6.283) * 5, rx = Math.sin(t / 43 * 6.283) * 2.5;
        if (world) world.style.transform = "translate3d(" + pan.x.toFixed(1) + "px," + pan.y.toFixed(1) + "px,0) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
        requestAnimationFrame(f);
      }
      requestAnimationFrame(f);
    })();

    // a shuffled deck over the whole pool, so every image comes round before any repeats
    var deck = [];
    function draw(n, pool) {
      var out = [];
      while (out.length < Math.min(n, pool.length)) {
        if (!deck.length) { deck = pool.map(function (_, i) { return i; }); for (var i = deck.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = deck[i]; deck[i] = deck[j]; deck[j] = t; } }
        var k = deck.shift(); if (out.indexOf(pool[k]) < 0) out.push(pool[k]);
      }
      return out;
    }
    function preload(items, cb) {
      var left = items.length;
      items.forEach(function (it) {
        if (it.w && it.h) { it._a = it.w / it.h; if (!--left) cb(); return; }
        var im = new Image();
        im.onload = function () { it._a = im.naturalWidth / im.naturalHeight; if (!--left) cb(); };
        im.onerror = function () { it._a = 4 / 3; if (!--left) cb(); };
        im.src = it.src;
      });
      // warm the browser cache for the actual pixels
      items.forEach(function (it) { var im = new Image(); im.src = it.src; });
    }

    function newSet() {
      if (!scene3d.isConnected) return;
      var pool = breakPool(); if (!pool.length) return;
      var items = draw(SIZE, pool);
      var list = items.slice(); while (list.length < 12) list = list.concat(items);
      preload(items, function () {
        var old = world;
        world = el("div", "brk-world", scene3d); world.style.opacity = 0;
        dimmer = el("div", "brk-dim", world);
        var tiles = lay(list);
        requestAnimationFrame(function () { world.style.opacity = 1; });
        if (old) { old.style.opacity = 0; later(function () { old.remove(); }, 2200); }
        later(function () { cycle(tiles); }, old ? 2400 : 1500);
      });
    }

    function lay(list) {
      var n = list.length, R = seeded(7 + n + Math.floor(Math.random() * 1000));
      var cols = Math.ceil(Math.sqrt(n * 16 / 9)), rows = Math.ceil(n / cols);
      var cw = (W + 360) / cols, ch = (H + 220) / rows, tiles = [];
      list.forEach(function (it, i) {
        var c = i % cols, r = Math.floor(i / cols);
        var inRow = Math.min(cols, n - r * cols), off = (cols - inRow) * cw / 2;
        var a = Math.max(.45, Math.min(2.2, it._a || 4 / 3));
        var area = cw * ch * (.95 + R() * .25);
        var h = Math.sqrt(area / a), w = h * a;
        // where it should APPEAR on screen, then pushed to a depth with position/scale corrected for perspective
        var sx = -180 + off + c * cw + cw / 2 + (R() - .5) * cw * .3 + (r % 2 ? cw * .18 : 0);
        var sy = -110 + r * ch + ch / 2 + (R() - .5) * ch * .3;
        var z = -560 + R() * 640, depth = (P - z) / P, k = .82 + R() * .3;
        var wx = W / 2 + (sx - W / 2) * depth, wy = H / 2 + (sy - H / 2) * depth;
        var rot = (R() - .5) * 16, rxx = (R() - .5) * 14, ryy = (R() - .5) * 22;
        var t = el("div", "brk-tile", world);
        t.style.width = px(w); t.style.height = px(h);
        var f = el("div", "brk-float", t), ph = el("div", "brk-photo", f);
        ph.style.backgroundImage = "url('" + it.src + "')";
        f.style.animationDuration = (9 + R() * 8).toFixed(1) + "s"; f.style.animationDelay = (-R() * 12).toFixed(1) + "s";
        t._home = "translate3d(" + (wx - w / 2).toFixed(1) + "px," + (wy - h / 2).toFixed(1) + "px," + z.toFixed(0) + "px) rotateX(" + rxx.toFixed(1) + "deg) rotateY(" + ryy.toFixed(1) + "deg) rotateZ(" + rot.toFixed(1) + "deg) scale(" + (k * depth).toFixed(3) + ")";
        t._w = w; t._h = h; t._it = it;
        t.style.transform = t._home;
        if (tiles.every(function (x) { return x._it !== it; })) tiles.push(t);   // duplicates fill space but aren't plucked twice
      });
      return tiles;
    }

    // the nameplate rides along inside the lifted photo (so it follows every drift), counter-scaled to stay a fixed size on screen
    function showPlate(t, s) {
      var it = t._it; if (!it.title) return null;
      var plate = el("div", "brk-plate", t.querySelector(".brk-float"));
      plate.innerHTML = '<div class="pt gold-text"></div><div class="ps"></div>';
      plate.querySelector(".pt").textContent = it.title;
      var ps = plate.querySelector(".ps"); if (it.sub) ps.textContent = it.sub; else ps.remove();
      corners(plate, .09, ["tl", "br"]);
      plate.style.setProperty("--inv", (1 / s).toFixed(4));
      var pt = plate.querySelector(".pt"), sz = 46;
      while (pt.scrollWidth > 700 && sz > 24) { sz -= 2; pt.style.fontSize = sz + "px"; }
      void plate.offsetWidth; plate.classList.add("on");
      return plate;
    }

    function cycle(tiles) {
      var order = tiles.map(function (_, i) { return i; }).sort(function () { return Math.random() - .5; });
      var hold = Math.max(3, +(B.seconds || 7)) * 1000, MOVE = 1600, ZN = 420, count = 0;
      function pluck() {
        if (!scene3d.isConnected) return;
        if (count >= Math.min(PER_SET, tiles.length) || !order.length) { newSet(); return; }
        count++;
        var t = tiles[order.shift()];
        var fitS = Math.min(MAXW / t._w, MAXH / t._h), depth = (P - ZN) / P, s = fitS * depth;
        var cx = CX - pan.x, cy = CY - pan.y, rot = (Math.random() - .5) * 5;
        t.classList.add("lifted");
        t.style.transform = "translate3d(" + (cx - t._w / 2).toFixed(1) + "px," + (cy - t._h / 2).toFixed(1) + "px," + ZN + "px) rotateX(0deg) rotateY(" + ((Math.random() - .5) * 8).toFixed(1) + "deg) rotateZ(" + rot.toFixed(1) + "deg) scale(" + s.toFixed(3) + ")";
        dimmer.classList.add("on");
        var plate = null, scr = s * P / (P - ZN);   // scale as it appears on screen
        later(function () { plate = showPlate(t, scr); }, MOVE * .7);
        later(function () {
          if (plate) { var pl = plate; pl.classList.remove("on"); later(function () { pl.remove(); }, 800); }
          t.style.transform = t._home;
          dimmer.classList.remove("on");
          later(function () { t.classList.remove("lifted"); }, MOVE);
          later(pluck, MOVE + 900);
        }, MOVE + hold);
      }
      pluck();
    }

    loadBreakList(newSet);
  }

  /* ---------------- render ---------------- */
  var content;
  var UVIDS = {};
  function renderUnder(L) {
    var root = document.getElementById("under") || el("div", "", stage); root.id = "under";
    var keep = {};
    L.slots.forEach(function (s) {
      if (s.map || !s.who || s.who.underHidden) return;
      var src = s.who.video, still = s.who.art || s.who.portrait;
      if (!src && !still) return;
      var key = s.id + "|" + (src || still); keep[key] = 1;
      var n = UVIDS[key];
      if (!n) {
        if (src) {
          n = document.createElement("video"); n.muted = true; n.loop = true; n.autoplay = true; n.playsInline = true;
          n.setAttribute("muted", ""); n.setAttribute("playsinline", ""); n.preload = "auto"; n.src = src; if (still) n.poster = still;
        } else { n = document.createElement("div"); n.style.backgroundImage = "url('" + still + "')"; n.style.backgroundSize = "cover"; n.style.backgroundPosition = "center 30%"; n._still = 1; }
        n.className = "under-slot" + (n._still ? " still" : ""); UVIDS[key] = n;
      }
      root.appendChild(n);
      // bleed 6px past the window so no gap shows at the frame edge
      place(n, s.x - 6, s.y - 6, s.w + 12, s.h + 12);
      if (n.play) { var pr = n.play(); if (pr && pr.catch) pr.catch(function () {}); }
    });
    Object.keys(UVIDS).forEach(function (k) { if (!keep[k]) { UVIDS[k].remove(); delete UVIDS[k]; } });
    if (GUIDES) {
      Array.prototype.slice.call(root.querySelectorAll(".guide,.guide-banner")).forEach(function (g) { g.remove(); });
      var gb = el("div", "guide-banner", root); gb.textContent = "BOTTOM LAYER (character loops) · scene: " + SCENE;
      L.slots.forEach(function (s) { var g = el("div", "guide" + (s.w < 300 ? " small" : ""), root); place(g, s.x, s.y, s.w, s.h);
        g.innerHTML = '<div class="t">' + esc(s.id === "gm" ? "GM" : s.label).toUpperCase() + '</div><div class="c">X ' + Math.round(s.x) + "  Y " + Math.round(s.y) + "<br>" + Math.round(s.w) + " × " + Math.round(s.h) + "</div>"; });
    }
    document.documentElement.setAttribute("data-ready", "1");
  }

  function render() {
    if (BUILD == null) BUILD = D.build;
    applySheets();
    var L = layout();
    if (UNDER) { renderUnder(L); return; }
    if (!bg) { buildBackground(L.lines); stage.insertAdjacentHTML("beforeend", SHARED_DEFS); }
    setHoles(L.holes ? L.slots : []);

    if (PREVIEW) {
      var fk = document.getElementById("fakecams") || el("div", "", null);
      fk.id = "fakecams"; fk.innerHTML = ""; stage.insertBefore(fk, bg);
      L.slots.forEach(function (s) {
        var c = el("div", "fakecam" + (s.map ? " map" : ""), fk); place(c, s.x, s.y, s.w, s.h);
        if (!s.map) c.style.backgroundImage = "url('" + ((s.who && (s.who.portrait || s.who.art)) || "assets/logos/dd-emblem.png") + "')";
        if (s.id === "gm") { c.style.background = "linear-gradient(160deg,#2a3242,#0e1218)"; }
      });
    }

    if (content) content.remove();
    content = el("div", "", stage); content.id = "content"; HPBARS = [];
    var frames = L.slots.map(function (s, i) { return frame(content, s, i); });
    cutOverlaps(frames, L.slots);

    if (L.logos) {
      var lr = el("div", "logo reditus float", content); place(lr, 168, 876, 300, 158);
      var ld = el("div", "logo dd float", content); place(ld, 1700, 900, 175, 122); ld.style.animationDelay = "-3s";
    }
    if (L.intro) {
      el("div", "intro-logo", content);
      var ep = el("div", "intro-ep", content); ep.textContent = "EPISODE " + ((D.show && D.show.episode) || "");
      var ld2 = el("div", "logo dd float", content); place(ld2, 1700, 905, 175, 122);
      if (D.show && D.show.introText) { var sub = el("div", "intro-sub gold-text", content); sub.textContent = D.show.introText; }
    }

    if (L.brk) buildBreak(content);

    // ticker persists between data updates so it doesn't restart
    tk.only = L.tickerOnly || null;
    if (L.ticker) {
      if (!tk.root) buildTicker(stage); else refreshTickerInPlace();
      stage.insertBefore(tk.root, content); // logos sit on top of the bar as it whips past, like the original
    } else if (tk.root) { tk.root.remove(); tk.root = null; clearTimeout(tk.timer); }

    if (GUIDES) {
      var gb = el("div", "guide-banner", content);
      gb.textContent = "SETUP GUIDES ON  ·  scene: " + SCENE + "  ·  remove ?guides=1 when your cameras are lined up";
      L.slots.forEach(function (s) {
        var g = el("div", "guide" + (s.w < 300 ? " small" : ""), content); place(g, s.x, s.y, s.w, s.h);
        g.innerHTML = '<div class="t">' + esc(s.id === "gm" ? "GM" : s.label).toUpperCase() + '</div><div class="c">X ' + Math.round(s.x) + "  Y " + Math.round(s.y) +
          "<br>" + Math.round(s.w) + " × " + Math.round(s.h) + "</div>";
      });
    }
    document.documentElement.setAttribute("data-ready", "1");
  }

  /* ---------------- font check: Thailandesa renders its own small-caps style; the fallback looks closer in capitals ---------------- */
  function fontCheck() {
    if (!document.fonts || !document.fonts.load) return;
    document.fonts.load('20px "Thailandesa"').then(function (f) { if (!f || !f.length) stage.classList.add("no-thai"); else stage.classList.remove("no-thai"); }).catch(function () { stage.classList.add("no-thai"); });
  }
  fontCheck();

  // the preview page can ask for the next card ("Next card" button)
  addEventListener("message", function (e) {
    if (e.data === "reditus:next" && tk.root) { clearTimeout(tk.timer); tk.idx++; showTicker(false); }
    // live preview from the control panel (unsaved changes)
    if (e.data && e.data.type === "reditus:data" && e.data.data) {
      LOCAL_PREVIEW = true; D = e.data.data; lastSig = JSON.stringify(D);
      if (BUILD == null) BUILD = D.build;
      render();
    }
  });

  /* ---------------- go ---------------- */
  loadData(function (d) { if (!d) return; D = d; lastSig = JSON.stringify(d); render(); hpTick(); sheetTick(); setInterval(poll, POLL_MS); });
})();
