/**
 * OpenAPI 3 spec for the Tbhon backend.
 *
 * Served at `/docs` (Swagger UI) and `/docs.json` (raw spec) via app.ts.
 *
 * Conventions:
 *  - `bearerAuth` is the JWT issued by /auth/login or /auth/register.
 *  - `iotKey`     is the X-IoT-Key header gated on `IOT_API_KEY`.
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Tbhon Backend API",
    version: "1.0.0",
    description:
      "REST API for the Tbhon TB screening app.\n\n" +
      "Two authentication schemes are used:\n" +
      "- **bearerAuth** (JWT) — issued by `/auth/login` and `/auth/register`. Used by the mobile app and **Screening media** routes.\n" +
      "- **iotKey** (`X-IoT-Key` header) — shared secret for ESP32 / microcontroller uploads under `/iot/*`. Set `IOT_API_KEY` in the backend `.env`.\n\n" +
      "### Try Screening media in Swagger\n" +
      "1. `POST /auth/login` with your email + password.\n" +
      "2. Copy the `token` field from the response (JWT only — **not** the word `Bearer`).\n" +
      "3. Click **Authorize** (lock icon, top right) → paste the token → **Authorize**.\n" +
      "4. Call `POST /screenings` first to get a real `sessionId` + `recordingId`, then upload via the `/raw` endpoints with a `file`.\n\n" +
      "Raw cough audio and sputum images are persisted server-side in the `cough_recordings` and `sputum_images` tables so any device on the same account can later download/play the original media.",
  },
  servers: [
    {
      url: "https://stronger-influenced-skating-coral.trycloudflare.com",
      description: "Cloudflare quick tunnel (may rotate)",
    },
    { url: "http://localhost:4000", description: "Local dev" },
  ],
  tags: [
    { name: "Auth", description: "Register and login" },
    { name: "Users", description: "Authenticated user profile" },
    { name: "Screenings", description: "Screening sessions, history, results" },
    { name: "Screening media", description: "Upload + stream raw cough audio and sputum image bytes" },
    { name: "IoT", description: "Endpoints used by ESP32 / microcontrollers (X-IoT-Key)" },
    { name: "System", description: "Health and meta" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "JWT from POST /auth/login or /auth/register. In Authorize, paste the token only (Swagger adds `Bearer `). Do not use the IoT shared key here.",
      },
      iotKey: {
        type: "apiKey",
        in: "header",
        name: "X-IoT-Key",
        description: "Shared device secret (matches IOT_API_KEY in the backend .env).",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["message"],
        properties: { message: { type: "string", example: "Request failed" } },
      },
      Profile: {
        type: "object",
        required: ["firstName", "lastName", "birthdate", "gender"],
        properties: {
          firstName: { type: "string", example: "Juan" },
          lastName: { type: "string", example: "Dela Cruz" },
          birthdate: {
            type: "string",
            format: "date",
            example: "1995-06-12",
            description: "ISO date (YYYY-MM-DD).",
          },
          gender: { type: "string", example: "male" },
          street: { type: "string", nullable: true, example: "123 Mabini St" },
          barangay: { type: "string", nullable: true, example: "Poblacion" },
          city: { type: "string", nullable: true, example: "Cebu City" },
        },
      },
      User: {
        type: "object",
        properties: {
          userId: { type: "string", format: "uuid" },
          email: { type: "string", format: "email", nullable: true },
          phoneNumber: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          profile: { allOf: [{ $ref: "#/components/schemas/Profile" }], nullable: true },
        },
      },
      AuthResponse: {
        type: "object",
        required: ["token", "user"],
        properties: {
          token: {
            type: "string",
            description: "JWT — send as `Authorization: Bearer <token>` on user-scoped routes.",
          },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      RegisterBody: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "juan@example.com" },
          password: { type: "string", minLength: 8, example: "supersecret" },
          phoneNumber: { type: "string", nullable: true, example: "+639171234567" },
          profile: { $ref: "#/components/schemas/Profile" },
        },
      },
      LoginBody: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "juan@example.com" },
          password: { type: "string", example: "supersecret" },
        },
      },
      UpdateUserBody: {
        type: "object",
        description: "Send `email` or `phoneNumber` (at least one).",
        properties: {
          email: { type: "string", format: "email" },
          phoneNumber: { type: "string" },
        },
      },
      ChecklistItem: {
        type: "object",
        required: ["id", "value"],
        properties: {
          id: { type: "string", example: "symptom_persistent_cough" },
          label: { type: "string", example: "Persistent cough" },
          value: { type: "boolean" },
        },
      },
      ChecklistPayload: {
        type: "object",
        properties: {
          version: { type: "integer", example: 1 },
          items: { type: "array", items: { $ref: "#/components/schemas/ChecklistItem" } },
        },
      },
      CompleteScreeningBody: {
        type: "object",
        required: ["riskLevel", "recommendation", "audioUris"],
        properties: {
          riskLevel: { type: "string", enum: ["low", "moderate", "high"] },
          recommendation: { type: "string" },
          /** JSON-stringified ChecklistPayload (kept as a string for backwards compatibility). */
          checklist: {
            type: "string",
            description: "JSON-stringified ChecklistPayload.",
            example:
              '{"version":1,"items":[{"id":"symptom_persistent_cough","label":"Persistent cough","value":true}]}',
          },
          audioUris: {
            type: "array",
            items: { type: "string" },
            description: "Phone-local URIs of each cough clip (diagnostic only; raw bytes are uploaded separately).",
          },
          imageUri: { type: "string" },
          uploadError: { type: "boolean" },
          invalidAudio: { type: "boolean" },
          invalidAudioLabel: { type: "string" },
          invalidAudioReasons: { type: "array", items: { type: "string" } },
          apiAttempt: { type: "string" },
          averageTbProbability: { type: "number", format: "float", minimum: 0, maximum: 1, nullable: true },
          phlegmAnalyzed: { type: "boolean" },
          phlegmLoad: { type: "string", enum: ["none", "low", "moderate", "high"] },
          phlegmConfidence: { type: "number", format: "float", minimum: 0, maximum: 1, nullable: true },
          phlegmProbs: {
            type: "string",
            description: "JSON-stringified record of phlegm class probabilities, e.g. `{\"none\":0.1,\"low\":0.2,\"moderate\":0.6,\"high\":0.1}`.",
          },
        },
      },
      CoughRecordingMeta: {
        type: "object",
        properties: {
          recordingId: { type: "string", format: "uuid" },
          sessionId: { type: "string", format: "uuid" },
          fileUri: { type: "string", nullable: true, description: "Legacy phone-local path (diagnostic)." },
          fileUrl: {
            type: "string",
            description: "Server-relative streaming URL (requires bearer auth).",
            example: "/screenings/abc/cough-recordings/def/file",
          },
          hasRawData: { type: "boolean" },
          mimeType: { type: "string", example: "audio/wav" },
          byteSize: { type: "integer", nullable: true },
          source: { type: "string", enum: ["mobile", "iot"], default: "mobile" },
          recordedAt: { type: "string", format: "date-time" },
          qualityCheck: {
            type: "object",
            nullable: true,
            properties: {
              ok: { type: "boolean" },
              label: { type: "string", nullable: true },
              reasonsJson: {},
            },
          },
          audioPrediction: {
            type: "object",
            nullable: true,
            properties: {
              probTb: { type: "number", format: "float" },
              probNoTb: { type: "number", format: "float" },
              predictedClass: { type: "integer" },
              spoof: { type: "boolean" },
            },
          },
        },
      },
      SputumImageMeta: {
        type: "object",
        nullable: true,
        properties: {
          imageId: { type: "string", format: "uuid" },
          sessionId: { type: "string", format: "uuid" },
          fileUri: { type: "string", nullable: true },
          fileUrl: { type: "string", example: "/screenings/abc/sputum-image/file" },
          hasRawData: { type: "boolean" },
          mimeType: { type: "string", example: "image/jpeg" },
          byteSize: { type: "integer", nullable: true },
          source: { type: "string", enum: ["mobile", "iot"] },
          capturedAt: { type: "string", format: "date-time" },
          phlegmPrediction: {
            type: "object",
            nullable: true,
            properties: {
              predictedLoad: { type: "string", enum: ["none", "low", "moderate", "high"] },
              confidence: { type: "number", format: "float" },
              probabilitiesJson: {},
            },
          },
        },
      },
      ScreeningResult: {
        type: "object",
        nullable: true,
        properties: {
          riskLevel: { type: "string", enum: ["low", "moderate", "high"] },
          recommendation: { type: "string" },
          invalidAudio: { type: "boolean" },
          invalidAudioLabel: { type: "string", nullable: true },
          invalidAudioReasonsJson: {},
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ScreeningHistoryRow: {
        type: "object",
        properties: {
          sessionId: { type: "string", format: "uuid" },
          startedAt: { type: "string", format: "date-time" },
          completedAt: { type: "string", format: "date-time", nullable: true },
          finalRiskLevel: { type: "string", nullable: true },
          averageTbProbability: { type: "number", format: "float", nullable: true },
          uploadError: { type: "boolean" },
          result: { $ref: "#/components/schemas/ScreeningResult" },
          _count: {
            type: "object",
            properties: {
              coughRecordings: { type: "integer" },
              symptomResponses: { type: "integer" },
            },
          },
        },
      },
      ScreeningSessionDetail: {
        type: "object",
        properties: {
          sessionId: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          startedAt: { type: "string", format: "date-time" },
          completedAt: { type: "string", format: "date-time", nullable: true },
          finalRiskLevel: { type: "string", nullable: true },
          averageTbProbability: { type: "number", format: "float", nullable: true },
          uploadError: { type: "boolean" },
          checklistPayload: { allOf: [{ $ref: "#/components/schemas/ChecklistPayload" }], nullable: true },
          result: { $ref: "#/components/schemas/ScreeningResult" },
          symptomResponses: {
            type: "array",
            items: {
              type: "object",
              properties: {
                answerValue: { type: "boolean" },
                question: {
                  type: "object",
                  properties: {
                    questionId: { type: "string" },
                    category: { type: "string" },
                    questionText: { type: "string" },
                  },
                },
              },
            },
          },
          coughRecordings: { type: "array", items: { $ref: "#/components/schemas/CoughRecordingMeta" } },
          sputumImage: { $ref: "#/components/schemas/SputumImageMeta" },
        },
      },
      CoughUploadResponse: {
        type: "object",
        properties: {
          recording: {
            type: "object",
            properties: {
              recordingId: { type: "string", format: "uuid" },
              sessionId: { type: "string", format: "uuid" },
              mimeType: { type: "string" },
              byteSize: { type: "integer" },
              fileUrl: { type: "string" },
            },
          },
        },
      },
      SputumUploadResponse: {
        type: "object",
        properties: {
          image: {
            type: "object",
            properties: {
              imageId: { type: "string", format: "uuid" },
              sessionId: { type: "string", format: "uuid" },
              mimeType: { type: "string" },
              byteSize: { type: "integer" },
              fileUrl: { type: "string" },
            },
          },
        },
      },
      IotCoughResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          recording: {
            type: "object",
            properties: {
              recordingId: { type: "string", format: "uuid" },
              sessionId: { type: "string", format: "uuid" },
              userId: { type: "string", format: "uuid" },
              mimeType: { type: "string" },
              byteSize: { type: "integer" },
              fileUrl: {
                type: "string",
                example: "/iot/sputum-images/abc/file?userId=def",
                description: "IoT-key protected URL for downloading the stored image bytes.",
              },
              source: { type: "string", example: "iot" },
            },
          },
        },
      },
      IotSputumResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          image: {
            type: "object",
            properties: {
              imageId: { type: "string", format: "uuid" },
              sessionId: { type: "string", format: "uuid" },
              userId: { type: "string", format: "uuid" },
              mimeType: { type: "string" },
              byteSize: { type: "integer" },
              source: { type: "string", example: "iot" },
            },
          },
        },
      },
      IotJsonAudioBody: {
        type: "object",
        required: ["userId", "fileBase64"],
        properties: {
          userId: { type: "string", format: "uuid" },
          sessionId: { type: "string", format: "uuid", nullable: true },
          deviceId: { type: "string", example: "esp32-cough-001" },
          mimeType: { type: "string", example: "audio/wav" },
          filename: { type: "string", example: "cough.wav" },
          fileBase64: { type: "string", description: "Base64-encoded raw audio bytes." },
        },
      },
      IotJsonImageBody: {
        type: "object",
        required: ["userId", "fileBase64"],
        properties: {
          userId: { type: "string", format: "uuid" },
          sessionId: { type: "string", format: "uuid", nullable: true },
          deviceId: { type: "string", example: "esp32-cam-001" },
          mimeType: { type: "string", example: "image/jpeg" },
          filename: { type: "string", example: "sputum.jpg" },
          fileBase64: { type: "string", description: "Base64-encoded raw image bytes." },
        },
      },
      IotDeviceCommandBody: {
        type: "object",
        required: ["command"],
        properties: {
          command: {
            type: "string",
            enum: ["image", "audio", "audio upload"],
            example: "audio",
            description:
              "`audio` starts recording. `audio upload` asks the firmware to stop and upload, and is only accepted after the 3 second minimum has passed.",
          },
        },
      },
    },
    parameters: {
      SessionIdPath: {
        in: "path",
        name: "sessionId",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
      RecordingIdPath: {
        in: "path",
        name: "recordingId",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
      ScreeningsLimit: {
        in: "query",
        name: "limit",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
      UserIdQuery: {
        in: "query",
        name: "userId",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid JWT (click Authorize and paste the token from POST /auth/login)",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            examples: {
              missing: {
                summary: "No Authorization header",
                value: { message: "Authorization token is required" },
              },
              invalid: {
                summary: "Bad or expired JWT",
                value: { message: "Invalid or expired token" },
              },
            },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            examples: {
              session: {
                summary: "Unknown session for this user",
                value: { message: "Screening session not found" },
              },
              recording: {
                summary: "Unknown cough recording",
                value: { message: "Cough recording not found in this session" },
              },
            },
          },
        },
      },
      BadRequest: {
        description: "Validation error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            examples: {
              missingAudio: {
                summary: "Multipart audio file missing",
                value: { message: "Missing audio file. Send multipart field `file` or JSON `fileBase64`." },
              },
              missingImage: {
                summary: "Multipart image file missing",
                value: { message: "Missing image. Send multipart `file` or JSON `fileBase64`." },
              },
              missingUserId: {
                summary: "userId not provided",
                value: { message: "userId is required" },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Liveness probe",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "object", properties: { status: { type: "string", example: "ok" } } },
              },
            },
          },
        },
      },
    },

    // --- Auth -------------------------------------------------------------
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Create a new account",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterBody" } } },
        },
        responses: {
          201: {
            description: "Account created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          409: {
            description: "Email already registered",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email + password",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginBody" } } },
        },
        responses: {
          200: {
            description: "Authenticated",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // --- Users ------------------------------------------------------------
    "/users/me": {
      get: {
        tags: ["Users"],
        summary: "Get the authenticated user (profile included)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { user: { $ref: "#/components/schemas/User" } },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      patch: {
        tags: ["Users"],
        summary: "Update the authenticated user's email or phone number",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateUserBody" } } },
        },
        responses: {
          200: {
            description: "Updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { user: { $ref: "#/components/schemas/User" } },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          409: {
            description: "Email already in use",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/users/me/profile": {
      put: {
        tags: ["Users"],
        summary: "Create or replace the authenticated user's profile",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/Profile" } } },
        },
        responses: {
          200: {
            description: "Upserted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { profile: { $ref: "#/components/schemas/Profile" } },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // --- Screenings -------------------------------------------------------
    "/screenings": {
      post: {
        tags: ["Screenings"],
        summary: "Persist a completed screening (metadata + predictions)",
        description:
          "Creates the session, symptom rows, cough_recordings (without raw bytes yet), sputum_image row (if `imageUri`), and ML prediction rows. The mobile client should then upload the actual audio/image bytes via `/screenings/:sessionId/cough-recordings/:recordingId/raw` and `/screenings/:sessionId/sputum-image/raw`.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CompleteScreeningBody" } },
          },
        },
        responses: {
          201: {
            description: "Created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    session: { $ref: "#/components/schemas/ScreeningSessionDetail" },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      get: {
        tags: ["Screenings"],
        summary: "List the authenticated user's completed screenings",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/ScreeningsLimit" }],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    screenings: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ScreeningHistoryRow" },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/screenings/{sessionId}": {
      get: {
        tags: ["Screenings"],
        summary: "Get one screening session by id (owner only)",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/SessionIdPath" }],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { session: { $ref: "#/components/schemas/ScreeningSessionDetail" } },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // --- Screening media (mobile) -----------------------------------------
    "/screenings/{sessionId}/cough-recordings/{recordingId}/raw": {
      post: {
        tags: ["Screening media"],
        summary: "Attach raw audio bytes onto an existing cough_recording row",
        description:
          "Used by the mobile app immediately after `POST /screenings` so the original `.wav`/`.m4a` is persisted server-side and any other phone on this account can play it.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/SessionIdPath" },
          { $ref: "#/components/parameters/RecordingIdPath" },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: { type: "string", format: "binary", description: "Raw audio bytes (wav/m4a/3gp/...)." },
                },
              },
            },
            "application/json": { schema: { $ref: "#/components/schemas/IotJsonAudioBody" } },
          },
        },
        responses: {
          200: {
            description: "Attached",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CoughUploadResponse" } } },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/screenings/{sessionId}/sputum-image/raw": {
      post: {
        tags: ["Screening media"],
        summary: "Attach raw sputum image bytes onto the session's sputum_image row",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/SessionIdPath" }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: { file: { type: "string", format: "binary" } },
              },
            },
            "application/json": { schema: { $ref: "#/components/schemas/IotJsonImageBody" } },
          },
        },
        responses: {
          200: {
            description: "Attached",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SputumUploadResponse" } } },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/screenings/{sessionId}/cough-recordings": {
      post: {
        tags: ["Screening media"],
        summary: "Create a brand-new cough_recording row with raw bytes (mobile)",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/SessionIdPath" }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: { file: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CoughUploadResponse" } } },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/screenings/{sessionId}/sputum-image": {
      post: {
        tags: ["Screening media"],
        summary: "Upsert the session's sputum_image with raw bytes (mobile)",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/SessionIdPath" }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: { file: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Created/replaced",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SputumUploadResponse" } } },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/screenings/{sessionId}/cough-recordings/{recordingId}/file": {
      get: {
        tags: ["Screening media"],
        summary: "Stream raw cough audio bytes",
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/SessionIdPath" },
          { $ref: "#/components/parameters/RecordingIdPath" },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "audio/wav": { schema: { type: "string", format: "binary" } },
              "audio/mp4": { schema: { type: "string", format: "binary" } },
              "audio/ogg": { schema: { type: "string", format: "binary" } },
              "application/octet-stream": { schema: { type: "string", format: "binary" } },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/screenings/{sessionId}/sputum-image/file": {
      get: {
        tags: ["Screening media"],
        summary: "Stream raw sputum image bytes",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/SessionIdPath" }],
        responses: {
          200: {
            description: "OK",
            content: {
              "image/jpeg": { schema: { type: "string", format: "binary" } },
              "image/png": { schema: { type: "string", format: "binary" } },
              "image/webp": { schema: { type: "string", format: "binary" } },
              "application/octet-stream": { schema: { type: "string", format: "binary" } },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // --- IoT --------------------------------------------------------------
    "/iot/health": {
      get: {
        tags: ["IoT"],
        summary: "Public health probe for the IoT subsystem",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    service: { type: "string", example: "tbhon-iot" },
                    time: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/iot/hello": {
      post: {
        tags: ["IoT"],
        summary: "Authenticated hello/smoke test for IoT devices",
        description:
          "Use this from an ESP32/microcontroller to verify the backend URL and IoT key before uploading real audio/image bytes. Requires only `X-IoT-Key`.",
        security: [{ iotKey: [] }],
        requestBody: {
          required: false,
          content: {
            "text/plain": {
              schema: { type: "string", example: "hello" },
            },
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string", example: "hello" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Hello accepted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    service: { type: "string", example: "tbhon-iot" },
                    received: { type: "string", example: "hello" },
                    time: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          401: {
            description: "Invalid IoT API key",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          503: {
            description: "IoT API not configured (IOT_API_KEY not set)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/iot/device-command": {
      get: {
        tags: ["IoT"],
        summary: "Fetch next command as plain text for firmware",
        description:
          "ESP32-friendly polling endpoint. Returns plain text body: `image`, `audio`, `audio upload`, or empty string when no command is queued. By default it consumes the queued command on read.",
        security: [{ iotKey: [] }],
        parameters: [
          {
            in: "query",
            name: "consume",
            required: false,
            schema: { type: "boolean", default: true },
            description: "Set to false to peek without removing the queued command.",
          },
        ],
        responses: {
          200: {
            description: "Plain text command",
            content: {
              "text/plain": {
                schema: { type: "string", example: "audio" },
              },
            },
          },
          401: {
            description: "Invalid IoT API key",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          503: {
            description: "IoT API not configured (IOT_API_KEY not set)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
      post: {
        tags: ["IoT"],
        summary: "Queue the next microcontroller command",
        description:
          "Queues a single command that your microcontroller can fetch from `GET /iot/device-command`. Allowed values are `image`, `audio`, and `audio upload`. `audio upload` is accepted only after the device has received `audio` and the 3 second minimum has passed.",
        security: [{ iotKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/IotDeviceCommandBody" },
            },
          },
        },
        responses: {
          201: {
            description: "Command queued",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    message: { type: "string", example: "Queued 'audio' command for device" },
                    command: { type: "string", enum: ["image", "audio", "audio upload"] },
                    minSeconds: { type: "integer", nullable: true, example: 3 },
                    maxSeconds: { type: "integer", nullable: true, example: 10 },
                    queuedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: {
            description: "Invalid IoT API key",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          503: {
            description: "IoT API not configured (IOT_API_KEY not set)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/iot/cough-recordings": {
      post: {
        tags: ["IoT"],
        summary: "Upload a cough recording from an IoT device",
        description:
          "Accepts multipart (`file=`) **or** JSON with `fileBase64`. Requires `X-IoT-Key` header. If `sessionId` is omitted, a new screening session is created automatically for the given `userId`.",
        security: [{ iotKey: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["userId", "file"],
                properties: {
                  userId: { type: "string", format: "uuid" },
                  sessionId: { type: "string", format: "uuid" },
                  deviceId: { type: "string", example: "esp32-cough-001" },
                  file: { type: "string", format: "binary" },
                },
              },
            },
            "application/json": { schema: { $ref: "#/components/schemas/IotJsonAudioBody" } },
          },
        },
        responses: {
          201: {
            description: "Stored",
            content: { "application/json": { schema: { $ref: "#/components/schemas/IotCoughResponse" } } },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: {
            description: "Invalid IoT API key",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          404: {
            description: "Unknown userId",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          503: {
            description: "IoT API not configured (IOT_API_KEY not set)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/iot/sputum-images": {
      post: {
        tags: ["IoT"],
        summary: "Upload a sputum/phlegm image from an IoT device",
        description:
          "Accepts multipart (`file=`) **or** JSON with `fileBase64`. Requires `X-IoT-Key`. If a sputum image already exists for the session, it is replaced. The response includes an IoT-key protected `fileUrl` for downloading the bytes without a mobile JWT.",
        security: [{ iotKey: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["userId", "file"],
                properties: {
                  userId: { type: "string", format: "uuid" },
                  sessionId: { type: "string", format: "uuid" },
                  deviceId: { type: "string", example: "esp32-cam-001" },
                  file: { type: "string", format: "binary" },
                },
              },
            },
            "application/json": { schema: { $ref: "#/components/schemas/IotJsonImageBody" } },
          },
        },
        responses: {
          201: {
            description: "Stored",
            content: { "application/json": { schema: { $ref: "#/components/schemas/IotSputumResponse" } } },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: {
            description: "Invalid IoT API key",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          404: {
            description: "Unknown userId",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          503: {
            description: "IoT API not configured (IOT_API_KEY not set)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/iot/sputum-images/{sessionId}/file": {
      get: {
        tags: ["IoT"],
        summary: "Stream a stored IoT sputum/phlegm image",
        description:
          "Use this for IoT/debug tooling with `X-IoT-Key`. Mobile app media routes still use the user's bearer JWT under `/screenings/*`.",
        security: [{ iotKey: [] }],
        parameters: [
          { $ref: "#/components/parameters/SessionIdPath" },
          { $ref: "#/components/parameters/UserIdQuery" },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "image/jpeg": { schema: { type: "string", format: "binary" } },
              "image/png": { schema: { type: "string", format: "binary" } },
              "image/webp": { schema: { type: "string", format: "binary" } },
              "application/octet-stream": { schema: { type: "string", format: "binary" } },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: {
            description: "Invalid IoT API key",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          404: { $ref: "#/components/responses/NotFound" },
          503: {
            description: "IoT API not configured (IOT_API_KEY not set)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;
