"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  ChevronDown,
  Palette,
} from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Database } from "@/types/supabase";

type Notebook = Database["public"]["Tables"]["notebooks"]["Row"];

interface NotebookSidebarProps {
  notebooks?: Notebook[];
  selectedNotebookId?: string | null;
  onSelectNotebook?: (notebookId: string) => void;
  onCreateNotebook?: (notebook: {
    name: string;
    description: string;
    color: string;
  }) => void;
  onUpdateNotebook?: (notebookId: string, updates: Partial<Notebook>) => void;
  onDeleteNotebook?: (notebookId: string) => void;
  className?: string;
}

const NotebookSidebar = ({
  notebooks = [],
  selectedNotebookId = null,
  onSelectNotebook = () => {},
  onCreateNotebook = () => {},
  onUpdateNotebook = () => {},
  onDeleteNotebook = () => {},
  className = "",
}: NotebookSidebarProps) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [newNotebook, setNewNotebook] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
  });
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const handleCreateNotebook = () => {
    if (newNotebook.name.trim()) {
      onCreateNotebook(newNotebook);
      setNewNotebook({ name: "", description: "", color: "#3b82f6" });
      setIsCreateDialogOpen(false);
    }
  };

  const handleEditNotebook = (notebook: Notebook) => {
    setEditingNotebook(notebook);
    setNewNotebook({
      name: notebook.name,
      description: notebook.description || "",
      color: notebook.color || "#3b82f6",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateNotebook = () => {
    if (editingNotebook && newNotebook.name.trim()) {
      onUpdateNotebook(editingNotebook.id, {
        name: newNotebook.name,
        description: newNotebook.description,
        color: newNotebook.color,
      });
      setIsEditDialogOpen(false);
      setEditingNotebook(null);
      setNewNotebook({ name: "", description: "", color: "#3b82f6" });
    }
  };

  const selectedNotebook = notebooks.find((n) => n.id === selectedNotebookId);

  return (
    <div className={`w-64 bg-background border-r flex flex-col ${className}`}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Notebooks</h2>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Notebook</DialogTitle>
                <DialogDescription>
                  Create a new notebook to organize your notes and sections.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notebook-name">Name</Label>
                  <Input
                    id="notebook-name"
                    value={newNotebook.name}
                    onChange={(e) =>
                      setNewNotebook({ ...newNotebook, name: e.target.value })
                    }
                    placeholder="Enter notebook name"
                  />
                </div>
                <div>
                  <Label htmlFor="notebook-description">Description</Label>
                  <Textarea
                    id="notebook-description"
                    value={newNotebook.description}
                    onChange={(e) =>
                      setNewNotebook({
                        ...newNotebook,
                        description: e.target.value,
                      })
                    }
                    placeholder="Enter notebook description (optional)"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-8 h-8 rounded border-2 border-border cursor-pointer"
                      style={{ backgroundColor: newNotebook.color }}
                      onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                    >
                      <Palette className="h-4 w-4 mr-1" />
                      Choose Color
                    </Button>
                  </div>
                  {isColorPickerOpen && (
                    <div className="mt-2">
                      <HexColorPicker
                        color={newNotebook.color}
                        onChange={(color) =>
                          setNewNotebook({ ...newNotebook, color })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateNotebook}>Create Notebook</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {selectedNotebook && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedNotebook.color || "#3b82f6" }}
            />
            <span className="text-sm font-medium truncate">
              {selectedNotebook.name}
            </span>
            <ChevronDown className="h-4 w-4 ml-auto" />
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {notebooks.length > 0 ? (
            notebooks.map((notebook) => (
              <div
                key={notebook.id}
                className={`group flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-accent transition-colors ${
                  selectedNotebookId === notebook.id ? "bg-accent" : ""
                }`}
                onClick={() => onSelectNotebook(notebook.id)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: notebook.color || "#3b82f6" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {notebook.name}
                    </p>
                    {notebook.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {notebook.description}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleEditNotebook(notebook)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete &quot;{notebook.name}&quot;?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the notebook and all its sections and pages.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeleteNotebook(notebook.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm mb-2">No notebooks yet</p>
              <p className="text-xs mb-4">
                Create your first notebook to get started!
              </p>
              <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create Notebook
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Notebook</DialogTitle>
            <DialogDescription>
              Update the notebook name, description, and color.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-notebook-name">Name</Label>
              <Input
                id="edit-notebook-name"
                value={newNotebook.name}
                onChange={(e) =>
                  setNewNotebook({ ...newNotebook, name: e.target.value })
                }
                placeholder="Enter notebook name"
              />
            </div>
            <div>
              <Label htmlFor="edit-notebook-description">Description</Label>
              <Textarea
                id="edit-notebook-description"
                value={newNotebook.description}
                onChange={(e) =>
                  setNewNotebook({
                    ...newNotebook,
                    description: e.target.value,
                  })
                }
                placeholder="Enter notebook description (optional)"
                rows={3}
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className="w-8 h-8 rounded border-2 border-border cursor-pointer"
                  style={{ backgroundColor: newNotebook.color }}
                  onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                >
                  <Palette className="h-4 w-4 mr-1" />
                  Choose Color
                </Button>
              </div>
              {isColorPickerOpen && (
                <div className="mt-2">
                  <HexColorPicker
                    color={newNotebook.color}
                    onChange={(color) =>
                      setNewNotebook({ ...newNotebook, color })
                    }
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateNotebook}>Update Notebook</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotebookSidebar;
