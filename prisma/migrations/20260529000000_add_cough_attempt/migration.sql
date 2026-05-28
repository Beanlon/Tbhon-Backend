-- Add cough_attempt to cough_recordings.
-- Nullable so legacy rows (created before this migration) are unaffected.
-- A partial unique index enforces one active row per (session, attempt) slot;
-- NULLs are excluded from uniqueness so legacy rows never conflict.

ALTER TABLE `cough_recordings`
    ADD COLUMN `cough_attempt` INTEGER NULL;

-- Only enforce uniqueness on rows that actually have an attempt number.
-- MySQL allows multiple NULLs in a UNIQUE index, so this is safe for legacy rows.
CREATE UNIQUE INDEX `cough_recordings_session_attempt_key`
    ON `cough_recordings` (`session_id`, `cough_attempt`);
