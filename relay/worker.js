/* Reditus HP relay — a Cloudflare Worker.
   The overlay asks:   GET /hp?ids=12345678,23456789
   The relay fetches each character's D&D Beyond sheet data (sheets must be set to Public),
   keeps only the hit-point numbers, caches them for a few seconds, and answers with CORS
   headers so the overlay (on GitHub Pages / OBS) is allowed to read it.
   GET /            → health check
   GET /hp?ids=…&debug=1 → also returns the raw HP fields, for checking the maths against the sheet */

const CACHE_SECONDS = 4;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "no-store",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers });
    if (url.pathname !== "/hp") return new Response(JSON.stringify({ ok: true, service: "reditus-hp-relay" }), { headers });

    const debug = url.searchParams.get("debug") === "1";
    const ids = [...new Set((url.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter((s) => /^\d{3,12}$/.test(s)))].slice(0, 12);
    const chars = {};
    await Promise.all(ids.map(async (id) => {
      try { chars[id] = await getChar(id, ctx, debug); }
      catch (e) { chars[id] = { error: String(e && e.message || e) }; }
    }));
    return new Response(JSON.stringify({ t: Date.now(), chars }), { headers });
  },
};

async function getChar(id, ctx, debug) {
  const key = new Request("https://reditus-hp-cache/" + id + (debug ? "?d" : ""));
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit.json();

  const up = await fetch("https://character-service.dndbeyond.com/character/v5/character/" + id, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; ReditusOverlayHP/1.0)" },
  });
  if (up.status === 403 || up.status === 401) return { error: "private", hint: "Set this D&D Beyond sheet's privacy to Public" };
  if (!up.ok) return { error: "ddb " + up.status };
  const j = await up.json();
  const c = j && j.data ? j.data : j;
  if (!c || c.baseHitPoints == null) return { error: "unexpected response" };

  const out = summarise(c, debug);
  const res = new Response(JSON.stringify(out), { headers: { "Cache-Control": "max-age=" + CACHE_SECONDS } });
  ctx.waitUntil(cache.put(key, res));
  return out;
}

function allModifiers(c) {
  const m = c.modifiers || {};
  return [].concat(m.race || [], m.class || [], m.background || [], m.item || [], m.feat || [], m.condition || []);
}

function summarise(c, debug) {
  const level = (c.classes || []).reduce((a, k) => a + (k.level || 0), 0) || 1;
  const mods = allModifiers(c);
  // Constitution score: override > base + bonus + modifiers, then "set" items (e.g. Amulet of Health) if higher
  const pick = (arr, sid) => ((arr || []).find((s) => s.id === sid) || {}).value;
  let con = pick(c.overrideStats, 3);
  if (con == null) {
    con = (pick(c.stats, 3) || 10) + (pick(c.bonusStats, 3) || 0);
    mods.forEach((m) => { if (m.subType === "constitution-score" && m.type === "bonus") con += m.value || 0; });
    mods.forEach((m) => { if (m.subType === "constitution-score" && m.type === "set") con = Math.max(con, m.value || 0); });
  }
  const conMod = Math.floor((con - 10) / 2);
  let perLevel = 0;
  mods.forEach((m) => { if (m.subType === "hit-points-per-level" && m.type === "bonus") perLevel += m.value || 0; });

  const max = c.overrideHitPoints != null
    ? c.overrideHitPoints
    : (c.baseHitPoints || 0) + (c.bonusHitPoints || 0) + conMod * level + perLevel * level;
  const removed = c.removedHitPoints || 0;
  const temp = c.temporaryHitPoints || 0;
  const ds = c.deathSaves || {};
  const out = {
    name: c.name,
    level,
    max,
    current: Math.max(0, max - removed),
    temp,
    deathSaves: { success: ds.successCount || 0, fail: ds.failCount || 0, stable: !!ds.isStabilized },
  };
  if (debug) out.raw = { baseHitPoints: c.baseHitPoints, bonusHitPoints: c.bonusHitPoints, overrideHitPoints: c.overrideHitPoints, removedHitPoints: removed, temporaryHitPoints: temp, con, conMod, perLevel };
  return out;
}
