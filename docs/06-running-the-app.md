# 06 - Running The Mobile App

This document explains how to run the Expo mobile app and how it connects to the cloud backend.

## 1. Mobile Env File

Local file:

```text
C:\Project VSC\Tbhon\mobile\.env
```

Production setup (both URLs are Cloudflare tunnel URLs):

```env
EXPO_PUBLIC_API_URL=https://<backend-tunnel>.trycloudflare.com
EXPO_PUBLIC_TB_API_URL=https://<ml-tunnel>.trycloudflare.com
```

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Main backend API for auth, users, screenings, IoT-backed routes (backend droplet, port 4000 behind a tunnel) |
| `EXPO_PUBLIC_TB_API_URL` | ML / inference API for cough or sputum prediction (ML droplet, port 8000 behind a tunnel) |

When both variables point to the Cloudflare tunnels, the app uses the production droplets and the DigitalOcean database.

### Why HTTPS Tunnels, Not Plain IPs

Earlier setups used plain HTTP IPs such as `http://<droplet-ip>:4000`. That works on PC and on Android, but fails on iOS over cellular: multipart uploads silently time out and `raw_data` columns end up `NULL`. The Cloudflare tunnels fix this — see `08-cloudflare-tunnels.md`.

### How To Find The Current Tunnel URLs

Quick tunnels generate a new random URL whenever `cloudflared` restarts (including droplet reboots).

**Automatic (recommended)** — from repo root on your PC:

```bash
npm run tunnel:sync
```

SSH reads `journalctl` on both droplets and merges fresh `EXPO_PUBLIC_*` lines into `mobile/.env` (keeps `EXPO_PUBLIC_IOT_API_KEY` and other keys). Then restart Expo: `cd mobile && npx expo start -c`.

Alternatives:

| Command | When to use |
| --- | --- |
| `npm run tunnel:droplets` | No SSH; starts local cloudflared proxies to droplet IPs and writes `.env` |
| `npm run tunnel:refresh` | Tunnels already running locally; re-read `infra/cloudflare/tunnel-*.err.log` |

**Manual fallback:**

```bash
ssh root@<backend-droplet-ip> "journalctl -u tbhon-backend-tunnel -n 30 --no-pager | grep trycloudflare"
ssh root@<ml-droplet-ip>      "journalctl -u tbhon-ml-tunnel -n 30 --no-pager | grep trycloudflare"
```

The full reboot recovery flow is in `09-droplet-power-management.md`, Section 4.

## 2. Install Mobile Dependencies

Run on your Windows PC:

```bash
cd "C:\Project VSC\Tbhon\mobile"
npm install
```

## 3. Start Expo In LAN Mode

Use this when your phone and PC are on the same Wi-Fi:

```bash
cd "C:\Project VSC\Tbhon\mobile"
npx expo start -c
```

The `-c` flag clears Metro cache.

Open Expo Go on your phone and scan the QR code.

## 4. Start Expo In Tunnel Mode

Use this when your phone and PC are not on the same Wi-Fi:

```bash
cd "C:\Project VSC\Tbhon\mobile"
npx expo start -c --tunnel
```

Tunnel mode lets Expo Go load the development bundle over the internet.

## 5. Existing NPM Scripts

From `C:\Project VSC\Tbhon\mobile`:

```bash
npm run start
npm run start:tunnel
npm run start:lan
npm run android
npm run web
npm run lint
```

Current scripts:

| Script | Command |
| --- | --- |
| `npm run start` | `expo start` |
| `npm run start:tunnel` | `expo start --tunnel` |
| `npm run start:lan` | `expo start --lan` |
| `npm run android` | `expo start --android` |
| `npm run web` | `expo start --web` |

For cache clearing, use `npx expo start -c` or `npx expo start -c --tunnel`.

## 6. Same Wi-Fi Rule

There are two separate connections:

1. Expo Go loading the app from your PC.
2. The app calling the backend API.

| Connection | Same Wi-Fi Required? |
| --- | --- |
| Expo Go + `npx expo start -c` LAN mode | Usually yes |
| Expo Go + `npx expo start -c --tunnel` | No |
| API calls to `https://<backend-tunnel>.trycloudflare.com` | No, internet is enough |
| API calls to `https://<ml-tunnel>.trycloudflare.com` | No, internet is enough |

The cloud backend does not require your phone and PC to be on the same Wi-Fi.

## 7. Restart After Env Changes

After editing `mobile/.env`, restart Expo:

```bash
Ctrl + C
npx expo start -c
```

or:

```bash
Ctrl + C
npx expo start -c --tunnel
```

## 8. Verify Backend Before App Testing

In a browser or PowerShell:

```text
https://<backend-tunnel>.trycloudflare.com/health
```

Expected:

```json
{"status":"ok"}
```

For the ML API:

```text
https://<ml-tunnel>.trycloudflare.com/healthz
```

Expected:

```json
{"ok":true}
```

If either does not work, fix the matching tunnel before testing the app. See `08-cloudflare-tunnels.md`.

## 9. Login And Database Notes

The app does not read MySQL directly.

```text
Mobile app
  -> Backend API
  -> Prisma
  -> DigitalOcean MySQL
```

If login says the email/password is incorrect:

- The user may not exist in DigitalOcean MySQL.
- The local PC database may contain the account, but the cloud database may not.
- Registering a new account writes directly to the cloud database when `EXPO_PUBLIC_API_URL` points to the droplet.

## 10. ML API Note

`EXPO_PUBLIC_TB_API_URL` is separate from the main backend API. It points to the ML droplet's Cloudflare tunnel.

The mobile screening flow needs the ML tunnel for:

- `POST /check-quality` — green / amber cough quality badge after each clip
- `POST /predict` — TB probability after all 3 coughs
- `POST /predict-phlegm` — sputum AFB-load classification

If only `EXPO_PUBLIC_API_URL` is configured, the app can still log in, view history, and persist screening **metadata**, but the actual cough analysis and quality badges will not work.

See `07-ml-droplet-setup.md` for the ML droplet itself and `08-cloudflare-tunnels.md` for its tunnel.
