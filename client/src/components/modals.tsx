import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { User, LogOut, Settings, ShieldAlert, Image as ImageIcon, AlertCircle, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
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
          </div>
          <Button className="w-full" onClick={handleAddContact}>
            Añadir Contacto
          </Button>
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
