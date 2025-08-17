import React, { useEffect, useRef, useState } from "react";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import { storageService } from "@/lib/storage";
import { useAuth } from "@/components/auth/AuthProvider";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onInserted: (url: string, objectKey?: string) => void; // caller inserts into Tiptap with this URL and objectKey
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

  // Function to automatically crop the canvas to fit the drawing content
  const cropCanvasToContent = (
    canvas: HTMLCanvasElement,
  ): HTMLCanvasElement => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;

    // Find the bounding box of non-transparent pixels
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const alpha = data[(y * canvas.width + x) * 4 + 3];
        if (alpha > 0) {
          // Non-transparent pixel
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // If no content found, return original canvas
    if (minX >= maxX || minY >= maxY) {
      return canvas;
    }

    // Add some padding around the content
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width, maxX + padding);
    maxY = Math.min(canvas.height, maxY + padding);

    const width = maxX - minX;
    const height = maxY - minY;

    // Create a new canvas with the cropped dimensions
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = width;
    croppedCanvas.height = height;
    const croppedCtx = croppedCanvas.getContext("2d");

    if (croppedCtx) {
      // Copy the cropped region to the new canvas
      croppedCtx.drawImage(
        canvas,
        minX,
        minY,
        width,
        height,
        0,
        0,
        width,
        height,
      );
    }

    return croppedCanvas;
  };

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

      // Create a temporary canvas to crop the image
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      const img = new Image();

      await new Promise((resolve, reject) => {
        img.onload = () => {
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          tempCtx?.drawImage(img, 0, 0);
          resolve(null);
        };
        img.onerror = reject;
        img.src = dataUrl;
      });

      // Crop the canvas to fit the content
      const croppedCanvas = cropCanvasToContent(tempCanvas);
      const croppedDataUrl = croppedCanvas.toDataURL("image/png");

      // Convert cropped data URL to blob
      const blob = storageService.dataURLToBlob(croppedDataUrl);
      const filename = `drawing-${Date.now()}-${Math.random().toString(36).substring(2)}.png`;

      // Upload using the centralized storage service
      const uploadResult = await storageService.uploadBlob(
        blob,
        user.id,
        noteId,
        filename,
        "drawings",
      );

      console.log("DrawingModal: Upload successful:", {
        url: uploadResult.url,
        objectKey: uploadResult.objectKey,
        path: uploadResult.path,
        noteId,
      });

      // Insert the drawing into the editor with both URL and objectKey
      onInserted(uploadResult.url, uploadResult.objectKey);
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
