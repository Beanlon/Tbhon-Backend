import { Router } from "express";
import { claimPatientAccess } from "../controllers/patient.controller";

export const patientRouter = Router();

patientRouter.post("/claim", claimPatientAccess);
