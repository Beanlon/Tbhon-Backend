-- Add stable public code for PATIENT accounts (used in permanent "My TBhon QR").
-- NULL for STAFF/ADMIN; generated at claim time for PATIENT users.
ALTER TABLE `users`
  ADD COLUMN `patient_public_code` VARCHAR(32) NULL,
  ADD UNIQUE INDEX `users_patient_public_code_key` (`patient_public_code`);
