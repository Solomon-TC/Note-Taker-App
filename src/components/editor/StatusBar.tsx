"use client";

import React from "react";
import { Editor } from "@tiptap/react";
import { CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";

interface StatusBarProps {
  editor: Editor;
  saveStatus?: "saved" | "saving" | "error" | "unsaved";
  lastSaved?: Date | null;
}

const StatusBar = ({
  editor,
  saveStatus = "saved",
  lastSaved,
}: StatusBarProps) => {
  if (!editor) {
    return null;
  }

  const characterCount = editor.storage.characterCount?.characters() || 0;
  const wordCount = editor.storage.characterCount?.words() || 0;

  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case "saving":
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case "saved":
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case "error":
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      case "unsaved":
        return <Clock className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case "saving":
        return "Saving...";
      case "saved":
        return lastSaved
          ? `Saved ${lastSaved.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "Saved";
      case "error":
        return "Save failed - retrying...";
      case "unsaved":
        return "Unsaved changes";
      default:
        return "";
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground border-t bg-background/50">
      <div className="flex items-center gap-4">
        <span>{wordCount} words</span>
        <span>{characterCount} characters</span>
      </div>

      <div className="flex items-center gap-1">
        {getSaveStatusIcon()}
        <span>{getSaveStatusText()}</span>
      </div>
    </div>
  );
};

export default StatusBar;
