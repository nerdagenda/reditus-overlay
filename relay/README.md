# Reditus HP relay

A tiny Cloudflare Worker (free plan) that reads each character's hit points from D&D Beyond and hands them to the overlay.

## Deploy (once)
1. Cloudflare dashboard → **Workers & Pages → Create → Worker**, name it `reditus-hp`, Deploy.
2. **Edit code**, replace everything with `worker.js` from this folder, **Deploy**.
3. Copy the worker address (e.g. `https://reditus-hp.<you>.workers.dev`).
4. Control panel → **Show & GM → Live HP bars** → paste it into *HP relay address*.
5. Party tab → paste each player's D&D Beyond sheet link. Each sheet must be set to **Public**
   (sheet → Manage → Character Settings → Character Privacy → Public).
6. Press **Test relay**, then **Publish to stream**.

Check by hand: `https://reditus-hp.<you>.workers.dev/hp?ids=<character id>&debug=1`
