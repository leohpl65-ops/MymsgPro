import React, { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { MobileLayout } from "@/components/mobile-layout";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Settings, UserCircle, MessageSquare } from "lucide-react";
import { UserSettingsModal, GroupMenuModal, AddFriendModal, ReportsModal } from "@/components/modals";
import { motion } from "framer-motion";

export default function ContactsPage() {
  const { currentUser, chats } = useStore();
  const [, setLocation] = useLocation();
  
  const [showSettings, setShowSettings] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showReports, setShowReports] = useState(false);

  // Redirect if not logged in
  if (!currentUser) {
    setLocation("/");
    return null;
  }

  // Admin Check
  const isAdmin = currentUser.id === "12345670";

  return (
    <MobileLayout>
      {/* Header */}
      <header className={`p-4 flex justify-between items-center shadow-sm z-10 ${isAdmin ? 'bg-slate-900 text-white border-b-2 border-yellow-500' : 'bg-primary text-primary-foreground'}`}>
        <h1 className="font-bold text-lg tracking-tight">MyMsg Pro</h1>
        <div className="flex gap-1">
          {isAdmin && (
            <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10" onClick={() => setShowReports(true)}>
              <ShieldAlert className="h-5 w-5 text-yellow-500" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10" onClick={() => setShowGroups(true)}>
            <Users className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10" onClick={() => setShowAdd(true)}>
            <UserPlus className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10" onClick={() => setShowSettings(true)}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
            <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
            <p>No tienes chats aún.</p>
            <Button variant="link" onClick={() => setShowAdd(true)}>¡Añade un amigo!</Button>
          </div>
        ) : (
          <div className="divide-y">
            {chats.map((chat) => (
              <motion.div 
                key={chat.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 p-4 hover:bg-muted/50 active:bg-muted cursor-pointer transition-colors"
                onClick={() => setLocation(`/chat/${chat.id}`)}
              >
                <img 
                  src={chat.avatar} 
                  className="w-12 h-12 rounded-full object-cover border border-border" 
                  alt={chat.name} 
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="font-semibold truncate">{chat.name}</h3>
                    {chat.lastMessageTime && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {chat.lastMessage || "Empezar chat..."}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <UserSettingsModal open={showSettings} onOpenChange={setShowSettings} />
      <GroupMenuModal open={showGroups} onOpenChange={setShowGroups} />
      <AddFriendModal open={showAdd} onOpenChange={setShowAdd} />
      <ReportsModal open={showReports} onOpenChange={setShowReports} />
    </MobileLayout>
  );
}

// Importing helper icon for admin check
import { ShieldAlert } from "lucide-react";
