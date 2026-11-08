/* The Reditus Campaign — takeover sound: static, a warping drone, a static burst, then a rushing wave of water.
   Timed to the reveal (0–2.3 s glitch · 0.7–2.6 s static in the GM window · 2.3–6.2 s blood-water wave).
   build(ctx, dest) schedules everything on any AudioContext (live, or offline to render a preview file). */
(function () {
  "use strict";
  function noise(ctx, secs, kind) {
    var n = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < n; i++) {
      var w = Math.random() * 2 - 1;
      if (kind === "brown") { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    var s = ctx.createBufferSource(); s.buffer = buf; return s;
  }
  function build(ctx, dest, t0) {
    t0 = t0 || ctx.currentTime;
    var master = ctx.createGain(); master.gain.value = .55;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6;
    master.connect(comp).connect(dest);

    // 1 · glitch static: band-passed noise whose pitch wobbles, chopped into stutters
    var st = noise(ctx, 2.6), bp = ctx.createBiquadFilter(), sg = ctx.createGain(), chop = ctx.createGain();
    bp.type = "bandpass"; bp.Q.value = 1.4; bp.frequency.setValueAtTime(900, t0);
    for (var k = 0; k < 24; k++) bp.frequency.setValueAtTime(400 + Math.random() * 3600, t0 + k * .1);
    sg.gain.setValueAtTime(0, t0); sg.gain.linearRampToValueAtTime(.55, t0 + .08); sg.gain.setValueAtTime(.55, t0 + 2.05); sg.gain.linearRampToValueAtTime(0, t0 + 2.45);
    for (var c = 0; c < 46; c++) chop.gain.setValueAtTime(Math.random() < .72 ? 1 : .08, t0 + c * .052);
    st.connect(bp).connect(chop).connect(sg).connect(master); st.start(t0); st.stop(t0 + 2.6);

    // 2 · warping drone: a detuned saw that bends down and wobbles, like the signal being pulled under
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), og = ctx.createGain(), lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    o1.type = "sawtooth"; o2.type = "square"; lp.type = "lowpass"; lp.frequency.value = 1300; lp.Q.value = 6;
    o1.frequency.setValueAtTime(240, t0); o1.frequency.exponentialRampToValueAtTime(48, t0 + 2.4);
    o2.frequency.setValueAtTime(247, t0); o2.frequency.exponentialRampToValueAtTime(46, t0 + 2.4);
    lfo.frequency.setValueAtTime(5, t0); lfo.frequency.linearRampToValueAtTime(14, t0 + 2.2); lfoG.gain.value = 24;
    lfo.connect(lfoG); lfoG.connect(o1.frequency); lfoG.connect(o2.frequency);
    og.gain.setValueAtTime(0, t0); og.gain.linearRampToValueAtTime(.22, t0 + .25); og.gain.setValueAtTime(.22, t0 + 2.0); og.gain.exponentialRampToValueAtTime(.001, t0 + 2.6);
    o1.connect(lp); o2.connect(lp); lp.connect(og).connect(master);
    [o1, o2, lfo].forEach(function (o) { o.start(t0); o.stop(t0 + 2.7); });

    // 3 · static burst as the guest's camera breaks into the GM window
    var sb = noise(ctx, 2), hp = ctx.createBiquadFilter(), bg = ctx.createGain();
    hp.type = "highpass"; hp.frequency.value = 1800;
    bg.gain.setValueAtTime(0, t0 + .7); bg.gain.linearRampToValueAtTime(.5, t0 + .74); bg.gain.exponentialRampToValueAtTime(.02, t0 + 2.5);
    sb.connect(hp).connect(bg).connect(master); sb.start(t0 + .7); sb.stop(t0 + 2.7);

    // 4 · the wave: a rushing swell of water that floods in, crashes, then drains away
    var wv = noise(ctx, 4.2, "brown"), wl = ctx.createBiquadFilter(), wg = ctx.createGain(), T = t0 + 2.3;
    wl.type = "lowpass"; wl.Q.value = .8;
    wl.frequency.setValueAtTime(180, T); wl.frequency.exponentialRampToValueAtTime(2400, T + 1.5); wl.frequency.setValueAtTime(2400, T + 1.95); wl.frequency.exponentialRampToValueAtTime(160, T + 3.85);
    wg.gain.setValueAtTime(0, T); wg.gain.linearRampToValueAtTime(1.0, T + 1.5); wg.gain.setValueAtTime(1.0, T + 1.95); wg.gain.exponentialRampToValueAtTime(.001, T + 3.9);
    wv.connect(wl).connect(wg).connect(master); wv.start(T); wv.stop(T + 4.1);
    // a low thud when the screen is fully under
    var th = ctx.createOscillator(), tg = ctx.createGain(); th.type = "sine";
    th.frequency.setValueAtTime(90, T + 1.45); th.frequency.exponentialRampToValueAtTime(34, T + 2.3);
    tg.gain.setValueAtTime(0, T + 1.45); tg.gain.linearRampToValueAtTime(.5, T + 1.5); tg.gain.exponentialRampToValueAtTime(.001, T + 2.6);
    th.connect(tg).connect(master); th.start(T + 1.45); th.stop(T + 2.7);
    return 6.4;   // seconds
  }
  function play() {
    try { var A = window.AudioContext || window.webkitAudioContext; var ctx = new A(); if (ctx.state === "suspended") ctx.resume(); build(ctx, ctx.destination); setTimeout(function () { ctx.close(); }, 8000); } catch (e) {}
  }
  window.ReditusTakeoverSound = { build: build, play: play };
})();
