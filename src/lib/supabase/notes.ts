"use client";

import { createClient } from "@/lib/supabase-client";
import { Database } from "@/types/supabase";
import { safeJsonParse, type TiptapDocument } from "@/lib/editor/json";

type Page = Database["public"]["Tables"]["pages"]["Row"];
type PageInsert = Database["public"]["Tables"]["pages"]["Insert"];
type PageUpdate = Database["public"]["Tables"]["pages"]["Update"];

/**
 * Get a page by ID with proper JSON parsing
 */
export const getPage = async (
  pageId: string,
  userId: string,
): Promise<Page | null> => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("id", pageId)
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching page:", error);
    return null;
  }

  return data;
};

/**
 * Update page content with proper JSON handling and comprehensive error handling
 */
export const updatePageContent = async (
  pageId: string,
  userId: string,
  updates: {
    title?: string;
    content?: string;
    content_json?: TiptapDocument;
  },
): Promise<Page | null> => {
  const supabase = createClient();

  try {
    // Validate inputs
    if (!pageId || !userId) {
      throw new Error("Page ID and User ID are required");
    }

    const updateData: PageUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) {
      updateData.title = updates.title;
    }

    if (updates.content !== undefined) {
      updateData.content = updates.content;
    }

    if (updates.content_json !== undefined) {
      // Validate the Tiptap document structure
      const validatedJson = safeJsonParse(updates.content_json);
      updateData.content_json = validatedJson as any;
    }

    console.log("Updating page with data:", {
      pageId,
      userId,
      updateKeys: Object.keys(updateData),
      hasContentJson: !!updateData.content_json,
    });

    const { data, error } = await supabase
      .from("pages")
      .update(updateData)
      .eq("id", pageId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Supabase error updating page:", {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        pageId,
        userId,
      });

      // Handle specific error cases
      if (error.code === "42703") {
        throw new Error(
          `Database schema error: ${error.message}. The content_json column may be missing.`,
        );
      }

      if (error.code === "PGRST116") {
        throw new Error(
          `No rows found to update. Page ${pageId} may not exist or you may not have permission.`,
        );
      }

      throw error;
    }

    if (!data) {
      throw new Error("No data returned from update operation");
    }

    console.log("Successfully updated page:", pageId);
    return data;
  } catch (error) {
    console.error("Error in updatePageContent:", {
      error,
      pageId,
      userId,
      updateKeys: updates ? Object.keys(updates) : [],
    });
    throw error;
  }
};

/**
 * Create a new page with proper JSON handling
 */
export const createPage = async (
  userId: string,
  pageData: {
    section_id: string;
    title: string;
    content?: string;
    content_json?: TiptapDocument;
    parent_page_id?: string;
    sort_order?: number;
  },
): Promise<Page | null> => {
  const supabase = createClient();

  const insertData: PageInsert = {
    user_id: userId,
    section_id: pageData.section_id,
    title: pageData.title,
    content: pageData.content || "",
    content_json: (pageData.content_json as any) || {
      type: "doc",
      content: [],
    },
    parent_page_id: pageData.parent_page_id || null,
    sort_order: pageData.sort_order || 0,
  };

  const { data, error } = await supabase
    .from("pages")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Error creating page:", error);
    throw error;
  }

  return data;
};

/**
 * Get pages for a section with proper JSON parsing
 */
export const getPagesBySection = async (
  sectionId: string,
  userId: string,
): Promise<Page[]> => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("section_id", sectionId)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching pages:", error);
    return [];
  }

  return data || [];
};

/**
 * Delete a page
 */
export const deletePage = async (
  pageId: string,
  userId: string,
): Promise<boolean> => {
  const supabase = createClient();

  const { error } = await supabase
    .from("pages")
    .delete()
    .eq("id", pageId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting page:", error);
    return false;
  }

  return true;
};
