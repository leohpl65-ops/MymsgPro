import React from "react";
import { useStore } from "@/lib/store";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function OfflineBanner() {
  const { isOnline } = useStore();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="bg-yellow-500 text-white px-4 py-3 flex items-center gap-2 text-sm font-medium"
        >
          <WifiOff className="h-4 w-4" />
          No hay conexión WiFi :-( 
        </motion.div>
      )}
    </AnimatePresence>
  );
}
