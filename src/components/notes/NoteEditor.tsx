"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Save,
  Eye,
  Users,
  Download,
  Maximize,
  Minimize,
} from "lucide-react";
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
import { PageVisibility, DEFAULT_PAGE_VISIBILITY } from "@/types/page";
import { generateAdvancedNotePDF } from "@/lib/pdf-generator";

interface NoteEditorProps {
  pageId?: string;
  initialTitle?: string;
  initialContent?: any; // Now expects Tiptap JSON
  initialVisibility?: PageVisibility;
  sectionId?: string;
  parentPageId?: string;
  className?: string;
  onSave?: (page: {
    id: string;
    title: string;
    content: string;
    contentJson: TiptapDocument;
    visibility: PageVisibility;
    sectionId?: string;
    parentPageId?: string;
  }) => Promise<void>;
  onTitleChange?: (title: string) => void;
  onAutoSave?: (page: {
    id: string;
    title: string;
    content: string;
    contentJson: TiptapDocument;
    visibility: PageVisibility;
    sectionId?: string;
    parentPageId?: string;
  }) => Promise<void>;
}

const NoteEditor = ({
  pageId = "",
  initialTitle = "Untitled Page",
  initialContent,
  initialVisibility = DEFAULT_PAGE_VISIBILITY,
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
  const [visibility, setVisibility] =
    useState<PageVisibility>(initialVisibility);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "error" | "unsaved"
  >("saved");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<TiptapDocument | null>(null);
  const initialDataRef = useRef({
    title: initialTitle,
    content: safeJsonParse(initialContent),
  });
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

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
            visibility: visibility,
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
  );

  // Handle visibility changes with immediate save
  const handleVisibilityChange = async (checked: boolean) => {
    const newVisibility: PageVisibility = checked ? "friends" : "private";
    setVisibility(newVisibility);
    
    // Immediately save the visibility change
    if (pageId && onAutoSave) {
      try {
        setSaveStatus("saving");
        await onAutoSave({
          id: pageId,
          title: title,
          content: extractPlainText(content),
          contentJson: content,
          visibility: newVisibility,
          sectionId,
          parentPageId,
        });
        setSaveStatus("saved");
        setLastSaved(new Date());
        
        // Update the initial data reference to prevent it from being marked as unsaved
        initialDataRef.current = {
          title: title,
          content: content,
        };
        
        console.log("Visibility change saved successfully:", newVisibility);
      } catch (error) {
        console.error("Failed to save visibility change:", error);
        setSaveStatus("error");
        // Revert the visibility change on error
        setVisibility(visibility);
      }
    }
  };

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
    setVisibility(initialVisibility || DEFAULT_PAGE_VISIBILITY);
    initialDataRef.current = {
      title: initialTitle || "Untitled Page",
      content: finalContent,
    };
    lastSavedContentRef.current = finalContent;
    setSaveStatus("saved");
    setHasUnsavedChanges(false);
    setLastSaved(new Date());
  }, [pageId, initialTitle, initialContent, initialVisibility]); // Include all props to ensure proper updates

  // Track unsaved changes using deep equality
  useEffect(() => {
    const hasChanges =
      title !== initialDataRef.current.title ||
      !deepEqual(content, initialDataRef.current.content) ||
      visibility !== initialVisibility;

    if (hasChanges !== hasUnsavedChanges) {
      setHasUnsavedChanges(hasChanges);
      if (hasChanges && saveStatus === "saved") {
        setSaveStatus("unsaved");
      }
    }
  }, [
    title,
    content,
    visibility,
    initialVisibility,
    hasUnsavedChanges,
    saveStatus,
  ]);

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
    debouncedAutoSave.current(content, title, pageId);
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
        visibility: visibility,
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

  const handleDownloadPDF = useCallback(async () => {
    try {
      console.log("Generating PDF for note:", {
        pageId,
        title,
        contentNodes: content.content?.length || 0,
        contentStructure: content,
      });

      // Validate content structure before PDF generation
      if (!content || !content.content || content.content.length === 0) {
        console.warn("No content to generate PDF");
        alert("Cannot generate PDF: The note appears to be empty.");
        return;
      }

      // Check if content has actual text content
      const plainText = extractPlainText(content);
      if (!plainText.trim()) {
        console.warn("No text content found for PDF generation");
        alert("Cannot generate PDF: The note contains no text content.");
        return;
      }

      console.log("PDF content validation:", {
        hasContent: !!content,
        hasContentArray: !!content.content,
        contentLength: content.content?.length || 0,
        plainTextLength: plainText.length,
        plainTextPreview: plainText.substring(0, 100),
      });

      // Show loading state briefly
      const loadingToast = document.createElement("div");
      loadingToast.textContent = "Generating PDF with images...";
      loadingToast.className = "fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg z-50";
      document.body.appendChild(loadingToast);

      // Generate PDF with images (async)
      try {
        const result = await generateAdvancedNotePDF({
          title: title || "Untitled Note",
          content: content,
          filename: `${(title || "untitled_note").replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
        });

        // Remove loading toast
        if (document.body.contains(loadingToast)) {
          document.body.removeChild(loadingToast);
        }

        if (result.success) {
          console.log("PDF generated successfully:", result.filename);
          
          // Show success message
          const successToast = document.createElement("div");
          successToast.textContent = `PDF downloaded: ${result.filename}`;
          successToast.className = "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50";
          document.body.appendChild(successToast);
          setTimeout(() => {
            if (document.body.contains(successToast)) {
              document.body.removeChild(successToast);
            }
          }, 3000);
        } else {
          console.error("PDF generation failed:", result.error);
          alert(`Failed to generate PDF: ${result.error}`);
        }
      } catch (pdfError) {
        // Remove loading toast
        if (document.body.contains(loadingToast)) {
          document.body.removeChild(loadingToast);
        }
        
        console.error("PDF generation error:", pdfError);
        alert(`Error generating PDF: ${pdfError instanceof Error ? pdfError.message : "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error in PDF download handler:", error);
      alert(`Error generating PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [title, content, pageId]);

  // Fullscreen functionality
  const handleToggleFullscreen = useCallback(async () => {
    if (!fullscreenContainerRef.current) {
      console.error("Fullscreen container ref not available");
      return;
    }

    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        console.log("Entering fullscreen mode");
        await fullscreenContainerRef.current.requestFullscreen();
      } else {
        // Exit fullscreen
        console.log("Exiting fullscreen mode");
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Error toggling fullscreen:", error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Fullscreen not supported or failed: ${errorMessage}`);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      console.log("Fullscreen state changed:", isCurrentlyFullscreen);
      setIsFullscreen(isCurrentlyFullscreen);
    };

    const handleFullscreenError = (event: Event) => {
      console.error("Fullscreen error:", event);
      setIsFullscreen(false);
    };

    // Add event listeners for fullscreen changes
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("fullscreenerror", handleFullscreenError);

    // Cleanup event listeners
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("fullscreenerror", handleFullscreenError);
    };
  }, []);

  // Check if Fullscreen API is supported
  const isFullscreenSupported = useCallback(() => {
    return !!(
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled
    );
  }, []);

  return (
    <div 
      ref={fullscreenContainerRef}
      className={`w-full h-full flex flex-col bg-background ${className} ${
        isFullscreen ? 'fixed inset-0 z-50' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <Input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-2xl font-bold border-none focus-visible:ring-0 px-0 h-auto bg-transparent flex-1"
              placeholder="Untitled page"
            />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {visibility === "private" ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <Users className="h-3 w-3" />
                )}
                <span className="text-sm font-medium text-muted-foreground">
                  {visibility === "private" ? "Private" : "Friends"}
                </span>
              </div>
              <Switch
                checked={visibility === "friends"}
                onCheckedChange={handleVisibilityChange}
              />
            </div>
          </div>
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
            onClick={handleDownloadPDF}
            className="sleek-button p-2"
            title="Download as PDF"
          >
            <Download className="h-4 w-4" />
          </Button>
          {isFullscreenSupported() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleFullscreen}
              className="sleek-button p-2"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || saveStatus === "saving"}
            className="sleek-button p-2"
          >
            {isSaving || saveStatus === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-auto">
        <div className={`${isFullscreen ? 'w-full min-h-full' : 'max-w-4xl mx-auto p-6'} ${isFullscreen ? 'flex flex-col' : ''}`}>
          <TiptapEditor
            key={`tiptap-editor-${pageId}`} // CRITICAL: Force remount for each page
            content={content}
            onChange={handleContentChange}
            onTitleChange={handleEditorTitleChange}
            noteId={pageId}
            placeholder="Start typing..."
            className={`w-full ${isFullscreen ? 'flex-1 p-6' : ''}`}
          />
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;