// Page visibility types and augmentations for Scribly
// This file provides type safety for the new visibility feature

export type PageVisibility = "private" | "friends";

// Augmented Page type that includes the new visibility field
// This extends the Supabase generated types without breaking builds
export interface ScriblyPage {
  id: string;
  title: string;
  content: string | null;
  content_json: any | null;
  created_at: string | null;
  updated_at: string | null;
  user_id: string;
  section_id: string;
  parent_page_id: string | null;
  sort_order: number | null;
  visibility: PageVisibility; // NEW: Controls who can view this page
}

// Type guard to check if a visibility value is valid
export function isValidPageVisibility(value: string): value is PageVisibility {
  return value === "private" || value === "friends";
}

// Default visibility for new pages
export const DEFAULT_PAGE_VISIBILITY: PageVisibility = "private";
