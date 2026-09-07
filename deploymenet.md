# 🖥️ IB Frontend — Server Access & Deployment Guide

> **Status:** deployed and live at **https://partner.bytefx.com**
> (first deployed 2026-08-17)

---

## ⚠️ The one thing you must understand first

**The portal and the API share a hostname and a server.**

`partner.bytefx.com` is a single Apache vhost that does two jobs:

```
https://partner.bytefx.com/            →  static SPA   (/var/www/ib_portal/dist)
https://partner.bytefx.com/api/...     →  FastAPI      (127.0.0.1:8010, uvicorn)
```

Before this deploy, that vhost proxied **everything** to the API. The deploy
took over `/` and left the API's paths proxied. **If you ever rewrite this
vhost and forget the `ProxyPass` lines, you take the API down** — and with it
the portal, plus anything else calling that API.

This is safe only because the backend claims a clean set of paths:

- all **204** of its documented routes live under `/api` (verified from
  `openapi.json`, not assumed)
- FastAPI additionally serves `/docs`, `/redoc`, `/openapi.json`
- there is a `/health` check
- **`/` returns 404** on the backend — nothing was displaced by the SPA

A useful side effect of sharing the origin: **there is no CORS to configure.**

---

## What this project is

A static single-page app — built HTML, JS, and CSS. It has **no** backend
process of its own:

| The Django/FastAPI projects on this box need | IB Frontend needs |
| --- | --- |
| Python venv, `requirements.txt` | ❌ none |
| MySQL database + migrations | ❌ none |
| gunicorn / uvicorn + a `systemd` service | ❌ none |
| A port of its own (8000/8002/8003/8010) | ❌ none |
| `ProxyPass` for **its own** backend | ❌ none |

The `ProxyPass` lines in its vhost belong to the **pre-existing API**, not to
this project. Nothing here starts, restarts, or monitors a service.

---

## Server details

| Detail | Value |
| --- | --- |
| IP | `157.245.201.61` |
| OS | Ubuntu 24.04.4 LTS |
| Web server | Apache 2.4.58 (Nginx installed but disabled) |
| Node.js | v20.20.2 |
| Portal files | `/var/www/ib_portal/dist` |
| vhost | `/etc/apache2/sites-available/001-partner.bytefx.com-le-ssl.conf` |
| API backend | `atlas.service` — uvicorn on `127.0.0.1:8010` (**not** managed by this project) |

The API is `atlas.service` ("ByteFX ATLAS FastAPI Backend"), with
`atlas-celery-worker` and `atlas-celery-beat` alongside it. Deploying the
portal never touches any of them — if the API is down, that is a separate
problem with a separate owner.

```bash
ssh root@157.245.201.61
```

---

## Read before you touch anything

1. **This server hosts other live sites** — `crm.infokatta.com`,
   `crm.tradingkatta.com`, `rewards.bytefx.com`, `mtkitservice.com` and more.
   A broken vhost takes down every site on the box. **Always** run
   `apache2ctl configtest` before `systemctl reload apache2`.
2. **Never `pkill`.** It kills other projects' processes. This project has
   none, so you never need to.
3. **Mock preview is ON in this build, deliberately** — it is a review
   deployment. Anyone signed in can toggle **generated sample data over the
   Dashboard and Reports screens**; a loud "MOCK PREVIEW" banner shows while it
   is active, but a figure on those screens is not necessarily real.

   **Before real partners use the portal:** set
   `VITE_ENABLE_MOCK_PREVIEW=false` in `.env.production`, rebuild, redeploy.
   The value is compiled into the bundle — editing anything on the server does
   nothing.
4. **The port-80 vhost is deliberately untouched.** It already 301s to HTTPS,
   so its `ProxyPass` is dead config. Left alone to keep the diff minimal.

---

## Redeploying (the normal case)

```bash
cd Atlas/IB_Frontend
npm run build          # reads .env.production

tar -czf - -C dist . | ssh root@157.245.201.61 \
  'rm -rf /var/www/ib_portal/dist.new && mkdir -p /var/www/ib_portal/dist.new \
   && tar -xzf - -C /var/www/ib_portal/dist.new \
   && rm -rf /var/www/ib_portal/dist.prev \
   && mv /var/www/ib_portal/dist /var/www/ib_portal/dist.prev \
   && mv /var/www/ib_portal/dist.new /var/www/ib_portal/dist \
   && chown -R www-data:www-data /var/www/ib_portal'
```

**No Apache reload. No service restart.** Files are served straight off disk.

The swap is staged through `dist.new` so a failed upload never leaves a
half-written site live, and the previous build is kept as `dist.prev`.

### Instant revert to the previous build

```bash
ssh root@157.245.201.61 \
  'rm -rf /var/www/ib_portal/dist && mv /var/www/ib_portal/dist.prev /var/www/ib_portal/dist \
   && chown -R www-data:www-data /var/www/ib_portal'
```

---

## Verifying a deploy

Run these after every deploy. The first two matter most — they prove the SPA
did **not** swallow the API.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://partner.bytefx.com/api/v1/clients   # 401  (alive, auth required)
curl -s -o /dev/null -w "%{http_code}\n" https://partner.bytefx.com/docs             # 200
curl -s -o /dev/null -w "%{http_code}\n" https://partner.bytefx.com/health           # 200
curl -s -o /dev/null -w "%{http_code}\n" https://partner.bytefx.com/                 # 200  (SPA)
curl -s -o /dev/null -w "%{http_code}\n" https://partner.bytefx.com/clients          # 200  (deep link → index.html)
```

A **404 on `/api/v1/clients` means the SPA fallback ate the API** — restore the
vhost backup immediately (below).

---

## The vhost

Live at `/etc/apache2/sites-available/001-partner.bytefx.com-le-ssl.conf`.
The shape that matters:

```apache
DocumentRoot /var/www/ib_portal/dist

# These five prefixes stay with the API. Matched before the document root, so
# they never reach the filesystem and can never hit the SPA fallback.
ProxyPass        /api/          http://127.0.0.1:8010/api/  ... upgrade=websocket
ProxyPassReverse /api/          http://127.0.0.1:8010/api/
#   ... and /docs, /redoc, /openapi.json, /health

<Directory /var/www/ib_portal/dist>
    # React Router owns every remaining path: anything that is not a real file
    # returns index.html, or a refresh on /clients 404s.
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</Directory>

# Vite content-hashes asset filenames, so they cache forever. index.html must
# not, or a returning user keeps booting the previous bundle.
```

Requires `rewrite`, `headers`, `proxy_http`, `proxy_wstunnel` — all already
enabled.

### Restoring the pre-deploy vhost

```bash
ssh root@157.245.201.61 \
  'cp /root/vhost-backup-20260817-125259/001-partner.bytefx.com-le-ssl.conf \
      /etc/apache2/sites-available/ && apache2ctl configtest && systemctl reload apache2'
```

That returns `partner.bytefx.com` to proxying everything to the API, i.e. the
portal disappears but the API is untouched.

---

## Environment flags

`npm run build` reads `.env.production`, which overrides the local `.env`.
Values are **compiled into the bundle** — changing them on the server has no
effect; you must rebuild.

| Variable | Production value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://partner.bytefx.com/api/v1` |
| `VITE_WS_BASE_URL` | `wss://partner.bytefx.com` |
| `VITE_WS_ROUTE` | *(empty — WebSocket is disabled)* |
| `VITE_ENABLE_MOCK_PREVIEW` | `true` ⚠️ review build |
| `VITE_ENABLE_DEMO_AUTH` | `false` |

To confirm which way a flag compiled in, flip it, rebuild, and check the asset
hash changed — a different hash proves the flag reached the bundle.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| **`/api/...` returns 404 + HTML** | **SPA fallback ate the API.** `ProxyPass` lines missing from the vhost — restore the backup |
| `/api/...` returns 502 | uvicorn on `:8010` is down. Not this project — check whoever owns the API |
| Blank page, 404s on `/assets/*` | `DocumentRoot` not pointing at `dist/` |
| Works on `/`, 404 on refresh at `/clients` | SPA rewrite missing, or `rewrite` module disabled |
| Old version persists after deploy | `index.html` was cached — check the `Cache-Control` `FilesMatch` blocks |
| Dashboard/Reports figures look invented | Mock preview is on and someone toggled it. Expected for this review build — look for the banner |

---

## First-time deploy checklist (already done — kept for reference)

- [x] DNS: `partner.bytefx.com` → `157.245.201.61`
- [x] SSL already present (`/etc/letsencrypt/live/partner.bytefx.com/`)
- [x] Confirmed backend serves nothing at `/` and everything under `/api`
- [x] Backed up the live vhost before editing
- [x] `dist/` uploaded, owned by `www-data`
- [x] `apache2ctl configtest` passed, Apache reloaded
- [x] API, `/docs`, `/health`, SPA root, and deep links all verified
- [x] Other sites on the box confirmed still up

### Still outstanding

- [ ] `VITE_ENABLE_MOCK_PREVIEW=false`, rebuild, redeploy — before real partners
- [ ] Rotate the MySQL root password (shared in chat; this project never used it)
