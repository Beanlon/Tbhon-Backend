-- Existing PATIENT accounts created before permanent patient QR support
-- need a code too; otherwise Profile > My TBhon QR has nothing to render.
UPDATE `users`
SET `patient_public_code` = LOWER(HEX(RANDOM_BYTES(8)))
WHERE `role` = 'PATIENT'
  AND `patient_public_code` IS NULL;
