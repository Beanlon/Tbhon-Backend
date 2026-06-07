const test = require("node:test");
const assert = require("node:assert/strict");
const { canRunScreenings, parseUserRole } = require("../constants/userRole");
const { parseReferralStatus, referralStatusForRisk } = require("../constants/referralStatus");

test("parseUserRole defaults unknown to STAFF", () => {
  assert.equal(parseUserRole(undefined), "STAFF");
  assert.equal(parseUserRole("PATIENT"), "PATIENT");
});

test("canRunScreenings allows booth staff and admins only", () => {
  assert.equal(canRunScreenings("STAFF"), true);
  assert.equal(canRunScreenings("ADMIN"), true);
  assert.equal(canRunScreenings("PATIENT"), false);
});

test("referralStatusForRisk maps moderate/high to recommended", () => {
  assert.equal(referralStatusForRisk("low"), "none");
  assert.equal(referralStatusForRisk("moderate"), "recommended");
  assert.equal(referralStatusForRisk("high"), "recommended");
});

test("parseReferralStatus accepts documented and completed", () => {
  assert.equal(parseReferralStatus("documented"), "documented");
  assert.equal(parseReferralStatus("completed"), "completed");
  assert.equal(parseReferralStatus("invalid"), null);
});
