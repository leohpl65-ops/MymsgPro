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
            "La nueva contraseña debe tener al menos 8 caracteres",
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
            currentPassword,
            user.password
          )
        ) {
          return res.status(403).json({
            message:
              "La contraseña actual es incorrecta",
          });
        }

        await writeFirebase(
          `users/${req.session.userId}`,
          "PATCH",
          {
            password:
              hashPassword(
                newPassword
              ),
          }
        );

        return res.status(204).end();
      } catch (error) {
        console.error(
          "Password change error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo cambiar la contraseña",
        });
      }
    }
  );

  /*
   * ==========================================================
   * AUTH — UPDATE PROFILE
   * ==========================================================
   */

  app.patch(
    "/api/auth/me",
    requireAuth,
    async (req, res) => {
      const updates: Record<
        string,
        unknown
      > = {};

      if (
        typeof req.body?.name ===
        "string"
      ) {
        const name = cleanText(
          req.body.name,
          40
        );

        if (
          name.length < 2
        ) {
          return res.status(400).json({
            message:
              "Nombre inválido",
          });
        }

        const users =
          await readFirebaseUsers();

        const taken =
          Object.entries(users).some(
            ([id, user]) => {
              if (
                id ===
                req.session.userId
              ) {
                return false;
              }

              const candidate =
                user.originalName ||
                user.name ||
                "";

              return (
                candidate.toLowerCase() ===
                name.toLowerCase()
              );
            }
          );

        if (taken) {
          return res.status(409).json({
            message:
              "Ese nombre ya está en uso",
          });
        }

        updates.name = name;
        updates.originalName = name;
      }

      if (
        typeof req.body?.avatar ===
        "string"
      ) {
        updates.avatar =
          req.body.avatar.slice(
            0,
            500000
          );
      }

      if (
        req.body?.language === "es" ||
        req.body?.language === "en"
      ) {
        updates.language =
          req.body.language;
      }

      if (
        typeof req.body?.youtubeUrl ===
        "string"
      ) {
        const youtubeUrl =
          req.body.youtubeUrl.trim();

        if (
          youtubeUrl.length > 500
        ) {
          return res.status(400).json({
            message:
              "URL de YouTube demasiado larga",
          });
        }

        if (youtubeUrl) {
          try {
            const parsed =
              new URL(youtubeUrl);

            if (
              parsed.protocol !==
                "https:" &&
              parsed.protocol !==
                "http:"
            ) {
              return res.status(400).json({
                message:
                  "URL de YouTube inválida",
              });
            }
          } catch {
            return res.status(400).json({
              message:
                "URL de YouTube inválida",
            });
          }
        }

        updates.youtubeUrl =
          youtubeUrl;
      }

      if (
        Object.keys(updates).length === 0
      ) {
        return res.status(400).json({
          message:
            "No hay cambios válidos",
        });
      }

      try {
        await writeFirebase(
          `users/${req.session.userId}`,
          "PATCH",
          updates
        );

        const user =
          await readFirebaseUser(
            req.session.userId!
          );

        return res.json({
          user: publicUser(
            user || {},
            req.session.userId!
          ),
        });
      } catch (error) {
        console.error(
          "Profile update error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo actualizar el perfil",
        });
      }
    }
  );

  /*
   * ==========================================================
   * USER LOOKUP
   * ==========================================================
   */

  app.get(
    "/api/users/:id",
    requireAuth,
    async (req, res) => {
      const id = String(
        req.params.id || ""
      ).trim();

      if (!validUserId(id)) {
        return res.status(400).json({
          message:
            "ID de usuario inválido",
        });
      }

      try {
        const user =
          await readFirebaseUser(id);

        if (!user) {
          return res.status(404).json({
            message:
              "Usuario no encontrado",
          });
        }

        return res.json({
          user: publicUser(
            user,
            id
          ),
        });
      } catch (error) {
        console.error(
          "User lookup error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo consultar el usuario",
        });
      }
    }
  );

  app.get(
    "/api/users",
    requireAuth,
    async (req, res) => {
      const search = String(
        req.query.search || ""
      )
        .trim()
        .toLowerCase();

      if (search.length > 80) {
        return res.status(400).json({
          message:
            "Búsqueda demasiado larga",
        });
      }

      try {
        const users =
          await readFirebaseUsers();

        const result =
          Object.entries(users)
            .filter(([id, user]) => {
              if (!search) {
                return true;
              }

              const name =
                (
                  user.name || ""
                ).toLowerCase();

              const originalName =
                (
                  user.originalName ||
                  ""
                ).toLowerCase();

              return (
                id.includes(search) ||
                name.includes(search) ||
                originalName.includes(
                  search
                )
              );
            })
            .slice(0, 50)
            .map(([id, user]) =>
              publicUser(user, id)
            );

        return res.json({
          users: result,
        });
      } catch (error) {
        console.error(
          "Users search error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudieron consultar los usuarios",
        });
      }
    }
  );

  /*
   * ==========================================================
   * DIRECT MESSAGES
   * ==========================================================
   */

  app.post(
    "/api/messages",
    requireAuth,
    async (req, res) => {
      const senderId =
        req.session.userId!;

      const recipientId = String(
        req.body?.recipientId || ""
      ).trim();

      if (!validUserId(recipientId)) {
        return res.status(400).json({
          message:
            "Destinatario inválido",
        });
      }

      if (
        recipientId === senderId
      ) {
        return res.status(400).json({
          message:
            "No puedes enviarte mensajes a ti mismo",
        });
      }

      const text = cleanText(
        req.body?.text,
        5000
      );

      const type =
        validMessageType(
          req.body?.type
        );

      const mediaUrl =
        typeof req.body?.mediaUrl ===
        "string"
          ? req.body.mediaUrl.slice(
              0,
              2000
            )
          : undefined;

      if (
        !text &&
        !mediaUrl &&
        type !== "system"
      ) {
        return res.status(400).json({
          message:
            "El mensaje no puede estar vacío",
        });
      }

      try {
        const recipient =
          await readFirebaseUser(
            recipientId
          );

        if (!recipient) {
          return res.status(404).json({
            message:
              "Destinatario no encontrado",
          });
        }

        if (recipient.banned) {
          return res.status(403).json({
            message:
              "No puedes enviar mensajes a esta cuenta",
          });
        }

        const id =
          clientMessageId(
            req.body?.clientMessageId
          );

        const message = {
          id,
          senderId,
          recipientId,
          text,
          timestamp: Date.now(),
          type,
          mediaUrl,
          replyTo:
            typeof req.body?.replyTo ===
            "string"
              ? req.body.replyTo.slice(
                  0,
                  120
                )
              : undefined,
          fileName:
            typeof req.body?.fileName ===
            "string"
              ? req.body.fileName.slice(
                  0,
                  180
                )
              : undefined,
          fileSize:
            typeof req.body?.fileSize ===
            "number" &&
            req.body.fileSize >= 0 &&
            req.body.fileSize <=
              40 * 1024 * 1024
              ? req.body.fileSize
              : undefined,
          mimeType:
            typeof req.body?.mimeType ===
            "string"
              ? req.body.mimeType.slice(
                  0,
                  120
                )
              : undefined,
        };

        const queueResult =
          await writeFirebase(
            `offline_messages/${recipientId}`,
            "POST",
            message
          );

        const queueId =
          queueResult &&
          typeof queueResult ===
            "object" &&
          "name" in queueResult
            ? String(
                (
                  queueResult as {
                    name: string;
                  }
                ).name
              )
            : undefined;

        /*
         * Índice para poder localizar un mensaje
         * pendiente posteriormente.
         */
        await writeFirebase(
          `message_index/${id}`,
          "PUT",
          {
            senderId,
            recipientId,
            queueId,
            type: "direct",
          }
        );

        return res.status(201).json({
          message: publicMessage(
            message
          ),
          queueId,
        });
      } catch (error) {
        console.error(
          "Send message error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo enviar el mensaje",
        });
      }
    }
  );

  /*
   * ==========================================================
   * MESSAGE INBOX
   * ==========================================================
   */

  app.get(
    "/api/messages/inbox",
    requireAuth,
    async (req, res) => {
      try {
        const raw =
          await readFirebase<
            Record<string, any>
          >(
            `offline_messages/${req.session.userId}`
          );

        if (
          !raw ||
          typeof raw !== "object"
        ) {
          return res.json({
            messages: [],
          });
        }

        const messages =
          Object.entries(raw)
            .map(
              ([queueId, message]) => ({
                queueId,
                message:
                  publicMessage(
                    message
                  ),
              })
            )
            .filter(
              (entry) =>
                entry.message !== null
            )
            .sort(
              (a, b) =>
                (a.message?.timestamp ||
                  0) -
                (b.message?.timestamp ||
                  0)
            )
            .slice(-100);

        return res.json({
          messages,
        });
      } catch (error) {
        console.error(
          "Inbox error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo consultar la bandeja",
        });
      }
    }
  );

  /*
   * ==========================================================
   * MESSAGE INBOX ACK
   * ==========================================================
   */

  app.post(
    "/api/messages/inbox/ack",
    requireAuth,
    async (req, res) => {
      const ids =
        Array.isArray(req.body?.ids)
          ? req.body.ids
          : [];

      if (
        ids.length === 0
      ) {
        return res.status(204).end();
      }

      if (
        ids.length > 100
      ) {
        return res.status(400).json({
          message:
            "Demasiados mensajes",
        });
      }

      try {
        await Promise.all(
          ids.map(async (queueId) => {
            if (
              typeof queueId !==
                "string" ||
              queueId.length > 200
            ) {
              return;
            }

            await writeFirebase(
              `offline_messages/${req.session.userId}/${queueId}`,
              "DELETE"
            );
          })
        );

        return res.status(204).end();
      } catch (error) {
        console.error(
          "Inbox ACK error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudieron confirmar los mensajes",
        });
      }
    }
  );

  /*
   * ==========================================================
   * GROUPS
   * ==========================================================
   */

  app.get(
    "/api/groups",
    requireAuth,
    async (req, res) => {
      try {
        const groups =
          await readFirebase<
            Record<string, FirebaseGroup>
          >("groups");

        const result =
          Object.entries(groups || {})
            .filter(
              ([, group]) =>
                normalizeParticipants(
                  group.participants
                ).includes(
                  req.session.userId!
                )
            )
            .map(([id, group]) =>
              publicGroup(
                group,
                id
              )
            );

        return res.json({
          groups: result,
        });
      } catch (error) {
        console.error(
          "Groups list error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudieron consultar los grupos",
        });
      }
    }
  );

  app.post(
    "/api/groups",
    requireAuth,
    async (req, res) => {
      const name = cleanText(
        req.body?.name,
        120
      );

      if (!name) {
        return res.status(400).json({
          message:
            "El nombre del grupo es requerido",
        });
      }

      try {
        const id =
          `group-${crypto.randomUUID()}`;

        const group: FirebaseGroup = {
          id,
          name,
          type: "group",
          participants: [
            req.session.userId!,
          ],
          messages: [],
          lastMessage: "",
          lastMessageTime:
            Date.now(),
          ownerId:
            req.session.userId!,
          userId:
            req.session.userId!,
        };

        await writeFirebase(
          `groups/${id}`,
          "PUT",
          group
        );

        return res.status(201).json({
          group: publicGroup(
            group,
            id
          ),
        });
      } catch (error) {
        console.error(
          "Create group error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo crear el grupo",
        });
      }
    }
  );

  app.get(
    "/api/groups/:id",
    requireAuth,
    async (req, res) => {
      const id = cleanText(
        req.params.id,
        200
      );

      try {
        const group =
          await readFirebase<FirebaseGroup>(
            `groups/${id}`
          );

        if (!group) {
          return res.status(404).json({
            message:
              "Grupo no encontrado",
          });
        }

        const participants =
          normalizeParticipants(
            group.participants
          );

        if (
          !participants.includes(
            req.session.userId!
          )
        ) {
          return res.status(403).json({
            message:
              "No perteneces a este grupo",
          });
        }

        return res.json({
          group: publicGroup(
            group,
            id
          ),
        });
      } catch (error) {
        console.error(
          "Get group error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo consultar el grupo",
        });
      }
    }
  );

  /*
   * ==========================================================
   * JOIN GROUP
   * ==========================================================
   */

  app.post(
    "/api/groups/:id/join",
    requireAuth,
    async (req, res) => {
      const id = cleanText(
        req.params.id,
        200
      );

      try {
        const group =
          await readFirebase<FirebaseGroup>(
            `groups/${id}`
          );

        if (!group) {
          return res.status(404).json({
            message:
              "Grupo no encontrado",
          });
        }

        const user =
          await readFirebaseUser(
            req.session.userId!
          );

        if (!user) {
          return res.status(401).json({
            message:
              "Usuario no encontrado",
          });
        }

        if (user.banned) {
          return res.status(403).json({
            message:
              "Esta cuenta está suspendida",
          });
        }

        const participants =
          normalizeParticipants(
            group.participants
          );

        if (
          !participants.includes(
            req.session.userId!
          )
        ) {
          participants.push(
            req.session.userId!
          );
        }

        group.participants =
          participants;

        await writeFirebase(
          `groups/${id}`,
          "PATCH",
          {
            participants,
          }
        );

        return res.json({
          group: publicGroup(
            {
              ...group,
              participants,
            },
            id
          ),
        });
      } catch (error) {
        console.error(
          "Join group error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo unir al grupo",
        });
      }
    }
  );

  /*
   * ==========================================================
   * UPDATE GROUP
   * ==========================================================
   */

  app.patch(
    "/api/groups/:id",
    requireAuth,
    async (req, res) => {
      const id = cleanText(
        req.params.id,
        200
      );

      try {
        const group =
          await readFirebase<FirebaseGroup>(
            `groups/${id}`
          );

        if (!group) {
          return res.status(404).json({
            message:
              "Grupo no encontrado",
          });
        }

        const participants =
          normalizeParticipants(
            group.participants
          );

        if (
          !participants.includes(
            req.session.userId!
          )
        ) {
          return res.status(403).json({
            message:
              "No perteneces a este grupo",
          });
        }

        const ownerId =
          group.ownerId ||
          group.userId ||
          participants[0];

        const admin =
          await isAdmin(
            req.session.userId!
          );

        if (
          ownerId !==
            req.session.userId &&
          !admin
        ) {
          return res.status(403).json({
            message:
              "No tienes permiso para modificar este grupo",
          });
        }

        const updates: Record<
          string,
          unknown
        > = {};

        if (
          typeof req.body?.name ===
          "string"
        ) {
          const name = cleanText(
            req.body.name,
            120
          );

          if (!name) {
            return res.status(400).json({
              message:
                "Nombre de grupo inválido",
            });
          }

          updates.name = name;
        }

        if (
          typeof req.body?.avatar ===
          "string"
        ) {
          updates.avatar =
            req.body.avatar.slice(
              0,
              500000
            );
        }

        if (
          typeof req.body?.wallpaper ===
          "string"
        ) {
          updates.wallpaper =
            req.body.wallpaper.slice(
              0,
              1000000
            );
        }

        if (
          Object.keys(updates).length === 0
        ) {
          return res.status(400).json({
            message:
              "No hay cambios válidos",
          });
        }

        await writeFirebase(
          `groups/${id}`,
          "PATCH",
          updates
        );

        const updated =
          await readFirebase<FirebaseGroup>(
            `groups/${id}`
          );

        return res.json({
          group: publicGroup(
            updated || group,
            id
          ),
        });
      } catch (error) {
        console.error(
          "Update group error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo actualizar el grupo",
        });
      }
    }
  );

  /*
   * ==========================================================
   * GROUP MESSAGES
   * ==========================================================
   */

  app.post(
    "/api/groups/:id/messages",
    requireAuth,
    async (req, res) => {
      const groupId = cleanText(
        req.params.id,
        200
      );

      const text = cleanText(
        req.body?.text,
        5000
      );

      const type =
        validMessageType(
          req.body?.type
        );

      const mediaUrl =
        typeof req.body?.mediaUrl ===
        "string"
          ? req.body.mediaUrl.slice(
              0,
              2000
            )
          : undefined;

      if (
        !text &&
        !mediaUrl &&
        type !== "system"
      ) {
        return res.status(400).json({
          message:
            "El mensaje no puede estar vacío",
        });
      }

      try {
        const group =
          await readFirebase<FirebaseGroup>(
            `groups/${groupId}`
          );

        if (!group) {
          return res.status(404).json({
            message:
              "Grupo no encontrado",
          });
        }

        const participants =
          normalizeParticipants(
            group.participants
          );

        if (
          !participants.includes(
            req.session.userId!
          )
        ) {
          return res.status(403).json({
            message:
              "No perteneces a este grupo",
          });
        }

        const id =
          clientMessageId(
            req.body?.clientMessageId
          );

        const message = {
          id,
          senderId:
            req.session.userId!,
          text,
          timestamp: Date.now(),
          type,
          mediaUrl,
          replyTo:
            typeof req.body?.replyTo ===
            "string"
              ? req.body.replyTo.slice(
                  0,
                  120
                )
              : undefined,
          fileName:
            typeof req.body?.fileName ===
            "string"
              ? req.body.fileName.slice(
                  0,
                  180
                )
              : undefined,
          fileSize:
            typeof req.body?.fileSize ===
              "number" &&
            req.body.fileSize >= 0 &&
            req.body.fileSize <=
              40 * 1024 * 1024
              ? req.body.fileSize
              : undefined,
          mimeType:
            typeof req.body?.mimeType ===
            "string"
              ? req.body.mimeType.slice(
                  0,
                  120
                )
              : undefined,
        };

        const messages =
          normalizeMessages(
            group.messages
          );

        messages.push(message);

        /*
         * Evita que el grupo crezca
         * indefinidamente.
         */
        const trimmedMessages =
          messages.slice(-1000);

        await writeFirebase(
          `groups/${groupId}`,
          "PATCH",
          {
            messages:
              trimmedMessages,
            lastMessage: text
              ? text.slice(0, 5000)
              : `[${type}]`,
            lastMessageTime:
              message.timestamp,
          }
        );

        await writeFirebase(
          `message_index/${id}`,
          "PUT",
          {
            senderId:
              req.session.userId!,
            groupId,
            type: "group",
          }
        );

        return res.status(201).json({
          message:
            publicMessage(message),
        });
      } catch (error) {
        console.error(
          "Group message error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo enviar el mensaje",
        });
      }
    }
  );

  /*
   * ==========================================================
   * DELETE MESSAGE
   * ==========================================================
   */

  app.delete(
    "/api/messages/:id",
    requireAuth,
    async (req, res) => {
      const messageId =
        cleanText(
          req.params.id,
          120
        );

      try {
        const index =
          await readFirebase<{
            senderId?: string;
            recipientId?: string;
            queueId?: string;
            groupId?: string;
            type?: string;
          }>(
            `message_index/${messageId}`
          );

        if (!index) {
          return res.status(404).json({
            message:
              "Mensaje no encontrado en el servidor",
          });
        }

        if (
          index.senderId !==
          req.session.userId
        ) {
          return res.status(403).json({
            message:
              "No puedes eliminar este mensaje",
          });
        }

        /*
         * Mensaje directo todavía pendiente.
         */
        if (
          index.type === "direct" &&
          index.recipientId &&
          index.queueId
        ) {
          await writeFirebase(
            `offline_messages/${index.recipientId}/${index.queueId}`,
            "DELETE"
          );

          await writeFirebase(
            `message_index/${messageId}`,
            "DELETE"
          );

          return res.json({
            deleted: true,
            pending: true,
          });
        }

        /*
         * Mensaje de grupo.
         */
        if (index.groupId) {
          const group =
            await readFirebase<FirebaseGroup>(
              `groups/${index.groupId}`
            );

          if (!group) {
            return res.status(404).json({
              message:
                "Grupo no encontrado",
            });
          }

          const participants =
            normalizeParticipants(
              group.participants
            );

          const admin =
            await isAdmin(
              req.session.userId!
            );

          if (
            !participants.includes(
              req.session.userId!
            ) &&
            !admin
          ) {
            return res.status(403).json({
              message:
                "No perteneces a este grupo",
            });
          }

          const messages =
            normalizeMessages(
              group.messages
            );

          const updated =
            messages.map(
              (message: any) => {
                if (
                  message?.id !==
                  messageId
                ) {
                  return message;
                }

                return {
                  ...message,
                  text: "",
                  mediaUrl:
                    undefined,
                  deleted: true,
                };
              }
            );

          await writeFirebase(
            `groups/${index.groupId}`,
            "PATCH",
            {
              messages:
                updated.slice(-1000),
            }
          );

          await writeFirebase(
            `message_index/${messageId}`,
            "DELETE"
          );

          return res.json({
            deleted: true,
            pending: false,
          });
        }

        return res.status(404).json({
          message:
            "Mensaje no disponible",
        });
      } catch (error) {
        console.error(
          "Delete message error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo eliminar el mensaje",
        });
      }
    }
  );

  /*
   * ==========================================================
   * ADMINS
   * ==========================================================
   */

  app.get(
    "/api/admins",
    requireAuth,
    async (req, res) => {
      try {
        const admins =
          await readFirebase<
            Record<string, unknown>
          >("admins");

        const ids =
          Object.entries(
            admins || {}
          )
            .filter(
              ([, value]) =>
                value !== false &&
                value !== null
            )
            .map(([id]) => id)
            .filter(validUserId);

        return res.json({
          admins: ids,
        });
      } catch (error) {
        console.error(
          "Admins list error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudieron consultar los administradores",
        });
      }
    }
  );

  app.post(
    "/api/admins",
    requireAdmin,
    async (req, res) => {
      const userId = String(
        req.body?.userId || ""
      ).trim();

      if (!validUserId(userId)) {
        return res.status(400).json({
          message:
            "ID de administrador inválido",
        });
      }

      try {
        const user =
          await readFirebaseUser(
            userId
          );

        if (!user) {
          return res.status(404).json({
            message:
              "Usuario no encontrado",
          });
        }

        await writeFirebase(
          `admins/${userId}`,
          "PUT",
          true
        );

        return res.status(201).json({
          success: true,
          userId,
        });
      } catch (error) {
        console.error(
          "Add admin error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo agregar el administrador",
        });
      }
    }
  );

  app.delete(
    "/api/admins/:id",
    requireAdmin,
    async (req, res) => {
      const userId = String(
        req.params.id || ""
      ).trim();

      if (!validUserId(userId)) {
        return res.status(400).json({
          message:
            "ID inválido",
        });
      }

      try {
        await writeFirebase(
          `admins/${userId}`,
          "DELETE"
        );

        return res.status(204).end();
      } catch (error) {
        console.error(
          "Remove admin error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo eliminar el administrador",
        });
      }
    }
  );

  /*
   * ==========================================================
   * ADMIN — BAN
   * ==========================================================
   */

  app.post(
    "/api/admin/users/:id/ban",
    requireAdmin,
    async (req, res) => {
      const userId = String(
        req.params.id || ""
      ).trim();

      if (!validUserId(userId)) {
        return res.status(400).json({
          message:
            "ID de usuario inválido",
        });
      }

      if (
        userId === req.session.userId
      ) {
        return res.status(400).json({
          message:
            "No puedes suspenderte a ti mismo",
        });
      }

      try {
        const user =
          await readFirebaseUser(
            userId
          );

        if (!user) {
          return res.status(404).json({
            message:
              "Usuario no encontrado",
          });
        }

        await writeFirebase(
          `users/${userId}`,
          "PATCH",
          {
            banned: true,
          }
        );

        return res.json({
          success: true,
          userId,
          banned: true,
        });
      } catch (error) {
        console.error(
          "Ban user error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo suspender al usuario",
        });
      }
    }
  );

  app.post(
    "/api/admin/users/:id/unban",
    requireAdmin,
    async (req, res) => {
      const userId = String(
        req.params.id || ""
      ).trim();

      if (!validUserId(userId)) {
        return res.status(400).json({
          message:
            "ID de usuario inválido",
        });
      }

      try {
        const user =
          await readFirebaseUser(
            userId
          );

        if (!user) {
          return res.status(404).json({
            message:
              "Usuario no encontrado",
          });
        }

        await writeFirebase(
          `users/${userId}`,
          "PATCH",
          {
            banned: false,
          }
        );

        return res.json({
          success: true,
          userId,
          banned: false,
        });
      } catch (error) {
        console.error(
          "Unban user error:",
          error
        );

        return res.status(503).json({
          message:
            "No se pudo quitar la suspensión",
        });
      }
    }
  );

  /*
   * ==========================================================
   * UPLOAD API
   * ==========================================================
   */

  app.post(
    "/api/uploads",
    requireAuth,
    async (req, res) => {
      const dataUrl =
        typeof req.body?.dataUrl ===
        "string"
          ? req.body.dataUrl
          : "";

      if (!dataUrl) {
        return res.status(400).json({
          message:
            "Archivo no proporcionado",
        });
      }

      /*
       * data:image/png;base64,...
       */
      const match =
        dataUrl.match(
          /^data:([^;,]+);base64,(.+)$/s
        );

      if (!match) {
        return res.status(400).json({
          message:
            "Formato de archivo inválido",
        });
      }

      const mimeType = match[1]
        .toLowerCase()
        .trim();

      const base64Data = match[2];

      const allowedMimeTypes =
        new Set([
          "image/png",
          "image/jpeg",
          "image/gif",
          "image/webp",
          "image/avif",
          "image/bmp",
          "audio/mpeg",
          "audio/wav",
          "audio/ogg",
          "audio/mp4",
          "video/webm",
          "video/mp4",
          "application/pdf",
          "text/plain",
        ]);

      if (
        !allowedMimeTypes.has(
          mimeType
        )
      ) {
        return res.status(415).json({
          message:
            "Tipo de archivo no permitido",
        });
      }

      let buffer: Buffer;

      try {
        buffer =
          Buffer.from(
            base64Data,
            "base64"
          );
      } catch {
        return res.status(400).json({
          message:
            "Archivo Base64 inválido",
        });
      }

      const maxSize =
        40 * 1024 * 1024;

      if (
        buffer.length === 0 ||
        buffer.length > maxSize
      ) {
        return res.status(413).json({
          message:
            "El archivo supera el límite de 40 MB",
        });
      }

      const extensionMap:
        Record<string, string> = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/avif": ".avif",
        "image/bmp": ".bmp",
        "audio/mpeg": ".mp3",
        "audio/wav": ".wav",
        "audio/ogg": ".ogg",
        "audio/mp4": ".m4a",
        "video/webm": ".webm",
        "video/mp4": ".mp4",
        "application/pdf": ".pdf",
        "text/plain": ".txt",
      };

      const extension =
        extensionMap[mimeType];

      if (!extension) {
        return res.status(415).json({
          message:
            "Extensión no permitida",
        });
      }

      const filename =
        `${crypto.randomUUID()}${extension}`;

      const filePath =
        path.join(
          uploadDirectory,
          filename
        );

      try {
        await fs.writeFile(
          filePath,
          buffer,
          {
            flag: "wx",
          }
        );

        return res.status(201).json({
          url:
            `/uploads/${filename}`,
          filename,
          mimeType,
          size: buffer.length,
        });
      } catch (error) {
        console.error(
          "Upload write error:",
          error
        );

        return res.status(500).json({
          message:
            "No se pudo guardar el archivo",
        });
      }
    }
  );

  return httpServer;
}