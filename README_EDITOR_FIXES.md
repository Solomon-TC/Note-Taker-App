# Tiptap Editor Fixes - Save/Load Pipeline

## Overview
This document explains the comprehensive fixes applied to resolve Tiptap editor issues with formatting persistence and list functionality.

## Key Changes Made

### 1. Database Schema Fix
- **Migration**: `20240322000009_fix_pages_content_json_type.sql`
- **Purpose**: Ensures `pages.content_json` is JSONB type with proper defaults
- **Safety**: Idempotent migration that safely converts existing data

### 2. JSON Utilities (`src/lib/editor/json.ts`)
- **Safe Parsing**: `safeJsonParse()` handles legacy data gracefully
- **Deep Equality**: `deepEqual()` prevents redundant saves
- **Debouncing**: `debounce()` prevents excessive autosave calls
- **Text Extraction**: `extractPlainText()` converts Tiptap JSON to plain text
- **Validation**: `validateTiptapDocument()` ensures proper structure

### 3. Editor Configuration Fixes (`TiptapEditor.tsx`)
- **StarterKit Configuration**: Added `keepMarks: true` and `keepAttributes: true` for paragraphs and lists
- **Content Loading**: Only calls `setContent()` when noteId changes, not on every update
- **Feedback Loop Prevention**: Uses `isSettingContentRef` flag to prevent onChange during programmatic updates
- **Debounced Updates**: Prevents excessive onChange calls

### 4. Autosave Pipeline (`NoteEditor.tsx`)
- **Non-destructive Autosave**: Fire-and-forget pattern that doesn't trigger editor updates
- **Deep Equality Checks**: Prevents redundant saves when content hasn't actually changed
- **Debounced Autosave**: 1200ms debounce to batch rapid changes
- **Error Handling**: Automatic retry on failure with exponential backoff

### 5. CSS Fixes (`globals.css`)
- **Scoped Styles**: All editor styles scoped to `.ProseMirror` to prevent global interference
- **List Styling**: Proper indentation and bullet/number display
- **Line Break Preservation**: `white-space: pre-wrap` for paragraphs
- **Task List Support**: Proper styling for task lists
- **Table Support**: Responsive table styling

## Save/Load Flow

### When `setContent` is Allowed
1. **Initial Mount**: When editor is first created
2. **Note Change**: When `noteId` prop changes (switching between notes)
3. **Never During**: Autosave, manual save, or user typing

### Content Flow
1. **User Types** → `onUpdate` → Debounced `onChange` → State Update
2. **State Change** → Debounced Autosave → Database Update
3. **Database Update** → No editor content reset (prevents feedback loop)

### CSS Scoping
- All editor styles are scoped to `.ProseMirror` class
- Prevents global CSS resets from affecting editor
- Ensures lists display properly with bullets/numbers
- Preserves line breaks and formatting

## Key Principles

1. **JSON is Source of Truth**: Never convert to/from HTML during normal operation
2. **No Feedback Loops**: `setContent()` only called when absolutely necessary
3. **Deep Equality**: Prevents redundant operations and infinite loops
4. **Debounced Operations**: Batches rapid changes for better performance
5. **Defensive Parsing**: Handles legacy data and edge cases gracefully
6. **CSS Isolation**: Scoped styles prevent global interference

## Testing Checklist

- [ ] **Formatting Persists**: Bold/italic text survives autosave and reload
- [ ] **Line Breaks Work**: Paragraphs stay on separate lines
- [ ] **Lists Display**: Bullet and numbered lists show bullets/numbers
- [ ] **Lists Function**: Can create/edit/nest lists properly
- [ ] **No Content Loss**: Typing during autosave doesn't lose content
- [ ] **Reload Works**: Page refresh shows identical content
- [ ] **Images/Drawings**: Existing features still work
- [ ] **Performance**: No excessive API calls or lag

## Files Modified

- `supabase/migrations/20240322000009_fix_pages_content_json_type.sql`
- `src/lib/editor/json.ts` (new)
- `src/lib/supabase/notes.ts` (new)
- `src/components/editor/TiptapEditor.tsx`
- `src/components/notes/NoteEditor.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/globals.css`
- `src/types/supabase.ts`

## Migration Notes

The database migration is safe to run multiple times and will:
1. Add `content_json` column if missing
2. Convert existing text data to proper JSONB
3. Set proper defaults for new records
4. Handle edge cases like empty/null content

No data loss will occur during the migration process.
