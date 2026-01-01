import React, { useState, useRef, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useStore } from "@/lib/store";
import { MobileLayout } from "@/components/mobile-layout";
import { OfflineBanner } from "@/components/offline-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Send, Mic, Image as ImageIcon, Smile, Settings, Flag, Wallpaper, X, RotateCcw, Share2, Reply, Trash2, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const [, params] = useRoute("/chat/:id");
  const [, setLocation] = useLocation();
  const { chats, currentUser, sendMessage, getChat, reportEntity, setChatWallpaper, forgetChat, clearChatMessages, deleteMessage, replyToMessage, forwardMessage, markChatAsRead } = useStore();
  
  const chatId = params?.id;
  const chat = chats.find(c => c.id === chatId);

  // Mark chat as read when opening
  useEffect(() => {
    if (chatId) {
      markChatAsRead(chatId);
    }
  }, [chatId, chat?.messages.length]);
  
  const [inputText, setInputText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const micPressRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const longPressTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Redirect if invalid chat
  if (!chat || !currentUser) {
    useEffect(() => { setLocation("/contacts"); }, []);
    return null;
  }

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(chat.id, inputText, 'text');
    setInputText("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isAudio = file.type.startsWith('audio/');
    const isImage = file.type.startsWith('image/');
    
    const url = URL.createObjectURL(file);
    
    if (isAudio) sendMessage(chat.id, "Mensaje de voz", 'audio', url);
    else if (isImage) sendMessage(chat.id, "Mensaje de imagen", 'image', url);
  };

  const startMicrophone = () => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        sendMessage(chat.id, "Mensaje de voz", 'audio', url);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
    }).catch(() => {
      alert("No se pudo acceder al micrófono");
    });
  };

  const stopMicrophone = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const changeWallpaper = () => {
    const wallpapers = [
       "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
       "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
       "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
       "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
       "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
       "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
       "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
       "linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)"
    ];
    const random = wallpapers[Math.floor(Math.random() * wallpapers.length)];
    setChatWallpaper(chat.id, random);
    setShowSettings(false);
  };

  return (
    <MobileLayout>
      <OfflineBanner />
      
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b flex items-center p-3 gap-3 sticky top-0 z-20">
        <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setLocation("/contacts")}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        
        <img src={chat.avatar} className="w-10 h-10 rounded-full border border-border object-cover" />
        
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{chat.name}</h2>
          <p className="text-xs text-muted-foreground truncate">
            {chat.type === 'group' ? `${chat.participants.length} miembros` : 'En línea'}
          </p>
        </div>

        <Button size="icon" variant="ghost" onClick={() => setShowSettings(true)}>
          <Settings className="h-5 w-5" />
        </Button>
      </header>

      {/* Messages Area */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 relative"
        style={{ 
          background: chat.wallpaper && chat.wallpaper.includes('gradient') ? chat.wallpaper : (chat.wallpaper ? `url(${chat.wallpaper})` : undefined),
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {!chat.wallpaper && (
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/subtle-grey.png')] z-0" />
        )}
        
        <div className="relative z-10 flex flex-col gap-2 pb-2">
          {chat.messages.map((msg, idx) => {
            const isMe = msg.senderId === currentUser.id;
            
            const handleMouseDown = () => {
              const timer = setTimeout(() => setSelectedMessage(msg.id), 500);
              longPressTimersRef.current.set(msg.id, timer);
            };
            
            const handleMouseUp = () => {
              const timer = longPressTimersRef.current.get(msg.id);
              if (timer) {
                clearTimeout(timer);
                longPressTimersRef.current.delete(msg.id);
              }
            };
            
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2 shadow-sm text-sm break-words relative cursor-pointer hover:opacity-80 transition",
                  isMe 
                    ? "bg-primary text-primary-foreground self-end rounded-br-none" 
                    : "bg-white text-foreground self-start rounded-bl-none"
                )}
                onContextMenu={(e) => { e.preventDefault(); setSelectedMessage(msg.id); }}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchEnd={handleMouseUp}
              >
                {!isMe && chat.type === 'group' && (
                  <p className="text-[10px] font-bold opacity-70 mb-1">{msg.senderId}</p>
                )}
                
                {msg.type === 'text' && <p>{msg.text}</p>}
                
                {msg.type === 'image' && (
                  <img src={msg.mediaUrl} className="rounded-lg max-w-full mt-1 mb-1" />
                )}

                {msg.type === 'audio' && (
                   <audio controls src={msg.mediaUrl} className="max-w-[200px] h-10 mt-1" />
                )}

                <div className="flex items-center justify-end gap-1 mt-1">
                  <p className={cn("text-[10px] opacity-70", isMe ? "text-primary-foreground" : "text-muted-foreground")}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {isMe && (
                    <div className="flex items-center">
                      <span className={cn(
                        "text-[10px]",
                        msg.status === 'read' ? "text-blue-300" : "text-primary-foreground/70"
                      )}>
                        {msg.status === 'sent' ? '✅' : '✅✅'}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-3 bg-white border rounded-lg shadow-lg p-3 z-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold">Emojis</span>
            <Button size="sm" variant="ghost" onClick={() => setShowEmojiPicker(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {['😀', '😂', '😍', '🤔', '😢', '🎉', '🔥', '💯', '👍', '👎', '💔', '😱', '😎', '🤩', '😭', '😡', '🤔', '😴', '🤒', '🤐', '😷', '🤒', '😻', '😼', '❤️', '💔', '🔥', '⭐', '✨'].map((emoji) => (
              <button key={emoji} className="text-2xl hover:scale-110 transition" onClick={() => { setInputText(inputText + emoji); setShowEmojiPicker(false); }}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Actions Menu */}
      {selectedMessage && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          onClick={() => setSelectedMessage(null)}
        >
          <div className="bg-white rounded-lg shadow-xl p-2 space-y-1 relative" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" className="w-full justify-start text-sm" onClick={() => setSelectedMessage(null)}>
              <X className="h-4 w-4 mr-2" /> Cerrar
            </Button>
            <Button size="sm" variant="ghost" className="w-full justify-start text-sm" onClick={() => { setReplyingTo(selectedMessage); setSelectedMessage(null); }}>
              <Reply className="h-4 w-4 mr-2" /> Responder
            </Button>
            <Button size="sm" variant="ghost" className="w-full justify-start text-sm" onClick={() => { setShowForwardDialog(true); setSelectedMessage(null); }}>
              <Share2 className="h-4 w-4 mr-2" /> Reenviar
            </Button>
            {chat.messages.find(m => m.id === selectedMessage)?.senderId === currentUser?.id && (
              <Button size="sm" variant="destructive" className="w-full justify-start text-sm" onClick={() => { deleteMessage(chat.id, selectedMessage); setSelectedMessage(null); }}>
                <RotateCcw className="h-4 w-4 mr-2" /> Eliminar
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Reply Indicator */}
      {replyingTo && (
        <div className="bg-muted p-2 border-t flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Respondiendo a un mensaje</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-background p-3 border-t flex items-end gap-2 sticky bottom-0 z-20">
        <Button size="icon" variant="ghost" className="text-muted-foreground shrink-0 rounded-full relative" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
          <Smile className="h-6 w-6" />
        </Button>
        
        <div className="flex-1 bg-muted rounded-2xl flex items-center px-3 py-1 min-h-[44px]">
          <Input 
            className="border-none shadow-none bg-transparent focus-visible:ring-0 px-0 placeholder:text-muted-foreground/70"
            placeholder="Mensaje..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
        </div>

        {inputText.trim() ? (
          <Button size="icon" className="shrink-0 rounded-full h-11 w-11 shadow-lg" onClick={handleSend}>
             <Send className="h-5 w-5 ml-0.5" />
          </Button>
        ) : (
          <>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
             <Button 
               size="icon" 
               variant="ghost" 
               className={cn("text-muted-foreground shrink-0", isRecording && "bg-red-500/20 text-red-600 animate-pulse")}
               onMouseDown={() => {
                 setIsRecording(true);
                 startMicrophone();
               }}
               onMouseUp={() => {
                 setIsRecording(false);
                 stopMicrophone();
               }}
               onMouseLeave={() => {
                 if (isRecording) {
                   setIsRecording(false);
                   stopMicrophone();
                 }
               }}
               onTouchStart={() => {
                 setIsRecording(true);
                 startMicrophone();
               }}
               onTouchEnd={() => {
                 setIsRecording(false);
                 stopMicrophone();
               }}
             >
               <Mic className="h-6 w-6" />
             </Button>
          </>
        )}
      </div>

      {/* Forward Dialog */}
      <Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
        <DialogContent className="sm:max-w-xs" aria-describedby="forward-dialog">
          <DialogHeader>
            <DialogTitle>Reenviar a</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {chat.messages.find(m => m.id === selectedMessage) && chat.type === 'group' && (
              <div className="text-xs text-muted-foreground mb-3 pb-3 border-b">
                Este mensaje se reenviará a otros chats/grupos
              </div>
            )}
            {chats.filter(c => c.id !== chatId).map(c => (
              <Button 
                key={c.id} 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => {
                  if (selectedMessage) {
                    forwardMessage(chat.id, selectedMessage, c.id);
                    setShowForwardDialog(false);
                  }
                }}
              >
                <img src={c.avatar} className="w-5 h-5 rounded-full mr-2" />
                <span className="text-sm">{c.name}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-xs" aria-describedby="chat-settings-dialog">
           <DialogHeader>
             <DialogTitle>Ajustes de Chat</DialogTitle>
           </DialogHeader>
           <div className="space-y-3 py-4">
             <Button variant="outline" className="w-full justify-start" onClick={changeWallpaper}>
               <Wallpaper className="mr-2 h-4 w-4" /> Cambiar Fondo
             </Button>
             
             <div className="p-3 bg-slate-50 rounded-md text-sm border">
               <p className="text-xs font-semibold text-muted-foreground mb-2">ID: <span className="font-mono text-foreground">{chat.id.replace('dm-', '').replace('group-', '')}</span></p>
             </div>
             
             {chat.type === 'group' && (
               <div className="p-3 bg-muted rounded-md text-sm">
                 <p className="font-semibold mb-2">Miembros:</p>
                 <ul className="space-y-2">
                   {chat.participants.map(participantId => {
                     let displayName = participantId;
                     if (participantId === 'mymsgai') {
                       displayName = 'MymsgAI';
                     } else {
                       try {
                         const userStr = localStorage.getItem(`mymsg_user_${participantId}`);
                         if (userStr) {
                           const user = JSON.parse(userStr);
                           displayName = user.name || participantId;
                         }
                       } catch (e) {
                         // ignore
                       }
                     }
                     return <li key={participantId} className="text-sm"><span className="font-semibold block">{displayName}</span><span className="text-xs text-muted-foreground">{participantId}</span></li>;
                   })}
                 </ul>
               </div>
             )}

             <Button variant="outline" className="w-full justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={() => { clearChatMessages(chat.id); setShowSettings(false); }}>
               <Trash2 className="mr-2 h-4 w-4" /> Limpiar Chat
             </Button>

             <Button variant="destructive" className="w-full justify-start" onClick={() => { forgetChat(chat.id); setLocation("/contacts"); }}>
               <LogOut className="mr-2 h-4 w-4" /> Olvidar Chat
             </Button>

             <Button variant="ghost" className="w-full justify-start text-red-600 hover:bg-red-50" onClick={() => { reportEntity(chat.type === 'group' ? 'Grupo' : 'Usuario', chat.id, chat.name); setShowSettings(false); }}>
               <Flag className="mr-2 h-4 w-4" /> Reportar {chat.type === 'group' ? 'Grupo' : 'Usuario'}
             </Button>
           </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
