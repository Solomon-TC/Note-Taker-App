"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Brain,
  FileText,
  BookOpen,
  Award,
  X,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  History,
  MessageSquare,
  Play,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Database } from "@/types/supabase";
import { extractPlainText, safeJsonParse } from "@/lib/editor/json";

// Matching Question Component
interface MatchingQuestionProps {
  pairs: { left: string; right: string }[];
  completed: boolean;
  userAnswer: { [key: string]: string };
  onAnswer: (matches: { [key: string]: string }) => void;
}

const MatchingQuestion: React.FC<MatchingQuestionProps> = ({
  pairs,
  completed,
  userAnswer,
  onAnswer,
}) => {
  const [matches, setMatches] = useState<{ [key: string]: string }>(
    userAnswer || {},
  );
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  const leftItems = pairs.map((p) => p.left);
  const rightItems = pairs.map((p) => p.right).sort(() => Math.random() - 0.5); // Shuffle right items

  const handleLeftClick = (item: string) => {
    if (completed) return;
    setSelectedLeft(selectedLeft === item ? null : item);
  };

  const handleRightClick = (item: string) => {
    if (completed || !selectedLeft) return;

    const newMatches = { ...matches, [selectedLeft]: item };
    setMatches(newMatches);
    setSelectedLeft(null);

    // If all items are matched, submit the answer
    if (Object.keys(newMatches).length === pairs.length) {
      onAnswer(newMatches);
    }
  };

  const getMatchedRight = (leftItem: string) => {
    return matches[leftItem];
  };

  const isRightItemUsed = (rightItem: string) => {
    return Object.values(matches).includes(rightItem);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">
            Match these items:
          </h4>
          {leftItems.map((item, index) => {
            const matchedRight = getMatchedRight(item);
            const isCorrect =
              completed &&
              pairs.find((p) => p.left === item)?.right === matchedRight;
            return (
              <Button
                key={index}
                variant={
                  selectedLeft === item
                    ? "default"
                    : matchedRight
                      ? completed && isCorrect
                        ? "default"
                        : completed
                          ? "destructive"
                          : "secondary"
                      : "outline"
                }
                className="justify-start text-left h-auto p-3 w-full"
                onClick={() => handleLeftClick(item)}
                disabled={completed}
              >
                <span className="text-wrap text-sm">
                  {item}
                  {matchedRight && (
                    <span className="block text-xs opacity-70 mt-1">
                      → {matchedRight}
                    </span>
                  )}
                </span>
              </Button>
            );
          })}
        </div>
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">
            With these options:
          </h4>
          {rightItems.map((item, index) => {
            const isUsed = isRightItemUsed(item);
            return (
              <Button
                key={index}
                variant={isUsed ? "secondary" : "outline"}
                className="justify-start text-left h-auto p-3 w-full"
                onClick={() => handleRightClick(item)}
                disabled={completed || isUsed}
              >
                <span className="text-wrap text-sm">{item}</span>
              </Button>
            );
          })}
        </div>
      </div>
      {!completed && Object.keys(matches).length < pairs.length && (
        <p className="text-xs text-muted-foreground text-center">
          Select an item from the left, then click its match on the right.
        </p>
      )}
    </div>
  );
};

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface AIChatSidebarProps {
  currentNote?: {
    id: string;
    title: string;
    content: string;
  };
  context?: {
    currentNotebook?: { id: string; name: string };
    currentSection?: { id: string; name: string };
    currentPage?: { id: string; title: string };
    allPages?: Array<{
      id: string;
      title: string;
      content: string;
      content_json?: any;
      section_id?: string;
    }>;
  };
  onAnalyzeNote?: () => void;
  onGenerateSummary?: () => void;
  onCreatePracticeProblems?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

interface PracticeQuestion {
  type: "multiple-choice" | "true-false" | "matching";
  difficulty?: "intermediate" | "advanced" | "expert";
  question: string;
  options?: string[];
  correctAnswer?: number | boolean;
  matchingPairs?: { left: string; right: string }[];
  explanation?: string;
  learningObjective?: string;
  userAnswer?: number | boolean | { [key: string]: string };
  isCorrect?: boolean;
  completed?: boolean;
}

interface AISession {
  id: string;
  session_type: "chat" | "summary" | "practice";
  title: string;
  context: any;
  messages: Message[];
  metadata: any;
  created_at: string;
  updated_at: string;
}

// Helper function to parse plain text questions from AI response
const parseTextQuestions = (text: string): PracticeQuestion[] => {
  const questions: PracticeQuestion[] = [];

  // Split by question numbers or patterns
  const questionBlocks = text
    .split(/Question \d+/i)
    .filter((block) => block.trim());

  questionBlocks.forEach((block, index) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);
    if (lines.length === 0) return;

    // Debug logging
    console.log(`\n=== Parsing question block ${index + 1} ===`);
    console.log("Raw block:", block);
    console.log("Lines:", lines);

    // Determine question type
    const blockText = block.toLowerCase();
    let type: "multiple-choice" | "true-false" | "matching" = "multiple-choice";

    if (
      blockText.includes("true or false") ||
      blockText.includes("true/false")
    ) {
      type = "true-false";
    } else if (blockText.includes("match") || blockText.includes("matching")) {
      type = "matching";
    }

    // Extract question text (first substantial line)
    let questionText = lines[0];
    if (questionText.includes(":")) {
      questionText = questionText.split(":").slice(1).join(":").trim();
    }

    // Remove type indicators from question text
    questionText = questionText.replace(/\(.*?\)\s*:?\s*/g, "").trim();
    console.log("Extracted question text:", questionText);

    if (type === "multiple-choice") {
      // Extract options (lines starting with A), B), C), D) or similar)
      const options: string[] = [];
      const optionMap: { [key: string]: number } = {}; // Map letter to index
      let correctAnswer = 0;
      let correctAnswerFound = false;
      let correctAnswerLetter = "";

      // First pass: collect all options in order
      lines.forEach((line, lineIndex) => {
        const optionMatch = line.match(/^([A-D])[\)\.]\s*(.+)/);
        if (optionMatch) {
          const optionLetter = optionMatch[1].toUpperCase();
          const optionText = optionMatch[2].trim();
          const optionIndex = options.length; // Use actual array index
          options.push(optionText);
          optionMap[optionLetter] = optionIndex;
          console.log(
            `Found option ${optionLetter} at index ${optionIndex}: ${optionText}`,
          );
        }
      });

      console.log("All options collected:", options);
      console.log("Option map (letter to index):", optionMap);

      // Second pass: find correct answer with more robust parsing
      lines.forEach((line, lineIndex) => {
        const lineLower = line.toLowerCase();
        if (
          lineLower.includes("correct answer") ||
          (lineLower.includes("answer:") && !lineLower.includes("question"))
        ) {
          console.log("Found answer line:", line);

          // Look for the answer letter in this line - try multiple patterns
          let answerMatch = line.match(
            /(?:correct\s+answer|answer)\s*:?\s*([A-D])[\)\.]?/i,
          );
          if (!answerMatch) {
            // Try just looking for a standalone letter
            answerMatch = line.match(/\b([A-D])\b/i);
          }

          if (answerMatch) {
            correctAnswerLetter = answerMatch[1].toUpperCase();
            if (optionMap.hasOwnProperty(correctAnswerLetter)) {
              correctAnswer = optionMap[correctAnswerLetter];
              correctAnswerFound = true;
              console.log(
                `Found correct answer: ${correctAnswerLetter} maps to index ${correctAnswer}`,
              );
              console.log(`Correct answer text: "${options[correctAnswer]}"`);
            } else {
              console.warn(
                `Answer letter ${correctAnswerLetter} not found in option map`,
              );
            }
          } else {
            console.warn("Could not extract answer letter from line:", line);
          }
        }
      });

      // Enhanced fallback: if no explicit correct answer found, try to infer from explanation
      if (!correctAnswerFound && options.length > 0) {
        const explanation = extractExplanation(block);
        console.log(
          `No explicit answer found, checking explanation: "${explanation}"`,
        );

        // Try to match explanation content with option content using better scoring
        let bestMatch = -1;
        let bestScore = 0;

        for (let i = 0; i < options.length; i++) {
          const option = options[i].toLowerCase();
          const explanationLower = explanation.toLowerCase();

          // Calculate similarity score based on word overlap
          const optionWords = option
            .split(/\s+/)
            .filter((word) => word.length > 2)
            .map((word) => word.replace(/[^a-z]/g, ""));

          const explanationWords = explanationLower
            .split(/\s+/)
            .map((word) => word.replace(/[^a-z]/g, ""));

          let matchingWords = 0;
          let totalSignificantWords = 0;

          optionWords.forEach((word) => {
            if (word.length > 2) {
              totalSignificantWords++;
              if (
                explanationWords.some(
                  (expWord) => expWord.includes(word) || word.includes(expWord),
                )
              ) {
                matchingWords++;
              }
            }
          });

          const score =
            totalSignificantWords > 0
              ? matchingWords / totalSignificantWords
              : 0;
          console.log(
            `Option ${i} ("${option}") similarity score: ${score} (${matchingWords}/${totalSignificantWords})`,
          );

          if (score > bestScore && score > 0.3) {
            // Require at least 30% match
            bestScore = score;
            bestMatch = i;
          }
        }

        if (bestMatch >= 0) {
          correctAnswer = bestMatch;
          correctAnswerFound = true;
          console.log(
            `Inferred correct answer from explanation: option ${bestMatch} (${String.fromCharCode(65 + bestMatch)}) with score ${bestScore}`,
          );
        }
      }

      if (options.length >= 2) {
        const question = {
          type: "multiple-choice" as const,
          question: questionText,
          options,
          correctAnswer,
          explanation: extractExplanation(block),
        };

        console.log(`\n=== Created question ===`);
        console.log("Question:", questionText);
        console.log("Options:", options);
        console.log("Correct answer index:", correctAnswer);
        console.log("Correct answer text:", options[correctAnswer]);
        console.log(
          "Correct answer letter:",
          String.fromCharCode(65 + correctAnswer),
        );
        console.log("Answer found explicitly:", correctAnswerFound);
        console.log("========================\n");

        questions.push(question);
      } else {
        console.warn("Not enough options found for multiple choice question");
      }
    } else if (type === "true-false") {
      let correctAnswer = true;

      // Look for correct answer
      const answerLine = lines.find(
        (line) =>
          line.toLowerCase().includes("correct answer") ||
          line.toLowerCase().includes("answer:"),
      );

      if (answerLine) {
        correctAnswer = answerLine.toLowerCase().includes("true");
      }

      questions.push({
        type: "true-false",
        question: questionText,
        correctAnswer,
        explanation: extractExplanation(block),
      });
    }
  });

  console.log(
    `\n=== FINAL RESULT: Parsed ${questions.length} questions total ===`,
  );
  return questions;
};

// Helper function to extract explanation from question block
const extractExplanation = (block: string): string => {
  const lines = block.split("\n").map((line) => line.trim());

  // Look for explanation line
  let explanationIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.includes("explanation:") || line.startsWith("explanation")) {
      explanationIndex = i;
      break;
    }
  }

  if (explanationIndex >= 0) {
    // Get the explanation line and potentially following lines
    let explanation = lines[explanationIndex]
      .replace(/explanation:\s*/i, "")
      .trim();

    // If the explanation line is empty or very short, check the next line
    if (explanation.length < 10 && explanationIndex + 1 < lines.length) {
      const nextLine = lines[explanationIndex + 1];
      if (
        nextLine &&
        !nextLine.match(/^[A-D][\)\.]/) &&
        !nextLine.toLowerCase().includes("question")
      ) {
        explanation = nextLine.trim();
      }
    }

    // Clean up common prefixes
    explanation = explanation.replace(/^(\*\*\*\*|\*\*|\*)\s*/, "").trim();

    return explanation || "No explanation provided.";
  }

  // Fallback: look for lines that might be explanations
  const potentialExplanation = lines.find(
    (line) =>
      line.toLowerCase().includes("because") ||
      line.toLowerCase().includes("this is") ||
      line.toLowerCase().includes("refers to") ||
      (line.length > 20 &&
        !line.match(/^[A-D][\)\.]/) &&
        !line.toLowerCase().includes("question")),
  );

  return potentialExplanation?.trim() || "No explanation provided.";
};

const AIChatSidebar = ({
  currentNote,
  context,
  onAnalyzeNote = () => {},
  onGenerateSummary = () => {},
  onCreatePracticeProblems = () => {},
  isOpen = false,
  onClose = () => {},
}: AIChatSidebarProps) => {
  const { user } = useAuth();
  const supabase = createClient();
  
  // Use direct type casting to bypass Supabase type inference issues
  const supabaseTyped = supabase as any;

  const [activeTab, setActiveTab] = useState("chat");
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hello! I'm your AI study assistant. How can I help you with your notes today?",
      sender: "ai",
      timestamp: new Date(),
    },
  ]);

  const [summaries, setSummaries] = useState<any[]>([]);
  const [practiceProblems, setPracticeProblems] = useState<any[]>([]);
  const [practiceQuestions, setPracticeQuestions] = useState<
    PracticeQuestion[]
  >([]);
  const [allNotes, setAllNotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isPracticeLoading, setIsPracticeLoading] = useState(false);
  const [aiSessions, setAISessions] = useState<AISession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load all user notes when assistant opens
  const loadAllNotes = useCallback(async () => {
    if (!user || !isOpen) return;

    try {
      const { data: pagesData, error } = await supabaseTyped
        .from("pages")
        .select("id, title, content, content_json, section_id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error loading notes:", error);
      } else {
        const formattedNotes = (pagesData || []).map((page) => {
          let content = "";
          try {
            if (page.content) {
              content = page.content;
            } else if (page.content_json) {
              const parsedJson = safeJsonParse(page.content_json);
              content = extractPlainText(parsedJson);
            }
          } catch (e) {
            console.warn("Error extracting content from page:", page.id, e);
            content = page.content || "";
          }
          return {
            id: page.id,
            title: page.title || "Untitled",
            content: content || "",
            sectionId: page.section_id,
          };
        });
        setAllNotes(formattedNotes);
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  }, [user, supabaseTyped, isOpen]);

  // Load AI summaries, practice problems, and sessions from database
  useEffect(() => {
    if (user && currentNote?.id) {
      loadAISummaries();
      loadPracticeProblems();
    }
    if (isOpen) {
      loadAllNotes();
      loadAISessions();
    }
  }, [user, currentNote?.id, isOpen, loadAllNotes]);

  const loadAISummaries = async () => {
    if (!user || !currentNote?.id) return;

    try {
      const { data, error } = await supabaseTyped
        .from("ai_summaries")
        .select("*")
        .eq("user_id", user.id)
        .eq("note_id", currentNote.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading AI summaries:", error);
      } else {
        const formattedSummaries = (data || []).map((summary) => ({
          id: summary.id,
          noteTitle: currentNote.title,
          content: summary.content,
          timestamp: new Date(summary.created_at!),
        }));
        setSummaries(formattedSummaries);
      }
    } catch (error) {
      console.error("Error loading AI summaries:", error);
    }
  };

  const loadPracticeProblems = async () => {
    if (!user || !currentNote?.id) return;

    try {
      const { data, error } = await supabase
        .from("practice_problems")
        .select("*")
        .eq("user_id", user.id)
        .eq("note_id", currentNote.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading practice problems:", error);
      } else {
        setPracticeProblems(data || []);
      }
    } catch (error) {
      console.error("Error loading practice problems:", error);
    }
  };

  // Helper function to safely parse messages from database
  const parseSessionMessages = (messagesData: any): Message[] => {
    try {
      if (!messagesData) return [];

      // If it's already an array, validate and return
      if (Array.isArray(messagesData)) {
        return messagesData
          .filter(
            (msg) =>
              msg &&
              typeof msg === "object" &&
              typeof msg.id === "string" &&
              typeof msg.content === "string" &&
              (msg.sender === "user" || msg.sender === "ai"),
          )
          .map((msg) => ({
            ...msg,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          }));
      }

      // If it's a string, try to parse it
      if (typeof messagesData === "string") {
        const parsed = JSON.parse(messagesData);
        if (Array.isArray(parsed)) {
          return parsed
            .filter(
              (msg) =>
                msg &&
                typeof msg === "object" &&
                typeof msg.id === "string" &&
                typeof msg.content === "string" &&
                (msg.sender === "user" || msg.sender === "ai"),
            )
            .map((msg) => ({
              ...msg,
              timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
            }));
        }
      }

      return [];
    } catch (error) {
      console.warn("Failed to parse session messages:", error);
      return [];
    }
  };

  // Load AI sessions from database
  const loadAISessions = async () => {
    if (!user) return;

    try {
      setIsHistoryLoading(true);
      const { data, error } = await supabaseTyped
        .from("ai_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading AI sessions:", error);
      } else {
        // Transform the data to match our AISession interface
        const transformedSessions: AISession[] = (data || []).map(
          (session) => ({
            id: session.id,
            session_type:
              session.session_type === "chat" ||
              session.session_type === "summary" ||
              session.session_type === "practice"
                ? (session.session_type as "chat" | "summary" | "practice")
                : "chat", // Default fallback with proper typing
            title: session.title || "Untitled Session",
            context: safeJsonParse(session.context) || {},
            messages: parseSessionMessages(session.messages),
            metadata: safeJsonParse(session.metadata) || {},
            created_at: session.created_at || new Date().toISOString(),
            updated_at: session.updated_at || new Date().toISOString(),
          }),
        );
        setAISessions(transformedSessions);
      }
    } catch (error) {
      console.error("Error loading AI sessions:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Helper function to convert messages to JSON-compatible format
  const messagesToJson = (messages: Message[]) => {
    return messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      sender: msg.sender,
      timestamp: msg.timestamp.toISOString(), // Convert Date to string
    }));
  };

  // Helper function to transform raw Supabase session data to AISession format
  const transformSessionData = (sessionData: any): AISession => {
    return {
      id: sessionData.id,
      session_type:
        sessionData.session_type === "chat" ||
        sessionData.session_type === "summary" ||
        sessionData.session_type === "practice"
          ? (sessionData.session_type as "chat" | "summary" | "practice")
          : "chat", // Default fallback with proper typing
      title: sessionData.title || "Untitled Session",
      context: safeJsonParse(sessionData.context) || {},
      messages: parseSessionMessages(sessionData.messages),
      metadata: safeJsonParse(sessionData.metadata) || {},
      created_at: sessionData.created_at || new Date().toISOString(),
      updated_at: sessionData.updated_at || new Date().toISOString(),
    };
  };

  // Save current session to database
  const saveCurrentSession = async (
    sessionType: "chat" | "summary" | "practice",
    title: string,
    sessionMessages: Message[],
    metadata: any = {},
  ) => {
    if (!user) return null;

    try {
      // Convert messages to JSON-compatible format
      const jsonMessages = messagesToJson(sessionMessages);

      const sessionData = {
        user_id: user.id,
        session_type: sessionType,
        title,
        context: context || {},
        messages: jsonMessages as any, // Cast to any to satisfy JSON type
        metadata,
      };

      if (currentSessionId) {
        // Update existing session
        const { data, error } = await supabaseTyped
          .from("ai_sessions")
          .update({
            messages: jsonMessages as any, // Cast to any to satisfy JSON type
            metadata,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentSessionId)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) {
          console.error("Error updating AI session:", error);
        } else {
          return data;
        }
      } else {
        // Create new session
        const { data, error } = await supabaseTyped
          .from("ai_sessions")
          .insert(sessionData)
          .select()
          .single();

        if (error) {
          console.error("Error creating AI session:", error);
        } else {
          setCurrentSessionId(data.id);
          // Transform the raw Supabase data to match AISession interface
          const transformedSession = transformSessionData(data);
          setAISessions((prev) => [transformedSession, ...prev]);
          return data;
        }
      }
    } catch (error) {
      console.error("Error saving AI session:", error);
    }
    return null;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    const query = inputValue;
    setInputValue("");
    setIsLoading(true);

    try {
      // Prepare conversation history for context
      const conversationHistory = updatedMessages.slice(-10).map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
      }));

      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "chat",
          query,
          notes: allNotes || [],
          context: context || {},
          sessionId: currentSessionId,
          conversationHistory: conversationHistory.slice(0, -1), // Exclude the current message
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get AI response");
      }

      const aiResponse: Message = {
        id: `ai-${Date.now()}`,
        content: data.response,
        sender: "ai",
        timestamp: new Date(),
      };

      const finalMessages = [...updatedMessages, aiResponse];
      setMessages(finalMessages);

      // Save session
      const sessionTitle =
        finalMessages.length <= 2
          ? query.substring(0, 50) + (query.length > 50 ? "..." : "")
          : aiSessions.find((s) => s.id === currentSessionId)?.title ||
            query.substring(0, 50) + (query.length > 50 ? "..." : "");

      await saveCurrentSession("chat", sessionTitle, finalMessages);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: `ai-error-${Date.now()}`,
        content: "Sorry, I encountered an error. Please try again.",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!user || allNotes.length === 0) return;

    onGenerateSummary();
    setActiveTab("summaries");
    setIsSummaryLoading(true);

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "summaries",
          notes: allNotes || [],
          context: context || {},
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate summary");
      }

      const summaryContent = data.response;
      const contextTitle =
        context?.currentPage?.title ||
        context?.currentSection?.name ||
        context?.currentNotebook?.name ||
        "All Notes";

      // Save to database if we have a current note
      if (currentNote?.id) {
        const { data: dbData, error } = await supabaseTyped
          .from("ai_summaries")
          .insert({
            user_id: user.id,
            note_id: currentNote.id,
            content: summaryContent,
          })
          .select()
          .single();

        if (error) {
          console.error("Error saving AI summary:", error);
        }
      }

      const newSummary = {
        id: `summary-${Date.now()}`,
        noteTitle: contextTitle,
        content: summaryContent,
        timestamp: new Date(),
      };
      setSummaries((prev) => [newSummary, ...prev]);

      // Save session for summary
      const summaryTitle = `Summary: ${contextTitle}`;
      await saveCurrentSession("summary", summaryTitle, [], {
        summaryLength: summaryContent.length,
        context: context || {},
      });
    } catch (error) {
      console.error("Error generating summary:", error);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleCreatePracticeProblems = async () => {
    if (!user || allNotes.length === 0) return;

    onCreatePracticeProblems();
    setActiveTab("practice");
    setIsPracticeLoading(true);

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "practice",
          notes: allNotes || [],
          context: context || {},
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate practice problems");
      }

      // Handle text response from AI
      const responseText =
        typeof data.response === "string"
          ? data.response
          : data.response?.text ||
            "No questions could be generated from your notes.";

      // Parse the plain text response to extract questions
      const parsedQuestions = parseTextQuestions(responseText);

      if (parsedQuestions.length > 0) {
        setPracticeQuestions(parsedQuestions);

        // Save session for practice questions
        const practiceTitle = `Practice: ${context?.currentPage?.title || context?.currentSection?.name || "Study Session"}`;
        await saveCurrentSession("practice", practiceTitle, [], {
          questionsCount: parsedQuestions.length,
          context: context || {},
        });
      } else {
        // Fallback if parsing fails
        const fallbackQuestion: PracticeQuestion = {
          type: "true-false",
          question:
            "Based on your notes, would you say the main concepts are clearly explained?",
          correctAnswer: true,
          explanation:
            "This is a fallback question. The AI response could not be parsed into structured questions.",
        };
        setPracticeQuestions([fallbackQuestion]);
      }

      // Save to database if we have a current note and valid questions
      if (currentNote?.id && parsedQuestions.length > 0) {
        for (const question of parsedQuestions) {
          if (question && typeof question.question === "string") {
            const problemData = {
              user_id: user.id,
              note_id: currentNote.id,
              question: question.question,
              options: Array.isArray(question.options) ? question.options : [],
              correct_answer:
                typeof question.correctAnswer === "number"
                  ? question.correctAnswer
                  : 0,
              completed: false,
            };

            const { error } = await supabaseTyped
              .from("practice_problems")
              .insert(problemData);

            if (error) {
              console.error("Error saving practice problem:", error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error creating practice problems:", error);
    } finally {
      setIsPracticeLoading(false);
    }
  };

  const handleAnalyzeNote = async () => {
    onAnalyzeNote();
    setActiveTab("chat");
    setIsLoading(true);

    try {
      const contextInfo = context?.currentPage?.title || "your current notes";
      const query = `Please analyze ${contextInfo} and provide insights about the key concepts and topics covered.`;

      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "chat",
          query,
          notes: allNotes || [],
          context: context || {},
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze note");
      }

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        content: data.response,
        sender: "ai",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error analyzing note:", error);
      const errorMessage: Message = {
        id: `ai-error-${Date.now()}`,
        content: "Sorry, I couldn't analyze the note. Please try again.",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerQuestion = (
    questionIndex: number,
    answer: number | boolean | { [key: string]: string },
  ) => {
    setPracticeQuestions((prev) =>
      prev.map((q, i) => {
        if (i === questionIndex) {
          let isCorrect = false;

          // Evaluate answer based on question type
          if (q.type === "multiple-choice") {
            // Ensure both values are numbers for proper comparison
            const userAnswerIndex = typeof answer === "number" ? answer : -1;
            const correctAnswerIndex =
              typeof q.correctAnswer === "number" ? q.correctAnswer : -1;

            isCorrect = userAnswerIndex === correctAnswerIndex;

            // Enhanced debug logging for multiple choice questions
            console.log(
              `\n=== GRADING MULTIPLE CHOICE QUESTION ${questionIndex + 1} ===`,
            );
            console.log("Question:", q.question);
            console.log("All options:", q.options);
            console.log("User selected index:", userAnswerIndex);
            console.log(
              "User selected text:",
              q.options?.[userAnswerIndex] || "INVALID INDEX",
            );
            console.log("Correct answer index:", correctAnswerIndex);
            console.log(
              "Correct answer text:",
              q.options?.[correctAnswerIndex] || "INVALID INDEX",
            );
            console.log(
              "Answer types - user:",
              typeof answer,
              "correct:",
              typeof q.correctAnswer,
            );
            console.log(
              "Comparison result (user === correct):",
              userAnswerIndex === correctAnswerIndex,
            );
            console.log("Final isCorrect:", isCorrect);
            console.log("Explanation:", q.explanation);
            console.log("=== END GRADING ===\n");

            // Additional validation
            if (
              userAnswerIndex < 0 ||
              userAnswerIndex >= (q.options?.length || 0)
            ) {
              console.error(
                "Invalid user answer index:",
                userAnswerIndex,
                "Options length:",
                q.options?.length,
              );
            }
            if (
              correctAnswerIndex < 0 ||
              correctAnswerIndex >= (q.options?.length || 0)
            ) {
              console.error(
                "Invalid correct answer index:",
                correctAnswerIndex,
                "Options length:",
                q.options?.length,
              );
            }
          } else if (q.type === "true-false") {
            isCorrect = answer === q.correctAnswer;

            console.log(`Grading true/false question ${questionIndex + 1}:`, {
              question: q.question,
              userAnswer: answer,
              correctAnswer: q.correctAnswer,
              isCorrect,
            });
          } else if (q.type === "matching") {
            // For matching questions, check if all pairs are correctly matched
            const userMatches = answer as { [key: string]: string };
            const correctPairs = q.matchingPairs || [];
            isCorrect = correctPairs.every(
              (pair) => userMatches[pair.left] === pair.right,
            );

            console.log(`Grading matching question ${questionIndex + 1}:`, {
              question: q.question,
              userMatches,
              correctPairs,
              isCorrect,
            });
          }

          return {
            ...q,
            userAnswer: answer,
            isCorrect,
            completed: true,
          };
        }
        return q;
      }),
    );
  };

  const handleCompleteProblem = async (problemId: string) => {
    if (!user) return;

    try {
      const { error } = await supabaseTyped
        .from("practice_problems")
        .update({ completed: true })
        .eq("id", problemId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error updating practice problem:", error);
      } else {
        setPracticeProblems((prev) =>
          prev.map((problem) =>
            problem.id === problemId
              ? { ...problem, completed: true }
              : problem,
          ),
        );
      }
    } catch (error) {
      console.error("Error completing practice problem:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 right-0 h-screen w-[600px] bg-background border-l shadow-lg z-50 flex flex-col">
      {/* Header - Fixed at top */}
      <div className="flex-shrink-0 p-4 border-b flex items-center justify-between bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=ai-assistant" />
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-sm">Study Assistant</h3>
            <p className="text-xs text-muted-foreground">
              AI-powered learning companion
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-xs">
            <Brain size={12} />
            <span>Smart AI</span>
          </Badge>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs - Fixed below header */}
      <div className="flex-shrink-0 border-b px-4 bg-background/95 backdrop-blur-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start h-10">
            <TabsTrigger
              value="chat"
              className="flex gap-1 items-center text-xs"
            >
              <Brain size={14} />
              Chat
            </TabsTrigger>
            <TabsTrigger
              value="summaries"
              className="flex gap-1 items-center text-xs"
            >
              <FileText size={14} />
              Summaries
            </TabsTrigger>
            <TabsTrigger
              value="practice"
              className="flex gap-1 items-center text-xs"
            >
              <BookOpen size={14} />
              Practice
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex gap-1 items-center text-xs"
            >
              <History size={14} />
              History
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content Area - Flexible */}
      <div className="flex-1 min-h-0">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="h-full flex flex-col"
        >
          <TabsContent
            value="chat"
            className="flex-1 flex flex-col m-0 data-[state=active]:flex h-full"
          >
            {/* Chat Messages - Takes up all available space */}
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full w-full">
                <div className="p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl p-3 shadow-sm ${
                          message.sender === "user"
                            ? "bg-primary text-primary-foreground ml-4"
                            : "bg-muted/80 mr-4"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </p>
                        <p className="text-xs opacity-60 mt-2">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted/80 rounded-xl p-3 flex items-center gap-2 mr-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">AI is thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </div>

            {/* Chat Input - Fixed at bottom */}
            <div className="flex-shrink-0 p-3 border-t bg-background/95 backdrop-blur-sm">
              {allNotes && allNotes.length > 0 && (
                <div className="flex gap-1 mb-3 justify-center flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAnalyzeNote}
                    disabled={isLoading}
                    className="text-xs h-7 px-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Analyze"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateSummary}
                    disabled={isSummaryLoading}
                    className="text-xs h-7 px-2"
                  >
                    {isSummaryLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Summary"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreatePracticeProblems}
                    disabled={isPracticeLoading}
                    className="text-xs h-7 px-2"
                  >
                    {isPracticeLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Practice"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMessages([
                        {
                          id: "1",
                          content:
                            "Hello! I'm your AI study assistant. How can I help you with your notes today?",
                          sender: "ai",
                          timestamp: new Date(),
                        },
                      ]);
                      setCurrentSessionId(null);
                    }}
                    className="text-xs h-7 px-2"
                  >
                    New Chat
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder={
                    allNotes && allNotes.length > 0
                      ? "Ask about your notes..."
                      : "Loading notes..."
                  }
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && handleSendMessage()
                  }
                  disabled={isLoading || !allNotes || allNotes.length === 0}
                  className="flex-1 h-9"
                />
                <Button
                  size="sm"
                  onClick={handleSendMessage}
                  disabled={
                    isLoading ||
                    !inputValue.trim() ||
                    !allNotes ||
                    allNotes.length === 0
                  }
                  className="h-9 w-9 p-0"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="summaries"
            className="flex-1 flex flex-col m-0 data-[state=active]:flex h-full"
          >
            {/* Summaries Content - Takes up all available space */}
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full w-full">
                <div className="p-4 space-y-4">
                  {isSummaryLoading && (
                    <Card className="border-dashed">
                      <CardContent className="py-6">
                        <div className="flex items-center justify-center gap-3">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm font-medium">
                            Generating summary...
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {summaries.map((summary) => (
                    <Card
                      key={summary.id}
                      className="shadow-sm hover:shadow-md transition-shadow"
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-foreground">
                          {summary.noteTitle}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="prose prose-sm max-w-none">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                            {summary.content}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                          <p className="text-xs text-muted-foreground">
                            Generated {summary.timestamp.toLocaleDateString()}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            Summary
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {summaries.length === 0 && !isSummaryLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="rounded-full bg-muted/50 p-4 mb-4">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium text-foreground mb-2">
                        No summaries yet
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        Generate AI-powered summaries of your notes to quickly
                        review key concepts
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Generate Button - Fixed at bottom */}
            <div className="flex-shrink-0 p-4 border-t bg-background/95 backdrop-blur-sm">
              <Button
                onClick={handleGenerateSummary}
                className="w-full h-10"
                disabled={
                  isSummaryLoading || !allNotes || allNotes.length === 0
                }
              >
                {isSummaryLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Generate New Summary
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent
            value="practice"
            className="flex-1 flex flex-col m-0 data-[state=active]:flex h-full"
          >
            {/* Practice Content - Takes up all available space */}
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full w-full">
                <div className="p-4 space-y-4">
                  {isPracticeLoading && (
                    <Card className="border-dashed">
                      <CardContent className="py-6">
                        <div className="flex items-center justify-center gap-3">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm font-medium">
                            Generating practice questions...
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {practiceQuestions.map((question, index) => (
                    <Card
                      key={index}
                      className={`shadow-sm hover:shadow-md transition-all ${
                        question.completed
                          ? question.isCorrect
                            ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                            : "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
                          : "hover:border-primary/20"
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <CardTitle className="text-sm font-semibold">
                              {question.type === "multiple-choice"
                                ? "Multiple Choice"
                                : question.type === "true-false"
                                  ? "True/False"
                                  : "Matching"}{" "}
                              Question {index + 1}
                            </CardTitle>
                            {question.difficulty && (
                              <Badge variant="secondary" className="text-xs">
                                {question.difficulty}
                              </Badge>
                            )}
                          </div>
                          {question.completed && (
                            <Badge
                              variant="outline"
                              className={`${
                                question.isCorrect
                                  ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800"
                                  : "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800"
                              }`}
                            >
                              {question.isCorrect ? (
                                <CheckCircle size={12} className="mr-1" />
                              ) : (
                                <AlertCircle size={12} className="mr-1" />
                              )}
                              {question.isCorrect ? "Correct" : "Incorrect"}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm font-medium mb-4 leading-relaxed">
                          {question.question}
                        </p>
                        {question.type === "multiple-choice" &&
                        question.options ? (
                          <div className="space-y-2">
                            {question.options.map(
                              (option: string, optionIndex: number) => (
                                <Button
                                  key={optionIndex}
                                  variant={
                                    question.completed
                                      ? optionIndex === question.correctAnswer
                                        ? "default"
                                        : optionIndex === question.userAnswer
                                          ? "destructive"
                                          : "outline"
                                      : "outline"
                                  }
                                  className="justify-start text-left h-auto p-3 w-full"
                                  disabled={question.completed}
                                  onClick={() =>
                                    handleAnswerQuestion(index, optionIndex)
                                  }
                                >
                                  <span className="text-wrap text-sm">
                                    {option}
                                  </span>
                                </Button>
                              ),
                            )}
                          </div>
                        ) : question.type === "true-false" ? (
                          <div className="space-y-2">
                            <Button
                              variant={
                                question.completed
                                  ? question.correctAnswer === true
                                    ? "default"
                                    : question.userAnswer === true
                                      ? "destructive"
                                      : "outline"
                                  : "outline"
                              }
                              className="justify-center h-auto p-3 w-full"
                              disabled={question.completed}
                              onClick={() => handleAnswerQuestion(index, true)}
                            >
                              <span className="text-sm font-medium">True</span>
                            </Button>
                            <Button
                              variant={
                                question.completed
                                  ? question.correctAnswer === false
                                    ? "default"
                                    : question.userAnswer === false
                                      ? "destructive"
                                      : "outline"
                                  : "outline"
                              }
                              className="justify-center h-auto p-3 w-full"
                              disabled={question.completed}
                              onClick={() => handleAnswerQuestion(index, false)}
                            >
                              <span className="text-sm font-medium">False</span>
                            </Button>
                          </div>
                        ) : question.type === "matching" &&
                          question.matchingPairs ? (
                          <MatchingQuestion
                            pairs={question.matchingPairs}
                            completed={question.completed ?? false}
                            userAnswer={
                              (question.userAnswer as {
                                [key: string]: string;
                              }) || {}
                            }
                            onAnswer={(matches) =>
                              handleAnswerQuestion(index, matches)
                            }
                          />
                        ) : (
                          <div className="text-center py-4 text-muted-foreground">
                            <p className="text-sm">
                              Question format not supported
                            </p>
                          </div>
                        )}
                        {question.completed && (
                          <div className="mt-4 space-y-3">
                            {question.explanation && (
                              <div className="p-3 bg-muted/50 rounded-lg border">
                                <p className="text-xs font-semibold mb-2 text-foreground">
                                  Explanation:
                                </p>
                                <p className="text-xs leading-relaxed text-foreground/80">
                                  {question.explanation}
                                </p>
                              </div>
                            )}
                            {question.learningObjective && (
                              <div className="p-3 bg-blue-50/80 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-xs font-semibold mb-2 text-blue-900 dark:text-blue-100">
                                  Learning Objective:
                                </p>
                                <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-200">
                                  {question.learningObjective}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {practiceQuestions.length === 0 && !isPracticeLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="rounded-full bg-muted/50 p-4 mb-4">
                        <BookOpen className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium text-foreground mb-2">
                        No practice questions yet
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        Generate AI-powered practice questions to test your
                        knowledge and reinforce learning
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Generate Button - Fixed at bottom */}
            <div className="flex-shrink-0 p-4 border-t bg-background/95 backdrop-blur-sm">
              <Button
                onClick={handleCreatePracticeProblems}
                className="w-full h-10"
                disabled={
                  isPracticeLoading || !allNotes || allNotes.length === 0
                }
              >
                {isPracticeLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Generate New Questions
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent
            value="history"
            className="flex-1 flex flex-col m-0 data-[state=active]:flex h-full"
          >
            {/* History Content - Takes up all available space */}
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full w-full">
                <div className="p-4 space-y-3">
                  {isHistoryLoading && (
                    <Card className="border-dashed">
                      <CardContent className="py-6">
                        <div className="flex items-center justify-center gap-3">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm font-medium">
                            Loading history...
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {aiSessions.map((session) => (
                    <Card
                      key={session.id}
                      className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/20"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-semibold line-clamp-2 mb-2">
                              {session.title}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {session.session_type === "chat" && (
                                  <MessageSquare size={10} className="mr-1" />
                                )}
                                {session.session_type === "summary" && (
                                  <FileText size={10} className="mr-1" />
                                )}
                                {session.session_type === "practice" && (
                                  <BookOpen size={10} className="mr-1" />
                                )}
                                {session.session_type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(
                                  session.updated_at,
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Continue session
                                if (session.session_type === "chat") {
                                  setActiveTab("chat");
                                  // Ensure messages is a valid array before setting
                                  const validMessages = Array.isArray(
                                    session.messages,
                                  )
                                    ? session.messages
                                    : [];
                                  setMessages(validMessages);
                                  setCurrentSessionId(session.id);
                                } else if (session.session_type === "summary") {
                                  setActiveTab("summaries");
                                } else if (
                                  session.session_type === "practice"
                                ) {
                                  setActiveTab("practice");
                                }
                              }}
                              className="h-7 w-7 p-0 hover:bg-primary/10"
                              title="Continue session"
                            >
                              <Play size={12} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                // Delete session
                                if (
                                  confirm(
                                    "Are you sure you want to delete this session?",
                                  )
                                ) {
                                  try {
                                    const { error } = await supabaseTyped
                                      .from("ai_sessions")
                                      .delete()
                                      .eq("id", session.id)
                                      .eq("user_id", user!.id);

                                    if (!error) {
                                      setAISessions((prev) =>
                                        prev.filter((s) => s.id !== session.id),
                                      );
                                      if (currentSessionId === session.id) {
                                        setCurrentSessionId(null);
                                      }
                                    }
                                  } catch (error) {
                                    console.error(
                                      "Error deleting session:",
                                      error,
                                    );
                                  }
                                }
                              }}
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Delete session"
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                          {session.messages && session.messages.length > 0
                            ? (session.messages[
                                session.messages.length - 1
                              ]?.content?.substring(0, 120) || "No content") +
                              "..."
                            : "No messages yet"}
                        </p>
                        <div className="flex justify-between items-center pt-2 border-t border-border/50">
                          <span className="text-xs text-muted-foreground">
                            {session.messages?.length || 0} messages
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(session.updated_at).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {aiSessions.length === 0 && !isHistoryLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="rounded-full bg-muted/50 p-4 mb-4">
                        <History className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium text-foreground mb-2">
                        No AI sessions yet
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        Start a conversation with the AI assistant to see your
                        session history
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Refresh Button - Fixed at bottom */}
            <div className="flex-shrink-0 p-4 border-t bg-background/95 backdrop-blur-sm">
              <Button
                onClick={loadAISessions}
                className="w-full h-10"
                disabled={isHistoryLoading}
                variant="outline"
              >
                {isHistoryLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh History
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AIChatSidebar;