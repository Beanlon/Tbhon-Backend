"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeScreening = completeScreening;
exports.listMyScreenings = listMyScreenings;
exports.getMyScreening = getMyScreening;
const crypto_1 = require("crypto");
const prisma_1 = require("../prisma");
const http_1 = require("../utils/http");
const RISK_FALLBACK_REC = {
    low: "Low TB risk based on this screening. Maintain good health habits and monitor symptoms. Consult a professional if symptoms persist.",
    moderate: "Moderate TB risk. Schedule a consultation with a healthcare professional for further evaluation and testing.",
    high: "High TB risk. Please consult a healthcare professional as soon as possible for proper diagnosis and treatment.",
};
function authenticatedUserId(req) {
    const userId = req.user?.userId;
    if (!userId)
        throw new http_1.HttpError(401, "Authentication is required");
    return userId;
}
function parseJsonArrayOfStrings(raw) {
    if (Array.isArray(raw)) {
        return raw.filter((x) => typeof x === "string" && x.trim().length > 0);
    }
    if (typeof raw === "string" && raw.trim().length > 0) {
        try {
            const v = JSON.parse(raw);
            return Array.isArray(v)
                ? v.filter((x) => typeof x === "string" && x.trim().length > 0)
                : [];
        }
        catch {
            return [];
        }
    }
    return [];
}
function parseChecklistItems(body) {
    let raw = body.checklist;
    if (typeof raw === "string" && raw.trim().length > 0) {
        try {
            raw = JSON.parse(raw);
        }
        catch {
            return [];
        }
    }
    if (!(0, http_1.isRecord)(raw))
        return [];
    const items = raw.items;
    if (!Array.isArray(items))
        return [];
    const out = [];
    for (const item of items) {
        if (!(0, http_1.isRecord)(item))
            continue;
        const id = (0, http_1.getString)(item.id);
        if (!id)
            continue;
        const value = item.value === true;
        out.push({ id, value });
    }
    return out;
}
function getOptionalNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "string" && value.trim().length > 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}
function getBool(value) {
    return value === true || value === "true" || value === 1 || value === "1";
}
function coerceRiskLevel(raw) {
    const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (s === "moderate" || s === "high")
        return s;
    return "low";
}
function parsePhlegmProbs(raw) {
    if (raw === undefined || raw === null)
        return undefined;
    if (typeof raw === "string") {
        if (!raw.trim().length)
            return undefined;
        try {
            const v = JSON.parse(raw);
            return v !== null && typeof v === "object" ? v : undefined;
        }
        catch {
            return undefined;
        }
    }
    if (typeof raw === "object")
        return raw;
    return undefined;
}
function parseInvalidReasons(raw) {
    if (raw === undefined || raw === null)
        return undefined;
    if (Array.isArray(raw)) {
        const strings = raw.filter((x) => typeof x === "string");
        return strings;
    }
    if (typeof raw === "string") {
        try {
            const v = JSON.parse(raw);
            return Array.isArray(v) ? v : undefined;
        }
        catch {
            return undefined;
        }
    }
    return undefined;
}
function inferMime(uri, fallbackAudio, fallbackImage) {
    const lower = uri.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
    if (lower.endsWith(".m4a") || lower.endsWith(".mp4") || lower.endsWith(".aac"))
        return "audio/mp4";
    if (lower.endsWith(".3gp") || lower.endsWith(".3gpp"))
        return "audio/3gpp";
    if (lower.endsWith(".caf"))
        return "audio/x-caf";
    if (lower.endsWith(".ogg") || lower.endsWith(".oga") || lower.endsWith(".opus"))
        return "audio/ogg";
    if (lower.endsWith(".png"))
        return "image/png";
    if (lower.endsWith(".webp"))
        return "image/webp";
    if (lower.endsWith(".heic") || lower.endsWith(".heif"))
        return "image/heic";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
        return "image/jpeg";
    if (lower.startsWith("file://") || lower.includes("audio"))
        return fallbackAudio;
    if (lower.startsWith("content://"))
        return fallbackAudio;
    return fallbackAudio;
}
async function completeScreening(req, res) {
    const userId = authenticatedUserId(req);
    if (!(0, http_1.isRecord)(req.body)) {
        throw new http_1.HttpError(400, "Request body is required");
    }
    const riskLevel = coerceRiskLevel(req.body.riskLevel ?? req.body.risk);
    const rec = (0, http_1.getString)(req.body.recommendation);
    const recommendation = rec ?? RISK_FALLBACK_REC[riskLevel];
    const checklistItems = parseChecklistItems(req.body);
    const audioUris = parseJsonArrayOfStrings(req.body.audioUris);
    const imageUri = (0, http_1.getString)(req.body.imageUri);
    const uploadError = getBool(req.body.uploadError);
    const invalidAudio = getBool(req.body.invalidAudio);
    const invalidLabel = (0, http_1.getString)(req.body.invalidAudioLabel ?? req.body.invalidLabel);
    const invalidReasons = parseInvalidReasons(req.body.invalidAudioReasons ?? req.body.invalidReasons);
    const apiAttemptRaw = (0, http_1.getString)(req.body.apiAttempt);
    const averageTbProbability = getOptionalNumber(req.body.averageTbProbability ?? req.body.probTb);
    const phlegmAnalyzed = getBool(req.body.phlegmAnalyzed);
    const phlegmLoad = (0, http_1.getString)(req.body.phlegmLoad) ?? "";
    const phlegmConfidence = getOptionalNumber(req.body.phlegmConfidence);
    const phlegmProbs = parsePhlegmProbs(req.body.phlegmProbs);
    const sessionId = (0, crypto_1.randomUUID)();
    await prisma_1.prisma.$transaction(async (tx) => {
        const knownQuestions = await tx.symptomQuestion.findMany({ select: { questionId: true } });
        const known = new Set(knownQuestions.map((q) => q.questionId));
        await tx.screeningSession.create({
            data: {
                sessionId,
                userId,
                completedAt: new Date(),
                finalRiskLevel: riskLevel,
                averageTbProbability: averageTbProbability !== null && averageTbProbability !== undefined
                    ? averageTbProbability
                    : null,
                uploadError,
                apiAttempt: apiAttemptRaw ?? null,
                symptomResponses: {
                    create: checklistItems
                        .filter((x) => known.has(x.id))
                        .map((x) => ({
                        responseId: (0, crypto_1.randomUUID)(),
                        questionId: x.id,
                        answerValue: x.value,
                    })),
                },
            },
        });
        const recordingIds = [];
        for (const uri of audioUris) {
            const recordingId = (0, crypto_1.randomUUID)();
            recordingIds.push(recordingId);
            await tx.coughRecording.create({
                data: {
                    recordingId,
                    sessionId,
                    fileUri: uri,
                    mimeType: inferMime(uri, "audio/wav", "image/jpeg"),
                },
            });
        }
        const firstRecordingId = recordingIds[0];
        if (firstRecordingId) {
            if (invalidAudio) {
                await tx.coughQualityCheck.create({
                    data: {
                        qualityCheckId: (0, crypto_1.randomUUID)(),
                        recordingId: firstRecordingId,
                        ok: false,
                        label: invalidLabel ?? null,
                        ...(invalidReasons !== undefined ? { reasonsJson: invalidReasons } : {}),
                    },
                });
            }
            if (!invalidAudio && averageTbProbability !== null) {
                const pTb = Math.min(1, Math.max(0, averageTbProbability));
                const pNo = 1 - pTb;
                await tx.tbAudioPrediction.create({
                    data: {
                        predictionId: (0, crypto_1.randomUUID)(),
                        recordingId: firstRecordingId,
                        spoof: false,
                        probNoTb: pNo,
                        probTb: pTb,
                        predictedClass: pTb >= 0.5 ? 1 : 0,
                        modelPath: null,
                    },
                });
            }
        }
        if (imageUri && imageUri.length > 0) {
            const imageId = (0, crypto_1.randomUUID)();
            await tx.sputumImage.create({
                data: {
                    imageId,
                    sessionId,
                    fileUri: imageUri,
                    mimeType: inferMime(imageUri, "audio/wav", "image/jpeg"),
                },
            });
            if (phlegmAnalyzed && phlegmLoad.length > 0) {
                const conf = phlegmConfidence !== null ? phlegmConfidence : 0;
                await tx.phlegmPrediction.create({
                    data: {
                        phlegmPredictionId: (0, crypto_1.randomUUID)(),
                        imageId,
                        predictedLoad: phlegmLoad,
                        confidence: conf,
                        ...(phlegmProbs !== undefined ? { probabilitiesJson: phlegmProbs } : {}),
                        checkpoint: null,
                    },
                });
            }
        }
        await tx.screeningResult.create({
            data: {
                resultId: (0, crypto_1.randomUUID)(),
                sessionId,
                riskLevel,
                recommendation,
                invalidAudio,
                invalidAudioLabel: invalidLabel ?? null,
                ...(invalidReasons !== undefined ? { invalidAudioReasonsJson: invalidReasons } : {}),
            },
        });
    });
    const session = await prisma_1.prisma.screeningSession.findUnique({
        where: { sessionId },
        include: {
            result: true,
            _count: { select: { coughRecordings: true, symptomResponses: true } },
        },
    });
    res.status(201).json({ session });
}
async function listMyScreenings(req, res) {
    const userId = authenticatedUserId(req);
    const limitRaw = (0, http_1.getString)(req.query.limit);
    const limit = Math.min(100, Math.max(1, Number(limitRaw ?? "50") || 50));
    const rows = await prisma_1.prisma.screeningSession.findMany({
        where: { userId },
        orderBy: { startedAt: "desc" },
        take: limit,
        select: {
            sessionId: true,
            startedAt: true,
            completedAt: true,
            finalRiskLevel: true,
            averageTbProbability: true,
            uploadError: true,
            result: {
                select: {
                    riskLevel: true,
                    invalidAudio: true,
                    createdAt: true,
                },
            },
            _count: {
                select: { coughRecordings: true, symptomResponses: true },
            },
        },
    });
    res.json({ screenings: rows });
}
async function getMyScreening(req, res) {
    const userId = authenticatedUserId(req);
    const sessionId = (0, http_1.getString)(req.params.sessionId);
    if (!sessionId)
        throw new http_1.HttpError(400, "sessionId is required");
    const session = await prisma_1.prisma.screeningSession.findFirst({
        where: { sessionId, userId },
        include: {
            result: true,
            symptomResponses: {
                include: { question: { select: { questionId: true, category: true, questionText: true } } },
            },
            coughRecordings: {
                include: {
                    qualityCheck: true,
                    audioPrediction: true,
                },
            },
            sputumImage: {
                include: { phlegmPrediction: true },
            },
        },
    });
    if (!session) {
        throw new http_1.HttpError(404, "Screening not found");
    }
    res.json({ session });
}
//# sourceMappingURL=screening.controller.js.map