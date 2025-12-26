import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { MobileLayout } from "@/components/mobile-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle, Lock } from "lucide-react";
import { motion } from "framer-motion";

const ADMIN_ID = "12345670";
const ADMIN_PASSWORD = "1324567";

export default function LoginPage() {
  const { login, currentUser } = useStore();
  const [, setLocation] = useLocation();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<{ name: string; id: string }>();
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  React.useEffect(() => {
    if (currentUser) {
      setLocation("/contacts");
    }
  }, [currentUser, setLocation]);

  const onSubmit = (data: { name: string; id: string }) => {
    setLoginError("");
    
    // If trying to login as admin, require password
    if (data.id === ADMIN_ID) {
      if (!adminPassword) {
        setLoginError("Se requiere código de administrador");
        setShowAdminPassword(true);
        return;
      }
      if (adminPassword !== ADMIN_PASSWORD) {
        setLoginError("Código de administrador incorrecto");
        setAdminPassword("");
        return;
      }
    }
    
    login(data.name, data.id);
    reset();
    setAdminPassword("");
    setShowAdminPassword(false);
  };

  return (
    <MobileLayout className="bg-slate-900 text-white flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="bg-primary/20 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
             <MessageCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">MyMsg Pro</h1>
          <p className="text-slate-400">Inicia sesión para chatear</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {loginError && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg text-sm">
              {loginError}
            </div>
          )}
          
          <div className="space-y-2">
            <Input 
              {...register("name", { required: true })}
              placeholder="Nombre" 
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12"
            />
          </div>
          <div className="space-y-2">
            <Input 
              {...register("id", { required: true })}
              type="text"
              placeholder="ID de Usuario" 
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12"
            />
          </div>
          
          {showAdminPassword && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 pt-2 border-t border-slate-700">
              <label className="text-sm flex items-center gap-2 text-yellow-300">
                <Lock className="h-4 w-4" /> Código de Administrador Requerido
              </label>
              <Input 
                type="password"
                placeholder="Ingresa el código"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12"
              />
            </motion.div>
          )}
          
          <Button type="submit" className="w-full h-12 text-lg font-medium shadow-lg shadow-primary/20">
            ENTRAR
          </Button>
        </form>
      </motion.div>
    </MobileLayout>
  );
}
