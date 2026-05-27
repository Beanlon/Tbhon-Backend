# TBhon Deployment Documentation

This folder documents the current DigitalOcean setup for TBhon.

## Documents

- [01 - How The Cloud Setup Works](./01-how-it-works.md)
- [02 - Backend Droplet Setup](./02-backend-droplet-setup.md)
- [03 - Managed MySQL Database Setup](./03-database-setup.md)
- [04 - Local To Cloud Data Copy](./04-data-copy.md)
- [05 - Droplet Operations And Updates](./05-droplet-operations.md)
- [06 - Running The Mobile App](./06-running-the-app.md)

## Current Production Shape

```text
Expo mobile app
  -> http://<droplet-public-ip>:4000
  -> Node/Express backend running on the DigitalOcean droplet
  -> DigitalOcean Managed MySQL database
```

The backend code runs on the droplet. The database does not live inside the droplet; it is a separate DigitalOcean Managed MySQL service. The droplet connects to it using `DATABASE_URL` from the droplet's `.env` file.

## Important File Locations

| File | Machine | Purpose |
| --- | --- | --- |
| `~/Tbhon-Backend/.env` | DigitalOcean droplet | Production backend config and cloud DB connection |
| `C:\Project VSC\Tbhon-Backend\.env` | Local Windows PC | Local backend development config |
| `C:\Project VSC\Tbhon\mobile\.env` | Local Windows PC | Mobile app public API URLs |

Do not commit `.env` files or database passwords.
