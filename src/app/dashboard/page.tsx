"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import UserMenu from "@/components/auth/UserMenu";
import NotebookDropdown from "@/components/navigation/NotebookDropdown";
import SectionTabs from "@/components/navigation/SectionTabs";
import PageList from "@/components/navigation/PageList";
import NoteEditor from "@/components/notes/NoteEditor";
import AIChatSidebar from "@/components/ai/AIChatSidebar";
import FloatingAIAssistantButton from "@/components/ai/FloatingAIAssistantButton";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Brain, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { Database } from "@/types/supabase";
import {
  safeJsonParse,
  extractPlainText,
  type TiptapDocument,
} from "@/lib/editor/json";

type Notebook = Database["public"]["Tables"]["notebooks"]["Row"];
type Section = Database["public"]["Tables"]["sections"]["Row"];
type Page = Database["public"]["Tables"]["pages"]["Row"];

export default function DashboardPage() {
  const { user, loading, error } = useAuth();
  const router = useRouter();

  // Memoize supabase client to prevent recreation on every render
  const supabase = useMemo(() => createClient(), []);

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(
    null,
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [showPageList, setShowPageList] = useState(false);

  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const dataTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize loadUserData to prevent recreation on every render
  const loadUserData = useCallback(async () => {
    if (!user) {
      setDataLoading(false);
      return;
    }

    try {
      setDataLoading(true);
      setDataError(null);

      // Set a timeout to prevent infinite loading
      dataTimeoutRef.current = setTimeout(() => {
        console.warn("Data loading timeout");
        setDataError("Loading timeout - please try again");
        setDataLoading(false);
      }, 15000); // 15 second timeout

      console.log("Loading user data for user:", user.id);

      // Load notebooks
      const { data: notebooksData, error: notebooksError } = await supabase
        .from("notebooks")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });

      if (notebooksError) {
        console.error("Error loading notebooks:", notebooksError);
        setDataError(`Failed to load notebooks: ${notebooksError.message}`);
      } else {
        console.log("Loaded notebooks:", notebooksData?.length || 0);
        setNotebooks(notebooksData || []);

        // Auto-select first notebook if none selected
        if (notebooksData && notebooksData.length > 0 && !selectedNotebookId) {
          setSelectedNotebookId(notebooksData[0].id);
        }
      }

      // Load sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("sections")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });

      if (sectionsError) {
        console.error("Error loading sections:", sectionsError);
        setDataError(`Failed to load sections: ${sectionsError.message}`);
      } else {
        console.log("Loaded sections:", sectionsData?.length || 0);
        setSections(sectionsData || []);
      }

      // Load pages
      const { data: pagesData, error: pagesError } = await supabase
        .from("pages")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });

      if (pagesError) {
        console.error("Error loading pages:", pagesError);
        setDataError(`Failed to load pages: ${pagesError.message}`);
      } else {
        console.log("Loaded pages:", pagesData?.length || 0);
        setPages(pagesData || []);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      setDataError(
        `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      if (dataTimeoutRef.current) {
        clearTimeout(dataTimeoutRef.current);
        dataTimeoutRef.current = null;
      }
      setDataLoading(false);
    }
  }, [user, supabase]);

  // Load user data from Supabase
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Handle authentication redirects
  useEffect(() => {
    if (!loading && !user) {
      console.log("User not authenticated, redirecting to auth");
      router.push("/auth");
    }
  }, [user, loading, router]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (dataTimeoutRef.current) {
        clearTimeout(dataTimeoutRef.current);
      }
    };
  }, []);

  // Notebook handlers
  const handleCreateNotebook = async (notebook: {
    name: string;
    description: string;
    color: string;
  }) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("notebooks")
        .insert({
          user_id: user.id,
          name: notebook.name,
          description: notebook.description,
          color: notebook.color,
          sort_order: notebooks.length,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating notebook:", error);
        return;
      }

      if (data) {
        setNotebooks([...notebooks, data]);
        if (!selectedNotebookId) {
          setSelectedNotebookId(data.id);
        }
      }
    } catch (error) {
      console.error("Error creating notebook:", error);
    }
  };

  const handleUpdateNotebook = async (
    notebookId: string,
    updates: Partial<Notebook>,
  ) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("notebooks")
        .update(updates)
        .eq("id", notebookId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating notebook:", error);
        return;
      }

      if (data) {
        setNotebooks(notebooks.map((nb) => (nb.id === notebookId ? data : nb)));
      }
    } catch (error) {
      console.error("Error updating notebook:", error);
    }
  };

  const handleDeleteNotebook = async (notebookId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notebooks")
        .delete()
        .eq("id", notebookId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error deleting notebook:", error);
        return;
      }

      setNotebooks(notebooks.filter((nb) => nb.id !== notebookId));
      if (selectedNotebookId === notebookId) {
        const remaining = notebooks.filter((nb) => nb.id !== notebookId);
        setSelectedNotebookId(remaining.length > 0 ? remaining[0].id : null);
        setSelectedSectionId(null);
        setSelectedPageId(null);
      }
    } catch (error) {
      console.error("Error deleting notebook:", error);
    }
  };

  // Section handlers
  const handleCreateSection = async (section: {
    name: string;
    color: string;
  }) => {
    if (!user || !selectedNotebookId) return;

    try {
      const { data, error } = await supabase
        .from("sections")
        .insert({
          user_id: user.id,
          notebook_id: selectedNotebookId,
          name: section.name,
          color: section.color,
          sort_order: sections.filter(
            (s) => s.notebook_id === selectedNotebookId,
          ).length,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating section:", error);
        return;
      }

      if (data) {
        setSections([...sections, data]);
        setSelectedSectionId(data.id);
      }
    } catch (error) {
      console.error("Error creating section:", error);
    }
  };

  const handleUpdateSection = async (
    sectionId: string,
    updates: Partial<Section>,
  ) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("sections")
        .update(updates)
        .eq("id", sectionId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating section:", error);
        return;
      }

      if (data) {
        setSections(sections.map((s) => (s.id === sectionId ? data : s)));
      }
    } catch (error) {
      console.error("Error updating section:", error);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("sections")
        .delete()
        .eq("id", sectionId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error deleting section:", error);
        return;
      }

      setSections(sections.filter((s) => s.id !== sectionId));
      if (selectedSectionId === sectionId) {
        const remaining = sections.filter(
          (s) => s.id !== sectionId && s.notebook_id === selectedNotebookId,
        );
        setSelectedSectionId(remaining.length > 0 ? remaining[0].id : null);
        setSelectedPageId(null);
      }
    } catch (error) {
      console.error("Error deleting section:", error);
    }
  };

  const handleReorderSections = async (reorderedSections: Section[]) => {
    setSections(
      sections.map((s) => {
        const reordered = reorderedSections.find((rs) => rs.id === s.id);
        return reordered || s;
      }),
    );
  };

  // Page handlers
  const handleCreatePage = async (parentPageId?: string) => {
    if (!user || !selectedSectionId) return;

    try {
      const defaultContent = { type: "doc", content: [] } as TiptapDocument;

      const { data, error } = await supabase
        .from("pages")
        .insert({
          user_id: user.id,
          section_id: selectedSectionId,
          parent_page_id: parentPageId || null,
          title: "Untitled Page",
          content: "",
          content_json: defaultContent as any,
          sort_order: pages.filter(
            (p) =>
              p.section_id === selectedSectionId &&
              p.parent_page_id === parentPageId,
          ).length,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating page:", error);
        return;
      }

      if (data) {
        setPages([...pages, data]);
        setSelectedPageId(data.id);
        setIsCreatingPage(true);
      }
    } catch (error) {
      console.error("Error creating page:", error);
    }
  };

  const handleUpdatePage = async (pageId: string, updates: Partial<Page>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("pages")
        .update(updates)
        .eq("id", pageId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating page:", error);
        return;
      }

      if (data) {
        setPages(pages.map((p) => (p.id === pageId ? data : p)));
      }
    } catch (error) {
      console.error("Error updating page:", error);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("pages")
        .delete()
        .eq("id", pageId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error deleting page:", error);
        return;
      }

      setPages(pages.filter((p) => p.id !== pageId));
      if (selectedPageId === pageId) {
        setSelectedPageId(null);
        setIsCreatingPage(false);
      }
    } catch (error) {
      console.error("Error deleting page:", error);
    }
  };

  const handleReorderPages = async (reorderedPages: Page[]) => {
    setPages(
      pages.map((p) => {
        const reordered = reorderedPages.find((rp) => rp.id === p.id);
        return reordered || p;
      }),
    );
  };

  const handleSavePage = async (pageData: {
    id: string;
    title: string;
    content: string;
    contentJson: TiptapDocument;
    sectionId?: string;
    parentPageId?: string;
  }) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("pages")
        .update({
          title: pageData.title,
          content: pageData.content,
          content_json: pageData.contentJson as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pageData.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Error saving page:", error);
        throw error; // Re-throw to let the component handle the error
      }

      if (data) {
        setPages(pages.map((p) => (p.id === pageData.id ? data : p)));
        setIsCreatingPage(false);
      }
    } catch (error) {
      console.error("Error saving page:", error);
      throw error; // Re-throw to let the component handle the error
    }
  };

  const handleAutoSavePage = async (pageData: {
    id: string;
    title: string;
    content: string;
    contentJson: TiptapDocument;
    sectionId?: string;
    parentPageId?: string;
  }) => {
    if (!user) {
      console.error("No user found for autosave");
      throw new Error("User not authenticated");
    }

    // Validate required data
    if (!pageData.id) {
      console.error("No page ID provided for autosave");
      throw new Error("Page ID is required");
    }

    if (!pageData.contentJson || typeof pageData.contentJson !== "object") {
      console.error("Invalid content JSON for autosave:", pageData.contentJson);
      throw new Error("Valid content JSON is required");
    }

    try {
      console.log("Dashboard: Starting autosave for page:", pageData.id);
      console.log("Dashboard: Update data:", {
        title: pageData.title,
        contentLength: pageData.content.length,
        hasContentJson: !!pageData.contentJson,
        contentJsonType: typeof pageData.contentJson,
        contentJsonValid: pageData.contentJson.type === "doc",
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      // Validate content JSON structure
      const validatedContentJson = safeJsonParse(pageData.contentJson);

      const updatePayload = {
        title: pageData.title || "Untitled Page",
        content: pageData.content || "",
        content_json: validatedContentJson as any,
        updated_at: new Date().toISOString(),
      };

      console.log("Dashboard: Sending update payload:", {
        ...updatePayload,
        content_json: "[JSON Object]", // Don't log the full JSON
        content_json_size: JSON.stringify(updatePayload.content_json).length,
      });

      const { data, error } = await supabase
        .from("pages")
        .update(updatePayload)
        .eq("id", pageData.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Dashboard: Supabase error during autosave:", {
          error,
          pageId: pageData.id,
          userId: user.id,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          timestamp: new Date().toISOString(),
        });

        // Enhanced error handling with specific error types
        if (error.code === "42703") {
          throw new Error(
            `Database schema error: The content_json column is missing from the pages table. Please run the database migration.`,
          );
        }

        if (error.code === "PGRST116") {
          throw new Error(
            `Page not found or access denied. Page ID: ${pageData.id}`,
          );
        }

        if (error.message?.includes("content_json")) {
          throw new Error(
            `Content JSON error: ${error.message}. This may indicate a database schema issue.`,
          );
        }

        if (error.message?.includes("schema cache")) {
          // Force a schema refresh by retrying after a short delay
          console.log("Schema cache error detected, retrying after delay...");
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Retry the operation once
          const { data: retryData, error: retryError } = await supabase
            .from("pages")
            .update(updatePayload)
            .eq("id", pageData.id)
            .eq("user_id", user.id)
            .select()
            .single();

          if (retryError) {
            throw new Error(
              `Schema cache error persists: ${retryError.message}`,
            );
          }

          if (retryData) {
            setPages((currentPages) =>
              currentPages.map((p) => (p.id === pageData.id ? retryData : p)),
            );
            return;
          }
        }

        throw error;
      }

      if (data) {
        console.log("Dashboard: Autosave successful, updating local state");
        // Update the pages state silently for autosave
        setPages((currentPages) =>
          currentPages.map((p) => (p.id === pageData.id ? data : p)),
        );
      } else {
        console.warn("Dashboard: No data returned from autosave");
        throw new Error("No data returned from database update");
      }
    } catch (error) {
      console.error("Dashboard: Error auto-saving page:", {
        error,
        pageId: pageData.id,
        userId: user?.id,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : "No stack trace",
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  };

  // Helper functions
  const getCurrentNotebookSections = () => {
    return sections.filter((s) => s.notebook_id === selectedNotebookId);
  };

  const getCurrentSectionPages = () => {
    return pages.filter((p) => p.section_id === selectedSectionId);
  };

  const getCurrentPage = () => {
    return pages.find((p) => p.id === selectedPageId) || null;
  };

  // Auto-select first section when notebook changes
  useEffect(() => {
    if (selectedNotebookId) {
      const notebookSections = sections.filter(
        (s) => s.notebook_id === selectedNotebookId,
      );
      if (notebookSections.length > 0) {
        // If no section is selected or current section doesn't belong to this notebook
        const currentSectionBelongsToNotebook =
          selectedSectionId &&
          notebookSections.some((s) => s.id === selectedSectionId);

        if (!currentSectionBelongsToNotebook) {
          setSelectedSectionId(notebookSections[0].id);
          setSelectedPageId(null); // Reset page when changing sections
        }
      } else {
        setSelectedSectionId(null);
        setSelectedPageId(null);
      }
    } else {
      setSelectedSectionId(null);
      setSelectedPageId(null);
    }
  }, [selectedNotebookId, sections, selectedSectionId]);

  // Auto-select first page when section changes
  useEffect(() => {
    if (selectedSectionId) {
      const sectionPages = pages.filter(
        (p) => p.section_id === selectedSectionId,
      );
      if (sectionPages.length > 0) {
        // If no page is selected or current page doesn't belong to this section
        const currentPageBelongsToSection =
          selectedPageId && sectionPages.some((p) => p.id === selectedPageId);

        if (!currentPageBelongsToSection) {
          setSelectedPageId(sectionPages[0].id);
          setShowPageList(true); // Show page list when there are pages
        }
      } else {
        setSelectedPageId(null);
      }
    } else {
      setSelectedPageId(null);
    }
  }, [selectedSectionId, pages, selectedPageId]);

  // Enhanced notebook selection handler
  const handleSelectNotebook = useCallback((notebookId: string) => {
    console.log("Selecting notebook:", notebookId);
    setSelectedNotebookId(notebookId);
    // Reset dependent selections - they will be auto-selected by useEffect
    setSelectedSectionId(null);
    setSelectedPageId(null);
  }, []);

  // Enhanced section selection handler
  const handleSelectSection = useCallback((sectionId: string) => {
    console.log("Selecting section:", sectionId);
    setSelectedSectionId(sectionId);
    // Reset page selection - it will be auto-selected by useEffect
    setSelectedPageId(null);
  }, []);

  // Enhanced page selection handler
  const handleSelectPage = useCallback((pageId: string) => {
    console.log("Selecting page:", pageId);
    setSelectedPageId(pageId);
  }, []);

  const currentPage = getCurrentPage();

  // Show error screen for authentication errors
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push("/auth")}>Go to Sign In</Button>
        </div>
      </div>
    );
  }

  // Show loading screen while authentication is loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if user is not authenticated (redirect will happen via useEffect)
  if (!user) {
    return null;
  }

  // Show error screen for data loading errors
  if (dataError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Data Loading Error</h2>
          <p className="text-muted-foreground mb-6">{dataError}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={loadUserData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button onClick={() => router.push("/auth")}>Sign Out</Button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading screen while user data is loading
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading your data...</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadUserData}
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          {/* Left side - Notebook Dropdown */}
          <div className="flex items-center gap-4">
            <NotebookDropdown
              notebooks={notebooks}
              selectedNotebookId={selectedNotebookId}
              onSelectNotebook={handleSelectNotebook}
              onCreateNotebook={handleCreateNotebook}
              onUpdateNotebook={handleUpdateNotebook}
              onDeleteNotebook={handleDeleteNotebook}
            />
            <div className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              •{" "}
              {new Date().toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            {selectedSectionId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCreatePage()}
                className="sleek-button flex items-center gap-1"
              >
                <FileText className="h-4 w-4" />
                <span className="text-xs">Add Page</span>
              </Button>
            )}
            <UserMenu />
          </div>
        </div>

        {/* Section Tabs - Top */}
        {selectedNotebookId && (
          <SectionTabs
            sections={getCurrentNotebookSections()}
            selectedSectionId={selectedSectionId}
            onSelectSection={handleSelectSection}
            onCreateSection={handleCreateSection}
            onUpdateSection={handleUpdateSection}
            onDeleteSection={handleDeleteSection}
            onReorderSections={handleReorderSections}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Note Editor - Takes most space, adjust for AI sidebar */}
          <div
            className={`flex-1 overflow-hidden transition-all duration-300 ${isAIAssistantOpen ? "mr-[600px]" : ""}`}
          >
            {selectedPageId && currentPage ? (
              <NoteEditor
                pageId={currentPage.id}
                initialTitle={currentPage.title}
                initialContent={safeJsonParse(currentPage.content_json)}
                sectionId={selectedSectionId || undefined}
                parentPageId={currentPage.parent_page_id || undefined}
                onSave={handleSavePage}
                onAutoSave={handleAutoSavePage}
                onTitleChange={(title) =>
                  handleUpdatePage(currentPage.id, { title })
                }
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">No page selected</h3>
                  <p className="mb-4">
                    {selectedSectionId
                      ? "Select a page from the list or create a new one"
                      : "Select a section to view pages"}
                  </p>
                  {selectedSectionId && (
                    <Button onClick={() => handleCreatePage()}>
                      Create New Page
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pages List - Right Sidebar - Only show when AI assistant is closed */}
          {selectedSectionId && !isAIAssistantOpen && (
            <div className="w-64 border-l border-border/50 bg-background/50">
              <div className="p-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">Pages</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCreatePage()}
                    className="h-6 w-6 p-0 sleek-button"
                  >
                    <FileText className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="p-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                {getCurrentSectionPages().length > 0 ? (
                  getCurrentSectionPages().map((page) => (
                    <div
                      key={page.id}
                      onClick={() => handleSelectPage(page.id)}
                      className={`p-2 rounded text-sm cursor-pointer transition-colors ${
                        selectedPageId === page.id
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      }`}
                    >
                      {page.title || "Untitled page"}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground p-2">
                    No pages yet
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pages List in AI Sidebar when open */}
          {selectedSectionId && isAIAssistantOpen && (
            <div className="fixed top-16 right-[600px] w-64 h-[calc(100vh-64px)] bg-background border-l border-border/50 z-40">
              <div className="p-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">Pages</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCreatePage()}
                    className="h-6 w-6 p-0 sleek-button"
                  >
                    <FileText className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="p-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                {getCurrentSectionPages().length > 0 ? (
                  getCurrentSectionPages().map((page) => (
                    <div
                      key={page.id}
                      onClick={() => handleSelectPage(page.id)}
                      className={`p-2 rounded text-sm cursor-pointer transition-colors ${
                        selectedPageId === page.id
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      }`}
                    >
                      {page.title || "Untitled page"}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground p-2">
                    No pages yet
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating AI Assistant Button */}
      <FloatingAIAssistantButton
        onClick={() => setIsAIAssistantOpen(!isAIAssistantOpen)}
        isOpen={isAIAssistantOpen}
      />

      {/* AI Chat Sidebar - Popup */}
      <AIChatSidebar
        currentNote={
          currentPage
            ? {
                id: currentPage.id,
                title: currentPage.title,
                content: currentPage.content || "",
              }
            : undefined
        }
        context={{
          currentNotebook: selectedNotebookId
            ? notebooks.find((nb) => nb.id === selectedNotebookId)
              ? {
                  id: selectedNotebookId,
                  name: notebooks.find((nb) => nb.id === selectedNotebookId)!
                    .name,
                }
              : undefined
            : undefined,
          currentSection: selectedSectionId
            ? sections.find((s) => s.id === selectedSectionId)
              ? {
                  id: selectedSectionId,
                  name: sections.find((s) => s.id === selectedSectionId)!.name,
                }
              : undefined
            : undefined,
          currentPage: currentPage
            ? { id: currentPage.id, title: currentPage.title }
            : undefined,
          allPages: pages.map((page) => ({
            id: page.id,
            title: page.title,
            content: page.content || extractPlainText(page.content_json) || "",
            content_json: page.content_json,
            section_id: page.section_id,
          })),
        }}
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
      />
    </div>
  );
}
