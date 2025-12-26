import React, { useState, useRef, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useStore } from "@/lib/store";
import { MobileLayout } from "@/components/mobile-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Send, Mic, Image as ImageIcon, Smile, Settings, MoreVertical, Flag, Wallpaper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const [, params] = useRoute("/chat/:id");
  const [, setLocation] = useLocation();
  const { chats, currentUser, sendMessage, getChat, reportEntity, setChatWallpaper, updateGroup } = useStore();
  
  const chatId = params?.id;
  const chat = chats.find(c => c.id === chatId);
  
  const [inputText, setInputText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if invalid chat
  if (!chat || !currentUser) {
    // We wrap redirect in useEffect to avoid state update warning during render
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

    // Mock upload - in real app we'd upload to server
    // For audio vs image detection based on type
    const isAudio = file.type.startsWith('audio/');
    const isImage = file.type.startsWith('image/');
    
    // Create a fake object URL
    const url = URL.createObjectURL(file);
    
    if (isAudio) sendMessage(chat.id, "Audio message", 'audio', url);
    else if (isImage) sendMessage(chat.id, "Image message", 'image', url);
  };

  const changeWallpaper = () => {
    // Mock wallpaper change
    const wallpapers = [
       "https://images.unsplash.com/photo-1557683316-973673baf926?w=500&auto=format&fit=crop&q=60",
       "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=500&auto=format&fit=crop&q=60",
       "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=500&auto=format&fit=crop&q=60"
    ];
    const random = wallpapers[Math.floor(Math.random() * wallpapers.length)];
    setChatWallpaper(chat.id, random);
    setShowSettings(false);
  };

  return (
    <MobileLayout>
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b flex items-center p-3 gap-3 sticky top-0 z-20">
        <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setLocation("/contacts")}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        
        <img src={chat.avatar} className="w-10 h-10 rounded-full border border-border" />
        
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
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100"
        style={{ 
          backgroundImage: chat.wallpaper ? `url(${chat.wallpaper})` : undefined,
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
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2 shadow-sm text-sm break-words",
                  isMe 
                    ? "bg-primary text-primary-foreground self-end rounded-br-none" 
                    : "bg-white text-foreground self-start rounded-bl-none"
                )}
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

                <p className={cn("text-[10px] text-right mt-1 opacity-70", isMe ? "text-primary-foreground" : "text-muted-foreground")}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-background p-3 border-t flex items-end gap-2 sticky bottom-0 z-20">
        <Button size="icon" variant="ghost" className="text-muted-foreground shrink-0 rounded-full">
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
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*,audio/*" onChange={handleFileUpload} />
             <Button size="icon" variant="ghost" className="text-muted-foreground shrink-0" onClick={() => fileInputRef.current?.click()}>
               <Mic className="h-6 w-6" />
             </Button>
          </>
        )}
      </div>

      {/* Chat Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-xs">
           <DialogHeader>
             <DialogTitle>Ajustes de Chat</DialogTitle>
           </DialogHeader>
           <div className="space-y-3 py-4">
             <Button variant="outline" className="w-full justify-start" onClick={changeWallpaper}>
               <Wallpaper className="mr-2 h-4 w-4" /> Cambiar Fondo
             </Button>
             
             {chat.type === 'group' && (
               <div className="p-3 bg-muted rounded-md text-sm">
                 <p className="font-semibold mb-2">Miembros:</p>
                 <ul className="list-disc pl-4 space-y-1">
                   {chat.participants.map(p => <li key={p}>{p}</li>)}
                 </ul>
               </div>
             )}

             <Button variant="destructive" className="w-full justify-start" onClick={() => { reportEntity(chat.type === 'group' ? 'Grupo' : 'Usuario', chat.id); setShowSettings(false); }}>
               <Flag className="mr-2 h-4 w-4" /> Reportar {chat.type === 'group' ? 'Grupo' : 'Usuario'}
             </Button>
           </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
