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

        systemPrompt = `You are an expert educational assessment designer. Create practice questions that can be objectively graded and test deep understanding of the material.

IMPORTANT CONSTRAINTS:
- ONLY create questions that can be automatically graded with 100% accuracy
- NEVER create open-ended or essay questions
- Focus on objective question types: multiple-choice, true/false, and matching
- Present questions in clear, conversational English format

Question Design Principles:
- Create questions that test comprehension, analysis, and application
- Design multiple-choice questions with 4 plausible options and clear correct answers
- Create true/false questions that test specific facts or concepts
- Design matching questions that connect related concepts, terms, or examples
- Vary difficulty levels from intermediate to advanced
- Include questions that connect different concepts from the notes
- Provide comprehensive explanations that teach, not just correct

CRITICAL FORMAT REQUIREMENTS:
For multiple-choice questions, you MUST follow this EXACT format with NO DEVIATIONS:

"Question 1 (Multiple Choice): What is the primary function of mitochondria in cells?
A) Protein synthesis
B) Energy production
C) DNA storage
D) Waste removal

Correct Answer: B
Explanation: Mitochondria are known as the powerhouses of the cell because they produce ATP through cellular respiration."

FORMAT RULES - FOLLOW EXACTLY:
1. Always write "Correct Answer: [LETTER]" on its own line
2. Use ONLY the letter (A, B, C, or D) after "Correct Answer:" - NO parentheses, NO periods, NO extra text
3. The explanation must clearly describe why the correct answer is right
4. Make sure the correct answer letter corresponds exactly to the right option
5. Double-check: if you say "Correct Answer: B", then option B) must be the right answer
6. The explanation should reference the correct option's content to confirm it's right

For true/false questions, use this format:
"Question 2 (True/False): [Question text]

Correct Answer: True
Explanation: [Why this is true/false]"

QUALITY CONTROL:
- Before finalizing each question, verify the correct answer letter matches the right option
- Ensure explanations support the designated correct answer
- All questions must be based directly on the provided notes
- Test each question yourself to confirm it can be answered definitively from the content`;
        userPrompt = `Generate 4-6 practice questions based on these notes. Create a mix of question types (multiple-choice, true/false, and matching) that can be automatically graded. Present each question in clear, conversational English format with the question, answer choices (if applicable), correct answer, and explanation clearly labeled. Each question should test understanding of specific concepts from the notes and have clear, objective answers.\n\nNotes to base questions on:\n\n${practiceNotes.map((note: any) => `**${note.title}**\n${note.content}`).join("\n\n")}`;
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
