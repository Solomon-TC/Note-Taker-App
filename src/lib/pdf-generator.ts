import jsPDF from 'jspdf';
import { extractPlainText, type TiptapDocument } from '@/lib/editor/json';

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

// Alternative function for more advanced formatting (future enhancement)
export const generateAdvancedNotePDF = ({ title, content, filename }: PDFGenerationOptions) => {
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

    // Add title
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    const titleLines = pdf.splitTextToSize(title, maxWidth);
    pdf.text(titleLines, margin, currentY);
    currentY += titleLines.length * 10 + 20;

    // Process Tiptap content nodes for better formatting
    if (content.content && content.content.length > 0) {
      for (const node of content.content) {
        checkNewPage();
        
        switch (node.type) {
          case 'heading':
            const level = node.attrs?.level || 1;
            const headingSize = Math.max(16 - (level - 1) * 2, 12);
            pdf.setFontSize(headingSize);
            pdf.setFont('helvetica', 'bold');
            
            if (node.content && node.content[0]?.text) {
              const headingLines = pdf.splitTextToSize(node.content[0].text, maxWidth);
              pdf.text(headingLines, margin, currentY);
              currentY += headingLines.length * (headingSize * 0.6) + 10;
            }
            break;
            
          case 'paragraph':
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');
            
            if (node.content && node.content[0]?.text) {
              const paragraphLines = pdf.splitTextToSize(node.content[0].text, maxWidth);
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
                  const itemText = listItem.content[0]?.content?.[0]?.text || '';
                  
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
            
            if (node.content && node.content[0]?.content?.[0]?.text) {
              const quoteText = `"${node.content[0].content[0].text}"`;
              const quoteLines = pdf.splitTextToSize(quoteText, maxWidth - 20);
              pdf.text(quoteLines, margin + 20, currentY);
              currentY += quoteLines.length * 6 + 12;
            }
            break;
            
          default:
            // For other node types, extract text content
            const nodeText = extractPlainText({ type: 'doc', content: [node] });
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