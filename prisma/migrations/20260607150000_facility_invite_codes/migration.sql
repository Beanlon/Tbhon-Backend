-- Facility invite codes for staff registration (Option B).

CREATE TABLE `facilities` (
    `facility_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `invite_code` VARCHAR(64) NOT NULL,
    `city` VARCHAR(100) NULL,
    `barangay` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `facilities_invite_code_key`(`invite_code`),
    PRIMARY KEY (`facility_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `users`
    ADD COLUMN `facility_id` VARCHAR(191) NULL;

CREATE INDEX `users_facility_id_idx` ON `users`(`facility_id`);

ALTER TABLE `users`
    ADD CONSTRAINT `users_facility_id_fkey`
    FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`facility_id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
