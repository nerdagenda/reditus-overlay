# Reditus HP relay

A tiny Cloudflare Worker (free plan) that reads each character's hit points from D&D Beyond, and stores battle mode + manual HP overrides from the control panel.

## Deploy (once)
1. Cloudflare → **Workers & Pages → Create → Worker** named `reditus-hp` → Deploy.
2. **Edit code** → paste `worker.js` → Deploy.
3. **Storage & Databases → Workers KV → Create** a namespace `reditus-hp`.
4. Worker → **Settings → Bindings → Add → KV namespace**: variable name `HP`, namespace `reditus-hp`.
5. Worker → **Settings → Variables and Secrets → Add → Secret**: name `ADMIN_KEY`, a long random value. That's the *relay key* for the control panel.
6. Control panel → Show & GM → paste the worker address; Battle / HP → paste the relay key; Party → paste each D&D Beyond link (sheets set to Public). Publish.

Check: `https://reditus-hp.<you>.workers.dev/` → `{"ok":true,"kv":true,"key":true}`
