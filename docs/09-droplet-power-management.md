# 09 - Droplet Power Management

This document explains how to safely power droplets off when you want to save money, how to power them back on, and what to do after a reboot so the mobile app keeps working.

There are two droplets:

| Droplet | Public IP (example) | Port | Runs |
| --- | --- | --- | --- |
| Backend | `159.223.42.179` | `4000` | Node/Express + Prisma + PM2, plus `tbhon-backend-tunnel` |
| ML | `152.42.170.30` | `8000` | Python/FastAPI + `systemd`, plus `tbhon-ml-tunnel` |

## 1. Why Powering Off Matters

DigitalOcean charges hourly for droplets even when they are idle, **as long as they exist**. Powering a droplet off from inside Linux (`sudo poweroff`) does **not** stop billing. To stop charges you must either:

- Use the DigitalOcean panel **Power -> Power Off** action (still billed, smaller savings), or
- **Destroy** the droplet entirely (no more charges, but the data is gone)

For long pauses, save what you need and destroy. For short pauses (a few hours / a day), Power Off is acceptable.

## 2. Powering Off A Droplet

### 2.1. The Clean Way (Recommended)

SSH in first and stop services in the correct order so nothing is left mid-write.

#### Backend droplet

```bash
ssh root@<backend-droplet-ip>
sudo systemctl stop tbhon-backend-tunnel
pm2 stop tbhon-backend
sudo poweroff
```

#### ML droplet

```bash
ssh root@<ml-droplet-ip>
sudo systemctl stop tbhon-ml-tunnel
sudo systemctl stop tbhon-ml
sudo poweroff
```

The SSH session disconnects automatically when the droplet starts powering down.

### 2.2. The DigitalOcean Panel Way

1. Open the droplet on the DigitalOcean panel.
2. Top right -> **Power** toggle -> **Power off**.
3. Wait ~30 seconds for the droplet status to flip from green to gray.

This sends a clean shutdown signal to the droplet, then forces it off if it does not respond. Use this if you cannot SSH in.

## 3. Powering A Droplet Back On

### 3.1. From The DigitalOcean Panel

1. Open the droplet.
2. **Power** toggle -> **Turn On**.
3. Wait ~30-60 seconds. The status flips back to green.

Both droplets are configured to start their key services at boot:

| Droplet | Auto-starts on boot |
| --- | --- |
| Backend | PM2 + `tbhon-backend-tunnel` (systemd) |
| ML | `tbhon-ml` (systemd) + `tbhon-ml-tunnel` (systemd) |

### 3.2. PM2 On The Backend Droplet

PM2 only auto-resurrects processes that were saved before the reboot. The original setup ran `pm2 save` so this is already in place, but verify after reboot:

```bash
ssh root@<backend-droplet-ip>
pm2 status
```

If `tbhon-backend` is missing or stopped:

```bash
cd ~/Tbhon-Backend
pm2 start dist/server.js --name tbhon-backend
pm2 save
```

## 4. Post-Reboot Checklist

Every time **either** droplet has been powered off and back on, run through this checklist to bring the mobile app back up.

### 4.1. Confirm The Backend Is Responding

```powershell
curl.exe -s http://<backend-droplet-ip>:4000/health
```

Expected: `{"status":"ok"}`.

If it fails, SSH in and run:

```bash
pm2 status
pm2 logs tbhon-backend --lines 20
```

### 4.2. Confirm The ML API Is Responding

```powershell
ssh root@<ml-droplet-ip> "curl -s http://127.0.0.1:8000/healthz"
```

Expected: `{"ok":true}`.

If it fails:

```bash
sudo systemctl status tbhon-ml --no-pager
journalctl -u tbhon-ml -n 30 --no-pager
```

### 4.3. Grab The New Cloudflare Tunnel URLs

Quick tunnels generate a fresh random subdomain every time `cloudflared` restarts, which includes every droplet boot. After a reboot **both** URLs will be different.

#### Backend tunnel URL

```bash
ssh root@<backend-droplet-ip>
journalctl -u tbhon-backend-tunnel -n 50 --no-pager | grep trycloudflare
```

#### ML tunnel URL

```bash
ssh root@<ml-droplet-ip>
journalctl -u tbhon-ml-tunnel -n 50 --no-pager | grep trycloudflare
```

The output looks like:

```text
INF |  https://<new-words>.trycloudflare.com                       |
```

### 4.4. Update `mobile/.env`

Open `C:\Project VSC\Tbhon\mobile\.env` and replace both URLs:

```env
EXPO_PUBLIC_API_URL=https://<new-backend-words>.trycloudflare.com
EXPO_PUBLIC_TB_API_URL=https://<new-ml-words>.trycloudflare.com
```

### 4.5. Verify The Tunnels Reach Their Apps

```powershell
curl.exe -s https://<new-backend-words>.trycloudflare.com/health
curl.exe -s https://<new-ml-words>.trycloudflare.com/healthz
```

Both should return their healthy JSON responses.

### 4.6. Restart Expo With Cache Cleared

```powershell
cd "C:\Project VSC\Tbhon\mobile"
npx expo start --tunnel -c
```

`-c` is required — Expo only reads `.env` at startup, and Metro caches `EXPO_PUBLIC_*` values inside the bundle.

### 4.7. Smoke-Test From The Phone

1. Open the app in Expo Go.
2. Log in.
3. Run a screening session (3 coughs + 1 sputum photo).
4. Confirm:
   - Green or amber quality badge appears after each cough (means `check-quality` worked).
   - The result screen loads (means `/screenings` worked).
5. Check the cloud database:

```sql
SELECT recording_id, byte_size FROM cough_recordings ORDER BY recorded_at DESC LIMIT 5;
```

`byte_size` should be non-NULL on the new rows. NULL means the multipart upload failed (usually a missing or wrong tunnel URL).

## 5. Long Pauses (Destroying Droplets)

If you are pausing the project for weeks or months, destroying is cheaper.

### 5.1. Before Destroying — Save What You Need

The **MySQL database is on a separate Managed MySQL service**, not on the droplets, so it is not lost when droplets are destroyed. But the droplets themselves hold things you do not want to lose:

| File | Where | What to do |
| --- | --- | --- |
| Backend `.env` | Backend droplet `~/Tbhon-Backend/.env` | Copy to a secure place on your PC |
| MySQL CA cert | Backend droplet `~/Tbhon-Backend/certs/ca-certificate.crt` | Re-downloadable from the DigitalOcean MySQL page |
| ML model files | ML droplet `/root/Tbhon/ml/runs/...` and `/root/Tbhon/ml_phlegm/...` | Already in your local PC repo |
| systemd unit files | `/etc/systemd/system/tbhon-ml.service`, both `*-tunnel.service` | Templates are documented in `07-ml-droplet-setup.md` and `08-cloudflare-tunnels.md` |

To copy the `.env` off the backend droplet:

```powershell
scp root@<backend-droplet-ip>:/root/Tbhon-Backend/.env "C:\Project VSC\Tbhon-Backend\.env.production-backup"
```

Store that file outside the Git working tree and never commit it.

### 5.2. Take A Snapshot (Optional, ~$0.06/GB/mo)

DigitalOcean -> Droplet -> **Snapshots** -> **Take Snapshot** lets you re-create the droplet later with everything intact.

### 5.3. Destroy The Droplet

DigitalOcean -> Droplet -> **Destroy** -> type the droplet name -> confirm.

### 5.4. Restoring Later

Either:

- Create a new droplet from the saved snapshot (everything comes back including the `.env` and models), or
- Create a fresh droplet and re-run `02-backend-droplet-setup.md` (backend) / `07-ml-droplet-setup.md` (ML) / `08-cloudflare-tunnels.md` (tunnels).

## 6. Quick Reference Commands

| Action | Backend droplet | ML droplet |
| --- | --- | --- |
| Power off (clean) | `pm2 stop tbhon-backend && sudo systemctl stop tbhon-backend-tunnel && sudo poweroff` | `sudo systemctl stop tbhon-ml-tunnel tbhon-ml && sudo poweroff` |
| Power on | DigitalOcean panel -> Turn On | DigitalOcean panel -> Turn On |
| Service status | `pm2 status` | `sudo systemctl status tbhon-ml` |
| Tunnel status | `sudo systemctl status tbhon-backend-tunnel` | `sudo systemctl status tbhon-ml-tunnel` |
| Current tunnel URL | `journalctl -u tbhon-backend-tunnel -n 30 --no-pager \| grep trycloudflare` | `journalctl -u tbhon-ml-tunnel -n 30 --no-pager \| grep trycloudflare` |
| Restart service | `pm2 restart tbhon-backend` | `sudo systemctl restart tbhon-ml` |
| Restart tunnel (URL changes) | `sudo systemctl restart tbhon-backend-tunnel` | `sudo systemctl restart tbhon-ml-tunnel` |
