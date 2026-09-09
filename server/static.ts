import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  app.use(
    "/uploads",
    express.static(path.resolve(process.cwd(), "uploads"), {
      setHeaders(response, filePath) {
        response.setHeader("X-Content-Type-Options", "nosniff");
        const safeInline = new Set([
          ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp",
          ".mp3", ".wav", ".ogg", ".m4a", ".webm",
        ]);
        if (!safeInline.has(path.extname(filePath).toLowerCase())) {
          response.setHeader("Content-Disposition", "attachment");
        }
      },
    }),
  );
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
