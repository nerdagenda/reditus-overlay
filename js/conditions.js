/* The Reditus Campaign — condition markers + frame effects.
   Rule: effects only ADD on top (recolour/warp the solid gold frame, draw over the window edges, add icons).
   Nothing fades, moves or goes see-through, so the oversized camera feed underneath is never revealed.
   Used by overlay.js:  ReditusConditions.apply(frameEl, slot, borderPx, ["poisoned", {id:"exhaustion", level:3}, …]) */
(function () {
  "use strict";
  var SVGNS = "http://www.w3.org/2000/svg";
  // order = priority: only the highest frame effect plays; every marker shows
  var C = [
    { id: "banished",      name: "Banished",      col: "#c39bff", icon: '<circle cx="12" cy="12" r="8.5"/><path d="M12 5.5a6.5 6.5 0 0 1 0 13a4.3 4.3 0 0 1 0-8.6a2.2 2.2 0 0 1 0 4.4"/>' },
    { id: "petrified",     name: "Petrified",     col: "#d0d0d0", icon: '<path d="M3 19l5-9 3 4 3-6 7 11z"/><path d="M8 10l2.2 3.2M14 8l1 3"/>' },
    { id: "paralyzed",     name: "Paralyzed",     col: "#9fdcff", icon: '<circle cx="12" cy="12" r="9"/><path d="M13 5l-5 8h4l-1 6 5-8h-4z"/>' },
    { id: "stunned",       name: "Stunned",       col: "#ffe066", icon: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>' },
    { id: "frightened",    name: "Frightened",    col: "#b48cff", icon: '<path d="M6 20V10a6 6 0 0 1 12 0v10l-2-2-2 2-2-2-2 2-2-2z"/><circle cx="10" cy="10" r=".9"/><circle cx="14" cy="10" r=".9"/><path d="M10 14.5q2-1.6 4 0"/>' },
    { id: "restrained",    name: "Restrained",    col: "#d6d6e4", icon: '<rect x="2.5" y="9" width="10" height="6" rx="3"/><rect x="11.5" y="9" width="10" height="6" rx="3"/>' },
    { id: "grappled",      name: "Grappled",      col: "#86d45c", icon: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V5.5a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-3-4a1.5 1.5 0 0 1 2.5-1.7L8 13"/>' },
    { id: "charmed",       name: "Charmed",       col: "#ff8cc6", icon: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>' },
    { id: "blinded",       name: "Blinded",       col: "#e8e8e8", icon: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>' },
    { id: "invisible",     name: "Invisible",     col: "#c8f2ff", icon: '<circle cx="12" cy="7.5" r="3.2" stroke-dasharray="2.2 1.8"/><path d="M5 20.5a7 7 0 0 1 14 0" stroke-dasharray="2.2 1.8"/>' },
    { id: "raging",        name: "Raging",        col: "#ff6a2a", icon: '<path d="M12 2.5c1 4 6.5 6 6.5 11.5a6.5 6.5 0 0 1-13 0c0-3 2-4.5 2-7.5 2 1 3 3 3 5.2 1-2.2 1.5-6.2 1.5-9.2z"/>' },
    { id: "poisoned",      name: "Poisoned",      col: "#8de05a", icon: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.2 15h9.6"/>' },
    { id: "exhaustion",    name: "Exhaustion",    col: "#e0aa6a", icon: '<path d="M6.5 3h11M6.5 21h11M8 3c0 5.5 8 6 8 9s-8 3.5-8 9M16 3c0 5.5-8 6-8 9s8 3.5 8 9"/>' },
    { id: "concentrating", name: "Concentrating", col: "#8cc4ff", icon: '<path d="M12 3l9 9-9 9-9-9z"/><circle cx="12" cy="12" r="2.6"/>' },
    { id: "incapacitated", name: "Incapacitated", col: "#ff8a80", icon: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>' },
    { id: "prone",         name: "Prone",         col: "#f0c890", icon: '<circle cx="5" cy="13" r="2.2"/><path d="M8.5 14.5h12M10.5 14.5v4.5M17.5 14.5v4.5"/>' },
    { id: "deafened",      name: "Deafened",      col: "#e8e8e8", icon: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6"/>' },
    { id: "unconscious",   name: "Unconscious",   col: "#a9b8ff", icon: '<path d="M4 7h6.5L4 14h6.5M13 11.5h6L13 18h6"/>' },
  ];
  var BY = {}; C.forEach(function (c, i) { c.rank = i; BY[c.id] = c; });
  var FX = { banished: 1, petrified: 1, paralyzed: 1, stunned: 1, frightened: 1, restrained: 1, grappled: 1, charmed: 1, blinded: 1, invisible: 1, raging: 1, poisoned: 1, exhaustion: 1 };
  // D&D Beyond condition ids → ours
  var DDB = { 1: "blinded", 2: "charmed", 3: "deafened", 4: "exhaustion", 5: "frightened", 6: "grappled", 7: "incapacitated", 8: "invisible", 9: "paralyzed", 10: "petrified", 11: "poisoned", 12: "prone", 13: "restrained", 14: "stunned", 15: "unconscious" };

  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function svg(w, h, inner, cls) { return '<svg class="' + (cls || "") + '" xmlns="' + SVGNS + '" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" preserveAspectRatio="none">' + inner + "</svg>"; }

  // shared SVG filters (animated turbulence = warps, haze, sparks, fire, smoke)
  function defs() {
    if (document.getElementById("cx-defs")) return;
    var turb = function (id, bf, values, dur, oct, scale) {
      return '<filter id="' + id + '" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="' + bf + '" numOctaves="' + oct + '" seed="3" result="n">' +
        '<animate attributeName="baseFrequency" values="' + values + '" dur="' + dur + '" repeatCount="indefinite"/></feTurbulence>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="' + scale + '" xChannelSelector="R" yChannelSelector="G"/></filter>';
    };
    var d = document.createElement("div");
    d.innerHTML = '<svg id="cx-defs" width="0" height="0" style="position:absolute"><defs>' +
      turb("cx-phase", "0.015 0.06", "0.015 0.06;0.03 0.035;0.015 0.06", "5s", 2, 10) +
      turb("cx-haze", "0.01 0.18", "0.01 0.18;0.016 0.12;0.01 0.18", "3s", 1, 6) +
      turb("cx-zap", "0.9", "0.7;1.2;0.85;1.05", "0.35s", 1, 7) +
      turb("cx-fire", "0.06 0.2", "0.06 0.2;0.08 0.26;0.06 0.2", "0.9s", 2, 9) +
      turb("cx-smoke", "0.025", "0.025;0.04;0.025", "7s", 3, 34) +
      "</defs></svg>";
    document.body.appendChild(d.firstChild);
  }

  function iconSVG(c) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + c.icon + "</svg>"; }
  function markerHTML(list, big) {
    return list.map(function (x) {
      var c = BY[x.id]; if (!c) return "";
      var pips = x.id === "exhaustion" && x.level ? '<i class="pips">' + new Array(Math.min(6, x.level) + 1).join("<b></b>") + "</i>" : "";
      return '<span class="cmark c-' + c.id + '" style="--cc:' + c.col + '" title="' + c.name + '">' + iconSVG(c) + pips + "</span>";
    }).join("");
  }

  function norm(list) {
    var out = [], seen = {};
    (list || []).forEach(function (x) {
      if (typeof x === "string") x = { id: x };
      if (!x || !BY[x.id] || seen[x.id]) return;
      seen[x.id] = 1; out.push(x);
    });
    return out.sort(function (a, b) { return BY[a.id].rank - BY[b.id].rank; });
  }

  /* ---------- the effects ---------- */
  // Several effects "pull away and re-apply" on a long cycle (CYCLE seconds) so they keep feeling alive without strobing.
  var CYCLE = 22;
  var build = {
    banished: function (f, z, w, h) {
      f.classList.add("cf-banished");
      for (var i = 0; i < 3; i++) { var g = el("div", "cghost", f); g.style.animationDelay = (-i * 1.1) + "s"; }
      for (var j = 0; j < 7; j++) { var m = el("i", "cmist", z); m.style.left = rnd(-10, 90) + "%"; m.style.top = (j % 2 ? rnd(70, 95) : rnd(-15, 10)) + "%"; m.style.animationDelay = rnd(-9, 0) + "s"; m.style.animationDuration = rnd(7, 11) + "s"; }
      el("div", "cedgeglow", z);
    },
    poisoned: function (f, z, w, h) {
      f.classList.add("cf-poisoned"); el("div", "cedgeglow", z);
      var n = Math.max(6, Math.round(w / 45));
      for (var i = 0; i < n; i++) { var b = el("i", "cbubble", z); var s = rnd(5, 14); b.style.width = b.style.height = s + "px"; b.style.left = rnd(2, 96) + "%"; b.style.animationDuration = rnd(3.5, 7) + "s"; b.style.animationDelay = rnd(-7, 0) + "s"; }
      // one or two big bubbles now and then, rising and popping
      var k = Math.min(w, h);
      for (var j = 0; j < 2; j++) {
        var B = el("i", "cbigbub", z), S = k * rnd(.16, .22);
        B.style.width = B.style.height = S + "px"; B.style.left = rnd(15, 75) + "%";
        B.style.setProperty("--rise", (h * rnd(.45, .7)) + "px");
        B.style.animationDelay = (j * 6.5 + rnd(0, 2)) + "s";
      }
    },
    frightened: function (f, z, w, h) {
      f.classList.add("cf-frightened");
      ["tl", "tr", "bl", "br"].forEach(function (k, i) { var t = el("i", "ctendril " + k, z); t.style.animationDelay = (-i * 1.7) + "s"; });
    },
    charmed: function (f, z, w, h) {
      f.classList.add("cf-charmed"); el("div", "cedgeglow", z);
      var heart = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21s-8-4.9-8-10.8A4.5 4.5 0 0 1 12 7.4a4.5 4.5 0 0 1 8 2.8C20 16.1 12 21 12 21z"/></svg>';
      for (var i = 0; i < 7; i++) {
        var hh = el("i", "cheart", z); hh.innerHTML = heart;
        var s = rnd(12, 24); hh.style.width = hh.style.height = s + "px"; hh.style.left = (i % 2 ? rnd(84, 95) : rnd(2, 12)) + "%";
        hh.style.animationDuration = rnd(4.5, 7.5) + "s"; hh.style.animationDelay = rnd(-7, 0) + "s";
      }
      // hearts that pop up in the open now and then, then fade
      var k = Math.min(w, h);
      for (var j = 0; j < 3; j++) {
        var P = el("i", "cheartpop", z); P.innerHTML = heart; var S = k * rnd(.13, .2);
        P.style.width = P.style.height = S + "px"; P.style.left = rnd(12, 80) + "%"; P.style.top = rnd(15, 60) + "%";
        P.style.animationDelay = (j * 3.2 + rnd(0, 1.5)) + "s";
      }
    },
    stunned: function (f, z, w, h, t) {
      zap(f, w, h, t, "#ffe066"); f.classList.add("cf-stunned");
      var big = w >= 380, S = big ? 72 : 54, R = big ? 96 : 66;
      var o = el("div", "corbit", z); o.style.top = (h * .3) + "px";
      for (var i = 0; i < 3; i++) {
        var s = el("i", "", o); s.style.width = s.style.height = S + "px"; s.style.left = s.style.top = (-S / 2) + "px";
        s.innerHTML = '<svg viewBox="0 0 24 24"><path fill="#ffe066" stroke="#7a5a00" stroke-width=".6" d="M12 2l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 16.9 6 20.3l1.3-6.7-5-4.6 6.8-.8z"/></svg>';
        s.style.transform = "rotate(" + (i * 120) + "deg) translateX(" + R + "px) scaleY(.55)";
      }
    },
    paralyzed: function (f, z, w, h, t) { zap(f, w, h, t, "#9fdcff"); f.classList.add("cf-paralyzed"); el("div", "cedgeglow", z); },
    petrified: function (f, z, w, h) {
      f.classList.add("cf-petrified"); el("div", "cstone", z);
      var k = Math.min(w, h), p = function (pts, cls) { return '<path pathLength="1" class="' + (cls || "") + '" d="M' + pts.map(function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join(" L") + '"/>'; };
      var cr = function (x0, y0, dx, dy) {
        var s = ""; for (var i = 0; i < 4; i++) {
          var a = Math.atan2(dy, dx) + rnd(-.6, .6), len = k * rnd(.42, .7), pts = [[x0, y0]], x = x0, y = y0;
          for (var j = 0; j < 7; j++) { x += Math.cos(a + rnd(-.45, .45)) * len / 7; y += Math.sin(a + rnd(-.45, .45)) * len / 7; pts.push([x, y]); }
          s += p(pts, "main");
          [2, 4].forEach(function (bi) { var m = pts[bi], ba = a + (Math.random() < .5 ? -1 : 1) * rnd(.6, 1.1), bl = k * rnd(.08, .18);
            s += p([m, [m[0] + Math.cos(ba) * bl * .5, m[1] + Math.sin(ba) * bl * .5], [m[0] + Math.cos(ba + rnd(-.3, .3)) * bl, m[1] + Math.sin(ba + rnd(-.3, .3)) * bl]], "br"); });
        } return s;
      };
      z.insertAdjacentHTML("beforeend", svg(w, h, '<g class="ccrack">' + cr(0, 0, 1, 1) + cr(w, 0, -1, 1) + cr(w, h, -1, -1) + cr(0, h, 1, -1) + "</g>", "csvg"));
    },
    restrained: function (f, z, w, h) {
      // big chains criss-crossing the whole window; each one slides off and slams back on now and then
      var chain = function (x0, y0, x1, y1, i) {
        var len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI, n = Math.ceil(len / 40) + 1, s = "";
        for (var k = 0; k < n; k++) s += '<ellipse cx="' + (k * 40 + 20) + '" cy="0" rx="24" ry="' + (k % 2 ? 5 : 13) + '"/>';
        return '<g transform="translate(' + x0 + " " + y0 + ") rotate(" + a + ')"><g class="clinks" style="--len:' + Math.round(len + 80) + "px;animation-delay:" + (i * .35) + 's">' + s + "</g></g>";
      };
      var m = 30, sx = Math.max(26, w * .09);
      z.insertAdjacentHTML("beforeend", svg(w, h, '<g class="cchain">' +
        // two chains that never leave: straight down the left and right sides
        chain(sx, -m, sx, h + m, 0).replace('class="clinks"', 'class="cside"') + chain(w - sx, -m, w - sx, h + m, 0).replace('class="clinks"', 'class="cside"') +
        // the criss-cross: slams in over the middle now and then, holds, then slides back out
        chain(-m, -m, w + m, h + m, 0) + chain(-m, h + m, w + m, -m, 1) + chain(-m, h * .3, w + m, h * .62, 2) + "</g>", "csvg"));
      f.classList.add("cf-restrained");
    },
    grappled: function (f, z, w, h) {
      var k = Math.min(w, h);
      var vine = function (x0, y0, sx, sy) {
        var d = "M" + x0 + " " + y0, x = x0, y = y0, leaves = "";
        for (var i = 1; i <= 4; i++) { var nx = x0 + sx * k * .19 * i, ny = y0 + sy * k * .19 * i, cx = (x + nx) / 2 + (i % 2 ? 26 : -26) * sy, cy = (y + ny) / 2 + (i % 2 ? -26 : 26) * sx;
          d += " Q" + cx + " " + cy + " " + nx + " " + ny;
          leaves += '<path class="cleaf" style="--d:' + (.18 * i) + '" d="M' + nx + " " + ny + " q" + (13 * sx) + " -17 " + (29 * sx) + " -6 q" + (-14 * sx) + " 11 " + (-29 * sx) + ' 6z"/>'; x = nx; y = ny; }
        return '<path class="cvine" pathLength="1" d="' + d + '"/>' + leaves;
      };
      z.insertAdjacentHTML("beforeend", svg(w, h, '<g class="cvines">' + vine(0, h, 1, -1) + vine(w, 0, -1, 1) + vine(0, h * .45, 1, .35) + vine(w, h * .7, -1, -.3) + "</g>", "csvg"));
      f.classList.add("cf-grappled");
    },
    blinded: function (f, z) { el("div", "cblind", z); f.classList.add("cf-blinded"); },
    invisible: function (f, z) { f.classList.add("cf-invisible"); el("div", "cwhite", z); el("div", "chaze", z); },
    raging: function (f, z, w, h) {
      f.classList.add("cf-raging"); el("div", "cedgeglow", z);
      var fl = el("div", "cflames", z), n = Math.max(12, Math.round(w / 22));
      for (var i = 0; i < n; i++) {
        var t = el("i", "", fl), hgt = rnd(30, 75);
        t.style.left = (i / n * 100 + rnd(-1.5, 1.5)) + "%"; t.style.height = hgt + "%"; t.style.width = rnd(5, 9) + "%";
        t.style.animationDuration = rnd(.35, .8) + "s"; t.style.animationDelay = rnd(-1, 0) + "s";
      }
      for (var e = 0; e < 10; e++) { var sp = el("i", "cember", z); sp.style.left = rnd(3, 97) + "%"; sp.style.animationDuration = rnd(1.8, 3.4) + "s"; sp.style.animationDelay = rnd(-3.4, 0) + "s"; }
    },
    exhaustion: function (f, z, w, h, t, x) {
      var L = Math.max(1, Math.min(6, x.level || 1)); f.classList.add("cf-exhaustion"); f.style.setProperty("--ex", L);
      el("div", "cdark", f); if (L >= 3) el("div", "cash", z);
    },
  };
  function zap(f, w, h, t, col) {
    var W = w + 2 * t + 16, H = h + 2 * t + 16, z = document.createElement("div");
    z.className = "czap"; z.style.setProperty("--zc", col);
    z.innerHTML = svg(W, H, '<rect x="8" y="8" width="' + (W - 16) + '" height="' + (H - 16) + '" fill="none" stroke="' + col + '" stroke-width="2.4" pathLength="100"/>' +
      '<rect class="z2" x="8" y="8" width="' + (W - 16) + '" height="' + (H - 16) + '" fill="none" stroke="#fff" stroke-width="1.2" pathLength="100"/>', "csvg");
    f.appendChild(z);
  }
  // CONCENTRATING: faint runes fading in and out at random all around the frame; blue frame glow when it's the only effect
  function concentrating(f, z, w, h, alone) {
    var runes = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ", big = w >= 380, fs = big ? 26 : 18, gap = big ? 46 : 34;
    if (alone) f.classList.add("cf-concentrating");
    var box = el("div", "crunes", z), per = 2 * (w + h), n = Math.round(per / gap), inset = fs * .75;
    for (var i = 0; i < n; i++) {
      var d = i / n * per, x, y;
      if (d < w) { x = d; y = inset; } else if (d < w + h) { x = w - inset; y = d - w; } else if (d < 2 * w + h) { x = w - (d - w - h); y = h - inset; } else { x = inset; y = h - (d - 2 * w - h); }
      var r = el("i", "", box); r.textContent = runes.charAt(Math.floor(Math.random() * runes.length));
      r.style.left = x + "px"; r.style.top = y + "px"; r.style.fontSize = fs + "px";
      r.style.animationDuration = rnd(3.5, 7) + "s"; r.style.animationDelay = rnd(-7, 0) + "s";
    }
  }

  /* apply to one camera frame. f = .frame element, s = slot {w,h,size}, t = border px */
  function apply(f, s, t, list) {
    list = norm(list); if (!list.length) return;
    defs();
    var big = s.w >= 380, z = el("div", "cfx", null);
    z.style.left = t + "px"; z.style.top = t + "px"; z.style.width = s.w + "px"; z.style.height = s.h + "px";
    var edge = f.querySelector(".edge"); f.insertBefore(z, edge);
    var main = null;
    for (var i = 0; i < list.length; i++) if (FX[list[i].id]) { main = list[i]; break; }
    if (main) build[main.id](f, z, s.w, s.h, t, main);
    if (list.some(function (x) { return x.id === "concentrating"; })) concentrating(f, z, s.w, s.h, !main);
    // the top condition gets a big icon with its name beside it; any others sit after it as small icons
    var lead = main || list[0], rest = list.filter(function (x) { return x !== lead; });
    var mk = el("div", "cmarks" + (big ? " big" : ""), f); mk.style.left = (t + (big ? 14 : 9)) + "px"; mk.style.top = (t + (big ? 14 : 9)) + "px";
    var c = BY[lead.id];
    mk.innerHTML = '<span class="clead c-' + c.id + '" style="--cc:' + c.col + '">' + markerHTML([lead]) + '<b class="clabel">' + c.name + (lead.id === "exhaustion" && lead.level ? " " + lead.level : "") + "</b></span>" +
      (rest.length ? '<span class="crest">' + markerHTML(rest) + "</span>" : "");
  }

  window.ReditusConditions = { list: C, byId: BY, fromDDB: DDB, apply: apply, normalize: norm, markerHTML: markerHTML, icon: function (id) { return BY[id] ? iconSVG(BY[id]) : ""; } };
})();
