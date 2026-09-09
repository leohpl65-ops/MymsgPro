import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const firebaseDatabaseUrl =
  process.env.FIREBASE_DATABASE_URL ||
  "https://mymsg-red-default-rtdb.firebaseio.com";
const uploadDirectory = path.resolve(process.cwd(), "uploads");
const safeInlineExtensions = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp",
  ".mp3", ".wav", ".ogg", ".m4a", ".webm",
]);
const failedLogins = new Map<string, { count: number; resetAt: number }>();

type FirebaseUser = {
  id?: string;
  name?: string;
  originalName?: string;
  password?: string;
  avatar?: string;
  language?: "es" | "en";
  banned?: boolean;
  punishedUntil?: number;
  youtubeUrl?: string;
  googleLinked?: string;
};

function publicUser(user: FirebaseUser, id: string) {
  return {
    id,
    name: user.name || user.originalName || id,
    originalName: user.originalName || user.name || id,
    avatar: user.avatar,
    language: user.language,
    banned: user.banned,
    punishedUntil: user.punishedUntil,
    youtubeUrl: user.youtubeUrl,
    status: "offline",
  };
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function passwordMatches(password: string, storedPassword?: string) {
  if (!storedPassword) return false;
  if (!storedPassword.startsWith("scrypt:")) {
    const actual = Buffer.from(password);
    const expected = Buffer.from(storedPassword);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }

  const [, salt, expected] = storedPassword.split(":");
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
    crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

async function readFirebaseUsers(): Promise<Record<string, FirebaseUser>> {
  const response = await fetch(`${firebaseDatabaseUrl}/users.json`);
  if (!response.ok) throw new Error("No se pudo conectar con el servidor de usuarios");
  return (await response.json()) || {};
}

async function readFirebaseUser(id: string): Promise<FirebaseUser | undefined> {
  const response = await fetch(`${firebaseDatabaseUrl}/users/${encodeURIComponent(id)}.json`);
  if (!response.ok) throw new Error("No se pudo conectar con el servidor de usuarios");
  return (await response.json()) || undefined;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Uploaded attachments must work in development and production.
  app.use(
    "/uploads",
    express.static(uploadDirectory, {
      setHeaders(response, filePath) {
        response.setHeader("X-Content-Type-Options", "nosniff");
        if (!safeInlineExtensions.has(path.extname(filePath).toLowerCase())) {
          response.setHeader("Content-Disposition", "attachment");
        }
      },
    }),
  );
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  app.post("/api/auth/login", async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const password = String(req.body?.password || "");
    const address = req.ip || "unknown";
    const attempt = failedLogins.get(address);
    if (attempt && attempt.resetAt > Date.now() && attempt.count >= 7) {
      return res.status(429).json({ message: "Demasiados intentos. Espera unos minutos." });
    }
    if (!name || !password) {
      return res.status(400).json({ message: "Nombre y contraseña son requeridos" });
    }

    try {
      const users = await readFirebaseUsers();
      const entry = Object.entries(users).find(([id, user]) => {
        const candidateName = user.originalName || user.name || id;
        return candidateName.toLowerCase() === name.toLowerCase() || id === name;
      });

      if (!entry || !passwordMatches(password, entry[1].password)) {
        const current = failedLogins.get(address);
        failedLogins.set(address, {
          count: (current && current.resetAt > Date.now() ? current.count : 0) + 1,
          resetAt: Date.now() + 3 * 60 * 1000,
        });
        return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
      }

      const [id, user] = entry;
      failedLogins.delete(address);
      // Upgrade old plaintext records after a successful login. The password
      // remains server-side and is never included in the response.
      if (user.password && !user.password.startsWith("scrypt:")) {
        await fetch(`${firebaseDatabaseUrl}/users/${encodeURIComponent(id)}.json`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: hashPassword(password) }),
        });
      }

      req.session.userId = id;
      return res.json({ user: publicUser(user, id) });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(503).json({ message: "El servidor no está disponible" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const password = String(req.body?.password || "");
    if (name.length < 2 || password.length < 1) {
      return res.status(400).json({ message: "Nombre y contraseña son requeridos" });
    }
    if (["leo33445", "theowner", "owner"].includes(name.toLowerCase())) {
      return res.status(409).json({ message: "Este nombre está reservado y no puede ser usado" });
    }

    try {
      const users = await readFirebaseUsers();
      const alreadyTaken = Object.values(users).some((user) => {
        const candidateName = user.originalName || user.name || "";
        return candidateName.toLowerCase() === name.toLowerCase();
      });
      if (alreadyTaken) {
        return res.status(409).json({ message: "Este nombre ya está en uso. Por favor, elige otro." });
      }

      let id = "";
      do {
        id = String(crypto.randomInt(10000000, 100000000));
      } while (users[id]);

      const user: FirebaseUser = {
        id,
        name,
        originalName: name,
        password: hashPassword(password),
        language: String(req.body?.language || "").startsWith("es") ? "es" : "en",
        avatar: req.body?.avatar,
      };
      const response = await fetch(`${firebaseDatabaseUrl}/users/${id}.json`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(user),
      });
      if (!response.ok) throw new Error("No se pudo crear la cuenta");
      req.session.userId = id;
      return res.status(201).json({ user: publicUser(user, id) });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(503).json({ message: "No se pudo crear la cuenta" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) return res.status(401).json({ authenticated: false });
    return res.json({ authenticated: true, userId: req.session.userId });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.status(204).end());
  });

  app.post("/api/auth/change-password", async (req, res) => {
    const userId = req.session.userId;
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    if (!userId) return res.status(401).json({ message: "Sesión no válida" });
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "La nueva contraseña debe tener al menos 8 caracteres" });
    }
    try {
      const user = await readFirebaseUser(userId);
      if (!user || !passwordMatches(currentPassword, user.password)) {
        return res.status(403).json({ message: "La contraseña actual es incorrecta" });
      }
      const response = await fetch(`${firebaseDatabaseUrl}/users/${encodeURIComponent(userId)}.json`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: hashPassword(newPassword) }),
      });
      if (!response.ok) throw new Error("No se pudo cambiar la contraseña");
      return res.status(204).end();
    } catch (error) {
      console.error("Password change error:", error);
      return res.status(503).json({ message: "No se pudo cambiar la contraseña" });
    }
  });

  app.post("/api/uploads", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Debes iniciar sesión para subir archivos" });
    }
    const dataUrl = String(req.body?.dataUrl || "");
    const fileName = String(req.body?.fileName || "archivo");
    const mimeType = String(req.body?.mimeType || "application/octet-stream");
    const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) return res.status(400).json({ message: "Archivo inválido" });

    try {
      const content = Buffer.from(match[1], "base64");
      if (content.length > 40 * 1024 * 1024) {
        return res.status(413).json({ message: "El archivo supera el límite de 40 MB" });
      }
      await fs.mkdir(uploadDirectory, { recursive: true });
      const extension = path.extname(fileName).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12);
      const storedName = `${crypto.randomUUID()}${extension}`;
      await fs.writeFile(path.join(uploadDirectory, storedName), content);
      return res.status(201).json({
        url: `/uploads/${storedName}`,
        fileName: fileName.slice(0, 180),
        mimeType,
        size: content.length,
      });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ message: "No se pudo guardar el archivo" });
    }
  });

  return httpServer;
}
