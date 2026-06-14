ALTER TABLE `user_profiles`
  ADD COLUMN `emergency_contact_name` VARCHAR(100) NULL,
  ADD COLUMN `emergency_contact_phone` VARCHAR(30) NULL,
  ADD COLUMN `emergency_contact_relation` VARCHAR(60) NULL,
  ADD COLUMN `government_id_type` VARCHAR(50) NULL,
  ADD COLUMN `government_id_number` VARCHAR(100) NULL;
