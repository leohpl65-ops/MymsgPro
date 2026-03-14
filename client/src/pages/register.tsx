import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { generateUserAvatarSvg } from "@/lib/avatars";
import { MobileLayout } from "@/components/mobile-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const { login } = useStore();
  const [, setLocation] = useLocation();
  const { register, handleSubmit, formState: { errors } } = useForm<{ name: string; password: string }>();

  const [registerError, setRegisterError] = useState("");

  const onSubmit = (data: { name: string; password: string }) => {
    setRegisterError("");
    
    if (data.name.toLowerCase() === 'leo33445') {
      setRegisterError("Este nombre está reservado y no puede ser usado.");
      return;
    }

    // Check if name is already taken
    let nameTaken = false;
    const keys = Object.keys(localStorage);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].startsWith('mymsg_user_') && !keys[i].includes('chats') && !keys[i].includes('reports')) {
        try {
          const u = JSON.parse(localStorage.getItem(keys[i]) || '');
          if ((u.originalName || u.name).toLowerCase() === data.name.toLowerCase()) {
            nameTaken = true;
            break;
          }
        } catch (e) {}
      }
    }
    
    if (nameTaken) {
      setRegisterError("Este nombre ya está en uso. Por favor, elige otro.");
      return;
    }

    // Generate a numeric ID automatically
    const autoId = Math.floor(10000000 + Math.random() * 90000000).toString();
    
    // Register the user in the "database" (localStorage) first
    // Save the originalName to be used always for login
    const user = { 
      id: autoId, 
      name: data.name, 
      originalName: data.name,
      password: data.password, 
      avatar: generateUserAvatarSvg(data.name),
      language: navigator.language.startsWith('es') ? 'es' : 'en'
    };
    localStorage.setItem(`mymsg_user_${autoId}`, JSON.stringify(user));
    
    // Also save to Firebase (strip undefined)
    import('../lib/firebase').then(({ db }) => {
      import('firebase/database').then(({ ref, set }) => {
        set(ref(db, `users/${autoId}`), JSON.parse(JSON.stringify(user))).catch(console.error);
      });
    });
    
    // Then perform login
    login(data.name, autoId, data.password);
    setLocation("/contacts");
  };

  return (
    <MobileLayout className="bg-slate-900 text-white flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full space-y-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-bold">Crear Cuenta</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {registerError && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg text-sm">
              {registerError}
            </div>
          )}
          
          <div className="space-y-2">
            <Input 
              {...register("name", { required: true })}
              placeholder="Tu Nombre de Usuario" 
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12"
            />
          </div>
          <div className="space-y-2">
            <Input 
              {...register("password", { required: true })}
              type="password"
              placeholder="Contraseña" 
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12"
            />
          </div>
          
          <Button type="submit" className="w-full h-12 text-lg font-medium shadow-lg shadow-primary/20">
            CREAR MI CUENTA
          </Button>
        </form>
      </motion.div>
    </MobileLayout>
  );
}
