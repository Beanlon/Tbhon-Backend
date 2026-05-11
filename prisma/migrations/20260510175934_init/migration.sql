-- CreateTable
CREATE TABLE `users` (
    `user_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone_number` VARCHAR(30) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_profiles` (
    `profile_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `birthdate` DATE NOT NULL,
    `gender` VARCHAR(30) NOT NULL,
    `street` VARCHAR(255) NULL,
    `barangay` VARCHAR(100) NULL,
    `city` VARCHAR(100) NULL,

    UNIQUE INDEX `user_profiles_user_id_key`(`user_id`),
    PRIMARY KEY (`profile_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `screening_sessions` (
    `session_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `final_risk_level` VARCHAR(50) NULL,
    `average_tb_probability` DOUBLE NULL,
    `upload_error` BOOLEAN NOT NULL DEFAULT false,
    `api_attempt` VARCHAR(100) NULL,

    INDEX `screening_sessions_user_id_idx`(`user_id`),
    PRIMARY KEY (`session_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `symptom_questions` (
    `question_id` VARCHAR(191) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `question_text` TEXT NOT NULL,
    `subtext` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `symptom_questions_category_idx`(`category`),
    PRIMARY KEY (`question_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `symptom_responses` (
    `response_id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `question_id` VARCHAR(191) NOT NULL,
    `answer_value` BOOLEAN NOT NULL,

    INDEX `symptom_responses_question_id_idx`(`question_id`),
    UNIQUE INDEX `symptom_responses_session_id_question_id_key`(`session_id`, `question_id`),
    PRIMARY KEY (`response_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cough_recordings` (
    `recording_id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `file_uri` TEXT NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cough_recordings_session_id_idx`(`session_id`),
    PRIMARY KEY (`recording_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cough_quality_checks` (
    `quality_check_id` VARCHAR(191) NOT NULL,
    `recording_id` VARCHAR(191) NOT NULL,
    `ok` BOOLEAN NOT NULL,
    `label` VARCHAR(100) NULL,
    `reasons_json` JSON NULL,

    UNIQUE INDEX `cough_quality_checks_recording_id_key`(`recording_id`),
    PRIMARY KEY (`quality_check_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tb_audio_predictions` (
    `prediction_id` VARCHAR(191) NOT NULL,
    `recording_id` VARCHAR(191) NOT NULL,
    `spoof` BOOLEAN NOT NULL DEFAULT false,
    `prob_no_tb` DOUBLE NOT NULL,
    `prob_tb` DOUBLE NOT NULL,
    `predicted_class` INTEGER NOT NULL,
    `model_path` TEXT NULL,
    `predicted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tb_audio_predictions_recording_id_key`(`recording_id`),
    PRIMARY KEY (`prediction_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sputum_images` (
    `image_id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `file_uri` TEXT NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `captured_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sputum_images_session_id_key`(`session_id`),
    PRIMARY KEY (`image_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phlegm_predictions` (
    `phlegm_prediction_id` VARCHAR(191) NOT NULL,
    `image_id` VARCHAR(191) NOT NULL,
    `predicted_load` VARCHAR(100) NOT NULL,
    `confidence` DOUBLE NOT NULL,
    `probabilities_json` JSON NULL,
    `checkpoint` TEXT NULL,
    `predicted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `phlegm_predictions_image_id_key`(`image_id`),
    PRIMARY KEY (`phlegm_prediction_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `screening_results` (
    `result_id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `risk_level` VARCHAR(50) NOT NULL,
    `recommendation` TEXT NOT NULL,
    `invalid_audio` BOOLEAN NOT NULL DEFAULT false,
    `invalid_audio_label` VARCHAR(100) NULL,
    `invalid_audio_reasons_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `screening_results_session_id_key`(`session_id`),
    PRIMARY KEY (`result_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `screening_sessions` ADD CONSTRAINT `screening_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `symptom_responses` ADD CONSTRAINT `symptom_responses_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `screening_sessions`(`session_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `symptom_responses` ADD CONSTRAINT `symptom_responses_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `symptom_questions`(`question_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cough_recordings` ADD CONSTRAINT `cough_recordings_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `screening_sessions`(`session_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cough_quality_checks` ADD CONSTRAINT `cough_quality_checks_recording_id_fkey` FOREIGN KEY (`recording_id`) REFERENCES `cough_recordings`(`recording_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tb_audio_predictions` ADD CONSTRAINT `tb_audio_predictions_recording_id_fkey` FOREIGN KEY (`recording_id`) REFERENCES `cough_recordings`(`recording_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sputum_images` ADD CONSTRAINT `sputum_images_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `screening_sessions`(`session_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phlegm_predictions` ADD CONSTRAINT `phlegm_predictions_image_id_fkey` FOREIGN KEY (`image_id`) REFERENCES `sputum_images`(`image_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `screening_results` ADD CONSTRAINT `screening_results_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `screening_sessions`(`session_id`) ON DELETE CASCADE ON UPDATE CASCADE;
