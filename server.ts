import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { loadSession } from "./server/auth";
import { authRouter, adminRouter } from "./server/routes/auth";
import { dbRouter } from "./server/routes/db";
import { operacionRouter } from "./server/routes/operacion";
import { canalesRouter } from "./server/routes/canales";
import { geminiRouter } from "./server/routes/gemini";

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

async function startServer() {
  const app = express();

  // Detrás de Cloud Run / proxy: necesario para req.ip y cookies "secure".
  if (IS_PROD) app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(express.json({ limit: "2mb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    next();
  });
  app.use("/api", loadSession);

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/db", dbRouter);
  app.use("/api/db", operacionRouter);
  app.use("/api/canales", canalesRouter);
  app.use("/api/gemini", geminiRouter);

  // Cualquier otra ruta /api devuelve 404 JSON (antes caía en el index.html y
  // el cliente "guardaba" sin enterarse de que la ruta no existía).
  app.use("/api", (_req, res) => {
    res.status(404).json({ success: false, error: "Ruta de API no encontrada." });
  });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
