/**
 * OpenAPI 3 spec for the Tbhon backend.
 *
 * Served at `/docs` (Swagger UI) and `/docs.json` (raw spec) via app.ts.
 *
 * Conventions:
 *  - `bearerAuth` is the JWT issued by /auth/login or /auth/register.
 *  - `iotKey`     is the X-IoT-Key header gated on `IOT_API_KEY`.
 */
export declare const openApiSpec: {
    readonly openapi: "3.0.3";
    readonly info: {
        readonly title: "Tbhon Backend API";
        readonly version: "1.0.0";
        readonly description: string;
    };
    readonly servers: readonly [{
        readonly url: "https://stronger-influenced-skating-coral.trycloudflare.com";
        readonly description: "Cloudflare quick tunnel (may rotate)";
    }, {
        readonly url: "http://localhost:4000";
        readonly description: "Local dev";
    }];
    readonly tags: readonly [{
        readonly name: "Auth";
        readonly description: "Register and login";
    }, {
        readonly name: "Users";
        readonly description: "Authenticated user profile";
    }, {
        readonly name: "Screenings";
        readonly description: "Screening sessions, history, results";
    }, {
        readonly name: "Screening media";
        readonly description: "Upload + stream raw cough audio and sputum image bytes";
    }, {
        readonly name: "IoT";
        readonly description: "Endpoints used by ESP32 / microcontrollers (X-IoT-Key)";
    }, {
        readonly name: "System";
        readonly description: "Health and meta";
    }];
    readonly components: {
        readonly securitySchemes: {
            readonly bearerAuth: {
                readonly type: "http";
                readonly scheme: "bearer";
                readonly bearerFormat: "JWT";
                readonly description: "JWT from POST /auth/login or /auth/register. In Authorize, paste the token only (Swagger adds `Bearer `). Do not use the IoT shared key here.";
            };
            readonly iotKey: {
                readonly type: "apiKey";
                readonly in: "header";
                readonly name: "X-IoT-Key";
                readonly description: "Shared device secret (matches IOT_API_KEY in the backend .env).";
            };
        };
        readonly schemas: {
            readonly Error: {
                readonly type: "object";
                readonly required: readonly ["message"];
                readonly properties: {
                    readonly message: {
                        readonly type: "string";
                        readonly example: "Request failed";
                    };
                };
            };
            readonly Profile: {
                readonly type: "object";
                readonly required: readonly ["firstName", "lastName", "birthdate", "gender"];
                readonly properties: {
                    readonly firstName: {
                        readonly type: "string";
                        readonly example: "Juan";
                    };
                    readonly lastName: {
                        readonly type: "string";
                        readonly example: "Dela Cruz";
                    };
                    readonly birthdate: {
                        readonly type: "string";
                        readonly format: "date";
                        readonly example: "1995-06-12";
                        readonly description: "ISO date (YYYY-MM-DD).";
                    };
                    readonly gender: {
                        readonly type: "string";
                        readonly example: "male";
                    };
                    readonly street: {
                        readonly type: "string";
                        readonly nullable: true;
                        readonly example: "123 Mabini St";
                    };
                    readonly barangay: {
                        readonly type: "string";
                        readonly nullable: true;
                        readonly example: "Poblacion";
                    };
                    readonly city: {
                        readonly type: "string";
                        readonly nullable: true;
                        readonly example: "Cebu City";
                    };
                };
            };
            readonly User: {
                readonly type: "object";
                readonly properties: {
                    readonly userId: {
                        readonly type: "string";
                        readonly format: "uuid";
                    };
                    readonly email: {
                        readonly type: "string";
                        readonly format: "email";
                        readonly nullable: true;
                    };
                    readonly phoneNumber: {
                        readonly type: "string";
                        readonly nullable: true;
                    };
                    readonly createdAt: {
                        readonly type: "string";
                        readonly format: "date-time";
                    };
                    readonly updatedAt: {
                        readonly type: "string";
                        readonly format: "date-time";
                    };
                    readonly profile: {
                        readonly allOf: readonly [{
                            readonly $ref: "#/components/schemas/Profile";
                        }];
                        readonly nullable: true;
                    };
                };
            };
            readonly AuthResponse: {
                readonly type: "object";
                readonly required: readonly ["token", "user"];
                readonly properties: {
                    readonly token: {
                        readonly type: "string";
                        readonly description: "JWT — send as `Authorization: Bearer <token>` on user-scoped routes.";
                    };
                    readonly user: {
                        readonly $ref: "#/components/schemas/User";
                    };
                };
            };
            readonly RegisterBody: {
                readonly type: "object";
                readonly required: readonly ["email", "password"];
                readonly properties: {
                    readonly email: {
                        readonly type: "string";
                        readonly format: "email";
                        readonly example: "juan@example.com";
                    };
                    readonly password: {
                        readonly type: "string";
                        readonly minLength: 8;
                        readonly example: "supersecret";
                    };
                    readonly phoneNumber: {
                        readonly type: "string";
                        readonly nullable: true;
                        readonly example: "+639171234567";
                    };
                    readonly profile: {
                        readonly $ref: "#/components/schemas/Profile";
                    };
                };
            };
            readonly LoginBody: {
                readonly type: "object";
                readonly required: readonly ["email", "password"];
                readonly properties: {
                    readonly email: {
                        readonly type: "string";
                        readonly format: "email";
                        readonly example: "juan@example.com";
                    };
                    readonly password: {
                        readonly type: "string";
                        readonly example: "supersecret";
                    };
                };
            };
            readonly UpdateUserBody: {
                readonly type: "object";
                readonly description: "Send `email` or `phoneNumber` (at least one).";
                readonly properties: {
                    readonly email: {
                        readonly type: "string";
                        readonly format: "email";
                    };
                    readonly phoneNumber: {
                        readonly type: "string";
                    };
                };
            };
            readonly ChecklistItem: {
                readonly type: "object";
                readonly required: readonly ["id", "value"];
                readonly properties: {
                    readonly id: {
                        readonly type: "string";
                        readonly example: "symptom_persistent_cough";
                    };
                    readonly label: {
                        readonly type: "string";
                        readonly example: "Persistent cough";
                    };
                    readonly value: {
                        readonly type: "boolean";
                    };
                };
            };
            readonly ChecklistPayload: {
                readonly type: "object";
                readonly properties: {
                    readonly version: {
                        readonly type: "integer";
                        readonly example: 1;
                    };
                    readonly items: {
                        readonly type: "array";
                        readonly items: {
                            readonly $ref: "#/components/schemas/ChecklistItem";
                        };
                    };
                };
            };
            readonly CompleteScreeningBody: {
                readonly type: "object";
                readonly required: readonly ["riskLevel", "recommendation", "audioUris"];
                readonly properties: {
                    readonly riskLevel: {
                        readonly type: "string";
                        readonly enum: readonly ["low", "moderate", "high"];
                    };
                    readonly recommendation: {
                        readonly type: "string";
                    };
                    /** JSON-stringified ChecklistPayload (kept as a string for backwards compatibility). */
                    readonly checklist: {
                        readonly type: "string";
                        readonly description: "JSON-stringified ChecklistPayload.";
                        readonly example: "{\"version\":1,\"items\":[{\"id\":\"symptom_persistent_cough\",\"label\":\"Persistent cough\",\"value\":true}]}";
                    };
                    readonly audioUris: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "string";
                        };
                        readonly description: "Phone-local URIs of each cough clip (diagnostic only; raw bytes are uploaded separately).";
                    };
                    readonly imageUri: {
                        readonly type: "string";
                    };
                    readonly uploadError: {
                        readonly type: "boolean";
                    };
                    readonly invalidAudio: {
                        readonly type: "boolean";
                    };
                    readonly invalidAudioLabel: {
                        readonly type: "string";
                    };
                    readonly invalidAudioReasons: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "string";
                        };
                    };
                    readonly apiAttempt: {
                        readonly type: "string";
                    };
                    readonly averageTbProbability: {
                        readonly type: "number";
                        readonly format: "float";
                        readonly minimum: 0;
                        readonly maximum: 1;
                        readonly nullable: true;
                    };
                    readonly phlegmAnalyzed: {
                        readonly type: "boolean";
                    };
                    readonly phlegmLoad: {
                        readonly type: "string";
                        readonly enum: readonly ["none", "low", "moderate", "high"];
                    };
                    readonly phlegmConfidence: {
                        readonly type: "number";
                        readonly format: "float";
                        readonly minimum: 0;
                        readonly maximum: 1;
                        readonly nullable: true;
                    };
                    readonly phlegmProbs: {
                        readonly type: "string";
                        readonly description: "JSON-stringified record of phlegm class probabilities, e.g. `{\"none\":0.1,\"low\":0.2,\"moderate\":0.6,\"high\":0.1}`.";
                    };
                };
            };
            readonly CoughRecordingMeta: {
                readonly type: "object";
                readonly properties: {
                    readonly recordingId: {
                        readonly type: "string";
                        readonly format: "uuid";
                    };
                    readonly sessionId: {
                        readonly type: "string";
                        readonly format: "uuid";
                    };
                    readonly fileUri: {
                        readonly type: "string";
                        readonly nullable: true;
                        readonly description: "Legacy phone-local path (diagnostic).";
                    };
                    readonly fileUrl: {
                        readonly type: "string";
                        readonly description: "Server-relative streaming URL (requires bearer auth).";
                        readonly example: "/screenings/abc/cough-recordings/def/file";
                    };
                    readonly hasRawData: {
                        readonly type: "boolean";
                    };
                    readonly mimeType: {
                        readonly type: "string";
                        readonly example: "audio/wav";
                    };
                    readonly byteSize: {
                        readonly type: "integer";
                        readonly nullable: true;
                    };
                    readonly source: {
                        readonly type: "string";
                        readonly enum: readonly ["mobile", "iot"];
                        readonly default: "mobile";
                    };
                    readonly recordedAt: {
                        readonly type: "string";
                        readonly format: "date-time";
                    };
                    readonly qualityCheck: {
                        readonly type: "object";
                        readonly nullable: true;
                        readonly properties: {
                            readonly ok: {
                                readonly type: "boolean";
                            };
                            readonly label: {
                                readonly type: "string";
                                readonly nullable: true;
                            };
                            readonly reasonsJson: {};
                        };
                    };
                    readonly audioPrediction: {
                        readonly type: "object";
                        readonly nullable: true;
                        readonly properties: {
                            readonly probTb: {
                                readonly type: "number";
                                readonly format: "float";
                            };
                            readonly probNoTb: {
                                readonly type: "number";
                                readonly format: "float";
                            };
                            readonly predictedClass: {
                                readonly type: "integer";
                            };
                            readonly spoof: {
                                readonly type: "boolean";
                            };
                        };
                    };
                };
            };
            readonly SputumImageMeta: {
                readonly type: "object";
                readonly nullable: true;
                readonly properties: {
                    readonly imageId: {
                        readonly type: "string";
                        readonly format: "uuid";
                    };
                    readonly sessionId: {
                        readonly type: "string";
                        readonly format: "uuid";
                    };
                    readonly fileUri: {
                        readonly type: "string";
                        readonly nullable: true;
                    };
                    readonly fileUrl: {
                        readonly type: "string";
                        readonly example: "/screenings/abc/sputum-image/file";
                    };
                    readonly hasRawData: {
                        readonly type: "boolean";
                    };
                    readonly mimeType: {
                        readonly type: "string";
                        readonly example: "image/jpeg";
                    };
                    readonly byteSize: {
                        readonly type: "integer";
                        readonly nullable: true;
                    };
                    readonly source: {
                        readonly type: "string";
                        readonly enum: readonly ["mobile", "iot"];
                    };
                    readonly capturedAt: {
                        readonly type: "string";
                        readonly format: "date-time";
                    };
                    readonly phlegmPrediction: {
                        readonly type: "object";
                        readonly nullable: true;
                        readonly properties: {
                            readonly predictedLoad: {
                                readonly type: "string";
                                readonly enum: readonly ["none", "low", "moderate", "high"];
                            };
                            readonly confidence: {
                                readonly type: "number";
                                readonly format: "float";
                            };
                            readonly probabilitiesJson: {};
                        };
                    };
                };
            };
            readonly ScreeningResult: {
                readonly type: "object";
                readonly nullable: true;
                readonly properties: {
                    readonly riskLevel: {
                        readonly type: "string";
                        readonly enum: readonly ["low", "moderate", "high"];
                    };
                    readonly recommendation: {
                        readonly type: "string";
                    };
                    readonly invalidAudio: {
                        readonly type: "boolean";
                    };
                    readonly invalidAudioLabel: {
                        readonly type: "string";
                        readonly nullable: true;
                    };
                    readonly invalidAudioReasonsJson: {};
                    readonly createdAt: {
                        readonly type: "string";
                        readonly format: "date-time";
                    };
                };
            };
            readonly ScreeningHistoryRow: {
                readonly type: "object";
                readonly properties: {
                    readonly sessionId: {
                        readonly type: "string";
                        readonly format: "uuid";
                    };
                    readonly startedAt: {
                        readonly type: "string";
                        readonly format: "date-time";
                    };
                    readonly completedAt: {
                        readonly type: "string";
                        readonly format: "date-time";
                        readonly nullable: true;
                    };
                    readonly finalRiskLevel: {
                        readonly type: "string";
                        readonly nullable: true;
                    };
                    readonly averageTbProbability: {
                        readonly type: "number";
                        readonly format: "float";
                        readonly nullable: true;
                    };
                    readonly uploadError: {
                        readonly type: "boolean";
                    };
                    readonly result: {
                        readonly $ref: "#/components/schemas/ScreeningResult";
                    };
                    readonly _count: {
                        readonly type: "object";
                        readonly properties: {
                            readonly coughRecordings: {
                                readonly type: "integer";
                            };
                            readonly symptomResponses: {
                                readonly type: "integer";
                            };
                        };
                    };
                };
            };
            readonly ScreeningSessionDetail: {
                readonly type: "object";
                readonly properties: {
                    readonly sessionId: {
                        readonly type: "string";
                        readonly format: "uuid";
                    };
                    readonly userId: {
                        readonly type: "string";
                        readonly format: "uuid";
                    };
                    readonly startedAt: {
                        readonly type: "string";
                        readonly format: "date-time";
                    };
                    readonly completedAt: {
                        readonly type: "string";
                        readonly format: "date-time";
                        readonly nullable: true;
                    };
                    readonly finalRiskLevel: {
                        readonly type: "string";
                        readonly nullable: true;
                    };
                    readonly averageTbProbability: {
                        readonly type: "number";
                        readonly format: "float";
                        readonly nullable: true;
                    };
                    readonly uploadError: {
                        readonly type: "boolean";
                    };
                    readonly checklistPayload: {
                        readonly allOf: readonly [{
                            readonly $ref: "#/components/schemas/ChecklistPayload";
                        }];
                        readonly nullable: true;
                    };
                    readonly result: {
                        readonly $ref: "#/components/schemas/ScreeningResult";
                    };
                    readonly symptomResponses: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "object";
                            readonly properties: {
                                readonly answerValue: {
                                    readonly type: "boolean";
                                };
                                readonly question: {
                                    readonly type: "object";
                                    readonly properties: {
                                        readonly questionId: {
                                            readonly type: "string";
                                        };
                                        readonly category: {
                                            readonly type: "string";
                                        };
                                        readonly questionText: {
                                            readonly type: "string";
                                        };
                                    };
                                };
                            };
                        };
                    };
                    readonly coughRecordings: {
                        readonly type: "array";
                        readonly items: {
                            readonly $ref: "#/components/schemas/CoughRecordingMeta";
                        };
                    };
                    readonly sputumImage: {
                        readonly $ref: "#/components/schemas/SputumImageMeta";
                    };
                };
            };
            readonly CoughUploadResponse: {
                readonly type: "object";
                readonly properties: {
                    readonly recording: {
                        readonly type: "object";
                        readonly properties: {
                            readonly recordingId: {
                                readonly type: "string";
                                readonly format: "uuid";
                            };
                            readonly sessionId: {
                                readonly type: "string";
                                readonly format: "uuid";
                            };
                            readonly mimeType: {
                                readonly type: "string";
                            };
                            readonly byteSize: {
                                readonly type: "integer";
                            };
                            readonly fileUrl: {
                                readonly type: "string";
                            };
                        };
                    };
                };
            };
            readonly SputumUploadResponse: {
                readonly type: "object";
                readonly properties: {
                    readonly image: {
                        readonly type: "object";
                        readonly properties: {
                            readonly imageId: {
                                readonly type: "string";
                                readonly format: "uuid";
                            };
                            readonly sessionId: {
                                readonly type: "string";
                                readonly format: "uuid";
                            };
                            readonly mimeType: {
                                readonly type: "string";
                            };
                            readonly byteSize: {
                                readonly type: "integer";
                            };
                            readonly fileUrl: {
                                readonly type: "string";
                            };
                        };
                    };
                };
            };
            readonly IotCoughResponse: {
                readonly type: "object";
                readonly properties: {
                    readonly ok: {
                        readonly type: "boolean";
                    };
                    readonly recording: {
                        readonly type: "object";
                        readonly properties: {
                            readonly recordingId: {
                                readonly type: "string";
                                readonly format: "uuid";
                            };
                            readonly sessionId: {
                                readonly type: "string";
                                readonly format: "uuid";
                            };
                            readonly userId: {
                                readonly type: "string";
                                readonly format: "uuid";
                            };
                            readonly mimeType: {
                                readonly type: "string";
                            };
                            readonly byteSize: {
                                readonly type: "integer";
                            };
                            readonly fileUrl: {
                                readonly type: "string";
                                readonly example: "/iot/sputum-images/abc/file?userId=def";
                                readonly description: "IoT-key protected URL for downloading the stored image bytes.";
                            };
                            readonly source: {
                                readonly type: "string";
                                readonly example: "iot";
                            };
                        };
                    };
                };
            };
            readonly IotSputumResponse: {
                readonly type: "object";
                readonly properties: {
                    readonly ok: {
                        readonly type: "boolean";
                    };
                    readonly image: {
                        readonly type: "object";
                        readonly properties: {
                            readonly imageId: {
                                readonly type: "string";
                                readonly format: "uuid";
                            };
                            readonly sessionId: {
                                readonly type: "string";
                                readonly format: "uuid";
                            };
                            readonly userId: {
                                readonly type: "string";
                                readonly format: "uuid";
                            };
                            readonly mimeType: {
                                readonly type: "string";
                            };
                            readonly byteSize: {
                                readonly type: "integer";
                            };
                            readonly source: {
                                readonly type: "string";
                                readonly example: "iot";
                            };
                        };
                    };
                };
            };
            readonly IotJsonAudioBody: {
                readonly type: "object";
                readonly required: readonly ["userId", "fileBase64"];
                readonly properties: {
                    readonly userId: {
                        readonly type: "string";
                        readonly format: "uuid";
                    };
                    readonly sessionId: {
                        readonly type: "string";
                        readonly format: "uuid";
                        readonly nullable: true;
                    };
                    readonly deviceId: {
                        readonly type: "string";
                        readonly example: "esp32-cough-001";
                    };
                    readonly mimeType: {
                        readonly type: "string";
                        readonly example: "audio/wav";
                    };
                    readonly filename: {
                        readonly type: "string";
                        readonly example: "cough.wav";
                    };
                    readonly fileBase64: {
                        readonly type: "string";
                        readonly description: "Base64-encoded raw audio bytes.";
                    };
                };
            };
            readonly IotJsonImageBody: {
                readonly type: "object";
                readonly required: readonly ["userId", "fileBase64"];
                readonly properties: {
                    readonly userId: {
                        readonly type: "string";
                        readonly format: "uuid";
                    };
                    readonly sessionId: {
                        readonly type: "string";
                        readonly format: "uuid";
                        readonly nullable: true;
                    };
                    readonly deviceId: {
                        readonly type: "string";
                        readonly example: "esp32-cam-001";
                    };
                    readonly mimeType: {
                        readonly type: "string";
                        readonly example: "image/jpeg";
                    };
                    readonly filename: {
                        readonly type: "string";
                        readonly example: "sputum.jpg";
                    };
                    readonly fileBase64: {
                        readonly type: "string";
                        readonly description: "Base64-encoded raw image bytes.";
                    };
                };
            };
            readonly IotDeviceCommandBody: {
                readonly type: "object";
                readonly required: readonly ["command"];
                readonly properties: {
                    readonly command: {
                        readonly type: "string";
                        readonly enum: readonly ["image", "audio", "audio upload"];
                        readonly example: "audio";
                        readonly description: "`audio` starts recording. `audio upload` asks the firmware to stop and upload, and is only accepted after the 3 second minimum has passed.";
                    };
                };
            };
        };
        readonly parameters: {
            readonly SessionIdPath: {
                readonly in: "path";
                readonly name: "sessionId";
                readonly required: true;
                readonly schema: {
                    readonly type: "string";
                    readonly format: "uuid";
                };
            };
            readonly RecordingIdPath: {
                readonly in: "path";
                readonly name: "recordingId";
                readonly required: true;
                readonly schema: {
                    readonly type: "string";
                    readonly format: "uuid";
                };
            };
            readonly ScreeningsLimit: {
                readonly in: "query";
                readonly name: "limit";
                readonly required: false;
                readonly schema: {
                    readonly type: "integer";
                    readonly minimum: 1;
                    readonly maximum: 100;
                    readonly default: 50;
                };
            };
            readonly UserIdQuery: {
                readonly in: "query";
                readonly name: "userId";
                readonly required: true;
                readonly schema: {
                    readonly type: "string";
                    readonly format: "uuid";
                };
            };
        };
        readonly responses: {
            readonly Unauthorized: {
                readonly description: "Missing or invalid JWT (click Authorize and paste the token from POST /auth/login)";
                readonly content: {
                    readonly "application/json": {
                        readonly schema: {
                            readonly $ref: "#/components/schemas/Error";
                        };
                        readonly examples: {
                            readonly missing: {
                                readonly summary: "No Authorization header";
                                readonly value: {
                                    readonly message: "Authorization token is required";
                                };
                            };
                            readonly invalid: {
                                readonly summary: "Bad or expired JWT";
                                readonly value: {
                                    readonly message: "Invalid or expired token";
                                };
                            };
                        };
                    };
                };
            };
            readonly NotFound: {
                readonly description: "Resource not found";
                readonly content: {
                    readonly "application/json": {
                        readonly schema: {
                            readonly $ref: "#/components/schemas/Error";
                        };
                        readonly examples: {
                            readonly session: {
                                readonly summary: "Unknown session for this user";
                                readonly value: {
                                    readonly message: "Screening session not found";
                                };
                            };
                            readonly recording: {
                                readonly summary: "Unknown cough recording";
                                readonly value: {
                                    readonly message: "Cough recording not found in this session";
                                };
                            };
                        };
                    };
                };
            };
            readonly BadRequest: {
                readonly description: "Validation error";
                readonly content: {
                    readonly "application/json": {
                        readonly schema: {
                            readonly $ref: "#/components/schemas/Error";
                        };
                        readonly examples: {
                            readonly missingAudio: {
                                readonly summary: "Multipart audio file missing";
                                readonly value: {
                                    readonly message: "Missing audio file. Send multipart field `file` or JSON `fileBase64`.";
                                };
                            };
                            readonly missingImage: {
                                readonly summary: "Multipart image file missing";
                                readonly value: {
                                    readonly message: "Missing image. Send multipart `file` or JSON `fileBase64`.";
                                };
                            };
                            readonly missingUserId: {
                                readonly summary: "userId not provided";
                                readonly value: {
                                    readonly message: "userId is required";
                                };
                            };
                        };
                    };
                };
            };
        };
    };
    readonly paths: {
        readonly "/health": {
            readonly get: {
                readonly tags: readonly ["System"];
                readonly summary: "Liveness probe";
                readonly responses: {
                    readonly 200: {
                        readonly description: "OK";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly type: "object";
                                    readonly properties: {
                                        readonly status: {
                                            readonly type: "string";
                                            readonly example: "ok";
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        readonly "/auth/register": {
            readonly post: {
                readonly tags: readonly ["Auth"];
                readonly summary: "Create a new account";
                readonly requestBody: {
                    readonly required: true;
                    readonly content: {
                        readonly "application/json": {
                            readonly schema: {
                                readonly $ref: "#/components/schemas/RegisterBody";
                            };
                        };
                    };
                };
                readonly responses: {
                    readonly 201: {
                        readonly description: "Account created";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/AuthResponse";
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly $ref: "#/components/responses/BadRequest";
                    };
                    readonly 409: {
                        readonly description: "Email already registered";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                };
            };
        };
        readonly "/auth/login": {
            readonly post: {
                readonly tags: readonly ["Auth"];
                readonly summary: "Login with email + password";
                readonly requestBody: {
                    readonly required: true;
                    readonly content: {
                        readonly "application/json": {
                            readonly schema: {
                                readonly $ref: "#/components/schemas/LoginBody";
                            };
                        };
                    };
                };
                readonly responses: {
                    readonly 200: {
                        readonly description: "Authenticated";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/AuthResponse";
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly $ref: "#/components/responses/BadRequest";
                    };
                    readonly 401: {
                        readonly $ref: "#/components/responses/Unauthorized";
                    };
                };
            };
        };
        readonly "/users/me": {
            readonly get: {
                readonly tags: readonly ["Users"];
                readonly summary: "Get the authenticated user (profile included)";
                readonly security: readonly [{
                    readonly bearerAuth: readonly [];
                }];
                readonly responses: {
                    readonly 200: {
                        readonly description: "OK";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly type: "object";
                                    readonly properties: {
                                        readonly user: {
                                            readonly $ref: "#/components/schemas/User";
                                        };
                                    };
                                };
                            };
                        };
                    };
                    readonly 401: {
                        readonly $ref: "#/components/responses/Unauthorized";
                    };
                };
            };
            readonly patch: {
                readonly tags: readonly ["Users"];
                readonly summary: "Update the authenticated user's email or phone number";
                readonly security: readonly [{
                    readonly bearerAuth: readonly [];
                }];
                readonly requestBody: {
                    readonly required: true;
                    readonly content: {
                        readonly "application/json": {
                            readonly schema: {
                                readonly $ref: "#/components/schemas/UpdateUserBody";
                            };
                        };
                    };
                };
                readonly responses: {
                    readonly 200: {
                        readonly description: "Updated";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly type: "object";
                                    readonly properties: {
                                        readonly user: {
                                            readonly $ref: "#/components/schemas/User";
                                        };
                                    };
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly $ref: "#/components/responses/BadRequest";
                    };
                    readonly 401: {
                        readonly $ref: "#/components/responses/Unauthorized";
                    };
                    readonly 409: {
                        readonly description: "Email already in use";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                };
            };
        };
        readonly "/users/me/profile": {
            readonly put: {
                readonly tags: readonly ["Users"];
                readonly summary: "Create or replace the authenticated user's profile";
                readonly security: readonly [{
                    readonly bearerAuth: readonly [];
                }];
                readonly requestBody: {
                    readonly required: true;
                    readonly content: {
                        readonly "application/json": {
                            readonly schema: {
                                readonly $ref: "#/components/schemas/Profile";
                            };
                        };
                    };
                };
                readonly responses: {
                    readonly 200: {
                        readonly description: "Upserted";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly type: "object";
                                    readonly properties: {
                                        readonly profile: {
                                            readonly $ref: "#/components/schemas/Profile";
                                        };
                                    };
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly $ref: "#/components/responses/BadRequest";
                    };
                    readonly 401: {
                        readonly $ref: "#/components/responses/Unauthorized";
                    };
                };
            };
        };
        readonly "/screenings": {
            readonly post: {
                readonly tags: readonly ["Screenings"];
                readonly summary: "Persist a completed screening (metadata + predictions)";
                readonly description: "Creates the session, symptom rows, cough_recordings (without raw bytes yet), sputum_image row (if `imageUri`), and ML prediction rows. The mobile client should then upload the actual audio/image bytes via `/screenings/:sessionId/cough-recordings/:recordingId/raw` and `/screenings/:sessionId/sputum-image/raw`.";
                readonly security: readonly [{
                    readonly bearerAuth: readonly [];
                }];
                readonly requestBody: {
                    readonly required: true;
                    readonly content: {
                        readonly "application/json": {
                            readonly schema: {
                                readonly $ref: "#/components/schemas/CompleteScreeningBody";
                            };
                        };
                    };
                };
                readonly responses: {
                    readonly 201: {
                        readonly description: "Created";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly type: "object";
                                    readonly properties: {
                                        readonly session: {
                                            readonly $ref: "#/components/schemas/ScreeningSessionDetail";
                                        };
                                    };
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly $ref: "#/components/responses/BadRequest";
                    };
                    readonly 401: {
                        readonly $ref: "#/components/responses/Unauthorized";
                    };
                };
            };
            readonly get: {
                readonly tags: readonly ["Screenings"];
                readonly summary: "List the authenticated user's completed screenings";
                readonly security: readonly [{
                    readonly bearerAuth: readonly [];
                }];
                readonly parameters: readonly [{
                    readonly $ref: "#/components/parameters/ScreeningsLimit";
                }];
                readonly responses: {
                    readonly 200: {
                        readonly description: "OK";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly type: "object";
                                    readonly properties: {
                                        readonly screenings: {
                                            readonly type: "array";
                                            readonly items: {
                                                readonly $ref: "#/components/schemas/ScreeningHistoryRow";
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                    readonly 401: {
                        readonly $ref: "#/components/responses/Unauthorized";
                    };
                };
            };
        };
        readonly "/screenings/{sessionId}": {
            readonly get: {
                readonly tags: readonly ["Screenings"];
                readonly summary: "Get one screening session by id (owner only)";
                readonly security: readonly [{
                    readonly bearerAuth: readonly [];
                }];
                readonly parameters: readonly [{
                    readonly $ref: "#/components/parameters/SessionIdPath";
                }];
                readonly responses: {
                    readonly 200: {
                        readonly description: "OK";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly type: "object";
                                    readonly properties: {
                                        readonly session: {
                                            readonly $ref: "#/components/schemas/ScreeningSessionDetail";
                                        };
                                    };
                                };
                            };
                        };
                    };
                    readonly 401: {
                        readonly $ref: "#/components/responses/Unauthorized";
                    };
                    readonly 404: {
                        readonly $ref: "#/components/responses/NotFound";
                    };
                };
            };
        };
        readonly "/screenings/{sessionId}/cough-recordings/{recordingId}/raw": {
            readonly post: {
                readonly tags: readonly ["Screening media"];
                readonly summary: "Attach raw audio bytes onto an existing cough_recording row";
                readonly description: "Used by the mobile app immediately after `POST /screenings` so the original `.wav`/`.m4a` is persisted server-side and any other phone on this account can play it.";
                readonly security: readonly [{
                    readonly bearerAuth: readonly [];
                }];
                readonly parameters: readonly [{
                    readonly $ref: "#/components/parameters/SessionIdPath";
                }, {
                    readonly $ref: "#/components/parameters/RecordingIdPath";
                }];
                readonly requestBody: {
                    readonly required: true;
                    readonly content: {
                        readonly "multipart/form-data": {
                            readonly schema: {
                                readonly type: "object";
                                readonly required: readonly ["file"];
                                readonly properties: {
                                    readonly file: {
                                        readonly type: "string";
                                        readonly format: "binary";
                                        readonly description: "Raw audio bytes (wav/m4a/3gp/...).";
                                    };
                                };
                            };
                        };
                        readonly "application/json": {
                            readonly schema: {
                                readonly $ref: "#/components/schemas/IotJsonAudioBody";
                            };
                        };
                    };
                };
                readonly responses: {
                    readonly 200: {
                        readonly description: "Attached";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/CoughUploadResponse";
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly $ref: "#/components/responses/BadRequest";
                    };
                    readonly 401: {
                        readonly $ref: "#/components/responses/Unauthorized";
                    };
                    readonly 404: {
                        readonly $ref: "#/components/responses/NotFound";
                    };
                };
            };
        };
        readonly "/screenings/{sessionId}/sputum-image/raw": {
            readonly post: {
                readonly tags: readonly ["Screening media"];
                readonly summary: "Attach raw sputum image bytes onto the session's sputum_image row";
                readonly security: readonly [{
                    readonly bearerAuth: readonly [];
                }];
                readonly parameters: readonly [{
                    readonly $ref: "#/components/parameters/SessionIdPath";
                }];
                readonly requestBody: {
                    readonly required: true;
                    readonly content: {
                        readonly "multipart/form-data": {
                            readonly schema: {
                                readonly type: "object";
                                readonly required: readonly ["file"];
                                readonly properties: {
                                    readonly file: {
                                        readonly type: "string";
                                        readonly format: "binary";
                                    };
                                };
                            };
                        };
                        readonly "application/json": {
                            readonly schema: {
                                readonly $ref: "#/components/schemas/IotJsonImageBody";
                            };
                        };
                    };
                };
                readonly responses: {
                    readonly 200: {
                        readonly description: "Attached";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/SputumUploadResponse";
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly $ref: "#/components/responses/BadRequest";
                    };
                    readonly 401: {
                        readonly $ref: "#/components/responses/Unauthorized";
                    };
                    readonly 404: {
                        readonly $ref: "#/components/responses/NotFound";
                    };
                };
            };
        };
        readonly "/screenings/{sessionId}/cough-recordings": {
            readonly post: {
                readonly tags: readonly ["Screening media"];
                readonly summary: "Create a brand-new cough_recording row with raw bytes (mobile)";
                readonly security: readonly [{
                    readonly bearerAuth: readonly [];
                }];
                readonly parameters: readonly [{
                    readonly $ref: "#/components/parameters/SessionIdPath";
                }];
                readonly requestBody: {
                    readonly required: true;
                    readonly content: {
                        readonly "multipart/form-data": {
                            readonly schema: {
                                readonly type: "object";
                                readonly required: readonly ["file"];
                                readonly properties: {
                                    readonly file: {
                                        readonly type: "string";
                                        readonly format: "binary";
                                    };
                                };
                            };
                        };
                    };
                };
                readonly responses: {
                    readonly 201: {
                        readonly description: "Created";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/CoughUploadResponse";
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly $ref: "#/components/responses/BadRequest";
                    };
                    readonly 401: {
                        readonly $ref: "#/components/responses/Unauthorized";
                    };
                    readonly 404: {
                        readonly $ref: "#/components/responses/NotFound";
                    };
                };
            };
        };
        readonly "/screenings/{sessionId}/sputum-image": {
            readonly post: {
                readonly tags: readonly ["Screening media"];
                readonly summary: "Upsert the session's sputum_image with raw bytes (mobile)";
                readonly security: readonly [{
                    readonly bearerAuth: readonly [];
                }];
                readonly parameters: readonly [{
                    readonly $ref: "#/components/parameters/SessionIdPath";
                }];
                readonly requestBody: {
                    readonly required: true;
                    readonly content: {
                        readonly "multipart/form-data": {
                            readonly schema: {
                                readonly type: "object";
                                readonly required: readonly ["file"];
                                readonly properties: {
                                    readonly file: {
                                        readonly type: "string";
                                        readonly format: "binary";
                                    };
                                };
                            };
                        };
                    };
                };
                readonly responses: {
                    readonly 201: {
                        readonly description: "Created/replaced";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/SputumUploadResponse";
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly $ref: "#/components/responses/BadRequest";
                    };
                    readonly 401: {
                        readonly $ref: "#/components/responses/Unauthorized";
                    };
                    readonly 404: {
                        readonly $ref: "#/components/responses/NotFound";
                    };
                };
            };
        };
        readonly "/screenings/{sessionId}/cough-recordings/{recordingId}/file": {
            readonly get: {
                readonly tags: readonly ["Screening media"];
                readonly summary: "Stream raw cough audio bytes";
                readonly security: readonly [{
                    readonly bearerAuth: readonly [];
                }];
                readonly parameters: readonly [{
                    readonly $ref: "#/components/parameters/SessionIdPath";
                }, {
                    readonly $ref: "#/components/parameters/RecordingIdPath";
                }];
                readonly responses: {
                    readonly 200: {
                        readonly description: "OK";
                        readonly content: {
                            readonly "audio/wav": {
                                readonly schema: {
                                    readonly type: "string";
                                    readonly format: "binary";
                                };
                            };
                            readonly "audio/mp4": {
                                readonly schema: {
                                    readonly type: "string";
                                    readonly format: "binary";
                                };
                            };
                            readonly "audio/ogg": {
                                readonly schema: {
                                    readonly type: "string";
                                    readonly format: "binary";
                                };
                            };
                            readonly "application/octet-stream": {
                                readonly schema: {
                                    readonly type: "string";
                                    readonly format: "binary";
                                };
                            };
                        };
                    };
                    readonly 401: {
                        readonly $ref: "#/components/responses/Unauthorized";
                    };
                    readonly 404: {
                        readonly $ref: "#/components/responses/NotFound";
                    };
                };
            };
        };
        readonly "/screenings/{sessionId}/sputum-image/file": {
            readonly get: {
                readonly tags: readonly ["Screening media"];
                readonly summary: "Stream raw sputum image bytes";
                readonly security: readonly [{
                    readonly bearerAuth: readonly [];
                }];
                readonly parameters: readonly [{
                    readonly $ref: "#/components/parameters/SessionIdPath";
                }];
                readonly responses: {
                    readonly 200: {
                        readonly description: "OK";
                        readonly content: {
                            readonly "image/jpeg": {
                                readonly schema: {
                                    readonly type: "string";
                                    readonly format: "binary";
                                };
                            };
                            readonly "image/png": {
                                readonly schema: {
                                    readonly type: "string";
                                    readonly format: "binary";
                                };
                            };
                            readonly "image/webp": {
                                readonly schema: {
                                    readonly type: "string";
                                    readonly format: "binary";
                                };
                            };
                            readonly "application/octet-stream": {
                                readonly schema: {
                                    readonly type: "string";
                                    readonly format: "binary";
                                };
                            };
                        };
                    };
                    readonly 401: {
                        readonly $ref: "#/components/responses/Unauthorized";
                    };
                    readonly 404: {
                        readonly $ref: "#/components/responses/NotFound";
                    };
                };
            };
        };
        readonly "/iot/health": {
            readonly get: {
                readonly tags: readonly ["IoT"];
                readonly summary: "Public health probe for the IoT subsystem";
                readonly responses: {
                    readonly 200: {
                        readonly description: "OK";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly type: "object";
                                    readonly properties: {
                                        readonly ok: {
                                            readonly type: "boolean";
                                        };
                                        readonly service: {
                                            readonly type: "string";
                                            readonly example: "tbhon-iot";
                                        };
                                        readonly time: {
                                            readonly type: "string";
                                            readonly format: "date-time";
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        readonly "/iot/hello": {
            readonly post: {
                readonly tags: readonly ["IoT"];
                readonly summary: "Authenticated hello/smoke test for IoT devices";
                readonly description: "Use this from an ESP32/microcontroller to verify the backend URL and IoT key before uploading real audio/image bytes. Requires only `X-IoT-Key`.";
                readonly security: readonly [{
                    readonly iotKey: readonly [];
                }];
                readonly requestBody: {
                    readonly required: false;
                    readonly content: {
                        readonly "text/plain": {
                            readonly schema: {
                                readonly type: "string";
                                readonly example: "hello";
                            };
                        };
                        readonly "application/json": {
                            readonly schema: {
                                readonly type: "object";
                                readonly properties: {
                                    readonly message: {
                                        readonly type: "string";
                                        readonly example: "hello";
                                    };
                                };
                            };
                        };
                    };
                };
                readonly responses: {
                    readonly 200: {
                        readonly description: "Hello accepted";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly type: "object";
                                    readonly properties: {
                                        readonly ok: {
                                            readonly type: "boolean";
                                            readonly example: true;
                                        };
                                        readonly service: {
                                            readonly type: "string";
                                            readonly example: "tbhon-iot";
                                        };
                                        readonly received: {
                                            readonly type: "string";
                                            readonly example: "hello";
                                        };
                                        readonly time: {
                                            readonly type: "string";
                                            readonly format: "date-time";
                                        };
                                    };
                                };
                            };
                        };
                    };
                    readonly 401: {
                        readonly description: "Invalid IoT API key";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                    readonly 503: {
                        readonly description: "IoT API not configured (IOT_API_KEY not set)";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                };
            };
        };
        readonly "/iot/device-command": {
            readonly get: {
                readonly tags: readonly ["IoT"];
                readonly summary: "Fetch next command as plain text for firmware";
                readonly description: "ESP32-friendly polling endpoint. Returns plain text body: `image`, `audio`, `audio upload`, or empty string when no command is queued. By default it consumes the queued command on read.";
                readonly security: readonly [{
                    readonly iotKey: readonly [];
                }];
                readonly parameters: readonly [{
                    readonly in: "query";
                    readonly name: "consume";
                    readonly required: false;
                    readonly schema: {
                        readonly type: "boolean";
                        readonly default: true;
                    };
                    readonly description: "Set to false to peek without removing the queued command.";
                }];
                readonly responses: {
                    readonly 200: {
                        readonly description: "Plain text command";
                        readonly content: {
                            readonly "text/plain": {
                                readonly schema: {
                                    readonly type: "string";
                                    readonly example: "audio";
                                };
                            };
                        };
                    };
                    readonly 401: {
                        readonly description: "Invalid IoT API key";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                    readonly 503: {
                        readonly description: "IoT API not configured (IOT_API_KEY not set)";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                };
            };
            readonly post: {
                readonly tags: readonly ["IoT"];
                readonly summary: "Queue the next microcontroller command";
                readonly description: "Queues a single command that your microcontroller can fetch from `GET /iot/device-command`. Allowed values are `image`, `audio`, and `audio upload`. `audio upload` is accepted only after the device has received `audio` and the 3 second minimum has passed.";
                readonly security: readonly [{
                    readonly iotKey: readonly [];
                }];
                readonly requestBody: {
                    readonly required: true;
                    readonly content: {
                        readonly "application/json": {
                            readonly schema: {
                                readonly $ref: "#/components/schemas/IotDeviceCommandBody";
                            };
                        };
                    };
                };
                readonly responses: {
                    readonly 201: {
                        readonly description: "Command queued";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly type: "object";
                                    readonly properties: {
                                        readonly ok: {
                                            readonly type: "boolean";
                                            readonly example: true;
                                        };
                                        readonly message: {
                                            readonly type: "string";
                                            readonly example: "Queued 'audio' command for device";
                                        };
                                        readonly command: {
                                            readonly type: "string";
                                            readonly enum: readonly ["image", "audio", "audio upload"];
                                        };
                                        readonly minSeconds: {
                                            readonly type: "integer";
                                            readonly nullable: true;
                                            readonly example: 3;
                                        };
                                        readonly maxSeconds: {
                                            readonly type: "integer";
                                            readonly nullable: true;
                                            readonly example: 10;
                                        };
                                        readonly queuedAt: {
                                            readonly type: "string";
                                            readonly format: "date-time";
                                        };
                                    };
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly $ref: "#/components/responses/BadRequest";
                    };
                    readonly 401: {
                        readonly description: "Invalid IoT API key";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                    readonly 503: {
                        readonly description: "IoT API not configured (IOT_API_KEY not set)";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                };
            };
        };
        readonly "/iot/cough-recordings": {
            readonly post: {
                readonly tags: readonly ["IoT"];
                readonly summary: "Upload a cough recording from an IoT device";
                readonly description: "Accepts multipart (`file=`) **or** JSON with `fileBase64`. Requires `X-IoT-Key` header. If `sessionId` is omitted, a new screening session is created automatically for the given `userId`.";
                readonly security: readonly [{
                    readonly iotKey: readonly [];
                }];
                readonly requestBody: {
                    readonly required: true;
                    readonly content: {
                        readonly "multipart/form-data": {
                            readonly schema: {
                                readonly type: "object";
                                readonly required: readonly ["userId", "file"];
                                readonly properties: {
                                    readonly userId: {
                                        readonly type: "string";
                                        readonly format: "uuid";
                                    };
                                    readonly sessionId: {
                                        readonly type: "string";
                                        readonly format: "uuid";
                                    };
                                    readonly deviceId: {
                                        readonly type: "string";
                                        readonly example: "esp32-cough-001";
                                    };
                                    readonly file: {
                                        readonly type: "string";
                                        readonly format: "binary";
                                    };
                                };
                            };
                        };
                        readonly "application/json": {
                            readonly schema: {
                                readonly $ref: "#/components/schemas/IotJsonAudioBody";
                            };
                        };
                    };
                };
                readonly responses: {
                    readonly 201: {
                        readonly description: "Stored";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/IotCoughResponse";
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly $ref: "#/components/responses/BadRequest";
                    };
                    readonly 401: {
                        readonly description: "Invalid IoT API key";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                    readonly 404: {
                        readonly description: "Unknown userId";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                    readonly 503: {
                        readonly description: "IoT API not configured (IOT_API_KEY not set)";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                };
            };
        };
        readonly "/iot/sputum-images": {
            readonly post: {
                readonly tags: readonly ["IoT"];
                readonly summary: "Upload a sputum/phlegm image from an IoT device";
                readonly description: "Accepts multipart (`file=`) **or** JSON with `fileBase64`. Requires `X-IoT-Key`. If a sputum image already exists for the session, it is replaced. The response includes an IoT-key protected `fileUrl` for downloading the bytes without a mobile JWT.";
                readonly security: readonly [{
                    readonly iotKey: readonly [];
                }];
                readonly requestBody: {
                    readonly required: true;
                    readonly content: {
                        readonly "multipart/form-data": {
                            readonly schema: {
                                readonly type: "object";
                                readonly required: readonly ["userId", "file"];
                                readonly properties: {
                                    readonly userId: {
                                        readonly type: "string";
                                        readonly format: "uuid";
                                    };
                                    readonly sessionId: {
                                        readonly type: "string";
                                        readonly format: "uuid";
                                    };
                                    readonly deviceId: {
                                        readonly type: "string";
                                        readonly example: "esp32-cam-001";
                                    };
                                    readonly file: {
                                        readonly type: "string";
                                        readonly format: "binary";
                                    };
                                };
                            };
                        };
                        readonly "application/json": {
                            readonly schema: {
                                readonly $ref: "#/components/schemas/IotJsonImageBody";
                            };
                        };
                    };
                };
                readonly responses: {
                    readonly 201: {
                        readonly description: "Stored";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/IotSputumResponse";
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly $ref: "#/components/responses/BadRequest";
                    };
                    readonly 401: {
                        readonly description: "Invalid IoT API key";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                    readonly 404: {
                        readonly description: "Unknown userId";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                    readonly 503: {
                        readonly description: "IoT API not configured (IOT_API_KEY not set)";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                };
            };
        };
        readonly "/iot/sputum-images/{sessionId}/file": {
            readonly get: {
                readonly tags: readonly ["IoT"];
                readonly summary: "Stream a stored IoT sputum/phlegm image";
                readonly description: "Use this for IoT/debug tooling with `X-IoT-Key`. Mobile app media routes still use the user's bearer JWT under `/screenings/*`.";
                readonly security: readonly [{
                    readonly iotKey: readonly [];
                }];
                readonly parameters: readonly [{
                    readonly $ref: "#/components/parameters/SessionIdPath";
                }, {
                    readonly $ref: "#/components/parameters/UserIdQuery";
                }];
                readonly responses: {
                    readonly 200: {
                        readonly description: "OK";
                        readonly content: {
                            readonly "image/jpeg": {
                                readonly schema: {
                                    readonly type: "string";
                                    readonly format: "binary";
                                };
                            };
                            readonly "image/png": {
                                readonly schema: {
                                    readonly type: "string";
                                    readonly format: "binary";
                                };
                            };
                            readonly "image/webp": {
                                readonly schema: {
                                    readonly type: "string";
                                    readonly format: "binary";
                                };
                            };
                            readonly "application/octet-stream": {
                                readonly schema: {
                                    readonly type: "string";
                                    readonly format: "binary";
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly $ref: "#/components/responses/BadRequest";
                    };
                    readonly 401: {
                        readonly description: "Invalid IoT API key";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                    readonly 404: {
                        readonly $ref: "#/components/responses/NotFound";
                    };
                    readonly 503: {
                        readonly description: "IoT API not configured (IOT_API_KEY not set)";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                };
            };
        };
    };
};
export type OpenApiSpec = typeof openApiSpec;
//# sourceMappingURL=openapi.d.ts.map