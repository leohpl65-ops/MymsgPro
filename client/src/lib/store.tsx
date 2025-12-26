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
}

interface StoreContextType {
  currentUser: User | null;
  isOnline: boolean;
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
  reports: Report[];
  reportEntity: (type: 'Usuario' | 'Grupo', targetId: string, targetName: string) => void;
  setChatWallpaper: (chatId: string, url: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// --- Default Avatar Generator ---
const getDefaultAvatar = (seed: string) => {
  // Simple user icon placeholder with initials
  const colors = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = colors[hash % colors.length];
  const initials = seed.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='${encodeURIComponent(color)}' width='100' height='100'/%3E%3Ctext x='50' y='50' font-size='40' fill='white' text-anchor='middle' dy='.3em' font-family='Arial'%3E${initials}%3C/text%3E%3C/svg%3E`;
};

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
        // First time login - start with empty
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
    } else {
      localStorage.removeItem("mymsg_user");
    }
  }, [currentUser]);

  const login = (name: string, id: string) => {
    const user = { id, name, avatar: getDefaultAvatar(name) };
    setCurrentUser(user);
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
      avatar: getDefaultAvatar(name),
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
      avatar: getDefaultAvatar(contactId),
      participants: [currentUser.id, contactId],
      messages: [],
      lastMessageTime: Date.now(),
      userId: currentUser.id
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

  const reportEntity = (type: 'Usuario' | 'Grupo', targetId: string, targetName: string) => {
    if (!currentUser) return;
    setReports(prev => [...prev, {
      id: nanoid(),
      type,
      targetId,
      targetName,
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
      isOnline,
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
