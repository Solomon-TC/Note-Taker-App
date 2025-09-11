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
      const { from, to } = editor.state.selection;
      const previousUrl = editor.getAttributes("link").href;
      const url = window.prompt("URL", previousUrl);

      // cancelled
      if (url === null) {
        return;
      }

      // empty - remove link
      if (url === "") {
        editor?.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }

      // If no text is selected, prompt for link text
      if (from === to) {
        const linkText = window.prompt("Link text", url);
        if (linkText === null) return;

        // Insert link with text
        editor
          ?.chain()
          .focus()
          .insertContent(`<a href="${url}">${linkText || url}</a>`)
          .run();
      } else {
        // Apply link to selected text
        editor
          ?.chain()
          .focus()
          .extendMarkRange("link")
          .setLink({ href: url })
          .run();
      }
    } catch (error) {
      console.error("Error adding link:", error);
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;

    try {
      console.log("Inserting table...");
      
      // Create a more flexible table with better default settings
      const tableConfig = {
        rows: 3,
        cols: 3,
        withHeaderRow: true,
        cellContent: "",
      };

      // First, try to insert the table directly
      if (editor.can().insertTable(tableConfig)) {
        const result = editor.chain().focus().insertTable(tableConfig).run();
        console.log("Table insertion result:", result);
        
        if (result) {
          console.log("Table inserted successfully");
          return;
        }
      }

      // If that fails, try inserting at a new paragraph
      console.log("Trying alternative table insertion method...");
      const result = editor
        .chain()
        .focus()
        .insertContent("\n")
        .insertTable(tableConfig)
        .run();
        
      console.log("Alternative table insertion result:", result);
      
      if (result) {
        console.log("Table inserted successfully with alternative method");
      } else {
        throw new Error("Both table insertion methods failed");
      }
    } catch (error) {
      console.error("Error inserting table:", error);
      alert(
        "Could not insert table. Please try placing your cursor in a different location or on a new line.",
      );
    }
  }, [editor]);

  const addTableRow = useCallback(() => {
    if (!editor) return;
    console.log("Adding table row...");
    const result = editor.chain().focus().addRowAfter().run();
    console.log("Add row result:", result);
  }, [editor]);

  const addTableColumn = useCallback(() => {
    if (!editor) return;
    console.log("Adding table column...");
    const result = editor.chain().focus().addColumnAfter().run();
    console.log("Add column result:", result);
  }, [editor]);

  const deleteTableRow = useCallback(() => {
    if (!editor) return;
    console.log("Deleting table row...");
    const result = editor.chain().focus().deleteRow().run();
    console.log("Delete row result:", result);
  }, [editor]);

  const deleteTableColumn = useCallback(() => {
    if (!editor) return;
    console.log("Deleting table column...");
    const result = editor.chain().focus().deleteColumn().run();
    console.log("Delete column result:", result);
  }, [editor]);

  const deleteTable = useCallback(() => {
    if (!editor) return;
    console.log("Deleting table...");
    const result = editor.chain().focus().deleteTable().run();
    console.log("Delete table result:", result);
  }, [editor]);

  // Enhanced table state detection with debugging
  const isInTable = editor?.isActive("table") ?? false;
  const canAddRow = editor?.can().addRowAfter() ?? false;
  const canAddColumn = editor?.can().addColumnAfter() ?? false;
  const canDeleteRow = editor?.can().deleteRow() ?? false;
  const canDeleteColumn = editor?.can().deleteColumn() ?? false;
  const canDeleteTable = editor?.can().deleteTable() ?? false;

  // Debug table state
  console.log("Table state:", {
    isInTable,
    canAddRow,
    canAddColumn,
    canDeleteRow,
    canDeleteColumn,
    canDeleteTable,
    currentSelection: editor?.state.selection,
  });

  const setFontSize = useCallback(
    (fontSize: string) => {
      if (!editor) return;

      try {
        if (fontSize === "default") {
          // Remove fontSize using unsetFontSize command
          editor.chain().focus().unsetFontSize().run();
        } else {
          // Set fontSize using setFontSize command
          editor.chain().focus().setFontSize(fontSize).run();
        }

        console.log("Font size applied:", { fontSize });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error setting font size:", error);
        }
      }
    },
    [editor],
  );

  const setFontFamily = useCallback(
    (fontFamily: string) => {
      if (!editor) return;

      try {
        if (fontFamily === "default") {
          // Remove fontFamily using unsetFontFamily command
          editor.chain().focus().unsetFontFamily().run();
        } else {
          // Set fontFamily using setFontFamily command
          editor.chain().focus().setFontFamily(fontFamily).run();
        }

        console.log("Font family applied:", { fontFamily });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error setting font family:", error);
        }
      }
    },
    [editor],
  );

  const applyTextColor = useCallback(
    (hex: string) => {
      if (!editor) {
        console.error("Text color: No editor available");
        return;
      }

      try {
        console.log("Applying text color:", hex);

        // Validate that the Color extension is available
        const hasColorExtension = editor.extensionManager.extensions.some(
          (ext) => ext.name === "color",
        );

        if (!hasColorExtension) {
          console.error("Color extension not found");
          alert(
            "Color extension is not available. Please check the editor configuration.",
          );
          return;
        }

        // Check if we have a selection
        const { from, to } = editor.state.selection;
        if (from === to) {
          console.log("No text selected, cannot apply color");
          alert("Please select some text first to apply color");
          return;
        }

        // Ensure the editor is focused
        if (!editor.isFocused) {
          editor.commands.focus();
        }

        console.log("Editor state before color:", {
          canSetColor: editor.can().setColor
            ? editor.can().setColor(hex)
            : false,
          hasSelection: from !== to,
          selectionLength: to - from,
          isFocused: editor.isFocused,
          hasColorExtension,
        });

        // Apply color using the Color extension with comprehensive error handling
        let result = false;

        try {
          result = editor.chain().focus().setColor(hex).run();
          console.log("Primary setColor result:", result);
        } catch (colorError) {
          console.error("Primary setColor failed:", colorError);
        }

        // If primary method failed, try alternative approaches
        if (!result) {
          console.log("Trying alternative color application methods...");

          try {
            // Method 2: Use setMark with textStyle
            result = editor
              .chain()
              .focus()
              .setMark("textStyle", { color: hex })
              .run();
            console.log("Alternative setMark result:", result);
          } catch (markError) {
            console.error("Alternative setMark failed:", markError);
          }

          // Method 3: Direct command execution
          if (!result) {
            try {
              result = editor.commands.setColor(hex);
              console.log("Direct command result:", result);
            } catch (directError) {
              console.error("Direct command failed:", directError);
            }
          }
        }

        if (result) {
          console.log("Successfully applied text color:", hex);
        } else {
          console.error("All color application methods failed");
          alert(
            "Failed to apply text color. Please try selecting the text again.",
          );
        }
      } catch (error) {
        console.error("Error applying text color:", error);
        alert(
          `Error applying text color: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      setIsColorPickerOpen(false);
    },
    [editor],
  );

  const clearTextColor = useCallback(() => {
    if (!editor) {
      console.log("Clear text color: No editor available");
      return;
    }

    try {
      console.log("Clearing text color");
      console.log("Editor state before clear:", {
        canUnsetColor: editor.can().unsetColor
          ? editor.can().unsetColor()
          : false,
        currentColor: editor.getAttributes("textStyle").color,
      });

      // CRITICAL FIX: Use unsetColor command from Color extension
      const result = editor.chain().focus().unsetColor().run();
      console.log("Clear text color command result:", result);

      if (result) {
        console.log("Cleared text color successfully");
      } else {
        console.error("Clear text color command failed");
      }
    } catch (error) {
      console.error("Error clearing text color:", error);
    }

    setIsColorPickerOpen(false);
  }, [editor]);

  const applyHighlight = useCallback(
    (hex: string) => {
      if (!editor) {
        console.error("Highlight: No editor available");
        return;
      }

      try {
        console.log("Applying highlight:", hex);

        // Validate that the Highlight extension is available
        const hasHighlightExtension = editor.extensionManager.extensions.some(
          (ext) => ext.name === "highlight",
        );

        if (!hasHighlightExtension) {
          console.error("Highlight extension not found");
          alert(
            "Highlight extension is not available. Please check the editor configuration.",
          );
          return;
        }

        // Check if we have a selection
        const { from, to } = editor.state.selection;
        if (from === to) {
          console.log("No text selected, cannot apply highlight");
          alert("Please select some text first to apply highlight");
          return;
        }

        // Ensure the editor is focused
        if (!editor.isFocused) {
          editor.commands.focus();
        }

        console.log("Editor state before highlight:", {
          canSetHighlight: editor.can().setHighlight
            ? editor.can().setHighlight({ color: hex })
            : false,
          hasSelection: from !== to,
          selectionLength: to - from,
          isFocused: editor.isFocused,
          hasHighlightExtension,
        });

        // Apply highlight using the Highlight extension with comprehensive error handling
        let result = false;

        try {
          result = editor.chain().focus().setHighlight({ color: hex }).run();
          console.log("Primary setHighlight result:", result);
        } catch (highlightError) {
          console.error("Primary setHighlight failed:", highlightError);
        }

        // If primary method failed, try alternative approaches
        if (!result) {
          console.log("Trying alternative highlight application methods...");

          try {
            // Method 2: Use toggleHighlight
            result = editor
              .chain()
              .focus()
              .toggleHighlight({ color: hex })
              .run();
            console.log("Alternative toggleHighlight result:", result);
          } catch (toggleError) {
            console.error("Alternative toggleHighlight failed:", toggleError);
          }

          // Method 3: Direct command execution
          if (!result) {
            try {
              result = editor.commands.setHighlight({ color: hex });
              console.log("Direct highlight command result:", result);
            } catch (directError) {
              console.error("Direct highlight command failed:", directError);
            }
          }
        }

        if (result) {
          console.log("Successfully applied highlight:", hex);
        } else {
          console.error("All highlight application methods failed");
          alert(
            "Failed to apply highlight. Please try selecting the text again.",
          );
        }
      } catch (error) {
        console.error("Error applying highlight:", error);
        alert(
          `Error applying highlight: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      setIsHighlightPickerOpen(false);
    },
    [editor],
  );

  const clearHighlight = useCallback(() => {
    if (!editor) {
      console.log("Clear highlight: No editor available");
      return;
    }

    try {
      console.log("Clearing highlight");
      console.log("Editor state before clear:", {
        canUnsetHighlight: editor.can().unsetHighlight(),
        isHighlightActive: editor.isActive("highlight"),
        currentHighlight: editor.getAttributes("highlight"),
      });

      const result = editor.chain().focus().unsetHighlight().run();
      console.log("Clear highlight command result:", result);

      if (result) {
        console.log("Cleared highlight successfully");
      } else {
        console.error("Clear highlight command failed");
      }
    } catch (error) {
      console.error("Error clearing highlight:", error);
    }

    setIsHighlightPickerOpen(false);
  }, [editor]);

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
    { label: "8pt", value: "8pt" },
    { label: "10pt", value: "10pt" },
    { label: "12pt", value: "12pt" },
    { label: "14pt", value: "14pt" },
    { label: "16pt", value: "16pt" },
    { label: "18pt", value: "18pt" },
    { label: "20pt", value: "20pt" },
    { label: "24pt", value: "24pt" },
    { label: "28pt", value: "28pt" },
    { label: "32pt", value: "32pt" },
    { label: "36pt", value: "36pt" },
    { label: "48pt", value: "48pt" },
  ];

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-b-0 rounded-t-lg bg-background p-2 flex flex-wrap gap-1 sticky top-0 z-10">
      {/* Undo/Redo */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor?.chain().focus().undo().run()}
        disabled={!editor?.can().chain().focus().undo().run()}
        className="h-8 w-8 p-0"
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor?.chain().focus().redo().run()}
        disabled={!editor?.can().chain().focus().redo().run()}
        className="h-8 w-8 p-0"
        aria-label="Redo"
        title="Redo (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Text Formatting */}
      <Button
        variant={editor?.isActive("bold") ? "default" : "ghost"}
        size="sm"
        onClick={() => editor?.chain().focus().toggleBold().run()}
        className="h-8 w-8 p-0"
        aria-label="Bold"
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Button>

      <Button
        variant={editor?.isActive("italic") ? "default" : "ghost"}
        size="sm"
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        className="h-8 w-8 p-0"
        aria-label="Italic"
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Button>

      <Button
        variant={editor?.isActive("underline") ? "default" : "ghost"}
        size="sm"
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
        className="h-8 w-8 p-0"
        aria-label="Underline"
        title="Underline (Ctrl+U)"
      >
        <Underline className="h-4 w-4" />
      </Button>

      <Button
        variant={editor?.isActive("strike") ? "default" : "ghost"}
        size="sm"
        onClick={() => editor?.chain().focus().toggleStrike().run()}
        className="h-8 w-8 p-0"
        aria-label="Strikethrough"
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Headings */}
      <Button
        variant={editor?.isActive("paragraph") ? "default" : "ghost"}
        size="sm"
        onClick={() => editor?.chain().focus().setParagraph().run()}
        className="h-8 w-8 p-0"
        aria-label="Paragraph"
        title="Paragraph"
      >
        <Type className="h-4 w-4" />
      </Button>

      <Button
        variant={
          editor?.isActive("heading", { level: 1 }) ? "default" : "ghost"
        }
        size="sm"
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 1 }).run()
        }
        className="h-8 w-8 p-0"
        aria-label="Heading 1"
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </Button>

      <Button
        variant={
          editor?.isActive("heading", { level: 2 }) ? "default" : "ghost"
        }
        size="sm"
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 2 }).run()
        }
        className="h-8 w-8 p-0"
        aria-label="Heading 2"
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>

      <Button
        variant={
          editor?.isActive("heading", { level: 3 }) ? "default" : "ghost"
        }
        size="sm"
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 3 }).run()
        }
        className="h-8 w-8 p-0"
        aria-label="Heading 3"
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Lists */}
      <Button
        variant={editor?.isActive("bulletList") ? "default" : "ghost"}
        size="sm"
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
        className="h-8 w-8 p-0"
        aria-label="Bullet List"
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </Button>

      <Button
        variant={editor?.isActive("orderedList") ? "default" : "ghost"}
        size="sm"
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        className="h-8 w-8 p-0"
        aria-label="Numbered List"
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>

      <Button
        variant={editor?.isActive("taskList") ? "default" : "ghost"}
        size="sm"
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
        className="h-8 w-8 p-0"
        aria-label="Task List"
        title="Task List"
      >
        <CheckSquare className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Quote and Code */}
      <Button
        variant={editor?.isActive("blockquote") ? "default" : "ghost"}
        size="sm"
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        className="h-8 w-8 p-0"
        aria-label="Quote"
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </Button>

      <Button
        variant={editor?.isActive("code") ? "default" : "ghost"}
        size="sm"
        onClick={() => editor?.chain().focus().toggleCode().run()}
        className="h-8 w-8 p-0"
        aria-label="Inline Code"
        title="Inline Code"
      >
        <Code className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Alignment */}
      <Button
        variant={
          editor?.isActive({ textAlign: "left" }) ? "default" : "ghost"
        }
        size="sm"
        onClick={() => editor?.chain().focus().setTextAlign("left").run()}
        className="h-8 w-8 p-0"
        aria-label="Align Left"
        title="Align Left"
      >
        <AlignLeft className="h-4 w-4" />
      </Button>

      <Button
        variant={
          editor?.isActive({ textAlign: "center" }) ? "default" : "ghost"
        }
        size="sm"
        onClick={() =>
          editor?.chain().focus().setTextAlign("center").run()
        }
        className="h-8 w-8 p-0"
        aria-label="Align Center"
        title="Align Center"
      >
        <AlignCenter className="h-4 w-4" />
      </Button>

      <Button
        variant={
          editor?.isActive({ textAlign: "right" }) ? "default" : "ghost"
        }
        size="sm"
        onClick={() =>
          editor?.chain().focus().setTextAlign("right").run()
        }
        className="h-8 w-8 p-0"
        aria-label="Align Right"
        title="Align Right"
      >
        <AlignRight className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Links */}
      <Button
        variant={editor?.isActive("link") ? "default" : "ghost"}
        size="sm"
        onClick={addLink}
        className="h-8 w-8 p-0"
        aria-label="Add Link"
        title="Add Link"
      >
        <Link className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor?.chain().focus().unsetLink().run()}
        disabled={!editor?.isActive("link")}
        className="h-8 w-8 p-0"
        aria-label="Remove Link"
        title="Remove Link"
      >
        <Unlink className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Media */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onInsertImage}
        className="h-8 w-8 p-0"
        aria-label="Insert Image"
        title="Insert Image"
      >
        <Image className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onInsertDrawing}
        className="h-8 w-8 p-0"
        aria-label="Insert Drawing"
        title="Insert Drawing"
      >
        <PenTool className="h-4 w-4" />
      </Button>

      {/* Table Controls */}
      {!isInTable ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={insertTable}
          className="h-8 w-8 p-0"
          aria-label="Insert Table"
          title="Insert Table (3x3)"
        >
          <Table className="h-4 w-4" />
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={addTableRow}
            disabled={!canAddRow}
            className="h-8 w-8 p-0"
            aria-label="Add Row"
            title="Add Row Below"
          >
            <Plus className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={addTableColumn}
            disabled={!canAddColumn}
            className="h-8 w-8 p-0"
            aria-label="Add Column"
            title="Add Column Right"
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={deleteTableRow}
            disabled={!canDeleteRow}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            aria-label="Delete Row"
            title="Delete Current Row"
          >
            <Minus className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={deleteTableColumn}
            disabled={!canDeleteColumn}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            aria-label="Delete Column"
            title="Delete Current Column"
          >
            <MoreHorizontal className="h-3 w-3 rotate-90" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={deleteTable}
            disabled={!canDeleteTable}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            aria-label="Delete Table"
            title="Delete Entire Table"
          >
            <Table className="h-3 w-3" />
          </Button>
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
          value={editor?.getAttributes("textStyle").fontSize || "12pt"}
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
                    fontSize: size.value !== "default" ? size.value : undefined,
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
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 relative"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                // If shift key is held, apply default black color directly
                if (e.shiftKey) {
                  applyTextColor("#000000");
                  return;
                }

                // Toggle the color picker
                setIsColorPickerOpen(!isColorPickerOpen);
              }}
              aria-label="Text Color"
              title="Text Color"
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
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3">
            <div className="space-y-3">
              {/* Native Color Picker */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="text-color-picker"
                  className="text-sm font-medium"
                >
                  Choose Color:
                </label>
                <input
                  id="text-color-picker"
                  type="color"
                  value={
                    editor?.getAttributes("textStyle").color || "#000000"
                  }
                  onChange={(e) => applyTextColor(e.target.value)}
                  className="w-8 h-8 rounded border border-border cursor-pointer"
                />
              </div>

              {/* Preset Colors */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Quick Colors:
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {colors.map((color) => (
                    <button
                      key={color}
                      className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      onClick={() => applyTextColor(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={clearTextColor}
              >
                Remove Color
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight Color */}
        <Popover
          open={isHighlightPickerOpen}
          onOpenChange={setIsHighlightPickerOpen}
        >
          <PopoverTrigger asChild>
            <Button
              variant={editor?.isActive("highlight") ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0 relative"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                // If shift key is held, apply default yellow highlight directly
                if (e.shiftKey) {
                  applyHighlight("#FEF3C7");
                  return;
                }

                // Toggle the highlight picker
                setIsHighlightPickerOpen(!isHighlightPickerOpen);
              }}
              aria-label="Highlight"
              title="Highlight"
            >
              <Highlighter className="h-4 w-4" />
              {editor?.isActive("highlight") && (
                <div
                  className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3 h-1 rounded-sm"
                  style={{
                    backgroundColor:
                      editor?.getAttributes("highlight").color || "#FEF3C7",
                  }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3">
            <div className="space-y-3">
              {/* Native Color Picker */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="highlight-color-picker"
                  className="text-sm font-medium"
                >
                  Choose Color:
                </label>
                <input
                  id="highlight-color-picker"
                  type="color"
                  value={
                    editor?.getAttributes("highlight").color || "#FEF3C7"
                  }
                  onChange={(e) => applyHighlight(e.target.value)}
                  className="w-8 h-8 rounded border border-border cursor-pointer"
                />
              </div>

              {/* Preset Highlight Colors */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Quick Highlights:
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {highlightColors.map((color) => (
                    <button
                      key={color}
                      className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      onClick={() => applyHighlight(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={clearHighlight}
              >
                Remove Highlight
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Clear Formatting */}
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
        aria-label="Clear Formatting"
        title="Clear Formatting"
      >
        <RemoveFormatting className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default Toolbar;