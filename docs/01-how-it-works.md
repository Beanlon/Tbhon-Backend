# 01 - How The Cloud Setup Works

## High-Level Flow

```text
Phone / Expo app
  -> EXPO_PUBLIC_API_URL  (https://<backend-tunnel>.trycloudflare.com)
  -> Cloudflare edge
  -> cloudflared on backend droplet
  -> Node/Express backend  (PM2 on localhost:4000)
  -> Prisma
  -> DigitalOcean Managed MySQL

Phone / Expo app
  -> EXPO_PUBLIC_TB_API_URL  (https://<ml-tunnel>.trycloudflare.com)
  -> Cloudflare edge
  -> cloudflared on ML droplet
  -> Python/FastAPI inference API  (systemd on localhost:8000)
  -> Cough model.pt / phlegm model_best.pt
```

The phone never connects directly to MySQL or to either droplet's IP. It only calls the two Cloudflare tunnel URLs.

## What Lives Where

| Component | Location | Notes |
| --- | --- | --- |
| Mobile app source code | Local PC, `C:\Project VSC\Tbhon\mobile` | Runs with Expo during development |
| Expo Metro server | Local PC | Serves the dev JavaScript bundle to Expo Go |
| Backend source code | Backend droplet, `~/Tbhon-Backend` | Cloned from GitHub |
| Backend runtime | Backend droplet, PM2 process | Runs `dist/server.js` on `localhost:4000` |
| Backend tunnel | Backend droplet, systemd `tbhon-backend-tunnel` | `cloudflared` forwards from Cloudflare to `localhost:4000` |
| Database | DigitalOcean Managed MySQL | Separate service from the droplets |
| Production backend `.env` | Backend droplet, `~/Tbhon-Backend/.env` | Holds `DATABASE_URL`, `JWT_SECRET`, `IOT_API_KEY` |
| ML source code | ML droplet, `~/Tbhon` | Cloned from the same GitHub repo as the mobile app |
| ML runtime | ML droplet, systemd `tbhon-ml` | Runs `uvicorn ml.infer_api:app` on `localhost:8000` |
| ML tunnel | ML droplet, systemd `tbhon-ml-tunnel` | `cloudflared` forwards from Cloudflare to `localhost:8000` |
| Cough model weights | ML droplet, `~/Tbhon/ml/runs/<run>/model.pt` | Path is set via `TB_MODEL_PATH` env var |
| Phlegm model weights | ML droplet, `~/Tbhon/ml_phlegm/runs/<run>/model_best.pt` | Path is set via `TB_PHLEGM_MODEL_PATH` env var |

## Two Droplets, Two Roles

```text
Backend droplet
  -> Linux OS
  -> ~/Tbhon-Backend  (Node, Prisma, ts -> dist)
  -> PM2 keeps dist/server.js alive on port 4000
  -> cloudflared tunnel exposes it as HTTPS

ML droplet
  -> Linux OS
  -> ~/Tbhon  (Python venv, ml/infer_api.py)
  -> systemd keeps uvicorn alive on port 8000
  -> cloudflared tunnel exposes it as HTTPS
```

Neither droplet stores the database. MySQL is a separate Managed MySQL service. The backend droplet connects to it; the ML droplet does not.

## Why Cloudflare Tunnels

Without the tunnels the mobile app would talk to `http://<droplet-ip>:4000` and `http://<droplet-ip>:8000` directly. That works from PowerShell and from Android, but it **fails on iOS over cellular**:

- iOS `URLSession` silently drops multipart POSTs to plain HTTP non-domain URLs.
- PH cellular carriers (Globe, Smart, DITO) routinely block non-standard ports such as `:8000`.

The tunnels expose both APIs as `https://*.trycloudflare.com` on port 443, which iOS and cellular carriers treat as normal HTTPS. See `08-cloudflare-tunnels.md` for details.

## Backend And Database Relationship

The backend reads `~/Tbhon-Backend/.env` when it starts.

```env
DATABASE_URL="mysql://doadmin:<password>@<do-mysql-host>:25060/defaultdb?sslaccept=verify_ca&sslcert=/root/Tbhon-Backend/certs/ca-certificate.crt"
PORT=4000
JWT_SECRET="..."
JWT_EXPIRES_IN="7d"
IOT_API_KEY="..."
```

Request lifecycle:

1. Phone calls a route on the backend tunnel URL, for example `/auth/login`.
2. Cloudflare forwards it through `cloudflared` to `localhost:4000` on the backend droplet.
3. Express receives the request, the controller calls Prisma.
4. Prisma uses `DATABASE_URL` to query MySQL.
5. The response travels back through the same tunnel to the phone.

## ML Pipeline

When the phone screens a cough:

1. Phone records 3 cough clips locally.
2. After each clip, phone POSTs to `/check-quality` on the ML tunnel URL (multipart `file`).
3. ML droplet runs `cough_authenticity_metrics` and returns a green / amber badge label.
4. After all 3 clips, phone POSTs each one to `/predict` on the ML tunnel.
5. ML droplet runs the audio through the CNN and returns `prob_tb` / `prob_no_tb`.
6. Phone also POSTs each cough's raw bytes to the **backend** tunnel so the recording is stored in MySQL (`cough_recordings.raw_data`).

The same idea applies to sputum images: `/predict-phlegm` on the ML tunnel + raw upload on the backend tunnel.

## Network Rules

For the system to work end-to-end:

- The backend droplet's `cloudflared` connects outbound to Cloudflare on port 443.
- The ML droplet's `cloudflared` connects outbound to Cloudflare on port 443.
- The DigitalOcean MySQL Trusted Sources must include the backend droplet's IP.
- The mobile `.env` must hold both current `*.trycloudflare.com` URLs.

The droplets do **not** need their public ports exposed to the public internet for production traffic — the tunnel is outbound. Port 22 (SSH) and the local API ports are still useful during initial setup and debugging.

## Development Versus Production Env

There are two backend `.env` files:

| File | Used When |
| --- | --- |
| Local `C:\Project VSC\Tbhon-Backend\.env` | You run `npm run dev` on your Windows PC |
| Droplet `~/Tbhon-Backend/.env` | PM2 runs the production backend on the droplet |

If the mobile app points to the **production tunnel URL**, the local backend `.env` is not used.

## Expo Networking

`npx expo start -c` starts Metro on your PC. In LAN mode, the phone and PC must usually be on the same Wi-Fi. In tunnel mode, they do not.

```bash
npx expo start -c
npx expo start -c --tunnel
```

The Expo tunnel only carries the development JavaScript bundle. It is unrelated to the Cloudflare tunnels — those carry the actual API traffic and use `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_TB_API_URL`.
