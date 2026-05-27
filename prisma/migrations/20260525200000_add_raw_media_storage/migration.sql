-- Store raw cough audio and sputum image bytes server-side so any device on the
-- same account can later download/play the original media. `file_uri` is kept
-- (now nullable) for legacy/diagnostic purposes only.

ALTER TABLE `cough_recordings`
    MODIFY `file_uri` TEXT NULL,
    ADD COLUMN `raw_data` LONGBLOB NULL,
    ADD COLUMN `byte_size` INTEGER NULL,
    ADD COLUMN `source` VARCHAR(50) NOT NULL DEFAULT 'mobile';

ALTER TABLE `sputum_images`
    MODIFY `file_uri` TEXT NULL,
    ADD COLUMN `raw_data` LONGBLOB NULL,
    ADD COLUMN `byte_size` INTEGER NULL,
    ADD COLUMN `source` VARCHAR(50) NOT NULL DEFAULT 'mobile';
