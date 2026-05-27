# 02 - Backend Droplet Setup

This document explains how to prepare a DigitalOcean droplet to run the TBhon backend.

## 1. Create The Droplet

In DigitalOcean:

1. Go to **Droplets**.
2. Create a Linux droplet, usually Ubuntu.
3. Choose a region near the database and app users.
4. Add SSH access or a root password.
5. Name it something like `tbhon-backend`.

After creation, note the public IP. This IP is used by the mobile app:

```env
EXPO_PUBLIC_API_URL=http://<droplet-public-ip>:4000
```

## 2. Open The Droplet Console

Use either:

- DigitalOcean web console: Droplet -> Access -> Launch Droplet Console
- SSH from your PC, if configured

You should see a prompt similar to:

```text
root@tbhon-backend:~#
```

## 3. Install Server Dependencies

Run these on the droplet:

```bash
sudo apt update
sudo apt install -y git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
node -v
npm -v
```

## 4. Clone The Backend Repository

```bash
cd ~
git clone https://github.com/Beanlon/Tbhon-Backend.git
cd Tbhon-Backend
```

If the folder already exists, do not clone again. Use:

```bash
cd ~/Tbhon-Backend
git pull
```

## 5. Add The Production `.env`

Create the env file on the droplet:

```bash
cd ~/Tbhon-Backend
nano .env
```

Example:

```env
DATABASE_URL="mysql://doadmin:<password>@<do-mysql-host>:25060/defaultdb?sslaccept=verify_ca&sslcert=/root/Tbhon-Backend/certs/ca-certificate.crt"
PORT=4000
JWT_SECRET="replace-with-a-long-random-production-secret"
JWT_EXPIRES_IN="7d"
IOT_API_KEY="replace-or-keep-the-key-your-device-uses"
```

Save in nano:

1. `Ctrl + O`
2. Enter
3. `Ctrl + X`

## 6. Add The MySQL CA Certificate

DigitalOcean Managed MySQL requires SSL.

1. In DigitalOcean, open the database connection details.
2. Download the CA certificate.
3. Put it on the droplet:

```bash
cd ~/Tbhon-Backend
mkdir -p certs
nano certs/ca-certificate.crt
```

Paste the complete certificate, including:

```text
-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----
```

Save and exit.

## 7. Install, Generate, Migrate, Build

Run:

```bash
cd ~/Tbhon-Backend
npm install --include=dev
npx prisma generate
npx prisma migrate deploy
npm run build
```

What each command does:

| Command | Purpose |
| --- | --- |
| `npm install --include=dev` | Installs runtime dependencies and Prisma CLI |
| `npx prisma generate` | Generates Prisma client files |
| `npx prisma migrate deploy` | Applies existing migrations to production MySQL |
| `npm run build` | Compiles TypeScript into `dist/` |

## 8. Run With PM2

Install PM2 once:

```bash
npm install -g pm2
```

Start the backend:

```bash
pm2 start dist/server.js --name tbhon-backend
pm2 save
pm2 startup
```

Restart later:

```bash
pm2 restart tbhon-backend
```

Check status and logs:

```bash
pm2 status
pm2 logs tbhon-backend --lines 20
```

Expected log:

```text
Tbhon backend is running on port 4000
```

## 9. Open Firewall Port 4000

In DigitalOcean:

1. Go to Networking / Firewalls.
2. Allow inbound TCP `4000`.
3. Attach the firewall to the backend droplet.

SSH port `22` should also remain allowed.

## 10. Verify Backend Health

From your PC browser:

```text
http://<droplet-public-ip>:4000/health
```

Expected:

```json
{"status":"ok"}
```

`Cannot GET /` on the root path can be normal if the deployed backend version does not define a route for `/`.
