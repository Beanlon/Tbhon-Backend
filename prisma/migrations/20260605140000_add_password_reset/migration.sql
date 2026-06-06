-- AlterTable
ALTER TABLE `users`
    ADD COLUMN `password_reset_code_hash` VARCHAR(255) NULL,
    ADD COLUMN `password_reset_expires_at` DATETIME(3) NULL,
    ADD COLUMN `password_reset_sent_at` DATETIME(3) NULL,
    ADD COLUMN `password_reset_attempt_count` INTEGER NOT NULL DEFAULT 0;
