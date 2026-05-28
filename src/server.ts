import "dotenv/config";
import { app } from "./app";
import { startIncompleteScreeningCleanupScheduler } from "./services/incompleteScreeningCleanup";

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`Tbhon backend is running on port ${port}`);
  startIncompleteScreeningCleanupScheduler();
});
