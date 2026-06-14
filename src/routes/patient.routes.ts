import { Router } from "express";
import { claimPatientAccess, getPatientClaimStatus, lookupPatient, previewPatientClaim } from "../controllers/patient.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireStaff } from "../middleware/requireStaff.middleware";

export const patientRouter = Router();

patientRouter.get("/claim/status", getPatientClaimStatus);
patientRouter.get("/claim/preview", previewPatientClaim);
patientRouter.post("/claim", claimPatientAccess);

/** Staff-only: look up a PATIENT account by patientPublicCode (QR) or email (fallback). */
patientRouter.get("/lookup", requireAuth, requireStaff, lookupPatient);
