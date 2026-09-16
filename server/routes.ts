import express, { type Express } from "express";
import type { Server } from "http";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const firebaseDatabaseUrl =
  process.env.FIREBASE_DATABASE_URL ||
  "https://mymsg-red-default-rtdb.firebaseio.com";

const uploadDirectory = path.resolve(process.cwd(), "uploads");

const safeInlineExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".bmp",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".webm",
]);

const failedLogins = new Map<
  string,
  { count: number; resetAt: number }
>();

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

type FirebaseGroup = {
  id?: string;
  name?: string;
  type?: string;
  avatar?: string;
  wallpaper?: string;
  participants?: string[] | Record<string, boolean>;
  messages?: unknown[] | Record<string, unknown>;
  lastMessage?: string;
  lastMessageTime?: number;
  ownerId?: string;
  userId?: string;
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

/*
 * ============================================================
 * FIREBASE HELPERS
 * ============================================================
 */

function firebasePath(pathName: string) {
  return pathName
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

async function firebaseRequest<T = unknown>(
  pathName: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(
    `${firebaseDatabaseUrl}/${firebasePath(pathName)}.json`,
    init
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Firebase request failed: ${response.status} ${text}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function readFirebase<T = unknown>(
  pathName: string
): Promise<T | null> {
  return firebaseRequest<T | null>(pathName);
}

async function writeFirebase<T = unknown>(
  pathName: string,
  method: "PUT" | "PATCH" | "DELETE" | "POST",
  value?: unknown
): Promise<T> {
  return firebaseRequest<T>(pathName, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body:
      method === "DELETE"
        ? undefined
        : JSON.stringify(value),
  });
}

async function readFirebaseUsers(): Promise<
  Record<string, FirebaseUser>
> {
  return (
    (await readFirebase<Record<string, FirebaseUser>>(
      "users"
    )) || {}
  );
}

async function readFirebaseUser(
  id: string
): Promise<FirebaseUser | undefined> {
  return (
    (await readFirebase<FirebaseUser>(
      `users/${id}`
    )) || undefined
  );
}

/*
 * ============================================================
 * PASSWORDS
 * ============================================================
 */

function hashPassword(password: string) {
  const salt = crypto
    .randomBytes(16)
    .toString("hex");

  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");

  return `scrypt:${salt}:${hash}`;
}

function passwordMatches(
  password: string,
  storedPassword?: string
) {
  if (!storedPassword) {
    return false;
  }

  /*
   * Compatibilidad con contraseñas antiguas.
   * Se migran a scrypt después de un login correcto.
   */
  if (!storedPassword.startsWith("scrypt:")) {
    const actual = Buffer.from(password);
    const expected = Buffer.from(storedPassword);

    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  }

  const parts = storedPassword.split(":");

  if (parts.length !== 3) {
    return false;
  }

  const [, salt, expected] = parts;

  if (!salt || !expected) {
    return false;
  }

  try {
    const actual = crypto
      .scryptSync(password, salt, 64)
      .toString("hex");

    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);

    return (
      actualBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(
        actualBuffer,
        expectedBuffer
      )
    );
  } catch {
    return false;
  }
}

/*
 * ============================================================
 * GENERAL VALIDATION
 * ============================================================
 */

function validUserId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    /^\d{8}$/.test(id)
  );
}

function cleanText(
  value: unknown,
  maxLength: number
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function validMessageType(value: unknown) {
  const type = String(value || "text");

  return [
    "text",
    "image",
    "video",
    "audio",
    "file",
    "system",
  ].includes(type)
    ? type
    : "text";
}

function clientMessageId(value: unknown) {
  const id = String(value || "").trim();

  if (
    id &&
    id.length <= 120 &&
    /^[A-Za-z0-9_-]+$/.test(id)
  ) {
    return id;
  }

  return crypto.randomUUID();
}

function normalizeParticipants(
  value: FirebaseGroup["participants"]
): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((id): id is string => validUserId(id))
      .slice(0, 500);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.keys(value)
      .filter(validUserId)
      .slice(0, 500);
  }

  return [];
}

function normalizeMessages(
  value: FirebaseGroup["messages"]
): any[] {
  if (Array.isArray(value)) {
    return value.slice(-1000);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.values(value).slice(-1000);
  }

  return [];
}

function publicMessage(message: any) {
  if (!message || typeof message !== "object") {
    return null;
  }

  return {
    id:
      typeof message.id === "string"
        ? message.id
        : undefined,
    senderId:
      typeof message.senderId === "string"
        ? message.senderId
        : undefined,
    recipientId:
      typeof message.recipientId === "string"
        ? message.recipientId
        : undefined,
    text:
      typeof message.text === "string"
        ? message.text.slice(0, 5000)
        : "",
    timestamp:
      typeof message.timestamp === "number"
        ? message.timestamp
        : Date.now(),
    type: validMessageType(message.type),
    mediaUrl:
      typeof message.mediaUrl === "string"
        ? message.mediaUrl
        : undefined,
    replyTo:
      typeof message.replyTo === "string"
        ? message.replyTo
        : undefined,
    fileName:
      typeof message.fileName === "string"
        ? message.fileName.slice(0, 180)
        : undefined,
    fileSize:
      typeof message.fileSize === "number"
        ? message.fileSize
        : undefined,
    mimeType:
      typeof message.mimeType === "string"
        ? message.mimeType.slice(0, 120)
        : undefined,
    deleted:
      message.deleted === true,
  };
}

function publicGroup(
  group: FirebaseGroup,
  id: string
) {
  const participants =
    normalizeParticipants(
      group.participants
    );

  const messages = normalizeMessages(
    group.messages
  )
    .map(publicMessage)
    .filter(Boolean);

  return {
    id,
    name:
      typeof group.name === "string"
        ? group.name.slice(0, 120)
        : "Grupo",
    type: group.type || "group",
    avatar: group.avatar,
    wallpaper: group.wallpaper,
    participants,
    messages,
    lastMessage:
      typeof group.lastMessage === "string"
        ? group.lastMessage.slice(0, 5000)
        : undefined,
    lastMessageTime:
      typeof group.lastMessageTime === "number"
        ? group.lastMessageTime
        : undefined,

    /*
     * Estos datos no son secretos.
     * Sirven para que el backend pueda comprobar
     * quién puede modificar el grupo.
     */
    ownerId:
      typeof group.ownerId === "string"
        ? group.ownerId
        : group.userId,
  };
}

/*
 * ============================================================
 * ADMIN
 * ============================================================
 */

async function isAdmin(userId: string) {
  const value = await readFirebase(
    `admins/${userId}`
  );

  return (
    value === true ||
    (value !== null &&
      value !== false &&
      value !== undefined)
  );
}

/*
 * ============================================================
 * ROUTES
 * ============================================================
 */

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await fs.mkdir(uploadDirectory, {
    recursive: true,
  });

  /*
   * ==========================================================
   * UPLOADS
   * ==========================================================
   */

  app.use(
    "/uploads",
    express.static(uploadDirectory, {
      setHeaders(response, filePath) {
        response.setHeader(
          "X-Content-Type-Options",
          "nosniff"
        );

        if (
          !safeInlineExtensions.has(
            path
              .extname(filePath)
              .toLowerCase()
          )
        ) {
          response.setHeader(
            "Content-Disposition",
            "attachment"
          );
        }
      },
    })
  );

  /*
   * ==========================================================
   * AUTH MIDDLEWARE
   * ==========================================================
   */

  const requireAuth = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!req.session.userId) {
      return res.status(401).json({
        message: "Debes iniciar sesión",
      });
    }

    next();
  };

  const requireAdmin = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!req.session.userId) {
      return res.status(401).json({
        message: "Debes iniciar sesión",
      });
    }

    try {
      if (
        !(await isAdmin(
          req.session.userId
        ))
      ) {
        return res.status(403).json({
          message:
            "No tienes permisos de administrador",
        });
      }

      next();
    } catch (error) {
      console.error(
        "Admin check error:",
        error
      );

      return res.status(503).json({
        message:
          "No se pudieron comprobar los permisos",
      });
    }
  };

  /*
   * ==========================================================
   * AUTH — LOGIN
   * ==========================================================
   */

  app.post(
    "/api/auth/login",
    async (req, res) => {
      const name = cleanText(
        req.body?.name,
        120
      );

      const password = String(
        req.body?.password || ""
      );

      const address =
        req.ip || "unknown";

      const attempt =
        failedLogins.get(address);

      if (
        attempt &&
        attempt.resetAt > Date.now() &&
        attempt.count >= 7
      ) {
        return res.status(429).json({
          message:
            "Demasiados intentos. Espera unos minutos.",
        });
      }

      if (!name || !password) {
        return res.status(400).json({
          message:
            "Nombre y contraseña son requeridos",
        });
      }

      try {
        const users =
          await readFirebaseUsers();

        const entry =
          Object.entries(users).find(
            ([id, user]) => {
              const candidateName =
                user.originalName ||
                user.name ||
                id;

              return (
                candidateName.toLowerCase() ===
                  name.toLowerCase() ||
                id === name
              );
            }
          );

        if (
          !entry ||
          !passwordMatches(
            password,
            entry[1].password
          )
        ) {
          const current =
            failedLogins.get(address);

          failedLogins.set(address, {
            count:
              current &&
              current.resetAt > Date.now()
                ? current.count + 1
                : 1,
            resetAt:
              Date.now() +
              3 * 60 * 1000,
          });

          return res.status(401).json({
            message:
              "Usuario o contraseña incorrectos",
          });
        }

        const [id, user] = entry;

        if (user.banned) {
          return res.status(403).json({
            message:
              "Esta cuenta está suspendida",
          });
        }

        failedLogins.delete(address);

        /*
         * Migración automática de contraseña
         * antigua a scrypt.
         */
        if (
          user.password &&
          !user.password.startsWith(
            "scrypt:"
          )
        ) {
          await writeFirebase(
            `users/${id}`,
            "PATCH",
            {
              password:
                hashPassword(password),
            }
          );
        }

        req.session.userId = id;

        return res.json({
          user: publicUser(user, id),
        });
      } catch (error) {
        console.error(
          "Login error:",
          error
        );

        return res.status(503).json({
          message:
            "El servidor no está disponible",
        });
      }
    }
  );

  /*
   * ==========================================================
   * AUTH — REGISTER
   * ==========================================================
   */

  app.post(
    "/api/auth/register",
    async (req, res) => {
      const name = cleanText(
        req.body?.name,
        80
      );

      const password = String(
        req.body?.password || ""
      );

      if (
        name.length < 2 ||
        password.length < 1
      ) {
        return res.status(400).json({
          message:
            "Nombre y contraseña son requeridos",
        });
      }

      if (
        name.length > 40
      ) {
        return res.status(400).json({
          message:
            "El nombre es demasiado largo",
        });
      }

      if (
        [
          "leo33445",
          "theowner",
          "owner",
        ].includes(
          name.toLowerCase()
        )
      ) {
        return res.status(409).json({
          message:
            "Este nombre está reservado y no puede ser usado",
        });
      }

      try {
        const users =
          await readFirebaseUsers();

        const alreadyTaken =
          Object.values(users).some(
            (user) => {
              const candidateName =
                user.originalName ||
                user.name ||
                "";

              return (
                candidateName.toLowerCase() ===
                name.toLowerCase()
              );
            }
          );

        if (alreadyTaken) {
          return res.status(409).json({
            message:
              "Este nombre ya está en uso. Por favor, elige otro.",
          });
        }

        let id = "";

        do {
          id = String(
            crypto.randomInt(
              10000000,
              100000000
            )
          );
        } while (users[id]);

        const language =
          String(
            req.body?.language || ""
          ).startsWith("es")
            ? "es"
            : "en";

        const avatar =
          typeof req.body?.avatar ===
          "string"
            ? req.body.avatar.slice(
                0,
                500000
              )
            : undefined;

        const user: FirebaseUser = {
          id,
          name,
          originalName: name,
          password:
            hashPassword(password),
          language,
          avatar,
        };

        await writeFirebase(
          `users/${id}`,
          "PUT",
          user
        );

        req.session.userId = id;

        return res.status(201).json({
          user: publicUser(user, id),
        });
      } catch (error) {
        console.error(
          "Registration error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo crear la cuenta",
        });
      }
    }
  );

  /*
   * ==========================================================
   * AUTH — CURRENT USER
   * ==========================================================
   */

  app.get(
    "/api/auth/me",
    async (req, res) => {
      const userId =
        req.session.userId;

      if (!userId) {
        return res.status(401).json({
          authenticated: false,
        });
      }

      try {
        const user =
          await readFirebaseUser(
            userId
          );

        if (!user) {
          req.session.destroy(() => {});

          return res.status(401).json({
            authenticated: false,
          });
        }

        if (user.banned) {
          req.session.destroy(() => {});

          return res.status(403).json({
            authenticated: false,
            message:
              "Esta cuenta está suspendida",
          });
        }

        return res.json({
          authenticated: true,
          userId,
          user: publicUser(
            user,
            userId
          ),
        });
      } catch (error) {
        console.error(
          "Auth session error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo comprobar la sesión",
        });
      }
    }
  );

  /*
   * ==========================================================
   * AUTH — LOGOUT
   * ==========================================================
   */

  app.post(
    "/api/auth/logout",
    (req, res) => {
      req.session.destroy(() => {
        res.status(204).end();
      });
    }
  );

  /*
   * ==========================================================
   * AUTH — VERIFY PASSWORD
   * ==========================================================
   */

  app.post(
    "/api/auth/verify-password",
    requireAuth,
    async (req, res) => {
      const password = String(
        req.body?.password || ""
      );

      if (!password) {
        return res.status(400).json({
          message:
            "Contraseña requerida",
        });
      }

      try {
        const user =
          await readFirebaseUser(
            req.session.userId!
          );

        if (
          !user ||
          !passwordMatches(
            password,
            user.password
          )
        ) {
          return res.status(403).json({
            valid: false,
          });
        }

        return res.json({
          valid: true,
        });
      } catch (error) {
        console.error(
          "Verify password error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo verificar la contraseña",
        });
      }
    }
  );

  /*
   * ==========================================================
   * AUTH — CHANGE PASSWORD
   * ==========================================================
   */

  app.post(
    "/api/auth/change-password",
    requireAuth,
    async (req, res) => {
      const currentPassword =
        String(
          req.body?.currentPassword ||
            ""
        );

      const newPassword =
        String(
          req.body?.newPassword ||
            ""
        );

      if (
        newPassword.length < 8
      ) {
        return res.status(400).json({
          message:
            "La nueva co