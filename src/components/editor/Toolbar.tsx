"use client";

import React, { useCallback, useState } from "react";
import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link,
  Unlink,
  Image,
  Table,
  Undo,
  Redo,
  Type,
  Heading1,
  Heading2,
  Heading3,
  RemoveFormatting,
  PenTool,
  Palette,
  Highlighter,
  Plus,
  Minus,
  MoreHorizontal,
} from "lucide-react";

interface ToolbarProps {
  editor: Editor;
  onInsertImage: () => void;
  onInsertDrawing: () => void;
}

const Toolbar = ({ editor, onInsertImage, onInsertDrawing }: ToolbarProps) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState(false);

  const addLink = useCallback(() => {
    if (!editor) return;

    try {
      const previousUrl = editor.getAttributes("link").href;
      const url = window.prompt("URL", previousUrl);

      // cancelled
      if (url === null) {
        return;
      }

      // empty
      if (url === "") {
        editor?.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }

      // update link
      editor
        ?.chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error adding link:", error);
      }
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;

    try {
      // Insert a Google Docs-like table with better default settings
      const tableConfig = {
        rows: 3,
        cols: 3,
        withHeaderRow: true,
        cellContent: "",
      };

      if (editor.can().insertTable(tableConfig)) {
        editor?.chain().focus().insertTable(tableConfig).run();
      } else {
        // Try to insert at a new paragraph
        editor
          ?.chain()
          .focus()
          .insertContent("\n")
          .insertTable(tableConfig)
          .run();
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error inserting table:", error);
      }
      // Fallback: try inserting at the end
      try {
        editor
          ?.chain()
          .focus()
          .command(({ tr, state, dispatch }) => {
            const { doc } = state;
            const pos = doc.content.size;
            const newTr = tr.insert(pos, state.schema.nodes.paragraph.create());
            if (dispatch) dispatch(newTr);
            return true;
          })
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      } catch (fallbackError) {
        if (process.env.NODE_ENV === "development") {
          console.error("Fallback table insertion failed:", fallbackError);
        }
        alert(
          "Could not insert table. Please try placing your cursor in a different location.",
        );
      }
    }
  }, [editor]);

  const addTableRow = useCallback(() => {
    if (!editor) return;
    editor?.chain().focus().addRowAfter().run();
  }, [editor]);

  const addTableColumn = useCallback(() => {
    if (!editor) return;
    editor?.chain().focus().addColumnAfter().run();
  }, [editor]);

  const deleteTableRow = useCallback(() => {
    if (!editor) return;
    editor?.chain().focus().deleteRow().run();
  }, [editor]);

  const deleteTableColumn = useCallback(() => {
    if (!editor) return;
    editor?.chain().focus().deleteColumn().run();
  }, [editor]);

  const deleteTable = useCallback(() => {
    if (!editor) return;
    editor?.chain().focus().deleteTable().run();
  }, [editor]);

  const isInTable = editor?.isActive("table") ?? false;
  const canAddRow = editor?.can().addRowAfter() ?? false;
  const canAddColumn = editor?.can().addColumnAfter() ?? false;
  const canDeleteRow = editor?.can().deleteRow() ?? false;
  const canDeleteColumn = editor?.can().deleteColumn() ?? false;
  const canDeleteTable = editor?.can().deleteTable() ?? false;

  const setFontFamily = useCallback(
    (fontFamily: string) => {
      if (!editor) return;

      try {
        if (fontFamily === "default") {
          editor?.chain().focus().unsetFontFamily().run();
        } else {
          editor?.chain().focus().setFontFamily(fontFamily).run();
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error setting font family:", error);
        }
      }
    },
    [editor],
  );

  const setTextColor = useCallback(
    (color: string) => {
      if (!editor) return;

      try {
        // First ensure we have a selection or create one
        const { from, to } = editor.state.selection;
        if (from === to) {
          // No selection, apply to current position for future typing
          editor?.chain().focus().setMark("textStyle", { color }).run();
        } else {
          // Apply to selected text
          editor?.chain().focus().setColor(color).run();
        }
        setIsColorPickerOpen(false);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error setting text color:", error);
        }
        // Fallback: try using textStyle mark directly
        try {
          editor?.chain().focus().setMark("textStyle", { color }).run();
        } catch (fallbackError) {
          if (process.env.NODE_ENV === "development") {
            console.error("Fallback text color failed:", fallbackError);
          }
        }
        setIsColorPickerOpen(false);
      }
    },
    [editor],
  );

  const setHighlightColor = useCallback(
    (color: string) => {
      if (!editor) return;

      try {
        // Check if highlight extension is available
        if (!editor.isActive || !editor.can().setHighlight) {
          if (process.env.NODE_ENV === "development") {
            console.warn("Highlight extension not available");
          }
          setIsHighlightPickerOpen(false);
          return;
        }

        // First ensure we have a selection or create one
        const { from, to } = editor.state.selection;
        if (from === to) {
          // No selection, apply to current position for future typing
          editor?.chain().focus().setMark("highlight", { color }).run();
        } else {
          // Apply to selected text - use correct color parameter
          editor?.chain().focus().setHighlight({ color }).run();
        }
        setIsHighlightPickerOpen(false);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error setting highlight color:", error);
        }
        // Fallback: try with color parameter (not backgroundColor)
        try {
          editor?.chain().focus().setHighlight({ color }).run();
        } catch (fallbackError) {
          if (process.env.NODE_ENV === "development") {
            console.error("Fallback highlight failed:", fallbackError);
          }
        }
        setIsHighlightPickerOpen(false);
      }
    },
    [editor],
  );

  const setFontSize = useCallback(
    (fontSize: string) => {
      if (!editor) return;

      try {
        if (fontSize === "default") {
          editor?.chain().focus().unsetFontSize().run();
        } else {
          editor?.chain().focus().setFontSize(fontSize).run();
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error setting font size:", error);
        }
      }
    },
    [editor],
  );

  const colors = [
    "#000000", // Black
    "#374151", // Gray 700
    "#6B7280", // Gray 500
    "#9CA3AF", // Gray 400
    "#D1D5DB", // Gray 300
    "#F3F4F6", // Gray 100
    "#EF4444", // Red 500
    "#F97316", // Orange 500
    "#EAB308", // Yellow 500
    "#22C55E", // Green 500
    "#06B6D4", // Cyan 500
    "#3B82F6", // Blue 500
    "#8B5CF6", // Violet 500
    "#EC4899", // Pink 500
    "#F59E0B", // Amber 500
    "#10B981", // Emerald 500
    "#0EA5E9", // Sky 500
    "#6366F1", // Indigo 500
  ];

  // Enhanced highlight colors with better visibility
  const highlightColors = [
    "#FEF3C7", // Yellow 100 - Classic highlight
    "#DBEAFE", // Blue 100
    "#D1FAE5", // Green 100
    "#FCE7F3", // Pink 100
    "#E0E7FF", // Indigo 100
    "#FED7D7", // Red 100
    "#FED7AA", // Orange 100
    "#E6FFFA", // Teal 100
    "#F0FDF4", // Green 50
    "#FDF2F8", // Pink 50
    "#EFF6FF", // Blue 50
    "#FFFBEB", // Amber 50
  ];

  const fontFamilies = [
    { label: "Default", value: "default" },
    { label: "Inter", value: "Inter, sans-serif" },
    { label: "Arial", value: "Arial, sans-serif" },
    { label: "Helvetica", value: "Helvetica, sans-serif" },
    { label: "Times New Roman", value: "Times New Roman, serif" },
    { label: "Georgia", value: "Georgia, serif" },
    { label: "Courier New", value: "Courier New, monospace" },
    { label: "Monaco", value: "Monaco, monospace" },
  ];

  const fontSizes = [
    { label: "Default", value: "default" },
    { label: "12px", value: "12px" },
    { label: "14px", value: "14px" },
    { label: "16px", value: "16px" },
    { label: "18px", value: "18px" },
    { label: "20px", value: "20px" },
    { label: "24px", value: "24px" },
    { label: "28px", value: "28px" },
    { label: "32px", value: "32px" },
    { label: "36px", value: "36px" },
    { label: "48px", value: "48px" },
  ];

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-b-0 rounded-t-lg bg-background p-2 flex flex-wrap gap-1 sticky top-0 z-10">
      <TooltipProvider>
        {/* Undo/Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={!editor?.can().chain().focus().undo().run()}
              className="h-8 w-8 p-0"
            >
              <Undo className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Undo (Ctrl+Z)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={!editor?.can().chain().focus().redo().run()}
              className="h-8 w-8 p-0"
            >
              <Redo className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Redo (Ctrl+Y)</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Text Formatting */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editor?.isActive("bold") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className="h-8 w-8 p-0"
            >
              <Bold className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Bold (Ctrl+B)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editor?.isActive("italic") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className="h-8 w-8 p-0"
            >
              <Italic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Italic (Ctrl+I)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editor?.isActive("underline") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              className="h-8 w-8 p-0"
            >
              <Underline className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Underline (Ctrl+U)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editor?.isActive("strike") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              className="h-8 w-8 p-0"
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Strikethrough</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Headings */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editor?.isActive("paragraph") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor?.chain().focus().setParagraph().run()}
              className="h-8 w-8 p-0"
            >
              <Type className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Paragraph</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={
                editor?.isActive("heading", { level: 1 }) ? "default" : "ghost"
              }
              size="sm"
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 1 }).run()
              }
              className="h-8 w-8 p-0"
            >
              <Heading1 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Heading 1</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={
                editor?.isActive("heading", { level: 2 }) ? "default" : "ghost"
              }
              size="sm"
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
              className="h-8 w-8 p-0"
            >
              <Heading2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Heading 2</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={
                editor?.isActive("heading", { level: 3 }) ? "default" : "ghost"
              }
              size="sm"
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 3 }).run()
              }
              className="h-8 w-8 p-0"
            >
              <Heading3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Heading 3</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Lists */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editor?.isActive("bulletList") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Bullet List</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editor?.isActive("orderedList") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className="h-8 w-8 p-0"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Numbered List</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editor?.isActive("taskList") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor?.chain().focus().toggleTaskList().run()}
              className="h-8 w-8 p-0"
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Task List</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Quote and Code */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editor?.isActive("blockquote") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              className="h-8 w-8 p-0"
            >
              <Quote className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Quote</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editor?.isActive("code") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor?.chain().focus().toggleCode().run()}
              className="h-8 w-8 p-0"
            >
              <Code className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Inline Code</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Alignment */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={
                editor?.isActive({ textAlign: "left" }) ? "default" : "ghost"
              }
              size="sm"
              onClick={() => editor?.chain().focus().setTextAlign("left").run()}
              className="h-8 w-8 p-0"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Align Left</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={
                editor?.isActive({ textAlign: "center" }) ? "default" : "ghost"
              }
              size="sm"
              onClick={() =>
                editor?.chain().focus().setTextAlign("center").run()
              }
              className="h-8 w-8 p-0"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Align Center</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={
                editor?.isActive({ textAlign: "right" }) ? "default" : "ghost"
              }
              size="sm"
              onClick={() =>
                editor?.chain().focus().setTextAlign("right").run()
              }
              className="h-8 w-8 p-0"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Align Right</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Links */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editor?.isActive("link") ? "default" : "ghost"}
              size="sm"
              onClick={addLink}
              className="h-8 w-8 p-0"
            >
              <Link className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add Link</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().unsetLink().run()}
              disabled={!editor?.isActive("link")}
              className="h-8 w-8 p-0"
            >
              <Unlink className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Remove Link</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Media */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onInsertImage}
              className="h-8 w-8 p-0"
            >
              <Image className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Insert Image</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onInsertDrawing}
              className="h-8 w-8 p-0"
            >
              <PenTool className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Insert Drawing</p>
          </TooltipContent>
        </Tooltip>

        {/* Table Controls */}
        {!isInTable ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={insertTable}
                className="h-8 w-8 p-0"
              >
                <Table className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Insert Table</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addTableRow}
                  disabled={!canAddRow}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add Row</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addTableColumn}
                  disabled={!canAddColumn}
                  className="h-8 w-8 p-0"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add Column</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deleteTableRow}
                  disabled={!canDeleteRow}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Minus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete Row</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deleteTable}
                  disabled={!canDeleteTable}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Table className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete Table</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Font and Color Options */}
        <div className="flex items-center gap-1">
          {/* Font Family */}
          <Select
            value={editor?.getAttributes("textStyle").fontFamily || "default"}
            onValueChange={setFontFamily}
          >
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Font" />
            </SelectTrigger>
            <SelectContent>
              {fontFamilies.map((font) => (
                <SelectItem key={font.value} value={font.value}>
                  <span
                    style={{
                      fontFamily:
                        font.value !== "default" ? font.value : undefined,
                    }}
                  >
                    {font.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Font Size */}
          <Select
            value={editor?.getAttributes("textStyle").fontSize || "default"}
            onValueChange={setFontSize}
          >
            <SelectTrigger className="w-20 h-8 text-xs">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              {fontSizes.map((size) => (
                <SelectItem key={size.value} value={size.value}>
                  <span
                    style={{
                      fontSize:
                        size.value !== "default" ? size.value : undefined,
                    }}
                  >
                    {size.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Text Color */}
          <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
            <PopoverTrigger asChild>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 relative"
                  >
                    <Palette className="h-4 w-4" />
                    <div
                      className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3 h-1 rounded-sm"
                      style={{
                        backgroundColor:
                          editor?.getAttributes("textStyle").color || "#000000",
                      }}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Text Color</p>
                </TooltipContent>
              </Tooltip>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2">
              <div className="grid grid-cols-6 gap-1">
                {colors.map((color) => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => setTextColor(color)}
                    title={color}
                  />
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => {
                  editor?.chain().focus().unsetColor().run();
                  setIsColorPickerOpen(false);
                }}
              >
                Remove Color
              </Button>
            </PopoverContent>
          </Popover>

          {/* Highlight Color */}
          <Popover
            open={isHighlightPickerOpen}
            onOpenChange={setIsHighlightPickerOpen}
          >
            <PopoverTrigger asChild>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={
                      editor?.isActive("highlight") ? "default" : "ghost"
                    }
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Highlighter className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Highlight</p>
                </TooltipContent>
              </Tooltip>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2">
              <div className="grid grid-cols-6 gap-1">
                {highlightColors.map((color) => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => setHighlightColor(color)}
                    title={color}
                  />
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => {
                  try {
                    editor?.chain().focus().unsetHighlight().run();
                  } catch (error) {
                    if (process.env.NODE_ENV === "development") {
                      console.error("Error removing highlight:", error);
                    }
                  }
                  setIsHighlightPickerOpen(false);
                }}
              >
                Remove Highlight
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Clear Formatting */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                try {
                  editor?.chain().focus().clearNodes().unsetAllMarks().run();
                } catch (error) {
                  if (process.env.NODE_ENV === "development") {
                    console.error("Error clearing formatting:", error);
                  }
                }
              }}
              className="h-8 w-8 p-0"
            >
              <RemoveFormatting className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Clear Formatting</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default Toolbar;
