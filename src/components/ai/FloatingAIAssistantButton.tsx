"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingAIAssistantButtonProps {
  onClick: () => void;
  isOpen?: boolean;
  className?: string;
}

const FloatingAIAssistantButton = ({
  onClick,
  isOpen = false,
  className,
}: FloatingAIAssistantButtonProps) => {
  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed top-4 right-4 z-40 h-12 w-12 rounded-full shadow-lg transition-all duration-200 hover:scale-105",
        isOpen
          ? "bg-primary text-primary-foreground"
          : "bg-background border border-border hover:bg-accent",
        className,
      )}
      size="icon"
    >
      <Brain className={cn("h-6 w-6", isOpen && "animate-pulse")} />
    </Button>
  );
};

export default FloatingAIAssistantButton;
