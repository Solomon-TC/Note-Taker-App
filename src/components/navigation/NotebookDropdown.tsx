"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Edit,
  Trash2,
  ChevronDown,
  Palette,
} from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Database } from "@/types/supabase";

type Notebook = Database["public"]["Tables"]["notebooks"]["Row"];

interface NotebookDropdownProps {
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

const NotebookDropdown = ({
  notebooks = [],
  selectedNotebookId = null,
  onSelectNotebook = () => {},
  onCreateNotebook = () => {},
  onUpdateNotebook = () => {},
  onDeleteNotebook = () => {},
  className = "",
}: NotebookDropdownProps) => {
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
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            {selectedNotebookId === "__dashboard__" ? (
              <>
                <BookOpen className="h-4 w-4" />
                <span>Dashboard</span>
              </>
            ) : selectedNotebook ? (
              <>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: selectedNotebook.color || "#3b82f6",
                  }}
                />
                <span className="max-w-32 truncate">
                  {selectedNotebook.name}
                </span>
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4" />
                <span>Select Class</span>
              </>
            )}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* Dashboard Option */}
          <DropdownMenuItem
            onClick={() => onSelectNotebook("__dashboard__")}
            className="flex items-center gap-2"
          >
            <BookOpen className="h-4 w-4" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Dashboard</p>
              <p className="text-xs text-muted-foreground">View all classes</p>
            </div>
          </DropdownMenuItem>

          {notebooks.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {notebooks.map((notebook) => (
                <DropdownMenuItem
                  key={notebook.id}
                  onClick={() => onSelectNotebook(notebook.id)}
                  className="flex items-center gap-2"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: notebook.color || "#3b82f6" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {notebook.name}
                    </p>
                    {notebook.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {notebook.description}
                      </p>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {notebooks.length > 0 && <DropdownMenuSeparator />}

          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                data-create-notebook
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Class
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Class</DialogTitle>
                <DialogDescription>
                  Create a new class to organize your notes and sections.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notebook-name">Class Name</Label>
                  <Input
                    id="notebook-name"
                    value={newNotebook.name}
                    onChange={(e) =>
                      setNewNotebook({ ...newNotebook, name: e.target.value })
                    }
                    placeholder="Enter class name"
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
                    placeholder="Enter class description (optional)"
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
                <Button onClick={handleCreateNotebook}>Create Class</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {selectedNotebook && (
            <>
              <DropdownMenuItem
                onClick={() => handleEditNotebook(selectedNotebook)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Current Class
              </DropdownMenuItem>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Current Class
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete &quot;{selectedNotebook.name}&quot;?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the class and all its sections and pages.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDeleteNotebook(selectedNotebook.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>
              Update the class name, description, and color.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-notebook-name">Class Name</Label>
              <Input
                id="edit-notebook-name"
                value={newNotebook.name}
                onChange={(e) =>
                  setNewNotebook({ ...newNotebook, name: e.target.value })
                }
                placeholder="Enter class name"
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
                placeholder="Enter class description (optional)"
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
            <Button onClick={handleUpdateNotebook}>Update Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotebookDropdown;
