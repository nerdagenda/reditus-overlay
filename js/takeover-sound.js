/* The Reditus Campaign — takeover sound: static that keeps building (with a digital crackle on every flash of the
   guest's camera) into a loud white-noise burst at the white-out, then cuts out as the screen clears.
   Timed to the overlay's transition: "in" peaks at 6.0 s (holds .7 s), "out" peaks at 3.6 s (holds .6 s).
   build(ctx, dest, t0, mode, sched) schedules everything on any AudioContext (live, or offline to render a preview file).
   sched = the camera's flicker bursts [{at, dur}] in ms, so every flash has its crackle. */
(function () {
  "use strict";
  var T = { "in": { peak: 6.0, hold: .7 }, out: { peak: 3.6, hold: .6 } };
  function noise(ctx, secs) {
    var n = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var s = ctx.createBufferSource(); s.buffer = buf; return s;
  }
  function build(ctx, dest, t0, mode, sched) {
    var M = T[mode === "out" ? "out" : "in"], P = M.peak, H = M.hold;
    t0 = t0 || ctx.currentTime;
    var master = ctx.createGain(); master.gain.value = .6;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 6; comp.ratio.value = 8; comp.attack.value = .003; comp.release.value = .15;
    master.connect(comp).connect(dest);
    var end = t0 + P + H;

    // 1 · the static bed: starts thin and crackly, opens up and swells all the way to the white-out, stuttering as it goes
    var st = noise(ctx, P + H + .2), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), sg = ctx.createGain(), chop = ctx.createGain();
    hp.type = "highpass"; hp.frequency.setValueAtTime(2600, t0); hp.frequency.exponentialRampToValueAtTime(300, t0 + P);
    lp.type = "lowpass"; lp.frequency.setValueAtTime(3500, t0); lp.frequency.exponentialRampToValueAtTime(16000, t0 + P);
    sg.gain.setValueAtTime(.0001, t0); sg.gain.exponentialRampToValueAtTime(.08, t0 + .35); sg.gain.exponentialRampToValueAtTime(.55, t0 + P - .05);
    for (var c = 0, tt = t0; tt < t0 + P - .15; c++) {   // stutters, fewer and fewer as it builds
      var k = (tt - t0) / P; chop.gain.setValueAtTime(Math.random() < .35 * (1 - k) ? .1 : 1, tt); tt += .03 + Math.random() * .07;
    }
    chop.gain.setValueAtTime(1, t0 + P - .15);
    st.connect(hp).connect(lp).connect(chop).connect(sg).connect(master); st.start(t0); st.stop(end + .05);

    // 2 · a low warped hum underneath, rising — the signal being taken over (falling back down on the way out)
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), ol = ctx.createBiquadFilter(), og = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o1.type = "sawtooth"; o2.type = "square"; ol.type = "lowpass"; ol.frequency.value = 900; ol.Q.value = 5;
    var f0 = mode === "out" ? 170 : 55, f1 = mode === "out" ? 50 : 190;
    o1.frequency.setValueAtTime(f0, t0); o1.frequency.exponentialRampToValueAtTime(f1, t0 + P);
    o2.frequency.setValueAtTime(f0 * 1.02, t0); o2.frequency.exponentialRampToValueAtTime(f1 * 1.03, t0 + P);
    lfo.frequency.setValueAtTime(3, t0); lfo.frequency.linearRampToValueAtTime(11, t0 + P); lg.gain.value = 9;
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    og.gain.setValueAtTime(.0001, t0); og.gain.exponentialRampToValueAtTime(.16, t0 + 1); og.gain.setValueAtTime(.16, t0 + P - .1); og.gain.linearRampToValueAtTime(0, t0 + P);
    o1.connect(ol); o2.connect(ol); ol.connect(og).connect(master);
    [o1, o2, lfo].forEach(function (o) { o.start(t0); o.stop(t0 + P + .05); });

    // 3 · a digital crackle on every flash of the guest's camera
    (sched || []).forEach(function (b) {
      var at = t0 + b.at / 1000, d = Math.max(.04, b.dur / 1000);
      var n = noise(ctx, d + .05), bp = ctx.createBiquadFilter(), g = ctx.createGain(), sq = ctx.createOscillator(), sqg = ctx.createGain();
      bp.type = "bandpass"; bp.frequency.value = 900 + Math.random() * 3200; bp.Q.value = 2.5;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.6, at + .008); g.gain.setValueAtTime(.6, at + d - .01); g.gain.linearRampToValueAtTime(0, at + d);
      n.connect(bp).connect(g).connect(master); n.start(at); n.stop(at + d + .05);
      sq.type = "square"; sq.frequency.setValueAtTime(220 + Math.random() * 900, at); sq.frequency.setValueAtTime(110 + Math.random() * 500, at + d / 2);
      sqg.gain.setValueAtTime(0, at); sqg.gain.linearRampToValueAtTime(.09, at + .005); sqg.gain.setValueAtTime(.09, at + d - .01); sqg.gain.linearRampToValueAtTime(0, at + d);
      sq.connect(sqg).connect(master); sq.start(at); sq.stop(at + d + .02);
    });

    // 4 · the white-out: a loud full-band white-noise burst with a low hit, held, then cut as the screen clears
    var wb = noise(ctx, H + .3), wg = ctx.createGain();
    wg.gain.setValueAtTime(0, t0 + P - .02); wg.gain.linearRampToValueAtTime(1, t0 + P); wg.gain.setValueAtTime(.85, t0 + P + H - .04); wg.gain.linearRampToValueAtTime(0, end + .06);
    wb.connect(wg).connect(master); wb.start(t0 + P - .02); wb.stop(end + .1);
    var th = ctx.createOscillator(), tg = ctx.createGain(); th.type = "sine";
    th.frequency.setValueAtTime(110, t0 + P); th.frequency.exponentialRampToValueAtTime(32, t0 + P + .5);
    tg.gain.setValueAtTime(0, t0 + P); tg.gain.linearRampToValueAtTime(.7, t0 + P + .01); tg.gain.exponentialRampToValueAtTime(.001, t0 + P + .6);
    th.connect(tg).connect(master); th.start(t0 + P); th.stop(t0 + P + .65);
    return P + H + .2;   // seconds
  }
  function play(mode, sched) {
    try {
      var A = window.AudioContext || window.webkitAudioContext, ctx = new A();
      if (ctx.state === "suspended") ctx.resume();
      var secs = build(ctx, ctx.destination, 0, mode, sched);
      setTimeout(function () { ctx.close(); }, (secs + 1.5) * 1000);
    } catch (e) {}
  }
  window.ReditusTakeoverSound = { build: build, play: play };
})();
