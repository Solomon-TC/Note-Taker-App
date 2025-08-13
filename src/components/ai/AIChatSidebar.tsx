"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Send, Brain, FileText, BookOpen, Award, X } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Database } from "@/types/supabase";

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
  onAnalyzeNote?: () => void;
  onGenerateSummary?: () => void;
  onCreatePracticeProblems?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const AIChatSidebar = ({
  currentNote = {
    id: "note-1",
    title: "Introduction to Psychology",
    content: "Psychology is the scientific study of mind and behavior...",
  },
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

  // Load AI summaries and practice problems from database
  useEffect(() => {
    if (user && currentNote?.id) {
      loadAISummaries();
      loadPracticeProblems();
    }
  }, [user, currentNote?.id]);

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

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: `ai-${Date.now()}`,
        content: `I've analyzed your question about "${inputValue}". Based on your notes, I can help you understand this concept better. Would you like me to generate a summary or practice problems related to this topic?`,
        sender: "ai",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  const handleGenerateSummary = async () => {
    if (!user || !currentNote?.id) return;

    onGenerateSummary();
    setActiveTab("summaries");

    try {
      // Generate AI summary content (in a real app, this would call an AI service)
      const summaryContent = `This is a generated summary of "${currentNote.title}". The summary would include key concepts, definitions, and important points from your notes.`;

      const { data, error } = await supabase
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
      } else if (data) {
        const newSummary = {
          id: data.id,
          noteTitle: currentNote.title,
          content: data.content,
          timestamp: new Date(data.created_at!),
        };
        setSummaries((prev) => [newSummary, ...prev]);
      }
    } catch (error) {
      console.error("Error generating summary:", error);
    }
  };

  const handleCreatePracticeProblems = async () => {
    if (!user || !currentNote?.id) return;

    onCreatePracticeProblems();
    setActiveTab("practice");

    try {
      // Generate practice problem (in a real app, this would call an AI service)
      const problemData = {
        user_id: user.id,
        note_id: currentNote.id,
        question: `Based on your notes about "${currentNote.title}", what would be a key concept to remember?`,
        options: [
          "Option A: First possible answer",
          "Option B: Second possible answer",
          "Option C: Third possible answer",
          "Option D: Fourth possible answer",
        ],
        correct_answer: 1,
        completed: false,
      };

      const { data, error } = await supabase
        .from("practice_problems")
        .insert(problemData)
        .select()
        .single();

      if (error) {
        console.error("Error saving practice problem:", error);
      } else if (data) {
        setPracticeProblems((prev) => [data, ...prev]);
      }
    } catch (error) {
      console.error("Error creating practice problem:", error);
    }
  };

  const handleAnalyzeNote = () => {
    onAnalyzeNote();

    // Add AI message about analyzing the current note
    const aiMessage: Message = {
      id: `ai-${Date.now()}`,
      content: `I've analyzed your note "${currentNote.title}". This note covers key concepts in the subject. Would you like me to highlight important terms, generate a summary, or create practice problems based on this content?`,
      sender: "ai",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, aiMessage]);
    setActiveTab("chat");
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
    <div className="fixed top-0 right-0 h-full w-[400px] bg-background border-l shadow-lg z-50 flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=ai-assistant" />
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">Study Assistant</h3>
            <p className="text-xs text-muted-foreground">
              AI-powered learning companion
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Brain size={14} />
            <span>Smart AI</span>
          </Badge>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col"
      >
        <div className="border-b px-4">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="chat" className="flex gap-1 items-center">
              <Brain size={16} />
              Chat
            </TabsTrigger>
            <TabsTrigger value="summaries" className="flex gap-1 items-center">
              <FileText size={16} />
              Summaries
            </TabsTrigger>
            <TabsTrigger value="practice" className="flex gap-1 items-center">
              <BookOpen size={16} />
              Practice
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="flex-1 flex flex-col p-0 m-0">
          <ScrollArea className="flex-1 p-4">
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {currentNote && (
            <div className="p-2 border-t">
              <div className="flex gap-2 mb-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyzeNote}
                  className="text-xs"
                >
                  Analyze Note
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateSummary}
                  className="text-xs"
                >
                  Generate Summary
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreatePracticeProblems}
                  className="text-xs"
                >
                  Create Problems
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Ask about your notes..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  className="flex-1"
                />
                <Button size="icon" onClick={handleSendMessage}>
                  <Send size={18} />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="summaries" className="flex-1 flex flex-col p-0 m-0">
          <ScrollArea className="flex-1 p-4">
            <div className="flex flex-col gap-4">
              {summaries.map((summary) => (
                <Card key={summary.id}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">
                      {summary.noteTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <p className="text-sm">{summary.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Generated {summary.timestamp.toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          {currentNote && (
            <div className="p-4 border-t">
              <Button onClick={handleGenerateSummary} className="w-full">
                <FileText className="mr-2" size={16} />
                Generate New Summary
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="practice" className="flex-1 flex flex-col p-0 m-0">
          <ScrollArea className="flex-1 p-4">
            <div className="flex flex-col gap-4">
              {practiceProblems.map((problem) => (
                <Card
                  key={problem.id}
                  className={problem.completed ? "border-green-500" : ""}
                >
                  <CardHeader className="py-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm font-medium">
                        Practice Question
                      </CardTitle>
                      {problem.completed && (
                        <Badge
                          variant="outline"
                          className="bg-green-500/10 text-green-500 border-green-500"
                        >
                          <Award size={12} className="mr-1" />
                          Completed
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="py-2">
                    <p className="text-sm font-medium mb-2">
                      {problem.question}
                    </p>
                    <div className="flex flex-col gap-2">
                      {problem.options.map((option: string, index: number) => (
                        <Button
                          key={index}
                          variant={
                            problem.completed && index === problem.correctAnswer
                              ? "default"
                              : "outline"
                          }
                          className="justify-start text-left"
                          disabled={problem.completed}
                          onClick={() => handleCompleteProblem(problem.id)}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          {currentNote && (
            <div className="p-4 border-t">
              <Button onClick={handleCreatePracticeProblems} className="w-full">
                <BookOpen className="mr-2" size={16} />
                Generate New Practice Problems
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIChatSidebar;
