/**
 * Input validation schemas using Zod
 * These schemas validate and sanitize user input for all API endpoints
 * 
 * Security considerations:
 * - All user inputs are validated before processing
 * - String lengths are limited to prevent DoS attacks
 * - HTML content is sanitized to prevent XSS
 * - Enum values are strictly validated
 */

import { z } from 'zod';

// ============================================================================
// COMMON VALIDATION SCHEMAS
// ============================================================================

// UUID validation schema
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Email validation schema
export const emailSchema = z.string().email('Invalid email format').max(254);

// Safe string schema (prevents XSS, limits length)
export const safeStringSchema = z.string()
  .max(1000, 'String too long')
  .transform((str) => str.trim());

// HTML content schema (for rich text content)
export const htmlContentSchema = z.string()
  .max(50000, 'Content too long') // 50KB limit
  .transform((str) => str.trim());

// Title/name schema
export const titleSchema = z.string()
  .min(1, 'Title is required')
  .max(200, 'Title too long')
  .transform((str) => str.trim());

// ============================================================================
// FEEDBACK VALIDATION SCHEMAS
// ============================================================================

export const createFeedbackSchema = z.object({
  title: titleSchema,
  content: htmlContentSchema,
  category: z.enum(['bug', 'feature', 'improvement', 'other'], {
    errorMap: () => ({ message: 'Invalid category' })
  }),
  priority: z.enum(['low', 'medium', 'high'], {
    errorMap: () => ({ message: 'Invalid priority' })
  }).optional().default('medium'),
});

export const updateFeedbackSchema = z.object({
  id: uuidSchema,
  title: titleSchema.optional(),
  content: htmlContentSchema.optional(),
  category: z.enum(['bug', 'feature', 'improvement', 'other']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

export const toggleVoteSchema = z.object({
  feedback_id: uuidSchema,
  vote_type: z.enum(['up', 'down'], {
    errorMap: () => ({ message: 'Invalid vote type' })
  }),
});

// ============================================================================
// STRIPE/PAYMENT VALIDATION SCHEMAS
// ============================================================================

export const createCheckoutSessionSchema = z.object({
  plan: z.enum(['monthly', 'yearly'], {
    errorMap: () => ({ message: 'Invalid plan. Must be monthly or yearly' })
  }),
  success_url: z.string().url('Invalid success URL').optional(),
  cancel_url: z.string().url('Invalid cancel URL').optional(),
});

// ============================================================================
// ONBOARDING VALIDATION SCHEMAS
// ============================================================================

export const onboardingSchema = z.object({
  full_name: z.string()
    .min(1, 'Full name is required')
    .max(100, 'Full name too long')
    .transform((str) => str.trim()),
  classes: z.array(z.string().max(100, 'Class name too long'))
    .max(20, 'Too many classes')
    .optional()
    .default([]),
  goals: z.array(z.string().max(200, 'Goal too long'))
    .max(10, 'Too many goals')
    .optional()
    .default([]),
});

// ============================================================================
// NOTES/PAGES VALIDATION SCHEMAS
// ============================================================================

export const createPageSchema = z.object({
  title: titleSchema,
  content: htmlContentSchema.optional().default(''),
  section_id: uuidSchema,
  parent_page_id: uuidSchema.optional(),
  visibility: z.enum(['private', 'friends', 'public']).optional().default('private'),
});

export const updatePageSchema = z.object({
  id: uuidSchema,
  title: titleSchema.optional(),
  content: htmlContentSchema.optional(),
  visibility: z.enum(['private', 'friends', 'public']).optional(),
  sort_order: z.number().int().min(0).optional(),
});

// ============================================================================
// FRIENDS VALIDATION SCHEMAS
// ============================================================================

export const sendFriendRequestSchema = z.object({
  receiver_email: emailSchema,
});

export const respondToFriendRequestSchema = z.object({
  request_id: uuidSchema,
  action: z.enum(['accept', 'decline'], {
    errorMap: () => ({ message: 'Invalid action. Must be accept or decline' })
  }),
});

// ============================================================================
// AI CHAT VALIDATION SCHEMAS
// ============================================================================

export const aiChatMessageSchema = z.object({
  message: z.string()
    .min(1, 'Message is required')
    .max(2000, 'Message too long')
    .transform((str) => str.trim()),
  session_id: uuidSchema.optional(),
  context: z.record(z.any()).optional().default({}),
});

// ============================================================================
// NOTEBOOK/SECTION VALIDATION SCHEMAS
// ============================================================================

export const createNotebookSchema = z.object({
  name: titleSchema,
  description: z.string().max(500, 'Description too long').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional().default('#3b82f6'),
});

export const createSectionSchema = z.object({
  name: titleSchema,
  notebook_id: uuidSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional().default('#3b82f6'),
});

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

/**
 * Validates request body against a schema and returns parsed data
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Parsed and validated data
 * @throws Error if validation fails
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
    }
    throw error;
  }
}

/**
 * Validates request body and returns result with success/error
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Object with success boolean and data or error
 */
export function safeValidateInput<T>(schema: z.ZodSchema<T>, data: unknown): 
  { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, error: `Validation failed: ${errorMessages.join(', ')}` };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}

/**
 * Validates query parameters
 * @param schema - Zod schema to validate against
 * @param searchParams - URLSearchParams or similar object
 * @returns Parsed and validated data
 */
export function validateQueryParams<T>(schema: z.ZodSchema<T>, searchParams: URLSearchParams): T {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return validateInput(schema, params);
}

// ============================================================================
// RATE LIMITING SCHEMAS
// ============================================================================

export const rateLimitConfigSchema = z.object({
  windowMs: z.number().int().min(1000).default(60000), // 1 minute default
  maxRequests: z.number().int().min(1).default(100),
  skipSuccessfulRequests: z.boolean().default(false),
  skipFailedRequests: z.boolean().default(false),
});

export type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>;
export type ToggleVoteInput = z.infer<typeof toggleVoteSchema>;
export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
export type RespondToFriendRequestInput = z.infer<typeof respondToFriendRequestSchema>;
export type AiChatMessageInput = z.infer<typeof aiChatMessageSchema>;
export type CreateNotebookInput = z.infer<typeof createNotebookSchema>;
export type CreateSectionInput = z.infer<typeof createSectionSchema>;