import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { MobileLayout } from "@/components/mobile-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle, Lock } from "lucide-react";
import { motion } from "framer-motion";

const OWNER_ID = "12345670";
const OWNER_PASSWORD = "12345670";
const ADMIN_PASSWORD = "13245670";

const MODERATOR_ID = "Owner333";
const MODERATOR_PASSWORD = "334466";

export default function LoginPage() {
  const { login, currentUser, verifyPassword } = useStore();
  const [, setLocation] = useLocation();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<{ id: string; password: string }>();
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  React.useEffect(() => {
    if (currentUser) {
      setLocation("/contacts");
    }
  }, [currentUser, setLocation]);

  const [loginAttempts, setLoginAttempts] = useState(() => {
    const saved = localStorage.getItem("mymsg_login_attempts");
    if (saved) {
      const { count, timestamp } = JSON.parse(saved);
      if (Date.now() - timestamp > 180000) return 0; // 3 min reset
      return count;
    }
    return 0;
  });

  const onSubmit = (data: { id: string; password: string }) => {
    setLoginError("");
    
    if (loginAttempts >= 7) {
      const saved = JSON.parse(localStorage.getItem("mymsg_login_attempts") || "{}");
      const timeLeft = Math.ceil((180000 - (Date.now() - saved.timestamp)) / 1000);
      if (timeLeft > 0) {
        setLoginError(`Demasiados intentos. Espera ${Math.ceil(timeLeft/60)} minutos.`);
        return;
      } else {
        setLoginAttempts(0);
        localStorage.removeItem("mymsg_login_attempts");
      }
    }
    
    // If trying to login as Owner/Admin, require admin password
    if (data.id === OWNER_ID) {
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
    } else if (data.id === MODERATOR_ID) {
      if (data.password !== MODERATOR_PASSWORD) {
        setLoginError("Contraseña incorrecta para moderador");
        return;
      }
      login("Moderador", MODERATOR_ID, MODERATOR_PASSWORD);
      localStorage.removeItem("mymsg_login_attempts");
      reset();
      return;
    }
    
    // Verify user password
    if (!verifyPassword(data.id, data.password)) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      localStorage.setItem("mymsg_login_attempts", JSON.stringify({ count: newAttempts, timestamp: Date.now() }));
      setLoginError("Contraseña incorrecta");
      return;
    }
    
    // Get existing user name from localStorage if possible
    let existingName = "Usuario";
    const savedUser = localStorage.getItem(`mymsg_user_${data.id}`);
    
    try {
      const finalName = data.id === OWNER_ID ? "Owner" : (savedUser ? JSON.parse(savedUser).name : existingName);
      login(finalName, data.id, data.password);
      localStorage.removeItem("mymsg_login_attempts");
      reset();
      setAdminPassword("");
      setShowAdminPassword(false);
    } catch (e: any) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      localStorage.setItem("mymsg_login_attempts", JSON.stringify({ count: newAttempts, timestamp: Date.now() }));
      setLoginError(e.message || "Error al iniciar sesión");
    }
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
          {loginAttempts > 0 && (
            <p className="text-xs text-orange-400 font-bold">Intentos fallidos: {loginAttempts}/7</p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {loginError && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg text-sm">
              {loginError}
            </div>
          )}
          
          <div className="space-y-2">
            <Input 
              {...register("id", { required: true })}
              type="text"
              placeholder="ID de Usuario" 
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

          <div className="text-center pt-2">
            <p className="text-sm text-slate-400">
              ¿no tienes cuenta de mymsg?{" "}
              <button 
                type="button" 
                onClick={() => setLocation("/register")}
                className="text-blue-400 font-semibold"
              >
                Crea una cuenta!
              </button>
            </p>
          </div>
        </form>
      </motion.div>
    </MobileLayout>
  );
}
