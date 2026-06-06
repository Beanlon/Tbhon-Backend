import path from "path";
import dotenv from "dotenv";

// Must run before prisma.ts or other modules read process.env.
dotenv.config({ path: path.join(__dirname, "../.env") });
