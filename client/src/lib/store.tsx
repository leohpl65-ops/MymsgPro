import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { nanoid } from "nanoid";
import { censorMessage } from "./censor";
import { ref, onValue, set, get, child, update, push, remove } from "firebase/database";
import { db } from "./firebase";
import { generateUserAvatarSvg, generateGroupAvatarSvg } from "./avatars";

// --- Types ---
export interface User {
  id: string;
  name: string;
  originalName?: string;
  avatar?: string;
  password: string;
  language?: 'es' | 'en';
  status?: string; // added to match the login usage
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
  login: (name: string, id: string, password: string) => Promise<void>;
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
      // Sync with Firebase real-time database instead of just polling localStorage
      // We will listen to the offline messages queue for this user
      const fbOfflineRef = ref(db, `offline_messages/${currentUser.id}`);
      get(fbOfflineRef).then((snapshot) => {
        if (snapshot.exists()) {
          const sendersData = snapshot.val();
          
          setChats(prevChats => {
            let newChats = [...prevChats];
            let changed = false;

            Object.keys(sendersData).forEach(senderKey => {
              // senderKey is like "from_123456"
              const senderId = senderKey.replace('from_', '');
              const messagesObj = sendersData[senderKey];
              const fbMsgs: Message[] = Object.values(messagesObj);
              
              if (fbMsgs.length > 0) {
                const chatId = `dm-${[currentUser.id, senderId].sort().join('-')}`;
                const chatIndex = newChats.findIndex(c => c.id === chatId);
                
                // Add to existing chat
                if (chatIndex >= 0) {
                  // Make sure we don't add duplicates by checking msg IDs
                  const existingMsgIds = new Set(newChats[chatIndex].messages.map(m => m.id));
                  const newMsgs = fbMsgs.filter(m => !existingMsgIds.has(m.id));
                  
                  if (newMsgs.length > 0) {
                    newChats[chatIndex] = {
                      ...newChats[chatIndex],
                      messages: [...newChats[chatIndex].messages, ...newMsgs],
                      lastMessage: newMsgs[newMsgs.length - 1].type === 'text' ? newMsgs[newMsgs.length - 1].text : 'Archivo multimedia',
                      lastMessageTime: newMsgs[newMsgs.length - 1].timestamp
                    };
                    changed = true;
                  }
                } else {
                  // Auto-create chat for unknown contact from Firebase
                  let senderName = senderId;
                  const senderUserStr = localStorage.getItem(`mymsg_user_${senderId}`);
                  if (senderUserStr) {
                    const parsedUser = JSON.parse(senderUserStr);
                    senderName = parsedUser.originalName || parsedUser.name;
                  } else {
                    // Try to get from Firebase if not local
                    get(ref(db, `users/${senderId}`)).then(uSnap => {
                      if (uSnap.exists()) {
                        const uData = uSnap.val();
                        const finalName = uData.originalName || uData.name;
                        setChats(curr => curr.map(c => c.id === chatId ? {...c, name: finalName} : c));
                        localStorage.setItem(`mymsg_user_${senderId}`, JSON.stringify(uData));
                      }
                    }).catch(e => console.warn("Error fetching user", e.message));
                  }
                  
                  const newChat: Chat = {
                    id: chatId,
                    type: 'direct',
                    name: senderName,
                    avatar: generateUserAvatarSvg(senderId),
                    participants: [currentUser.id, senderId],
                    messages: fbMsgs,
                    lastMessage: fbMsgs[fbMsgs.length - 1].type === 'text' ? fbMsgs[fbMsgs.length - 1].text : 'Archivo multimedia',
                    lastMessageTime: fbMsgs[fbMsgs.length - 1].timestamp,
                    userId: currentUser.id
                  };
                  newChats = [newChat, ...newChats];
                  changed = true;
                }
              }
            });

            if (changed) {
              // Delete the processed messages from Firebase to not read them again
              remove(fbOfflineRef).catch(e => console.warn("Error removing msgs", e.message));
              return newChats;
            }
            return prevChats;
          });
        }
      }).catch(e => {
        // Silently catch permission denied to avoid screen overlay errors
        console.warn("Firebase offline queue read error:", e.message);
      });
      
      // Check Groups - check the global groups to see if we've been added
      setChats(prevChats => {
        let newChats = [...prevChats];
        let changed = false;
        
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
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
          return newChats;
        }
        return prevChats;
      });
    };

    // Check every 2 seconds to simulate real-time communication across tabs/windows
    const interval = setInterval(checkOfflineMessages, 2000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const login = async (name: string, id: string, password: string) => {
    // Check local first
    let savedUserStr = localStorage.getItem(`mymsg_user_${id}`);
    
    // Check Firebase
    try {
      const userSnap = await get(ref(db, `users/${id}`));
      if (userSnap.exists()) {
        const fbUser = userSnap.val();
        localStorage.setItem(`mymsg_user_${id}`, JSON.stringify(fbUser));
        savedUserStr = JSON.stringify(fbUser);
      }
    } catch (e) {
      console.error("Firebase fetch error", e);
    }

    if (!savedUserStr && id !== '12345670') {
      throw new Error("Esta cuenta no existe. Prueba otra vez.");
    }

    if (savedUserStr) {
      const savedUser = JSON.parse(savedUserStr);
      savedUser.name = name;
      localStorage.setItem(`mymsg_user_${id}`, JSON.stringify(savedUser));
      // Update Firebase (strip undefined values)
      set(ref(db, `users/${id}`), JSON.parse(JSON.stringify(savedUser))).catch(console.error);
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
    let savedUserStr = localStorage.getItem(`mymsg_user_${id}`);
    
    if (!savedUserStr) return true; // First login, accept any password
    try {
      const user = JSON.parse(savedUserStr);
      return user.password === password;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setChats([]);
  };

  const createGroup = async (name: string) => {
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
    
    // Try to create it in Firebase for global access
    try {
      const { set, ref } = await import("firebase/database");
      const { db } = await import("@/lib/firebase");
      // Strip undefined
      const safeGroup = JSON.parse(JSON.stringify(newGroup));
      await set(ref(db, `groups/${groupId}`), safeGroup);
    } catch(e) {
      console.error("Error creating group in Firebase", e);
    }
    
    setChats(prev => [newGroup, ...prev]);
  };

  const joinGroup = async (groupId: string) => {
    if (!currentUser) return;
    const fullGroupId = groupId.startsWith('group-') ? groupId : `group-${groupId}`;
    
    try {
      const { get, ref, set } = await import("firebase/database");
      const { db } = await import("@/lib/firebase");
      
      const groupSnap = await get(ref(db, `groups/${fullGroupId}`));
      
      if (groupSnap.exists()) {
        const globalGroup = groupSnap.val();
        
        if (!globalGroup.participants.includes(currentUser.id)) {
          globalGroup.participants.push(currentUser.id);
          // Update Firebase
          await set(ref(db, `groups/${fullGroupId}`), globalGroup);
        }
        
        // Save to local storage for offline access
        localStorage.setItem(`mymsg_global_group_${fullGroupId}`, JSON.stringify(globalGroup));
        
        setChats(prev => {
          const existing = prev.find(c => c.id === fullGroupId);
          if (existing) return prev;
          return [globalGroup, ...prev];
        });
        return;
      }
    } catch (e) {
      console.error("Firebase join group error", e);
    }
    
    // Fallback: Check global storage first (local fallback)
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
         name: `Grupo ${groupId.replace('group-', '')}`,
         avatar: generateGroupAvatarSvg(groupId.replace('group-', '')),
         participants: [currentUser.id],
         messages: [],
         lastMessage: "Te has unido al grupo",
         lastMessageTime: Date.now(),
         userId: currentUser.id
       };
       localStorage.setItem(`mymsg_global_group_${fullGroupId}`, JSON.stringify(newGroup));
       
       // Try to create it in Firebase too
       try {
         const { set, ref } = await import("firebase/database");
         const { db } = await import("@/lib/firebase");
         await set(ref(db, `groups/${fullGroupId}`), newGroup);
       } catch(e) {}
       
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
      status: 'sent',
      read: false
    };
    
    if (mediaUrl) {
      newMessage.mediaUrl = mediaUrl;
    }
    
    // Firebase doesn't accept undefined values
    // Using structuredClone or similar to completely strip out undefined values
    const safeMessage = JSON.parse(JSON.stringify(newMessage));
    
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
        
        // Broadcast for groups or handle offline for DMs (Firebase)
        if (c.type === 'group') {
          const globalGroupRef = ref(db, `groups/${c.id}`);
          // Strip undefined values for Firebase
          const groupDataToSave = JSON.parse(JSON.stringify({
            ...updatedChat,
            messages: updatedChat.messages
          }));
          set(globalGroupRef, groupDataToSave).catch(e => console.error("Firebase group send error", e));
          
          const globalGroupStr = localStorage.getItem(`mymsg_global_group_${c.id}`);
          if (globalGroupStr) {
            const globalGroup = JSON.parse(globalGroupStr);
            globalGroup.messages.push(newMessage);
            globalGroup.lastMessage = updatedChat.lastMessage;
            globalGroup.lastMessageTime = updatedChat.lastMessageTime;
            localStorage.setItem(`mymsg_global_group_${c.id}`, JSON.stringify(globalGroup));
          }
        } else {
          // Send message to global Firebase queue for the recipient
          const recipientId = c.participants.find(p => p !== currentUser.id);
          if (recipientId) {
            const fbMsgRef = push(ref(db, `offline_messages/${recipientId}/from_${currentUser.id}`));
            // Strip undefined values for Firebase
            set(fbMsgRef, safeMessage).catch(e => console.error("Firebase send message error", e));

            // Keep local fallback just in case
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
          // Ignore parse errors
        }
      }
    });
    return users;
  };

  const updateUser = (updates: Partial<User>) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, ...updates };
    setCurrentUser(updatedUser);
    localStorage.setItem(`mymsg_user_${currentUser.id}`, JSON.stringify(updatedUser));
  };

  const updateGroup = (groupId: string, updates: Partial<Chat>) => {
    setChats(prev => prev.map(c => 
      c.id === groupId ? { ...c, ...updates } : c
    ));
    
    // Update global storage
    const globalGroupStr = localStorage.getItem(`mymsg_global_group_${groupId}`);
    if (globalGroupStr) {
      const globalGroup = JSON.parse(globalGroupStr);
      localStorage.setItem(`mymsg_global_group_${groupId}`, JSON.stringify({ ...globalGroup, ...updates }));
    }
  };

  const reportEntity = (type: 'Usuario' | 'Grupo', targetId: string, targetName: string) => {
    if (!currentUser) return;
    
    // Get last few messages as evidence
    const chat = chats.find(c => c.id === targetId || c.participants.includes(targetId));
    const targetMessages = chat ? chat.messages.slice(-5) : [];

    const newReport: Report = {
      id: nanoid(),
      type,
      targetId,
      targetName,
      reporterId: currentUser.id,
      timestamp: Date.now(),
      targetMessages
    };

    setReports(prev => [newReport, ...prev]);
  };

  const deleteReport = (reportId: string) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
  };

  const setChatWallpaper = (chatId: string, url: string) => {
    setChats(prev => prev.map(c => 
      c.id === chatId ? { ...c, wallpaper: url } : c
    ));
  };

  const forgetChat = (chatId: string) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
  };

  const clearChatMessages = (chatId: string) => {
    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        return { ...c, messages: [], lastMessage: undefined, lastMessageTime: undefined };
      }
      return c;
    }));
  };

  const deleteMessage = (chatId: string, messageId: string) => {
    if (!currentUser) return;
    
    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        const messageToDelete = c.messages.find(m => m.id === messageId);
        // Only allow deleting own messages
        if (messageToDelete && messageToDelete.senderId === currentUser.id) {
          const newMessages = c.messages.filter(m => m.id !== messageId);
          return { 
            ...c, 
            messages: newMessages,
            lastMessage: newMessages.length > 0 ? 
              (newMessages[newMessages.length - 1].type === 'text' ? newMessages[newMessages.length - 1].text : 'Archivo multimedia') 
              : undefined,
            lastMessageTime: newMessages.length > 0 ? newMessages[newMessages.length - 1].timestamp : undefined
          };
        }
      }
      return c;
    }));
  };

  const markChatAsRead = (chatId: string) => {
    if (!currentUser) return;
    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          messages: c.messages.map(m => 
            m.senderId !== currentUser.id ? { ...m, read: true } : m
          )
        };
      }
      return c;
    }));
  };

  const replyToMessage = (chatId: string, messageId: string, replyText: string) => {
    if (!currentUser) return;
    
    const chat = getChat(chatId);
    const messageToReplyTo = chat?.messages.find(m => m.id === messageId);
    
    if (messageToReplyTo) {
      const formattedReplyText = `[Respondiendo a: ${messageToReplyTo.text.substring(0, 30)}${messageToReplyTo.text.length > 30 ? '...' : ''}]\n${replyText}`;
      sendMessage(chatId, formattedReplyText, 'text');
    }
  };

  const forwardMessage = (fromChatId: string, messageId: string, toChatId: string) => {
    if (!currentUser) return;
    
    const chat = getChat(fromChatId);
    const messageToForward = chat?.messages.find(m => m.id === messageId);
    
    if (messageToForward) {
      const prefix = "[Reenviado] ";
      const text = messageToForward.type === 'text' ? `${prefix}${messageToForward.text}` : prefix;
      sendMessage(toChatId, text, messageToForward.type, messageToForward.mediaUrl);
    }
  };

  const value: StoreContextType = {
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
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
