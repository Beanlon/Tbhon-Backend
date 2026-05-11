-- Persist submitted symptom/exposure checklist JSON on each screening (History details).

ALTER TABLE `screening_sessions` ADD COLUMN `checklist_payload` JSON NULL;
