# Product gaps vs target (updated)

| # | Gap | Status | Notes |
|---|-----|--------|-------|
| 8 | Real staff role in backend | **Done (alpha)** | `User.role` (`STAFF` \| `ADMIN` \| `PATIENT`), JWT carries role, `requireStaff` on screening mutations |
| 9 | Staff-only "Start screening" gate | **Done (alpha)** | Mobile home checks role; backend returns 403 for non-staff on draft/complete/IoT |
| 10 | Persist smear skip reason + staff notes | **Done** | `screening_sessions.sputum_skip_reason`, `staff_notes`; sent on `POST /screenings` |
| 11 | Staff confirm-before-show-result | **Done** | `staff-review` screen before `result`; `staff_result_confirmed_at` on session |
| 12 | 2FA / password change / push | **Partial** | Authenticated password change + email verification exist; 2FA and push = next sprint |
| 13 | Automated E2E tests | **Partial** | Unit tests for roles/referral (`npm test`); full device E2E still manual |
| 14 | Patient portal | **Not started** | History remains on facility login; `PATIENT` role reserved in schema |
| 15 | Referral tracking | **Done (alpha)** | `referral_status` on results; auto `recommended` for moderate/high; `PATCH /screenings/:id/referral` + details UI |

## Deploy checklist

1. **Backend:** `npx prisma migrate deploy` (migration `20260607120000_staff_roles_session_audit_referral`)
2. **Backend:** restart API (`pm2 restart` or redeploy)
3. **Mobile:** pull latest; staff flow goes processing → **Staff review** → result

## Still next sprint

- 2FA login flow
- Push notifications (Expo)
- Patient self-service history (`PATIENT` role + separate auth)
- Playwright / Detox full screening E2E
