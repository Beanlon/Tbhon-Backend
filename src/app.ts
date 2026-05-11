import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes";
import { userRouter } from "./routes/user.routes";
import { errorHandler } from "./middleware/error.middleware";
import { screeningRouter } from "./routes/screening.routes";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/screenings", screeningRouter);

app.use(errorHandler);
