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
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Palette,
  GripVertical,
} from "lucide-react";
import { HexColorPicker } from "react-colorful";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Database } from "@/types/supabase";

type Section = Database["public"]["Tables"]["sections"]["Row"];

interface SectionTabsProps {
  sections?: Section[];
  selectedSectionId?: string | null;
  onSelectSection?: (sectionId: string) => void;
  onCreateSection?: (section: { name: string; color: string }) => void;
  onUpdateSection?: (sectionId: string, updates: Partial<Section>) => void;
  onDeleteSection?: (sectionId: string) => void;
  onReorderSections?: (sections: Section[]) => void;
  className?: string;
}

interface SortableTabProps {
  section: Section;
  isSelected: boolean;
  onSelect: (sectionId: string) => void;
  onEdit: (section: Section) => void;
  onDelete: (sectionId: string) => void;
  colorClass: string;
}

const SortableTab = ({
  section,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  colorClass,
}: SortableTabProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const selectedStyle =
    isSelected && section.color
      ? {
          backgroundColor: section.color,
          color: "#ffffff",
          boxShadow: `0 4px 15px ${section.color}40`,
        }
      : {};

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...selectedStyle }}
      className={`group relative flex items-center gap-2 px-4 py-3 cursor-pointer transition-all vibrant-tab ${
        isSelected ? "active" : "hover:bg-accent/20"
      }`}
      onClick={() => onSelect(section.id)}
    >
      <span
        className={`text-sm font-medium truncate max-w-32 ${
          isSelected ? "text-white font-semibold" : "text-foreground"
        }`}
      >
        {section.name}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div
          {...attributes}
          {...listeners}
          className={`cursor-grab active:cursor-grabbing p-1 rounded ${
            isSelected ? "hover:bg-black/10" : "hover:bg-white/10"
          }`}
        >
          <GripVertical
            className={`h-3 w-3 ${isSelected ? "text-white" : "text-current"}`}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 p-0 ${
                isSelected
                  ? "hover:bg-black/10 text-white"
                  : "hover:bg-white/10"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(section)}>
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
                    Delete &quot;{section.name}&quot;?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    the section and all its pages.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(section.id)}
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
    </div>
  );
};

const SectionTabs = ({
  sections = [],
  selectedSectionId = null,
  onSelectSection = () => {},
  onCreateSection = () => {},
  onUpdateSection = () => {},
  onDeleteSection = () => {},
  onReorderSections = () => {},
  className = "",
}: SectionTabsProps) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [newSection, setNewSection] = useState({
    name: "",
    color: "#3b82f6",
  });
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex(
        (section) => section.id === active.id,
      );
      const newIndex = sections.findIndex((section) => section.id === over.id);

      const reorderedSections = arrayMove(sections, oldIndex, newIndex);
      onReorderSections(reorderedSections);
    }
  };

  const handleCreateSection = () => {
    if (newSection.name.trim()) {
      onCreateSection(newSection);
      setNewSection({ name: "", color: "#3b82f6" });
      setIsCreateDialogOpen(false);
    }
  };

  const handleEditSection = (section: Section) => {
    setEditingSection(section);
    setNewSection({
      name: section.name,
      color: section.color || "#3b82f6",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateSection = () => {
    if (editingSection && newSection.name.trim()) {
      onUpdateSection(editingSection.id, {
        name: newSection.name,
        color: newSection.color,
      });
      setIsEditDialogOpen(false);
      setEditingSection(null);
      setNewSection({ name: "", color: "#3b82f6" });
    }
  };

  const vibrantColors = [
    "section-tab-purple",
    "section-tab-orange",
    "section-tab-cyan",
    "section-tab-pink",
  ];

  return (
    <div className={`bg-background ${className}`}>
      <div className="flex items-center px-4 py-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex items-end gap-0 flex-1 overflow-x-auto">
              {sections.map((section, index) => {
                return (
                  <SortableTab
                    key={section.id}
                    section={section}
                    isSelected={selectedSectionId === section.id}
                    onSelect={onSelectSection}
                    onEdit={handleEditSection}
                    onDelete={onDeleteSection}
                    colorClass=""
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="sleek-button ml-2">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Section</DialogTitle>
              <DialogDescription>
                Create a new section to organize your pages.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="section-name">Name</Label>
                <Input
                  id="section-name"
                  value={newSection.name}
                  onChange={(e) =>
                    setNewSection({ ...newSection, name: e.target.value })
                  }
                  placeholder="Enter section name"
                />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-8 h-8 rounded border-2 border-border cursor-pointer"
                    style={{ backgroundColor: newSection.color }}
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
                      color={newSection.color}
                      onChange={(color) =>
                        setNewSection({ ...newSection, color })
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
              <Button onClick={handleCreateSection}>Create Section</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
            <DialogDescription>
              Update the section name and color.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-section-name">Name</Label>
              <Input
                id="edit-section-name"
                value={newSection.name}
                onChange={(e) =>
                  setNewSection({ ...newSection, name: e.target.value })
                }
                placeholder="Enter section name"
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className="w-8 h-8 rounded border-2 border-border cursor-pointer"
                  style={{ backgroundColor: newSection.color }}
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
                    color={newSection.color}
                    onChange={(color) =>
                      setNewSection({ ...newSection, color })
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
            <Button onClick={handleUpdateSection}>Update Section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SectionTabs;
