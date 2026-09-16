# VOLTCORE PHOSPHOR

Lattice oscilloscope UI for the Dual-Rail mesh.

- **UI host:** Vercel (this repo). No secrets.
- **Data plane:** Cloudflare Worker `core-api` (`https://core-api.dominic-calandro1991.workers.dev`).

Do not add Vercel env vars. Worker secrets stay on Cloudflare.
