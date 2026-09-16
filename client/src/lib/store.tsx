import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "wouter";
import { nanoid } from "nanoid";

import { censorMessage } from "@/lib/censor";
import { avatars } from "@/lib/avatars";

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "sticker"
  | "gif";

export interface User {
  id: string;
  name: string;
  originalName?: string;
  avatar?: string;
  language?: string;
  banned?: boolean;
  punishedUntil?: number | null;
  youtubeUrl?: string;
  status?: string;

  // Kept only for compatibility with existing UI/types.
  // These values must never be populated by the server.
  password?: string;
  googleLinked?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId?: string;
  text: string;
  timestamp: number;
  type?: MessageType;
  mediaUrl?: string;
  replyTo?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  deleted?: boolean;
  groupId?: string;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  avatar?: string;
  wallpaper?: string;
  members: string[];
  createdAt?: number;
  messages?: Message[];
}

export interface Report {
  id: string;
  reporterId: string;
  targetId: string;
  reason: string;
  timestamp: number;
  status?: string;
}

interface StoreContextType {
  currentUser: User | null;
  users: User[];
  groups: Group[];
  admins: string[];
  reports: Report[];
  chats: Record<string, Message[]>;
  chatWallpapers: Record<string, string>;

  login: (
    name: string,
    id: string,
    password: string
  ) => Promise<User | null>;

  register: (
    name: string,
    password: string
  ) => Promise<User | null>;

  logout: () => Promise<void>;

  verifyPassword: (password: string) => Promise<boolean>;

  updateUser: (updates: Partial<User>) => Promise<boolean>;

  addContact: (
    contactId: string,
    contactName?: string
  ) => Promise<User | null>;

  getAllUsers: () => User[];

  sendMessage: (
    recipientId: string,
    text: string,
    type?: MessageType,
    mediaUrl?: string,
    replyTo?: string,
    fileName?: string,
    fileSize?: number,
    mimeType?: string
  ) => Promise<Message | null>;

  deleteMessage: (
    chatId: string,
    messageId: string,
    deleteForEveryone?: boolean
  ) => Promise<boolean>;

  markChatAsRead: (chatId: string) => void;

  replyToMessage: (
    chatId: string,
    message: Message,
    text: string
  ) => Promise<Message | null>;

  forwardMessage: (
    message: Message,
    recipientId: string
  ) => Promise<Message | null>;

  createGroup: (name: string) => Promise<Group | null>;

  joinGroup: (groupId: string) => Promise<Group | null>;

  updateGroup: (
    groupId: string,
    updates: Partial<Group>
  ) => Promise<boolean>;

  addAdmin: (userId: string) => Promise<boolean>;
  removeAdmin: (userId: string) => Promise<boolean>;

  banUser: (userId: string) => Promise<boolean>;
  unbanUser: (userId: string) => Promise<boolean>;

  setChatWallpaper: (chatId: string, wallpaper: string) => void;

  addReport: (
    targetId: string,
    reason: string
  ) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const USER_STORAGE_KEY = "mymsg_user";
const CHAT_STORAGE_PREFIX = "mymsg_chat_";
const GROUP_STORAGE_KEY = "mymsg_groups";
const REPORT_STORAGE_KEY = "mymsg_reports";
const WALLPAPER_STORAGE_KEY = "mymsg_wallpapers";
const USERS_CACHE_PREFIX = "mymsg_user_";

const API = "/api";

function removeSensitiveUserFields(user: User | null): User | null {
  if (!user) return null;

  const {
    password: _password,
    googleLinked: _googleLinked,
    ...safeUser
  } = user;

  return safeUser;
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  let data: any = null;

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await response.text();
      data = text ? { error: text } : null;
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data as T;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  if (
    options.body &&
    !headers.has("Content-Type") &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  return parseApiResponse<T>(response);
}

function saveUser(user: User | null) {
  if (!user) {
    localStorage.removeItem(USER_STORAGE_KEY);
    return;
  }

  const safeUser = removeSensitiveUserFields(user);

  if (safeUser) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(safeUser));
    localStorage.setItem(
      `${USERS_CACHE_PREFIX}${safeUser.id}`,
      JSON.stringify(safeUser)
    );
  }
}

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;

    return removeSensitiveUserFields(JSON.parse(raw));
  } catch {
    return null;
  }
}

function loadChat(chatId: string): Message[] {
  try {
    const raw = localStorage.getItem(
      `${CHAT_STORAGE_PREFIX}${chatId}`
    );

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveChat(chatId: string, messages: Message[]) {
  localStorage.setItem(
    `${CHAT_STORAGE_PREFIX}${chatId}`,
    JSON.stringify(messages)
  );
}

function loadGroups(): Group[] {
  try {
    const raw = localStorage.getItem(GROUP_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGroups(groups: Group[]) {
  localStorage.setItem(
    GROUP_STORAGE_KEY,
    JSON.stringify(groups)
  );
}

function loadReports(): Report[] {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReports(reports: Report[]) {
  localStorage.setItem(
    REPORT_STORAGE_KEY,
    JSON.stringify(reports)
  );
}

function loadWallpapers(): Record<string, string> {
  try {
    const raw = localStorage.getItem(WALLPAPER_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function saveWallpapers(wallpapers: Record<string, string>) {
  localStorage.setItem(
    WALLPAPER_STORAGE_KEY,
    JSON.stringify(wallpapers)
  );
}

function normalizeMessage(
  message: any,
  fallbackId?: string
): Message {
  return {
    id: String(message?.id ?? fallbackId ?? nanoid()),
    senderId: String(message?.senderId ?? ""),
    recipientId:
      message?.recipientId !== undefined
        ? String(message.recipientId)
        : undefined,
    text: String(message?.text ?? ""),
    timestamp:
      typeof message?.timestamp === "number"
        ? message.timestamp
        : Date.now(),
    type: message?.type || "text",
    mediaUrl: message?.mediaUrl,
    replyTo: message?.replyTo,
    fileName: message?.fileName,
    fileSize: message?.fileSize,
    mimeType: message?.mimeType,
    deleted: Boolean(message?.deleted),
    groupId: message?.groupId,
  };
}

function normalizeUser(user: any): User {
  return removeSensitiveUserFields({
    id: String(user?.id ?? ""),
    name: String(user?.name ?? ""),
    originalName:
      user?.originalName ??
      user?.originalname ??
      undefined,
    avatar: user?.avatar,
    language: user?.language,
    banned: Boolean(user?.banned),
    punishedUntil: user?.punishedUntil ?? null,
    youtubeUrl: user?.youtubeUrl,
    status: user?.status,
  }) as User;
}

function normalizeGroup(group: any): Group {
  return {
    id: String(group?.id ?? ""),
    name: String(group?.name ?? ""),
    ownerId: String(group?.ownerId ?? ""),
    avatar: group?.avatar,
    wallpaper: group?.wallpaper,
    members: Array.isArray(group?.members)
      ? group.members.map(String)
      : [],
    createdAt: group?.createdAt,
    messages: Array.isArray(group?.messages)
      ? group.messages.map((m: any) =>
          normalizeMessage(m)
        )
      : [],
  };
}

export function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [, setLocation] = useLocation();

  const [currentUser, setCurrentUser] =
    useState<User | null>(() => loadStoredUser());

  const [users, setUsers] = useState<User[]>([]);

  const [groups, setGroups] = useState<Group[]>(
    () => loadGroups()
  );

  const [admins, setAdmins] = useState<string[]>([]);

  const [reports, setReports] = useState<Report[]>(
    () => loadReports()
  );

  const [chats, setChats] = useState<Record<string, Message[]>>(
    {}
  );

  const [chatWallpapers, setChatWallpapers] =
    useState<Record<string, string>>(
      () => loadWallpapers()
    );

  /*
   * Restore cached chats for the current user.
   */
  useEffect(() => {
    if (!currentUser) {
      setChats({});
      return;
    }

    const restored: Record<string, Message[]> = {};

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (!key?.startsWith(CHAT_STORAGE_PREFIX)) {
          continue;
        }

        const chatId = key.slice(CHAT_STORAGE_PREFIX.length);

        restored[chatId] = loadChat(chatId);
      }
    } catch {
      // Ignore malformed local storage.
    }

    setChats(restored);
  }, [currentUser?.id]);

  /*
   * Validate the local session against the server.
   */
  useEffect(() => {
    let cancelled = false;

    async function validateSession() {
      try {
        const result = await apiFetch<{
          authenticated: boolean;
          user?: User;
        }>("/auth/me");

        if (cancelled) return;

        if (!result.authenticated || !result.user) {
          setCurrentUser(null);
          localStorage.removeItem(USER_STORAGE_KEY);
          return;
        }

        const safeUser = normalizeUser(result.user);

        setCurrentUser(safeUser);
        saveUser(safeUser);
      } catch {
        if (cancelled) return;

        /*
         * Do not immediately erase cached state for transient
         * network errors. The server session may still be valid.
         */
      }
    }

    validateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Keep admins synchronized with the server.
   */
  useEffect(() => {
    if (!currentUser) {
      setAdmins([]);
      return;
    }

    let cancelled = false;

    async function loadAdmins() {
      try {
        const result = await apiFetch<{
          admins?: string[];
        }>("/admins");

        if (cancelled) return;

        setAdmins(
          Array.isArray(result.admins)
            ? result.admins.map(String)
            : []
        );
      } catch {
        if (!cancelled) {
          setAdmins([]);
        }
      }
    }

    loadAdmins();

    const interval = window.setInterval(
      loadAdmins,
      30_000
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [currentUser?.id]);

  /*
   * Direct-message inbox.
   *
   * This replaces the old Firebase offline_messages listener.
   * The server returns only messages belonging to the
   * authenticated user.
   */
  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    let loading = false;

    async function pollInbox() {
      if (cancelled || loading) return;

      loading = true;

      try {
        const result = await apiFetch<{
          messages?: any[];
        }>("/messages/inbox");

        if (cancelled) return;

        const incoming = Array.isArray(result.messages)
          ? result.messages
          : [];

        if (!incoming.length) return;

        const acknowledgements: string[] = [];

        setChats((previous) => {
          const next = { ...previous };

          for (const rawMessage of incoming) {
            const message = normalizeMessage(rawMessage);

            if (!message.senderId) continue;

            const chatId =
              message.senderId === currentUser.id
                ? message.recipientId
                : message.senderId;

            if (!chatId) continue;

            const existing = next[chatId] || [];

            const alreadyExists = existing.some(
              (item) => item.id === message.id
            );

            if (!alreadyExists) {
              next[chatId] = [
                ...existing,
                message,
              ].sort(
                (a, b) => a.timestamp - b.timestamp
              );
            }

            acknowledgements.push(message.id);
          }

          return next;
        });

        /*
         * ACK only after the messages were processed locally.
         */
        for (const messageId of acknowledgements) {
          try {
            await apiFetch(
              "/messages/inbox/ack",
              {
                method: "POST",
                body: JSON.stringify({
                  messageId,
                }),
              }
            );
          } catch {
            /*
             * If ACK fails, the message can be delivered again
             * on a later poll. The client deduplicates by ID.
             */
          }
        }
      } catch {
        // Network/server errors are ignored until the next poll.
      } finally {
        loading = false;
      }
    }

    pollInbox();

    const interval = window.setInterval(
      pollInbox,
      3_000
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [currentUser?.id]);

  /*
   * Synchronize groups periodically.
   */
  useEffect(() => {
    if (!currentUser || groups.length === 0) {
      return;
    }

    let cancelled = false;

    async function syncGroups() {
      for (const group of groups) {
        if (cancelled) return;

        try {
          const result = await apiFetch<any>(
            `/groups/${encodeURIComponent(group.id)}`
          );

          if (cancelled) return;

          const serverGroup = normalizeGroup(
            result.group || result
          );

          setGroups((previous) =>
            previous.map((item) =>
              item.id === serverGroup.id
                ? {
                    ...item,
                    ...serverGroup,
                  }
                : item
            )
          );

          if (serverGroup.messages) {
            setChats((previous) => ({
              ...previous,
              [serverGroup.id]:
                serverGroup.messages || [],
            }));
          }
        } catch {
          // Keep cached group data.
        }
      }
    }

    syncGroups();

    const interval = window.setInterval(
      syncGroups,
      5_000
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    currentUser?.id,
    groups.map((group) => group.id).join(","),
  ]);

  /*
   * Save chats whenever they change.
   */
  useEffect(() => {
    if (!currentUser) return;

    for (const [chatId, messages] of Object.entries(chats)) {
      saveChat(chatId, messages);
    }
  }, [chats, currentUser?.id]);

  useEffect(() => {
    saveGroups(groups);
  }, [groups]);

  useEffect(() => {
    saveReports(reports);
  }, [reports]);

  useEffect(() => {
    saveWallpapers(chatWallpapers);
  }, [chatWallpapers]);

  const login = async (
    name: string,
    _id: string,
    password: string
  ): Promise<User | null> => {
    try {
      /*
       * The ID supplied by the client is intentionally ignored.
       * Authentication is determined by the server.
       */
      const result = await apiFetch<{
        user: User;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          name,
          password,
        }),
      });

      if (!result.user) {
        return null;
      }

      const user = normalizeUser(result.user);

      setCurrentUser(user);
      saveUser(user);

      return user;
    } catch (error) {
      console.error("Login failed:", error);
      return null;
    }
  };

  const register = async (
    name: string,
    password: string
  ): Promise<User | null> => {
    try {
      const result = await apiFetch<{
        user: User;
      }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          password,
        }),
      });

      if (!result.user) {
        return null;
      }

      const user = normalizeUser(result.user);

      setCurrentUser(user);
      saveUser(user);

      return user;
    } catch (error) {
      console.error("Registration failed:", error);
      return null;
    }
  };

  const logout = async () => {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
      });
    } catch {
      // Session may already be expired.
    }

    setCurrentUser(null);
    setUsers([]);
    setAdmins([]);
    setChats({});

    localStorage.removeItem(USER_STORAGE_KEY);

    /*
     * Keep cached chats/groups so a later login can restore
     * the UI without deleting local history.
     */
    setLocation("/");
  };

  const verifyPassword = async (
    password: string
  ): Promise<boolean> => {
    if (!currentUser || !password) {
      return false;
    }

    try {
      await apiFetch("/auth/verify-password", {
        method: "POST",
        body: JSON.stringify({
          password,
        }),
      });

      return true;
    } catch {
      return false;
    }
  };

  const updateUser = async (
    updates: Partial<User>
  ): Promise<boolean> => {
    if (!currentUser) return false;

    /*
     * Explicit allowlist.
     * Never send password, ID, banned, googleLinked, etc.
     */
    const safeUpdates: Partial<User> = {};

    if (updates.name !== undefined) {
      safeUpdates.name = updates.name;
    }

    if (updates.avatar !== undefined) {
      safeUpdates.avatar = updates.avatar;
    }

    if (updates.language !== undefined) {
      safeUpdates.language = updates.language;
    }

    if (updates.youtubeUrl !== undefined) {
      safeUpdates.youtubeUrl = updates.youtubeUrl;
    }

    try {
      const result = await apiFetch<{
        user: User;
      }>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(safeUpdates),
      });

      const updatedUser = normalizeUser(
        result.user || {
          ...currentUser,
          ...safeUpdates,
        }
      );

      setCurrentUser(updatedUser);
      saveUser(updatedUser);

      return true;
    } catch (error) {
      console.error("Profile update failed:", error);
      return false;
    }
  };

  const addContact = async (
    contactId: string,
    _contactName?: string
  ): Promise<User | null> => {
    if (!currentUser) return null;

    /*
     * MymsgAI remains a local special contact.
     */
    if (
      contactId === "mymsgai" ||
      contactId === "00000000"
    ) {
      const aiUser: User = {
        id: "mymsgai",
        name: "MymsgAI",
        originalName: "MymsgAI",
        avatar:
          avatars?.[0] ||
          "",
        language: "es",
        status: "online",
      };

      setUsers((previous) => {
        if (
          previous.some(
            (user) => user.id === aiUser.id
          )
        ) {
          return previous;
        }

        return [...previous, aiUser];
      });

      return aiUser;
    }

    if (!/^\d{8}$/.test(contactId)) {
      return null;
    }

    try {
      /*
       * The server decides the actual user information.
       * Never trust contactName supplied by the client.
       */
      const result = await apiFetch<{
        user: User;
      }>(
        `/users/${encodeURIComponent(contactId)}`
      );

      if (!result.user) {
        return null;
      }

      const user = normalizeUser(result.user);

      setUsers((previous) => {
        const existing = previous.find(
          (item) => item.id === user.id
        );

        if (existing) {
          return previous.map((item) =>
            item.id === user.id
              ? user
              : item
          );
        }

        return [...previous, user];
      });

      saveUser(user);

      return user;
    } catch (error) {
      console.error("Add contact failed:", error);
      return null;
    }
  };

  const getAllUsers = (): User[] => {
    const result: User[] = [];
    const seen = new Set<string>();

    const add = (user: User) => {
      if (!user.id || seen.has(user.id)) {
        return;
      }

      seen.add(user.id);
      result.push(user);
    };

    for (const user of users) {
      add(user);
    }

    /*
     * Recover only the safe cached user representation.
     */
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (!key?.startsWith(USERS_CACHE_PREFIX)) {
          continue;
        }

        const raw = localStorage.getItem(key);

        if (!raw) continue;

        try {
          const parsed = normalizeUser(
            JSON.parse(raw)
          );

          add(parsed);
        } catch {
          // Ignore malformed cache entries.
        }
      }
    } catch {
      // Ignore localStorage errors.
    }

    return result;
  };

  const sendMessage = async (
    recipientId: string,
    text: string,
    type: MessageType = "text",
    mediaUrl?: string,
    replyTo?: string,
    fileName?: string,
    fileSize?: number,
    mimeType?: string
  ): Promise<Message | null> => {
    if (!currentUser) return null;

    const trimmedText = text ?? "";

    /*
     * MymsgAI is intentionally local.
     */
    if (
      recipientId === "mymsgai" ||
      recipientId === "00000000"
    ) {
      const message: Message = {
        id: nanoid(),
        senderId: currentUser.id,
        recipientId: "mymsgai",
        text: censorMessage(trimmedText),
        timestamp: Date.now(),
        type,
        mediaUrl,
        replyTo,
        fileName,
        fileSize,
        mimeType,
      };

      setChats((previous) => {
        const existing =
          previous[recipientId] || [];

        return {
          ...previous,
          [recipientId]: [
            ...existing,
            message,
          ],
        };
      });

      return message;
    }

    /*
     * Group message.
     */
    const group = groups.find(
      (item) => item.id === recipientId
    );

    if (group) {
      const optimisticMessage: Message = {
        id: nanoid(),
        senderId: currentUser.id,
        text: trimmedText,
        timestamp: Date.now(),
        type,
        mediaUrl,
        replyTo,
        fileName,
        fileSize,
        mimeType,
        groupId: group.id,
      };

      setChats((previous) => ({
        ...previous,
        [group.id]: [
          ...(previous[group.id] || []),
          optimisticMessage,
        ],
      }));

      try {
        const result = await apiFetch<{
          message?: any;
          group?: any;
        }>(
          `/groups/${encodeURIComponent(group.id)}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              text: trimmedText,
              type,
              mediaUrl,
              replyTo,
              fileName,
              fileSize,
              mimeType,
              clientMessageId:
                optimisticMessage.id,
            }),
          }
        );

        if (result.message) {
          const serverMessage =
            normalizeMessage(result.message);

          setChats((previous) => ({
            ...previous,
            [group.id]: (
              previous[group.id] || []
            ).map((item) =>
              item.id === optimisticMessage.id
                ? serverMessage
                : item
            ),
          }));

          return serverMessage;
        }

        return optimisticMessage;
      } catch (error) {
        /*
         * Remove the optimistic message if the server rejected it.
         */
        setChats((previous) => ({
          ...previous,
          [group.id]: (
            previous[group.id] || []
          ).filter(
            (item) =>
              item.id !== optimisticMessage.id
          ),
        }));

        console.error(
          "Group message failed:",
          error
        );

        return null;
      }
    }

    /*
     * Direct message.
     */
    const optimisticMessage: Message = {
      id: nanoid(),
      senderId: currentUser.id,
      recipientId,
      text: trimmedText,
      timestamp: Date.now(),
      type,
      mediaUrl,
      replyTo,
      fileName,
      fileSize,
      mimeType,
    };

    setChats((previous) => ({
      ...previous,
      [recipientId]: [
        ...(previous[recipientId] || []),
        optimisticMessage,
      ],
    }));

    try {
      const result = await apiFetch<{
        message: any;
      }>("/messages", {
        method: "POST",
        body: JSON.stringify({
          recipientId,
          text: trimmedText,
          type,
          mediaUrl,
          replyTo,
          fileName,
          fileSize,
          mimeType,
          clientMessageId:
            optimisticMessage.id,
        }),
      });

      if (result.message) {
        const serverMessage =
          normalizeMessage(result.message);

        setChats((previous) => ({
          ...previous,
          [recipientId]: (
            previous[recipientId] || []
          ).map((item) =>
            item.id === optimisticMessage.id
              ? serverMessage
              : item
          ),
        }));

        return serverMessage;
      }

      return optimisticMessage;
    } catch (error) {
      /*
       * Do not leave a fake sent message in the UI
       * if the server rejected it.
       */
      setChats((previous) => ({
        ...previous,
        [recipientId]: (
          previous[recipientId] || []
        ).filter(
          (item) =>
            item.id !== optimisticMessage.id
        ),
      }));

      console.error(
        "Direct message failed:",
        error
      );

      return null;
    }
  };

  const deleteMessage = async (
    chatId: string,
    messageId: string,
    deleteForEveryone = false
  ): Promise<boolean> => {
    const currentMessages =
      chats[chatId] || [];

    const target = currentMessages.find(
      (message) => message.id === messageId
    );

    if (!target) {
      return false;
    }

    if (!deleteForEveryone) {
      setChats((previous) => ({
        ...previous,
        [chatId]: (
          previous[chatId] || []
        ).filter(
          (message) =>
            message.id !== messageId
        ),
      }));

      return true;
    }

    try {
      await apiFetch(
        `/messages/${encodeURIComponent(messageId)}`,
        {
          method: "DELETE",
        }
      );

      /*
       * Keep a local tombstone rather than removing the
       * message entirely so the UI can show "deleted".
       */
      setChats((previous) => ({
        ...previous,
        [chatId]: (
          previous[chatId] || []
        ).map((message) =>
          message.id === messageId
            ? {
                ...message,
                text: "",
                mediaUrl: undefined,
                fileName: undefined,
                fileSize: undefined,
                mimeType: undefined,
                deleted: true,
              }
            : message
        ),
      }));

      return true;
    } catch (error) {
      console.error(
        "Delete message failed:",
        error
      );

      return false;
    }
  };

  const markChatAsRead = (chatId: string) => {
    /*
     * Read state is intentionally local for now.
     * It does not grant any server-side permissions.
     */
    setChats((previous) => ({
      ...previous,
      [chatId]: previous[chatId] || [],
    }));
  };

  const replyToMessage = async (
    chatId: string,
    message: Message,
    text: string
  ): Promise<Message | null> => {
    return sendMessage(
      chatId,
      text,
      "text",
      undefined,
      message.id
    );
  };

  const forwardMessage = async (
    message: Message,
    recipientId: string
  ): Promise<Message | null> => {
    return sendMessage(
      recipientId,
      message.text,
      message.type || "text",
      message.mediaUrl,
      undefined,
      message.fileName,
      message.fileSize,
      message.mimeType
    );
  };

  const createGroup = async (
    name: string
  ): Promise<Group | null> => {
    if (!currentUser || !name.trim()) {
      return null;
    }

    try {
      const result = await apiFetch<{
        group: any;
      }>("/groups", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      if (!result.group) {
        return null;
      }

      const group = normalizeGroup(
        result.group
      );

      setGroups((previous) => [
        ...previous.filter(
          (item) => item.id !== group.id
        ),
        group,
      ]);

      return group;
    } catch (error) {
      console.error(
        "Create group failed:",
        error
      );

      return null;
    }
  };

  const joinGroup = async (
    groupId: string
  ): Promise<Group | null> => {
    if (!currentUser) return null;

    try {
      const result = await apiFetch<{
        group: any;
      }>(
        `/groups/${encodeURIComponent(groupId)}/join`,
        {
          method: "POST",
        }
      );

      if (!result.group) {
        return null;
      }

      const group = normalizeGroup(
        result.group
      );

      setGroups((previous) => [
        ...previous.filter(
          (item) => item.id !== group.id
        ),
        group,
      ]);

      return group;
    } catch (error) {
      console.error(
        "Join group failed:",
        error
      );

      return null;
    }
  };

  const updateGroup = async (
    groupId: string,
    updates: Partial<Group>
  ): Promise<boolean> => {
    if (!currentUser) return false;

    const safeUpdates: Partial<Group> = {};

    if (updates.name !== undefined) {
      safeUpdates.name = updates.name;
    }

    if (updates.avatar !== undefined) {
      safeUpdates.avatar = updates.avatar;
    }

    if (updates.wallpaper !== undefined) {
      safeUpdates.wallpaper =
        updates.wallpaper;
    }

    try {
      const result = await apiFetch<{
        group: any;
      }>(
        `/groups/${encodeURIComponent(groupId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(safeUpdates),
        }
      );

      const updatedGroup = normalizeGroup(
        result.group || {
          ...(groups.find(
            (group) => group.id === groupId
          ) || {
            id: groupId,
          }),
          ...safeUpdates,
        }
      );

      setGroups((previous) =>
        previous.map((group) =>
          group.id === groupId
            ? {
                ...group,
                ...updatedGroup,
              }
            : group
        )
      );

      return true;
    } catch (error) {
      console.error(
        "Update group failed:",
        error
      );

      return false;
    }
  };

  const addAdmin = async (
    userId: string
  ): Promise<boolean> => {
    if (!currentUser) return false;

    try {
      await apiFetch("/admins", {
        method: "POST",
        body: JSON.stringify({
          userId,
        }),
      });

      setAdmins((previous) =>
        previous.includes(userId)
          ? previous
          : [...previous, userId]
      );

      return true;
    } catch (error) {
      console.error(
        "Add admin failed:",
        error
      );

      return false;
    }
  };

  const removeAdmin = async (
    userId: string
  ): Promise<boolean> => {
    if (!currentUser) return false;

    try {
      await apiFetch(
        `/admins/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
        }
      );

      setAdmins((previous) =>
        previous.filter(
          (id) => id !== userId
        )
      );

      return true;
    } catch (error) {
      console.error(
        "Remove admin failed:",
        error
      );

      return false;
    }
  };

  const banUser = async (
    userId: string
  ): Promise<boolean> => {
    if (!currentUser) return false;

    try {
      await apiFetch(
        `/admin/users/${encodeURIComponent(userId)}/ban`,
        {
          method: "POST",
        }
      );

      setUsers((previous) =>
        previous.map((user) =>
          user.id === userId
            ? {
                ...user,
                banned: true,
              }
            : user
        )
      );

      return true;
    } catch (error) {
      console.error(
        "Ban user failed:",
        error
      );

      return false;
    }
  };

  const unbanUser = async (
    userId: string
  ): Promise<boolean> => {
    if (!currentUser) return false;

    try {
      await apiFetch(
        `/admin/users/${encodeURIComponent(userId)}/unban`,
        {
          method: "POST",
        }
      );

      setUsers((previous) =>
        previous.map((user) =>
          user.id === userId
            ? {
                ...user,
                banned: false,
              }
            : user
        )
      );

      return true;
    } catch (error) {
      console.error(
        "Unban user failed:",
        error
      );

      return false;
    }
  };

  const setChatWallpaper = (
    chatId: string,
    wallpaper: string
  ) => {
    setChatWallpapers((previous) => ({
      ...previous,
      [chatId]: wallpaper,
    }));
  };

  const addReport = (
    targetId: string,
    reason: string
  ) => {
    if (!currentUser) return;

    const report: Report = {
      id: nanoid(),
      reporterId: currentUser.id,
      targetId,
      reason,
      timestamp: Date.now(),
      status: "pending",
    };

    setReports((previous) => [
      ...previous,
      report,
    ]);
  };

  const contextValue = useMemo<StoreContextType>(
    () => ({
      currentUser,
      users,
      groups,
      admins,
      reports,
      chats,
      chatWallpapers,

      login,
      register,
      logout,
      verifyPassword,
      updateUser,
      addContact,
      getAllUsers,
      sendMessage,
      deleteMessage,
      markChatAsRead,
      replyToMessage,
      forwardMessage,
      createGroup,
      joinGroup,
      updateGroup,
      addAdmin,
      removeAdmin,
      banUser,
      unbanUser,
      setChatWallpaper,
      addReport,
    }),
    [
      currentUser,
      users,
      groups,
      admins,
      reports,
      chats,
      chatWallpapers,
    ]
  );

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error(
      "useStore must be used inside StoreProvider"
    );
  }

  return context;
}

export default StoreContext;