ALTER TABLE `users`
  DROP COLUMN `email_verified`,
  DROP COLUMN `email_verified_at`,
  DROP COLUMN `email_verification_code_hash`,
  DROP COLUMN `email_verification_expires_at`;
