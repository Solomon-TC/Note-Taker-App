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
// FontSize extension removed - package not available
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
      // Base extensions first
      StarterKit.configure({}),

      // CRITICAL: Load TextStyle first as the foundation for all text styling
      TextStyle.configure({
        HTMLAttributes: {
          class: "text-style",
        },
      }),

      // CRITICAL: Load Color extension with proper configuration
      Color.configure({
        types: ["textStyle"],
      }),

      // CRITICAL: Load Highlight extension independently with proper config
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: {
          class: "highlight",
        },
      }),

      // CRITICAL: Load font extensions with proper configuration
      FontFamily.configure({
        types: ["textStyle"],
      }),
      // FontSize extension removed - package not available

      // Other formatting extensions
      Underline,
      Strike,

      // Link extension
      Link.configure({
        openOnClick: true,
        autolink: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          class: "tiptap-link",
        },
        linkOnPaste: true,
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
        lastColumnResizable: false,
        HTMLAttributes: {
          class: "tiptap-table border-collapse border border-gray-300 w-full my-4",
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: "tiptap-table-row border border-gray-300",
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: "tiptap-table-header border border-gray-300 bg-gray-50 font-semibold p-2 text-left",
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: "tiptap-table-cell border border-gray-300 p-2 min-w-[100px]",
        },
      }),
      Dropcursor,
      Gapcursor,
      CharacterCount,
      TaskList.configure({
        HTMLAttributes: {
          class: "task-list",
        },
        itemTypeName: "taskItem",
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "task-item",
        },
        onReadOnlyChecked: (node, checked) => {
          return checked;
        },
      }),

      // Block-level extensions
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

      // CRITICAL: Debug extension loading and validate configuration
      const extensionInfo = {
        hasTextStyle: !!editor.extensionManager.extensions.find(
          (ext) => ext.name === "textStyle",
        ),
        hasColor: !!editor.extensionManager.extensions.find(
          (ext) => ext.name === "color",
        ),
        hasHighlight: !!editor.extensionManager.extensions.find(
          (ext) => ext.name === "highlight",
        ),
        extensionNames: editor.extensionManager.extensions.map(
          (ext) => ext.name,
        ),
        canSetColor: false,
        canSetHighlight: false,
        currentAttributes: {
          textStyle: editor.getAttributes("textStyle"),
          highlight: editor.getAttributes("highlight"),
        },
      };

      // Safely check command availability
      try {
        extensionInfo.canSetColor = editor.can().setColor
          ? editor.can().setColor("#ff0000")
          : false;
      } catch (error) {
        console.warn("Cannot check setColor capability:", error);
      }

      try {
        extensionInfo.canSetHighlight = editor.can().setHighlight
          ? editor.can().setHighlight({ color: "#ffff00" })
          : false;
      } catch (error) {
        console.warn("Cannot check setHighlight capability:", error);
      }

      console.log("TiptapEditor: Extensions loaded:", extensionInfo);

      // Validate critical extensions
      if (!extensionInfo.hasTextStyle) {
        console.error(
          "CRITICAL: TextStyle extension not found! Color functionality will not work.",
        );
      }
      if (!extensionInfo.hasColor) {
        console.error(
          "CRITICAL: Color extension not found! Text color functionality will not work.",
        );
      }
      if (!extensionInfo.hasHighlight) {
        console.error(
          "CRITICAL: Highlight extension not found! Highlight functionality will not work.",
        );
      }
    }
  }, [editor, user, noteId]);

  // Update content when noteId or content changes - CRITICAL for preventing content bleeding
  useEffect(() => {
    if (!editor || !noteId) return;

    console.log("TiptapEditor: noteId/content changed, updating content:", {
      noteId,
      hasContent: !!content,
      contentType: typeof content,
    });

    const newContent = safeJsonParse(content);
    const currentContent = editor.getJSON() as TiptapDocument;

    console.log("TiptapEditor: Content comparison:", {
      noteId,
      newContentNodes: newContent.content?.length || 0,
      currentContentNodes: currentContent.content?.length || 0,
      areEqual: deepEqual(newContent, currentContent),
      isSettingContent: isSettingContentRef.current,
    });

    // Always set content when noteId changes OR when content is different
    // This ensures each page gets its own isolated content
    if (
      !isSettingContentRef.current &&
      !deepEqual(newContent, currentContent)
    ) {
      isSettingContentRef.current = true;

      console.log("TiptapEditor: Setting content for noteId:", noteId);

      // Use a timeout to ensure the flag is reset even if setContent fails
      const resetTimeout = setTimeout(() => {
        isSettingContentRef.current = false;
      }, 300);

      try {
        // CRITICAL: Always clear editor completely first
        editor.commands.clearContent(false);

        // Add a small delay to ensure clearing is complete
        setTimeout(() => {
          try {
            // Then set the new content - use JSON format to preserve marks
            editor.commands.setContent(newContent, { emitUpdate: false });
            lastContentRef.current = newContent;

            console.log(
              "TiptapEditor: Successfully set content for noteId:",
              noteId,
            );
          } catch (error) {
            console.error(
              "TiptapEditor: Error setting content (delayed):",
              error,
            );
          }
        }, 10);
      } catch (error) {
        console.error("TiptapEditor: Error clearing content:", error);
      } finally {
        clearTimeout(resetTimeout);
        isSettingContentRef.current = false;
      }
    }
  }, [editor, noteId, content]); // Depend on both noteId and content for proper isolation

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor || !user) {
        console.error("Cannot upload image: missing editor or user");
        alert("Cannot upload image: Please ensure you're logged in and the editor is ready.");
        return;
      }

      try {
        console.log("Starting image upload:", {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          userId: user.id,
          noteId,
        });

        // Show loading state
        const loadingToast = document.createElement("div");
        loadingToast.textContent = "Uploading image...";
        loadingToast.className = "fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg z-50";
        document.body.appendChild(loadingToast);

        const uploadResult = await storageService.uploadFile(
          file,
          user.id,
          noteId,
          "images",
        );

        console.log("Image upload successful:", uploadResult);

        // Remove loading toast
        document.body.removeChild(loadingToast);

        // Insert image into editor with proper attributes
        const insertResult = editor
          .chain()
          .focus()
          .setImage({
            src: uploadResult.url,
            alt: file.name,
            title: file.name,
            objectKey: uploadResult.objectKey,
          } as any)
          .run();

        console.log("Image insertion result:", insertResult);

        if (insertResult) {
          console.log("Image successfully inserted into editor");
          // Show success message
          const successToast = document.createElement("div");
          successToast.textContent = "Image uploaded successfully!";
          successToast.className = "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50";
          document.body.appendChild(successToast);
          setTimeout(() => {
            if (document.body.contains(successToast)) {
              document.body.removeChild(successToast);
            }
          }, 3000);
        } else {
          throw new Error("Failed to insert image into editor");
        }
      } catch (error) {
        console.error("Failed to upload image:", error);
        
        // Remove any existing loading toast
        const existingToast = document.querySelector(".fixed.top-4.right-4");
        if (existingToast) {
          document.body.removeChild(existingToast);
        }

        // Show error message
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        alert(`Failed to upload image: ${errorMessage}`);
      }
    },
    [editor, user, noteId],
  );

  const handleInsertImage = useCallback(() => {
    console.log("Insert image button clicked");
    
    if (!editor || !user) {
      console.error("Cannot insert image: missing editor or user");
      alert("Cannot insert image: Please ensure you're logged in and the editor is ready.");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = false;
    
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      
      console.log("File selected:", {
        hasFile: !!file,
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type,
      });
      
      if (file) {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          alert("Please select a valid image file.");
          return;
        }
        
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert("Image file is too large. Please select a file smaller than 10MB.");
          return;
        }
        
        handleImageUpload(file);
      } else {
        console.log("No file selected");
      }
    };
    
    input.onerror = (error) => {
      console.error("File input error:", error);
      alert("Error accessing file. Please try again.");
    };
    
    // Trigger file selection
    input.click();
  }, [handleImageUpload, editor, user]);

  const handleInsertDrawing = useCallback(() => {
    console.log("Insert drawing button clicked");
    
    if (!editor || !user) {
      console.error("Cannot insert drawing: missing editor or user");
      alert("Cannot insert drawing: Please ensure you're logged in and the editor is ready.");
      return;
    }

    console.log("Opening drawing modal:", {
      editorReady: !!editor,
      userReady: !!user,
      noteId,
    });

    setEditingDrawingId(null);
    setEditingDrawingPos(null);
    setIsDrawingModalOpen(true);
  }, [editor, user, noteId]);

  const handleDrawingInserted = useCallback(
    (imageUrl: string, objectKey?: string) => {
      if (!editor) {
        console.error("Cannot insert drawing: editor not available");
        alert("Cannot insert drawing: Editor not ready. Please try again.");
        return;
      }

      console.log("TiptapEditor: Inserting drawing:", {
        imageUrl,
        objectKey,
        noteId,
        editorReady: !!editor,
        editorFocused: editor.isFocused,
      });

      try {
        // Ensure editor is focused before inserting
        if (!editor.isFocused) {
          editor.commands.focus();
        }

        // Insert the drawing image at the current cursor position
        const insertResult = editor
          .chain()
          .focus()
          .setImage({
            src: imageUrl,
            alt: "Drawing",
            title: "Drawing",
            objectKey: objectKey,
            drawingId: `drawing-${Date.now()}-${Math.random().toString(36).substring(2)}`,
          } as any)
          .run();

        console.log("Drawing insertion result:", insertResult);

        if (insertResult) {
          console.log("TiptapEditor: Drawing inserted successfully");
          
          // Show success message
          const successToast = document.createElement("div");
          successToast.textContent = "Drawing inserted successfully!";
          successToast.className = "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50";
          document.body.appendChild(successToast);
          setTimeout(() => {
            if (document.body.contains(successToast)) {
              document.body.removeChild(successToast);
            }
          }, 3000);
        } else {
          throw new Error("Failed to insert drawing into editor");
        }
      } catch (error) {
        console.error("Error inserting drawing:", error);
        alert(`Failed to insert drawing: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },
    [editor, noteId],
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