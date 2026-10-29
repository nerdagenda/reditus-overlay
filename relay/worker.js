/* Reditus HP relay — a Cloudflare Worker.
   The overlay asks:   GET /hp?ids=12345678,23456789
   The relay fetches each character's D&D Beyond sheet data (sheets must be set to Public),
   keeps only the hit-point numbers, caches them for a few seconds, and answers with CORS
   headers so the overlay (on GitHub Pages / OBS) is allowed to read it.
   GET /            → health check
   GET /hp?ids=…&debug=1 → also returns the raw HP fields, for checking the maths against the sheet

   Battle mode + manual HP (optional, needs a KV namespace bound as HP and a secret ADMIN_KEY):
   POST /state  (header  Authorization: Bearer <ADMIN_KEY>)
     { "battle": true }                                   → bars on / off (every screen except the battle map)
     { "mapBars": false }                                 → bars on / off on the battle map only (default on)
     { "manual": { "felix": { "current": 40, "temp": 0 } } } → override one character's HP
     { "manual": { "felix": null } }                       → back to D&D Beyond
   GET /hp also returns { battle, manual } so the overlay picks changes up on its next check. */

const CACHE_SECONDS = 4;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store",
    };
    const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers });
    if (req.method === "OPTIONS") return new Response(null, { headers });

    if (url.pathname === "/state" && req.method === "POST") {
      if (!env.HP) return json({ error: "no KV namespace bound as HP" }, 500);
      if (!env.ADMIN_KEY || req.headers.get("Authorization") !== "Bearer " + env.ADMIN_KEY) return json({ error: "wrong key" }, 401);
      let body; try { body = await req.json(); } catch (e) { return json({ error: "bad json" }, 400); }
      const st = await readState(env);
      if (typeof body.battle === "boolean") st.battle = body.battle;
      if (typeof body.mapBars === "boolean") st.mapBars = body.mapBars;
      // conversation scene pair: { talk: { a: "trey", b: "gm" } }
      if (body.talk && typeof body.talk === "object") {
        const ok = (v) => typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : "";
        st.talk = { a: ok(body.talk.a), b: ok(body.talk.b) };
      }
      // "Go live": { golive: { scene: "talk" } } → the overlay on screen in OBS switches OBS to that scene (once per press)
      if (body.golive && typeof body.golive === "object") {
        const sc = String(body.golive.scene || "").toLowerCase();
        if (/^(main|spotlight|talk|map|gm|intro|break)$/.test(sc)) st.golive = { scene: sc, focus: /^[\w-]{1,40}$/.test(body.golive.focus || "") ? body.golive.focus : "", id: Date.now() };
      }
      // manual conditions set by the DM: { conditions: { felix: ["banished", {id:"exhaustion",level:2}] } }  (null clears)
      if (body.conditions && typeof body.conditions === "object") {
        st.conditions = st.conditions || {};
        Object.keys(body.conditions).slice(0, 20).forEach((k) => {
          const v = body.conditions[k];
          if (!/^[\w-]{1,40}$/.test(k)) return;
          if (!v || !Array.isArray(v) || !v.length) { delete st.conditions[k]; return; }
          st.conditions[k] = v.slice(0, 20).map((x) => typeof x === "string" ? x.slice(0, 24) : { id: String(x.id || "").slice(0, 24), level: x.level != null ? Math.max(0, Math.min(6, +x.level || 0)) : undefined }).filter((x) => x && (x.id || typeof x === "string"));
        });
      }
      if (body.manual && typeof body.manual === "object") {
        Object.keys(body.manual).slice(0, 20).forEach((k) => {
          const v = body.manual[k];
          if (!/^[\w-]{1,40}$/.test(k)) return;
          if (v === null) delete st.manual[k];
          else st.manual[k] = { current: Math.max(0, Math.round(+v.current || 0)), temp: Math.max(0, Math.round(+v.temp || 0)), max: v.max != null ? Math.max(1, Math.round(+v.max)) : undefined };
        });
      }
      st.updated = Date.now();
      await env.HP.put("state", JSON.stringify(st));
      return json({ ok: true, state: st });
    }

    if (url.pathname === "/sheet") {
      const id = (url.searchParams.get("id") || "").match(/(\d{3,12})/);
      if (!id) return json({ error: "no character id" }, 400);
      const up = await fetch("https://character-service.dndbeyond.com/character/v5/character/" + id[1], {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; ReditusOverlayHP/1.0)" },
      });
      if (up.status === 403 || up.status === 401) return json({ error: "private", hint: "Set this D&D Beyond sheet's privacy to Public" }, 403);
      if (!up.ok) return json({ error: "ddb " + up.status }, 502);
      const j = await up.json();
      return json(sheetInfo(j && j.data ? j.data : j, id[1]));
    }

    if (url.pathname !== "/hp") return json({ ok: true, service: "reditus-hp-relay", kv: !!env.HP, key: !!env.ADMIN_KEY });

    const debug = url.searchParams.get("debug") === "1";
    const ids = [...new Set((url.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter((s) => /^\d{3,12}$/.test(s)))].slice(0, 12);
    const chars = {};
    const stP = env.HP ? readState(env) : Promise.resolve(null);
    await Promise.all(ids.map(async (id) => {
      try { chars[id] = await getChar(id, ctx, debug); }
      catch (e) { chars[id] = { error: String(e && e.message || e) }; }
    }));
    const st = await stP;
    return json({ t: Date.now(), battle: st ? !!st.battle : null, mapBars: st ? st.mapBars !== false : null, conditions: st ? st.conditions || {} : {}, talk: st ? st.talk || null : null, golive: st ? st.golive || null : null, manual: st ? st.manual : {}, chars });
  },
};

async function readState(env) {
  let st = null;
  try { st = await env.HP.get("state", { type: "json" }); } catch (e) {}
  st = st || {};
  st.manual = st.manual || {};
  return st;
}

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
  // D&D Beyond condition ids → names (exhaustion keeps its level)
  const COND = { 1: "blinded", 2: "charmed", 3: "deafened", 4: "exhaustion", 5: "frightened", 6: "grappled", 7: "incapacitated", 8: "invisible", 9: "paralyzed", 10: "petrified", 11: "poisoned", 12: "prone", 13: "restrained", 14: "stunned", 15: "unconscious" };
  const conditions = (c.conditions || []).map((k) => COND[k.id] ? (k.id === 4 ? { id: "exhaustion", level: k.level || 1 } : COND[k.id]) : null).filter(Boolean);
  const out = {
    conditions,
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

/* Whole-sheet summary for the control panel's "Import from D&D Beyond" button.
   AC is a best-effort calculation (armour + DEX + shield + item/feat bonuses), so it's worth a glance against the sheet. */
function sheetInfo(c, id) {
  const STAT = ["str", "dex", "con", "int", "wis", "cha"], NAMES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
  const inv = c.inventory || [];
  const active = new Set(inv.filter((i) => i.equipped && i.definition && (!i.definition.canAttune || i.isAttuned)).map((i) => i.definition.id));
  const mm = c.modifiers || {};
  const mods = [].concat(mm.race || [], mm.class || [], mm.background || [], mm.feat || [], mm.condition || [],
    (mm.item || []).filter((m) => active.has(m.componentId)));
  const pick = (arr, sid) => ((arr || []).find((s) => s.id === sid) || {}).value;
  const stats = {};
  STAT.forEach((k, i) => {
    const sid = i + 1, o = pick(c.overrideStats, sid);
    let v = o != null ? o : (pick(c.stats, sid) || 10) + (pick(c.bonusStats, sid) || 0);
    if (o == null) {
      mods.forEach((m) => { if (m.type === "bonus" && m.subType === NAMES[i] + "-score") v += m.value || 0; });
      mods.forEach((m) => { if (m.type === "set" && m.subType === NAMES[i] + "-score") v = Math.max(v, m.value || 0); });
    }
    stats[k] = v;
  });
  const mod = (k) => Math.floor((stats[k] - 10) / 2);
  const level = (c.classes || []).reduce((a, k) => a + (k.level || 0), 0) || 1;
  const worn = inv.filter((i) => i.equipped && i.definition && i.definition.armorTypeId);
  const body = worn.filter((i) => i.definition.armorTypeId !== 4).sort((a, b) => (b.definition.armorClass || 0) - (a.definition.armorClass || 0))[0];
  const shield = worn.find((i) => i.definition.armorTypeId === 4);
  let ac;
  if (body) {
    const t = body.definition.armorTypeId, d = mod("dex");
    ac = body.definition.armorClass + (t === 1 ? d : t === 2 ? Math.min(d, 2) : 0);
  } else {
    ac = 10 + mod("dex");
    mods.forEach((m) => { if (m.type === "set" && m.subType === "unarmored-armor-class" && m.statId) ac += mod(STAT[m.statId - 1]); });
  }
  if (shield) ac += shield.definition.armorClass || 2;
  mods.forEach((m) => {
    if (m.type !== "bonus") return;
    if (m.subType === "armor-class" || m.subType === "dual-wield-armor-class") ac += m.value || 0;
    if (m.subType === "armored-armor-class" && body) ac += m.value || 0;
    if (m.subType === "unarmored-armor-class" && !body) ac += m.value || 0;
  });
  let perLevel = 0;
  mods.forEach((m) => { if (m.subType === "hit-points-per-level" && m.type === "bonus") perLevel += m.value || 0; });
  const hp = c.overrideHitPoints != null ? c.overrideHitPoints : (c.baseHitPoints || 0) + (c.bonusHitPoints || 0) + (mod("con") + perLevel) * level;
  const cls = (c.classes || []).slice().sort((a, b) => (b.level || 0) - (a.level || 0)).map((k) => k.definition && k.definition.name).filter(Boolean).join(" / ");
  return {
    id, name: c.name || "", race: (c.race && (c.race.fullName || c.race.baseName)) || "", cls, level, ac, hp, stats,
    avatar: (c.decorations && c.decorations.avatarUrl) || "",
  };
}
