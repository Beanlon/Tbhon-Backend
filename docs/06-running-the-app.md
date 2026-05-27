# 06 - Running The Mobile App

This document explains how to run the Expo mobile app and how it connects to the cloud backend.

## 1. Mobile Env File

Local file:

```text
C:\Project VSC\Tbhon\mobile\.env
```

Example for the cloud backend:

```env
EXPO_PUBLIC_API_URL=http://<droplet-public-ip>:4000
EXPO_PUBLIC_TB_API_URL=https://<cloudflare-tunnel>.trycloudflare.com
```

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Main backend API for auth, users, screenings, IoT-backed routes |
| `EXPO_PUBLIC_TB_API_URL` | ML / inference API for cough or sputum prediction |

When `EXPO_PUBLIC_API_URL` points to the droplet, the app uses the DigitalOcean backend and DigitalOcean database.

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
| API calls to `http://<droplet-ip>:4000` | No, internet is enough |

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

In a browser:

```text
http://<droplet-public-ip>:4000/health
```

Expected:

```json
{"status":"ok"}
```

If this does not work, fix the backend or firewall before testing the app.

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

`EXPO_PUBLIC_TB_API_URL` is separate from the main backend API.

If it points to a Cloudflare tunnel, that tunnel must still be running on the PC that hosts the ML API. The backend droplet and MySQL can work even if the ML API is not deployed yet.
