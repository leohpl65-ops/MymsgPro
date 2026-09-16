import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useLocation } from "wouter";
import { nanoid } from "nanoid";
import { censorMessage } from "./censor";
import {
  generateUserAvatarSvg,
  generateGroupAvatarSvg,
} from "./avatars";

// --- Types ---

export interface User {
  id: string;
  name: string;
  originalName?: string;
  avatar?: string;
  /**
   * Kept only for type compatibility.
   * Passwords must NEVER be stored in the client.
   */
  password?: string;
  language?: "es" | "en";
  status?: string;
  youtubeUrl?: string;
  googleLinked?: string;
  banned?: boolean;
  punishedUntil?: number;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  type: "text" | "image" | "audio" | "file" | "system";
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  read?: boolean;
  status: "sent" | "delivered" | "read";
  replyTo?: string;
  isDeletedForMe?: boolean;
  isDeletedForEveryone?: boolean;
}

export interface CallRecord {
  id: string;
  peerId: string;
  peerName: string;
  peerAvatar: string;
  status: "missed" | "rejected" | "answered";
  direction: "incoming" | "outgoing";
  timestamp: number;
  duration?: number;
}

export interface Chat {
  id: string;
  type: "direct" | "group";
  name: string;
  avatar?: string;
  participants: string[];
  messages: Message[];
  lastMessage?: string;
  lastMessageTime?: number;
  wallpaper?: string;
  userId?: string;
  streak?: number;
  lastInteractionDay?: string;
}

export interface Report {
  id: string;
  type: "Usuario" | "Grupo";
  targetId: string;
  targetName: string;
  reporterId: string;
  timestamp: number;
  targetMessages: Message[];
}

interface StoreContextType {
  currentUser: User | null;
  isOnline: boolean;

  login: (
    name: string,
    id: string,
    password: string,
  ) => Promise<void>;

  verifyPassword: (
    id: string,
    password: string,
  ) => boolean;

  logout: () => void;

  chats: Chat[];

  createGroup: (name: string) => void;
  joinGroup: (groupId: string) => void;

  addContact: (
    contactId: string,
    contactName: string,
  ) => boolean;

  sendMessage: (
    chatId: string,
    text: string,
    type?: "text" | "image" | "audio" | "file" | "system",
    mediaUrl?: string,
    replyTo?: string,
    fileName?: string,
    fileSize?: number,
    mimeType?: string,
  ) => void;

  getChat: (
    chatId: string,
  ) => Chat | undefined;

  updateUser: (
    updates: Partial<User>,
  ) => void;

  updateGroup: (
    groupId: string,
    updates: Partial<Chat>,
  ) => void;

  admins: string[];

  addAdmin: (
    userId: string,
  ) => void;

  removeAdmin: (
    userId: string,
  ) => void;

  reports: Report[];

  reportEntity: (
    type: "Usuario" | "Grupo",
    targetId: string,
    targetName: string,
  ) => void;

  setChatWallpaper: (
    chatId: string,
    url: string,
  ) => void;

  getChatMessages: (
    chatId: string,
  ) => Message[];

  getAllUsers: () => Map<string, User>;

  forgetChat: (
    chatId: string,
  ) => void;

  clearChatMessages: (
    chatId: string,
  ) => void;

  deleteMessage: (
    chatId: string,
    messageId: string,
    deleteForEveryone?: boolean,
  ) => void;

  deleteReport: (
    reportId: string,
  ) => void;

  markChatAsRead: (
    chatId: string,
  ) => void;

  replyToMessage: (
    chatId: string,
    messageId: string,
    replyText: string,
  ) => void;

  forwardMessage: (
    fromChatId: string,
    messageId: string,
    toChatId: string,
  ) => void;
}

const StoreContext =
  createContext<StoreContextType | undefined>(undefined);

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function removeSensitiveUserFields(
  user: Partial<User>,
): User {
  const {
    password: _password,
    googleLinked: _googleLinked,
    ...safeUser
  } = user;

  return safeUser as User;
}

async function parseApiResponse(
  response: Response,
): Promise<any> {
  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Error del servidor (${response.status})`,
    );
  }

  return data;
}

function saveSafeUser(user: User) {
  const safeUser =
    removeSensitiveUserFields(user);

  localStorage.setItem(
    `mymsg_user_${safeUser.id}`,
    JSON.stringify(safeUser),
  );

  localStorage.setItem(
    "mymsg_user",
    JSON.stringify(safeUser),
  );
}

function getStoredChats(
  userId: string,
): Chat[] {
  try {
    const saved = localStorage.getItem(
      `mymsg_chats_${userId}`,
    );

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

function saveChats(
  userId: string,
  chats: Chat[],
) {
  localStorage.setItem(
    `mymsg_chats_${userId}`,
    JSON.stringify(chats),
  );
}

// ---------------------------------------------------------
// Provider
// ---------------------------------------------------------

export function StoreProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [, setLocation] = useLocation();

  const [currentUser, setCurrentUser] =
    useState<User | null>(() => {
      const saved =
        localStorage.getItem("mymsg_user");

      if (!saved) return null;

      try {
        const parsed = JSON.parse(saved);

        return removeSensitiveUserFields(
          parsed,
        );
      } catch {
        localStorage.removeItem(
          "mymsg_user",
        );
        return null;
      }
    });

  const [isOnline, setIsOnline] =
    useState<boolean>(
      typeof navigator !== "undefined"
        ? navigator.onLine
        : true,
    );

  const [chats, setChats] =
    useState<Chat[]>([]);

  const [reports, setReports] =
    useState<Report[]>([]);

  const [admins, setAdmins] =
    useState<string[]>([]);

  // -------------------------------------------------------
  // Online / Offline
  // -------------------------------------------------------

  useEffect(() => {
    const handleOnline = () =>
      setIsOnline(true);

    const handleOffline = () =>
      setIsOnline(false);

    window.addEventListener(
      "online",
      handleOnline,
    );

    window.addEventListener(
      "offline",
      handleOffline,
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnline,
      );

      window.removeEventListener(
        "offline",
        handleOffline,
      );
    };
  }, []);

  // -------------------------------------------------------
  // Restore chats
  // -------------------------------------------------------

  useEffect(() => {
    if (!currentUser) {
      setChats([]);
      return;
    }

    const savedChats =
      getStoredChats(currentUser.id);

    if (savedChats.length > 0) {
      setChats(savedChats);
      return;
    }

    const aiChat: Chat = {
      id: `dm-${[
        currentUser.id,
        "mymsgai",
      ]
        .sort()
        .join("-")}`,

      type: "direct",

      name: "MymsgAI",

      avatar:
        generateUserAvatarSvg(
          "MymsgAI",
        ),

      participants: [
        currentUser.id,
        "mymsgai",
      ],

      messages: [],

      lastMessageTime:
        Date.now(),

      userId:
        currentUser.id,
    };

    setChats([aiChat]);
  }, [currentUser]);

  // -------------------------------------------------------
  // Save chats locally
  // -------------------------------------------------------

  useEffect(() => {
    if (!currentUser) return;

    saveChats(
      currentUser.id,
      chats,
    );
  }, [chats, currentUser]);

  // -------------------------------------------------------
  // Reports
  // -------------------------------------------------------

  useEffect(() => {
    if (!currentUser) return;

    try {
      const saved =
        localStorage.getItem(
          `mymsg_reports_${currentUser.id}`,
        );

      if (saved) {
        const parsed =
          JSON.parse(saved);

        setReports(
          Array.isArray(parsed)
            ? parsed
            : [],
        );
      } else {
        setReports([]);
      }
    } catch {
      setReports([]);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    localStorage.setItem(
      `mymsg_reports_${currentUser.id}`,
      JSON.stringify(reports),
    );
  }, [reports, currentUser]);

  // -------------------------------------------------------
  // Validate existing session
  // -------------------------------------------------------

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;

    fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
    })
      .then(async (response) => {
        if (cancelled) return;

        if (!response.ok) {
          setCurrentUser(null);
          setChats([]);

          localStorage.removeItem(
            "mymsg_user",
          );

          return;
        }

        const data =
          await response
            .json()
            .catch(() => null);

        if (
          data?.user &&
          !cancelled
        ) {
          const safeUser =
            removeSensitiveUserFields(
              data.user,
            );

          setCurrentUser(
            safeUser,
          );

          saveSafeUser(
            safeUser,
          );
        }
      })
      .catch(() => {
        if (cancelled) return;

        // Don't destroy a local session just
        // because the network is temporarily down.
        if (!navigator.onLine) return;

        setCurrentUser(null);
        setChats([]);

        localStorage.removeItem(
          "mymsg_user",
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------------
  // Load admins
  // -------------------------------------------------------

  useEffect(() => {
    if (!currentUser) {
      setAdmins([]);
      return;
    }

    let cancelled = false;

    fetch("/api/admins", {
      method: "GET",
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) return;

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (cancelled) return;

        if (Array.isArray(data?.admins)) {
          setAdmins(
            data.admins.map(
              (id: unknown) =>
                String(id),
            ),
          );
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // -------------------------------------------------------
  // Login
  // -------------------------------------------------------

  const login = async (
    name: string,
    _id: string,
    password: string,
  ) => {
    const cleanName =
      name.trim();

    if (!cleanName) {
      throw new Error(
        "El nombre de usuario es requerido",
      );
    }

    if (!password) {
      throw new Error(
        "La contraseña es requerida",
      );
    }

    const response =
      await fetch(
        "/api/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            name: cleanName,
            password,
          }),
        },
      );

    const data =
      await parseApiResponse(
        response,
      );

    if (!data?.user?.id) {
      throw new Error(
        "El servidor no devolvió un usuario válido",
      );
    }

    const user =
      removeSensitiveUserFields(
        data.user,
      );

    setCurrentUser(user);

    saveSafeUser(user);

    const restored =
      getStoredChats(user.id);

    setChats(restored);

    /*
     * IMPORTANT:
     * The supplied ID is deliberately ignored.
     * The authenticated ID comes from the server.
     */
  };

  // -------------------------------------------------------
  // Password verification
  // -------------------------------------------------------

  const verifyPassword = (
    _id: string,
    _password: string,
  ): boolean => {
    /*
     * Password verification must never happen
     * against localStorage or client-side data.
     *
     * Existing callers should migrate to a
     * server endpoint.
     */
    return false;
  };

  // -------------------------------------------------------
  // Logout
  // -------------------------------------------------------

  const logout = () => {
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});

    setCurrentUser(null);
    setChats([]);
    setReports([]);
    setAdmins([]);

    localStorage.removeItem(
      "mymsg_user",
    );
  };

  // -------------------------------------------------------
  // Create group
  // -------------------------------------------------------

  const createGroup = (
    name: string,
  ) => {
    if (!currentUser) return;

    const cleanName =
      name.trim().slice(0, 100);

    if (!cleanName) return;

    void (async () => {
      try {
        const response =
          await fetch(
            "/api/groups",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials: "include",

              body: JSON.stringify({
                name: cleanName,
              }),
            },
          );

        const data =
          await parseApiResponse(
            response,
          );

        if (!data?.group) {
          throw new Error(
            "El servidor no devolvió el grupo",
          );
        }

        const group =
          data.group as Chat;

        setChats((prev) => {
          if (
            prev.some(
              (c) =>
                c.id === group.id,
            )
          ) {
            return prev;
          }

          return [
            group,
            ...prev,
          ];
        });
      } catch (error) {
        console.error(
          "Create group error:",
          error,
        );
      }
    })();
  };

  // -------------------------------------------------------
  // Join group
  // -------------------------------------------------------

  const joinGroup = (
    groupId: string,
  ) => {
    if (!currentUser) return;

    const cleanId =
      groupId
        .trim()
        .replace(
          /^group-/,
          "",
        );

    if (!cleanId) return;

    void (async () => {
      try {
        const response =
          await fetch(
            `/api/groups/${encodeURIComponent(
              cleanId,
            )}/join`,
            {
              method: "POST",

              credentials: "include",

              headers: {
                "Content-Type":
                  "application/json",
              },
            },
          );

        const data =
          await parseApiResponse(
            response,
          );

        if (!data?.group) {
          throw new Error(
            "El servidor no devolvió el grupo",
          );
        }

        const group =
          data.group as Chat;

        setChats((prev) => {
          const index =
            prev.findIndex(
              (c) =>
                c.id === group.id,
            );

          if (index >= 0) {
            const copy =
              [...prev];

            copy[index] = group;

            return copy;
          }

          return [
            group,
            ...prev,
          ];
        });
      } catch (error) {
        console.error(
          "Join group error:",
          error,
        );
      }
    })();
  };

  // -------------------------------------------------------
  // Add contact
  // -------------------------------------------------------

  const addContact = (
    contactId: string,
    _contactName: string,
  ): boolean => {
    if (!currentUser) {
      return false;
    }

    if (
      contactId === "mymsgai" ||
      contactId.toLowerCase() === "ia"
    ) {
      const exists =
        chats.some(
          (chat) =>
            chat.type === "direct" &&
            chat.participants.includes(
              currentUser.id,
            ) &&
            chat.participants.includes(
              "mymsgai",
            ),
        );

      if (exists) return false;

      const newChat: Chat = {
        id: `dm-${[
          currentUser.id,
          "mymsgai",
        ]
          .sort()
          .join("-")}`,

        type: "direct",

        name: "MymsgAI",

        avatar:
          generateUserAvatarSvg(
            "MymsgAI",
          ),

        participants: [
          currentUser.id,
          "mymsgai",
        ],

        messages: [
          {
            id: nanoid(),
            senderId: "mymsgai",
            text:
              "¡Hola! Soy MymsgAI, tu asistente virtual inteligente.",
            timestamp:
              Date.now(),
            type: "text",
            status: "read",
            read: true,
          },
        ],

        lastMessage:
          "¡Hola! Soy MymsgAI...",

        lastMessageTime:
          Date.now(),

        userId:
          currentUser.id,
      };

      setChats((prev) => [
        newChat,
        ...prev,
      ]);

      return true;
    }

    const cleanId =
      contactId.trim();

    if (!/^\d{8}$/.test(cleanId)) {
      return false;
    }

    const existing =
      chats.find(
        (chat) =>
          chat.type === "direct" &&
          chat.participants.includes(
            currentUser.id,
          ) &&
          chat.participants.includes(
            cleanId,
          ),
      );

    if (existing) {
      return false;
    }

    /*
     * The supplied contactName is NOT trusted.
     * The actual profile is fetched from the server.
     */

    void (async () => {
      try {
        const response =
          await fetch(
            `/api/users/${encodeURIComponent(
              cleanId,
            )}`,
            {
              method: "GET",
              credentials: "include",
            },
          );

        const data =
          await parseApiResponse(
            response,
          );

        if (!data?.user) {
          throw new Error(
            "Usuario no encontrado",
          );
        }

        const user =
          removeSensitiveUserFields(
            data.user,
          );

        saveSafeUser(user);

        const newChat: Chat = {
          id: `dm-${[
            currentUser.id,
            user.id,
          ]
            .sort()
            .join("-")}`,

          type: "direct",

          name:
            user.originalName ||
            user.name ||
            user.id,

          avatar:
            user.avatar ||
            generateUserAvatarSvg(
              user.id,
            ),

          participants: [
            currentUser.id,
            user.id,
          ],

          messages: [],

          lastMessageTime:
            Date.now(),

          userId:
            currentUser.id,
        };

        setChats((prev) => {
          if (
            prev.some(
              (c) =>
                c.id ===
                newChat.id,
            )
          ) {
            return prev;
          }

          return [
            newChat,
            ...prev,
          ];
        });
      } catch (error) {
        console.error(
          "Add contact error:",
          error,
        );
      }
    })();

    return true;
  };

  // -------------------------------------------------------
  // Send message
  // -------------------------------------------------------

  const sendMessage = (
    chatId: string,
    text: string,
    type:
      | "text"
      | "image"
      | "audio"
      | "file"
      | "system" = "text",
    mediaUrl?: string,
    replyTo?: string,
    fileName?: string,
    fileSize?: number,
    mimeType?: string,
  ) => {
    if (!currentUser) return;

    const chat =
      chats.find(
        (c) => c.id === chatId,
      );

    if (!chat) return;

    const censoredText =
      type === "text"
        ? censorMessage(text)
        : text;

    const message: Message = {
      id: nanoid(),

      /*
       * This ID is used only for the optimistic UI.
       * The server determines the authenticated sender.
       */
      senderId:
        currentUser.id,

      text:
        censoredText,

      timestamp:
        Date.now(),

      type,

      status:
        "sent",

      read:
        false,

      ...(mediaUrl
        ? { mediaUrl }
        : {}),

      ...(replyTo
        ? { replyTo }
        : {}),

      ...(fileName
        ? { fileName }
        : {}),

      ...(fileSize !== undefined
        ? { fileSize }
        : {}),

      ...(mimeType
        ? { mimeType }
        : {}),
    };

    // -----------------------------------------------------
    // Optimistic UI
    // -----------------------------------------------------

    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) {
          return c;
        }

        const today =
          new Date()
            .toISOString()
            .split("T")[0];

        let streak =
          c.streak || 0;

        if (
          c.lastInteractionDay
        ) {
          const previous =
            new Date(
              c.lastInteractionDay,
            );

          const current =
            new Date(today);

          const difference =
            Math.floor(
              (
                current.getTime() -
                previous.getTime()
              ) /
                86400000,
            );

          if (difference > 1) {
            streak = 1;
          } else if (
            c.lastInteractionDay !==
            today
          ) {
            streak += 1;
          }
        } else {
          streak = 1;
        }

        return {
          ...c,

          messages: [
            ...c.messages,
            message,
          ],

          lastMessage:
            type === "text"
              ? censoredText
              : type === "image"
                ? "📷 Imagen"
                : type === "audio"
                  ? "🎤 Audio"
                  : "📎 Archivo",

          lastMessageTime:
            message.timestamp,

          streak,

          lastInteractionDay:
            today,
        };
      }),
    );

    // -----------------------------------------------------
    // MymsgAI
    // -----------------------------------------------------

    if (
      chat.participants.includes(
        "mymsgai",
      ) &&
      type === "text"
    ) {
      setTimeout(async () => {
        try {
          const {
            getMymsgAIResponse,
          } = await import(
            "./mymsgai"
          );

          const response =
            await getMymsgAIResponse(
              text,
            );

          const isImage =
            response.startsWith(
              "[IMAGE_URL:",
            );

          const aiMessage: Message =
            {
              id: nanoid(),

              senderId:
                "mymsgai",

              text:
                isImage
                  ? ""
                  : response,

              mediaUrl:
                isImage
                  ? response
                      .replace(
                        "[IMAGE_URL:",
                        "",
                      )
                      .replace(
                        "]",
                        "",
                      )
                  : undefined,

              timestamp:
                Date.now(),

              type:
                isImage
                  ? "image"
                  : "text",

              status:
                "read",

              read:
                true,
            };

          setChats((prev) =>
            prev.map((c) =>
              c.id === chatId
                ? {
                    ...c,

                    messages: [
                      ...c.messages,
                      aiMessage,
                    ],

                    lastMessage:
                      isImage
                        ? "Envió una imagen"
                        : response,

                    lastMessageTime:
                      aiMessage.timestamp,
                  }
                : c,
            ),
          );
        } catch (error) {
          console.error(
            "MymsgAI error:",
            error,
          );
        }
      }, 500);

      return;
    }

    // -----------------------------------------------------
    // Groups
    // -----------------------------------------------------

    if (
      chat.type === "group"
    ) {
      void (async () => {
        try {
          const response =
            await fetch(
              `/api/groups/${encodeURIComponent(
                chat.id,
              )}/messages`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                credentials:
                  "include",

                body: JSON.stringify({
                  text:
                    censoredText,

                  type,

                  mediaUrl,

                  replyTo,

                  fileName,

                  fileSize,

                  mimeType,
                }),
              },
            );

          await parseApiResponse(
            response,
          );
        } catch (error) {
          console.error(
            "Group message error:",
            error,
          );
        }
      })();

      return;
    }

    // -----------------------------------------------------
    // Direct messages
    // -----------------------------------------------------

    const recipientId =
      chat.participants.find(
        (id) =>
          id !==
          currentUser.id,
      );

    if (
      !recipientId ||
      recipientId === "mymsgai"
    ) {
      return;
    }

    void (async () => {
      try {
        const response =
          await fetch(
            "/api/messages",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials:
                "include",

              body: JSON.stringify({
                recipientId,

                text:
                  censoredText,

                type,

                mediaUrl,

                replyTo,

                fileName,

                fileSize,

                mimeType,
              }),
            },
          );

        await parseApiResponse(
          response,
        );
      } catch (error) {
        console.error(
          "Message send error:",
          error,
        );
      }
    })();
  };

  // -------------------------------------------------------
  // Group synchronization
  // -------------------------------------------------------

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;

    const syncGroups =
      async () => {
        const groupChats =
          chats.filter(
            (chat) =>
              chat.type ===
              "group",
          );

        for (const chat of groupChats) {
          if (cancelled) return;

          try {
            const response =
              await fetch(
                `/api/groups/${encodeURIComponent(
                  chat.id,
                )}`,
                {
                  method: "GET",
                  credentials:
                    "include",
                },
              );

            if (!response.ok) {
              continue;
            }

            const data =
              await response
                .json()
                .catch(() => null);

            if (
              !data?.group ||
              cancelled
            ) {
              continue;
            }

            const serverGroup =
              data.group as Chat;

            setChats((prev) =>
              prev.map((c) =>
                c.id ===
                serverGroup.id
                  ? {
                      ...c,
                      ...serverGroup,
                    }
                  : c,
              ),
            );
          } catch {
            // Temporary network errors are ignored.
          }
        }
      };

    void syncGroups();

    const interval =
      window.setInterval(
        syncGroups,
        5000,
      );

    return () => {
      cancelled = true;
      window.clearInterval(
        interval,
      );
    };
  }, [
    currentUser?.id,
    chats
      .filter(
        (c) =>
          c.type === "group",
      )
      .map((c) => c.id)
      .join(","),
  ]);

  // -------------------------------------------------------
  // Get chat
  // -------------------------------------------------------

  const getChat = (
    chatId: string,
  ) =>
    chats.find(
      (c) => c.id === chatId,
    );

  // -------------------------------------------------------
  // Get messages
  // -------------------------------------------------------

  const getChatMessages = (
    chatId: string,
  ): Message[] => {
    const chat =
      chats.find(
        (c) => c.id === chatId,
      );

    return chat?.messages || [];
  };

  // -------------------------------------------------------
  // Get all cached public users
  // -------------------------------------------------------

  const getAllUsers =
    (): Map<string, User> => {
      const users =
        new Map<string, User>();

      for (const key of Object.keys(
        localStorage,
      )) {
        if (
          !key.startsWith(
            "mymsg_user_",
          )
        ) {
          continue;
        }

        try {
          const parsed =
            JSON.parse(
              localStorage.getItem(
                key,
              ) || "",
            );

          if (!parsed?.id) {
            continue;
          }

          const safeUser =
            removeSensitiveUserFields(
              parsed,
            );

          users.set(
            safeUser.id,
            safeUser,
          );
        } catch {
          // Ignore invalid local cache.
        }
      }

      if (currentUser) {
        users.set(
          currentUser.id,
          removeSensitiveUserFields(
            currentUser,
          ),
        );
      }

      return users;
    };

  // -------------------------------------------------------
  // Update user
  // -------------------------------------------------------

  const updateUser = (
    updates: Partial<User>,
  ) => {
    if (!currentUser) return;

    const safeUpdates: Partial<User> =
      {};

    /*
     * Explicit allowlist.
     *
     * Never allow the client to modify:
     * - id
     * - password
     * - originalName
     * - banned
     * - punishedUntil
     * - googleLinked
     */

    if (
      typeof updates.name ===
      "string"
    ) {
      safeUpdates.name =
        updates.name
          .trim()
          .slice(0, 100);
    }

    if (
      typeof updates.avatar ===
      "string"
    ) {
      safeUpdates.avatar =
        updates.avatar;
    }

    if (
      updates.language ===
        "es" ||
      updates.language ===
        "en"
    ) {
      safeUpdates.language =
        updates.language;
    }

    if (
      typeof updates.youtubeUrl ===
      "string"
    ) {
      safeUpdates.youtubeUrl =
        updates.youtubeUrl
          .slice(0, 500);
    }

    if (
      Object.keys(
        safeUpdates,
      ).length === 0
    ) {
      return;
    }

    void (async () => {
      try {
        const response =
          await fetch(
            "/api/auth/me",
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials:
                "include",

              body: JSON.stringify(
                safeUpdates,
              ),
            },
          );

        const data =
          await parseApiResponse(
            response,
          );

        const serverUser =
          removeSensitiveUserFields(
            data.user ||
              {
                ...currentUser,
                ...safeUpdates,
              },
          );

        setCurrentUser(
          serverUser,
        );

        saveSafeUser(
          serverUser,
        );
      } catch (error) {
        console.error(
          "Update user error:",
          error,
        );
      }
    })();
  };

  // -------------------------------------------------------
  // Update group
  // -------------------------------------------------------

  const updateGroup = (
    groupId: string,
    updates: Partial<Chat>,
  ) => {
    if (!currentUser) return;

    /*
     * Only send fields that a normal group member
     * should be allowed to modify.
     */
    const safeUpdates:
      Partial<Chat> = {};

    if (
      typeof updates.name ===
      "string"
    ) {
      safeUpdates.name =
        updates.name
          .trim()
          .slice(0, 100);
    }

    if (
      typeof updates.avatar ===
      "string"
    ) {
      safeUpdates.avatar =
        updates.avatar;
    }

    if (
      typeof updates.wallpaper ===
      "string"
    ) {
      safeUpdates.wallpaper =
        updates.wallpaper;
    }

    if (
      Object.keys(
        safeUpdates,
      ).length === 0
    ) {
      return;
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === groupId
          ? {
              ...chat,
              ...safeUpdates,
            }
          : chat,
      ),
    );

    void (async () => {
      try {
        const response =
          await fetch(
            `/api/groups/${encodeURIComponent(
              groupId,
            )}`,
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials:
                "include",

              body: JSON.stringify(
                safeUpdates,
              ),
            },
          );

        await parseApiResponse(
          response,
        );
      } catch (error) {
        console.error(
          "Update group error:",
          error,
        );
      }
    })();
  };

  // -------------------------------------------------------
  // Admins
  // -------------------------------------------------------

  const addAdmin = (
    userId: string,
  ) => {
    if (!currentUser) return;

    const cleanId =
      userId.trim();

    if (
      !/^\d{8}$/.test(
        cleanId,
      )
    ) {
      return;
    }

    void (async () => {
      try {
        const response =
          await fetch(
            "/api/admins",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials:
                "include",

              body: JSON.stringify({
                userId:
                  cleanId,
              }),
            },
          );

        const data =
          await parseApiResponse(
            response,
          );

        if (
          Array.isArray(
            data?.admins,
          )
        ) {
          setAdmins(
            data.admins.map(
              (id: unknown) =>
                String(id),
            ),
          );
        } else {
          setAdmins((prev) =>
            prev.includes(
              cleanId,
            )
              ? prev
              : [
                  ...prev,
                  cleanId,
                ],
          );
        }
      } catch (error) {
        console.error(
          "Add admin error:",
          error,
        );
      }
    })();
  };

  const removeAdmin = (
    userId: string,
  ) => {
    if (!currentUser) return;

    const cleanId =
      userId.trim();

    if (
      !/^\d{8}$/.test(
        cleanId,
      )
    ) {
      return;
    }

    void (async () => {
      try {
        const response =
          await fetch(
            `/api/admins/${encodeURIComponent(
              cleanId,
            )}`,
            {
              method: "DELETE",

              credentials:
                "include",
            },
          );

        const data =
          await parseApiResponse(
            response,
          );

        if (
          Array.isArray(
            data?.admins,
          )
        ) {
          setAdmins(
            data.admins.map(
              (id: unknown) =>
                String(id),
            ),
          );
        } else {
          setAdmins((prev) =>
            prev.filter(
              (id) =>
                id !== cleanId,
            ),
          );
        }
      } catch (error) {
        console.error(
          "Remove admin error:",
          error,
        );
      }
    })();
  };

  // -------------------------------------------------------
  // Reports
  // -------------------------------------------------------

  const reportEntity = (
    type:
      | "Usuario"
      | "Grupo",
    targetId: string,
    targetName: string,
  ) => {
    if (!currentUser) return;

    const chat =
      chats.find(
        (c) =>
          c.id === targetId ||
          c.participants.includes(
            targetId,
          ),
      );

    const targetMessages =
      chat
        ? chat.messages.slice(
            -50,
          )
        : [];

    const report: Report =
      {
        id: nanoid(),

        type,

        targetId,

        targetName,

        reporterId:
          currentUser.id,

        timestamp:
          Date.now(),

        targetMessages,
      };

    setReports((prev) => [
      report,
      ...prev,
    ]);
  };

  const deleteReport = (
    reportId: string,
  ) => {
    setReports((prev) =>
      prev.filter(
        (report) =>
          report.id !==
          reportId,
      ),
    );
  };

  // -------------------------------------------------------
  // Wallpaper
  // -------------------------------------------------------

  const setChatWallpaper = (
    chatId: string,
    url: string,
  ) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              wallpaper: url,
            }
          : chat,
      ),
    );
  };

  // -------------------------------------------------------
  // Forget chat
  // -------------------------------------------------------

  const forgetChat = (
    chatId: string,
  ) => {
    setChats((prev) =>
      prev.filter(
        (chat) =>
          chat.id !== chatId,
      ),
    );
  };

  // -------------------------------------------------------
  // Clear messages locally
  // -------------------------------------------------------

  const clearChatMessages = (
    chatId: string,
  ) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [],
              lastMessage:
                undefined,
              lastMessageTime:
                undefined,
            }
          : chat,
      ),
    );
  };

  // -------------------------------------------------------
  // Delete message
  // -------------------------------------------------------

  const deleteMessage = (
    chatId: string,
    messageId: string,
    deleteForEveryone =
      false,
  ) => {
    if (!currentUser) return;

    const chat =
      chats.find(
        (c) => c.id === chatId,
      );

    if (!chat) return;

    const message =
      chat.messages.find(
        (m) => m.id === messageId,
      );

    if (!message) return;

    if (
      deleteForEveryone &&
      message.senderId !==
        currentUser.id
    ) {
      return;
    }

    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) {
          return c;
        }

        return {
          ...c,

          messages:
            c.messages.map(
              (m) => {
                if (
                  m.id !==
                  messageId
                ) {
                  return m;
                }

                if (
                  deleteForEveryone
                ) {
                  return {
                    ...m,

                    isDeletedForEveryone:
                      true,

                    text:
                      "Mensaje eliminado",

                    type:
                      "system",

                    mediaUrl:
                      undefined,
                  };
                }

                return {
                  ...m,

                  isDeletedForMe:
                    true,
                };
              },
            ),
        };
      }),
    );

    /*
     * Synchronize deletion with server.
     *
     * The server MUST verify that the authenticated
     * user owns the message before allowing
     * deleteForEveryone.
     */

    if (
      deleteForEveryone
    ) {
      void (async () => {
        try {
          const response =
            await fetch(
              `/api/messages/${encodeURIComponent(
                messageId,
              )}`,
              {
                method: "DELETE",

                credentials:
                  "include",
              },
            );

          if (!response.ok) {
            console.error(
              "Server rejected message deletion",
            );
          }
        } catch (error) {
          console.error(
            "Delete message error:",
            error,
          );
        }
      })();
    }
  };

  // -------------------------------------------------------
  // Mark chat read
  // -------------------------------------------------------

  const markChatAsRead = (
    chatId: string,
  ) => {
    if (!currentUser) return;

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,

              messages:
                chat.messages.map(
                  (message) =>
                    message.senderId !==
                    currentUser.id
                      ? {
                          ...message,
                          read: true,
                        }
                      : message,
                ),
            }
          : chat,
      ),
    );
  };

  // -------------------------------------------------------
  // Reply
  // -------------------------------------------------------

  const replyToMessage = (
    chatId: string,
    messageId: string,
    replyText: string,
  ) => {
    if (!currentUser) return;

    const chat =
      getChat(chatId);

    const original =
      chat?.messages.find(
        (message) =>
          message.id ===
          messageId,
      );

    if (!original) return;

    sendMessage(
      chatId,
      replyText,
      "text",
      undefined,
      messageId,
    );
  };

  // -------------------------------------------------------
  // Forward
  // -------------------------------------------------------

  const forwardMessage = (
    fromChatId: string,
    messageId: string,
    toChatId: string,
  ) => {
    if (!currentUser) return;

    const chat =
      getChat(fromChatId);

    const message =
      chat?.messages.find(
        (item) =>
          item.id === messageId,
      );

    if (!message) return;

    const prefix =
      "[Reenviado] ";

    const text =
      message.type === "text"
        ? `${prefix}${message.text}`
        : prefix;

    sendMessage(
      toChatId,
      text,
      message.type,
      message.mediaUrl,
      undefined,
      message.fileName,
      message.fileSize,
      message.mimeType,
    );
  };

  // -------------------------------------------------------
  // Context value
  // -------------------------------------------------------

  const value:
    StoreContextType = {
    currentUser,

    isOnline,

    login,

    verifyPassword,

    logout,

    chats,

    createGroup,

    joinGroup,

    addContact,

    sendMessage,

    getChat,

    updateUser,

    updateGroup,

    admins,

    addAdmin,

    removeAdmin,

    reports,

    reportEntity,

    setChatWallpaper,

    getChatMessages,

    getAllUsers,

    forgetChat,

    clearChatMessages,

    deleteMessage,

    deleteReport,

    markChatAsRead,

    replyToMessage,

    forwardMessage,
  };

  return (
    <StoreContext.Provider
      value={value}
    >
      {children}
    </StoreContext.Provider>
  );
}

// ---------------------------------------------------------
// Hook
// ---------------------------------------------------------

export function useStore() {
  const context =
    useContext(StoreContext);

  if (
    context === undefined
  ) {
    throw new Error(
      "useStore must be used within a StoreProvider",
    );
  }

  return context;
}