import React from "react";
import { cn } from "@/lib/utils";

interface MobileLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function MobileLayout({ children, className, ...props }: MobileLayoutProps) {
  return (
    <div className="min-h-[100dvh] w-full bg-slate-950 flex items-center justify-center p-0 md:p-4 lg:p-8">
      <div 
        className={cn(
          "flex flex-col h-[100dvh] md:h-[850px] md:max-h-[90vh] w-full max-w-md mx-auto bg-background overflow-hidden shadow-2xl relative md:rounded-3xl border-0 md:border-8 border-slate-900",
          className
        )} 
        {...props}
      >
        {children}
      </div>
    </div>
  );
}
