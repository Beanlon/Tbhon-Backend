import path from "path";
import dotenv from "dotenv";
import { app } from "./app";

// Load .env from project root (not process.cwd()) so PM2 always picks up droplet secrets.
dotenv.config({ path: path.join(__dirname, "../.env") });
import { logEmailConfigAtStartup } from "./services/email.service";
import { startIncompleteScreeningCleanupScheduler } from "./services/incompleteScreeningCleanup";

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`Tbhon backend is running on port ${port}`);
  logEmailConfigAtStartup();
  startIncompleteScreeningCleanupScheduler();
});
