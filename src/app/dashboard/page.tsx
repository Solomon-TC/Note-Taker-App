"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import UserMenu from "@/components/auth/UserMenu";
import ClassCards from "@/components/dashboard/ClassCards";
import AIChatSidebar from "@/components/ai/AIChatSidebar";

import NoteEditor from "@/components/notes/NoteEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, BookOpen, Clock, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { Database } from "@/types/supabase";

type Class = Database["public"]["Tables"]["classes"]["Row"] & {
  noteCount?: number;
};

type Note = Database["public"]["Tables"]["notes"]["Row"] & {
  className: string;
  classes?: { name: string } | null;
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Memoize supabase client to prevent recreation on every render
  const supabase = useMemo(() => createClient(), []);

  const [classes, setClasses] = useState<Class[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [currentView, setCurrentView] = useState<
    "dashboard" | "class-notes" | "note-editor"
  >("dashboard");

  const [dataLoading, setDataLoading] = useState(true);

  // Memoize loadUserData to prevent recreation on every render
  const loadUserData = useCallback(async () => {
    if (!user) {
      setDataLoading(false);
      return;
    }

    try {
      setDataLoading(true);

      // Load classes
      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (classesError) {
        console.error("Error loading classes:", classesError);
      } else {
        setClasses(classesData || []);
      }

      // Load notes with class names
      const { data: notesData, error: notesError } = await supabase
        .from("notes")
        .select(
          `
          *,
          classes(name)
        `,
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (notesError) {
        console.error("Error loading notes:", notesError);
      } else {
        const formattedNotes = (notesData || []).map((note) => ({
          ...note,
          className: note.classes?.name || "No Class",
          classes: note.classes || undefined,
          createdAt: new Date(note.created_at!),
          updatedAt: new Date(note.updated_at!),
        }));
        setNotes(formattedNotes);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
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
      router.push("/auth");
    }
  }, [user, loading, router]);

  const handleAddClass = async (newClass: {
    name: string;
    description: string;
    progress?: number;
  }) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("classes")
        .insert({
          user_id: user.id,
          name: newClass.name,
          description: newClass.description,
          progress: newClass.progress || 0,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating class:", error);
        return;
      }

      if (data) {
        setClasses([data, ...classes]);
      }
    } catch (error) {
      console.error("Error creating class:", error);
    }
  };

  const handleSelectClass = (classId: string) => {
    setSelectedClassId(classId);
    setCurrentView("class-notes");
  };

  const handleCreateNote = (classId?: string) => {
    setSelectedClassId(classId || null);
    setSelectedNoteId(null);
    setIsCreatingNote(true);
    setCurrentView("note-editor");
  };

  const handleEditNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    setIsCreatingNote(false);
    setCurrentView("note-editor");
  };

  const handleSaveNote = async (noteData: {
    id: string;
    title: string;
    content: string;
    classId?: string;
  }) => {
    if (!user) return;

    const selectedClass = classes.find((c) => c.id === noteData.classId);

    try {
      if (isCreatingNote) {
        // Create new note
        const { data, error } = await supabase
          .from("notes")
          .insert({
            user_id: user.id,
            title: noteData.title,
            content: noteData.content,
            class_id: noteData.classId || null,
          })
          .select(
            `
            *,
            classes(name)
          `,
          )
          .single();

        if (error) {
          console.error("Error creating note:", error);
          return;
        }

        if (data) {
          const newNote = {
            ...data,
            className: data.classes?.name || "No Class",
            createdAt: new Date(data.created_at!),
            updatedAt: new Date(data.updated_at!),
          };
          setNotes([newNote, ...notes]);
        }
      } else {
        // Update existing note
        const { data, error } = await supabase
          .from("notes")
          .update({
            title: noteData.title,
            content: noteData.content,
            class_id: noteData.classId || null,
          })
          .eq("id", noteData.id)
          .eq("user_id", user.id)
          .select(
            `
            *,
            classes(name)
          `,
          )
          .single();

        if (error) {
          console.error("Error updating note:", error);
          return;
        }

        if (data) {
          const updatedNote = {
            ...data,
            className: data.classes?.name || "No Class",
            createdAt: new Date(data.created_at!),
            updatedAt: new Date(data.updated_at!),
          };
          setNotes(
            notes.map((note) => (note.id === noteData.id ? updatedNote : note)),
          );
        }
      }

      setCurrentView("dashboard");
      setIsCreatingNote(false);
      setSelectedNoteId(null);
    } catch (error) {
      console.error("Error saving note:", error);
    }
  };

  const handleBackToDashboard = () => {
    setCurrentView("dashboard");
    setSelectedClassId(null);
    setSelectedNoteId(null);
    setIsCreatingNote(false);
  };

  const getClassNotes = (classId: string) => {
    return notes.filter((note) => note.class_id === classId);
  };

  const getRecentNotes = () => {
    return notes
      .sort(
        (a, b) =>
          new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime(),
      )
      .slice(0, 3)
      .map((note) => ({
        id: note.id,
        title: note.title,
        class: note.className,
        date: getRelativeTime(new Date(note.updated_at!)),
      }));
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24)
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  };

  const getCurrentNote = () => {
    if (selectedNoteId) {
      return notes.find((note) => note.id === selectedNoteId);
    }
    return null;
  };

  const selectedClass = selectedClassId
    ? classes.find((c) => c.id === selectedClassId)
    : null;
  const currentNote = getCurrentNote();
  const recentNotes = getRecentNotes();

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

  // Show loading screen while user data is loading
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if user is not authenticated (redirect will happen via useEffect)
  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 overflow-auto p-6">
        {currentView === "dashboard" && (
          <>
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <div className="flex items-center gap-4">
                <Button onClick={() => handleCreateNote()}>
                  <PlusCircle className="mr-2 h-4 w-4" /> New Note
                </Button>
                <UserMenu />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {/* Class Cards Section */}
              <div>
                <ClassCards
                  classes={classes.map((cls) => ({
                    id: cls.id,
                    name: cls.name,
                    description: cls.description || "",
                    progress: cls.progress || 0,
                    noteCount: notes.filter((note) => note.class_id === cls.id)
                      .length,
                    onSelect: handleSelectClass,
                  }))}
                  onSelectClass={handleSelectClass}
                  onAddClass={handleAddClass}
                />
              </div>

              {/* Recent Notes Section */}
              <div>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-semibold">
                        Recent Notes
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentView("class-notes")}
                      >
                        View All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentNotes.length > 0 ? (
                        recentNotes.map((note) => (
                          <div
                            key={note.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                            onClick={() => handleEditNote(note.id.toString())}
                          >
                            <div className="flex items-center">
                              <div className="bg-primary/10 p-2 rounded-md mr-3">
                                <BookOpen className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-medium">{note.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {note.class}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Clock className="h-3 w-3 mr-1" />
                              {note.date}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>
                            No notes yet. Create your first note to get started!
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}

        {currentView === "class-notes" && selectedClass && (
          <>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToDashboard}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">{selectedClass.name}</h1>
                  <p className="text-muted-foreground">
                    {selectedClass.description}
                  </p>
                </div>
              </div>
              <Button onClick={() => handleCreateNote(selectedClassId!)}>
                <PlusCircle className="mr-2 h-4 w-4" /> New Note
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {getClassNotes(selectedClassId!).map((note) => (
                <Card
                  key={note.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleEditNote(note.id)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{note.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Last updated:
                      {getRelativeTime(new Date(note.updated_at!))}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {note.content.substring(0, 150)}...
                    </p>
                  </CardContent>
                </Card>
              ))}

              {getClassNotes(selectedClassId!).length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">
                    No notes in this class yet
                  </h3>
                  <p className="mb-4">
                    Start taking notes to track your learning progress!
                  </p>
                  <Button onClick={() => handleCreateNote(selectedClassId!)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create First Note
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {currentView === "note-editor" && (
          <>
            <div className="flex items-center justify-between mb-8">
              <Button variant="ghost" size="sm" onClick={handleBackToDashboard}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>

            <NoteEditor
              noteId={currentNote?.id}
              initialTitle={currentNote?.title}
              initialContent={currentNote?.content}
              classId={selectedClassId || currentNote?.class_id}
              onSave={handleSaveNote}
            />
          </>
        )}
      </div>

      {/* AI Chat Sidebar */}
      <div className="w-[350px] border-l">
        <AIChatSidebar
          currentNote={
            currentNote
              ? {
                  id: currentNote.id,
                  title: currentNote.title,
                  content: currentNote.content,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
