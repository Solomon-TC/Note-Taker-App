"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Image,
  Mic,
  Save,
  FileText,
  Paperclip,
  Link,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Check,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface NoteEditorProps {
  pageId?: string;
  initialTitle?: string;
  initialContent?: string;
  sectionId?: string;
  parentPageId?: string;
  className?: string;
  onSave?: (page: {
    id: string;
    title: string;
    content: string;
    sectionId?: string;
    parentPageId?: string;
  }) => Promise<void>;
  onTitleChange?: (title: string) => void;
  onAutoSave?: (page: {
    id: string;
    title: string;
    content: string;
    sectionId?: string;
    parentPageId?: string;
  }) => Promise<void>;
}

const NoteEditor = ({
  pageId = "",
  initialTitle = "Untitled Page",
  initialContent = "",
  sectionId = "",
  parentPageId,
  className = "",
  onSave = async () => {},
  onTitleChange = () => {},
  onAutoSave,
}: NoteEditorProps) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("write");
  const [isDragOver, setIsDragOver] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "error" | "unsaved"
  >("saved");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialDataRef = useRef({
    title: initialTitle,
    content: initialContent,
  });

  // Sync with props when page changes
  useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
    initialDataRef.current = { title: initialTitle, content: initialContent };
    setSaveStatus("saved");
    setHasUnsavedChanges(false);
    setLastSaved(new Date());
  }, [initialTitle, initialContent, pageId]);

  // Auto-title functionality
  useEffect(() => {
    if (content && (!title || title === "Untitled Page")) {
      const firstLine = content.split("\n")[0].trim();
      if (firstLine && firstLine.length > 0) {
        const autoTitle = firstLine.substring(0, 100);
        setTitle(autoTitle);
        onTitleChange(autoTitle);
      }
    }
  }, [content, title, onTitleChange]);

  // Track unsaved changes
  useEffect(() => {
    const hasChanges =
      title !== initialDataRef.current.title ||
      content !== initialDataRef.current.content;

    if (hasChanges !== hasUnsavedChanges) {
      setHasUnsavedChanges(hasChanges);
      if (hasChanges && saveStatus === "saved") {
        setSaveStatus("unsaved");
      }
    }
  }, [title, content, hasUnsavedChanges, saveStatus]);

  // Autosave functionality
  useEffect(() => {
    if (!hasUnsavedChanges || !pageId || !onAutoSave) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for autosave (3 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSave();
    }, 3000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [title, content, hasUnsavedChanges, pageId, onAutoSave]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Warn user about unsaved changes before leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleAutoSave = async () => {
    if (!pageId || !onAutoSave || !hasUnsavedChanges) return;

    try {
      setSaveStatus("saving");

      // Auto-generate title from first line if title is empty or default
      let finalTitle = title;
      if (!title || title === "Untitled Page") {
        const firstLine = content.split("\n")[0].trim();
        if (firstLine) {
          finalTitle = firstLine.substring(0, 100);
        }
      }

      await onAutoSave({
        id: pageId,
        title: finalTitle,
        content,
        sectionId,
        parentPageId,
      });

      // Update initial data reference
      initialDataRef.current = { title: finalTitle, content };
      setSaveStatus("saved");
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
    } catch (error) {
      console.error("Auto-save failed:", error);
      setSaveStatus("error");

      // Retry after 10 seconds
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      retryTimeoutRef.current = setTimeout(() => {
        handleAutoSave();
      }, 10000);
    }
  };

  const handleSave = async () => {
    if (!pageId) return;

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      // Auto-generate title from first line if title is empty or default
      let finalTitle = title;
      if (!title || title === "Untitled Page") {
        const firstLine = content.split("\n")[0].trim();
        if (firstLine) {
          finalTitle = firstLine.substring(0, 100); // Limit title length
        }
      }

      await onSave({
        id: pageId,
        title: finalTitle,
        content,
        sectionId,
        parentPageId,
      });

      // Update initial data reference
      initialDataRef.current = { title: finalTitle, content };
      setSaveStatus("saved");
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
    } catch (error) {
      console.error("Save failed:", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFormatText = useCallback(
    (format: string) => {
      if (!editorRef.current) return;

      const textarea = editorRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);

      let formattedText = "";
      let newCursorStart = start;
      let newCursorEnd = start;

      switch (format) {
        case "bold":
          if (selectedText) {
            formattedText = `**${selectedText}**`;
            newCursorStart = start + 2;
            newCursorEnd = start + 2 + selectedText.length;
          } else {
            formattedText = "****";
            newCursorStart = newCursorEnd = start + 2;
          }
          break;
        case "italic":
          if (selectedText) {
            formattedText = `*${selectedText}*`;
            newCursorStart = start + 1;
            newCursorEnd = start + 1 + selectedText.length;
          } else {
            formattedText = "**";
            newCursorStart = newCursorEnd = start + 1;
          }
          break;
        case "underline":
          if (selectedText) {
            formattedText = `_${selectedText}_`;
            newCursorStart = start + 1;
            newCursorEnd = start + 1 + selectedText.length;
          } else {
            formattedText = "__";
            newCursorStart = newCursorEnd = start + 1;
          }
          break;
        case "list":
          const listText = selectedText || "List item";
          // Check if we're at the beginning of a line
          const beforeCursor = content.substring(0, start);
          const needsNewline =
            beforeCursor.length > 0 && !beforeCursor.endsWith("\n");
          formattedText = `${needsNewline ? "\n" : ""}- ${listText}`;
          newCursorStart = start + (needsNewline ? 3 : 2);
          newCursorEnd = newCursorStart + listText.length;
          break;
        case "ordered-list":
          const orderedText = selectedText || "List item";
          const beforeCursorOrdered = content.substring(0, start);
          const needsNewlineOrdered =
            beforeCursorOrdered.length > 0 &&
            !beforeCursorOrdered.endsWith("\n");
          formattedText = `${needsNewlineOrdered ? "\n" : ""}1. ${orderedText}`;
          newCursorStart = start + (needsNewlineOrdered ? 4 : 3);
          newCursorEnd = newCursorStart + orderedText.length;
          break;
        case "h1":
          const h1Text = selectedText || "Heading 1";
          const beforeCursorH1 = content.substring(0, start);
          const needsNewlineH1 =
            beforeCursorH1.length > 0 && !beforeCursorH1.endsWith("\n");
          formattedText = `${needsNewlineH1 ? "\n" : ""}# ${h1Text}`;
          newCursorStart = start + (needsNewlineH1 ? 3 : 2);
          newCursorEnd = newCursorStart + h1Text.length;
          break;
        case "h2":
          const h2Text = selectedText || "Heading 2";
          const beforeCursorH2 = content.substring(0, start);
          const needsNewlineH2 =
            beforeCursorH2.length > 0 && !beforeCursorH2.endsWith("\n");
          formattedText = `${needsNewlineH2 ? "\n" : ""}## ${h2Text}`;
          newCursorStart = start + (needsNewlineH2 ? 4 : 3);
          newCursorEnd = newCursorStart + h2Text.length;
          break;
        case "h3":
          const h3Text = selectedText || "Heading 3";
          const beforeCursorH3 = content.substring(0, start);
          const needsNewlineH3 =
            beforeCursorH3.length > 0 && !beforeCursorH3.endsWith("\n");
          formattedText = `${needsNewlineH3 ? "\n" : ""}### ${h3Text}`;
          newCursorStart = start + (needsNewlineH3 ? 5 : 4);
          newCursorEnd = newCursorStart + h3Text.length;
          break;
        default:
          return;
      }

      const newContent =
        content.substring(0, start) + formattedText + content.substring(end);
      setContent(newContent);

      // Set cursor position after formatting
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorStart, newCursorEnd);
      }, 0);
    },
    [content],
  );

  const handleInsertImage = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) {
              const imageMarkdown = `\n![${file.name}](${result})\n`;
              setContent((prev) => prev + imageMarkdown);
            }
          };
          reader.readAsDataURL(file);
        } else {
          alert("Please select an image file.");
        }
      }
      // Reset the input
      event.target.value = "";
    },
    [],
  );

  const handleInsertImageUrl = useCallback(() => {
    const imageUrl = prompt("Enter image URL:");
    if (imageUrl) {
      const imageMarkdown = `\n![Image](${imageUrl})\n`;
      setContent((prev) => prev + imageMarkdown);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          if (result) {
            const imageMarkdown = `\n![${file.name}](${result})\n`;
            setContent((prev) => prev + imageMarkdown);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const handleInsertLink = useCallback(() => {
    const url = prompt("Enter URL:");
    if (url) {
      const linkText = prompt("Enter link text:") || url;
      const linkMarkdown = `[${linkText}](${url})`;

      if (editorRef.current) {
        const textarea = editorRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent =
          content.substring(0, start) + linkMarkdown + content.substring(end);
        setContent(newContent);

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(
            start + linkMarkdown.length,
            start + linkMarkdown.length,
          );
        }, 0);
      }
    }
  }, [content]);

  const toggleRecording = () => {
    // In a real implementation, this would use the Web Audio API
    setIsRecording(!isRecording);
    if (isRecording) {
      // Simulate adding transcribed text
      setContent(
        content +
          "\n[Transcribed audio: This is a placeholder for voice recording transcription.]\n",
      );
    }
  };

  return (
    <div className={`w-full h-full flex flex-col bg-background ${className}`}>
      {/* Sleek Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex-1">
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold border-none focus-visible:ring-0 px-0 h-auto bg-transparent"
            placeholder="Untitled page"
          />
          {/* Save Status Indicator */}
          <div className="flex items-center gap-2 mt-1">
            {saveStatus === "saving" && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {saveStatus === "saved" && lastSaved && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>
                  Saved{" "}
                  {lastSaved.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            {saveStatus === "error" && (
              <div className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>Save failed - retrying...</span>
              </div>
            )}
            {saveStatus === "unsaved" && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Unsaved changes</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-xs text-muted-foreground">
              Auto-saving enabled
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || saveStatus === "saving"}
            className="sleek-button"
          >
            {isSaving || saveStatus === "saving" ? (
              <span className="flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center">
                <Save className="h-4 w-4 mr-2" />
                Save
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 px-6 py-3 border-b border-border/50 bg-background/50">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFormatText("bold")}
                className="sleek-button h-8 w-8 p-0"
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Bold</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFormatText("italic")}
                className="sleek-button h-8 w-8 p-0"
              >
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Italic</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFormatText("underline")}
                className="sleek-button h-8 w-8 p-0"
              >
                <Underline className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Underline</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Separator orientation="vertical" className="h-6 mx-2" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFormatText("h1")}
                className="sleek-button h-8 w-8 p-0"
              >
                <Heading1 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Heading 1</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFormatText("h2")}
                className="sleek-button h-8 w-8 p-0"
              >
                <Heading2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Heading 2</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFormatText("h3")}
                className="sleek-button h-8 w-8 p-0"
              >
                <Heading3 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Heading 3</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Separator orientation="vertical" className="h-6 mx-2" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFormatText("list")}
                className="sleek-button h-8 w-8 p-0"
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Bullet List</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFormatText("ordered-list")}
                className="sleek-button h-8 w-8 p-0"
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Numbered List</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Separator orientation="vertical" className="h-6 mx-2" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleInsertImage}
                className="sleek-button h-8 w-8 p-0"
              >
                <Image className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Upload Image</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleInsertLink}
                className="sleek-button h-8 w-8 p-0"
              >
                <Link className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Insert Link</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isRecording ? "destructive" : "ghost"}
                size="sm"
                onClick={toggleRecording}
                className={`sleek-button h-8 w-8 p-0 ${isRecording ? "animate-pulse" : ""}`}
              >
                <Mic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isRecording ? "Stop Recording" : "Start Voice Recording"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-6 overflow-hidden">
        <div
          className={`h-full relative ${isDragOver ? "border-2 border-dashed border-primary bg-primary/5 rounded" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Textarea
            ref={editorRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start typing your page content here... You can also drag and drop images!"
            className="h-full w-full border-none focus-visible:ring-0 resize-none bg-transparent text-base leading-relaxed"
          />
          {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded">
              <div className="text-center">
                <Image className="h-12 w-12 mx-auto mb-2 text-primary" />
                <p className="text-primary font-medium">Drop images here</p>
              </div>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          multiple={false}
        />
      </div>
    </div>
  );
};

// Enhanced markdown formatter for preview
const formatMarkdown = (text: string) => {
  let formatted = text
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Italic text
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Underline text
    .replace(/_(.*?)_/g, "<u>$1</u>")
    // Headers
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    // Images
    .replace(
      /!\[(.*?)\]\((.*?)\)/g,
      '<img alt="$1" src="$2" style="max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0;" />',
    )
    // Links
    .replace(
      /\[([^\]]+)\]\(([^\)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: hsl(var(--primary)); text-decoration: underline;">$1</a>',
    );

  // Handle lists more carefully
  const lines = formatted.split("\n");
  const processedLines: string[] = [];
  let inUnorderedList = false;
  let inOrderedList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isUnorderedItem = /^- (.+)/.test(line);
    const isOrderedItem = /^\d+\. (.+)/.test(line);

    if (isUnorderedItem) {
      if (!inUnorderedList) {
        processedLines.push("<ul>");
        inUnorderedList = true;
      }
      if (inOrderedList) {
        processedLines.push("</ol>");
        inOrderedList = false;
      }
      processedLines.push(`<li>${line.replace(/^- /, "")}</li>`);
    } else if (isOrderedItem) {
      if (!inOrderedList) {
        processedLines.push("<ol>");
        inOrderedList = true;
      }
      if (inUnorderedList) {
        processedLines.push("</ul>");
        inUnorderedList = false;
      }
      processedLines.push(`<li>${line.replace(/^\d+\. /, "")}</li>`);
    } else {
      if (inUnorderedList) {
        processedLines.push("</ul>");
        inUnorderedList = false;
      }
      if (inOrderedList) {
        processedLines.push("</ol>");
        inOrderedList = false;
      }
      processedLines.push(line);
    }
  }

  // Close any remaining lists
  if (inUnorderedList) {
    processedLines.push("</ul>");
  }
  if (inOrderedList) {
    processedLines.push("</ol>");
  }

  // Join lines and replace remaining newlines with <br>
  formatted = processedLines.join("\n").replace(/\n/g, "<br>");

  return formatted;
};

// Missing Eye component for the preview tab
function Eye(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default NoteEditor;
