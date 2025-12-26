import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { User, LogOut, FileText, Settings, ShieldAlert, Image as ImageIcon } from "lucide-react";

export function UserSettingsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { currentUser, updateUser, logout } = useStore();
  const [name, setName] = useState(currentUser?.name || "");

  const handleSave = () => {
    updateUser({ name });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Mi Perfil</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative">
            <img 
              src={currentUser?.avatar} 
              className="w-20 h-20 rounded-full border-2 border-border" 
              alt="Avatar"
            />
            <Button size="icon" variant="secondary" className="absolute bottom-0 right-0 h-6 w-6 rounded-full">
              <ImageIcon className="h-3 w-3" />
            </Button>
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
      <DialogContent className="sm:max-w-xs">
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
              <Button onClick={() => { createGroup(newGroupName); onOpenChange(false); }}>Crear</Button>
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
              <Button variant="outline" onClick={() => { joinGroup(joinGroupId); onOpenChange(false); }}>Unirme</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddFriendModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { addContact } = useStore();
  const [friendId, setFriendId] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Añadir Amigo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>ID de Usuario</Label>
            <Input 
              type="number" 
              placeholder="Ej: 1002" 
              value={friendId}
              onChange={(e) => setFriendId(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={() => { addContact(friendId); onOpenChange(false); }}>
            Añadir Contacto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReportsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { reports } = useStore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Panel de Denuncias</DialogTitle>
        </DialogHeader>
        <div className="max-h-[300px] overflow-y-auto space-y-2">
          {reports.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay denuncias registradas.</p>
          ) : (
            reports.map((r, i) => (
              <div key={i} className="p-3 border rounded-md bg-muted/50 text-sm">
                <div className="flex justify-between font-bold">
                  <span className="text-destructive">{r.type.toUpperCase()}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.timestamp).toLocaleString()}</span>
                </div>
                <div>Target ID: {r.targetId}</div>
                <div className="text-xs text-muted-foreground">Reportado por: {r.reporterId}</div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
