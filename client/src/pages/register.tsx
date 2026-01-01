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

  const onSubmit = (data: { name: string; password: string }) => {
    // Generate a numeric ID automatically
    const autoId = Math.floor(10000000 + Math.random() * 90000000).toString();
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
          <div className="space-y-2">
            <Input 
              {...register("name", { required: true })}
              placeholder="Tu Nombre" 
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
