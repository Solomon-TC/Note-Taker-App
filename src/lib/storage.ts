"use client";

import { createClient } from "@/lib/supabase-client";
import imageCompression from "browser-image-compression";

export interface UploadResult {
  url: string;
  path: string;
  objectKey: string;
}

export class StorageService {
  private supabase = createClient();
  private bucketName = "notes";

  /**
   * Generate a storage path for a file
   */
  generatePath(
    userId: string,
    noteId: string,
    type: "images" | "drawings",
    filename: string,
  ): string {
    const timestamp = Date.now();
    const extension = filename.split(".").pop() || "png";
    const sanitizedFilename = `${timestamp}-${Math.random().toString(36).substring(2)}.${extension}`;
    return `${userId}/${noteId}/${type}/${sanitizedFilename}`;
  }

  /**
   * Compress an image file before upload
   */
  async compressImage(file: File, maxSizeMB: number = 10): Promise<File> {
    const options = {
      maxSizeMB,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: file.type as any,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      console.warn("Image compression failed, using original file:", error);
      return file;
    }
  }

  /**
   * Validate file type and size
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed. Please use PNG, JPEG, WebP, or GIF.`,
      };
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 50MB limit.`,
      };
    }

    return { valid: true };
  }

  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(
    file: File,
    userId: string,
    noteId: string,
    type: "images" | "drawings" = "images",
  ): Promise<UploadResult> {
    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Compress image if needed
    const processedFile = await this.compressImage(file);

    // Generate path
    const path = this.generatePath(userId, noteId, type, processedFile.name);

    // Upload to Supabase Storage
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, processedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get signed URL
    const signedUrl = await this.getSignedUrl(path);

    return {
      url: signedUrl,
      path: data.path,
      objectKey: path,
    };
  }

  /**
   * Upload a blob (for drawings)
   */
  async uploadBlob(
    blob: Blob,
    userId: string,
    noteId: string,
    filename: string,
    type: "images" | "drawings" = "drawings",
  ): Promise<UploadResult> {
    const path = this.generatePath(userId, noteId, type, filename);

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, blob, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/png",
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    const signedUrl = await this.getSignedUrl(path);

    return {
      url: signedUrl,
      path: data.path,
      objectKey: path,
    };
  }

  /**
   * Get a signed URL for a file with longer expiration for drawings
   */
  async getSignedUrl(path: string, expiresIn: number = 86400): Promise<string> {
    // 24 hours default
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new Error(`Failed to get signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([path]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Refresh signed URLs in Tiptap JSON content - Enhanced for drawings
   */
  async refreshSignedUrlsInContent(content: any): Promise<any> {
    if (!content || typeof content !== "object") {
      return content;
    }

    console.log("StorageService: Refreshing signed URLs in content");

    // Deep clone to avoid mutations
    const refreshedContent = JSON.parse(JSON.stringify(content));
    let refreshCount = 0;

    const refreshNode = async (node: any) => {
      if (node.type === "image" && node.attrs?.src && node.attrs?.objectKey) {
        try {
          console.log(
            "StorageService: Refreshing URL for objectKey:",
            node.attrs.objectKey,
          );
          const newSignedUrl = await this.getSignedUrl(
            node.attrs.objectKey,
            86400,
          ); // 24 hours
          node.attrs.src = newSignedUrl;
          refreshCount++;
          console.log(
            "StorageService: Successfully refreshed URL for:",
            node.attrs.objectKey,
          );
        } catch (error) {
          console.warn(
            `Failed to refresh signed URL for ${node.attrs.objectKey}:`,
            error,
          );
          // Keep the old URL if refresh fails
        }
      }

      if (node.content && Array.isArray(node.content)) {
        for (const childNode of node.content) {
          await refreshNode(childNode);
        }
      }
    };

    if (refreshedContent.content && Array.isArray(refreshedContent.content)) {
      for (const node of refreshedContent.content) {
        await refreshNode(node);
      }
    }

    console.log(`StorageService: Refreshed ${refreshCount} signed URLs`);
    return refreshedContent;
  }

  /**
   * Convert a data URL to a blob
   */
  dataURLToBlob(dataURL: string): Blob {
    const arr = dataURL.split(",");
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Generate temporary signed URLs for AI processing
   * These URLs have longer expiration times for AI analysis
   */
  async generateAIAccessUrl(path: string): Promise<string> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(path, 7200); // 2 hours for AI processing

      if (error) {
        throw new Error(`Failed to generate AI access URL: ${error.message}`);
      }

      return data.signedUrl;
    } catch (error) {
      console.error("Error generating AI access URL:", error);
      throw error;
    }
  }

  /**
   * Extract all image and drawing URLs from Tiptap content for AI processing
   */
  async extractMediaForAI(content: any, userId: string): Promise<{
    images: Array<{ url: string; objectKey: string; type: 'image' | 'drawing' }>;
    totalSize: number;
  }> {
    const mediaFiles: any[] = [];
    let totalSize = 0;

    try {
      // Recursively extract media from content
      const extractFromNode = (node: any, noteId?: any) => {
        if (!node || typeof node !== 'object') return;

        // Handle image nodes
        if (node.type === 'image' && node.attrs?.objectKey) {
          const fullPath = `${userId}/${node.attrs.objectKey}`;
          
          try {
            const { data: urlData } = this.supabase.storage
              .from('notes')
              .getPublicUrl(fullPath);

            if (urlData?.publicUrl) {
              mediaFiles.push({
                path: fullPath,
                url: urlData.publicUrl,
                type: 'image' as const,
                noteId
              });
            }
          } catch (error) {
            console.warn('Error getting public URL for image:', error);
          }
        }

        // Handle drawing nodes
        if (node.type === 'image' && node.attrs?.drawingId) {
          const fullPath = `${userId}/drawings/${node.attrs.drawingId}.png`;
          
          try {
            const { data: urlData } = this.supabase.storage
              .from('drawings')
              .getPublicUrl(fullPath);

            if (urlData?.publicUrl) {
              mediaFiles.push({
                path: fullPath,
                url: urlData.publicUrl,
                type: 'drawing' as const,
                noteId
              });
            }
          } catch (error) {
            console.warn('Error getting public URL for drawing:', error);
          }
        }

        // Recursively process child nodes
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach((child: any) => extractFromNode(child, noteId));
        }
      };

      // Extract from content
      extractFromNode(content);

      // Calculate total size (approximate)
      totalSize = mediaFiles.length * 1024; // Rough estimate

      return {
        images: mediaFiles.map(file => ({
          url: file.url,
          objectKey: file.path,
          type: file.type
        })),
        totalSize
      };
    } catch (error) {
      console.error('Error extracting media for AI:', error);
      return { images: [], totalSize: 0 };
    }
  }

  /**
   * Check if user has access to specific media files
   */
  async verifyUserAccess(objectKey: string, userId: string): Promise<boolean> {
    // Check if the object key starts with the user's ID
    return objectKey.startsWith(`${userId}/`);
  }

  /**
   * Get all media files for a user's notes (for AI context building)
   */
  async getUserMediaFiles(userId: string): Promise<Array<{
    path: string;
    url: string;
    type: 'image' | 'drawing';
    noteId?: string;
  }>> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(`${userId}/`, {
          limit: 1000,
          offset: 0,
        });

      if (error) {
        console.error("Error listing user media files:", error);
        return [];
      }

      const mediaFiles = [];
      
      for (const file of data || []) {
        if (file.name && (file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') || file.name.endsWith('.webp'))) {
          try {
            const fullPath = `${userId}/${file.name}`;
            const signedUrl = await this.generateAIAccessUrl(fullPath);
            
            // Extract note ID from path if possible
            const pathParts = file.name.split('/');
            const noteId = pathParts.length > 1 ? pathParts[0] : undefined;
            
            mediaFiles.push({
              path: fullPath,
              url: signedUrl,
              type: file.name.includes('/drawings/') ? 'drawing' as const : 'image' as const,
              noteId
            });
          } catch (error) {
            console.warn(`Failed to generate signed URL for ${file.name}:`, error);
          }
        }
      }

      return mediaFiles;
    } catch (error) {
      console.error("Error getting user media files:", error);
      return [];
    }
  }
}

// Export singleton instance
export const storageService = new StorageService();