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
  language?: 'es' | 'en';
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  type: 'text' | 'image' | 'audio';
  mediaUrl?: string;
  read?: boolean;
  status: 'sent' | 'delivered' | 'read';
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
  streak?: number;
  lastInteractionDay?: string;
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
  deleteReport: (reportId: string) => void;
  markChatAsRead: (chatId: string) => void;
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

  // Periodic check for new offline messages and auto-add contacts
  useEffect(() => {
    if (!currentUser) return;
    
    const checkOfflineMessages = () => {
      const keys = Object.keys(localStorage);
      let chatsUpdated = false;

      // Also check global groups for updates
      setChats(prevChats => {
        let newChats = [...prevChats];
        let changed = false;

        keys.forEach(key => {
          // Check DMs
          if (key.startsWith(`mymsg_offline_msgs_${currentUser.id}_from_`)) {
            const senderId = key.split('_from_')[1];
            const offlineMsgs = JSON.parse(localStorage.getItem(key) || '[]');
            
            if (offlineMsgs.length > 0) {
              const chatId = `dm-${[currentUser.id, senderId].sort().join('-')}`;
              const chatIndex = newChats.findIndex(c => c.id === chatId);
              
              if (chatIndex >= 0) {
                // Add to existing chat
                newChats[chatIndex] = {
                  ...newChats[chatIndex],
                  messages: [...newChats[chatIndex].messages, ...offlineMsgs],
                  lastMessage: offlineMsgs[offlineMsgs.length - 1].type === 'text' ? offlineMsgs[offlineMsgs.length - 1].text : 'Archivo multimedia',
                  lastMessageTime: offlineMsgs[offlineMsgs.length - 1].timestamp
                };
              } else {
                // Auto-create chat for unknown contact
                let senderName = senderId;
                const senderUserStr = localStorage.getItem(`mymsg_user_${senderId}`);
                if (senderUserStr) {
                  senderName = JSON.parse(senderUserStr).name;
                }
                
                const newChat: Chat = {
                  id: chatId,
                  type: 'direct',
                  name: senderName,
                  avatar: generateUserAvatarSvg(senderId),
                  participants: [currentUser.id, senderId],
                  messages: offlineMsgs,
                  lastMessage: offlineMsgs[offlineMsgs.length - 1].type === 'text' ? offlineMsgs[offlineMsgs.length - 1].text : 'Archivo multimedia',
                  lastMessageTime: offlineMsgs[offlineMsgs.length - 1].timestamp,
                  userId: currentUser.id
                };
                newChats = [newChat, ...newChats];
              }
              
              localStorage.removeItem(key);
              changed = true;
            }
          }
          
          // Check Groups
          if (key.startsWith('mymsg_global_group_')) {
            const globalGroup = JSON.parse(localStorage.getItem(key) || '{}');
            if (globalGroup && globalGroup.participants && globalGroup.participants.includes(currentUser.id)) {
              const chatIndex = newChats.findIndex(c => c.id === globalGroup.id);
              if (chatIndex >= 0) {
                if (newChats[chatIndex].messages.length < globalGroup.messages.length) {
                  newChats[chatIndex] = {
                    ...newChats[chatIndex],
                    name: globalGroup.name,
                    messages: globalGroup.messages,
                    lastMessage: globalGroup.lastMessage,
                    lastMessageTime: globalGroup.lastMessageTime,
                    participants: globalGroup.participants
                  };
                  changed = true;
                }
              } else {
                // We were added to a group!
                newChats = [{...globalGroup, userId: currentUser.id}, ...newChats];
                changed = true;
              }
            }
          }
        });

        if (changed) {
          chatsUpdated = true;
          return newChats;
        }
        return prevChats;
      });
    };

    // Check every 2 seconds to simulate real-time communication across tabs/windows
    const interval = setInterval(checkOfflineMessages, 2000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const login = (name: string, id: string, password: string) => {
    // Check if account exists
    const savedUserStr = localStorage.getItem(`mymsg_user_${id}`);
    if (!savedUserStr && id !== '12345670') {
      throw new Error("esta cuenta no existe. Prueba otra ves");
    }

    if (savedUserStr) {
      const savedUser = JSON.parse(savedUserStr);
      savedUser.name = name;
      localStorage.setItem(`mymsg_user_${id}`, JSON.stringify(savedUser));
    }

    const user: User = { 
      id, 
      name, 
      password, 
      avatar: generateUserAvatarSvg(name),
      language: (localStorage.getItem(`mymsg_lang_${id}`) as any) || (navigator.language.startsWith('es') ? 'es' : 'en'),
      status: 'offline'
    };
    setCurrentUser(user);
    localStorage.setItem(`mymsg_user_${id}`, JSON.stringify(user));
    localStorage.setItem("mymsg_user", JSON.stringify(user));
    
    // Restore chats from localStorage for this specific user ID
    const savedChats = localStorage.getItem(`mymsg_chats_${id}`);
    if (savedChats) {
      const parsedChats: Chat[] = JSON.parse(savedChats);
      
      // Sync group names and messages from "global" storage
      const syncedChats = parsedChats.map(chat => {
        if (chat.type === 'group') {
          const globalGroupStr = localStorage.getItem(`mymsg_global_group_${chat.id}`);
          if (globalGroupStr) {
            const globalGroup = JSON.parse(globalGroupStr);
            return {
              ...chat,
              name: globalGroup.name,
              messages: globalGroup.messages,
              lastMessage: globalGroup.lastMessage,
              lastMessageTime: globalGroup.lastMessageTime,
              participants: globalGroup.participants
            };
          }
        } else if (chat.type === 'direct') {
          // Check for offline messages sent to this user
          const contactId = chat.participants.find(p => p !== id);
          if (contactId) {
            const offlineMsgsKey = `mymsg_offline_msgs_${id}_from_${contactId}`;
            const offlineMsgsStr = localStorage.getItem(offlineMsgsKey);
            if (offlineMsgsStr) {
              const offlineMsgs = JSON.parse(offlineMsgsStr);
              localStorage.removeItem(offlineMsgsKey);
              return {
                ...chat,
                messages: [...chat.messages, ...offlineMsgs],
                lastMessage: offlineMsgs[offlineMsgs.length - 1].text,
                lastMessageTime: offlineMsgs[offlineMsgs.length - 1].timestamp
              };
            }
          }
        }
        return chat;
      });
      
      setChats(syncedChats);
    }
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
    const groupId = `group-${nanoid()}`;
    const newGroup: Chat = {
      id: groupId,
      type: 'group',
      name,
      avatar: generateGroupAvatarSvg(name),
      participants: [currentUser.id],
      messages: [],
      lastMessage: "Grupo creado",
      lastMessageTime: Date.now(),
      userId: currentUser.id
    };
    
    // Save to global storage for sync
    localStorage.setItem(`mymsg_global_group_${groupId}`, JSON.stringify(newGroup));
    
    setChats(prev => [newGroup, ...prev]);
  };

  const joinGroup = (groupId: string) => {
    if (!currentUser) return;
    const fullGroupId = groupId.startsWith('group-') ? groupId : `group-${groupId}`;
    
    // Check global storage first
    const globalGroupStr = localStorage.getItem(`mymsg_global_group_${fullGroupId}`);
    if (globalGroupStr) {
      const globalGroup = JSON.parse(globalGroupStr);
      if (!globalGroup.participants.includes(currentUser.id)) {
        globalGroup.participants.push(currentUser.id);
        localStorage.setItem(`mymsg_global_group_${fullGroupId}`, JSON.stringify(globalGroup));
      }
      
      setChats(prev => {
        const existing = prev.find(c => c.id === fullGroupId);
        if (existing) return prev;
        return [globalGroup, ...prev];
      });
      return;
    }

    // Fallback/Mock behavior if not in global
    const group = chats.find(c => c.id === fullGroupId || c.id === groupId);
    if (group && !group.participants.includes(currentUser.id)) {
      setChats(prev => prev.map(c => 
        c.id === group.id
          ? { ...c, participants: [...c.participants, currentUser.id] } 
          : c
      ));
    } else if (!group) {
       const newGroup: Chat = {
         id: fullGroupId,
         type: 'group',
         name: `Grupo ${groupId}`,
         avatar: generateGroupAvatarSvg(groupId),
         participants: [currentUser.id],
         messages: [],
         lastMessage: "Te has unido al grupo",
         lastMessageTime: Date.now(),
         userId: currentUser.id
       };
       localStorage.setItem(`mymsg_global_group_${fullGroupId}`, JSON.stringify(newGroup));
       setChats(prev => [newGroup, ...prev]);
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
      mediaUrl,
      status: 'sent',
      read: false
    };

    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        // Update streak
        const today = new Date().toISOString().split('T')[0];
        let newStreak = c.streak || 0;
        if (c.lastInteractionDay !== today) {
          newStreak += 1;
        }

        const updatedChat = {
          ...c,
          messages: [...c.messages, newMessage],
          lastMessage: type === 'text' ? censoredText : (type === 'image' ? '📷 Imagen' : '🎤 Audio'),
          lastMessageTime: newMessage.timestamp,
          streak: newStreak,
          lastInteractionDay: today
        };
        
        // Broadcast for groups or handle offline for DMs (Mock)
        if (c.type === 'group') {
          const globalGroupStr = localStorage.getItem(`mymsg_global_group_${c.id}`);
          if (globalGroupStr) {
            const globalGroup = JSON.parse(globalGroupStr);
            globalGroup.messages.push(newMessage);
            globalGroup.lastMessage = updatedChat.lastMessage;
            globalGroup.lastMessageTime = updatedChat.lastMessageTime;
            localStorage.setItem(`mymsg_global_group_${c.id}`, JSON.stringify(globalGroup));
          }
        } else {
          // Send message globally to the other person (works across tabs/windows)
          const recipientId = c.participants.find(p => p !== currentUser.id);
          if (recipientId) {
            const offlineKey = `mymsg_offline_msgs_${recipientId}_from_${currentUser.id}`;
            const offlineMsgs = JSON.parse(localStorage.getItem(offlineKey) || '[]');
            offlineMsgs.push(newMessage);
            localStorage.setItem(offlineKey, JSON.stringify(offlineMsgs));
          }
        }
        
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
                type: 'text',
                status: 'read',
                read: true
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
    
    // Get last 50 messages from the target chat/user for better moderation context
    let targetMessages: Message[] = [];
    if (type === 'Usuario') {
      const dmChatId = `dm-${[currentUser.id, targetId].sort().join('-')}`;
      const dmChat = chats.find(c => c.id === dmChatId);
      targetMessages = dmChat?.messages.slice(-50) || [];
    } else {
      const groupChat = chats.find(c => c.id === targetId);
      targetMessages = groupChat?.messages.slice(-50) || [];
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

  const deleteReport = (reportId: string) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
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

  const markChatAsRead = (chatId: string) => {
    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          messages: c.messages.map(m => m.senderId !== currentUser?.id ? { ...m, read: true } : m)
        };
      }
      return c;
    }));
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
      type: 'text',
      status: 'sent',
      read: false
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
      mediaUrl: originalMessage.mediaUrl,
      status: 'sent',
      read: false
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
      deleteReport,
      markChatAsRead,
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
