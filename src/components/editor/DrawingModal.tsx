import React, { useEffect, useRef, useState } from "react";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import { storageService } from "@/lib/storage";
import { useAuth } from "@/components/auth/AuthProvider";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onInserted: (url: string) => void; // caller inserts into Tiptap with this URL
  noteId?: string; // Add noteId prop for proper storage organization
};

const CANVAS_HEIGHT_VH = 65;

export default function DrawingModal({
  isOpen,
  onClose,
  onInserted,
  noteId = "temp",
}: Props) {
  const { user } = useAuth();
  const canvasRef = useRef<ReactSketchCanvasRef>(null);

  // UI state
  const [eraseMode, setEraseMode] = useState(false);
  const [color, setColor] = useState("#111827");
  const [size, setSize] = useState(4);
  const [isUploading, setIsUploading] = useState(false);

  // Ensure eraser toggle actually switches mode on the canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    canvasRef.current.eraseMode(eraseMode);
  }, [eraseMode]);

  if (!isOpen) return null;

  // ---- Toolbar handlers ----
  const handlePen = () => setEraseMode(false);
  const handleEraser = () => setEraseMode(true);
  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const handleDelete = () => canvasRef.current?.clearCanvas(); // keep history
  const handleReset = () => canvasRef.current?.resetCanvas(); // clear history

  const handleInsert = async () => {
    if (!user) {
      alert("You must be logged in to save drawings.");
      return;
    }

    try {
      setIsUploading(true);

      // Export canvas as PNG data URL
      const dataUrl = await canvasRef.current?.exportImage("png");
      if (!dataUrl) {
        throw new Error("Failed to export drawing from canvas.");
      }

      // Convert data URL to blob using the storage service method
      const blob = storageService.dataURLToBlob(dataUrl);
      const filename = `drawing-${Date.now()}-${Math.random().toString(36).substring(2)}.png`;

      // Upload using the centralized storage service
      const uploadResult = await storageService.uploadBlob(
        blob,
        user.id,
        noteId,
        filename,
        "drawings",
      );

      // Insert the drawing into the editor
      onInserted(uploadResult.url);
      onClose();
    } catch (error) {
      console.error("Failed to insert drawing:", error);
      alert(
        `Failed to insert drawing: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl p-4 flex flex-col gap-3">
        {/* Toolbar (NOT overlapping the canvas) */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePen}
            className={`px-3 py-2 rounded-lg border ${!eraseMode ? "bg-blue-600 text-white" : "bg-white"}`}
            aria-label="Pen"
          >
            ✏️ Pen
          </button>
          <button
            type="button"
            onClick={handleEraser}
            className={`px-3 py-2 rounded-lg border ${eraseMode ? "bg-blue-600 text-white" : "bg-white"}`}
            aria-label="Eraser"
          >
            🧽 Eraser
          </button>

          <button
            type="button"
            onClick={handleUndo}
            className="px-3 py-2 rounded-lg border"
            aria-label="Undo"
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={handleRedo}
            className="px-3 py-2 rounded-lg border"
            aria-label="Redo"
          >
            ↷ Redo
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="px-3 py-2 rounded-lg border text-red-600"
            aria-label="Clear"
          >
            🗑 Clear
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-lg border"
            aria-label="Reset"
          >
            ⟲ Reset
          </button>

          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-2">
              <span>Color</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2">
              <span>Size</span>
              <input
                type="range"
                min={1}
                max={48}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
              <span className="tabular-nums w-6 text-right">{size}</span>
            </label>
          </div>
        </div>

        {/* Canvas (large and responsive; nothing overlaps it) */}
        <div className="rounded-2xl border overflow-hidden">
          <ReactSketchCanvas
            ref={canvasRef}
            className="block w-full"
            style={{ height: `${CANVAS_HEIGHT_VH}vh` }}
            strokeColor={color}
            strokeWidth={size}
            eraserWidth={Math.max(8, size + 4)}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={isUploading || !user}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Uploading...
              </>
            ) : (
              "Insert Drawing"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
