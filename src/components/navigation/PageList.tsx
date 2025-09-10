"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  FileText,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Clock,
  Calendar,
} from "lucide-react";
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Database } from "@/types/supabase";

type Page = Database["public"]["Tables"]["pages"]["Row"];

interface PageWithChildren extends Page {
  children?: PageWithChildren[];
  level?: number;
}

interface PageListProps {
  pages?: Page[];
  selectedPageId?: string | null;
  onSelectPage?: (pageId: string) => void;
  onCreatePage?: (parentPageId?: string) => void;
  onUpdatePage?: (pageId: string, updates: Partial<Page>) => void;
  onDeletePage?: (pageId: string) => void;
  onReorderPages?: (pages: Page[]) => void;
  className?: string;
}

interface SortablePageItemProps {
  page: PageWithChildren;
  isSelected: boolean;
  onSelect: (pageId: string) => void;
  onEdit: (page: Page) => void;
  onDelete: (pageId: string) => void;
  onCreateSubpage: (parentPageId: string) => void;
  expandedPages: Set<string>;
  onToggleExpanded: (pageId: string) => void;
}

const SortablePageItem = ({
  page,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onCreateSubpage,
  expandedPages,
  onToggleExpanded,
}: SortablePageItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasChildren = page.children && page.children.length > 0;
  const isExpanded = expandedPages.has(page.id);
  const level = page.level || 0;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent transition-colors ${
          isSelected ? "bg-accent" : ""
        }`}
        style={{ paddingLeft: `${8 + level * 20}px` }}
        onClick={() => onSelect(page.id)}
      >
        {/* Expand/Collapse Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) {
              onToggleExpanded(page.id);
            }
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : (
            <div className="w-3 h-3" />
          )}
        </Button>

        {/* Page Icon */}
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />

        {/* Page Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium truncate">{page.title}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              <Clock className="h-3 w-3" />
              <span>{formatDate(page.updated_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Created {formatDate(page.created_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
          >
            <GripVertical className="h-3 w-3" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onCreateSubpage(page.id)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Subpage
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(page)}>
                <Edit className="h-4 w-4 mr-2" />
                Rename
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
                      Delete &quot;{page.title}&quot;?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the page and all its subpages.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(page.id)}
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

      {/* Render Children */}
      {hasChildren && isExpanded && (
        <div className="ml-4">
          {page.children!.map((child) => (
            <SortablePageItem
              key={child.id}
              page={child}
              isSelected={isSelected}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onCreateSubpage={onCreateSubpage}
              expandedPages={expandedPages}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const PageList = ({
  pages = [],
  selectedPageId = null,
  onSelectPage = () => {},
  onCreatePage = () => {},
  onUpdatePage = () => {},
  onDeletePage = () => {},
  onReorderPages = () => {},
  className = "",
}: PageListProps) => {
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renamingPage, setRenamingPage] = useState<Page | null>(null);
  const [newPageTitle, setNewPageTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Build hierarchical structure - memoized to prevent recalculation
  const hierarchicalPages = useMemo(() => {
    const buildPageHierarchy = (pages: Page[]): PageWithChildren[] => {
      const pageMap = new Map<string, PageWithChildren>();
      const rootPages: PageWithChildren[] = [];

      // First pass: create all pages
      pages.forEach((page) => {
        pageMap.set(page.id, { ...page, children: [], level: 0 });
      });

      // Second pass: build hierarchy
      pages.forEach((page) => {
        const pageWithChildren = pageMap.get(page.id)!;
        if (page.parent_page_id) {
          const parent = pageMap.get(page.parent_page_id);
          if (parent) {
            pageWithChildren.level = (parent.level || 0) + 1;
            parent.children!.push(pageWithChildren);
          } else {
            rootPages.push(pageWithChildren);
          }
        } else {
          rootPages.push(pageWithChildren);
        }
      });

      return rootPages;
    };

    return buildPageHierarchy(pages);
  }, [pages]); // Only recalculate when pages array changes

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = pages.findIndex((page) => page.id === active.id);
      const newIndex = pages.findIndex((page) => page.id === over.id);

      const reorderedPages = arrayMove(pages, oldIndex, newIndex);
      onReorderPages(reorderedPages);
    }
  };

  const handleToggleExpanded = (pageId: string) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(pageId)) {
      newExpanded.delete(pageId);
    } else {
      newExpanded.add(pageId);
    }
    setExpandedPages(newExpanded);
  };

  const handleEditPage = (page: Page) => {
    setRenamingPage(page);
    setNewPageTitle(page.title);
    setIsRenameDialogOpen(true);
  };

  const handleUpdatePageTitle = () => {
    if (renamingPage && newPageTitle.trim()) {
      onUpdatePage(renamingPage.id, { title: newPageTitle.trim() });
      setIsRenameDialogOpen(false);
      setRenamingPage(null);
      setNewPageTitle("");
    }
  };

  return (
    <div className={`w-80 bg-background border-r flex flex-col ${className}`}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Pages</h3>
          <Button variant="ghost" size="sm" onClick={() => onCreatePage()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {hierarchicalPages.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={flattenedPageIds}
                strategy={verticalListSortingStrategy}
              >
                {hierarchicalPages.map((page) => (
                  <SortablePageItem
                    key={page.id}
                    page={page}
                    isSelected={selectedPageId === page.id}
                    onSelect={onSelectPage}
                    onEdit={handleEditPage}
                    onDelete={onDeletePage}
                    onCreateSubpage={onCreatePage}
                    expandedPages={expandedPages}
                    onToggleExpanded={handleToggleExpanded}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm mb-2">No pages yet</p>
              <p className="text-xs mb-4">
                Create your first page to start taking notes!
              </p>
              <Button size="sm" onClick={() => onCreatePage()}>
                <Plus className="h-4 w-4 mr-1" />
                Create Page
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Page</DialogTitle>
            <DialogDescription>
              Enter a new title for this page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="page-title">Page Title</Label>
              <Input
                id="page-title"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                placeholder="Enter page title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdatePageTitle}>Update Title</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PageList;