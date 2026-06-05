# TBhon Sprint Report — Full System

## Executive Summary

This sprint delivered the **TBhon Alpha** platform across mobile, backend, ML, IoT, and cloud infrastructure. **Cough audio capture**, **sputum/phlegm image capture**, **raw media persistence**, **risk scoring & result assembly**, and **screening results view** are verified **Done**. **IoT device setup** (in-app BLE Wi‑Fi provisioning requires native deployment build; **ESP32 firmware** uses hardcoded Wi‑Fi for bench testing—not the app) and **cough audio playback in the session details view** remain **in progress**.

---

## Build Progress Narrative

**TBhon Alpha Build includes:**

• user registration and login (JWT-backed accounts with profile data)  
• symptom checklist capture before screening  
• cough audio recording (3 attempts per session) with real-time quality validation  
• IoT device setup *(in progress — hardware checklist + service health check in app; full BLE Wi‑Fi provisioning from phone blocked until native app deployment; **ESP32 firmware** uses hardcoded Wi‑Fi for bench testing, not the mobile app)*  
• sputum/phlegm image capture (IoT device flow — device poll, upload, review)  
• CNN inference integration (Mel-spectrogram cough classifier + phlegm AFB load model)  
• detection confidence output (`prob_tb` / `prob_no_tb`, AFB load grade, risk level: low / moderate / high)  
• screening session persistence with raw media stored in the backend (MySQL via Prisma)  
• screening history, results review, and TB education content in the mobile app  
• cloud deployment of backend and ML inference APIs (DigitalOcean + Cloudflare tunnels)

This increment implements the **TB screening workflow** architecture—from account sign-in through symptom intake, multimodal capture, ML analysis, risk scoring, and stored results. **Cough capture, sputum capture, raw media storage, risk scoring, and results reporting are complete**. **IoT device setup** (pending native build for BLE/Wi‑Fi permissions) and **audio playback in the session details view** remain **in progress**. **Clinical treatment recommendation and care-pathway features** remain out of scope and are not on the current roadmap. The **next sprint** focuses on **account security and communication** (see module mapping below).

---

## System Architecture

```text
Expo mobile app
  -> EXPO_PUBLIC_API_URL  (https://<backend-tunnel>.trycloudflare.com)
  -> Cloudflare edge -> Node/Express backend (PM2, :4000) -> Managed MySQL

Expo mobile app
  -> EXPO_PUBLIC_TB_API_URL  (https://<ml-tunnel>.trycloudflare.com)
  -> Cloudflare edge -> Python/FastAPI ML API (systemd, :8000) -> model weights

ESP32 IoT device
  -> X-IoT-Key authenticated uploads -> backend /iot/*
  <- device commands (audio start/stop, sputum capture trigger)

Mobile app
  -> BLE Wi‑Fi provisioning -> ESP32 (native dev/EAS build required)
```

| Layer | Technology | Role |
| --- | --- | --- |
| Mobile | Expo / React Native | User-facing screening, results, history |
| Backend | Node.js, Express, Prisma | Auth, sessions, media storage, IoT API |
| Database | DigitalOcean Managed MySQL | Users, screenings, predictions, raw media |
| ML | Python, FastAPI, PyTorch | Cough TB probability, phlegm AFB load, quality gate |
| IoT | ESP32 + BLE | Wi‑Fi provisioning, device-triggered capture |
| Infrastructure | PM2, systemd, cloudflared | Production hosting and HTTPS tunnels |

---

## Sprint Deliverables

Deliverables are organized by system module. Each feature lists its implementation status and evidence in the codebase or deployed infrastructure.

### Status definitions

| Status | Meaning |
| --- | --- |
| **Done** | Implemented and verified working in the current environment |
| **In Progress** | Implemented in codebase but not verified end-to-end; open bugs or incomplete integration |
| **Not Started** | Planned for a future sprint; no implementation yet |

**Transparency note:** Features with open bugs, missing deployment prerequisites, or unverified E2E flow are marked **In Progress**. **IoT device setup** is implemented in the **mobile app** (`bleWifiProvisioning.ts`, hardware checklist) but BLE Wi‑Fi transfer is not fully exercisable until a **native development/EAS build** (Bluetooth permissions; not Expo Go). **Bench testing:** the **ESP32 firmware** is flashed/configured with **hardcoded Wi‑Fi credentials**—this is not an app setting. **Raw media persistence** and **sputum capture** are **Done**. The remaining open bug is **cough audio playback in the session details view**, not media storage or sputum capture.

---

### Module 1 — Core Input Module

Collects user identity, symptom data, and multimodal screening media from the phone or IoT device.

| Feature | Status | Evidence |
| --- | --- | --- |
| Authentication (registration, login, JWT session) | Done | Mobile: `mobile/app/login/login.tsx`, `mobile/app/signUp/signUp.tsx`, `mobile/utils/authStorage.ts`. Backend: `POST /auth/register`, `POST /auth/login` in `Tbhon-Backend/src/routes/auth.routes.ts`, `src/controllers/auth.controller.ts` |
| User profile data entry | Done | Mobile: `mobile/app/signUp/signUp.tsx`, `mobile/app/profile/profilepage.tsx`. Backend: `GET/PATCH /users/me`, `PUT /users/me/profile` in `src/routes/user.routes.ts`, `src/controllers/user.controller.ts` |
| Symptom checklist interface | Done | Mobile: `mobile/app/screening/checklist.tsx`, `mobile/constants/screeningChecklist.ts`. Backend: `checklist_payload` on `ScreeningSession` in `prisma/schema.prisma` |
| Cough audio capture (3 attempts) | Done | Mobile: `mobile/app/screening/recording.tsx`, `mobile/app/screening/iot-cough.tsx`, `IOT_COUGH_COUNT = 3` in `constants/iotScreening.ts`. Quality gate: `utils/coughQualityCheck.ts` → `POST /check-quality` |
| Sputum/phlegm image capture | Done | Mobile: `mobile/app/screening/iot-sputum.tsx`, `mobile/app/screening/phlegm.tsx`, `mobile/app/screening/review.tsx`. Backend: `iotUploadSputum` in `iot.controller.ts`, `sputum_images.raw_data`. **E2E verified — no failures** |
| IoT device setup input | In Progress | Mobile: `mobile/app/screening/iot-hardware.tsx` (checklist, `fetchIotHealth`), `mobile/services/bleWifiProvisioning.ts` (app sends SSID/password over BLE when native build available). **Blocked:** BLE provisioning from app needs native build (not Expo Go) per `mobile/README.md`. **Bench testing:** **ESP32 firmware only** has hardcoded Wi‑Fi; app does not hardcode network credentials |

---

### Module 2 — Core Processing Module

Persists data, runs screening business logic, and executes ML inference.

| Feature | Status | Evidence |
| --- | --- | --- |
| CRUD operations (users, sessions, media, predictions) | Done | Schema: `Tbhon-Backend/prisma/schema.prisma` (10 models). Routes: `src/routes/auth.routes.ts`, `user.routes.ts`, `screening.routes.ts` |
| Screening session business logic | In Progress | `src/controllers/screening.controller.ts` — draft/complete/list/get. Slot logic: `src/utils/coughAttempt.ts`. **Core flow works; full E2E sign-off pending details playback fix** |
| Raw media persistence | Done | `src/controllers/screening.media.controller.ts` — `attachCoughRecordingRaw`, `attachSputumImageRaw`, `downloadCoughRecording`, `downloadSputumImage`. DB: `cough_recordings.raw_data`, `sputum_images.raw_data` in `schema.prisma`. Store and download verified |
| ML inference engine — cough | Done | `Tbhon/ml/infer_api.py` — `POST /check-quality`, `POST /predict`. Training: `ml/train_tb_cough_cnn.py`. **API responds in isolation** (`ml/smoke_test_infer.py`, `/healthz`) |
| ML inference engine — sputum | Done | `Tbhon/ml/infer_api.py` — `POST /predict-phlegm`. Training: `Tbhon/ml (phlegm)/train_phlegm_cnn.py`. **E2E verified via processing screen** |
| Risk scoring & result assembly | Done | Mobile: `mobile/app/screening/processing.tsx` (`mergeRisk`, cough `/predict` + phlegm `/predict-phlegm`). Backend: `completeScreening` in `screening.controller.ts` writes `ScreeningResult`, `TbAudioPrediction`, `PhlegmPrediction` |
| IoT upload processing | Done | `src/controllers/iot.controller.ts` — `iotUploadCough`, `iotUploadSputum`. Routes: `src/routes/iot.routes.ts`. **Cough and sputum device uploads verified** |

---

### Module 3 — Output Module

Presents screening outcomes, history, and educational content to the user.

| Feature | Status | Evidence |
| --- | --- | --- |
| Screening results view | Done | `mobile/app/screening/result.tsx` — `RISK_CONFIG` (low / moderate / high), TB probability, phlegm load grade, confidence, guidance text. Backend: `screening_results` table |
| Detailed session report | Done | `mobile/app/screening/details.tsx` — cough breakdown, `CoughQualityBadge.tsx`, `SputumSamplePhoto.tsx`, checklist recap, sputum image display |
| Cough audio playback (session details) | In Progress | `mobile/app/screening/details.tsx` — `playAudioAt()` via Expo AV (`Audio.Sound.loadAsync`). **Open bug: playback fails in details view; raw media storage/download is Done** |
| Screening history | Done | `mobile/app/history/HistoryScreen.tsx` → `GET /screenings` via `backendApi.ts`. Cache: `mobile/utils/screeningHistoryCache.ts` |
| Home dashboard visualization | Done | `mobile/app/home/HomeScreen.tsx`, `QuickResultPreviewCard.tsx`, `GaugeChart.tsx` |
| TB education content | Done | `mobile/app/learn/LearnContent.tsx` |
| Notification outputs | Not Started | Planned for next sprint — see **Next sprint module mapping** below |

---

### Module 4 — Integration Module

Connects the mobile app, backend, ML service, IoT hardware, and cloud infrastructure.

| Feature | Status | Evidence |
| --- | --- | --- |
| Mobile ↔ backend API | Done | `mobile/services/backendApi.ts`, `EXPO_PUBLIC_API_URL` via `mobile/utils/apiBaseUrl.ts` |
| Mobile ↔ ML API | Done | `mobile/app/screening/processing.tsx` → `/predict`, `/predict-phlegm`; `EXPO_PUBLIC_TB_API_URL` via `mobile/utils/tbApiUrl.ts`. **E2E verified with cough + sputum capture** |
| IoT device API | Done | `Tbhon-Backend/src/routes/iot.routes.ts` — `/iot/health`, uploads, commands. Auth: `IOT_API_KEY`, `src/middleware/iot.middleware.ts` |
| ESP32 ↔ backend integration | Done | `backendApi.ts` command/poll helpers; `iot-cough.tsx`, `iot-sputum.tsx`; `iot.controller.ts`. **Cough and sputum device capture/upload verified** |
| Cloud deployment | Done | `docs/02-backend-droplet-setup.md`, `07-ml-droplet-setup.md`, `03-database-setup.md` |
| HTTPS tunnel integration | Done | `docs/08-cloudflare-tunnels.md`, `docs/01-how-it-works.md` |
| API documentation | Done | `src/openapi.ts`; `/docs` Swagger UI in `src/app.ts` |
| Email / push provider integration | Not Started | Planned for next sprint — see **Next sprint module mapping** below |

---

## End-to-End Screening Workflow

1. **Authenticate** — User registers or logs in; JWT stored on device.
2. **Start screening** — Draft session created on backend; IoT hardware checks optional.
3. **Symptom checklist** — Client checklist JSON persisted with session.
4. **Capture cough (×3)** — Phone mic or IoT device; each clip runs `/check-quality` before acceptance.
5. **Capture sputum** — Phone camera or IoT camera; image uploaded to backend.
6. **Review inputs** — User confirms audio and image before analysis.
7. **ML inference** — Cough clips → `/predict`; sputum → `/predict-phlegm`; risks merged.
8. **Persist results** — Backend stores predictions, risk level, recommendation text, raw media.
9. **View outcome** — Result screen shows risk tier, confidence, and next-step guidance.
10. **History** — Past sessions listed and drill-down to full report with media playback.

---

## Scope Boundaries

### Out of scope for this release (not on current roadmap)

| Item | Notes |
| --- | --- |
| Clinical treatment recommendations | Screening-only product scope |
| Personalized treatment plans | Not planned for current roadmap |
| Provider referrals | Not planned for current roadmap |
| Clinician / provider dashboards | Not planned for current roadmap |

The app displays **risk-tier guidance text** (low / moderate / high) as part of screening results. That is informational output from the screening workflow, not a clinical care-pathway or treatment system.

### Planned for next sprint — module mapping

Next-sprint work spans **three modules**. No next-sprint item is **Done** yet.

| Feature | Primary module | Secondary module | What gets built |
| --- | --- | --- | --- |
| Two-factor authentication (2FA) | **Module 1 — Core Input** | **Module 2 — Core Processing** | Login/verification UI (OTP entry, setup flow); backend token generation, validation, and 2FA state storage |
| Authenticated password change | **Module 1 — Core Input** | **Module 2 — Core Processing** | Password change screen for signed-in users; backend verifies current password before hashing and storing the new one |
| Email verification | **Module 1 — Core Input** | **Module 4 — Integration** | Verification prompt/link UI on registration or email change; external email delivery service wired through backend |
| Notification integration | **Module 3 — Output** | **Module 4 — Integration** | In-app or push notification surfaces for account and screening events; FCM/APNs or equivalent provider connected via backend |

```text
Module 1 (Input)          Module 2 (Processing)     Module 3 (Output)        Module 4 (Integration)
─────────────────         ───────────────────────     ─────────────────        ──────────────────────
2FA login UI        →     2FA verify/store logic
Password change UI  →     Password update logic
Email verify UI     →                               →                          → email provider
                                                      notification UI    →     → push provider
```

### Other deferred work (not next sprint)

| Item | Notes |
| --- | --- |
| Refresh-token auth rotation | Documented TODO; current JWT is client-persisted |
| Stable production tunnel URLs | Quick tunnels rotate; named tunnel migration pending |
| Model clinical validation | Alpha models integrated; validation study pending |
| Automated E2E test suite | Manual verification only this sprint |

---

## Module 1 — Core Input Module (Summary)

**Purpose:** Collect user identity, symptom data, and multimodal screening media from the phone or IoT device.

| Metric | Count |
| --- | ---: |
| Features | 6 |
| **Done** | 5 |
| **In Progress** | 1 |

| Feature | Status | Notes |
| --- | --- | --- |
| Authentication (registration, login, JWT session) | **Done** | `login.tsx`, `signUp.tsx`, `authStorage.ts`; `POST /auth/register`, `POST /auth/login` |
| User profile data entry | **Done** | Sign-up + profile edit; `GET/PATCH /users/me`, `PUT /users/me/profile` |
| Symptom checklist interface | **Done** | 11-question yes/no flow; `checklist_payload` persisted on session |
| Cough audio capture (3 attempts) | **Done** | Phone (`recording.tsx`) + IoT (`iot-cough.tsx`); quality gate via `POST /check-quality` |
| Sputum/phlegm image capture | **Done** | `iot-sputum.tsx`, `phlegm.tsx`, `review.tsx` → `processing.tsx` `/predict-phlegm`; IoT upload to backend verified |
| IoT device setup input | **In Progress** | App: checklist + `/iot/health`. App BLE Wi‑Fi (`bleWifiProvisioning.ts`) blocked until native build. **ESP32 firmware** uses hardcoded Wi‑Fi for testing—not the app |

**Module 1 readiness:** Account intake, cough capture, and sputum capture are production-ready for this sprint. **In-app BLE Wi‑Fi provisioning** (phone → ESP32) remains blocked until a native app build. Bench tests rely on **hardcoded Wi‑Fi in ESP32 firmware**, not in the mobile app.

---

## Known Issues Log

| Issue | Severity | Planned Fix |
| --- | --- | --- |
| Cough audio playback fails in session details view (`details.tsx` `playAudioAt`) despite raw media storing correctly | **High** | Fix Expo AV playback URI/headers for server-downloaded cough clips; verify replay from `GET .../cough-recordings/.../file` |
| IoT BLE Wi‑Fi provisioning cannot be used in Expo Go; requires native build for Bluetooth scan and credential write from the **app** | **High** | Produce **EAS / development build**; exercise `scanAndConnectEsp32Setup()` from app; optionally update **ESP32 firmware** to accept BLE-provisioned Wi‑Fi instead of hardcoded credentials |
| IoT device setup incomplete in current environment — cannot fully exercise Bluetooth + in-app Wi‑Fi setup | **Medium** | Native deployment + OS Bluetooth permissions; tester setup guide |
| Screening session completion not verified E2E end-to-end | **Medium** | Re-test full draft → complete flow after details playback fix |
| Cloudflare quick tunnel URLs rotate on restart; mobile `.env` must be updated manually | **Medium** | Named Cloudflare tunnels with stable hostnames (`docs/08-cloudflare-tunnels.md`) |
| Cough ML model ~51% macro F1 — integration only, not clinically validated | **Medium** | Retrain/evaluate; document limits (not same-sprint blocker) |
| JWT client-persisted only; no refresh-token rotation or session revocation | **Low** | **Next sprint:** 2FA, password change, email verification, token hardening |
| No automated E2E or unit test suite for screening flow | **Low** | Add smoke/E2E tests after remaining bugs stabilized |
| Dual capture paths (phone mic vs IoT) increase test surface; IoT primary from home | **Low** | Document test matrix; narrow fallbacks once IoT provisioning stable |

---

## Known Issues & Technical Debt (reference)

- **IoT device setup (deployment dependency):** App has checklist UI, `GET /iot/health`, and `bleWifiProvisioning.ts` (BLE Wi‑Fi write). Full app-side provisioning needs a **native build** (EAS/dev client)—Expo Go lacks Bluetooth access. **Bench workaround:** **ESP32 firmware** is programmed with **hardcoded Wi‑Fi**; the mobile app does not store or hardcode SSID/password.
- **Open bugs (in progress):** **Cough audio playback in session details view** (`details.tsx`) — playback fails; **raw media persistence and sputum capture are Done**.
- **Tunnel URL rotation:** Cloudflare quick tunnel URLs change on restart; mobile `.env` must be updated manually until named tunnels are configured.
- **Auth hardening:** No 2FA, email verification, or authenticated password change yet — planned for next sprint (Module 1 + 2 + 4).
- **ML accuracy:** Cough model performance (~51% macro F1) is adequate for pipeline testing but not for standalone clinical use.
- **Dual capture paths:** Phone and IoT flows coexist; IoT is the primary path from home; phone recording remains as fallback in review routing.
- **iOS/cellular networking:** Resolved via HTTPS tunnels; LAN-only ML URLs fail on carrier data (by design, documented).

---

## Verification & Testing

| Area | Method | Result |
| --- | --- | --- |
| Backend API | Swagger UI + manual calls | Auth, user, and listing routes verified |
| ML API | `smoke_test_infer.py`, `/healthz` | Inference endpoints respond in isolation |
| Mobile ↔ backend | Dev builds against tunnel URLs | Registration, login, profile, history listing verified |
| Cough audio capture | Manual device testing | **Done** — phone and IoT cough flow verified |
| IoT device setup | Hardware checklist + `/iot/health` | **Partial** — UI and service probe work |
| IoT BLE Wi‑Fi provisioning | `bleWifiProvisioning.ts` (app) | **In progress** — requires native app build; **ESP32 firmware** uses hardcoded Wi‑Fi for bench tests |
| Risk scoring & result assembly | Processing screen + `completeScreening` | **Done** — cough/phlegm merge and result persist verified |
| Raw media persistence | Upload attach + download endpoints | **Done** — `raw_data` stored and retrievable |
| Screening results view | Result screen after processing | **Done** |
| Detailed session report | Details layout and data display | **Done** |
| Cough audio playback (session details) | Tap-to-play in `details.tsx` | **In progress — open playback bug** |
| Sputum capture E2E | Manual device testing | **Done** — IoT poll, upload, review → processing verified |
| IoT sputum uploads | Device key + debug endpoint | **Done** — `POST /iot/sputum-images` linked to session |

Automated E2E and unit test suites are not yet in place for this sprint.

---

## Sprint Metrics (Qualitative)

| Metric | Value |
| --- | --- |
| Sprint deliverable modules | 4 (Input, Processing, Output, Integration) |
| Mobile screens / routes | ~15 screening + 8 core app screens |
| Backend route groups | Auth, users, screenings, IoT |
| Database models | 10 (users through screening results) |
| ML inference endpoints | 3 (+ health) |
| Production droplets | 2 (backend + ML) |
| Deployment docs | 9 operational guides |

---

## Conclusion

This sprint established the **TBhon Alpha** platform: mobile app shell, backend persistence, ML inference APIs, IoT API surface, and cloud deployment. **Cough audio capture**, **sputum capture**, **raw media persistence**, **risk scoring**, and **results reporting** are verified **Done**. **IoT device setup** (pending native build for BLE/Wi‑Fi) and **details-view audio playback** remain **In Progress**.

Clinical treatment and care-pathway capabilities remain outside the current scope. The next sprint adds **account security and communication** features mapped across **Modules 1, 2, 3, and 4**: two-factor authentication, authenticated password change, email verification, and notification integration.
