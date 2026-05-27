# 05 - Droplet Operations And Updates

This document explains how to run, verify, update, and migrate the backend on the DigitalOcean droplet.

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

## 3. Verify From Browser

From your PC:

```text
http://<droplet-public-ip>:4000/health
```

Expected:

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
