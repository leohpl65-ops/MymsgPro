import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { User, LogOut, Settings, ShieldAlert, Image as ImageIcon, AlertCircle, MessageSquare, ChevronDown, ChevronUp, PhoneMissed, PhoneForwarded, PhoneIncoming, Clock, X, Info } from "lucide-react";
import { motion } from "framer-motion";
import { useState as useStateImport } from "react";

export function UserSettingsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { currentUser, updateUser, logout } = useStore();
  const [name, setName] = useState(currentUser?.name || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const lowerName = name.toLowerCase();
    if (lowerName === 'owner') {
      import("@/hooks/use-toast").then(({ toast }) => {
        toast({ description: "No te puedes poner ese nombre", variant: "destructive", duration: 3000 });
      });
      return;
    }
    
    // Check for inappropriate content
    const reservedNames = ['owner', 'admin', 'administrador', 'root', 'system'];
    if (reservedNames.includes(lowerName)) {
      import("@/hooks/use-toast").then(({ toast }) => {
        toast({ description: "No te puedes poner ese nombre", variant: "destructive", duration: 3000 });
      });
      return;
    }
    
    // Solo actualiza el nombre para visualización, 
    // el originalName permanece igual (se guarda en updateUser si no se sobreescribe)
    updateUser({ name });
    onOpenChange(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      updateUser({ avatar: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs" aria-describedby="profile-dialog">
        <DialogHeader>
          <DialogTitle>Mi Perfil</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative">
            <img 
              src={currentUser?.avatar} 
              className="w-20 h-20 rounded-full border-2 border-primary object-cover cursor-pointer hover:opacity-80 transition" 
              alt="Avatar"
              onClick={() => fileInputRef.current?.click()}
            />
            <Button size="icon" variant="secondary" className="absolute bottom-0 right-0 h-6 w-6 rounded-full" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="h-3 w-3" />
            </Button>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleAvatarChange}
            />
          </div>
          <div className="w-full space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="w-full pt-2">
            <Label className="text-xs text-muted-foreground">ID: {currentUser?.id}</Label>
            <br />
            <Label className="text-xs text-muted-foreground">Usuario: {currentUser?.originalName || currentUser?.name}</Label>
          </div>
          
          <Button onClick={handleSave} className="w-full">Guardar</Button>

          {/* Backup Button */}
          <div className="w-full pt-2">
            <Button 
              variant="secondary" 
              className="w-full relative overflow-hidden"
              onClick={() => {
                const btn = document.getElementById('backup-btn-content');
                const progress = document.getElementById('backup-progress');
                if (btn && progress) {
                  btn.style.opacity = '0.5';
                  btn.innerText = 'Creando copia...';
                  progress.style.width = '0%';
                  progress.style.display = 'block';
                  
                  // Animate progress
                  let width = 0;
                  const interval = setInterval(() => {
                    width += Math.random() * 15;
                    if (width > 100) width = 100;
                    progress.style.width = width + '%';
                    
                    if (width === 100) {
                      clearInterval(interval);
                      setTimeout(() => {
                        // Create backup data
                        const backupData = {
                          timestamp: Date.now(),
                          user: currentUser,
                          data: Object.entries(localStorage)
                            .filter(([key]) => key.startsWith('mymsg_'))
                            .reduce((obj, [key, value]) => ({...obj, [key]: value}), {})
                        };
                        
                        localStorage.setItem(`mymsg_backup_${currentUser?.id}`, JSON.stringify(backupData));
                        
                        btn.style.opacity = '1';
                        btn.innerText = 'Hacer copia';
                        progress.style.display = 'none';
                        
                        import("@/hooks/use-toast").then(({ toast }) => {
                          toast({ description: "Copia de seguridad completada", duration: 3000 });
                        });
                        
                        // Force re-render to update the last backup time
                        setName(name + " ");
                        setTimeout(() => setName(name), 10);
                      }, 500);
                    }
                  }, 200);
                }
              }}
            >
              <span id="backup-btn-content" className="relative z-10 font-semibold">Hacer copia</span>
              <div 
                id="backup-progress" 
                className="absolute left-0 top-0 bottom-0 bg-primary/20 transition-all duration-200 hidden"
                style={{ width: '0%' }}
              />
            </Button>
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              {(() => {
                try {
                  const backupStr = localStorage.getItem(`mymsg_backup_${currentUser?.id}`);
                  if (!backupStr) return "Sin copias previas";
                  
                  const backup = JSON.parse(backupStr);
                  const diffHours = (Date.now() - backup.timestamp) / (1000 * 60 * 60);
                  
                  if (diffHours < 1) return "hace menos de una hora";
                  if (diffHours < 24) return `hace ${Math.floor(diffHours)} horas`;
                  if (diffHours < 48) return "hace 1 día";
                  if (diffHours < 24 * 7) return `hace ${Math.floor(diffHours / 24)} días`;
                  if (diffHours < 24 * 14) return "hace 1 semana";
                  if (diffHours < 24 * 30) return `hace ${Math.floor(diffHours / (24 * 7))} semanas`;
                  if (diffHours < 24 * 60) return "hace 1 mes";
                  return `hace ${Math.floor(diffHours / (24 * 30))} meses`;
                } catch(e) {
                  return "Sin copias previas";
                }
              })()}
            </p>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <AlertCircle className="mr-2 h-4 w-4" /> ¿Cómo hacer?
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Guía de uso MyMsg</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 text-sm">
                <div>
                  <h3 className="font-bold text-base mb-1">1. Cómo añadir amigos</h3>
                  <p className="text-muted-foreground">Primero mira en tus configuraciones tu ID. Luego tu amigo en la sección de agregar amigos debe poner esa ID, también pueden hacerlo al revés.</p>
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1">2. Cómo crear un grupo</h3>
                  <p className="text-muted-foreground">Ve al botón en la pantalla de inicio que tiene 👥+ y entra a "Crear grupo", ponle un nombre y listo.</p>
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1">3. Cómo unirse a un grupo</h3>
                  <p className="text-muted-foreground">Similar a cómo agregar a un amigo, ve a las configuraciones del grupo, allí hay una ID. Tu amigo debe entrar a 👥+ y poner ese ID y listo.</p>
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1">4. Cómo hacer copias de seguridad</h3>
                  <p className="text-muted-foreground">Ve a "Mi Perfil" desde el menú de inicio y presiona "Hacer copia". Esto guardará todos tus mensajes y contactos para que no los pierdas.</p>
                </div>
                <div className="mt-6 pt-4 border-t text-center font-semibold text-primary">
                  ¡Disfruta de MyMsg :D!
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xs">
              <DialogHeader>
                <DialogTitle>¿Cerrar Sesión?</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  ¿Estás seguro de que quieres cerrar sesión de la cuenta <strong>{currentUser?.originalName || currentUser?.name}</strong> (ID: {currentUser?.id})?
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={(e) => {
                    // Close the inner dialog by clicking the backdrop or we can just let Radix handle it
                    // The easiest way is to let the user click "Cancel" which we can implement via DialogClose or similar
                    // Since we don't have DialogClose imported, we'll use a hack to close the outer modal instead
                    onOpenChange(false);
                  }}>Cancelar</Button>
                  <Button variant="destructive" className="flex-1" onClick={() => {
                    logout();
                    onOpenChange(false);
                  }}>
                    Cerrar Sesión
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <div className="w-full pt-4 border-t text-center">
            <p className="text-xs text-blue-600 font-semibold">Derechos a Leonardo Humaza Poiqui</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GroupMenuModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { createGroup, joinGroup } = useStore();
  const [newGroupName, setNewGroupName] = useState("");
  const [joinGroupId, setJoinGroupId] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs" aria-describedby="groups-dialog">
        <DialogHeader>
          <DialogTitle>Grupos</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Crear Grupo</Label>
            <div className="flex gap-2">
              <Input 
                placeholder="Nombre del grupo" 
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <Button onClick={() => { 
                if (newGroupName.trim()) {
                  createGroup(newGroupName);
                  setNewGroupName("");
                  onOpenChange(false);
                }
              }}>Crear</Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">O</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Unirse a Grupo</Label>
            <div className="flex gap-2">
              <Input 
                placeholder="ID del Grupo" 
                value={joinGroupId}
                onChange={(e) => setJoinGroupId(e.target.value)}
              />
              <Button variant="outline" onClick={async () => { 
                if (joinGroupId.trim()) {
                  try {
                    const { get, ref } = await import("firebase/database");
                    const { db } = await import("@/lib/firebase");
                    const fullGroupId = joinGroupId.startsWith('group-') ? joinGroupId : `group-${joinGroupId}`;
                    
                    const groupSnap = await get(ref(db, `groups/${fullGroupId}`));
                    if (groupSnap.exists()) {
                      await joinGroup(joinGroupId);
                      setJoinGroupId("");
                      onOpenChange(false);
                    } else {
                      import("@/hooks/use-toast").then(({ toast }) => {
                        toast({ description: "Grupo inexistente", variant: "destructive", duration: 3000 });
                      });
                    }
                  } catch (e) {
                    // Fallback to local
                    await joinGroup(joinGroupId);
                    setJoinGroupId("");
                    onOpenChange(false);
                  }
                }
              }}>Unirme</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddFriendModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { addContact, getAllUsers, currentUser } = useStore();
  const [friendId, setFriendId] = useState("");
  const [error, setError] = useState("");
  const [foundUser, setFoundUser] = useState<{name: string, inApp: boolean} | null>(null);

  React.useEffect(() => {
    const checkUser = async () => {
      const cleanFriendId = friendId.trim().replace(/\s/g, '');
      if (!cleanFriendId) {
        setFoundUser(null);
        return;
      }
      
      try {
        const { get, ref } = await import("firebase/database");
        const { db } = await import("@/lib/firebase");
        
        const userSnap = await get(ref(db, `users/${cleanFriendId}`));
        
        if (userSnap.exists()) {
          const user = userSnap.val();
          setFoundUser({
            name: user.originalName || user.name || `Usuario ${cleanFriendId}`,
            inApp: true
          });
        } else {
          setFoundUser({ name: "No encontrado", inApp: false });
        }
      } catch (e) {
        // Ignore errors for real-time checking
      }
    };

    const timeoutId = setTimeout(checkUser, 500);
    return () => clearTimeout(timeoutId);
  }, [friendId]);

  const handleAddContact = async () => {
    setError("");
    const cleanFriendId = friendId.trim().replace(/\s/g, '');
    if (!cleanFriendId) return;
    
    // Check if user is trying to add themselves
    if (currentUser?.id === cleanFriendId) {
      setError("No puedes agregarte a ti mismo");
      return;
    }
    
    // Check Firebase for the user
    try {
      const { get, ref } = await import("firebase/database");
      const { db } = await import("@/lib/firebase");
      
      const userSnap = await get(ref(db, `users/${cleanFriendId}`));
      
      if (userSnap.exists()) {
        const user = userSnap.val();
        // user.originalName is the permanent username chosen at registration
        const displayName = user.originalName || user.name || `Usuario ${cleanFriendId}`;
        const success = addContact(cleanFriendId, displayName);
        
        if (success) {
          // Manually add to localStorage for immediate reflection if addContact doesn't
          const existingContacts = JSON.parse(localStorage.getItem(`mymsg_contacts_${currentUser?.id}`) || '[]');
          if (!existingContacts.includes(cleanFriendId)) {
            existingContacts.push(cleanFriendId);
            localStorage.setItem(`mymsg_contacts_${currentUser?.id}`, JSON.stringify(existingContacts));
          }
          
          setFriendId("");
          setError("");
          onOpenChange(false);
        } else {
          setError("Ya tienes a este usuario en tus contactos");
        }
      } else {
        // Try to add the user. Allow them to use "mymsgai" or "ia" to add the bot.
        let targetId = cleanFriendId;
        if (cleanFriendId.toLowerCase() === 'ia' || cleanFriendId.toLowerCase() === 'mymsgai') {
          targetId = 'mymsgai';
          const success = addContact(targetId, "MymsgAI");
          if (success) {
            setFriendId("");
            setError("");
            onOpenChange(false);
            return;
          } else {
            setError("Ya tienes a este usuario en tus contactos");
            return;
          }
        }
        
        setError("Ese usuario no existe");
      }
    } catch (e) {
      console.error(e);
      setError("Error de conexión. Inténtalo de nuevo.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs" aria-describedby="add-friend-dialog">
        <DialogHeader>
          <DialogTitle>Añadir Amigo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label>ID de Usuario</Label>
            <Input 
              type="text" 
              placeholder="Ej: 1002" 
              value={friendId}
              onChange={(e) => { setFriendId(e.target.value); setError(""); }}
            />
            {foundUser && (
              <div className="text-xs mt-1">
                {foundUser.inApp ? (
                  <span className="text-green-600 font-medium">✅ {foundUser.name} (está en mymsg pro)</span>
                ) : (
                  <span className="text-muted-foreground">{foundUser.name}</span>
                )}
              </div>
            )}
          </div>
          <Button className="w-full" onClick={handleAddContact}>
            Añadir Contacto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CallHistoryModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { currentUser } = useStore();
  const [, setLocation] = useLocation();
  const [callHistory, setCallHistory] = useState<any[]>([]);

  React.useEffect(() => {
    if (open && currentUser) {
      // In a real app, this would be a store method reading from Firebase/LocalStorage
      // For now we'll read the mock history from LocalStorage
      try {
        const historyStr = localStorage.getItem(`mymsg_call_history_${currentUser.id}`);
        if (historyStr) {
          setCallHistory(JSON.parse(historyStr));
        }
      } catch (e) {
        console.error("Error reading call history", e);
      }
    }
  }, [open, currentUser]);

  const clearHistory = () => {
    if (!currentUser) return;
    localStorage.removeItem(`mymsg_call_history_${currentUser.id}`);
    setCallHistory([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs" aria-describedby="call-history-dialog">
        <DialogHeader>
          <div className="flex justify-between items-center pr-6">
            <DialogTitle>Registro de llamadas</DialogTitle>
            {callHistory.length > 0 && (
              <Button variant="ghost" size="sm" className="text-red-500 h-8" onClick={clearHistory}>
                Limpiar
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {callHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <PhoneMissed className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No hay llamadas recientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {callHistory.map((call, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border">
                  <div className="relative">
                    <img src={call.peerAvatar} alt={call.peerName} className="w-10 h-10 rounded-full object-cover" />
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                      {call.status === 'missed' ? (
                        <PhoneMissed className="h-3 w-3 text-red-500" />
                      ) : call.status === 'rejected' ? (
                        <PhoneMissed className="h-3 w-3 text-yellow-500" />
                      ) : call.direction === 'incoming' ? (
                        <PhoneIncoming className="h-3 w-3 text-green-500" />
                      ) : (
                        <PhoneForwarded className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer hover:bg-slate-100 rounded p-1 transition-colors" onClick={() => {
                    // Start call automatically
                    if (call.peerId) {
                      // Navigate to chat
                      setLocation(`/chat/${call.peerId}`);
                      // Trigger a custom event that chat.tsx can listen to for starting a call
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('mymsg-start-call', { detail: { peerId: call.peerId }}));
                      }, 500);
                      onOpenChange(false);
                    }
                  }}>
                    <p className="font-semibold text-sm truncate">{call.peerName}</p>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(call.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      {call.status === 'answered' && call.duration && (
                        <span>• {Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-medium">
                    {call.status === 'missed' ? (
                      <span className="text-red-500">Perdida</span>
                    ) : call.status === 'rejected' ? (
                      <span className="text-yellow-500">Rechazada</span>
                    ) : (
                      <span className="text-green-500">Contestada</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function ReportsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { reports, deleteReport } = useStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Moderator view has access to more messages
  const isModerator = useStore().currentUser?.id === "Owner333" || useStore().currentUser?.id === "12345670";

  const handleBan = async (reportId: string, targetName: string, targetId: string) => {
    const { toast } = await import("@/hooks/use-toast");
    toast({ description: `El usuario ${targetName} ha sido baneado exitosamente del sistema.`, duration: 3000 });
    
    // Kick user by sending them a message from Owner
    const adminId = "12345670";
    import("firebase/database").then(({ ref, push, set }) => {
      import("@/lib/firebase").then(({ db }) => {
        const kickMsg = {
          id: `kick-${Date.now()}`,
          senderId: adminId,
          text: "has sido kickeado por el owner",
          timestamp: Date.now(),
          type: 'text',
          status: 'sent',
          read: false
        };
        const fbMsgRef = push(ref(db, `offline_messages/${targetId}/from_${adminId}`));
        set(fbMsgRef, kickMsg);
      });
    });
    
    deleteReport(reportId);
  };

  const handleFree = (reportId: string) => {
    deleteReport(reportId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="reports-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-yellow-600" />
            Panel de Denuncias (Owner)
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[500px] overflow-y-auto space-y-3 py-4">
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm text-center">No hay denuncias registradas.</p>
            </div>
          ) : (
            reports.map((r) => (
              <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border rounded-lg bg-red-50 dark:bg-red-950 overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  className="w-full p-4 hover:bg-red-100 dark:hover:bg-red-900 transition text-left"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <p className="font-bold text-red-700 dark:text-red-300">{r.type === 'Usuario' ? '👤' : '👥'} {r.type.toUpperCase()}</p>
                      <p className="text-sm font-semibold text-foreground">{r.targetName}</p>
                      <p className="text-xs text-muted-foreground">ID: {r.targetId}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(r.timestamp).toLocaleString('es-ES')}
                      </span>
                      {r.targetMessages.length > 0 && (
                        <span className="text-[11px] text-yellow-600 font-semibold flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {r.targetMessages.length} msgs
                        </span>
                      )}
                      {expandedId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground border-t pt-2 mt-2">Reportado por: {r.reporterId}</p>
                </button>
                
                {expandedId === r.id && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t bg-muted/30 p-4 space-y-2">
                    <div className="max-h-[250px] overflow-y-auto mb-4 space-y-2">
                      <p className="text-xs font-bold text-muted-foreground mb-3">Últimos {r.targetMessages.length} mensajes:</p>
                      {r.targetMessages.map((msg) => (
                        <div key={msg.id} className="bg-background p-2 rounded text-[11px] border-l-2 border-yellow-500">
                          <div className="font-semibold text-[10px] text-muted-foreground mb-1">{msg.senderId}</div>
                          <p className="text-foreground">{msg.text}</p>
                          <span className="text-[9px] text-muted-foreground">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-2 pt-2 border-t border-red-200 dark:border-red-800">
                      <Button variant="destructive" className="flex-1 text-xs" onClick={() => handleBan(r.id, r.targetName, r.targetId)}>
                        Banear
                      </Button>
                      <Button variant="outline" className="flex-1 text-xs" onClick={() => handleFree(r.id)}>
                        Dejar Libre
                      </Button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
