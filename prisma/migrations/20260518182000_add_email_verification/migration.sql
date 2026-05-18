ALTER TABLE `users`
  ADD COLUMN `email_verified` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `email_verified_at` DATETIME(3) NULL,
  ADD COLUMN `email_verification_code_hash` VARCHAR(255) NULL,
  ADD COLUMN `email_verification_expires_at` DATETIME(3) NULL;
