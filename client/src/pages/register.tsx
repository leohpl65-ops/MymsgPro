import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
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

  const onSubmit = async (data: { name: string; password: string }) => {
    setRegisterError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...data,
          language: navigator.language,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "No se pudo crear la cuenta");

      // The server creates the ID and stores only a password hash.
      localStorage.setItem(`mymsg_user_${result.user.id}`, JSON.stringify(result.user));
      await login(result.user.name, result.user.id, "");
      if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission().catch(() => {});
      }
      setLocation("/contacts");
    } catch (error: any) {
      setRegisterError(error.message || "No se pudo crear la cuenta");
    }
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
          <div className="w-10 h-10 ml-2">
             <img src="/logo.png" alt="MyMsg Logo" className="w-full h-full object-contain rounded-xl shadow-sm" />
          </div>
          <h1 className="text-xl font-bold ml-2">Crear Cuenta</h1>
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
