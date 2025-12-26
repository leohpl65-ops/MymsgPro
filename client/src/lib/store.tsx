import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { nanoid } from "nanoid";

// --- Types ---
export interface User {
  id: string;
  name: string;
  avatar?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  type: 'text' | 'image' | 'audio';
  mediaUrl?: string;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  name: string; // For groups, or the other user's name
  avatar?: string;
  participants: string[];
  messages: Message[];
  lastMessage?: string;
  lastMessageTime?: number;
  wallpaper?: string;
}

interface StoreContextType {
  currentUser: User | null;
  login: (name: string, id: string) => void;
  logout: () => void;
  chats: Chat[];
  createGroup: (name: string) => void;
  joinGroup: (groupId: string) => void;
  addContact: (contactId: string) => void;
  sendMessage: (chatId: string, text: string, type?: 'text' | 'image' | 'audio', mediaUrl?: string) => void;
  getChat: (chatId: string) => Chat | undefined;
  updateUser: (updates: Partial<User>) => void;
  updateGroup: (groupId: string, updates: Partial<Chat>) => void;
  reports: { type: string; targetId: string; reporterId: string; timestamp: number }[];
  reportEntity: (type: 'Usuario' | 'Grupo', targetId: string) => void;
  setChatWallpaper: (chatId: string, url: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// --- Mock Data ---
const MOCK_USERS: Record<string, User> = {
  "12345670": { id: "12345670", name: "Admin", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" },
  "1001": { id: "1001", name: "Alice", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice" },
  "1002": { id: "1002", name: "Bob", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob" },
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("mymsg_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [chats, setChats] = useState<Chat[]>([
    {
      id: "group-1",
      type: "group",
      name: "General Chat",
      avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=General",
      participants: ["12345670", "1001", "1002"],
      messages: [
        { id: "m1", senderId: "1001", text: "Hola a todos!", timestamp: Date.now() - 100000, type: "text" },
        { id: "m2", senderId: "1002", text: "Bienvenidos a MyMsg Pro", timestamp: Date.now() - 90000, type: "text" }
      ],
      lastMessage: "Bienvenidos a MyMsg Pro",
      lastMessageTime: Date.now() - 90000
    }
  ]);

  const [reports, setReports] = useState<{ type: string; targetId: string; reporterId: string; timestamp: number }[]>([]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("mymsg_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("mymsg_user");
    }
  }, [currentUser]);

  const login = (name: string, id: string) => {
    const user = { id, name, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}` };
    setCurrentUser(user);
    // In a real app, we'd fetch their chats here. 
    // For mock, we'll just ensure they are in the demo group if not already
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const createGroup = (name: string) => {
    if (!currentUser) return;
    const newGroup: Chat = {
      id: `group-${nanoid()}`,
      type: 'group',
      name,
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`,
      participants: [currentUser.id],
      messages: [],
      lastMessage: "Grupo creado",
      lastMessageTime: Date.now()
    };
    setChats(prev => [newGroup, ...prev]);
  };

  const joinGroup = (groupId: string) => {
    if (!currentUser) return;
    const group = chats.find(c => c.id === groupId);
    if (group && !group.participants.includes(currentUser.id)) {
       // Ideally we'd update the chat in the 'chats' array, but for this mock we just pretend success
       // and maybe add it if it wasn't visible (but here all chats are visible for demo simplicity or we filter)
       // Let's actually update it
       setChats(prev => prev.map(c => 
         c.id === groupId 
           ? { ...c, participants: [...c.participants, currentUser.id] } 
           : c
       ));
    }
  };

  const addContact = (contactId: string) => {
    if (!currentUser) return;
    // Check if chat already exists
    const existing = chats.find(c => c.type === 'direct' && c.participants.includes(contactId) && c.participants.includes(currentUser.id));
    if (existing) return;

    const contactName = MOCK_USERS[contactId]?.name || `User ${contactId}`;
    const newChat: Chat = {
      id: `dm-${[currentUser.id, contactId].sort().join('-')}`,
      type: 'direct',
      name: contactName,
      avatar: MOCK_USERS[contactId]?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contactId}`,
      participants: [currentUser.id, contactId],
      messages: [],
      lastMessageTime: Date.now()
    };
    setChats(prev => [newChat, ...prev]);
  };

  const sendMessage = (chatId: string, text: string, type: 'text' | 'image' | 'audio' = 'text', mediaUrl?: string) => {
    if (!currentUser) return;
    const newMessage: Message = {
      id: nanoid(),
      senderId: currentUser.id,
      text,
      timestamp: Date.now(),
      type,
      mediaUrl
    };

    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          messages: [...c.messages, newMessage],
          lastMessage: type === 'text' ? text : (type === 'image' ? '📷 Imagen' : '🎤 Audio'),
          lastMessageTime: newMessage.timestamp
        };
      }
      return c;
    }));
  };

  const getChat = (chatId: string) => chats.find(c => c.id === chatId);

  const updateUser = (updates: Partial<User>) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, ...updates });
  };

  const updateGroup = (groupId: string, updates: Partial<Chat>) => {
    setChats(prev => prev.map(c => c.id === groupId ? { ...c, ...updates } : c));
  };

  const reportEntity = (type: 'Usuario' | 'Grupo', targetId: string) => {
    if (!currentUser) return;
    setReports(prev => [...prev, {
      type,
      targetId,
      reporterId: currentUser.id,
      timestamp: Date.now()
    }]);
  };

  const setChatWallpaper = (chatId: string, url: string) => {
     setChats(prev => prev.map(c => c.id === chatId ? { ...c, wallpaper: url } : c));
  };

  return (
    <StoreContext.Provider value={{
      currentUser,
      login,
      logout,
      chats,
      createGroup,
      joinGroup,
      addContact,
      sendMessage,
      getChat,
      updateUser,
      updateGroup,
      reports,
      reportEntity,
      setChatWallpaper
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
}
