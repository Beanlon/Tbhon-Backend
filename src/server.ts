import "./loadEnv";
import { app } from "./app";
import { logEmailConfigAtStartup } from "./services/email.service";
import { startIncompleteScreeningCleanupScheduler } from "./services/incompleteScreeningCleanup";

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`Tbhon backend is running on port ${port}`);
  logEmailConfigAtStartup();
  startIncompleteScreeningCleanupScheduler();
});
