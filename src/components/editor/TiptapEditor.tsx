"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import CharacterCount from "@tiptap/extension-character-count";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Blockquote from "@tiptap/extension-blockquote";
import Code from "@tiptap/extension-code";
import Strike from "@tiptap/extension-strike";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
// Custom FontSize extension
const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize.replace(/["']/g, ""),
        renderHTML: (attributes) => {
          if (!attributes.fontSize) {
            return {};
          }
          return {
            style: `font-size: ${attributes.fontSize}`,
          };
        },
      },
    };
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run();
        },
    };
  },
});
import { storageService } from "@/lib/storage";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  safeJsonParse,
  getDefaultDocument,
  deepEqual,
  debounce,
  type TiptapDocument,
} from "@/lib/editor/json";
import DrawingModal from "./DrawingModal";
import Toolbar from "./Toolbar";
import StatusBar from "./StatusBar";

// Custom Image extension with drawing support - simplified to fix rendering issues
const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      objectKey: {
        default: null,
      },
      drawingId: {
        default: null,
      },
    };
  },
  // Remove custom node view to fix image rendering issues
  // Images will now render normally as HTML img elements
});

interface TiptapEditorProps {
  content?: any;
  onChange?: (content: TiptapDocument) => void;
  onTitleChange?: (title: string) => void;
  noteId: string;
  placeholder?: string;
  className?: string;
}

const TiptapEditor = ({
  content,
  onChange,
  onTitleChange,
  noteId,
  placeholder = "Start typing...",
  className = "",
}: TiptapEditorProps) => {
  const { user } = useAuth();
  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
  const [editingDrawingId, setEditingDrawingId] = useState<string | null>(null);
  const [editingDrawingPos, setEditingDrawingPos] = useState<number | null>(
    null,
  );

  // Track the last saved content to avoid redundant onChange calls
  const lastContentRef = useRef<TiptapDocument | null>(null);
  const isSettingContentRef = useRef(false);

  // Debounced onChange to prevent excessive updates
  const debouncedOnChange = useRef(
    debounce((newContent: TiptapDocument) => {
      if (!deepEqual(newContent, lastContentRef.current)) {
        lastContentRef.current = newContent;
        onChange?.(newContent);
      }
    }, 100),
  ).current;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Configure paragraph to keep marks and attributes
        paragraph: {
          keepMarks: true,
          keepAttributes: true,
        },
        // Configure lists to keep marks and attributes
        orderedList: {
          keepMarks: true,
          keepAttributes: true,
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: true,
        },
        listItem: {
          keepMarks: true,
          keepAttributes: true,
        },
        history: {
          depth: 50,
        },
      }),
      Underline,
      Strike,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      TextAlign.configure({
        types: [
          "heading",
          "paragraph",
          "listItem",
          "bulletList",
          "orderedList",
        ],
      }),
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
        showOnlyCurrent: false,
      }),
      CustomImage.configure({
        inline: false,
        HTMLAttributes: {
          class: "rounded border max-w-full h-auto block my-4",
        },
      }),
      Table.configure({
        resizable: true,
        allowTableNodeSelection: true,
        HTMLAttributes: {
          class: "tiptap-table",
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: "tiptap-table-row",
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: "tiptap-table-header",
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: "tiptap-table-cell",
        },
      }),
      Dropcursor,
      Gapcursor,
      CharacterCount,
      TaskList.configure({
        HTMLAttributes: {
          class: "task-list",
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "task-item",
        },
      }),
      TextStyle,
      FontFamily.configure({
        types: ["textStyle"],
      }),
      FontSize,
      Color.configure({
        types: ["textStyle"],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Blockquote,
      Code,
    ],
    content: safeJsonParse(content),
    onUpdate: ({ editor }) => {
      // Prevent onChange during programmatic content setting
      if (isSettingContentRef.current) {
        return;
      }

      const json = editor.getJSON() as TiptapDocument;

      // Use debounced onChange to prevent excessive updates
      debouncedOnChange(json);

      // Auto-generate title from first heading or paragraph
      if (onTitleChange) {
        const firstNode = json.content?.[0];
        if (
          firstNode &&
          (firstNode.type === "heading" || firstNode.type === "paragraph")
        ) {
          const text = firstNode.content?.[0]?.text || "";
          if (text.trim()) {
            onTitleChange(text.substring(0, 100));
          }
        }
      }
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[400px] p-4 prose-lists",
        spellcheck: "false",
      },
      handleDrop: (view, event, slice, moved) => {
        if (
          !moved &&
          event.dataTransfer &&
          event.dataTransfer.files &&
          event.dataTransfer.files[0]
        ) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            handleImageUpload(file);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event, slice) => {
        const items = Array.from(event.clipboardData?.items || []);
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              handleImageUpload(file);
            }
            return true;
          }
        }
        return false;
      },
    },
  });

  // Store auth and noteId in editor storage for custom extensions
  useEffect(() => {
    if (editor) {
      editor.storage.auth = { user };
      editor.storage.noteId = noteId;
      editor.storage.openDrawingModal = (drawingId?: string, pos?: number) => {
        setEditingDrawingId(drawingId || null);
        setEditingDrawingPos(pos || null);
        setIsDrawingModalOpen(true);
      };
    }
  }, [editor, user, noteId]);

  // Update content when prop changes (only when noteId changes or initial load)
  useEffect(() => {
    if (!editor) return;

    const newContent = safeJsonParse(content);
    const currentContent = editor.getJSON() as TiptapDocument;

    // Only set content if it's actually different and we're not in the middle of setting content
    if (
      !deepEqual(newContent, currentContent) &&
      !isSettingContentRef.current
    ) {
      isSettingContentRef.current = true;

      // Use a timeout to ensure the flag is reset even if setContent fails
      setTimeout(() => {
        isSettingContentRef.current = false;
      }, 100);

      // Set content without emitting update events to prevent feedback loops
      editor.commands.setContent(newContent, false);
      lastContentRef.current = newContent;
    }
  }, [editor, noteId]); // Only depend on noteId, not content

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor || !user) return;

      try {
        const uploadResult = await storageService.uploadFile(
          file,
          user.id,
          noteId,
          "images",
        );

        editor
          .chain()
          .focus()
          .setImage({
            src: uploadResult.url,
            alt: file.name,
            objectKey: uploadResult.objectKey,
          })
          .run();
      } catch (error) {
        console.error("Failed to upload image:", error);
        alert(
          `Failed to upload image: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
    [editor, user, noteId],
  );

  const handleInsertImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleImageUpload(file);
      }
    };
    input.click();
  }, [handleImageUpload]);

  const handleInsertDrawing = useCallback(() => {
    setEditingDrawingId(null);
    setEditingDrawingPos(null);
    setIsDrawingModalOpen(true);
  }, []);

  const handleDrawingInserted = useCallback(
    (imageUrl: string) => {
      if (!editor) return;

      // Insert the drawing image at the current cursor position
      editor
        .chain()
        .focus()
        .setImage({
          src: imageUrl,
          alt: "Drawing",
          drawingId: `drawing-${Date.now()}-${Math.random().toString(36).substring(2)}`,
        })
        .run();
    },
    [editor],
  );

  const handleDrawingModalClose = useCallback(() => {
    setIsDrawingModalOpen(false);
    setEditingDrawingId(null);
    setEditingDrawingPos(null);
  }, []);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <Toolbar
        editor={editor}
        onInsertImage={handleInsertImage}
        onInsertDrawing={handleInsertDrawing}
      />

      <div className="border-x border-b rounded-b-lg">
        <EditorContent editor={editor} className="min-h-[400px]" />
      </div>

      <StatusBar editor={editor} />

      <DrawingModal
        isOpen={isDrawingModalOpen}
        onClose={handleDrawingModalClose}
        onInserted={handleDrawingInserted}
        noteId={noteId}
      />
    </div>
  );
};

export default TiptapEditor;
