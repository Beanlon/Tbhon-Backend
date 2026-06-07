# 08 - Cloudflare Tunnels For Both Droplets

This document explains why both droplets sit behind Cloudflare Tunnels, how to install them, and how to handle the URL changing after a droplet reboot.

## 1. Why Cloudflare Tunnels Are Required

The mobile app uses `FileSystem.uploadAsync` (Expo) to POST multipart audio and image files to the backend and ML APIs. On **iOS over a cellular network**, two layers below the app silently break plain HTTP uploads to a raw IP:

| Layer | What it does | Why it breaks plain HTTP IP uploads |
| --- | --- | --- |
| iOS `URLSession` | Underlying networking for `FileSystem.uploadAsync` | Hostile to non-domain, plain-HTTP multipart POSTs even with `NSAllowsArbitraryLoads` |
| PH cellular carriers (Globe, Smart, DITO) | Filter outbound mobile traffic | Routinely block non-standard ports such as `:8000` and `:4000`; allow `:443` (HTTPS) |

Symptoms when plain HTTP is used:

- Mobile app `check-quality timed out` even though the server is healthy
- `cough_recordings.raw_data` and `sputum_images.raw_data` are stored as `NULL`
- The server log shows zero incoming requests from the phone even when other GET requests work

Putting both APIs behind a Cloudflare Tunnel exposes them as `https://*.trycloudflare.com` over port 443. iOS and the carrier both treat this as a normal HTTPS request, so the uploads succeed.

```text
Phone (iOS, cellular)
  -> HTTPS :443
  -> Cloudflare edge
  -> cloudflared on droplet (outbound persistent connection)
  -> localhost:4000 (backend) or localhost:8000 (ML)
```

## 2. Install Cloudflare Tunnel On A Droplet

These steps work on both the backend droplet and the ML droplet. The only thing that differs is the local port the tunnel forwards to.

### 2.1. Install `cloudflared`

SSH into the droplet, then:

```bash
cd /tmp
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
cloudflared --version
```

You should see something like `cloudflared version 2026.5.1`.

### 2.2. Create A Systemd Unit For The Tunnel

#### Backend droplet

```bash
sudo nano /etc/systemd/system/tbhon-backend-tunnel.service
```

Paste:

```ini
[Unit]
Description=Cloudflare Quick Tunnel for TBhon Backend API
After=network.target

[Service]
User=root
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Note: do not add `Requires=tbhon-backend.service`. The backend runs under PM2, not systemd, and that would make the unit fail to start.

#### ML droplet

```bash
sudo nano /etc/systemd/system/tbhon-ml-tunnel.service
```

Paste:

```ini
[Unit]
Description=Cloudflare Quick Tunnel for TBhon ML API
After=network.target tbhon-ml.service
Requires=tbhon-ml.service

[Service]
User=root
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate --url http://localhost:8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

The ML tunnel does have `Requires=tbhon-ml.service` because the ML API itself is also a systemd unit (see `07-ml-droplet-setup.md`).

### 2.3. Start The Tunnel

```bash
sudo systemctl daemon-reload
sudo systemctl enable <tunnel-service-name>
sudo systemctl start <tunnel-service-name>
sudo systemctl status <tunnel-service-name> --no-pager
```

Where `<tunnel-service-name>` is either `tbhon-backend-tunnel` or `tbhon-ml-tunnel`.

Expected: `Active: active (running)`.

### 2.4. Read The Public Tunnel URL

```bash
journalctl -u <tunnel-service-name> -n 50 --no-pager
```

Look for a boxed block in the output:

```text
INF +--------------------------------------------------------------+
INF |  Your quick Tunnel has been created! Visit it at ...        |
INF |  https://<random-words>.trycloudflare.com                    |
INF +--------------------------------------------------------------+
```

Copy that HTTPS URL.

### 2.5. Verify From Your PC

```powershell
curl.exe -s https://<random-words>.trycloudflare.com/health
curl.exe -s https://<random-words>.trycloudflare.com/healthz
```

The backend tunnel responds at `/health` with `{"status":"ok"}`. The ML tunnel responds at `/healthz` with `{"ok":true}`.

## 3. Wire The Tunnels Into The Mobile App

Edit `C:\Project VSC\Tbhon\mobile\.env`:

```env
EXPO_PUBLIC_API_URL=https://<backend-tunnel-url>.trycloudflare.com
EXPO_PUBLIC_TB_API_URL=https://<ml-tunnel-url>.trycloudflare.com
```

Then restart Expo with cache cleared:

```powershell
cd "C:\Project VSC\Tbhon\mobile"
npx expo start --tunnel -c
```

The `-c` flag is required. Expo only reads `.env` at startup and Metro caches the module that uses the variables.

## 4. The URL Change Problem

Quick tunnels generate a random subdomain every time `cloudflared` starts. The URL **changes** when:

- The droplet reboots
- You run `sudo systemctl restart tbhon-ml-tunnel` or `tbhon-backend-tunnel`
- The droplet is powered off and back on from the DigitalOcean panel
- Cloudflare rotates your slot (rare, but possible)

The URL **does not change** during normal operation. As long as the droplet stays up and the tunnel service is not restarted, the URL is stable for days.

When the URL changes, on your **Windows dev PC** (repo root):

```bash
npm run tunnel:sync
cd mobile && npx expo start -c
```

That SSHes both droplets, reads the current `trycloudflare.com` URLs from `journalctl`, and merges them into `mobile/.env` without removing `EXPO_PUBLIC_IOT_API_KEY`.

If SSH is unavailable, use `npm run tunnel:droplets` instead (local cloudflared proxy + auto `.env`).

Manual steps (fallback):

1. SSH into each droplet.
2. Run `journalctl -u <tunnel-service-name> -n 50 --no-pager` and copy the new URL.
3. Update `mobile/.env` on your PC.
4. Restart Expo with `npx expo start -c`.

## 5. Refresh URL Quick Reference

### Backend tunnel URL

```bash
ssh root@159.223.42.179
journalctl -u tbhon-backend-tunnel -n 30 --no-pager | grep trycloudflare
```

### ML tunnel URL

```bash
ssh root@<ml-droplet-ip>
journalctl -u tbhon-ml-tunnel -n 30 --no-pager | grep trycloudflare
```

The `grep` filters out the noise and shows only the boxed URL lines.

## 6. Tunnel Operations

### Stop a tunnel

```bash
sudo systemctl stop <tunnel-service-name>
```

The mobile app immediately loses connectivity to that endpoint.

### Restart a tunnel (URL will change)

```bash
sudo systemctl restart <tunnel-service-name>
journalctl -u <tunnel-service-name> -n 30 --no-pager
```

Remember to update `mobile/.env` afterward.

### Tail the live tunnel log

```bash
journalctl -u <tunnel-service-name> -f
```

Press `Ctrl + C` to stop following.

### Disable the tunnel at boot

```bash
sudo systemctl disable <tunnel-service-name>
```

It will no longer start automatically after droplet reboots. Re-enable with `sudo systemctl enable <tunnel-service-name>`.

## 7. Tunnel Log: `dial tcp [::1]:4000: connection refused`

If `journalctl -u tbhon-backend-tunnel` shows errors like:

```text
Unable to reach the origin service ... dial tcp [::1]:4000: connect: connection refused
```

while `curl http://127.0.0.1:4000/health` on the droplet returns `{"status":"ok"}`, the tunnel is pointing at **`localhost`**, which cloudflared resolves to IPv6 (`::1`). Node/PM2 listens on IPv4 (`127.0.0.1`) only.

Fix the systemd unit to use the IPv4 loopback explicitly:

```bash
sudo sed -i 's|http://localhost:4000|http://127.0.0.1:4000|' /etc/systemd/system/tbhon-backend-tunnel.service
sudo systemctl daemon-reload
sudo systemctl restart tbhon-backend-tunnel
curl -s http://127.0.0.1:4000/health
journalctl -u tbhon-backend-tunnel -n 10 --no-pager
```

Then test through the tunnel URL from your PC:

```powershell
curl.exe -s https://<backend-tunnel-url>.trycloudflare.com/health
```

Use `127.0.0.1` (not `localhost`) in the tunnel URL for the backend. The ML tunnel can use `http://127.0.0.1:8000` the same way if you see the same error on port 8000.

## 8. Harmless Warnings In The Tunnel Log

You can ignore both of these:

```text
WRN The user running cloudflared process has a GID ... not within ping_group_range ...
WRN ICMP proxy feature is disabled error="cannot create ICMPv4 proxy: ..."
```

The ICMP proxy is only relevant if applications behind the tunnel need to send `ping` packets out. HTTP traffic is unaffected.

## 9. Upgrade Path To Permanent URLs

Quick tunnels are fine for development and demos. For a public beta or production release, switch to **named tunnels** under a Cloudflare account:

| | Quick tunnel (current) | Named tunnel (recommended for prod) |
| --- | --- | --- |
| URL | `random-words.trycloudflare.com`, changes on restart | `api.yourdomain.com`, permanent |
| Cloudflare account | Not required | Free account required |
| Domain | Not required | Required (any registrar, pointed to Cloudflare DNS) |
| Cost | Free | Free tunnel + ~$10/yr domain |
| Setup | 5 minutes | ~30 minutes one-time |

When you are ready, follow:

- `https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/`

The systemd units in Section 2 can be replaced with `cloudflared tunnel run <tunnel-name>` pointing at a `config.yml` under `/etc/cloudflared/`.
