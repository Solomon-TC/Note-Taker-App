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

// Custom Image extension with interactive resize functionality
const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      objectKey: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-object-key"),
        renderHTML: (attributes) => {
          if (!attributes.objectKey) {
            return {};
          }
          return {
            "data-object-key": attributes.objectKey,
          };
        },
      },
      drawingId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-drawing-id"),
        renderHTML: (attributes) => {
          if (!attributes.drawingId) {
            return {};
          }
          return {
            "data-drawing-id": attributes.drawingId,
          };
        },
      },
      width: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("width") || element.style.width,
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {};
          }
          return {
            width: attributes.width,
            style: `width: ${attributes.width}`,
          };
        },
      },
      height: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("height") || element.style.height,
        renderHTML: (attributes) => {
          if (!attributes.height) {
            return {};
          }
          return {
            height: attributes.height,
            style: `height: ${attributes.height}`,
          };
        },
      },
    };
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement("div");
      container.className = "interactive-image-container relative inline-block";

      const img = document.createElement("img");
      img.src = node.attrs.src;
      img.alt = node.attrs.alt || "";
      img.className = "block rounded border max-w-full h-auto";
      img.draggable = false;

      // Apply dimensions if they exist
      if (node.attrs.width) {
        img.style.width = node.attrs.width;
      }
      if (node.attrs.height) {
        img.style.height = node.attrs.height;
      }

      container.appendChild(img);

      // Create resize handles
      const handles = [
        { position: "nw", cursor: "nw-resize" },
        { position: "ne", cursor: "ne-resize" },
        { position: "se", cursor: "se-resize" },
        { position: "sw", cursor: "sw-resize" },
        { position: "n", cursor: "n-resize" },
        { position: "e", cursor: "e-resize" },
        { position: "s", cursor: "s-resize" },
        { position: "w", cursor: "w-resize" },
      ];

      handles.forEach((handle) => {
        const handleEl = document.createElement("div");
        handleEl.className = `resize-handle ${handle.position} absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-sm opacity-0 transition-opacity duration-200 z-10`;
        handleEl.style.cursor = handle.cursor;

        // Position the handles
        switch (handle.position) {
          case "nw":
            handleEl.style.top = "-6px";
            handleEl.style.left = "-6px";
            break;
          case "n":
            handleEl.style.top = "-6px";
            handleEl.style.left = "50%";
            handleEl.style.transform = "translateX(-50%)";
            break;
          case "ne":
            handleEl.style.top = "-6px";
            handleEl.style.right = "-6px";
            break;
          case "e":
            handleEl.style.top = "50%";
            handleEl.style.right = "-6px";
            handleEl.style.transform = "translateY(-50%)";
            break;
          case "se":
            handleEl.style.bottom = "-6px";
            handleEl.style.right = "-6px";
            break;
          case "s":
            handleEl.style.bottom = "-6px";
            handleEl.style.left = "50%";
            handleEl.style.transform = "translateX(-50%)";
            break;
          case "sw":
            handleEl.style.bottom = "-6px";
            handleEl.style.left = "-6px";
            break;
          case "w":
            handleEl.style.top = "50%";
            handleEl.style.left = "-6px";
            handleEl.style.transform = "translateY(-50%)";
            break;
        }

        // Add resize functionality
        handleEl.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const startX = e.clientX;
          const startY = e.clientY;
          const startWidth = img.offsetWidth;
          const startHeight = img.offsetHeight;
          const aspectRatio = startWidth / startHeight;

          const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            let newWidth = startWidth;
            let newHeight = startHeight;

            switch (handle.position) {
              case "se":
                newWidth = Math.max(50, startWidth + deltaX);
                newHeight = Math.max(50, startHeight + deltaY);
                break;
              case "sw":
                newWidth = Math.max(50, startWidth - deltaX);
                newHeight = Math.max(50, startHeight + deltaY);
                break;
              case "ne":
                newWidth = Math.max(50, startWidth + deltaX);
                newHeight = Math.max(50, startHeight - deltaY);
                break;
              case "nw":
                newWidth = Math.max(50, startWidth - deltaX);
                newHeight = Math.max(50, startHeight - deltaY);
                break;
              case "e":
                newWidth = Math.max(50, startWidth + deltaX);
                newHeight = newWidth / aspectRatio;
                break;
              case "w":
                newWidth = Math.max(50, startWidth - deltaX);
                newHeight = newWidth / aspectRatio;
                break;
              case "s":
                newHeight = Math.max(50, startHeight + deltaY);
                newWidth = newHeight * aspectRatio;
                break;
              case "n":
                newHeight = Math.max(50, startHeight - deltaY);
                newWidth = newHeight * aspectRatio;
                break;
            }

            img.style.width = `${newWidth}px`;
            img.style.height = `${newHeight}px`;
          };

          const handleMouseUp = () => {
            // Use the editor's command API to update attributes
            // This is more reliable than calling updateAttributes directly
            const pos = getPos();
            if (typeof pos === "number" && editor && editor.view) {
              try {
                const transaction = editor.view.state.tr.setNodeMarkup(
                  pos,
                  undefined,
                  {
                    ...node.attrs,
                    width: img.style.width,
                    height: img.style.height,
                  },
                );
                editor.view.dispatch(transaction);
              } catch (error) {
                console.error("Error updating image attributes:", error);
              }
            }
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
          };

          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        });

        container.appendChild(handleEl);
      });

      // Show/hide handles on hover and selection
      const showHandles = () => {
        handles.forEach((_, index) => {
          const handleEl = container.children[index + 1] as HTMLElement;
          if (handleEl) {
            handleEl.style.opacity = "1";
          }
        });
      };

      const hideHandles = () => {
        handles.forEach((_, index) => {
          const handleEl = container.children[index + 1] as HTMLElement;
          if (handleEl) {
            handleEl.style.opacity = "0";
          }
        });
      };

      container.addEventListener("mouseenter", showHandles);
      container.addEventListener("mouseleave", hideHandles);

      return {
        dom: container,
        update: (updatedNode) => {
          if (updatedNode.type !== node.type) {
            return false;
          }

          // Update image attributes
          img.src = updatedNode.attrs.src;
          img.alt = updatedNode.attrs.alt || "";

          if (updatedNode.attrs.width) {
            img.style.width = updatedNode.attrs.width;
          }
          if (updatedNode.attrs.height) {
            img.style.height = updatedNode.attrs.height;
          }

          return true;
        },
        selectNode: () => {
          container.classList.add("ProseMirror-selectednode");
          showHandles();
        },
        deselectNode: () => {
          container.classList.remove("ProseMirror-selectednode");
          hideHandles();
        },
        destroy: () => {
          container.removeEventListener("mouseenter", showHandles);
          container.removeEventListener("mouseleave", hideHandles);
        },
      };
    };
  },
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
      StarterKit,
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
        allowBase64: true,
        HTMLAttributes: {
          class:
            "rounded border max-w-full h-auto block my-4 interactive-image",
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
      // Use type assertion to allow custom properties on editor storage
      (editor.storage as any).auth = { user };
      (editor.storage as any).noteId = noteId;
      (editor.storage as any).openDrawingModal = (
        drawingId?: string,
        pos?: number,
      ) => {
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
      editor.commands.setContent(newContent, { emitUpdate: false });
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

        // Only pass valid Tiptap Image properties (src, alt, title)
        // Store objectKey in the custom attributes via the CustomImage extension
        editor
          .chain()
          .focus()
          .setImage({
            src: uploadResult.url,
            alt: file.name,
            // Custom attributes are handled by the CustomImage extension
            objectKey: uploadResult.objectKey,
          } as any) // Type assertion for custom attributes
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
      // Only pass valid Tiptap Image properties, custom attributes handled by CustomImage extension
      editor
        .chain()
        .focus()
        .setImage({
          src: imageUrl,
          alt: "Drawing",
          drawingId: `drawing-${Date.now()}-${Math.random().toString(36).substring(2)}`,
        } as any) // Type assertion for custom attributes
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
