/**
 * HTML Sanitization utilities using the xss library
 * 
 * This module provides secure HTML sanitization to prevent XSS attacks
 * while allowing safe HTML formatting for user content like notes and feedback.
 * 
 * Security considerations:
 * - Uses a strict whitelist approach (only allow specific tags/attributes)
 * - Removes all JavaScript and dangerous attributes
 * - Adds security attributes to links (rel="nofollow noopener noreferrer")
 * - Configurable for different content types
 */

import { FilterXSS, IFilterXSSOptions } from 'xss';

// ============================================================================
// SANITIZATION CONFIGURATIONS
// ============================================================================

/**
 * Strict sanitization for basic text formatting
 * Allows: bold, italic, underline, strikethrough, links
 */
const BASIC_HTML_OPTIONS: IFilterXSSOptions = {
  whiteList: {
    // Text formatting
    'b': [],
    'strong': [],
    'i': [],
    'em': [],
    'u': [],
    's': [],
    'strike': [],
    'del': [],
    'mark': [],
    
    // Line breaks and paragraphs
    'br': [],
    'p': ['class'],
    'div': ['class'],
    'span': ['class', 'style'],
    
    // Lists
    'ul': ['class'],
    'ol': ['class'],
    'li': ['class'],
    
    // Links (with security attributes)
    'a': ['href', 'title', 'target', 'rel'],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  allowCommentTag: false,
  onTagAttr: (tag, name, value, isWhiteAttr) => {
    // Add security attributes to links
    if (tag === 'a' && name === 'href') {
      // Only allow http, https, and mailto links
      if (!/^(https?:\/\/|mailto:)/i.test(value)) {
        return '';
      }
    }
    
    // Limit style attributes to safe properties
    if (name === 'style') {
      // Only allow basic text styling
      const allowedStyles = ['color', 'background-color', 'font-weight', 'font-style', 'text-decoration'];
      const styles = value.split(';').filter(style => {
        const [property] = style.split(':').map(s => s.trim());
        return allowedStyles.includes(property);
      });
      return `style="${styles.join(';')}"`;
    }
    
    return isWhiteAttr ? `${name}="${value}"` : '';
  },
  onTag: (tag, html, options) => {
    // Add security attributes to all links
    if (tag === 'a') {
      // Ensure all links have security attributes
      if (!html.includes('rel=')) {
        html = html.replace('<a ', '<a rel="nofollow noopener noreferrer" ');
      }
      if (!html.includes('target=')) {
        html = html.replace('<a ', '<a target="_blank" ');
      }
    }
    return html;
  }
};

/**
 * Rich text sanitization for note content
 * Allows: all basic formatting plus headings, blockquotes, code
 */
const RICH_HTML_OPTIONS: IFilterXSSOptions = {
  ...BASIC_HTML_OPTIONS,
  whiteList: {
    ...BASIC_HTML_OPTIONS.whiteList,
    
    // Headings
    'h1': ['class'],
    'h2': ['class'],
    'h3': ['class'],
    'h4': ['class'],
    'h5': ['class'],
    'h6': ['class'],
    
    // Code and quotes
    'code': ['class'],
    'pre': ['class'],
    'blockquote': ['class'],
    
    // Tables (basic)
    'table': ['class'],
    'thead': [],
    'tbody': [],
    'tr': [],
    'th': ['class'],
    'td': ['class'],
    
    // Images (with restrictions)
    'img': ['src', 'alt', 'title', 'width', 'height', 'class'],
  },
  onTagAttr: (tag, name, value, isWhiteAttr) => {
    // Handle image sources
    if (tag === 'img' && name === 'src') {
      // Only allow https images and data URLs for small images
      if (!/^(https:\/\/|data:image\/(png|jpg|jpeg|gif|webp);base64,)/i.test(value)) {
        return '';
      }
      // Limit data URL size to prevent DoS
      if (value.startsWith('data:') && value.length > 100000) { // 100KB limit
        return '';
      }
    }
    
    // Call parent handler
    return BASIC_HTML_OPTIONS.onTagAttr?.(tag, name, value, isWhiteAttr) || '';
  }
};

/**
 * Minimal sanitization for plain text with line breaks
 * Only allows: line breaks and basic text formatting
 */
const MINIMAL_HTML_OPTIONS: IFilterXSSOptions = {
  whiteList: {
    'br': [],
    'p': [],
    'b': [],
    'strong': [],
    'i': [],
    'em': [],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  allowCommentTag: false,
};

// ============================================================================
// SANITIZATION INSTANCES
// ============================================================================

const basicSanitizer = new FilterXSS(BASIC_HTML_OPTIONS);
const richSanitizer = new FilterXSS(RICH_HTML_OPTIONS);
const minimalSanitizer = new FilterXSS(MINIMAL_HTML_OPTIONS);

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Sanitizes HTML content for basic text formatting
 * Use for: feedback content, comments, short descriptions
 * 
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeBasicHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  return basicSanitizer.process(html.trim());
}

/**
 * Sanitizes HTML content for rich text editing
 * Use for: note content, long-form content with formatting
 * 
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeRichHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  return richSanitizer.process(html.trim());
}

/**
 * Sanitizes HTML content with minimal formatting
 * Use for: titles, names, simple text fields
 * 
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeMinimalHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  return minimalSanitizer.process(html.trim());
}

/**
 * Strips all HTML tags and returns plain text
 * Use for: search indexing, plain text previews
 * 
 * @param html - HTML string to convert to plain text
 * @returns Plain text string
 */
export function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  // Use XSS library to strip all tags
  const stripped = new FilterXSS({
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
  }).process(html);
  
  // Clean up extra whitespace
  return stripped.replace(/\s+/g, ' ').trim();
}

/**
 * Sanitizes user input based on content type
 * 
 * @param content - Content to sanitize
 * @param type - Type of content ('basic', 'rich', 'minimal', 'plain')
 * @returns Sanitized content
 */
export function sanitizeContent(content: string, type: 'basic' | 'rich' | 'minimal' | 'plain' = 'basic'): string {
  switch (type) {
    case 'rich':
      return sanitizeRichHtml(content);
    case 'minimal':
      return sanitizeMinimalHtml(content);
    case 'plain':
      return stripHtml(content);
    case 'basic':
    default:
      return sanitizeBasicHtml(content);
  }
}

/**
 * Validates and sanitizes HTML content for storage
 * Combines length validation with sanitization
 * 
 * @param content - Content to validate and sanitize
 * @param maxLength - Maximum allowed length (default: 50000)
 * @param type - Sanitization type
 * @returns Object with success status and sanitized content or error
 */
export function validateAndSanitizeContent(
  content: string, 
  maxLength: number = 50000,
  type: 'basic' | 'rich' | 'minimal' | 'plain' = 'basic'
): { success: true; content: string } | { success: false; error: string } {
  
  if (!content || typeof content !== 'string') {
    return { success: true, content: '' };
  }
  
  // Check length before sanitization to prevent DoS
  if (content.length > maxLength) {
    return { 
      success: false, 
      error: `Content too long. Maximum ${maxLength} characters allowed.` 
    };
  }
  
  try {
    const sanitized = sanitizeContent(content, type);
    
    // Check sanitized length as well
    if (sanitized.length > maxLength) {
      return { 
        success: false, 
        error: `Sanitized content too long. Maximum ${maxLength} characters allowed.` 
      };
    }
    
    return { success: true, content: sanitized };
  } catch (error) {
    console.error('Content sanitization error:', error);
    return { 
      success: false, 
      error: 'Failed to sanitize content. Please check for invalid HTML.' 
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Checks if content contains potentially dangerous elements
 * Use for additional validation before processing
 * 
 * @param content - Content to check
 * @returns true if content appears safe, false otherwise
 */
export function isContentSafe(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return true;
  }
  
  // Check for common XSS patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick, onload
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<form/i,
    /data:text\/html/i,
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(content));
}

/**
 * Generates a content preview from HTML
 * Strips HTML and truncates to specified length
 * 
 * @param html - HTML content
 * @param maxLength - Maximum preview length (default: 150)
 * @returns Plain text preview
 */
export function generateContentPreview(html: string, maxLength: number = 150): string {
  const plainText = stripHtml(html);
  
  if (plainText.length <= maxLength) {
    return plainText;
  }
  
  // Truncate at word boundary
  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) { // Only truncate at word if it's not too far back
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}