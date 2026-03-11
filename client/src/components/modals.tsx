import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      alert("No te puedes poner ese nombre");
      return;
    }
    
    // Check for inappropriate content
    const reservedNames = ['owner', 'admin', 'administrador', 'root', 'system'];
    if (reservedNames.includes(lowerName)) {
      alert("No te puedes poner ese nombre");
      return;
    }
    
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
          <div className="w-full">
            <Label className="text-xs text-muted-foreground">ID: {currentUser?.id}</Label>
          </div>
          
          <Button onClick={handleSave} className="w-full">Guardar</Button>
          <Button variant="destructive" onClick={logout} className="w-full">
            <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
          </Button>
          
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
              <Button variant="outline" onClick={() => { 
                if (joinGroupId.trim()) {
                  joinGroup(joinGroupId);
                  setJoinGroupId("");
                  onOpenChange(false);
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
  const { addContact, getAllUsers } = useStore();
  const [friendId, setFriendId] = useState("");
  const [error, setError] = useState("");

  const handleAddContact = () => {
    setError("");
    if (!friendId.trim()) return;
    
    // Get user info
    const users = getAllUsers();
    const user = users.get(friendId);
    
    if (!user) {
      setError("Usuario incorrecto o inexistente");
      return;
    }
    
    const success = addContact(friendId, user.name);
    if (success) {
      setFriendId("");
      setError("");
      onOpenChange(false);
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
  const { reports } = useStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Moderator view has access to more messages
  const isModerator = useStore().currentUser?.id === "Owner333";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="reports-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-yellow-600" />
            Panel de Denuncias
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
                
                {expandedId === r.id && r.targetMessages.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t bg-muted/30 p-4 space-y-2 max-h-[250px] overflow-y-auto">
                    <p className="text-xs font-bold text-muted-foreground mb-3">Últimos {r.targetMessages.length} mensajes:</p>
                    {r.targetMessages.map((msg) => (
                      <div key={msg.id} className="bg-background p-2 rounded text-[11px] border-l-2 border-yellow-500">
                        <div className="font-semibold text-[10px] text-muted-foreground mb-1">{msg.senderId}</div>
                        <p className="text-foreground">{msg.text}</p>
                        <span className="text-[9px] text-muted-foreground">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
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
