const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeFacilityInviteCode,
  facilityInviteCodeValidationError,
} = require("../utils/facilityInvite");

test("normalizeFacilityInviteCode trims and uppercases", () => {
  assert.equal(normalizeFacilityInviteCode("  rhu-malay-2026  "), "RHU-MALAY-2026");
  assert.equal(normalizeFacilityInviteCode("tb hon x"), "TBHONX");
});

test("facilityInviteCodeValidationError rejects empty and invalid codes", () => {
  assert.equal(facilityInviteCodeValidationError(""), "Facility invite code is required.");
  assert.equal(facilityInviteCodeValidationError("abc"), "Use 6–64 letters, numbers, or hyphens (e.g. RHU-MALAY-2026).");
  assert.equal(facilityInviteCodeValidationError("RHU-MALAY-2026"), null);
});
