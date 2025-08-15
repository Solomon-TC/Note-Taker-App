"use client";

// Safe JSON parsing utilities for Tiptap editor

export interface TiptapDocument {
  type: "doc";
  content?: TiptapNode[];
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export interface TiptapMark {
  type: string;
  attrs?: Record<string, any>;
}

/**
 * Default empty Tiptap document structure
 */
export const getDefaultDocument = (): TiptapDocument => ({
  type: "doc",
  content: [],
});

/**
 * Safely parse JSON content, falling back to default document
 */
export const safeJsonParse = (content: any): TiptapDocument => {
  // If already an object, validate and return
  if (typeof content === "object" && content !== null) {
    if (content.type === "doc") {
      return content as TiptapDocument;
    }
    // If it's an object but not a valid Tiptap doc, wrap it
    return getDefaultDocument();
  }

  // If it's a string, try to parse it
  if (typeof content === "string") {
    if (
      content.trim() === "" ||
      content === "null" ||
      content === "undefined"
    ) {
      return getDefaultDocument();
    }

    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object" && parsed.type === "doc") {
        return parsed as TiptapDocument;
      }
      // If parsed but not a valid Tiptap doc, create one with the text
      if (typeof parsed === "string") {
        return {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: parsed,
                },
              ],
            },
          ],
        };
      }
    } catch (error) {
      console.warn("Failed to parse JSON content:", error);
      // If it's a plain text string, create a paragraph with it
      return {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: content,
              },
            ],
          },
        ],
      };
    }
  }

  // Fallback to default document
  return getDefaultDocument();
};

/**
 * Deep equality check for Tiptap documents
 * Used to avoid redundant saves
 */
export const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;

  if (a == null || b == null) return a === b;

  if (typeof a !== typeof b) return false;

  if (typeof a !== "object") return a === b;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
};

/**
 * Validate that a document has the correct Tiptap structure
 */
export const validateTiptapDocument = (doc: any): doc is TiptapDocument => {
  if (!doc || typeof doc !== "object") return false;
  if (doc.type !== "doc") return false;
  if (doc.content && !Array.isArray(doc.content)) return false;
  return true;
};

/**
 * Extract plain text from a Tiptap document
 */
export const extractPlainText = (doc: TiptapDocument): string => {
  if (!doc.content) return "";

  const extractFromNode = (node: TiptapNode): string => {
    if (node.type === "text") {
      return node.text || "";
    }

    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractFromNode).join("");
    }

    return "";
  };

  return doc.content.map(extractFromNode).join("\n").trim();
};

/**
 * Create a debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};
