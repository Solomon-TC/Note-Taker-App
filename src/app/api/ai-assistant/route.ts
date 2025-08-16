import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OpenAI_API,
});

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

    let systemPrompt = "";
    let userPrompt = "";
    let messages: any[] = [];

    switch (mode) {
      case "chat":
        systemPrompt = `You are an advanced AI study assistant with deep expertise in educational content analysis. You have access to the student's complete note collection and should provide comprehensive, accurate, and insightful responses.

Your capabilities:
- Analyze and synthesize information across multiple notes
- Identify connections and patterns in the content
- Provide detailed explanations with examples
- Suggest study strategies and learning approaches
- Ask follow-up questions to deepen understanding

Context: The user is currently ${context?.currentPage ? `on page "${context.currentPage.title}"` : "browsing their notes"} ${context?.currentSection ? `in section "${context.currentSection.name}"` : ""} ${context?.currentNotebook ? `in notebook "${context.currentNotebook.name}"` : ""}.

Available notes (${notes.length} total):
${notes.map((note: any) => `- **${note.title}**: ${note.content.substring(0, 300)}...`).join("\n")}

Always prioritize accuracy and provide specific references to the notes when possible. If you're unsure about something, acknowledge the uncertainty rather than guessing.`;

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

        systemPrompt = `You are an expert academic summarizer. Create comprehensive, well-structured summaries that help students understand and retain key information.

Summary Guidelines:
- Use clear hierarchical structure with main topics and subtopics
- Include key concepts, definitions, and important details
- Highlight relationships between different concepts
- Add memory aids or mnemonics where appropriate
- Identify the most critical points for exam preparation
- Use bullet points, numbered lists, and formatting for clarity

Focus on creating summaries that are both comprehensive and easy to review.`;
        userPrompt = `Create a detailed academic summary of these notes:\n\n${relevantNotes.map((note: any) => `**${note.title}**\n${note.content}`).join("\n\n")}`;
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

        systemPrompt = `You are an expert educational assessment designer. Create challenging, thought-provoking practice questions that test deep understanding, not just memorization.

Question Design Principles:
- Create questions that require analysis, synthesis, and application
- Include scenario-based questions that test practical application
- Design multiple-choice questions with plausible distractors
- Create open-ended questions that require detailed explanations
- Vary difficulty levels from intermediate to advanced
- Include questions that connect different concepts
- Provide comprehensive explanations that teach, not just correct

Format your response as JSON with this exact structure:
{
  "questions": [
    {
      "type": "multiple-choice" | "open-ended",
      "difficulty": "intermediate" | "advanced" | "expert",
      "question": "...",
      "options": ["A", "B", "C", "D"] (only for multiple-choice),
      "correctAnswer": 0 (index for multiple-choice),
      "explanation": "Detailed explanation with reasoning",
      "learningObjective": "What this question tests"
    }
  ]
}`;
        userPrompt = `Generate 4-6 challenging practice questions based on these notes. Include a mix of question types and difficulty levels:\n\n${practiceNotes.map((note: any) => `**${note.title}**\n${note.content}`).join("\n\n")}`;
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

    // For practice mode, try to parse JSON response
    if (mode === "practice") {
      try {
        const practiceData = JSON.parse(response);
        return NextResponse.json({ response: practiceData });
      } catch (e) {
        // If JSON parsing fails, return as text
        return NextResponse.json({ response: { text: response } });
      }
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
