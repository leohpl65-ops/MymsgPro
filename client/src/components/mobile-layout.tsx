import React from "react";
import { cn } from "@/lib/utils";

interface MobileLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function MobileLayout({ children, className, ...props }: MobileLayoutProps) {
  return (
    <div 
      className={cn(
        "flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-background overflow-hidden shadow-2xl relative",
        className
      )} 
      {...props}
    >
      {children}
    </div>
  );
}
