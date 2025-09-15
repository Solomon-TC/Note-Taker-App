import jsPDF from 'jspdf';
import { extractPlainText, type TiptapDocument } from '@/lib/editor/json';
import { storageService } from '@/lib/storage';

interface PDFGenerationOptions {
  title: string;
  content: TiptapDocument;
  filename?: string;
}

export const generateNotePDF = ({ title, content, filename }: PDFGenerationOptions) => {
  try {
    // Create new PDF document
    const pdf = new jsPDF();
    
    // Set up document properties
    pdf.setProperties({
      title: title,
      creator: 'Scribly Note-Taking App'
    });

    // Page dimensions and margins
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);
    let currentY = margin;

    // Title styling
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    
    // Add title with word wrapping
    const titleLines = pdf.splitTextToSize(title, maxWidth);
    pdf.text(titleLines, margin, currentY);
    currentY += titleLines.length * 10 + 15; // Line height + spacing

    // Extract plain text from Tiptap content
    const plainText = extractPlainText(content);
    
    if (plainText.trim()) {
      // Body text styling
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      
      // Split text into lines that fit the page width
      const textLines = pdf.splitTextToSize(plainText, maxWidth);
      
      // Add text with pagination
      for (let i = 0; i < textLines.length; i++) {
        // Check if we need a new page
        if (currentY + 8 > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }
        
        pdf.text(textLines[i], margin, currentY);
        currentY += 6; // Line height for body text
      }
    } else {
      // Handle empty content
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'italic');
      pdf.text('(This note is empty)', margin, currentY);
    }

    // Generate filename
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const finalFilename = filename || `${sanitizedTitle || 'untitled_note'}.pdf`;

    // Save the PDF
    pdf.save(finalFilename);
    
    return { success: true, filename: finalFilename };
  } catch (error) {
    console.error('Error generating PDF:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

// Enhanced function with image support
export const generateAdvancedNotePDF = async ({ title, content, filename }: PDFGenerationOptions) => {
  try {
    const pdf = new jsPDF();
    
    // Set up document properties
    pdf.setProperties({
      title: title,
      creator: 'Scribly Note-Taking App'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);
    let currentY = margin;

    // Helper function to check if we need a new page
    const checkNewPage = (requiredHeight: number = 8) => {
      if (currentY + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
      }
    };

    // Helper function to fetch and add image to PDF
    const addImageToPDF = async (node: any) => {
      try {
        let imageData: string | null = null;
        
        // Try to get image data from different sources
        if (node.attrs?.objectKey) {
          // Try to fetch from storage using objectKey
          try {
            const response = await fetch(node.attrs.src);
            if (response.ok) {
              const blob = await response.blob();
              imageData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
            }
          } catch (fetchError) {
            console.warn('Failed to fetch image from storage:', fetchError);
          }
        } else if (node.attrs?.src) {
          // Try to use the src directly if it's a data URL or accessible URL
          if (node.attrs.src.startsWith('data:')) {
            imageData = node.attrs.src;
          } else {
            try {
              const response = await fetch(node.attrs.src);
              if (response.ok) {
                const blob = await response.blob();
                imageData = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
              }
            } catch (fetchError) {
              console.warn('Failed to fetch image from URL:', fetchError);
            }
          }
        }

        if (imageData) {
          // Calculate image dimensions to fit within page
          const maxImageWidth = maxWidth * 0.8; // Use 80% of available width
          const maxImageHeight = 150; // Maximum height in points
          
          // Add some space before image
          checkNewPage(maxImageHeight + 20);
          currentY += 10;
          
          // Add image to PDF
          try {
            pdf.addImage(imageData, 'JPEG', margin, currentY, maxImageWidth, maxImageHeight);
            currentY += maxImageHeight + 15;
            
            // Add caption if available
            if (node.attrs?.alt && node.attrs.alt !== 'Drawing') {
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'italic');
              const captionLines = pdf.splitTextToSize(`Caption: ${node.attrs.alt}`, maxWidth);
              pdf.text(captionLines, margin, currentY);
              currentY += captionLines.length * 4 + 10;
            }
            
            return true;
          } catch (imageError) {
            console.error('Error adding image to PDF:', imageError);
            return false;
          }
        }
        
        return false;
      } catch (error) {
        console.error('Error processing image for PDF:', error);
        return false;
      }
    };

    // Add title
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    const titleLines = pdf.splitTextToSize(title, maxWidth);
    pdf.text(titleLines, margin, currentY);
    currentY += titleLines.length * 10 + 20;

    // Enhanced content processing with image support
    if (content.content && content.content.length > 0) {
      for (const node of content.content) {
        checkNewPage();
        
        switch (node.type) {
          case 'heading':
            const level = node.attrs?.level || 1;
            const headingSize = Math.max(16 - (level - 1) * 2, 12);
            pdf.setFontSize(headingSize);
            pdf.setFont('helvetica', 'bold');
            
            // Extract text from heading content
            const headingText = extractTextFromNode(node);
            if (headingText) {
              const headingLines = pdf.splitTextToSize(headingText, maxWidth);
              pdf.text(headingLines, margin, currentY);
              currentY += headingLines.length * (headingSize * 0.6) + 10;
            }
            break;
            
          case 'paragraph':
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');
            
            // Extract text from paragraph content
            const paragraphText = extractTextFromNode(node);
            if (paragraphText) {
              const paragraphLines = pdf.splitTextToSize(paragraphText, maxWidth);
              pdf.text(paragraphLines, margin, currentY);
              currentY += paragraphLines.length * 6 + 8;
            } else {
              // Empty paragraph - add some space
              currentY += 8;
            }
            break;
            
          case 'bulletList':
          case 'orderedList':
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');
            
            if (node.content) {
              for (let i = 0; i < node.content.length; i++) {
                const listItem = node.content[i];
                if (listItem.type === 'listItem' && listItem.content) {
                  checkNewPage();
                  
                  const bullet = node.type === 'bulletList' ? '• ' : `${i + 1}. `;
                  const itemText = extractTextFromNode(listItem);
                  
                  if (itemText) {
                    const itemLines = pdf.splitTextToSize(`${bullet}${itemText}`, maxWidth - 10);
                    pdf.text(itemLines, margin + 10, currentY);
                    currentY += itemLines.length * 6 + 4;
                  }
                }
              }
              currentY += 8; // Extra space after list
            }
            break;
            
          case 'blockquote':
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'italic');
            
            const quoteText = extractTextFromNode(node);
            if (quoteText) {
              const formattedQuote = `"${quoteText}"`;
              const quoteLines = pdf.splitTextToSize(formattedQuote, maxWidth - 20);
              pdf.text(quoteLines, margin + 20, currentY);
              currentY += quoteLines.length * 6 + 12;
            }
            break;

          case 'image':
            // Try to add actual image
            const imageAdded = await addImageToPDF(node);
            
            if (!imageAdded) {
              // Fallback to text placeholder if image couldn't be added
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'italic');
              const imageText = `[Image: ${node.attrs?.alt || 'Untitled'}]`;
              pdf.text(imageText, margin, currentY);
              currentY += 15;
            }
            break;
            
          default:
            // For other node types, extract text content
            const nodeText = extractTextFromNode(node);
            if (nodeText.trim()) {
              pdf.setFontSize(12);
              pdf.setFont('helvetica', 'normal');
              const defaultLines = pdf.splitTextToSize(nodeText, maxWidth);
              pdf.text(defaultLines, margin, currentY);
              currentY += defaultLines.length * 6 + 8;
            }
        }
      }
    } else {
      // Handle empty content
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'italic');
      pdf.text('(This note is empty)', margin, currentY);
    }

    // Generate filename
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const finalFilename = filename || `${sanitizedTitle || 'untitled_note'}.pdf`;

    // Save the PDF
    pdf.save(finalFilename);
    
    return { success: true, filename: finalFilename };
  } catch (error) {
    console.error('Error generating advanced PDF:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

// Helper function to extract text from any node type
function extractTextFromNode(node: any): string {
  if (!node) return '';
  
  let text = '';
  
  // If node has direct text content
  if (node.text) {
    text += node.text;
  }
  
  // If node has content array, recursively extract text
  if (node.content && Array.isArray(node.content)) {
    for (const childNode of node.content) {
      text += extractTextFromNode(childNode);
    }
  }
  
  return text;
}