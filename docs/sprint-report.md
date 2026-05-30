# TBhon Sprint Report — Full System

## Executive Summary

This sprint delivered an end-to-end **TB screening platform** spanning a React Native (Expo) mobile app, Node.js/Express backend with MySQL persistence, a Python/FastAPI ML inference service, and ESP32 IoT device integration. Users can register, complete a guided screening session (symptoms + cough audio + sputum image), receive ML-driven risk scores with confidence outputs, and review past results across devices. The system is deployed on DigitalOcean with Cloudflare tunnels for reliable mobile HTTPS access.

---

## Build Progress Narrative

**TBhon Alpha Build includes:**

• user registration and login (JWT-backed accounts with profile data)  
• symptom checklist capture before screening  
• cough audio recording (3 attempts per session) with real-time quality validation  
• sputum/phlegm image capture and upload  
• CNN inference integration (Mel-spectrogram cough classifier + phlegm AFB load model)  
• detection confidence output (`prob_tb` / `prob_no_tb`, AFB load grade, risk level: low / moderate / high)  
• IoT screening device integration (ESP32 BLE Wi‑Fi setup, remote cough/sputum capture, server polling)  
• screening session persistence with raw media stored in the backend (MySQL via Prisma)  
• screening history, results review, and TB education content in the mobile app  
• cloud deployment of backend and ML inference APIs (DigitalOcean + Cloudflare tunnels)

This increment implements the full **TB screening workflow**—from account sign-in through symptom intake, multimodal capture (phone or IoT device), ML analysis, risk scoring, and stored results. **Clinical treatment recommendation and care-pathway features** (personalized treatment plans, provider referrals, clinician dashboards) are **out of scope for this release** and are not part of the current product roadmap. The **next sprint** focuses on **account security and communication**: two-factor authentication, authenticated password change, email verification, and notification integration.

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

---

### Module 1 — Core Input Module

Collects user identity, symptom data, and multimodal screening media from the phone or IoT device.

| Feature | Status | Evidence |
| --- | --- | --- |
| Authentication (registration, login, JWT session) | Done | Mobile: `mobile/app/login/login.tsx`, `mobile/app/signUp/signUp.tsx`, `mobile/utils/authStorage.ts`. Backend: `POST /auth/register`, `POST /auth/login` in `Tbhon-Backend/src/routes/auth.routes.ts`, `src/controllers/auth.controller.ts` |
| User profile data entry | Done | Mobile: `mobile/app/signUp/signUp.tsx` (registration fields), `mobile/app/profile/profilepage.tsx` (view/edit). Backend: `GET/PATCH /users/me`, `PUT /users/me/profile` in `src/routes/user.routes.ts`, `src/controllers/user.controller.ts` |
| Symptom checklist interface | Done | Mobile: `mobile/app/screening/checklist.tsx`, `mobile/constants/screeningChecklist.ts`. Backend: `checklist_payload` JSON column on `ScreeningSession` in `prisma/schema.prisma`; parsed in `src/controllers/screening.controller.ts` |
| Cough audio capture (3 attempts) | Done | Mobile: `mobile/app/screening/recording.tsx` (phone mic), `mobile/app/screening/iot-cough.tsx` (IoT device), `mobile/constants/iotScreening.ts` (`IOT_COUGH_COUNT = 3`). Quality gate: `mobile/utils/coughQualityCheck.ts` → ML `POST /check-quality` |
| Sputum/phlegm image capture | Done | Mobile: `mobile/app/screening/phlegm.tsx` (phone camera), `mobile/app/screening/iot-sputum.tsx` (IoT device). Review step: `mobile/app/screening/review.tsx` |
| IoT device setup input | Done | Mobile: `mobile/app/screening/iot-hardware.tsx` (hardware checklist), `mobile/services/bleWifiProvisioning.ts` (BLE scan for `ESP32-IOT-SETUP`, Wi‑Fi credential transfer), `mobile/services/iotApi.ts` (`fetchIotHealth`). Documented in `mobile/README.md` § Bluetooth |

---

### Module 2 — Core Processing Module

Persists data, runs screening business logic, and executes ML inference.

| Feature | Status | Evidence |
| --- | --- | --- |
| CRUD operations (users, sessions, media, predictions) | Done | Schema: `Tbhon-Backend/prisma/schema.prisma` (10 models: `User`, `ScreeningSession`, `CoughRecording`, `SputumImage`, `TbAudioPrediction`, `PhlegmPrediction`, etc.). Routes: `src/routes/auth.routes.ts`, `user.routes.ts`, `screening.routes.ts` |
| Screening session business logic | Done | `src/controllers/screening.controller.ts` — `createDraftScreening`, `completeScreening`, `listMyScreenings`, `getMyScreening`, `deleteIncompleteScreening`. Slot logic: `src/utils/coughAttempt.ts` (`MAX_COUGH_ATTEMPTS`, upsert per session slot). Cleanup: `src/services/incompleteScreeningCleanup.ts` |
| Raw media persistence | Done | `src/controllers/screening.media.controller.ts` — `attachCoughRecordingRaw`, `attachSputumImageRaw`, `downloadCoughRecording`, `downloadSputumImage`. DB columns: `cough_recordings.raw_data`, `sputum_images.raw_data` in `schema.prisma` |
| ML inference engine — cough | Done | `Tbhon/ml/infer_api.py` — `POST /check-quality` (cough authenticity metrics), `POST /predict` (Mel-spectrogram CNN → `prob_tb`, `prob_no_tb`). Training: `ml/train_tb_cough_cnn.py`, weights under `ml/runs/` |
| ML inference engine — sputum | Done | `Tbhon/ml/infer_api.py` — `POST /predict-phlegm` (AFB load: none / low / moderate / high). Model training: `Tbhon/ml (phlegm)/train_phlegm_cnn.py` |
| Risk scoring & result assembly | Done | Mobile merge logic: `mobile/app/screening/processing.tsx` (`mergeRisk`, cough `/predict` + phlegm `/predict-phlegm`). Backend persist: `completeScreening` in `screening.controller.ts` writes `ScreeningResult`, `TbAudioPrediction`, `PhlegmPrediction` rows |
| IoT upload processing | Done | `src/controllers/iot.controller.ts` — `iotUploadCough`, `iotUploadSputum`, `queueDeviceCommand`, `iotDeviceCommand`, `iotGetDeviceCommand`. Routes: `src/routes/iot.routes.ts` (`/iot/cough-recordings`, `/iot/sputum-images`, `/iot/device-command`). Auth: `src/middleware/iot.middleware.ts` (`X-IoT-Key`) |

---

### Module 3 — Output Module

Presents screening outcomes, history, and educational content to the user.

| Feature | Status | Evidence |
| --- | --- | --- |
| Screening results view | Done | `mobile/app/screening/result.tsx` — `RISK_CONFIG` (low / moderate / high), TB probability display, phlegm load grade, confidence, guidance text. Backend result stored in `screening_results` table |
| Detailed session report | Done | `mobile/app/screening/details.tsx` — cough attempt breakdown, quality badges (`mobile/components/CoughQualityBadge.tsx`), sputum sample (`mobile/app/components/SputumSamplePhoto.tsx`), checklist recap, audio/image replay via `buildServerSputumImageUrl` / download endpoints |
| Screening history | Done | `mobile/app/history/HistoryScreen.tsx` — calls `listMyScreenings()` from `mobile/services/backendApi.ts`; maps to `GET /screenings`. Cache: `mobile/utils/screeningHistoryCache.ts` |
| Home dashboard visualization | Done | `mobile/app/home/HomeScreen.tsx` — service tiles, bottom nav. Quick preview: `mobile/app/home/quickResultPreview/QuickResultPreviewCard.tsx`, `GaugeChart.tsx` |
| TB education content | Done | `mobile/app/learn/LearnContent.tsx` — symptoms, prevention, treatment awareness cards. Rendered from Home tab via `HomeScreen.tsx` |

*Notification outputs are not included in this sprint; planned for next sprint.*

---

### Module 4 — Integration Module

Connects the mobile app, backend, ML service, IoT hardware, and cloud infrastructure.

| Feature | Status | Evidence |
| --- | --- | --- |
| Mobile ↔ backend API | Done | `mobile/services/backendApi.ts` — `apiRequest()`, auth/screening/media helpers. Base URL: `EXPO_PUBLIC_API_URL` via `mobile/utils/apiBaseUrl.ts`. Mobile env: `mobile/.env` |
| Mobile ↔ ML API | Done | `mobile/app/screening/processing.tsx` — multipart POST to `/predict` and `/predict-phlegm`. Base URL: `EXPO_PUBLIC_TB_API_URL` via `mobile/utils/tbApiUrl.ts` |
| IoT device API | Done | `Tbhon-Backend/src/routes/iot.routes.ts` — `/iot/health`, `/iot/cough-recordings`, `/iot/sputum-images`, `/iot/device-command`, `/iot/trigger`. Shared secret: `IOT_API_KEY` in backend `.env` |
| ESP32 ↔ backend integration | Done | Mobile queues commands: `queueIotDeviceAudioStartCommand`, `pollForNewCoughRecording` in `mobile/services/backendApi.ts`. Device uploads handled in `iot.controller.ts`. Mobile polling: `mobile/app/screening/iot-cough.tsx`, `iot-sputum.tsx` |
| Cloud deployment | Done | Backend droplet: `Tbhon-Backend/docs/02-backend-droplet-setup.md` (PM2, port 4000). ML droplet: `docs/07-ml-droplet-setup.md` (systemd uvicorn, port 8000). Database: `docs/03-database-setup.md` (DigitalOcean Managed MySQL + TLS) |
| HTTPS tunnel integration | Done | `Tbhon-Backend/docs/08-cloudflare-tunnels.md` — `tbhon-backend-tunnel` → `:4000`, `tbhon-ml-tunnel` → `:8000`. Architecture overview: `docs/01-how-it-works.md` |
| API documentation | Done | `Tbhon-Backend/src/openapi.ts` (full OpenAPI 3 spec). Served at `/docs` (Swagger UI) and `/docs.json` via `src/app.ts` |

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

### Planned for next sprint

| Item | Description |
| --- | --- |
| Two-factor authentication (2FA) | Additional account security layer at login |
| Authenticated password change | Password update for signed-in users |
| Email verification | Verify user email addresses on registration or change |
| Notification integration | Push or in-app notifications for account and screening events |

### Other deferred work (not next sprint)

| Item | Notes |
| --- | --- |
| Refresh-token auth rotation | Documented TODO; current JWT is client-persisted |
| Stable production tunnel URLs | Quick tunnels rotate; named tunnel migration pending |
| Model clinical validation | Alpha models integrated; validation study pending |
| Automated E2E test suite | Manual verification only this sprint |

---

## Known Issues & Technical Debt

- **Tunnel URL rotation:** Cloudflare quick tunnel URLs change on restart; mobile `.env` must be updated manually until named tunnels are configured.
- **Auth hardening:** No refresh-token flow, 2FA, or email verification yet — all planned for next sprint.
- **ML accuracy:** Cough model performance (~51% macro F1) is adequate for pipeline testing but not for standalone clinical use.
- **Dual capture paths:** Phone and IoT flows coexist; IoT is the primary path from home; phone recording remains as fallback in review routing.
- **iOS/cellular networking:** Resolved via HTTPS tunnels; LAN-only ML URLs fail on carrier data (by design, documented).

---

## Verification & Testing

| Area | Method | Result |
| --- | --- | --- |
| Backend API | Swagger UI + manual calls | Auth, screening, media routes exercised |
| ML API | `smoke_test_infer.py`, `/healthz` | Inference endpoints respond |
| Mobile ↔ backend | Dev builds against tunnel URLs | Registration, screening completion, history |
| IoT uploads | Device key + debug endpoint | Cough/sputum received and linked to sessions |
| Cross-device media | Download endpoints with bearer token | Audio/image replay on second device |

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

The sprint successfully integrated all major subsystems into a working **Alpha** release: mobile UX, backend persistence, dual ML models, IoT hardware path, and cloud deployment. The product supports a complete user journey from login to stored screening results with confidence-based risk output.

Clinical treatment and care-pathway capabilities remain outside the current scope. The next sprint will strengthen the platform with **two-factor authentication, authenticated password change, email verification, and notification integration**.
