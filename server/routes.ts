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

function passwordMatches(
  password: string,
  storedPassword?: string
) {
  if (!storedPassword) return false;

  // Compatibilidad con contraseñas antiguas en texto plano.
  if (!storedPassword.startsWith("scrypt:")) {
    const actual = Buffer.from(password);
    const expected = Buffer.from(storedPassword);

    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  }

  const [, salt, expected] = storedPassword.split(":");

  if (!salt || !expected) return false;

  const actual = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");

  return (
    Buffer.byteLength(actual) ===
      Buffer.byteLength(expected) &&
    crypto.timingSafeEqual(
      Buffer.from(actual),
      Buffer.from(expected)
    )
  );
}

async function readFirebaseUsers(): Promise<
  Record<string, FirebaseUser>
> {
  const response = await fetch(
    `${firebaseDatabaseUrl}/users.json`
  );

  if (!response.ok) {
    throw new Error(
      "No se pudo conectar con el servidor de usuarios"
    );
  }

  return (await response.json()) || {};
}

async function readFirebaseUser(
  id: string
): Promise<FirebaseUser | undefined> {
  const response = await fetch(
    `${firebaseDatabaseUrl}/users/${encodeURIComponent(id)}.json`
  );

  if (!response.ok) {
    throw new Error(
      "No se pudo conectar con el servidor de usuarios"
    );
  }

  return (await response.json()) || undefined;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  /*
   * ============================================================
   * UPLOADS
   * ============================================================
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
            path.extname(filePath).toLowerCase()
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
   * ============================================================
   * AUTH MIDDLEWARE
   * ============================================================
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

  /*
   * ============================================================
   * AUTH
   * ============================================================
   */

  app.post("/api/auth/login", async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const password = String(req.body?.password || "");

    const address = req.ip || "unknown";
    const attempt = failedLogins.get(address);

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
      const users = await readFirebaseUsers();

      const entry = Object.entries(users).find(
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
        const current = failedLogins.get(address);

        failedLogins.set(address, {
          count:
            (current &&
            current.resetAt > Date.now()
              ? current.count
              : 0) + 1,
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
       * Migrar contraseñas antiguas a scrypt
       * después de un login correcto.
       */
      if (
        user.password &&
        !user.password.startsWith("scrypt:")
      ) {
        await fetch(
          `${firebaseDatabaseUrl}/users/${encodeURIComponent(id)}.json`,
          {
            method: "PATCH",
            headers: {
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              password:
                hashPassword(password),
            }),
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
  });

  app.post("/api/auth/register", async (req, res) => {
    const name = String(
      req.body?.name || ""
    ).trim();

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
      [
        "leo33445",
        "theowner",
        "owner",
      ].includes(name.toLowerCase())
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

      const user: FirebaseUser = {
        id,
        name,
        originalName: name,
        password:
          hashPassword(password),
        language:
          String(
            req.body?.language || ""
          ).startsWith("es")
            ? "es"
            : "en",
        avatar:
          typeof req.body?.avatar ===
          "string"
            ? req.body.avatar
            : undefined,
      };

      const response =
        await fetch(
          `${firebaseDatabaseUrl}/users/${id}.json`,
          {
            method: "PUT",
            headers: {
              "content-type":
                "application/json",
            },
            body: JSON.stringify(user),
          }
        );

      if (!response.ok) {
        throw new Error(
          "No se pudo crear la cuenta"
        );
      }

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
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        authenticated: false,
      });
    }

    try {
      const user =
        await readFirebaseUser(userId);

      if (!user) {
        req.session.destroy(() => {});

        return res.status(401).json({
          authenticated: false,
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
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.status(204).end();
    });
  });

  /*
   * ============================================================
   * CHANGE PASSWORD
   * ============================================================
   */

  app.post(
    "/api/auth/change-password",
    requireAuth,
    async (req, res) => {

      const userId =
        req.session.userId!;

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
            userId
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

        const response =
          await fetch(
            `${firebaseDatabaseUrl}/users/${encodeURIComponent(userId)}.json`,
            {
              method: "PATCH",
              headers: {
                "content-type":
                  "application/json",
              },
              body: JSON.stringify({
                password:
                  hashPassword(
                    newPassword
                  ),
              }),
            }
          );

        if (!response.ok) {
          throw new Error(
            "No se pudo cambiar la contraseña"
          );
        }

        return res
          .status(204)
          .end();

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
   * ============================================================
   * USER LOOKUP
   * ============================================================
   */

  app.get(
    "/api/users/:id",
    requireAuth,
    async (req, res) => {

      const id = String(
        req.params.id || ""
      ).trim();

      if (!/^\d{8}$/.test(id)) {
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
            .filter(
              ([id, user]) => {
                if (!search)
                  return true;

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
              }
            )
            .slice(0, 50)
            .map(
              ([id, user]) =>
                publicUser(
                  user,
                  id
                )
            );

        return res.json({
          users: result,
        });

      } catch (error) {
        console.error(
          "User search error:",
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
   * ============================================================
   * UPDATE OWN PROFILE
   * ============================================================
   *
   * IMPORTANTE:
   * El ID, originalName, password, banned,
   * punishedUntil y googleLinked NO pueden modificarse
   * mediante este endpoint.
   */

  app.patch(
    "/api/auth/me",
    requireAuth,
    async (req, res) => {

      const userId =
        req.session.userId!;

      const updates: Record<
        string,
        unknown
      > = {};

      if (
        typeof req.body?.name ===
        "string"
      ) {
        const name =
          req.body.name
            .trim()
            .slice(0, 40);

        if (name.length >= 2) {
          updates.name = name;
        }
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
        Object.keys(updates)
          .length === 0
      ) {
        return res.status(400).json({
          message:
            "No hay campos de perfil válidos para actualizar",
        });
      }

      try {
        const response =
          await fetch(
            `${firebaseDatabaseUrl}/users/${encodeURIComponent(userId)}.json`,
            {
              method: "PATCH",
              headers: {
                "content-type":
                  "application/json",
              },
              body: JSON.stringify(
                updates
              ),
            }
          );

        if (!response.ok) {
          throw new Error(
            "No se pudo actualizar el perfil"
          );
        }

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

        return res.json({
          user: publicUser(
            user,
            userId
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
   * ============================================================
   * MESSAGES
   * ============================================================
   *
   * El senderId SIEMPRE sale de la sesión.
   * El cliente no puede elegir otro usuario como remitente.
   */

  app.post(
    "/api/messages",
    requireAuth,
    async (req, res) => {

      const senderId =
        req.session.userId!;

      const recipientId =
        String(
          req.body?.recipientId ||
            ""
        ).trim();

      const text =
        String(
          req.body?.text || ""
        ).trim();

      if (
        !/^\d{8}$/.test(
          recipientId
        )
      ) {
        return res.status(400).json({
          message:
            "Destinatario inválido",
        });
      }

      if (
        !text ||
        text.length > 5000
      ) {
        return res.status(400).json({
          message:
            "Mensaje inválido",
        });
      }

      if (
        recipientId === senderId
      ) {
        return res.status(400).json({
          message:
            "No puedes enviarte un mensaje a ti mismo",
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

        const message = {
          senderId,
          recipientId,
          text,
          timestamp: Date.now(),
        };

        const response =
          await fetch(
            `${firebaseDatabaseUrl}/offline_messages/${encodeURIComponent(recipientId)}.json`,
            {
              method: "POST",
              headers: {
                "content-type":
                  "application/json",
              },
              body: JSON.stringify(
                message
              ),
            }
          );

        if (!response.ok) {
          throw new Error(
            "No se pudo guardar el mensaje"
          );
        }

        return res.status(201).json({
          message,
        });

      } catch (error) {
        console.error(
          "Message send error:",
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
   * ============================================================
   * FILE UPLOADS
   * ============================================================
   */

  app.post(
    "/api/uploads",
    requireAuth,
    async (req, res) => {

      const dataUrl =
        String(
          req.body?.dataUrl || ""
        );

      const fileName =
        String(
          req.body?.fileName ||
            "archivo"
        );

      const mimeType =
        String(
          req.body?.mimeType ||
            "application/octet-stream"
        );

      const match =
        dataUrl.match(
          /^data:[^;]+;base64,(.+)$/
        );

      if (!match) {
        return res.status(400).json({
          message:
            "Archivo inválido",
        });
      }

      try {
        const content =
          Buffer.from(
            match[1],
            "base64"
          );

        if (
          content.length >
          40 * 1024 * 1024
        ) {
          return res.status(413).json({
            message:
              "El archivo supera el límite de 40 MB",
          });
        }

        await fs.mkdir(
          uploadDirectory,
          {
            recursive: true,
          }
        );

        const extension =
          path
            .extname(fileName)
            .replace(
              /[^a-zA-Z0-9.]/g,
              ""
            )
            .slice(0, 12);

        const storedName =
          `${crypto.randomUUID()}${extension}`;

        await fs.writeFile(
          path.join(
            uploadDirectory,
            storedName
          ),
          content
        );

        return res.status(201).json({
          url:
            `/uploads/${storedName}`,
          fileName:
            fileName.slice(
              0,
              180
            ),
          mimeType,
          size:
            content.length,
        });

      } catch (error) {
        console.error(
          "Upload error:",
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