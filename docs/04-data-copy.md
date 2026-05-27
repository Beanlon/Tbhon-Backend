# 04 - Local To Cloud Data Copy

This document explains how to copy selected data from a local MySQL database to DigitalOcean Managed MySQL.

This is optional. The cloud setup works even without copying local data. If old local accounts do not exist in the cloud database, users can register again and the new rows will be written to DigitalOcean MySQL.

## 1. Source And Target

| Role | Database |
| --- | --- |
| Source | Local MySQL, usually `tbhon_db` on `localhost:3306` |
| Target | DigitalOcean MySQL, `defaultdb` on port `25060` |

Do not copy `_prisma_migrations`. Prisma migration history should be created by running `npx prisma migrate deploy` on the droplet.

## 2. Recommended First Check

In DBeaver or MySQL CLI, check the target:

```sql
SHOW TABLES;
SELECT COUNT(*) FROM users;
SELECT email, created_at FROM users ORDER BY created_at DESC LIMIT 20;
```

If the cloud database already has users, duplicate-key conflicts can happen during import.

## 3. DBeaver Connection Setup

You need two working DBeaver connections:

1. Local MySQL connection to `tbhon_db`.
2. DigitalOcean MySQL connection to `defaultdb`.

For DigitalOcean:

- Host: DigitalOcean MySQL host
- Port: `25060`
- User: `doadmin`
- Password: DigitalOcean DB password
- SSL: use the DigitalOcean CA certificate
- Optional SSH tunnel: connect through the droplet if direct access times out

## 4. DBeaver Transfer Method

1. In DBeaver, expand the local `tbhon_db`.
2. Expand **Tables**.
3. Select only application tables.
4. Do not select `_prisma_migrations`.
5. Right-click selected tables.
6. Choose **Export Data**.
7. Choose target type **Database**.
8. Set target container to DigitalOcean `defaultdb`.

## 5. Duplicate-Tolerant Settings

Use these settings when target data may already exist:

| Setting | Value |
| --- | --- |
| Transfer auto-generated columns | On |
| Use transactions | Off or On for small tables; Off can reduce lock issues |
| Truncate target table(s) before load | Off |
| Disable referential integrity checks | Off |
| Disable batches | On |
| Replace method | `INSERT IGNORE` |
| Commit after row insert | `100` or `500` for large/problematic tables |

DigitalOcean Managed MySQL may not allow disabling referential integrity checks globally, so avoid relying on that option.

## 6. Suggested Import Order

Import parent tables before child tables.

Recommended order:

1. `users`
2. `user_profiles`
3. `symptom_questions`
4. `screening_sessions`
5. `symptom_responses`
6. `cough_recordings`
7. `cough_quality_checks`
8. `tb_audio_predictions`
9. `sputum_images`
10. `phlegm_predictions`
11. `screening_results`

If you only need old login accounts, start with:

1. `users`
2. `user_profiles`

## 7. Manual Copy As SQL Inserts

If DBeaver transfer is difficult, copy table data manually as SQL:

1. Open the local table data grid.
2. Select the rows.
3. Right-click selected rows.
4. Use **Copy Advanced**, **Generate SQL**, or equivalent.
5. Choose SQL `INSERT` format.
6. Paste into a SQL editor connected to DigitalOcean `defaultdb`.
7. Execute.

For duplicate-safe inserts, change:

```sql
INSERT INTO users ...
```

to:

```sql
INSERT IGNORE INTO users ...
```

## 8. What To Avoid

Avoid copying:

```text
_prisma_migrations
```

Avoid importing all tables at once if you keep seeing lock timeouts. Use smaller table groups.

Avoid truncating tables on DigitalOcean unless you understand the foreign-key relationships.

## 9. Verify After Copy

Run on the DigitalOcean database:

```sql
SELECT COUNT(*) AS users_count FROM users;
SELECT COUNT(*) AS profiles_count FROM user_profiles;
SELECT COUNT(*) AS sessions_count FROM screening_sessions;
SELECT email, created_at FROM users ORDER BY created_at DESC LIMIT 20;
```

Then test login in the mobile app.

## 10. Common Outcomes

| Symptom | Meaning |
| --- | --- |
| Old login fails | User row was not copied, or password hash differs |
| Registering a new account works | Cloud backend and DB are working |
| Duplicate key error | Target already has that row; use `INSERT IGNORE` or skip duplicates |
| Lock wait timeout | Import smaller table groups and disable batches |
