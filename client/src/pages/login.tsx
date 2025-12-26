import React from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { MobileLayout } from "@/components/mobile-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { login, currentUser } = useStore();
  const [, setLocation] = useLocation();
  const { register, handleSubmit, formState: { errors } } = useForm<{ name: string; id: string }>();

  React.useEffect(() => {
    if (currentUser) {
      setLocation("/contacts");
    }
  }, [currentUser, setLocation]);

  const onSubmit = (data: { name: string; id: string }) => {
    login(data.name, data.id);
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
              type="number"
              placeholder="ID de Usuario" 
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12"
            />
          </div>
          
          <Button type="submit" className="w-full h-12 text-lg font-medium shadow-lg shadow-primary/20">
            ENTRAR
          </Button>
        </form>
      </motion.div>
    </MobileLayout>
  );
}
