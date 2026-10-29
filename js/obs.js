/* The Reditus Campaign — automatic camera placement in OBS (obs-websocket 5).
   The overlay browser source, running inside the DM's OBS, connects to OBS on the same computer and
   moves/resizes each camera source so it lines up with its window on this screen. Unused cameras are hidden.

   Turn it on by adding to the overlay's browser-source URL:
     &obs=PASSWORD      the OBS WebSocket password (Tools → WebSocket Server Settings). Stays in OBS; never sent anywhere else.
     &obsport=4455      optional, if the port was changed
     &obsscene=Name     optional, the OBS scene to arrange (otherwise it finds the scene holding this overlay)
     &obsdebug=1        optional, shows a small status box
   Camera sources are found by name: "<Nameplate> Cam" (e.g. "Trey Cam", "GM Cam"), or a custom name set per character. */
(function () {
  "use strict";
  var q = new URLSearchParams(location.search);
  var PASS = q.get("obs");
  if (PASS == null) { window.ReditusOBS = { place: function () {} }; return; }
  var PORT = +(q.get("obsport") || 4455), FIXED_SCENE = q.get("obsscene") || "", DEBUG = q.get("obsdebug") === "1";
  var ws = null, ready = false, reqN = 0, pending = {}, sceneName = FIXED_SCENE, canvasK = 1, lastSig = "", wanted = null, retry = null, stateMsg = "starting";

  var box = null;
  function say(t, bad) {
    stateMsg = t;
    if (window.console) console[bad ? "warn" : "log"]("[Reditus OBS] " + t);
    if (!DEBUG) return;
    if (!box) { box = document.createElement("div"); box.style.cssText = "position:fixed;left:8px;top:8px;z-index:99999;font:13px/1.35 Arial,sans-serif;color:#fff;background:rgba(0,0,0,.75);padding:6px 9px;border:1px solid #e9b979;max-width:520px"; document.body.appendChild(box); }
    box.textContent = "OBS cameras: " + t; box.style.borderColor = bad ? "#ff6a5e" : "#e9b979";
  }

  function b64(buf) { var s = "", b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function sha(str) { return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(b64); }

  function connect() {
    clearTimeout(retry);
    try { ws = new WebSocket("ws://127.0.0.1:" + PORT); } catch (e) { say("can't open a connection (" + e.message + ")", true); return later(); }
    ws.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.op === 0) {   // Hello
        var a = m.d && m.d.authentication;
        var ident = function (auth) { ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, authentication: auth, eventSubscriptions: 0 } })); };
        if (a) sha(PASS + a.salt).then(function (secret) { return sha(secret + a.challenge); }).then(ident); else ident(undefined);
      } else if (m.op === 2) {   // Identified
        ready = true; say("connected");
        call("GetVideoSettings").then(function (v) { canvasK = (v && v.baseWidth ? v.baseWidth : 1920) / 1920; lastSig = ""; if (wanted) apply(wanted); });
      } else if (m.op === 7 || m.op === 9) {
        var p = pending[m.d.requestId]; if (!p) return; delete pending[m.d.requestId];
        if (m.op === 9) p.ok(m.d.results || []);
        else if (m.d.requestStatus && m.d.requestStatus.result) p.ok(m.d.responseData || {});
        else p.bad(new Error((m.d.requestStatus && m.d.requestStatus.comment) || "request failed"));
      }
    };
    ws.onclose = function (ev) {
      ready = false;
      say(ev.code === 4009 ? "wrong OBS WebSocket password" : "not connected to OBS (is Tools → WebSocket Server Settings enabled?) — retrying", true);
      later();
    };
    ws.onerror = function () {};
  }
  function later() { clearTimeout(retry); retry = setTimeout(connect, 5000); }
  function call(type, data) {
    return new Promise(function (ok, bad) {
      if (!ready) return bad(new Error("not connected"));
      var id = "r" + (++reqN); pending[id] = { ok: ok, bad: bad };
      ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: data || {} } }));
      setTimeout(function () { if (pending[id]) { delete pending[id]; bad(new Error(type + " timed out")); } }, 8000);
    });
  }
  function batch(reqs) {
    return new Promise(function (ok, bad) {
      if (!ready) return bad(new Error("not connected"));
      var id = "b" + (++reqN); pending[id] = { ok: ok, bad: bad };
      ws.send(JSON.stringify({ op: 8, d: { requestId: id, haltOnFailure: false, executionType: 0, requests: reqs } }));
      setTimeout(function () { if (pending[id]) { delete pending[id]; bad(new Error("batch timed out")); } }, 10000);
    });
  }

  // find the OBS scene that holds this overlay (a browser source whose URL is this screen's top layer)
  function findScene() {
    if (sceneName) return Promise.resolve(sceneName);
    var mine = new URLSearchParams(location.search), myScene = (mine.get("scene") || "main").toLowerCase();
    return call("GetInputList", { inputKind: "browser_source" }).then(function (r) {
      var inputs = (r.inputs || []);
      return batch(inputs.map(function (i) { return { requestType: "GetInputSettings", requestData: { inputName: i.inputName } }; })).then(function (res) {
        var names = [];
        res.forEach(function (x, k) {
          var u = ((x.responseData || {}).inputSettings || {}).url || "";
          if (!/reditus-overlay|index\.html/i.test(u) || /layer=under/i.test(u)) return;
          var sc = ((u.split("?")[1] || "").match(/(?:^|&)scene=([^&]+)/) || [, "main"])[1].toLowerCase();
          if (sc === myScene && (myScene !== "spotlight" || ((u.match(/focus=([^&]+)/) || [])[1] || "") === (mine.get("focus") || ""))) names.push(inputs[k].inputName);
        });
        if (!names.length) throw new Error("couldn't find this overlay's browser source in OBS — add &obsscene=YourSceneName to the URL");
        return call("GetSceneList").then(function (sl) {
          var scenes = (sl.scenes || []).map(function (s) { return s.sceneName; });
          return batch(scenes.map(function (n) { return { requestType: "GetSceneItemList", requestData: { sceneName: n } }; })).then(function (lists) {
            for (var i = 0; i < lists.length; i++) {
              var items = ((lists[i].responseData || {}).sceneItems || []);
              if (items.some(function (it) { return names.indexOf(it.sourceName) >= 0; })) { sceneName = scenes[i]; return sceneName; }
            }
            throw new Error("found the overlay source but not its scene — add &obsscene=YourSceneName to the URL");
          });
        });
      });
    });
  }

  function camName(s) {
    var w = s.who || {};
    if (w.cam) return w.cam;
    return (s.id === "gm" ? "GM" : (w.name || s.label || s.id)) + " Cam";
  }

  // slots: [{id, who, x, y, w, h, map}] in 1920×1080 overlay pixels
  function apply(slots) {
    if (!ready) return;
    var want = slots.filter(function (s) { return !s.map && s.who; }).map(function (s) { return { cam: camName(s).toLowerCase(), x: s.x, y: s.y, w: s.w, h: s.h }; });
    var sig = JSON.stringify(want) + "|" + canvasK;
    if (sig === lastSig) return;
    lastSig = sig;
    findScene().then(function (scene) {
      return call("GetSceneItemList", { sceneName: scene }).then(function (r) {
        var items = r.sceneItems || [], byName = {};
        items.forEach(function (it) { byName[String(it.sourceName).toLowerCase()] = it; });
        var placed = want.filter(function (p) { return byName[p.cam]; });
        var missing = want.filter(function (p) { return !byName[p.cam]; }).map(function (p) { return p.cam; });
        // native size of each placed camera, so it can be scaled to fill its window and cropped to fit exactly
        return batch(placed.map(function (p) { return { requestType: "GetSceneItemTransform", requestData: { sceneName: scene, sceneItemId: byName[p.cam].sceneItemId } }; })).then(function (tr) {
          var reqs = [], B = 4, k = canvasK;
          placed.forEach(function (p, i) {
            var t = ((tr[i] || {}).responseData || {}).sceneItemTransform || {}, sw = t.sourceWidth, sh = t.sourceHeight;
            var bw = (p.w + 2 * B) * k, bh = (p.h + 2 * B) * k, px = (p.x - B) * k, py = (p.y - B) * k, xf;
            if (sw > 0 && sh > 0) {   // cover: scale up to fill, crop the overflow evenly
              var sc = Math.max(bw / sw, bh / sh), cx = Math.max(0, (sw - bw / sc) / 2), cy = Math.max(0, (sh - bh / sc) / 2);
              xf = { positionX: px, positionY: py, alignment: 5, rotation: 0, scaleX: sc, scaleY: sc, boundsType: "OBS_BOUNDS_NONE",
                cropLeft: Math.round(cx), cropRight: Math.round(cx), cropTop: Math.round(cy), cropBottom: Math.round(cy) };
            } else {                  // size not known yet (camera still loading): let OBS fit it into the window
              xf = { positionX: px, positionY: py, alignment: 5, rotation: 0, boundsType: "OBS_BOUNDS_SCALE_OUTER", boundsAlignment: 0,
                boundsWidth: bw, boundsHeight: bh, cropToBounds: true, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0 };
            }
            reqs.push({ requestType: "SetSceneItemTransform", requestData: { sceneName: scene, sceneItemId: byName[p.cam].sceneItemId, sceneItemTransform: xf } });
            reqs.push({ requestType: "SetSceneItemEnabled", requestData: { sceneName: scene, sceneItemId: byName[p.cam].sceneItemId, sceneItemEnabled: true } });
            if (!(sw > 0)) setTimeout(function () { lastSig = ""; if (wanted) apply(wanted); }, 4000);   // try again once it has loaded
          });
          // hide any other camera in this scene (sources whose name ends in "Cam")
          var used = {}; placed.forEach(function (p) { used[p.cam] = 1; });
          items.forEach(function (it) {
            var n = String(it.sourceName).toLowerCase();
            if (/\scam$/.test(n) && !used[n] && it.sceneItemEnabled) reqs.push({ requestType: "SetSceneItemEnabled", requestData: { sceneName: scene, sceneItemId: it.sceneItemId, sceneItemEnabled: false } });
          });
          return batch(reqs).then(function () {
            say("arranged " + placed.length + " camera" + (placed.length === 1 ? "" : "s") + " in “" + scene + "”" + (missing.length ? " · not found in this scene: " + missing.join(", ") : ""), !!missing.length);
          });
        });
      });
    }).catch(function (e) { lastSig = ""; say(e.message, true); });
  }

  window.ReditusOBS = {
    place: function (slots) { wanted = slots; apply(slots); },
    status: function () { return stateMsg; },
  };
  connect();
})();
