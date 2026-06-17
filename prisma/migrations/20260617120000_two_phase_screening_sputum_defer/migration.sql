-- Two-phase screening: preliminary (cough + checklist) save now, sputum smear analyzed later.

ALTER TABLE `screening_sessions`
    ADD COLUMN `result_stage` VARCHAR(20) NOT NULL DEFAULT 'final',
    ADD COLUMN `awaiting_sputum` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `sputum_defer_reason` VARCHAR(255) NULL,
    ADD COLUMN `preliminary_risk_level` VARCHAR(50) NULL,
    ADD COLUMN `sputum_finalized_at` DATETIME(3) NULL;

-- Existing completed sessions are final by definition.
UPDATE `screening_sessions`
SET `result_stage` = 'final', `awaiting_sputum` = false
WHERE `completed_at` IS NOT NULL;
