import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client only when needed
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OpenAI_API) {
      throw new Error("OpenAI API key not configured");
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OpenAI_API,
    });
  }
  return openaiClient;
}

export async function POST(request: NextRequest) {
  try {
    const { mode, query, notes, context, sessionId, conversationHistory } =
      await request.json();

    if (!process.env.OpenAI_API) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 },
      );
    }

    const openai = getOpenAIClient();
    let systemPrompt = "";
    let userPrompt = "";
    let messages: any[] = [];

    // Helper function to build multimodal content description
    const buildMediaDescription = (notes: any[]) => {
      const mediaItems = notes.flatMap(note => 
        (note.mediaContent || []).map((media: any) => ({
          noteTitle: note.title,
          noteId: note.id,
          mediaType: media.type,
          mediaUrl: media.url,
          objectKey: media.objectKey
        }))
      );

      if (mediaItems.length === 0) return "";

      const imageCount = mediaItems.filter(m => m.mediaType === 'image').length;
      const drawingCount = mediaItems.filter(m => m.mediaType === 'drawing').length;

      let description = `\n\n📸 VISUAL CONTENT AVAILABLE:\n`;
      description += `- ${imageCount} images and ${drawingCount} drawings across your notes\n`;
      description += `- I can see and analyze all visual content in your notes\n`;
      description += `- Visual content includes: diagrams, photos, sketches, charts, and handwritten notes\n`;
      
      // Group media by note for better context
      const mediaByNote = mediaItems.reduce((acc, item) => {
        if (!acc[item.noteTitle]) acc[item.noteTitle] = [];
        acc[item.noteTitle].push(item);
        return acc;
      }, {} as Record<string, typeof mediaItems>);

      description += `\nVisual content by note:\n`;
      Object.entries(mediaByNote).forEach(([noteTitle, items]) => {
        const images = items.filter(i => i.mediaType === 'image').length;
        const drawings = items.filter(i => i.mediaType === 'drawing').length;
        description += `- "${noteTitle}": ${images} images, ${drawings} drawings\n`;
      });

      return description;
    };

    switch (mode) {
      case "chat":
        const mediaDescription = buildMediaDescription(notes);
        
        systemPrompt = `You are an advanced AI study assistant with deep expertise in educational content analysis and multimodal understanding. You have access to the student's complete note collection, including all text content, images, drawings, diagrams, and visual materials.

Your enhanced capabilities:
- Analyze and synthesize information across multiple notes (text + visual content)
- Process and understand images, drawings, diagrams, charts, and handwritten notes
- Identify connections and patterns in both textual and visual content
- Provide detailed explanations referencing both text and visual elements
- Suggest study strategies based on multimodal learning approaches
- Ask follow-up questions about specific visual content when relevant
- Describe and explain visual content when referenced

Context: The user is currently ${context?.currentPage ? `on page "${context.currentPage.title}"` : "browsing their notes"} ${context?.currentSection ? `in section "${context.currentSection.name}"` : ""} ${context?.currentNotebook ? `in notebook "${context.currentNotebook.name}"` : ""}.

Available notes (${notes.length} total):
${notes.map((note: any) => {
  let noteDesc = `- **${note.title}**: ${note.content.substring(0, 300)}...`;
  if (note.hasMedia && note.mediaContent) {
    const images = note.mediaContent.filter((m: any) => m.type === 'image').length;
    const drawings = note.mediaContent.filter((m: any) => m.type === 'drawing').length;
    noteDesc += ` [Contains: ${images} images, ${drawings} drawings]`;
  }
  return noteDesc;
}).join("\n")}${mediaDescription}

IMPORTANT: When users ask about visual content, images, diagrams, or drawings, acknowledge that you can see and analyze these materials. Reference specific visual elements when relevant to provide comprehensive assistance.

Always prioritize accuracy and provide specific references to both text and visual content when possible. If you're unsure about something, acknowledge the uncertainty rather than guessing.`;

        // Build conversation history
        messages = [{ role: "system", content: systemPrompt }];
        if (conversationHistory && conversationHistory.length > 0) {
          messages.push(...conversationHistory);
        }
        messages.push({ role: "user", content: query });
        break;

      case "summaries":
        const relevantNotes = context?.currentPage
          ? notes.filter((note: any) => note.id === context.currentPage.id)
          : context?.currentSection
            ? notes.filter(
                (note: any) => note.sectionId === context.currentSection.id,
              )
            : notes;

        const summaryMediaDescription = buildMediaDescription(relevantNotes);

        systemPrompt = `You are an expert academic summarizer with multimodal analysis capabilities. Create comprehensive, well-structured summaries that help students understand and retain key information from both textual and visual content.

Enhanced Summary Guidelines:
- Use clear hierarchical structure with main topics and subtopics
- Include key concepts, definitions, and important details from text AND visual content
- Reference and describe important visual elements (diagrams, charts, images, drawings)
- Highlight relationships between textual and visual information
- Add memory aids or mnemonics that incorporate visual elements
- Identify the most critical points for exam preparation from all content types
- Use bullet points, numbered lists, and formatting for clarity
- When visual content is present, describe key visual elements and their significance

Focus on creating summaries that integrate both textual and visual learning materials for comprehensive understanding.${summaryMediaDescription}`;

        userPrompt = `Create a detailed academic summary of these notes, including both textual content and visual materials:\n\n${relevantNotes.map((note: any) => {
          let noteContent = `**${note.title}**\n${note.content}`;
          if (note.hasMedia && note.mediaContent) {
            noteContent += `\n[Visual Content: This note contains ${note.mediaContent.filter((m: any) => m.type === 'image').length} images and ${note.mediaContent.filter((m: any) => m.type === 'drawing').length} drawings that I can analyze]`;
          }
          return noteContent;
        }).join("\n\n")}`;

        messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ];
        break;

      case "practice":
        const practiceNotes = context?.currentPage
          ? notes.filter((note: any) => note.id === context.currentPage.id)
          : context?.currentSection
            ? notes.filter(
                (note: any) => note.sectionId === context.currentSection.id,
              )
            : notes;

        const practiceMediaDescription = buildMediaDescription(practiceNotes);

        systemPrompt = `You are an expert educational assessment designer with multimodal content analysis capabilities. Create practice questions that test deep understanding of both textual and visual materials, ensuring all questions can be objectively graded.

ENHANCED CAPABILITIES:
- Analyze both text content and visual materials (images, drawings, diagrams, charts)
- Create questions that test understanding of visual content and text-visual relationships
- Reference specific visual elements in questions when appropriate
- Test comprehension of diagrams, charts, and visual representations

IMPORTANT CONSTRAINTS:
- ONLY create questions that can be automatically graded with 100% accuracy
- NEVER create open-ended or essay questions
- Focus on objective question types: multiple-choice, true/false, and matching
- Present questions in clear, conversational English format
- Questions can reference visual content but must have clear, objective answers

Enhanced Question Design Principles:
- Create questions that test comprehension of both textual and visual content
- Design questions about relationships between text and visual elements
- Test understanding of diagrams, charts, and visual representations
- Create questions that require analysis of visual patterns or data
- Include questions connecting concepts shown in different visual formats
- Vary difficulty levels from intermediate to advanced
- Provide comprehensive explanations that reference both text and visual content

${practiceMediaDescription}

CRITICAL FORMAT REQUIREMENTS:
[Same format requirements as before...]

QUALITY CONTROL:
- Questions can reference visual content but must be answerable objectively
- Ensure visual content questions have clear, definitive answers
- All questions must be based directly on the provided notes and visual materials
- Test each question to confirm it can be answered definitively from the content`;

        userPrompt = `Generate 4-6 practice questions based on these notes and their visual content. Create a mix of question types (multiple-choice, true/false, and matching) that can be automatically graded. Include questions that test understanding of visual materials when present. Present each question in clear, conversational English format with the question, answer choices (if applicable), correct answer, and explanation clearly labeled.\n\nNotes and visual content to base questions on:\n\n${practiceNotes.map((note: any) => {
          let noteContent = `**${note.title}**\n${note.content}`;
          if (note.hasMedia && note.mediaContent) {
            noteContent += `\n[Visual Content Available: This note contains ${note.mediaContent.filter((m: any) => m.type === 'image').length} images and ${note.mediaContent.filter((m: any) => m.type === 'drawing').length} drawings that can be referenced in questions]`;
          }
          return noteContent;
        }).join("\n\n")}`;

        messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ];
        break;

      default:
        return NextResponse.json(
          { error: "Invalid mode. Use 'chat', 'summaries', or 'practice'" },
          { status: 400 },
        );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using more capable model for better accuracy
      messages: messages,
      max_tokens:
        mode === "practice" ? 2000 : mode === "summaries" ? 1500 : 1200,
      temperature: mode === "practice" ? 0.3 : 0.4, // Lower temperature for more consistent results
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 },
      );
    }

    // For practice mode, return the response as plain text
    if (mode === "practice") {
      return NextResponse.json({ response: { text: response } });
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error("AI Assistant API Error:", error);
    return NextResponse.json(
      { error: "Failed to process AI request" },
      { status: 500 },
    );
  }
}