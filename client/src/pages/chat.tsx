import React, { useState, useRef, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useStore } from "@/lib/store";
import { MobileLayout } from "@/components/mobile-layout";
import { OfflineBanner } from "@/components/offline-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Send,
  Mic,
  MicOff,
  PhoneOff,
  Phone,
  Image as ImageIcon,
  Smile,
  Settings,
  Flag,
  Wallpaper,
  X,
  RotateCcw,
  Share2,
  Reply,
  Trash2,
  LogOut,
  Copy,
  PlusCircle,
  Check,
  CheckCheck,
  Clock,
  Paperclip,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const [, params] = useRoute("/chat/:id");
  const [, setLocation] = useLocation();
  const {
    chats,
    currentUser,
    sendMessage,
    getChat,
    reportEntity,
    setChatWallpaper,
    forgetChat,
    clearChatMessages,
    deleteMessage,
    replyToMessage,
    forwardMessage,
    markChatAsRead,
    updateGroup,
    addContact,
  } = useStore();

  const chatId = params?.id;
  const chat = chats.find((c) => c.id === chatId);

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
  const [messageToForward, setMessageToForward] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCallScreen, setShowCallScreen] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isCallAccepted, setIsCallAccepted] = useState(false);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [callPeer, setCallPeer] = useState<{
    id: string;
    name: string;
    avatar: string;
  } | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showAiCommands, setShowAiCommands] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Call Signaling via Firebase
  useEffect(() => {
    if (!currentUser || !chat || chat.type !== "direct") return;

    let unsubscribe = () => {};

    import("firebase/database").then(({ ref, onValue, set, onDisconnect }) => {
      import("@/lib/firebase").then(({ db }) => {
        const myCallRef = ref(db, `calls/${currentUser.id}`);

        unsubscribe = onValue(myCallRef, (snapshot) => {
          if (snapshot.exists()) {
            const callData = snapshot.val();
            if (
              callData.type === "offer" &&
              callData.from !== currentUser.id &&
              callData.chatId === chat.id
            ) {
              setCallPeer({
                id: callData.from,
                name: callData.fromName,
                avatar: callData.fromAvatar,
              });
              setIsReceivingCall(true);
              setIsCalling(false);
              setShowCallScreen(true);
              // Save the offer SDP temporarily to use it when accepting
              if (callData.sdp) {
                window.localStorage.setItem(
                  "mymsg_incoming_offer",
                  callData.sdp,
                );
              }

              if (
                "Notification" in window &&
                Notification.permission === "granted" &&
                document.hidden
              ) {
                try {
                  const notification = new Notification(
                    `¡Tienes una llamada!`,
                    {
                      body: `${callData.fromName} te está llamando...`,
                      icon: callData.fromAvatar,
                    },
                  );
                  notification.onclick = function (event) {
                    event.preventDefault();
                    window.focus();
                  };

                  // Play a sound if possible
                  try {
                    const audio = new Audio('/ringtone.mp3'); 
                    audio.play().catch(e => console.log('Audio play failed:', e));
                  } catch(e) {}

                } catch (e) {
                  console.warn("Notification error:", e);
                }
              }
            } else if (
              callData.type === "accept" &&
              callData.to === currentUser.id &&
              callData.sdp
            ) {
              setIsCalling(true);
              setIsCallAccepted(true);
              if (
                peerConnectionRef.current &&
                peerConnectionRef.current.signalingState !== "closed"
              ) {
                peerConnectionRef.current
                  .setRemoteDescription(
                    new RTCSessionDescription({
                      type: "answer",
                      sdp: callData.sdp,
                    }),
                  )
                  .catch((e) =>
                    console.error("Error setting remote description", e),
                  );
              }
            } else if (
              callData.type === "candidate" &&
              callData.to === currentUser.id
            ) {
              if (
                peerConnectionRef.current &&
                peerConnectionRef.current.remoteDescription &&
                peerConnectionRef.current.signalingState !== "closed"
              ) {
                peerConnectionRef.current
                  .addIceCandidate(
                    new RTCIceCandidate(JSON.parse(callData.candidate)),
                  )
                  .catch((e) => console.error("Error adding ice candidate", e));
              }
            } else if (callData.type === "reject") {
              import("@/hooks/use-toast").then(({ toast }) => {
                toast({
                  description: "Llamada rechazada",
                  variant: "destructive",
                });
              });
              if (chat) {
                saveCallToHistory(
                  callPeer?.id || callData.to,
                  callPeer?.name || chat.name,
                  callPeer?.avatar || chat.avatar || "",
                  "rejected",
                  "outgoing",
                );
              }
              setShowCallScreen(false);
              setIsCalling(false);
              set(myCallRef, null);
            } else if (callData.type === "end") {
              if (chat) {
                saveCallToHistory(
                  callPeer?.id || callData.from,
                  callPeer?.name || chat.name,
                  callPeer?.avatar || chat.avatar || "",
                  isCallAccepted ? "answered" : "missed",
                  isReceivingCall ? "incoming" : "outgoing",
                  callDuration,
                );
              }
              setShowCallScreen(false);
              setIsCalling(false);
              setIsCallAccepted(false);
              setIsReceivingCall(false);
              set(myCallRef, null);

              if (localStreamRef.current) {
                localStreamRef.current
                  .getTracks()
                  .forEach((track) => track.stop());
                localStreamRef.current = null;
              }
              if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
              }
            }
          }
        });
      });
    });

    return () => unsubscribe();
  }, [currentUser, chat]);

  const saveCallToHistory = (
    peerId: string,
    peerName: string,
    peerAvatar: string,
    status: "missed" | "rejected" | "answered",
    direction: "incoming" | "outgoing",
    duration?: number,
  ) => {
    if (!currentUser) return;
    try {
      const historyStr = localStorage.getItem(
        `mymsg_call_history_${currentUser.id}`,
      );
      const history = historyStr ? JSON.parse(historyStr) : [];
      const newCall = {
        id: Date.now().toString(),
        peerId,
        peerName,
        peerAvatar,
        status,
        direction,
        timestamp: Date.now(),
        duration,
      };
      localStorage.setItem(
        `mymsg_call_history_${currentUser.id}`,
        JSON.stringify([newCall, ...history].slice(0, 50)),
      );
    } catch (e) {
      console.error("Error saving call history", e);
    }
  };

  const setupPeerConnection = async (
    recipientId: string,
    isInitiator: boolean,
  ) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          import("firebase/database").then(({ ref, set }) => {
            import("@/lib/firebase").then(({ db }) => {
              set(ref(db, `calls/${recipientId}`), {
                type: "candidate",
                candidate: JSON.stringify(event.candidate),
                to: recipientId,
              }).catch((e) => console.error(e));
            });
          });
        }
      };

      return pc;
    } catch (err) {
      console.error("Error setting up peer connection:", err);
      import("@/hooks/use-toast").then(({ toast }) => {
        toast({
          description: "No se pudo acceder al micrófono para la llamada",
          variant: "destructive",
        });
      });
      return null;
    }
  };

  const initiateCall = async () => {
    if (!currentUser || !chat) return;
    const recipientId = chat.participants.find((p) => p !== currentUser.id);
    if (!recipientId) return;

    // Auto-reply for AI
    if (chat.id === "dm-mymsgai" || chat.participants.includes("mymsgai")) {
      const { toast } = await import("@/hooks/use-toast");
      toast({
        description: "MymsgAI no puede recibir llamadas de voz",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setIsCalling(true);
    setIsReceivingCall(false);
    setShowCallScreen(true);
    setCallPeer({
      id: recipientId,
      name: chat.name,
      avatar: chat.avatar || "",
    });

    const pc = await setupPeerConnection(recipientId, true);
    if (!pc) {
      setShowCallScreen(false);
      setIsCalling(false);
      return;
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      import("firebase/database").then(({ ref, set }) => {
        import("@/lib/firebase").then(({ db }) => {
          set(ref(db, `calls/${recipientId}`), {
            type: "offer",
            from: currentUser.id,
            fromName: currentUser.name,
            fromAvatar: currentUser.avatar,
            chatId: chat.id,
            sdp: offer.sdp,
            timestamp: Date.now(),
          });

          // Also listen to my own call reference for answers/rejections
          const myCallRef = ref(db, `calls/${currentUser.id}`);
          set(myCallRef, {
            type: "calling",
            to: recipientId,
          });

          // Auto-end if not answered in 30s
          setTimeout(() => {
            if (isCalling && !isCallAccepted && chat) {
              saveCallToHistory(
                recipientId,
                chat.name,
                chat.avatar || "",
                "missed",
                "outgoing",
              );
              endCall(recipientId);
            }
          }, 30000);
        });
      });
    } catch (e) {
      console.error("Error creating offer:", e);
    }
  };

  const acceptCall = async () => {
    if (!currentUser || !callPeer) return;
    setIsReceivingCall(false);
    setIsCalling(true);

    const pc = await setupPeerConnection(callPeer.id, false);
    if (!pc) return;

    try {
      const offerSdp = window.localStorage.getItem("mymsg_incoming_offer");
      if (offerSdp) {
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: offerSdp }),
        );
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        import("firebase/database").then(({ ref, set }) => {
          import("@/lib/firebase").then(({ db }) => {
            set(ref(db, `calls/${callPeer.id}`), {
              type: "accept",
              from: currentUser.id,
              to: callPeer.id,
              sdp: answer.sdp,
            });
          });
        });
      }
    } catch (e) {
      console.error("Error accepting call:", e);
    }
  };

  const rejectCall = () => {
    if (!currentUser || !callPeer) return;
    saveCallToHistory(
      callPeer.id,
      callPeer.name,
      callPeer.avatar,
      "rejected",
      "incoming",
    );
    setShowCallScreen(false);
    setIsReceivingCall(false);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    import("firebase/database").then(({ ref, set }) => {
      import("@/lib/firebase").then(({ db }) => {
        set(ref(db, `calls/${callPeer.id}`), {
          type: "reject",
          from: currentUser.id,
          to: callPeer.id,
        });
        set(ref(db, `calls/${currentUser.id}`), null);
      });
    });
  };

  // Listen for the custom event to start call from history
  useEffect(() => {
    // Only set up the listener if chat is available
    if (!chat || !currentUser) return;

    const handleStartCall = (e: CustomEvent) => {
      if (e.detail && e.detail.peerId) {
        // Ensure we are in the correct chat before initiating
        const recipientId = chat?.participants.find(
          (p) => p !== currentUser?.id,
        );
        if (recipientId === e.detail.peerId) {
          initiateCall();
        }
      }
    };

    window.addEventListener(
      "mymsg-start-call",
      handleStartCall as EventListener,
    );
    return () => {
      window.removeEventListener(
        "mymsg-start-call",
        handleStartCall as EventListener,
      );
    };
  }, [chat?.id, currentUser?.id]);

  const endCall = (peerId?: string) => {
    const target = peerId || callPeer?.id;
    if (!currentUser || !target || !chat) return;

    saveCallToHistory(
      target,
      callPeer?.name || chat.name,
      callPeer?.avatar || chat.avatar || "",
      isCallAccepted ? "answered" : "missed",
      isReceivingCall ? "incoming" : "outgoing",
      callDuration,
    );

    setShowCallScreen(false);
    setIsCalling(false);
    setIsCallAccepted(false);
    setIsReceivingCall(false);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    import("firebase/database").then(({ ref, set }) => {
      import("@/lib/firebase").then(({ db }) => {
        set(ref(db, `calls/${target}`), {
          type: "end",
          from: currentUser.id,
        });
        set(ref(db, `calls/${currentUser.id}`), null);
      });
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const micPressRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const longPressTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Redirect if invalid chat
  useEffect(() => {
    if (!chat || !currentUser) {
      setLocation("/contacts");
    }
  }, [chat, currentUser, setLocation]);

  if (!chat || !currentUser) {
    return null;
  }

  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMicMuted;
      });
    }
  }, [isMicMuted]);

  // Formatter for call duration (HH:MM:SS)
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showCallScreen && isCallAccepted) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [showCallScreen, isCallAccepted]);

  const checkAutoAddContact = () => {
    // Automatically add contact if this is a DM and we're sending a message
    if (chat && chat.type === "direct" && currentUser) {
      const recipientId = chat.participants.find((p) => p !== currentUser.id);
      if (recipientId) {
        const existingContacts = JSON.parse(
          localStorage.getItem(`mymsg_contacts_${currentUser.id}`) || "[]",
        );
        if (!existingContacts.includes(recipientId)) {
          // They aren't in contacts, add them now that a message is being sent
          addContact(recipientId, chat.name);
        }
      }
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    checkAutoAddContact();

    if (replyingTo) {
      replyToMessage(chat.id, replyingTo, inputText);
      setReplyingTo(null);
    } else {
      sendMessage(chat.id, inputText, "text");
    }
    setInputText("");
  };

  const uploadAttachment = async (file: Blob, fileName: string, mimeType: string) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });
    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataUrl, fileName, mimeType }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "No se pudo subir el archivo");
    return result;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    checkAutoAddContact();
    const isAudio = file.type.startsWith("audio/");
    const isImage = file.type.startsWith("image/");

    try {
      const result = await uploadAttachment(
        file,
        file.name,
        file.type || "application/octet-stream",
      );
      const messageType = isAudio ? "audio" : isImage ? "image" : "file";
      sendMessage(
        chat.id,
        isAudio ? "Mensaje de voz" : isImage ? "Mensaje de imagen" : file.name,
        messageType,
        result.url,
        undefined,
        result.fileName,
        result.size,
        result.mimeType,
      );
    } catch (error: any) {
      const { toast } = await import("@/hooks/use-toast");
      toast({
        description: error.message || "No se pudo enviar el archivo",
        variant: "destructive",
      });
    }
  };

  const startMicrophone = () => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/wav",
          });
          try {
            const result = await uploadAttachment(audioBlob, "mensaje-de-voz.wav", "audio/wav");
            checkAutoAddContact();
            sendMessage(
              chat.id,
              "Mensaje de voz",
              "audio",
              result.url,
              undefined,
              result.fileName,
              result.size,
              result.mimeType,
            );
          } catch {
            const { toast } = await import("@/hooks/use-toast");
            toast({ description: "No se pudo enviar el audio", variant: "destructive" });
          }
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
      })
      .catch(() => {
        import("@/hooks/use-toast").then(({ toast }) => {
          toast({
            description: "No se pudo acceder al micrófono",
            variant: "destructive",
            duration: 3000,
          });
        });
      });
  };

  const stopMicrophone = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      // Ensure all tracks are stopped immediately
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
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
      "linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)",
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
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0"
          onClick={() => setLocation("/contacts")}
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>

        <img
          src={chat.avatar}
          className="w-10 h-10 rounded-full border border-border object-cover"
        />

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{chat.name}</h2>
          <p className="text-xs text-muted-foreground truncate">
            {chat.type === "group"
              ? `${chat.participants.length} miembros`
              : (() => {
                  const friendId = chat.participants.find(
                    (p) => p !== currentUser?.id,
                  );
                  if (friendId === "mymsgai") return "En línea";

                  try {
                    const friendStr = localStorage.getItem(
                      `mymsg_user_${friendId}`,
                    );
                    if (friendStr) {
                      const friendUser = JSON.parse(friendStr);
                      return (
                        <span className="flex items-center gap-1">
                          {friendUser.status === "online" ? (
                            <span className="text-green-500">En línea</span>
                          ) : (
                            <span className="text-gray-400">Desconectado</span>
                          )}
                          {friendUser.youtubeUrl && (
                            <a
                              href={
                                friendUser.youtubeUrl.startsWith("http")
                                  ? friendUser.youtubeUrl
                                  : `https://youtube.com/${friendUser.youtubeUrl}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-red-600 hover:opacity-80 transition inline-flex"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-3 h-3"
                              >
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                              </svg>
                            </a>
                          )}
                        </span>
                      );
                    }
                  } catch (e) {}

                  return <span className="text-gray-400">Desconectado</span>;
                })()}
          </p>
        </div>

        {chat.type === "direct" &&
          chat.id !== "dm-mymsgai" &&
          !chat.participants.includes("mymsgai") && (
            <Button size="icon" variant="ghost" onClick={initiateCall}>
              <Phone className="h-5 w-5" />
            </Button>
          )}

        {chat.id === "dm-mymsgai" && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowAiCommands(true)}
          >
            <div className="font-bold flex items-center justify-center border-2 border-current rounded-full w-5 h-5 text-xs">
              /
            </div>
          </Button>
        )}

        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </header>

      {/* Fullscreen Image View */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            {/* Header for fullscreen image */}
            <div className="bg-black/60 p-4 flex justify-between items-start w-full absolute top-0 z-50">
              <div className="text-white">
                <p className="text-sm font-medium">Enviada el:</p>
                <p className="text-xs text-white/80">
                  {(() => {
                    const msg = chat.messages.find(
                      (m) =>
                        m.mediaUrl === fullscreenImage ||
                        m.text?.replace("[IMAGE_URL:", "").replace("]", "") ===
                          fullscreenImage,
                    );
                    if (!msg) return "";

                    const msgDate = new Date(msg.timestamp);
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const beforeYesterday = new Date(today);
                    beforeYesterday.setDate(beforeYesterday.getDate() - 2);

                    const timeStr = msgDate.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    if (msgDate.toDateString() === today.toDateString()) {
                      return `Hoy a las ${timeStr}`;
                    } else if (
                      msgDate.toDateString() === yesterday.toDateString()
                    ) {
                      return `Ayer a las ${timeStr}`;
                    } else if (
                      msgDate.toDateString() === beforeYesterday.toDateString()
                    ) {
                      return `Antier a las ${timeStr}`;
                    } else {
                      return `${msgDate.toLocaleDateString()} a las ${timeStr}`;
                    }
                  })()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 rounded-full shrink-0"
                onClick={() => setFullscreenImage(null)}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            <div className="flex-1 flex items-center justify-center p-4 pt-20">
              <img
                src={fullscreenImage}
                alt="Fullscreen"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 relative"
        style={{
          background:
            chat.wallpaper && chat.wallpaper.includes("gradient")
              ? chat.wallpaper
              : chat.wallpaper
                ? `url(${chat.wallpaper})`
                : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!chat.wallpaper && (
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/subtle-grey.png')] z-0" />
        )}

        <div className="relative z-10 flex flex-col gap-2 pb-2">
          {chat.messages
            .filter(
              (msg) =>
                !msg.isDeletedForMe &&
                !(
                  msg.isDeletedForEveryone &&
                  msg.senderId !== currentUser.id &&
                  msg.type !== "system"
                ),
            )
            .map((msg, idx) => {
              const isMe = msg.senderId === currentUser.id;
              const msgDate = new Date(msg.timestamp);
              const prevMsg = idx > 0 ? chat.messages[idx - 1] : null;
              const prevMsgDate = prevMsg ? new Date(prevMsg.timestamp) : null;

              const showDateDivider =
                !prevMsgDate ||
                msgDate.getDate() !== prevMsgDate.getDate() ||
                msgDate.getMonth() !== prevMsgDate.getMonth() ||
                msgDate.getFullYear() !== prevMsgDate.getFullYear();

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

              const handleTouchMove = () => {
                // Si el usuario desliza, cancelamos el timer del toque largo
                handleMouseUp();
              };

              return (
                <React.Fragment key={msg.id}>
                  {showDateDivider && (
                    <div className="flex justify-center my-4">
                      <span className="bg-slate-200/80 backdrop-blur text-slate-600 text-[11px] px-3 py-1 rounded-full shadow-sm">
                        {msgDate.toLocaleDateString([], {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  <motion.div
                    id={`message-${msg.id}`}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2 shadow-sm text-sm break-words relative cursor-pointer transition",
                      isMe
                        ? "bg-primary text-primary-foreground self-end rounded-br-none"
                        : "bg-white text-foreground self-start rounded-bl-none",
                      selectedMessage === msg.id &&
                        "ring-2 ring-primary ring-offset-2 opacity-80",
                    )}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (navigator.vibrate) navigator.vibrate(50);
                      setSelectedMessage(msg.id);
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleMouseDown}
                    onTouchEnd={handleMouseUp}
                    onTouchMove={handleTouchMove}
                  >
                    {!isMe && chat.type === "group" && (
                      <p className="text-[10px] font-bold opacity-70 mb-1">
                        {msg.senderId}
                      </p>
                    )}

                    {msg.type === "text" && (
                      <div className="flex flex-col">
                        {msg.replyTo && (
                          <div
                            className={cn(
                              "text-xs mb-1 px-2 py-1 rounded border-l-2 cursor-pointer opacity-90",
                              isMe
                                ? "bg-primary-foreground/20 border-primary-foreground"
                                : "bg-muted border-primary text-muted-foreground",
                            )}
                            onClick={() => {
                              const targetEl = document.getElementById(
                                `message-${msg.replyTo}`,
                              );
                              if (targetEl) {
                                targetEl.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                                targetEl.classList.add(
                                  "bg-opacity-50",
                                  "ring-2",
                                  "ring-offset-2",
                                  "ring-primary",
                                );
                                setTimeout(() => {
                                  targetEl.classList.remove(
                                    "bg-opacity-50",
                                    "ring-2",
                                    "ring-offset-2",
                                    "ring-primary",
                                  );
                                }, 1500);
                              }
                            }}
                          >
                            {chat.messages.find((m) => m.id === msg.replyTo)
                              ?.text || "Mensaje original"}
                          </div>
                        )}
                        <p>{msg.text}</p>
                      </div>
                    )}

                    {msg.type === "image" && msg.mediaUrl && (
                      <div className="flex flex-col mt-1 mb-1">
                        {msg.replyTo && (
                          <div
                            className={cn(
                              "text-xs mb-1 px-2 py-1 rounded border-l-2 cursor-pointer opacity-90",
                              isMe
                                ? "bg-primary-foreground/20 border-primary-foreground text-primary-foreground"
                                : "bg-muted border-primary text-muted-foreground",
                            )}
                            onClick={() => {
                              const targetEl = document.getElementById(
                                `message-${msg.replyTo}`,
                              );
                              if (targetEl) {
                                targetEl.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                                targetEl.classList.add(
                                  "bg-opacity-50",
                                  "ring-2",
                                  "ring-offset-2",
                                  "ring-primary",
                                );
                                setTimeout(() => {
                                  targetEl.classList.remove(
                                    "bg-opacity-50",
                                    "ring-2",
                                    "ring-offset-2",
                                    "ring-primary",
                                  );
                                }, 1500);
                              }
                            }}
                          >
                            {chat.messages.find((m) => m.id === msg.replyTo)
                              ?.text || "Mensaje original"}
                          </div>
                        )}
                        {msg.text && msg.text.startsWith("[GENERATE_IMAGE:") ? (
                          <div className="bg-muted p-4 rounded-lg flex flex-col items-center justify-center gap-2 border">
                            <ImageIcon className="h-8 w-8 text-muted-foreground animate-pulse" />
                            <p className="text-xs text-muted-foreground text-center">
                              Generando imagen...
                            </p>
                            <p className="text-[10px] text-muted-foreground opacity-50 italic">
                              "{msg.text.substring(16, msg.text.length - 1)}"
                            </p>
                          </div>
                        ) : msg.text && msg.text.startsWith("[IMAGE_URL:") ? (
                          <img
                            src={msg.text
                              .replace("[IMAGE_URL:", "")
                              .replace("]", "")}
                            alt="Imagen generada"
                            className="rounded-lg max-w-full h-auto max-h-[300px] object-contain cursor-pointer active:opacity-80"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullscreenImage(
                                msg.text
                                  .replace("[IMAGE_URL:", "")
                                  .replace("]", ""),
                              );
                            }}
                          />
                        ) : msg.type === "image" && msg.mediaUrl ? (
                          <img
                            src={msg.mediaUrl}
                            alt="Enviada"
                            className="rounded-lg max-w-full h-auto max-h-[300px] object-contain cursor-pointer active:opacity-80"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullscreenImage(msg.mediaUrl || null);
                            }}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap break-words">
                            {msg.text}
                          </p>
                        )}
                      </div>
                    )}

                    {msg.type === "audio" && (
                      <audio
                        controls
                        src={msg.mediaUrl}
                        className="max-w-[200px] h-10 mt-1"
                      />
                    )}

                    {msg.type === "file" && msg.mediaUrl && (
                      <a
                        href={msg.mediaUrl}
                        download={msg.fileName || "archivo"}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3 py-2 mt-1 max-w-[260px]",
                          isMe
                            ? "border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                            : "border-border text-foreground hover:bg-muted",
                        )}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Download className="h-5 w-5 shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {msg.fileName || "Descargar archivo"}
                          </span>
                          {msg.fileSize ? (
                            <span className="block text-[10px] opacity-70">
                              {Math.ceil(msg.fileSize / 1024)} KB
                            </span>
                          ) : null}
                        </span>
                      </a>
                    )}

                    <div className="flex items-center justify-end gap-1 mt-1">
                      <p
                        className={cn(
                          "text-[10px] opacity-70",
                          isMe
                            ? "text-primary-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {isMe && (
                        <div className="flex items-center ml-1">
                          {msg.status === "sent" && !msg.read ? (
                            <span className="text-[10px] text-primary-foreground/70">
                              <Check className="h-3 w-3" />
                            </span>
                          ) : msg.status === "read" || msg.read ? (
                            <span className="text-[10px] text-blue-400 flex">
                              <CheckCheck className="h-3 w-3" />
                            </span>
                          ) : (
                            <span className="text-[10px] text-primary-foreground/70">
                              <Clock className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </React.Fragment>
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowEmojiPicker(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {[
              "😀",
              "😂",
              "😍",
              "🤔",
              "😢",
              "🎉",
              "🔥",
              "💯",
              "👍",
              "👎",
              "💔",
              "😱",
              "😎",
              "🤩",
              "😭",
              "😡",
              "🤔",
              "😴",
              "🤒",
              "🤐",
              "😷",
              "🤒",
              "😻",
              "😼",
              "❤️",
              "💔",
              "🔥",
              "⭐",
              "✨",
            ].map((emoji) => (
              <button
                key={emoji}
                className="text-2xl hover:scale-110 transition"
                onClick={() => {
                  setInputText(inputText + emoji);
                  setShowEmojiPicker(false);
                }}
              >
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
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/20"
          onClick={() => setSelectedMessage(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-2 space-y-1 relative w-full max-w-[250px]"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start text-sm"
              onClick={() => setSelectedMessage(null)}
            >
              <X className="h-4 w-4 mr-2" /> Cerrar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start text-sm"
              onClick={() => {
                setReplyingTo(selectedMessage);
                setSelectedMessage(null);
              }}
            >
              <Reply className="h-4 w-4 mr-2" /> Responder
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start text-sm"
              onClick={async () => {
                const msgToCopy = chat.messages.find(
                  (m) => m.id === selectedMessage,
                );
                if (msgToCopy && msgToCopy.type === "text") {
                  try {
                    await navigator.clipboard.writeText(msgToCopy.text);
                    const { toast } = await import("@/hooks/use-toast");
                    toast({ description: "Mensaje copiado", duration: 2000 });
                  } catch (err) {
                    const { toast } = await import("@/hooks/use-toast");
                    toast({
                      description: "No se pudo copiar",
                      variant: "destructive",
                      duration: 2000,
                    });
                  }
                }
                setSelectedMessage(null);
              }}
            >
              <Copy className="h-4 w-4 mr-2" /> Copiar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start text-sm"
              onClick={() => {
                setMessageToForward(selectedMessage);
                setShowForwardDialog(true);
                setSelectedMessage(null);
              }}
            >
              <Share2 className="h-4 w-4 mr-2" /> Reenviar
            </Button>
            {chat.messages.find((m) => m.id === selectedMessage)?.senderId ===
            currentUser?.id ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start text-sm mt-2 text-orange-600 border-orange-200 hover:bg-orange-50"
                  onClick={() => {
                    deleteMessage(chat.id, selectedMessage);
                    setSelectedMessage(null);
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Eliminar para mi
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full justify-start text-sm"
                  onClick={() => {
                    deleteMessage(chat.id, selectedMessage, true);
                    setSelectedMessage(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar para todos
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start text-sm mt-2 text-orange-600 border-orange-200 hover:bg-orange-50"
                onClick={() => {
                  deleteMessage(chat.id, selectedMessage);
                  setSelectedMessage(null);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Eliminar para mi
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Reply Indicator */}
      {replyingTo && (
        <div className="bg-muted p-2 border-t flex items-center justify-between">
          <div className="flex-1 overflow-hidden pr-2">
            <p className="text-xs text-muted-foreground font-semibold mb-0.5">
              Respondiendo a:
            </p>
            <p className="text-xs truncate opacity-80">
              {chat.messages.find((m) => m.id === replyingTo)?.text}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-background p-3 border-t flex items-end gap-2 sticky bottom-0 z-20">
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-foreground shrink-0 rounded-full relative"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          <Smile className="h-6 w-6" />
        </Button>

        <div className="flex-1 bg-muted rounded-2xl flex items-center px-3 py-1 min-h-[44px]">
          <Input
            className="border-none shadow-none bg-transparent focus-visible:ring-0 px-0 placeholder:text-muted-foreground/70"
            placeholder="Mensaje..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
        </div>

        {inputText.trim() ? (
          <Button
            size="icon"
            className="shrink-0 rounded-full h-11 w-11 shadow-lg"
            onClick={handleSend}
          >
            <Send className="h-5 w-5 ml-0.5" />
          </Button>
        ) : (
          <>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />
            <input
              type="file"
              ref={imageInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileUpload}
            />

            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground shrink-0"
              onClick={() => imageInputRef.current?.click()}
              aria-label="Enviar imagen"
            >
              <ImageIcon className="h-6 w-6" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground shrink-0"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Adjuntar archivo"
            >
              <Paperclip className="h-6 w-6" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "text-muted-foreground shrink-0",
                isRecording && "bg-red-500/20 text-red-600 animate-pulse",
              )}
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
        <DialogContent
          className="sm:max-w-xs"
          aria-describedby="forward-dialog"
        >
          <DialogHeader>
            <DialogTitle>Reenviar a</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {chat.messages.find((m) => m.id === messageToForward) &&
              chat.type === "group" && (
                <div className="text-xs text-muted-foreground mb-3 pb-3 border-b">
                  Este mensaje se reenviará a otros chats/grupos
                </div>
              )}
            {chats
              .filter((c) => c.id !== chatId)
              .map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    if (messageToForward) {
                      forwardMessage(chat.id, messageToForward, c.id);
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

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-xs" aria-describedby="invite-dialog">
          <DialogHeader>
            <DialogTitle>Invitar a Grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {chats.filter(
              (c) =>
                c.type === "direct" &&
                c.id !== "dm-mymsgai" &&
                !c.participants.includes("mymsgai") &&
                !chat.participants.includes(
                  c.participants.find((p) => p !== currentUser?.id) || "",
                ),
            ).length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">
                No hay contactos disponibles para invitar.
              </div>
            )}
            {chats
              .filter(
                (c) =>
                  c.type === "direct" &&
                  !c.participants.includes("mymsgai") &&
                  !chat.participants.includes(
                    c.participants.find((p) => p !== currentUser?.id) || "",
                  ),
              )
              .map((c) => {
                const contactId = c.participants.find(
                  (p) => p !== currentUser?.id,
                );
                if (!contactId) return null;

                return (
                  <Button
                    key={c.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={async () => {
                      import("firebase/database").then(({ ref, update }) => {
                        import("@/lib/firebase").then(({ db }) => {
                          const newParticipants = [
                            ...chat.participants,
                            contactId,
                          ];
                          updateGroup(chat.id, {
                            participants: newParticipants,
                          });
                          update(ref(db, `groups/${chat.id}`), {
                            participants: newParticipants,
                          }).catch((e) => console.error(e));

                          sendMessage(
                            chat.id,
                            `Se ha añadido a ${c.name} al grupo`,
                            "text",
                          );
                          setShowInviteDialog(false);

                          import("@/hooks/use-toast").then(({ toast }) => {
                            toast({
                              description: `${c.name} invitado al grupo`,
                              duration: 2000,
                            });
                          });
                        });
                      });
                    }}
                  >
                    <img src={c.avatar} className="w-5 h-5 rounded-full mr-2" />
                    <span className="text-sm">{c.name}</span>
                  </Button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent
          className="sm:max-w-xs"
          aria-describedby="chat-settings-dialog"
        >
          <DialogHeader>
            <DialogTitle>Ajustes de Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={changeWallpaper}
            >
              <Wallpaper className="mr-2 h-4 w-4" /> Cambiar Fondo
            </Button>

            <div className="p-3 bg-slate-50 rounded-md text-sm border">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                ID:{" "}
                <span className="font-mono text-foreground">
                  {chat.id.replace("dm-", "").replace("group-", "")}
                </span>
              </p>
            </div>

            {chat.type === "group" && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-semibold">Miembros:</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInviteDialog(true)}
                  >
                    <PlusCircle className="h-3 w-3 mr-1" /> Invitar
                  </Button>
                </div>
                <ul className="space-y-2">
                  {chat.participants.map((participantId) => {
                    let displayName = participantId;
                    if (participantId === "mymsgai") {
                      displayName = "MymsgAI";
                    } else {
                      try {
                        const userStr = localStorage.getItem(
                          `mymsg_user_${participantId}`,
                        );
                        if (userStr) {
                          const user = JSON.parse(userStr);
                          displayName = user.name || participantId;
                        }
                      } catch (e) {
                        // ignore
                      }
                    }
                    return (
                      <li key={participantId} className="text-sm">
                        <span className="font-semibold block">
                          {displayName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {participantId}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              onClick={() => {
                clearChatMessages(chat.id);
                setShowSettings(false);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Limpiar Chat
            </Button>

            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => {
                forgetChat(chat.id);
                setLocation("/contacts");
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Olvidar Chat
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:bg-red-50"
              onClick={() => {
                reportEntity(
                  chat.type === "group" ? "Grupo" : "Usuario",
                  chat.id,
                  chat.name,
                );
                setShowSettings(false);
              }}
            >
              <Flag className="mr-2 h-4 w-4" /> Reportar{" "}
              {chat.type === "group" ? "Grupo" : "Usuario"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pantalla de Llamada */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />
      <AnimatePresence>
        {/* AI Commands Dialog */}
        <Dialog open={showAiCommands} onOpenChange={setShowAiCommands}>
          <DialogContent
            className="sm:max-w-xs"
            aria-describedby="ai-commands-dialog"
          >
            <DialogHeader>
              <DialogTitle>Comandos de MymsgAI</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">
                  Generación de Imágenes
                </h3>
                <p className="text-xs text-muted-foreground">
                  Usa este comando para generar imágenes con IA.
                </p>
                <div
                  className="bg-muted p-2 rounded-md text-xs font-mono cursor-pointer hover:bg-muted/80"
                  onClick={() => {
                    setInputText("/image ");
                    setShowAiCommands(false);
                  }}
                >
                  /image [descripción de la imagen]
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">
                  Operaciones Matemáticas
                </h3>
                <p className="text-xs text-muted-foreground">
                  Escribe ecuaciones matemáticas directamente o pide a la IA que
                  las resuelva.
                </p>
                <div
                  className="bg-muted p-2 rounded-md text-xs font-mono cursor-pointer hover:bg-muted/80"
                  onClick={() => {
                    setInputText("20 + 30");
                    setShowAiCommands(false);
                  }}
                >
                  Ejemplo: 20 + 30
                </div>
                <div
                  className="bg-muted p-2 rounded-md text-xs font-mono cursor-pointer hover:bg-muted/80"
                  onClick={() => {
                    setInputText("resuelve 5 * (10 - 2)");
                    setShowAiCommands(false);
                  }}
                >
                  Ejemplo: resuelve 5 * (10 - 2)
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Conversación Normal</h3>
                <p className="text-xs text-muted-foreground">
                  Puedes hacer preguntas, pedir consejos o charlar normalmente.
                  La IA usa el modelo ChatGPT-4o-mini para responderte.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {showCallScreen && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col"
          >
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">
                  {callPeer?.name || chat.name}
                </h2>
                <p className="text-sm text-slate-400">
                  {isReceivingCall
                    ? `${callPeer?.name || chat.name} te está llamando...`
                    : isCalling
                      ? formatDuration(callDuration)
                      : "Llamando..."}
                </p>
              </div>

              <div className="flex gap-4 items-center justify-center">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-700">
                  <img
                    src={currentUser.avatar}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary">
                  <img
                    src={callPeer?.avatar || chat.avatar}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {!isReceivingCall && (
                <div className="mt-auto pt-12 flex gap-6 justify-center w-full max-w-xs mx-auto">
                  <Button
                    size="icon"
                    variant="outline"
                    className={cn(
                      "w-16 h-16 rounded-full border-none shadow-lg",
                      isMicMuted
                        ? "bg-white text-slate-900"
                        : "bg-slate-700/50 text-white hover:bg-slate-700",
                    )}
                    onClick={() => setIsMicMuted(!isMicMuted)}
                  >
                    {isMicMuted ? (
                      <MicOff className="h-6 w-6" />
                    ) : (
                      <Mic className="h-6 w-6" />
                    )}
                  </Button>

                  <Button
                    size="icon"
                    variant="destructive"
                    className="w-16 h-16 rounded-full shadow-lg hover:bg-red-700 bg-red-600 text-white"
                    onClick={() => endCall()}
                  >
                    <PhoneOff className="h-6 w-6" />
                  </Button>
                </div>
              )}

              {isReceivingCall && (
                <div className="mt-auto pt-12 flex gap-8 justify-center w-full max-w-xs mx-auto">
                  <Button
                    size="icon"
                    className="w-16 h-16 rounded-full bg-white hover:bg-slate-200 shadow-lg text-red-500"
                    onClick={rejectCall}
                  >
                    <X className="h-8 w-8" />
                  </Button>

                  <Button
                    size="icon"
                    className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 shadow-lg text-white animate-bounce"
                    onClick={acceptCall}
                  >
                    <Phone className="h-6 w-6" />
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MobileLayout>
  );
}
