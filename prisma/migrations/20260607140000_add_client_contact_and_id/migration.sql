ALTER TABLE `screening_clients`
  ADD COLUMN `contact_number` VARCHAR(30) NOT NULL DEFAULT '' AFTER `city`,
  ADD COLUMN `emergency_contact_name` VARCHAR(100) NULL AFTER `contact_number`,
  ADD COLUMN `emergency_contact_phone` VARCHAR(30) NULL AFTER `emergency_contact_name`,
  ADD COLUMN `emergency_contact_relation` VARCHAR(60) NULL AFTER `emergency_contact_phone`,
  ADD COLUMN `government_id_type` VARCHAR(50) NULL AFTER `emergency_contact_relation`,
  ADD COLUMN `government_id_number` VARCHAR(100) NULL AFTER `government_id_type`;
