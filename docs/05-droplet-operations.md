# 05 - Droplet Operations And Updates

This document explains how to run, verify, update, and migrate the **backend droplet** on DigitalOcean.

For the ML droplet, see `07-ml-droplet-setup.md` for the one-time install and `09-droplet-power-management.md` for restart workflows. The Cloudflare tunnels are documented in `08-cloudflare-tunnels.md`.

## 1. Main Droplet Folder

All backend commands should be run inside:

```bash
cd ~/Tbhon-Backend
```

This folder should contain:

```text
package.json
prisma/
src/
.env
```

After running `npm run build` on the droplet, a `dist/` folder will also appear. `dist/` is the compiled JavaScript output and is **not stored in Git** — it is generated locally on every machine that builds the project.

## 2. Start Or Restart Backend

Check PM2:

```bash
pm2 status
```

Start if it does not exist:

```bash
cd ~/Tbhon-Backend
pm2 start dist/server.js --name tbhon-backend
pm2 save
```

Restart if it already exists:

```bash
pm2 restart tbhon-backend
```

View logs:

```bash
pm2 logs tbhon-backend --lines 20
```

Expected:

```text
Tbhon backend is running on port 4000
```

## 3. Verify Backend Health

### 3.1. Local (skips the tunnel)

From your PC:

```text
http://<droplet-public-ip>:4000/health
```

This only works if port `4000` is open on the DigitalOcean firewall. It bypasses Cloudflare entirely and is useful when you want to confirm PM2 itself is up.

### 3.2. Through The Cloudflare Tunnel

From your PC:

```powershell
curl.exe -s https://<backend-tunnel-url>.trycloudflare.com/health
```

This is the same path the mobile app uses. If this fails but the local URL works, the tunnel is the problem — see `08-cloudflare-tunnels.md`.

Expected (either method):

```json
{"status":"ok"}
```

## 4. Full Deployment Update

Run this after pushing backend changes to GitHub:

```bash
cd ~/Tbhon-Backend
git pull
npm install --include=dev
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart tbhon-backend
pm2 logs tbhon-backend --lines 20
```

What this does:

| Step | Purpose |
| --- | --- |
| `git pull` | Gets latest code from GitHub |
| `npm install --include=dev` | Installs dependencies and Prisma CLI |
| `npx prisma generate` | Regenerates Prisma client |
| `npx prisma migrate deploy` | Applies new migration files to production DB |
| `npm run build` | Builds TypeScript to JavaScript |
| `pm2 restart` | Runs the latest build |

## 5. Backend Code Change Workflow

On your local PC:

```bash
cd "C:\Project VSC\Tbhon-Backend"
git status
git add .
git commit -m "Describe the backend change"
git push
```

On the droplet:

```bash
cd ~/Tbhon-Backend
git pull
npm install --include=dev
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart tbhon-backend
```

## 6. Prisma Migration Workflow

Create migrations locally:

```bash
cd "C:\Project VSC\Tbhon-Backend"
npx prisma migrate dev --name describe_change
```

Commit the migration files:

```bash
git add prisma/migrations prisma/schema.prisma
git commit -m "Add database migration"
git push
```

Apply migrations on the droplet:

```bash
cd ~/Tbhon-Backend
git pull
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart tbhon-backend
```

Use `migrate deploy` on production. Do not use `migrate dev` on the production droplet.

## 7. Checking The Cloud Database From The Droplet

Connect:

```bash
mysql \
  --host=<do-mysql-host> \
  --port=25060 \
  --user=doadmin \
  -p \
  --ssl-mode=VERIFY_CA \
  --ssl-ca=/root/Tbhon-Backend/certs/ca-certificate.crt \
  defaultdb
```

Useful SQL:

```sql
SELECT DATABASE();
SHOW TABLES;
SELECT COUNT(*) FROM users;
SELECT email, created_at FROM users ORDER BY created_at DESC LIMIT 20;
EXIT;
```

## 8. PM2 Useful Commands

```bash
pm2 status
pm2 logs tbhon-backend --lines 50
pm2 restart tbhon-backend
pm2 stop tbhon-backend
pm2 delete tbhon-backend
pm2 save
```

If PM2 has old error logs mixed with current logs:

```bash
pm2 flush
pm2 logs tbhon-backend --lines 20
```

## 9. When `.env` Changes

After editing the droplet `.env`, restart the backend:

```bash
cd ~/Tbhon-Backend
pm2 restart tbhon-backend
```

The running process does not automatically reload `.env` changes.

## 10. Daily Quick Checklist

```bash
cd ~/Tbhon-Backend
git pull
npm install --include=dev
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart tbhon-backend
pm2 status
```

Then test:

```text
http://<droplet-public-ip>:4000/health
```

Or, the path the phone actually uses:

```powershell
curl.exe -s https://<backend-tunnel-url>.trycloudflare.com/health
```

## 11. Cloudflare Tunnel On The Backend Droplet

The backend droplet also runs a Cloudflare tunnel under systemd so the mobile app can reach the API via HTTPS. See `08-cloudflare-tunnels.md` for installation and URL-refresh details.

Common commands on the backend droplet:

```bash
sudo systemctl status tbhon-backend-tunnel
sudo systemctl restart tbhon-backend-tunnel        # URL will change
journalctl -u tbhon-backend-tunnel -n 30 --no-pager | grep trycloudflare
```

The tunnel only carries API traffic — `pm2 restart tbhon-backend` does **not** require restarting the tunnel and does **not** change the tunnel URL.

## 12. When To Restart What

| Change you made | Restart |
| --- | --- |
| Edited backend `.env` | `pm2 restart tbhon-backend` |
| Pulled new backend code | `pm2 restart tbhon-backend` after `npm install` + `prisma generate` + `npm run build` |
| Applied a Prisma migration | `pm2 restart tbhon-backend` |
| Backend stuck or crashing | `pm2 restart tbhon-backend` |
| Tunnel URL needs to change (rare, dev only) | `sudo systemctl restart tbhon-backend-tunnel` and update `mobile/.env` |
| After droplet power on/off | See `09-droplet-power-management.md`, Section 4 |
