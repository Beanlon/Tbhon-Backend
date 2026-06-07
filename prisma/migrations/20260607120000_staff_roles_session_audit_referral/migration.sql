-- Staff roles, session audit fields, referral tracking (gaps #8–11, #15)

ALTER TABLE `users`
    ADD COLUMN `role` ENUM('STAFF', 'ADMIN', 'PATIENT') NOT NULL DEFAULT 'STAFF';

UPDATE `users` SET `role` = 'STAFF' WHERE `role` IS NULL;

ALTER TABLE `screening_sessions`
    ADD COLUMN `sputum_skip_reason` VARCHAR(255) NULL,
    ADD COLUMN `staff_notes` TEXT NULL,
    ADD COLUMN `staff_result_confirmed_at` DATETIME(3) NULL;

ALTER TABLE `screening_results`
    ADD COLUMN `referral_status` ENUM('none', 'recommended', 'documented', 'completed') NOT NULL DEFAULT 'none',
    ADD COLUMN `referral_notes` TEXT NULL,
    ADD COLUMN `referral_updated_at` DATETIME(3) NULL;

-- Moderate/high risk sessions should show referral recommended when completed after deploy.
UPDATE `screening_results` sr
INNER JOIN `screening_sessions` ss ON ss.session_id = sr.session_id
SET sr.referral_status = 'recommended'
WHERE sr.referral_status = 'none'
  AND LOWER(COALESCE(ss.final_risk_level, sr.risk_level)) IN ('moderate', 'high');
