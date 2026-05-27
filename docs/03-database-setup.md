# 03 - Managed MySQL Database Setup

This document explains how to set up DigitalOcean Managed MySQL for the backend.

## 1. Create Managed MySQL

In DigitalOcean:

1. Go to **Databases**.
2. Create a new database cluster.
3. Choose **MySQL**.
4. Use the same region as the backend droplet when possible.
5. Wait until the database is online.

DigitalOcean creates a default database named `defaultdb`.

## 2. Connection Details

In the database page, open **Connection Details**.

You need:

| Field | Example |
| --- | --- |
| Username | `doadmin` |
| Password | From DigitalOcean connection details |
| Host | `<cluster-host>.ondigitalocean.com` |
| Port | `25060` |
| Database | `defaultdb` |
| SSL mode | Required |

The database password is not the droplet password. It is the password shown for `doadmin` in the database connection details.

## 3. Trusted Sources

DigitalOcean Managed MySQL blocks connections unless the source is trusted.

In the database settings:

1. Open **Trusted Sources**.
2. Add the backend droplet.
3. Optionally add your current PC public IP if you want direct DBeaver access.

For production, the backend droplet must be trusted.

## 4. SSL CA Certificate

DigitalOcean MySQL requires SSL.

1. Download the CA certificate from the database connection details page.
2. Save it on the droplet:

```bash
cd ~/Tbhon-Backend
mkdir -p certs
nano certs/ca-certificate.crt
```

3. Paste the certificate text.

## 5. Droplet `DATABASE_URL`

The production backend reads `DATABASE_URL` from `~/Tbhon-Backend/.env`.

Example:

```env
DATABASE_URL="mysql://doadmin:<password>@<do-mysql-host>:25060/defaultdb?sslaccept=verify_ca&sslcert=/root/Tbhon-Backend/certs/ca-certificate.crt"
```

Important parts:

| Part | Meaning |
| --- | --- |
| `doadmin` | DigitalOcean DB username |
| `<password>` | DigitalOcean DB password |
| `<do-mysql-host>` | Managed MySQL host |
| `25060` | DigitalOcean MySQL port |
| `defaultdb` | Database/schema name |
| `sslaccept=verify_ca` | Verify the CA certificate |
| `sslcert=...` | Path to CA cert on droplet |

## 6. Apply Prisma Migrations

Run on the droplet:

```bash
cd ~/Tbhon-Backend
npx prisma generate
npx prisma migrate deploy
```

`migrate deploy` applies migration files from `prisma/migrations` to the cloud database.

Use:

- `prisma migrate dev` on your local PC when creating new migrations.
- `prisma migrate deploy` on the droplet when applying existing migrations to production.

## 7. Verify From The Droplet

Install MySQL client if needed:

```bash
sudo apt update
sudo apt install -y mysql-client
```

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

When it asks for a password, paste the `doadmin` database password. Password input is hidden.

Run:

```sql
SELECT DATABASE();
SHOW TABLES;
SELECT COUNT(*) FROM users;
EXIT;
```

## 8. Verify From DBeaver

Create a MySQL connection:

| Setting | Value |
| --- | --- |
| Host | DigitalOcean MySQL host |
| Port | `25060` |
| Database | `defaultdb` |
| User | `doadmin` |
| Password | DigitalOcean DB password |
| SSL CA certificate | Downloaded DigitalOcean CA certificate |

If direct connection times out, either add your current PC IP to Trusted Sources or use an SSH tunnel through the droplet.

## 9. Useful SQL Checks

```sql
SHOW TABLES;
SELECT COUNT(*) AS total_users FROM users;
SELECT email, created_at FROM users ORDER BY created_at DESC LIMIT 20;
SELECT COUNT(*) AS total_sessions FROM screening_sessions;
```

If `users` is empty, old local accounts will not work until copied or recreated in the cloud database.
