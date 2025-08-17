"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, CheckCircle, AlertCircle, Loader2, Save } from "lucide-react";
import TiptapEditor from "@/components/editor/TiptapEditor";
import { storageService } from "@/lib/storage";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  safeJsonParse,
  getDefaultDocument,
  deepEqual,
  debounce,
  extractPlainText,
  type TiptapDocument,
} from "@/lib/editor/json";

interface NoteEditorProps {
  pageId?: string;
  initialTitle?: string;
  initialContent?: any; // Now expects Tiptap JSON
  sectionId?: string;
  parentPageId?: string;
  className?: string;
  onSave?: (page: {
    id: string;
    title: string;
    content: string;
    contentJson: TiptapDocument;
    sectionId?: string;
    parentPageId?: string;
  }) => Promise<void>;
  onTitleChange?: (title: string) => void;
  onAutoSave?: (page: {
    id: string;
    title: string;
    content: string;
    contentJson: TiptapDocument;
    sectionId?: string;
    parentPageId?: string;
  }) => Promise<void>;
}

const NoteEditor = ({
  pageId = "",
  initialTitle = "Untitled Page",
  initialContent,
  sectionId = "",
  parentPageId,
  className = "",
  onSave = async () => {},
  onTitleChange = () => {},
  onAutoSave,
}: NoteEditorProps) => {
  const { user } = useAuth();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState<TiptapDocument>(
    safeJsonParse(initialContent),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "error" | "unsaved"
  >("saved");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<TiptapDocument | null>(null);
  const initialDataRef = useRef({
    title: initialTitle,
    content: safeJsonParse(initialContent),
  });

  // Debounced autosave function with comprehensive error handling and isolation
  const debouncedAutoSave = useRef(
    debounce(
      async (
        contentToSave: TiptapDocument,
        titleToSave: string,
        targetPageId: string,
      ) => {
        // CRITICAL: Always use the targetPageId passed to this function, not the current pageId state
        // This prevents race conditions when switching between pages
        if (!targetPageId || !onAutoSave) {
          console.warn(
            "Autosave skipped: missing targetPageId or onAutoSave function",
          );
          return;
        }

        // Check if content has actually changed since last save
        if (deepEqual(contentToSave, lastSavedContentRef.current)) {
          console.log(
            "Autosave skipped: content unchanged for page:",
            targetPageId,
          );
          return;
        }

        // Validate user authentication
        if (!user) {
          console.error("Autosave failed: user not authenticated");
          setSaveStatus("error");
          return;
        }

        try {
          console.log("Starting autosave for page:", targetPageId);
          setSaveStatus("saving");

          // Validate content structure
          if (
            !contentToSave ||
            typeof contentToSave !== "object" ||
            contentToSave.type !== "doc"
          ) {
            console.error(
              "Invalid content structure for autosave:",
              contentToSave,
            );
            contentToSave = getDefaultDocument();
          }

          // Auto-generate title from first heading/paragraph if title is empty or default
          let finalTitle = titleToSave || "Untitled Page";
          if (
            !titleToSave ||
            titleToSave === "Untitled Page" ||
            titleToSave.startsWith("Untitled Page ")
          ) {
            const firstNode = contentToSave.content?.[0];
            if (
              firstNode &&
              (firstNode.type === "heading" || firstNode.type === "paragraph")
            ) {
              const text = firstNode.content?.[0]?.text || "";
              if (text.trim()) {
                finalTitle = text.substring(0, 100).trim();
              }
            }
          }

          const plainTextContent = extractPlainText(contentToSave);
          console.log("Autosave data:", {
            targetPageId,
            userId: user.id,
            titleLength: finalTitle.length,
            contentLength: plainTextContent.length,
            jsonSize: JSON.stringify(contentToSave).length,
            contentType: typeof contentToSave,
            hasValidStructure: contentToSave.type === "doc",
            contentNodes: contentToSave.content?.length || 0,
          });

          // CRITICAL: Use targetPageId, not pageId state
          await onAutoSave({
            id: targetPageId,
            title: finalTitle,
            content: plainTextContent,
            contentJson: contentToSave,
            sectionId,
            parentPageId,
          });

          console.log("Autosave successful for page:", targetPageId);

          // Only update references if this autosave was for the currently active page
          if (targetPageId === pageId) {
            lastSavedContentRef.current = contentToSave;
            initialDataRef.current = {
              title: finalTitle,
              content: contentToSave,
            };
            setSaveStatus("saved");
            setHasUnsavedChanges(false);
            setLastSaved(new Date());
          }
        } catch (error) {
          console.error("Auto-save failed for page:", targetPageId, error);
          console.error("Error details:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : "No stack trace",
            errorType: typeof error,
            targetPageId,
            currentPageId: pageId,
            userId: user?.id,
            contentValid: contentToSave && typeof contentToSave === "object",
          });

          // Only show error status if this was for the current page
          if (targetPageId === pageId) {
            setSaveStatus("error");
          }

          // Enhanced retry logic with exponential backoff
          const retryDelay = Math.min(10000, 2000);
          setTimeout(() => {
            console.log(
              `Retrying autosave for page ${targetPageId} after ${retryDelay}ms delay`,
            );
            // Only retry if we still have the same content and user is still authenticated
            if (user && targetPageId && deepEqual(contentToSave, content)) {
              debouncedAutoSave.current(
                contentToSave,
                titleToSave,
                targetPageId,
              );
            }
          }, retryDelay);
        }
      },
      1200,
    ),
  ).current;

  // Sync with props when page changes - CRITICAL: Only when pageId actually changes
  useEffect(() => {
    if (!pageId) return; // Don't process if no pageId

    console.log("NoteEditor: Page changed, initializing content:", {
      pageId,
      initialTitle,
      hasInitialContent: !!initialContent,
      contentType: typeof initialContent,
    });

    // CRITICAL: Always start with a completely fresh document for new pages
    // Check if this is a new page by looking at the content
    const processedContent = safeJsonParse(initialContent);

    // For new pages or empty content, always use empty document
    const isNewOrEmptyPage =
      !processedContent.content ||
      processedContent.content.length === 0 ||
      (processedContent.content.length === 1 &&
        processedContent.content[0].type === "paragraph" &&
        (!processedContent.content[0].content ||
          processedContent.content[0].content.length === 0));

    const finalContent = isNewOrEmptyPage
      ? getDefaultDocument()
      : processedContent;

    console.log("NoteEditor: Setting content:", {
      pageId,
      isNewOrEmptyPage,
      finalContentNodes: finalContent.content?.length || 0,
      isEmptyDoc: finalContent.content?.length === 0,
    });

    // Reset all state completely for each page change
    setTitle(initialTitle || "Untitled Page");
    setContent(finalContent);
    initialDataRef.current = {
      title: initialTitle || "Untitled Page",
      content: finalContent,
    };
    lastSavedContentRef.current = finalContent;
    setSaveStatus("saved");
    setHasUnsavedChanges(false);
    setLastSaved(new Date());
  }, [pageId, initialTitle, initialContent]); // Include all props to ensure proper updates

  // Track unsaved changes using deep equality
  useEffect(() => {
    const hasChanges =
      title !== initialDataRef.current.title ||
      !deepEqual(content, initialDataRef.current.content);

    if (hasChanges !== hasUnsavedChanges) {
      setHasUnsavedChanges(hasChanges);
      if (hasChanges && saveStatus === "saved") {
        setSaveStatus("unsaved");
      }
    }
  }, [title, content, hasUnsavedChanges, saveStatus]);

  // Autosave functionality using debounced function with proper page isolation
  useEffect(() => {
    if (!hasUnsavedChanges || !pageId || !onAutoSave) return;

    // CRITICAL: Pass the current pageId to the autosave function to prevent race conditions
    console.log("Triggering autosave for page:", pageId, {
      hasUnsavedChanges,
      titleLength: title.length,
      contentNodes: content.content?.length || 0,
    });

    // Trigger debounced autosave with explicit pageId
    debouncedAutoSave(content, title, pageId);
  }, [
    title,
    content,
    hasUnsavedChanges,
    pageId,
    onAutoSave,
    debouncedAutoSave,
  ]);

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

  // Refresh signed URLs in content when loading
  useEffect(() => {
    const refreshUrls = async () => {
      if (content && user) {
        try {
          const refreshedContent =
            await storageService.refreshSignedUrlsInContent(content);
          if (!deepEqual(refreshedContent, content)) {
            setContent(refreshedContent);
          }
        } catch (error) {
          console.warn("Failed to refresh signed URLs:", error);
        }
      }
    };

    refreshUrls();
  }, [pageId, user]); // Only run when pageId or user changes

  // Remove the local convertTiptapToPlainText function since we're using the one from lib/editor/json.ts

  // Remove the old handleAutoSave function since we're using the debounced version

  const handleSave = async () => {
    if (!pageId) {
      console.error("Cannot save: no page ID");
      return;
    }

    if (!user) {
      console.error("Cannot save: user not authenticated");
      setSaveStatus("error");
      return;
    }

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      // Validate content structure
      const validatedContent = safeJsonParse(content);

      // Auto-generate title from first heading/paragraph if title is empty or default
      let finalTitle = title;
      if (!title || title === "Untitled Page") {
        const firstNode = validatedContent.content?.[0];
        if (
          firstNode &&
          (firstNode.type === "heading" || firstNode.type === "paragraph")
        ) {
          const text = firstNode.content?.[0]?.text || "";
          if (text.trim()) {
            finalTitle = text.substring(0, 100);
          }
        }
      }

      const plainTextContent = extractPlainText(validatedContent);

      console.log("Manual save initiated:", {
        pageId,
        userId: user.id,
        titleLength: finalTitle.length,
        contentLength: plainTextContent.length,
        contentValid: validatedContent.type === "doc",
      });

      await onSave({
        id: pageId,
        title: finalTitle,
        content: plainTextContent,
        contentJson: validatedContent,
        sectionId,
        parentPageId,
      });

      // Update initial data reference
      initialDataRef.current = { title: finalTitle, content: validatedContent };
      lastSavedContentRef.current = validatedContent;
      setSaveStatus("saved");
      setHasUnsavedChanges(false);
      setLastSaved(new Date());

      console.log("Manual save completed successfully for page:", pageId);
    } catch (error) {
      console.error("Manual save failed:", {
        error,
        pageId,
        userId: user?.id,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : "No stack trace",
      });
      setSaveStatus("error");

      // Show user-friendly error message
      if (error instanceof Error && error.message.includes("content_json")) {
        alert(
          "Save failed: Database schema issue detected. Please contact support.",
        );
      } else {
        alert(
          `Save failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    onTitleChange(newTitle);
  };

  const handleContentChange = (newContent: TiptapDocument) => {
    setContent(newContent);
  };

  const handleEditorTitleChange = (newTitle: string) => {
    if (!title || title === "Untitled Page") {
      setTitle(newTitle);
      onTitleChange(newTitle);
    }
  };

  return (
    <div className={`w-full h-full flex flex-col bg-background ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex-1">
          <Input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
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

      {/* Editor Area */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <TiptapEditor
            key={`tiptap-editor-${pageId}`} // CRITICAL: Force remount for each page
            content={content}
            onChange={handleContentChange}
            onTitleChange={handleEditorTitleChange}
            noteId={pageId}
            placeholder="Start typing..."
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;
