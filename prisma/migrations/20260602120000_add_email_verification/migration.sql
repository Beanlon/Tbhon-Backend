-- Optional for existing Alpha testers: mark current accounts verified before enforcing EMAIL_VERIFICATION_REQUIRED
-- UPDATE `users` SET `email_verified` = true, `email_verified_at` = NOW() WHERE `email` IS NOT NULL;

ALTER TABLE `users`
  ADD COLUMN `email_verified` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `email_verified_at` DATETIME(3) NULL,
  ADD COLUMN `email_verification_code_hash` VARCHAR(255) NULL,
  ADD COLUMN `email_verification_expires_at` DATETIME(3) NULL,
  ADD COLUMN `email_verification_sent_at` DATETIME(3) NULL,
  ADD COLUMN `email_verification_attempt_count` INTEGER NOT NULL DEFAULT 0;
