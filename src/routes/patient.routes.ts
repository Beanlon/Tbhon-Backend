import { Router } from "express";
import { claimPatientAccess, getPatientClaimStatus, previewPatientClaim } from "../controllers/patient.controller";

export const patientRouter = Router();

patientRouter.get("/claim/status", getPatientClaimStatus);
patientRouter.get("/claim/preview", previewPatientClaim);
patientRouter.post("/claim", claimPatientAccess);
