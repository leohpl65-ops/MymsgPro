import React, { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { MobileLayout } from "@/components/mobile-layout";
import { OfflineBanner } from "@/components/offline-banner";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserPlus,
  Settings,
  MessageSquare,
  ShieldAlert,
  PhoneMissed,
  PhoneForwarded,
  PhoneIncoming,
  Phone,
} from "lucide-react";
import {
  UserSettingsModal,
  GroupMenuModal,
  AddFriendModal,
  ReportsModal,
  CallHistoryModal,
  AdminMenuModal,
  AllUsersModal,
} from "@/components/modals";
import { motion } from "framer-motion";

export default function ContactsPage() {
  const { currentUser, chats, isOnline } = useStore();
  const [, setLocation] = useLocation();

  const [showSettings, setShowSettings] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);

  // Redirect if not logged in
  React.useEffect(() => {
    if (!currentUser) {
      setLocation("/");
    }
  }, [currentUser, setLocation]);

  if (!currentUser) {
    return null;
  }

  // Admin & Mod Checks
  const isAdmin = currentUser.id === "12345670";
  const isModerator = currentUser.id === "Owner333";
  const canViewReports = isAdmin || isModerator;

  return (
    <MobileLayout>
      <OfflineBanner />

      {/* Header */}
      <header
        className={`p-4 flex justify-between items-center shadow-sm z-10 ${canViewReports ? "bg-slate-900 text-white border-b-2 border-yellow-500" : "bg-primary text-primary-foreground"}`}
      >
        <h1 className="font-bold text-lg tracking-tight">MyMsg Pro</h1>
        <div className="flex gap-1 items-center">
          {canViewReports && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 hover:bg-white/10 text-yellow-500 flex items-center"
              onClick={() => setShowAdminMenu(true)}
            >
              <span className="font-bold text-xs mr-1">ADMIN</span>
              <ShieldAlert className="h-5 w-5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 hover:bg-white/10 relative"
            onClick={() => setShowCallHistory(true)}
          >
            <Phone className="h-5 w-5" />
            <div className="absolute top-1 right-1 w-2 h-2 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
              <span className="sr-only">Llamadas</span>
            </div>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 hover:bg-white/10"
            onClick={() => setShowGroups(true)}
          >
            <Users className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 hover:bg-white/10"
            onClick={() => setShowAdd(true)}
          >
            <UserPlus className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 hover:bg-white/10"
            onClick={() => setShowSettings(true)}
          >
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
            <Button variant="link" onClick={() => setShowAdd(true)}>
              ¡Añade un amigo!
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {chats.map((chat) => {
              const unreadCount = chat.messages.filter(
                (m) => m.senderId !== currentUser.id && !m.read,
              ).length;
              return (
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
                      <div className="flex items-center gap-2 overflow-hidden w-full">
                        <h3 className="font-semibold truncate max-w-[150px]">
                          {chat.name}
                        </h3>
                        {(() => {
                          let ytUrl = null;
                          if (chat.type === "direct") {
                            const pId = chat.participants.find(
                              (p) => p !== currentUser?.id,
                            );
                            if (pId) {
                              try {
                                const pUser = JSON.parse(
                                  localStorage.getItem(`mymsg_user_${pId}`) ||
                                    "{}",
                                );
                                ytUrl = pUser.youtubeUrl;
                              } catch (e) {}
                            }
                          }
                          if (ytUrl) {
                            return (
                              <a
                                href={
                                  ytUrl.startsWith("http")
                                    ? ytUrl
                                    : `https://youtube.com/${ytUrl}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-red-600 hover:opacity-80 transition shrink-0"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  className="w-3.5 h-3.5"
                                >
                                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                </svg>
                              </a>
                            );
                          }
                          return null;
                        })()}
                        {chat.streak && chat.streak > 0 && (
                          <span className="text-[10px] flex items-center gap-0.5 bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full shrink-0">
                            🔥 {chat.streak}
                          </span>
                        )}
                      </div>
                      {chat.lastMessageTime && (
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                          {new Date(chat.lastMessageTime).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground truncate flex-1">
                        {chat.lastMessage || "Empezar chat..."}
                      </p>
                      {unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center ml-2">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {chat.id.replace("dm-", "").replace("group-", "")}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <UserSettingsModal open={showSettings} onOpenChange={setShowSettings} />
      <GroupMenuModal open={showGroups} onOpenChange={setShowGroups} />
      <AddFriendModal open={showAdd} onOpenChange={setShowAdd} />
      <ReportsModal open={showReports} onOpenChange={setShowReports} />
      <CallHistoryModal
        open={showCallHistory}
        onOpenChange={setShowCallHistory}
      />
      <AdminMenuModal 
        open={showAdminMenu} 
        onOpenChange={setShowAdminMenu}
        onOpenReports={() => setShowReports(true)}
        onOpenAllUsers={() => setShowAllUsers(true)}
      />
      <AllUsersModal 
        open={showAllUsers} 
        onOpenChange={setShowAllUsers} 
      />
    </MobileLayout>
  );
}
