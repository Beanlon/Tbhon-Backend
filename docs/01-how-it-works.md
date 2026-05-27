# 01 - How The Cloud Setup Works

## High-Level Flow

```text
Phone / Expo app
  -> EXPO_PUBLIC_API_URL
  -> DigitalOcean droplet public IP, port 4000
  -> Node/Express backend
  -> Prisma
  -> DigitalOcean Managed MySQL
```

The phone never connects directly to MySQL. It only calls the backend API. The backend is the process that talks to the database.

## What Lives Where

| Component | Location | Notes |
| --- | --- | --- |
| Mobile app source code | Local PC, `C:\Project VSC\Tbhon\mobile` | Runs with Expo during development |
| Expo Metro server | Local PC | Serves the dev JavaScript bundle to Expo Go |
| Backend source code | Droplet, `~/Tbhon-Backend` | Cloned from GitHub |
| Backend runtime | Droplet, PM2 process | Runs `dist/server.js` on port `4000` |
| Database | DigitalOcean Managed MySQL | Separate service from the droplet |
| Production backend `.env` | Droplet, `~/Tbhon-Backend/.env` | Holds `DATABASE_URL`, `JWT_SECRET`, `IOT_API_KEY` |

## Backend And Droplet Relationship

The droplet is the Linux server. The backend is the Node.js app running on that server.

```text
DigitalOcean droplet
  -> Linux OS
  -> ~/Tbhon-Backend
  -> npm dependencies
  -> dist/server.js
  -> PM2 keeps the process alive
```

The database is not inside the droplet. The droplet only contains the backend code and the `.env` connection settings for the database.

## Backend And Database Relationship

The backend reads the droplet `.env` file when it starts.

```env
DATABASE_URL="mysql://doadmin:<password>@<do-mysql-host>:25060/defaultdb?sslaccept=verify_ca&sslcert=/root/Tbhon-Backend/certs/ca-certificate.crt"
PORT=4000
JWT_SECRET="..."
JWT_EXPIRES_IN="7d"
IOT_API_KEY="..."
```

When the backend needs data:

1. Express receives a request, for example `/auth/login`.
2. The controller calls Prisma.
3. Prisma uses `DATABASE_URL`.
4. MySQL receives the query in the `defaultdb` database.
5. The backend returns the response to the phone.

## Network Rules

For the system to work:

- The droplet firewall must allow inbound TCP `4000`.
- The DigitalOcean MySQL Trusted Sources must include the backend droplet.
- The mobile `.env` must point `EXPO_PUBLIC_API_URL` to the droplet backend URL.

## Development Versus Production Env

There are two backend `.env` files:

| File | Used When |
| --- | --- |
| Local `C:\Project VSC\Tbhon-Backend\.env` | You run `npm run dev` on your Windows PC |
| Droplet `~/Tbhon-Backend/.env` | PM2 runs the production backend on the droplet |

If the mobile app points to `http://<droplet-ip>:4000`, the local backend `.env` is not used.

## Expo Networking

`npx expo start -c` starts Metro on your PC. In LAN mode, the phone and PC usually need to be on the same Wi-Fi. In tunnel mode, they do not.

```bash
npx expo start -c
npx expo start -c --tunnel
```

The Expo connection is only for loading the app during development. API calls still go to `EXPO_PUBLIC_API_URL`.
