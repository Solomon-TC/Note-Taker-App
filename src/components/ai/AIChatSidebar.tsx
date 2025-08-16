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
  type: "multiple-choice" | "open-ended";
  difficulty?: "intermediate" | "advanced" | "expert";
  question: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  learningObjective?: string;
  userAnswer?: number | string;
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
      const { data: pagesData, error } = await supabase
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
            content =
              page.content ||
              (page.content_json
                ? extractPlainText(safeJsonParse(page.content_json))
                : "");
          } catch (e) {
            console.warn("Error extracting content from page:", page.id, e);
            content = page.content || "";
          }
          return {
            id: page.id,
            title: page.title || "Untitled",
            content,
            sectionId: page.section_id,
          };
        });
        setAllNotes(formattedNotes);
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  }, [user, supabase, isOpen]);

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
      const { data, error } = await supabase
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

  // Load AI sessions from database
  const loadAISessions = async () => {
    if (!user) return;

    try {
      setIsHistoryLoading(true);
      const { data, error } = await supabase
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
                ? session.session_type
                : "chat", // Default fallback
            title: session.title,
            context: safeJsonParse(session.context) || {},
            messages: safeJsonParse(session.messages) || [],
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

  // Save current session to database
  const saveCurrentSession = async (
    sessionType: "chat" | "summary" | "practice",
    title: string,
    sessionMessages: Message[],
    metadata: any = {},
  ) => {
    if (!user) return null;

    try {
      const sessionData = {
        user_id: user.id,
        session_type: sessionType,
        title,
        context: context || {},
        messages: sessionMessages,
        metadata,
      };

      if (currentSessionId) {
        // Update existing session
        const { data, error } = await supabase
          .from("ai_sessions")
          .update({
            messages: sessionMessages,
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
        const { data, error } = await supabase
          .from("ai_sessions")
          .insert(sessionData)
          .select()
          .single();

        if (error) {
          console.error("Error creating AI session:", error);
        } else {
          setCurrentSessionId(data.id);
          setAISessions((prev) => [data, ...prev]);
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
        const { data: dbData, error } = await supabase
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

      // Handle both JSON and text responses
      if (data.response.questions) {
        setPracticeQuestions(data.response.questions);

        // Save session for practice questions
        const practiceTitle = `Practice: ${context?.currentPage?.title || context?.currentSection?.name || "Study Session"}`;
        await saveCurrentSession("practice", practiceTitle, [], {
          questionsCount: data.response.questions.length,
          context: context || {},
        });
      } else {
        // Fallback for text response
        const fallbackQuestion: PracticeQuestion = {
          type: "open-ended",
          question: data.response.text || data.response,
          explanation: "AI-generated practice question",
        };
        setPracticeQuestions([fallbackQuestion]);
      }

      // Save to database if we have a current note
      if (currentNote?.id && data.response.questions) {
        for (const question of data.response.questions) {
          const problemData = {
            user_id: user.id,
            note_id: currentNote.id,
            question: question.question,
            options: question.options || [],
            correct_answer: question.correctAnswer || 0,
            completed: false,
          };

          const { error } = await supabase
            .from("practice_problems")
            .insert(problemData);

          if (error) {
            console.error("Error saving practice problem:", error);
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
    answer: number | string,
  ) => {
    setPracticeQuestions((prev) =>
      prev.map((q, i) => {
        if (i === questionIndex) {
          const isCorrect =
            q.type === "multiple-choice" ? answer === q.correctAnswer : true; // For open-ended, we'll mark as correct for now
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
      const { error } = await supabase
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
                                : "Open-Ended"}{" "}
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
                        ) : (
                          <div className="space-y-3">
                            <textarea
                              className="w-full p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                              placeholder="Type your answer here..."
                              rows={4}
                              disabled={question.completed}
                              value={(question.userAnswer as string) || ""}
                              onChange={(e) => {
                                setPracticeQuestions((prev) =>
                                  prev.map((q, i) =>
                                    i === index
                                      ? { ...q, userAnswer: e.target.value }
                                      : q,
                                  ),
                                );
                              }}
                            />
                            {!question.completed && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  handleAnswerQuestion(
                                    index,
                                    question.userAnswer || "",
                                  )
                                }
                                disabled={!question.userAnswer}
                                className="w-full"
                              >
                                Submit Answer
                              </Button>
                            )}
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
                                  setMessages(session.messages || []);
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
                                    const { error } = await supabase
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
                            ? session.messages[
                                session.messages.length - 1
                              ]?.content?.substring(0, 120) + "..."
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
