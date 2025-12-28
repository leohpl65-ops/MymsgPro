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
  addContact: (contactId: string, contactName: string) => boolean;
  sendMessage: (chatId: string, text: string, type?: 'text' | 'image' | 'audio', mediaUrl?: string) => void;
  getChat: (chatId: string) => Chat | undefined;
  updateUser: (updates: Partial<User>) => void;
  updateGroup: (groupId: string, updates: Partial<Chat>) => void;
  reports: Report[];
  reportEntity: (type: 'Usuario' | 'Grupo', targetId: string, targetName: string) => void;
  setChatWallpaper: (chatId: string, url: string) => void;
  getChatMessages: (chatId: string) => Message[];
  getAllUsers: () => Map<string, User>;
  forgetChat: (chatId: string) => void;
  clearChatMessages: (chatId: string) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  replyToMessage: (chatId: string, messageId: string, replyText: string) => void;
  forwardMessage: (fromChatId: string, messageId: string, toChatId: string) => void;
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
      const isFirstLogin = !localStorage.getItem(`mymsg_chats_${currentUser.id}`);
      const saved = localStorage.getItem(`mymsg_chats_${currentUser.id}`);
      if (saved) {
        setChats(JSON.parse(saved));
      } else {
        setChats([]);
        // Add MymsgAI on first login
        if (isFirstLogin) {
          setTimeout(() => {
            setChats(prev => {
              const newChat: Chat = {
                id: `dm-${[currentUser.id, 'mymsgai'].sort().join('-')}`,
                type: 'direct',
                name: "MymsgAI",
                avatar: generateUserAvatarSvg("MymsgAI"),
                participants: [currentUser.id, 'mymsgai'],
                messages: [],
                lastMessageTime: Date.now(),
                userId: currentUser.id
              };
              return [newChat, ...prev];
            });
          }, 0);
        }
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
    // Support both full ID (group-xxx) and short ID (xxx)
    const fullGroupId = groupId.startsWith('group-') ? groupId : `group-${groupId}`;
    const group = chats.find(c => c.id === fullGroupId || c.id === groupId);
    if (group && !group.participants.includes(currentUser.id)) {
      setChats(prev => prev.map(c => 
        c.id === group.id
          ? { ...c, participants: [...c.participants, currentUser.id] } 
          : c
      ));
    }
  };

  const addContact = (contactId: string, contactName: string): boolean => {
    if (!currentUser) return false;
    
    // Special case for MymsgAI - always allow
    if (contactId === "mymsgai") {
      const existing = chats.find(c => c.type === 'direct' && c.id === `dm-${[currentUser.id, contactId].sort().join('-')}`);
      if (existing) return false;
      
      const newChat: Chat = {
        id: `dm-${[currentUser.id, contactId].sort().join('-')}`,
        type: 'direct',
        name: "MymsgAI",
        avatar: generateUserAvatarSvg("MymsgAI"),
        participants: [currentUser.id, contactId],
        messages: [],
        lastMessageTime: Date.now(),
        userId: currentUser.id
      };
      setChats(prev => [newChat, ...prev]);
      return true;
    }
    
    // For regular users - check if exists (check localStorage for that user)
    const userExists = localStorage.getItem(`mymsg_user_${contactId}`) !== null;
    if (!userExists) {
      return false; // User doesn't exist
    }
    
    const existing = chats.find(c => c.type === 'direct' && c.participants.includes(contactId) && c.participants.includes(currentUser.id));
    if (existing) return false;

    const newChat: Chat = {
      id: `dm-${[currentUser.id, contactId].sort().join('-')}`,
      type: 'direct',
      name: contactName,
      avatar: generateUserAvatarSvg(contactId),
      participants: [currentUser.id, contactId],
      messages: [],
      lastMessageTime: Date.now(),
      userId: currentUser.id
    };
    setChats(prev => [newChat, ...prev]);
    return true;
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
        const updatedChat = {
          ...c,
          messages: [...c.messages, newMessage],
          lastMessage: type === 'text' ? censoredText : (type === 'image' ? '📷 Imagen' : '🎤 Audio'),
          lastMessageTime: newMessage.timestamp
        };
        
        // Send browser notification if permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
          const senderName = currentUser.name;
          const messageContent = type === 'text' ? censoredText : (type === 'image' ? 'Envió una imagen' : 'Envió un audio');
          new Notification(`${senderName} en ${c.name}`, {
            body: messageContent,
            icon: c.avatar
          });
        }
        
        // Auto-reply from MymsgAI
        if (c.participants.includes('mymsgai') && type === 'text') {
          setTimeout(() => {
            import('./mymsgai').then(({ getMymsgAIResponse }) => {
              const response = getMymsgAIResponse(text);
              const aiMessage: Message = {
                id: nanoid(),
                senderId: 'mymsgai',
                text: response,
                timestamp: Date.now(),
                type: 'text'
              };
              setChats(prev => prev.map(ch => 
                ch.id === chatId 
                  ? { ...ch, messages: [...ch.messages, aiMessage], lastMessage: response, lastMessageTime: Date.now() }
                  : ch
              ));
            });
          }, 500);
        }
        
        return updatedChat;
      }
      return c;
    }));
  };

  const getChat = (chatId: string) => chats.find(c => c.id === chatId);
  
  const getChatMessages = (chatId: string): Message[] => {
    const chat = chats.find(c => c.id === chatId);
    return chat?.messages || [];
  };

  const getAllUsers = (): Map<string, User> => {
    const users = new Map<string, User>();
    // Collect all users from localStorage that have been created
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('mymsg_user_') && !key.includes('chats') && !key.includes('reports')) {
        try {
          const user = JSON.parse(localStorage.getItem(key) || '');
          users.set(user.id, user);
        } catch (e) {
          // ignore parse errors
        }
      }
    });
    return users;
  };

  const updateUser = (updates: Partial<User>) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, ...updates });
  };

  const updateGroup = (groupId: string, updates: Partial<Chat>) => {
    setChats(prev => prev.map(c => c.id === groupId ? { ...c, ...updates } : c));
  };

  const forgetChat = (chatId: string) => {
    if (!currentUser) return;
    setChats(prev => prev.filter(c => c.id !== chatId));
  };

  const clearChatMessages = (chatId: string) => {
    if (!currentUser) return;
    setChats(prev => prev.map(c => 
      c.id === chatId 
        ? { ...c, messages: [], lastMessage: '', lastMessageTime: Date.now() }
        : c
    ));
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

  const deleteMessage = (chatId: string, messageId: string) => {
    setChats(prev => prev.map(c => 
      c.id === chatId 
        ? { ...c, messages: c.messages.filter(m => m.id !== messageId) }
        : c
    ));
  };

  const replyToMessage = (chatId: string, messageId: string, replyText: string) => {
    if (!currentUser) return;
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    const originalMessage = chat.messages.find(m => m.id === messageId);
    if (!originalMessage) return;
    
    const censoredText = censorMessage(replyText);
    const newMessage: Message = {
      id: nanoid(),
      senderId: currentUser.id,
      text: `📌 Respuesta a ${originalMessage.senderId}: ${censoredText}`,
      timestamp: Date.now(),
      type: 'text'
    };

    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          messages: [...c.messages, newMessage],
          lastMessage: censoredText,
          lastMessageTime: newMessage.timestamp
        };
      }
      return c;
    }));
  };

  const forwardMessage = (fromChatId: string, messageId: string, toChatId: string) => {
    if (!currentUser) return;
    const fromChat = chats.find(c => c.id === fromChatId);
    if (!fromChat) return;
    const originalMessage = fromChat.messages.find(m => m.id === messageId);
    if (!originalMessage) return;
    
    const newMessage: Message = {
      id: nanoid(),
      senderId: currentUser.id,
      text: `↪️ Reenviado: ${originalMessage.text}`,
      timestamp: Date.now(),
      type: originalMessage.type,
      mediaUrl: originalMessage.mediaUrl
    };

    setChats(prev => prev.map(c => {
      if (c.id === toChatId) {
        return {
          ...c,
          messages: [...c.messages, newMessage],
          lastMessage: originalMessage.text,
          lastMessageTime: newMessage.timestamp
        };
      }
      return c;
    }));
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
      getChatMessages,
      getAllUsers,
      forgetChat,
      clearChatMessages,
      deleteMessage,
      replyToMessage,
      forwardMessage
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
