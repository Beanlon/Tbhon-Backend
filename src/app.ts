import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { authRouter } from "./routes/auth.routes";
import { userRouter } from "./routes/user.routes";
import { errorHandler } from "./middleware/error.middleware";
import { screeningRouter } from "./routes/screening.routes";
import { iotRouter } from "./routes/iot.routes";
import { openApiSpec } from "./openapi";

export const app = express();

app.use(cors());
// Let IoT devices send a simple "hello" probe with whatever Content-Type the
// microcontroller library attaches. This must run before the JSON parser.
app.use("/iot/hello", express.text({ type: "*/*", limit: "1mb" }));
// Also parse regular text/plain requests elsewhere.
app.use(express.text({ type: "text/plain", limit: "1mb" }));
// Large limit so IoT devices can POST audio/image as Base64 inside JSON when
// they can't do multipart. Multipart uploads bypass this limit via multer.
app.use(express.json({ limit: "40mb" }));
app.use(express.urlencoded({ extended: true, limit: "40mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Root is otherwise undefined → send visitors to the API docs so the bare
// Cloudflare URL doesn't show Express's default "Cannot GET /".
app.get("/", (_req, res) => {
  res.redirect("/docs");
});

// Interactive API docs.
//  - /docs       → Swagger UI (try-it-out enabled)
//  - /docs.json  → raw OpenAPI 3 spec (paste into Postman/Insomnia/etc.)
app.get("/docs.json", (_req, res) => {
  res.json(openApiSpec);
});
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: "Tbhon Backend API Docs",
    swaggerOptions: {
      persistAuthorization: true,
      // If the token was pasted with a duplicate "Bearer " prefix, fix it before send.
      requestInterceptor: (req: { headers?: Record<string, string> }) => {
        const auth = req.headers?.Authorization ?? req.headers?.authorization;
        if (auth && /^Bearer\s+Bearer\s+/i.test(auth)) {
          const fixed = auth.replace(/^Bearer\s+/i, "");
          if (req.headers?.Authorization !== undefined) req.headers.Authorization = fixed;
          if (req.headers?.authorization !== undefined) req.headers.authorization = fixed;
        }
        return req;
      },
    },
  }),
);

app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/screenings", screeningRouter);
app.use("/iot", iotRouter);

app.use(errorHandler);
