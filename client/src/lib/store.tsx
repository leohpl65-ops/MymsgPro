import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { nanoid } from "nanoid";
import { censorMessage } from "./censor";
import { generateUserAvatarSvg, generateGroupAvatarSvg } from "./avatars";

// --- Types ---
export interface User {
  id: string;
  name: string;
  avatar?: string;
  password: string;
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
  name: string;
  avatar?: string;
  participants: string[];
  messages: Message[];
  lastMessage?: string;
  lastMessageTime?: number;
  wallpaper?: string;
  userId?: string;
}

export interface Report {
  id: string;
  type: 'Usuario' | 'Grupo';
  targetId: string;
  targetName: string;
  reporterId: string;
  timestamp: number;
  targetMessages: Message[];
}

interface StoreContextType {
  currentUser: User | null;
  isOnline: boolean;
  login: (name: string, id: string, password: string) => void;
  verifyPassword: (id: string, password: string) => boolean;
  logout: () => void;
  chats: Chat[];
  createGroup: (name: string) => void;
  joinGroup: (groupId: string) => void;
  addContact: (contactId: string) => void;
  sendMessage: (chatId: string, text: string, type?: 'text' | 'image' | 'audio', mediaUrl?: string) => void;
  getChat: (chatId: string) => Chat | undefined;
  updateUser: (updates: Partial<User>) => void;
  updateGroup: (groupId: string, updates: Partial<Chat>) => void;
  reports: Report[];
  reportEntity: (type: 'Usuario' | 'Grupo', targetId: string, targetName: string) => void;
  setChatWallpaper: (chatId: string, url: string) => void;
  getChatMessages: (chatId: string) => Message[];
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("mymsg_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [chats, setChats] = useState<Chat[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  // Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load chats when user changes
  useEffect(() => {
    if (currentUser) {
      const saved = localStorage.getItem(`mymsg_chats_${currentUser.id}`);
      if (saved) {
        setChats(JSON.parse(saved));
      } else {
        setChats([]);
      }
      
      const savedReports = localStorage.getItem(`mymsg_reports_${currentUser.id}`);
      if (savedReports) {
        setReports(JSON.parse(savedReports));
      }
    }
  }, [currentUser]);

  // Save chats when they change
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`mymsg_chats_${currentUser.id}`, JSON.stringify(chats));
    }
  }, [chats, currentUser]);

  // Save reports when they change
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`mymsg_reports_${currentUser.id}`, JSON.stringify(reports));
    }
  }, [reports, currentUser]);

  // Save user
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("mymsg_user", JSON.stringify(currentUser));
      localStorage.setItem(`mymsg_user_${currentUser.id}`, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("mymsg_user");
    }
  }, [currentUser]);

  const login = (name: string, id: string, password: string) => {
    const user = { id, name, password, avatar: generateUserAvatarSvg(name) };
    setCurrentUser(user);
  };

  const verifyPassword = (id: string, password: string): boolean => {
    const savedUser = localStorage.getItem(`mymsg_user_${id}`);
    if (!savedUser) return true; // First login, accept any password
    try {
      const user = JSON.parse(savedUser);
      return user.password === password;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setChats([]);
  };

  const createGroup = (name: string) => {
    if (!currentUser) return;
    const newGroup: Chat = {
      id: `group-${nanoid()}`,
      type: 'group',
      name,
      avatar: generateGroupAvatarSvg(name),
      participants: [currentUser.id],
      messages: [],
      lastMessage: "Grupo creado",
      lastMessageTime: Date.now(),
      userId: currentUser.id
    };
    setChats(prev => [newGroup, ...prev]);
  };

  const joinGroup = (groupId: string) => {
    if (!currentUser) return;
    const group = chats.find(c => c.id === groupId);
    if (group && !group.participants.includes(currentUser.id)) {
      setChats(prev => prev.map(c => 
        c.id === groupId 
          ? { ...c, participants: [...c.participants, currentUser.id] } 
          : c
      ));
    }
  };

  const addContact = (contactId: string) => {
    if (!currentUser) return;
    const existing = chats.find(c => c.type === 'direct' && c.participants.includes(contactId) && c.participants.includes(currentUser.id));
    if (existing) return;

    const newChat: Chat = {
      id: `dm-${[currentUser.id, contactId].sort().join('-')}`,
      type: 'direct',
      name: `Usuario ${contactId}`,
      avatar: generateUserAvatarSvg(contactId),
      participants: [currentUser.id, contactId],
      messages: [],
      lastMessageTime: Date.now(),
      userId: currentUser.id
    };
    setChats(prev => [newChat, ...prev]);
  };

  const sendMessage = (chatId: string, text: string, type: 'text' | 'image' | 'audio' = 'text', mediaUrl?: string) => {
    if (!currentUser) return;
    
    // Censor bad words and drugs
    const censoredText = type === 'text' ? censorMessage(text) : text;
    
    const newMessage: Message = {
      id: nanoid(),
      senderId: currentUser.id,
      text: censoredText,
      timestamp: Date.now(),
      type,
      mediaUrl
    };

    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          messages: [...c.messages, newMessage],
          lastMessage: type === 'text' ? censoredText : (type === 'image' ? '📷 Imagen' : '🎤 Audio'),
          lastMessageTime: newMessage.timestamp
        };
      }
      return c;
    }));
  };

  const getChat = (chatId: string) => chats.find(c => c.id === chatId);
  
  const getChatMessages = (chatId: string): Message[] => {
    const chat = chats.find(c => c.id === chatId);
    return chat?.messages || [];
  };

  const updateUser = (updates: Partial<User>) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, ...updates });
  };

  const updateGroup = (groupId: string, updates: Partial<Chat>) => {
    setChats(prev => prev.map(c => c.id === groupId ? { ...c, ...updates } : c));
  };

  const reportEntity = (type: 'Usuario' | 'Grupo', targetId: string, targetName: string) => {
    if (!currentUser) return;
    
    // Get last 20 messages from the target chat/user
    let targetMessages: Message[] = [];
    if (type === 'Usuario') {
      const dmChatId = `dm-${[currentUser.id, targetId].sort().join('-')}`;
      const dmChat = chats.find(c => c.id === dmChatId);
      targetMessages = dmChat?.messages.slice(-20) || [];
    } else {
      const groupChat = chats.find(c => c.id === targetId);
      targetMessages = groupChat?.messages.slice(-20) || [];
    }
    
    setReports(prev => [...prev, {
      id: nanoid(),
      type,
      targetId,
      targetName,
      reporterId: currentUser.id,
      timestamp: Date.now(),
      targetMessages
    }]);
  };

  const setChatWallpaper = (chatId: string, url: string) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, wallpaper: url } : c));
  };

  return (
    <StoreContext.Provider value={{
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
      reports,
      reportEntity,
      setChatWallpaper,
      getChatMessages
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
