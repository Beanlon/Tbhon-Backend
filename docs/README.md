# TBhon Deployment Documentation

This folder documents the current DigitalOcean setup for TBhon.

## Documents

- [01 - How The Cloud Setup Works](./01-how-it-works.md)
- [02 - Backend Droplet Setup](./02-backend-droplet-setup.md)
- [03 - Managed MySQL Database Setup](./03-database-setup.md)
- [04 - Local To Cloud Data Copy](./04-data-copy.md)
- [05 - Droplet Operations And Updates](./05-droplet-operations.md)
- [06 - Running The Mobile App](./06-running-the-app.md)
- [07 - ML Droplet Setup](./07-ml-droplet-setup.md)
- [08 - Cloudflare Tunnels For Both Droplets](./08-cloudflare-tunnels.md)
- [09 - Droplet Power Management](./09-droplet-power-management.md)

## Current Production Shape

```text
Expo mobile app
  -> EXPO_PUBLIC_API_URL  (https://<backend-tunnel>.trycloudflare.com)
  -> Cloudflare edge
  -> tbhon-backend-tunnel  (cloudflared on backend droplet)
  -> Node/Express backend  (PM2, localhost:4000)
  -> DigitalOcean Managed MySQL

Expo mobile app
  -> EXPO_PUBLIC_TB_API_URL  (https://<ml-tunnel>.trycloudflare.com)
  -> Cloudflare edge
  -> tbhon-ml-tunnel  (cloudflared on ML droplet)
  -> Python/FastAPI inference API  (systemd, localhost:8000)
  -> Local model files (model.pt, model_best.pt)
```

The phone never connects directly to MySQL. It only calls the backend API. The backend talks to MySQL via Prisma. The ML API is a separate Python service on a separate droplet.

Both droplets sit behind Cloudflare Tunnels because iOS over cellular cannot reliably perform multipart uploads to plain HTTP IP addresses. See [08 - Cloudflare Tunnels](./08-cloudflare-tunnels.md).

## Two Droplets

| Droplet | Public IP example | Local port | Process supervisor |
| --- | --- | --- | --- |
| Backend (`tbhon-backend`) | `159.223.42.179` | `4000` | PM2 |
| ML (`tbhon-ml`) | `152.42.170.30` | `8000` | systemd |

Both also run a `cloudflared` quick tunnel under systemd:

| Tunnel service | Forwards to | Mobile env var |
| --- | --- | --- |
| `tbhon-backend-tunnel` | `localhost:4000` | `EXPO_PUBLIC_API_URL` |
| `tbhon-ml-tunnel` | `localhost:8000` | `EXPO_PUBLIC_TB_API_URL` |

## Important File Locations

| File | Machine | Purpose |
| --- | --- | --- |
| `~/Tbhon-Backend/.env` | Backend droplet | Production backend config and cloud DB connection |
| `~/Tbhon-Backend/certs/ca-certificate.crt` | Backend droplet | MySQL TLS CA bundle |
| `~/Tbhon` | ML droplet | Python venv + ML inference code |
| `~/Tbhon/ml/runs/<run>/model.pt` | ML droplet | Cough TB model weights |
| `~/Tbhon/ml_phlegm/runs/<run>/model_best.pt` | ML droplet | Sputum AFB-load model weights |
| `/etc/systemd/system/tbhon-ml.service` | ML droplet | ML API systemd unit |
| `/etc/systemd/system/tbhon-ml-tunnel.service` | ML droplet | ML Cloudflare tunnel systemd unit |
| `/etc/systemd/system/tbhon-backend-tunnel.service` | Backend droplet | Backend Cloudflare tunnel systemd unit |
| `C:\Project VSC\Tbhon-Backend\.env` | Local Windows PC | Local backend development config |
| `C:\Project VSC\Tbhon\mobile\.env` | Local Windows PC | Mobile app public API URLs (now both HTTPS tunnel URLs) |

Do not commit `.env` files, database passwords, or model checkpoints.

## Quick Reference

| I want to... | Go to |
| --- | --- |
| Set up the backend droplet for the first time | [02](./02-backend-droplet-setup.md) |
| Set up the ML droplet for the first time | [07](./07-ml-droplet-setup.md) |
| Set up the Managed MySQL database | [03](./03-database-setup.md) |
| Push backend code changes to production | [05](./05-droplet-operations.md) |
| Update / replace model files | [07 §14](./07-ml-droplet-setup.md) |
| Add or refresh a Cloudflare tunnel | [08](./08-cloudflare-tunnels.md) |
| Run the mobile app against production | [06](./06-running-the-app.md) |
| Power a droplet off / back on | [09](./09-droplet-power-management.md) |
| Recover after a droplet reboot | [09 §4](./09-droplet-power-management.md) |
