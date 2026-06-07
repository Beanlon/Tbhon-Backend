-- Patient result-slip QR access tokens
ALTER TABLE `screening_sessions`
  ADD COLUMN `patient_access_token` VARCHAR(64) NULL,
  ADD COLUMN `patient_access_expires_at` DATETIME(3) NULL,
  ADD COLUMN `patient_user_id` VARCHAR(191) NULL,
  ADD COLUMN `patient_claimed_at` DATETIME(3) NULL;

CREATE UNIQUE INDEX `screening_sessions_patient_access_token_key` ON `screening_sessions`(`patient_access_token`);
CREATE INDEX `screening_sessions_patient_user_id_idx` ON `screening_sessions`(`patient_user_id`);

ALTER TABLE `screening_sessions`
  ADD CONSTRAINT `screening_sessions_patient_user_id_fkey`
  FOREIGN KEY (`patient_user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
