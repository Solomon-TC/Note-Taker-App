import jsPDF from 'jspdf';
import { extractPlainText, type TiptapDocument } from '@/lib/editor/json';
import { storageService } from '@/lib/storage';

interface PDFGenerationOptions {
  title: string;
  content: TiptapDocument;
  filename?: string;
}

// Enhanced PDF generator with proper formatting support
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

    // Helper function to add formatted text with proper styling
    const addFormattedText = (text: string, node: any, indent: number = 0) => {
      if (!text.trim()) return;

      // Apply text formatting based on marks
      let isBold = false;
      let isItalic = false;
      let isCode = false;
      let fontSize = 12;
      let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';

      // Check for text marks (bold, italic, code, etc.)
      if (node.marks && Array.isArray(node.marks)) {
        for (const mark of node.marks) {
          switch (mark.type) {
            case 'bold':
            case 'strong':
              isBold = true;
              break;
            case 'italic':
            case 'em':
              isItalic = true;
              break;
            case 'code':
              isCode = true;
              break;
          }
        }
      }

      // Set font style
      if (isBold && isItalic) {
        fontStyle = 'bolditalic';
      } else if (isBold) {
        fontStyle = 'bold';
      } else if (isItalic) {
        fontStyle = 'italic';
      }

      // Apply code formatting
      if (isCode) {
        pdf.setFont('courier', fontStyle);
        pdf.setFontSize(10);
      } else {
        pdf.setFont('helvetica', fontStyle);
        pdf.setFontSize(fontSize);
      }

      // Split text to fit page width with proper indentation
      const effectiveWidth = maxWidth - indent;
      const textLines = pdf.splitTextToSize(text, effectiveWidth);
      
      // Add each line
      for (const line of textLines) {
        checkNewPage();
        pdf.text(line, margin + indent, currentY);
        currentY += fontSize * 0.5; // Line height
      }
    };

    // Helper function to process text content with formatting
    const processTextContent = (nodes: any[], indent: number = 0) => {
      for (const node of nodes) {
        if (node.type === 'text') {
          addFormattedText(node.text || '', node, indent);
        } else if (node.content && Array.isArray(node.content)) {
          processTextContent(node.content, indent);
        }
      }
    };

    // Helper function to fetch and add image to PDF
    const addImageToPDF = async (node: any) => {
      try {
        let imageData: string | null = null;
        
        // Try to get image data from different sources
        if (node.attrs?.objectKey) {
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
          const maxImageWidth = maxWidth * 0.8;
          const maxImageHeight = 150;
          
          checkNewPage(maxImageHeight + 20);
          currentY += 10;
          
          try {
            pdf.addImage(imageData, 'JPEG', margin, currentY, maxImageWidth, maxImageHeight);
            currentY += maxImageHeight + 15;
            
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

    // Add title with proper formatting
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    const titleLines = pdf.splitTextToSize(title, maxWidth);
    pdf.text(titleLines, margin, currentY);
    currentY += titleLines.length * 14 + 20;

    // Process content with enhanced formatting
    if (content.content && content.content.length > 0) {
      for (const node of content.content) {
        checkNewPage();
        
        switch (node.type) {
          case 'heading':
            const level = node.attrs?.level || 1;
            const headingSize = Math.max(20 - (level - 1) * 2, 14);
            pdf.setFontSize(headingSize);
            pdf.setFont('helvetica', 'bold');
            
            currentY += 10; // Space before heading
            checkNewPage(headingSize + 10);
            
            if (node.content && Array.isArray(node.content)) {
              processTextContent(node.content);
            }
            currentY += 15; // Space after heading
            break;
            
          case 'paragraph':
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');
            
            if (node.content && Array.isArray(node.content)) {
              const startY = currentY;
              processTextContent(node.content);
              // Add paragraph spacing only if content was added
              if (currentY > startY) {
                currentY += 8;
              } else {
                // Empty paragraph
                currentY += 6;
              }
            } else {
              // Empty paragraph
              currentY += 6;
            }
            break;
            
          case 'bulletList':
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');
            
            if (node.content) {
              for (const listItem of node.content) {
                if (listItem.type === 'listItem' && listItem.content) {
                  checkNewPage();
                  
                  // Add bullet point
                  pdf.text('•', margin + 10, currentY);
                  
                  // Process list item content with indentation
                  for (const itemNode of listItem.content) {
                    if (itemNode.type === 'paragraph' && itemNode.content) {
                      processTextContent(itemNode.content, 20);
                    }
                  }
                  currentY += 4; // Space between list items
                }
              }
              currentY += 8; // Space after list
            }
            break;
            
          case 'orderedList':
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');
            
            if (node.content) {
              for (let i = 0; i < node.content.length; i++) {
                const listItem = node.content[i];
                if (listItem.type === 'listItem' && listItem.content) {
                  checkNewPage();
                  
                  // Add number
                  pdf.text(`${i + 1}.`, margin + 10, currentY);
                  
                  // Process list item content with indentation
                  for (const itemNode of listItem.content) {
                    if (itemNode.type === 'paragraph' && itemNode.content) {
                      processTextContent(itemNode.content, 25);
                    }
                  }
                  currentY += 4; // Space between list items
                }
              }
              currentY += 8; // Space after list
            }
            break;
            
          case 'blockquote':
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'italic');
            
            currentY += 8; // Space before quote
            checkNewPage();
            
            // Add quote indicator
            pdf.setFont('helvetica', 'bold');
            pdf.text('❝', margin, currentY);
            pdf.setFont('helvetica', 'italic');
            
            if (node.content && Array.isArray(node.content)) {
              for (const quoteNode of node.content) {
                if (quoteNode.type === 'paragraph' && quoteNode.content) {
                  processTextContent(quoteNode.content, 15);
                }
              }
            }
            currentY += 12; // Space after quote
            break;

          case 'codeBlock':
            pdf.setFontSize(10);
            pdf.setFont('courier', 'normal');
            
            currentY += 8; // Space before code block
            checkNewPage();
            
            // Add background effect (simple border)
            const codeStartY = currentY - 5;
            
            if (node.content && Array.isArray(node.content)) {
              for (const codeNode of node.content) {
                if (codeNode.type === 'text') {
                  const codeLines = (codeNode.text || '').split('\n');
                  for (const line of codeLines) {
                    checkNewPage();
                    pdf.text(line, margin + 10, currentY);
                    currentY += 12;
                  }
                }
              }
            }
            
            // Draw border around code block
            const codeEndY = currentY + 5;
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(margin + 5, codeStartY, maxWidth - 10, codeEndY - codeStartY);
            
            currentY += 12; // Space after code block
            break;

          case 'image':
            const imageAdded = await addImageToPDF(node);
            
            if (!imageAdded) {
              // Fallback to text placeholder
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'italic');
              const imageText = `[Image: ${node.attrs?.alt || 'Untitled'}]`;
              pdf.text(imageText, margin, currentY);
              currentY += 15;
            }
            break;

          case 'hardBreak':
            currentY += 12; // Line break
            break;
            
          default:
            // For other node types, try to extract and format text content
            if (node.content && Array.isArray(node.content)) {
              pdf.setFontSize(12);
              pdf.setFont('helvetica', 'normal');
              processTextContent(node.content);
              currentY += 8;
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

// Keep the simple version for backward compatibility
export const generateNotePDF = ({ title, content, filename }: PDFGenerationOptions) => {
  return generateAdvancedNotePDF({ title, content, filename });
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