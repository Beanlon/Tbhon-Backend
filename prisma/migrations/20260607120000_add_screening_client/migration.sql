-- Per-session client record (person screened), separate from facility User account.

CREATE TABLE `screening_clients` (
    `client_id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `birthdate` DATE NOT NULL,
    `gender` VARCHAR(30) NOT NULL,
    `street` VARCHAR(255) NULL,
    `barangay` VARCHAR(100) NULL,
    `city` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `screening_clients_session_id_key`(`session_id`),
    PRIMARY KEY (`client_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `screening_clients` ADD CONSTRAINT `screening_clients_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `screening_sessions`(`session_id`) ON DELETE CASCADE ON UPDATE CASCADE;
