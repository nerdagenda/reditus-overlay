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
    { id: "silenced",      name: "Silenced",      col: "#d8c4ff", icon: '<path d="M5.5 4h13a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-7l-5 3.6v-3.6a2.5 2.5 0 0 1-2.5-2.5v-7A2.5 2.5 0 0 1 5.5 4z"/><path d="M9 7.5l6 6M15 7.5l-6 6"/>' },
    { id: "deafened",      name: "Deafened",      col: "#e8e8e8", icon: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6"/>' },
    { id: "unconscious",   name: "Unconscious",   col: "#a9b8ff", icon: '<path d="M4 7h6.5L4 14h6.5M13 11.5h6L13 18h6"/>' },
  ];
  var BY = {}; C.forEach(function (c, i) { c.rank = i; BY[c.id] = c; });
  var FX = { banished: 1, petrified: 1, paralyzed: 1, stunned: 1, frightened: 1, restrained: 1, grappled: 1, charmed: 1, blinded: 1, invisible: 1, raging: 1, poisoned: 1, exhaustion: 1, incapacitated: 1, prone: 1, unconscious: 1, deafened: 1, silenced: 1 };
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
  // talking mouth used by Silenced (open lips + teeth line + two little speech marks)
  var MOUTH = '<path d="M5.5 3.5h11a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6.5l-4.5 3.6v-3.6h0a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z"/><circle cx="7.6" cy="9.6" r=".9" fill="currentColor"/><circle cx="11" cy="9.6" r=".9" fill="currentColor"/><circle cx="14.4" cy="9.6" r=".9" fill="currentColor"/>';
  // ear outline used by the "ears" style of Deafened
  var EAR = '<path d="M6 9.2a5.6 5.6 0 0 1 11.2 0c0 3.2-2.6 4.2-3.6 6.2s-1 4.2-3.8 4.2a3 3 0 0 1-3-3"/><path d="M9.2 9.4a2.5 2.5 0 0 1 5 0c0 1.6-1.6 2.2-2.2 3.4"/>';
  var SC = 1, G = .8;   // set per window in apply(): effects scale with the window they're in
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
      for (var i = 0; i < n; i++) { var b = el("i", "cbubble", z); var s = rnd(5, 14) * SC; b.style.width = b.style.height = s + "px"; b.style.left = rnd(2, 96) + "%"; b.style.animationDuration = rnd(3.5, 7) + "s"; b.style.animationDelay = rnd(-7, 0) + "s"; }
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
        var s = rnd(12, 24) * SC; hh.style.width = hh.style.height = s + "px"; hh.style.left = (i % 2 ? rnd(84, 95) : rnd(2, 12)) + "%";
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
      var S = 34 * SC, R = 48 * SC;
      var o = el("div", "corbit", z); o.style.top = (h * .3) + "px";
      for (var i = 0; i < 3; i++) {
        var s = el("i", "", o); s.style.width = s.style.height = S + "px"; s.style.left = s.style.top = (-S / 2) + "px";
        s.innerHTML = '<svg viewBox="0 0 24 24"><path fill="#ffe066" stroke="#7a5a00" stroke-width=".6" d="M12 2l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 16.9 6 20.3l1.3-6.7-5-4.6 6.8-.8z"/></svg>';
        s.style.transform = "rotate(" + (i * 120) + "deg) translateX(" + R + "px) scaleY(.55)";
      }
    },
    paralyzed: function (f, z, w, h, t) { zap(f, w, h, t, "#9fdcff"); f.classList.add("cf-paralyzed"); el("div", "cedgeglow", z); },
    petrified: function (f, z, w, h, t, x, exiting) {
      if (!exiting) { f.classList.add("cf-petrified"); el("div", "cstonetint", z); el("div", "cstone", z); }
      var k = Math.min(w, h), p = function (pts, cls) { return '<path pathLength="1" class="' + cls + '" d="M' + pts.map(function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join(" L") + '"/>'; };
      // a jagged crack from (x0,y0) heading `a` radians, with a couple of short branches
      var crack = function (x0, y0, a, len, cls, segs) {
        var pts = [[x0, y0]], x = x0, y = y0, s = "", n = segs || 7;
        for (var j = 0; j < n; j++) { x += Math.cos(a + rnd(-.45, .45)) * len / n; y += Math.sin(a + rnd(-.45, .45)) * len / n; pts.push([x, y]); }
        s += p(pts, cls);
        [2, Math.floor(n * .65)].forEach(function (bi) { var m = pts[bi], ba = a + (Math.random() < .5 ? -1 : 1) * rnd(.6, 1.1), bl = k * rnd(.07, .15) * G / .8;
          s += p([m, [m[0] + Math.cos(ba) * bl * .5, m[1] + Math.sin(ba) * bl * .5], [m[0] + Math.cos(ba + rnd(-.3, .3)) * bl, m[1] + Math.sin(ba + rnd(-.3, .3)) * bl]], cls + " br"); });
        return s;
      };
      // side cracks: run down the left and right edges; they spread in when petrified starts, stay, and seal when it ends
      var sx = w * .07, side = exiting ? "cside out" : "cside";
      var sides = crack(sx, -4, Math.PI / 2 + .06, h + 8, side, 10) + crack(w - sx * 1.2, h + 4, -Math.PI / 2 + .08, h + 8, side, 10) +
        crack(sx * .6, h * .35, .25, w * .16 * G / .8 * .8, side, 4) + crack(w - sx, h * .62, Math.PI - .2, w * .15 * .8, side, 4);
      // middle cracks: spread across from the corners now and then, then seal back up
      var mid = "";
      if (!exiting) [[0, 0, 1, 1], [w, 0, -1, 1], [w, h, -1, -1], [0, h, 1, -1]].forEach(function (c) {
        for (var i = 0; i < 2; i++) mid += crack(c[0], c[1], Math.atan2(c[3], c[2]) + rnd(-.5, .5), k * rnd(.5, .75) * .8, "cmid", 7);
      });
      z.insertAdjacentHTML("beforeend", svg(w, h, '<g class="ccrack">' + sides + mid + "</g>", "csvg"));
    },
    restrained: function (f, z, w, h, t, x, exiting) {
      // chain(x0,y0 → x1,y1): links laid along the line; sc = link size; cls = how it moves
      var chain = function (x0, y0, x1, y1, cls, sc, delay) {
        sc *= G * .8;
        var len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI, st = 40 * sc, n = Math.ceil(len / st) + 1, s = "";
        for (var k = 0; k < n; k++) s += '<ellipse cx="' + (k * st + st / 2) + '" cy="0" rx="' + (24 * sc) + '" ry="' + ((k % 2 ? 4.5 : 12) * sc) + '" stroke-width="' + Math.max(.8, 4.6 * sc) + '"/>';
        return '<g transform="translate(' + x0 + " " + y0 + ") rotate(" + a + ')"><g class="' + cls + '" style="--len:' + Math.round(len + 120) + "px;animation-delay:" + (delay || 0) + 's"><g class="cjig">' + s + "</g></g></g>";
      };
      var m = 40 * G, lx = Math.max(24 * G, w * .075), rx = w - Math.max(21 * G, w * .085);
      // two side chains, each tilted a little differently (one bigger) for depth: slide in, then stay (straining) until the condition ends
      var tl = Math.tan(4 * Math.PI / 180) * (h + 2 * m) / 2, tr = Math.tan(-7 * Math.PI / 180) * (h + 2 * m) / 2;
      var side = chain(lx - tl, -m, lx + tl, h + m, exiting ? "cside out" : "cside", 1.22, 0) + chain(rx - tr, -m, rx + tr, h + m, exiting ? "cside out" : "cside", .95, .18);
      // the criss-cross comes in with them, holds, slides away to give the camera room, and returns now and then
      var mid = exiting ? "" : chain(-m, -m, w + m, h + m, "clinks", 1, .1) + chain(-m, h + m, w + m, -m, "clinks", 1, .32) + chain(-m, h * .3, w + m, h * .62, "clinks", 1, .5);
      z.insertAdjacentHTML("beforeend", svg(w, h, '<g class="cchain">' + side + mid + "</g>", "csvg"));
      if (!exiting) f.classList.add("cf-restrained");
    },
    grappled: function (f, z, w, h, t, x, exiting) {
      var k = Math.min(w, h);
      // a curling vine from (x0,y0) in direction (dx,dy), `n` curls long, with leaves
      var vine = function (x0, y0, dx, dy, len, n, cls, wob) {
        var d = "M" + x0 + " " + y0, x = x0, y = y0, leaves = "", nx0 = -dy, ny0 = dx;
        for (var i = 1; i <= n; i++) {
          var nx = x0 + dx * len * i / n, ny = y0 + dy * len * i / n, sg = i % 2 ? 1 : -1, ww = (wob || 26) * sg * G / .8 * .8 * rnd(.35, 1.15);
          d += " Q" + ((x + nx) / 2 + nx0 * ww) + " " + ((y + ny) / 2 + ny0 * ww) + " " + nx + " " + ny;
          var lx = nx0 * sg, ly = ny0 * sg;
          leaves += '<path class="cleaf ' + cls + '" style="--d:' + (i / n) + '" d="M' + nx + " " + ny + " q" + (lx * 18 + dx * 10) * G * .8 + " " + (ly * 18 + dy * 10) * G * .8 + " " + (lx * 42) * G * .8 + " " + (ly * 42) * G * .8 +
            " q" + (-lx * 8 + dx * 18) * G * .8 + " " + (-ly * 8 + dy * 18) * G * .8 + " " + (-lx * 42) * G * .8 + " " + (-ly * 42) * G * .8 + 'z"/>';
          x = nx; y = ny;
        }
        return '<path class="cvine ' + cls + '" pathLength="1" d="' + d + '"/>' + leaves;
      };
      var sx = Math.max(22 * G, w * .07), side = exiting ? "cside out" : "cside";
      // two vines up the sides (grow in with the condition, stay, wither when it ends)
      var sides = vine(sx, h + 10, .05, -1, h + 20, 3, side, 9) + vine(w - sx, h + 10, -.07, -1, h + 20, 3, side, 11);
      // the vines across the middle grow in now and then, hold, then wither back
      var mid = exiting ? "" : vine(0, h, 1, -.62, Math.hypot(w, h) * .9, 6, "cmid", 30) + vine(w, h * .1, -1, .5, Math.hypot(w, h) * .85, 6, "cmid", 30) + vine(0, h * .4, 1, .12, w * .95, 5, "cmid", 26);
      z.insertAdjacentHTML("beforeend", svg(w, h, '<g class="cvines">' + sides + mid + "</g>", "csvg"));
      if (!exiting) f.classList.add("cf-grappled");
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
    incapacitated: function (f, z) { f.classList.add("cf-incapacitated"); el("div", "cdim", z); },
    prone: function (f) { f.classList.add("cf-prone"); },
    deafened: function (f, z, w, h, t, x, exiting, mouths) {
      // music notes drift up, get slashed through, and vanish
      f.classList.add(mouths ? "cf-silenced" : "cf-deafened");
      var notes = [
        '<ellipse cx="7" cy="17.5" rx="3.6" ry="2.6" transform="rotate(-20 7 17.5)"/><rect x="9.6" y="3" width="1.5" height="14.5"/><path d="M11 3c1.8 3.2 6.2 3.4 5.2 8.6c-.4-2.6-2.4-3.9-5.2-4.2z"/>',
        '<ellipse cx="5" cy="18.6" rx="3.3" ry="2.4" transform="rotate(-20 5 18.6)"/><ellipse cx="15.6" cy="16.6" rx="3.3" ry="2.4" transform="rotate(-20 15.6 16.6)"/><rect x="7.3" y="5.2" width="1.4" height="13.4"/><rect x="17.9" y="3.2" width="1.4" height="13.4"/><path d="M7.3 5.2L19.3 3.2V6L7.3 8z"/>'];
      var n = 8, lanes = [];  // 8 lanes across the window; one new icon every ~4s, so only one or two are up at once
      for (var q = 0; q < n; q++) lanes.push(q + .5);
      lanes.sort(function () { return Math.random() - .5; });
      for (var i = 0; i < n; i++) {
        var e = el("i", "cnote", z), S = rnd(34, 48) * SC, dur = 32;
        // one lane per note across the whole width (a little jitter), lanes taken in shuffled order so neighbours don't rise together
        e.style.width = e.style.height = S + "px"; e.style.left = (lanes[i] + rnd(-.3, .3)) / n * 88 + 3 + "%";
        e.style.setProperty("--rise", (h * rnd(.32, .5)) + "px");
        e.style.setProperty("--dur", dur.toFixed(2) + "s"); e.style.setProperty("--del", (i * 4 + rnd(-.6, .6)).toFixed(2) + "s");
        var useEar = API.deafGlyph === "ears" || (API.deafGlyph === "mixed" && Math.random() < .5);
        var glyph = mouths ? '<g class="n" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + MOUTH + "</g>" : useEar
          ? '<g class="n" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + EAR + "</g>"
          : '<g class="n" fill="currentColor">' + notes[i % 2] + "</g>";
        // silenced: the chat bubble gets an X; deafened: a single slash
        e.innerHTML = '<svg viewBox="0 0 22 22">' + glyph + (mouths ? '<path class="x" pathLength="1" d="M3.5 3.5L18.5 18.5M18.5 3.5L3.5 18.5" />' : '<path class="x" pathLength="1" d="M2 20L20 2" />') + "</svg>";
      }
    },
    // SILENCED: same as deafened, but little talking mouths get slashed out
    silenced: function (f, z, w, h) { build.deafened(f, z, w, h, 0, null, false, true); },
    unconscious: function (f) { f.classList.add("cf-unconscious"); },
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
    var runes = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ", fs = 27 * SC, gap = 44 * SC;
    if (alone) f.classList.add("cf-concentrating");
    var box = el("div", "crunes", z), per = 2 * (w + h), n = Math.round(per / gap), inset = fs * .75;
    // the runes ride a loop just inside the frame and drift slowly clockwise while they blink in and out
    var path = "M" + inset + "," + inset + " H" + (w - inset) + " V" + (h - inset) + " H" + inset + " Z", LAP = 160;
    for (var i = 0; i < n; i++) {
      var r = el("i", "", box); r.textContent = runes.charAt(Math.floor(Math.random() * runes.length));
      r.style.fontSize = fs + "px"; r.style.offsetPath = "path('" + path + "')";
      var blink = rnd(9, 14);
      r.style.animationDuration = blink + "s, " + LAP + "s";
      r.style.animationDelay = rnd(-14, 0) + "s, " + (-(i / n) * LAP) + "s";
    }
    // blue glow sweeping round the frame the other way
    var ring = el("div", "cconcring", z); ring.style.setProperty("--rw", Math.max(4, 10 * G) + "px");
  }

  /* apply to one camera frame. f = .frame element, s = slot {w,h,size}, t = border px */
  // remembers what each window showed last time, so a redraw carries on mid-animation (no replayed entrances)
  // and a removed condition can animate out (restrained chains)
  // remembers what each window showed last time, so a redraw carries on mid-animation (no replayed entrances),
  // and anything that was switched off gets a proper exit instead of cutting out
  var MEM = {}, EXITS = { restrained: 1300, grappled: 1500, petrified: 1500 };
  // the condition the DM picked to show ("Show" in the control panel), if any
  function featured(list) { for (var i = 0; i < list.length; i++) if (list[i].show) return list[i]; return null; }
  function mainOf(list) {
    var f = featured(list); if (f) return FX[f.id] ? f : null;
    for (var i = 0; i < list.length; i++) if (FX[list[i].id]) return list[i]; return null;
  }
  function sig(list) { return JSON.stringify(list || []); }

  // draw a set of conditions into frame-like element F (its effect layer, frame recolour, markers)
  function paint(F, s, t, list, opt, exiting) {
    var big = s.w >= 380, z = el("div", "cfx", null), main = mainOf(list);
    z.style.setProperty("--g", G.toFixed(3)); z.style.setProperty("--sc", SC.toFixed(3));
    z.style.left = t + "px"; z.style.top = t + "px"; z.style.width = s.w + "px"; z.style.height = s.h + "px";
    var edge = F.querySelector(":scope > .edge"); F.insertBefore(z, edge);
    if (main) build[main.id](F, z, s.w, s.h, t, main, exiting && EXITS[main.id] ? true : false);
    var ft = featured(list);
    if (list.some(function (x) { return x.id === "concentrating"; }) && (!ft || ft.id === "concentrating")) concentrating(F, z, s.w, s.h, !main);
    var mk = null;
    if (!opt.noMarks && list.length) {
      var lead = ft || main || list[0], rest = list.filter(function (x) { return x !== lead; }), c = BY[lead.id];
      mk = el("div", "cmarks" + (big ? " big" : ""), F); mk.style.left = (t + (big ? 14 : 9)) + "px"; mk.style.top = (t + (big ? 14 : 9)) + "px";
      mk.innerHTML = '<span class="clead c-' + c.id + '" style="--cc:' + c.col + '">' + markerHTML([lead]) + '<b class="clabel">' + c.name + (lead.id === "exhaustion" && lead.level ? " " + lead.level : "") + "</b></span>" +
        (rest.length ? '<span class="crest">' + markerHTML(rest) + "</span>" : "");
    }
    return { z: z, mk: mk, main: main };
  }
  // fast-forward a freshly drawn layer to where it would be if it had never been redrawn
  function catchUp(F, parts, elapsed) {
    if (!(elapsed > 50) || !parts.z.getAnimations) return;
    var anims = parts.z.getAnimations({ subtree: true });
    if (parts.mk) anims = anims.concat(parts.mk.getAnimations({ subtree: true }));
    Array.prototype.forEach.call(F.querySelectorAll(":scope > .cghost, :scope > .czap, :scope > .cdark"), function (e) { anims = anims.concat(e.getAnimations({ subtree: true })); });
    anims.forEach(function (an) { try { an.currentTime = (an.currentTime || 0) + elapsed; } catch (e) {} });
  }

  function apply(f, s, t, list, opt) {
    opt = opt || {};
    list = norm(list);
    var key = s.id || "x", now = Date.now(), prev = MEM[key] || { starts: {}, list: [] }, starts = {};
    list.forEach(function (x) { starts[x.id] = prev.starts[x.id] || now; });
    MEM[key] = { starts: starts, list: list };
    var removed = prev.list.length && sig(prev.list) !== sig(list) &&
      prev.list.some(function (x) { return !list.some(function (y) { return y.id === x.id; }); });
    if (!list.length && !removed) return;
    defs();
    SC = opt.scale || Math.max(.45, Math.min(1.6, s.h / 235)); G = SC * .8;

    if (removed) {
      // snapshot of the old look, laid over the new one, that animates away and then removes itself
      var pm = mainOf(prev.list), soft = pm && EXITS[pm.id] && !list.some(function (y) { return y.id === pm.id; });
      var gw = el("div", "frame cexitwrap " + (soft ? "cexit-soft" : "cexit-wipe"), f);
      var ge = el("div", "edge", gw); ge.style.borderWidth = t + "px";
      Array.prototype.forEach.call(f.querySelectorAll(":scope > .corner"), function (c) { gw.appendChild(c.cloneNode(true)); });
      var old = paint(gw, s, t, prev.list, { noMarks: opt.noMarks }, soft);
      gw.classList.add("held");
      if (!soft) catchUp(gw, old, now - (pm ? prev.starts[pm.id] : now));
      setTimeout(function () { gw.remove(); }, soft ? 1500 : 1100);
    }
    if (!list.length) return;
    var parts = paint(f, s, t, list, opt, false);
    catchUp(f, parts, parts.main ? now - starts[parts.main.id] : 0);
  }

  var API = window.ReditusConditions = { deafGlyph: "ears", list: C, byId: BY, fromDDB: DDB, apply: apply, normalize: norm, markerHTML: markerHTML, icon: function (id) { return BY[id] ? iconSVG(BY[id]) : ""; } };
})();
