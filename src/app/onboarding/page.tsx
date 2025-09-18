"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  BookOpen,
  Users,
  FileText,
  Clock,
  HandHeart,
  GraduationCap,
  Target,
  Lightbulb,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Play,
  MessageSquare,
  Sparkles,
  Zap,
} from "lucide-react";

type OnboardingStep =
  | "welcome"
  | "problems"
  | "persona"
  | "goals"
  | "classes"
  | "noteStyle"
  | "firstNote"
  | "aiDemo"
  | "friends"
  | "tour"
  | "feedbackDemo"
  | "complete";

type Persona = "freshman" | "upperclassman" | "grad" | "other";
type Goal = "organize" | "study" | "collaborate" | "exams" | "other";
type NoteStyle = "outline" | "cornell" | "freeform";

interface OnboardingData {
  persona: Persona | null;
  goal: Goal | null;
  classes: string[];
  noteStyle: NoteStyle | null;
  firstNote: string;
}

const TOTAL_STEPS = 12;

const getStepNumber = (step: OnboardingStep): number => {
  const stepMap: Record<OnboardingStep, number> = {
    welcome: 1,
    problems: 2,
    persona: 3,
    goals: 4,
    classes: 5,
    noteStyle: 6,
    firstNote: 7,
    aiDemo: 8,
    friends: 9,
    tour: 10,
    feedbackDemo: 11,
    complete: 12,
  };
  return stepMap[step];
};

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  // Use direct type casting to bypass Supabase type inference issues
  const supabaseTyped = supabase as any;

  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    persona: null,
    goal: null,
    classes: [],
    noteStyle: null,
    firstNote: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newClass, setNewClass] = useState("");

  // Handle authentication and onboarding status
  useEffect(() => {
    if (loading) {
      console.log("📚 Onboarding: Auth still loading, waiting...");
      return;
    }

    if (!user) {
      console.log("📚 Onboarding: No user, redirecting to auth");
      router.push("/auth");
      return;
    }

    // Check if user has already completed onboarding and pro status
    const checkOnboardingStatus = async () => {
      try {
        console.log(
          "📚 Onboarding: Checking onboarding status for user:",
          user.id,
        );

        // Check if user has already completed onboarding
        const { data: notebooks } = await supabaseTyped
          .from("notebooks")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        const hasNotebooks = notebooks && notebooks.length > 0;
        console.log("📚 Onboarding: Status check result:", {
          hasNotebooks,
        });

        if (hasNotebooks) {
          console.log(
            "📚 Onboarding: User already completed onboarding, redirecting to dashboard",
          );
          router.push("/dashboard");
        } else {
          console.log("📚 Onboarding: User needs onboarding, staying on page");
        }
      } catch (error) {
        console.error(
          "📚 Onboarding: Error checking onboarding status:",
          error,
        );
        // On error, allow user to stay on onboarding page
      }
    };

    checkOnboardingStatus();
  }, [user, loading, router, supabaseTyped]);

  const handleNext = () => {
    const steps: OnboardingStep[] = [
      "welcome",
      "problems",
      "persona",
      "goals",
      "classes",
      "noteStyle",
      "firstNote",
      "aiDemo",
      "friends",
      "tour",
      "feedbackDemo",
      "complete",
    ];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    const steps: OnboardingStep[] = [
      "welcome",
      "problems",
      "persona",
      "goals",
      "classes",
      "noteStyle",
      "firstNote",
      "aiDemo",
      "friends",
      "tour",
      "feedbackDemo",
      "complete",
    ];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleAddClass = () => {
    if (newClass.trim() && onboardingData.classes.length < 5) {
      setOnboardingData({
        ...onboardingData,
        classes: [...onboardingData.classes, newClass.trim()],
      });
      setNewClass("");
    }
  };

  const handleRemoveClass = (index: number) => {
    setOnboardingData({
      ...onboardingData,
      classes: onboardingData.classes.filter((_, i) => i !== index),
    });
  };

  const handleCompleteOnboarding = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Create notebooks for each class
      for (const className of onboardingData.classes) {
        const { data: notebook, error: notebookError } = await supabaseTyped
          .from("notebooks")
          .insert({
            user_id: user.id,
            name: className,
            description: `Notes for ${className}`,
            color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
            sort_order: onboardingData.classes.indexOf(className),
          })
          .select()
          .single();

        if (notebookError) {
          console.error("Error creating notebook:", notebookError);
          continue;
        }

        // Create a default section for each notebook
        const { data: section, error: sectionError } = await supabaseTyped
          .from("sections")
          .insert({
            user_id: user.id,
            notebook_id: notebook.id,
            name: "Week 1",
            color: notebook.color,
            sort_order: 0,
          })
          .select()
          .single();

        if (sectionError) {
          console.error("Error creating section:", sectionError);
          continue;
        }

        // Create first note if this is the first class and user provided content
        if (
          onboardingData.classes.indexOf(className) === 0 &&
          onboardingData.firstNote.trim()
        ) {
          const defaultContent = {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: onboardingData.firstNote,
                  },
                ],
              },
            ],
          };

          await supabaseTyped.from("pages").insert({
            user_id: user.id,
            section_id: section.id,
            title: `${className} - Week 1 Notes`,
            content: onboardingData.firstNote,
            content_json: defaultContent,
            sort_order: 0,
          });
        }
      }

      // After completing onboarding, redirect to paywall for subscription
      router.push("/paywall");
    } catch (error) {
      console.error("Error completing onboarding:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const progress = (getStepNumber(currentStep) / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">Scribly</span>
            </div>
            <span className="text-sm text-muted-foreground">
              Step {getStepNumber(currentStep)} of {TOTAL_STEPS}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Welcome Step */}
        {currentStep === "welcome" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">
                Welcome to Scribly — your all-in-one study sidekick.
              </CardTitle>
              <p className="text-lg text-muted-foreground">
                Take better notes, get AI-powered study help, and share with
                friends — all in one place.
              </p>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={handleNext} size="lg" className="px-8">
                Let's set you up
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Problems Step */}
        {currentStep === "problems" && (
          <Card className="max-w-3xl mx-auto">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl font-bold mb-6">
                We know the struggle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="text-center p-6 rounded-lg bg-muted/50">
                  <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">
                    Drowning in notes across classes?
                  </h3>
                </div>
                <div className="text-center p-6 rounded-lg bg-muted/50">
                  <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">
                    Spending hours rewriting or organizing?
                  </h3>
                </div>
                <div className="text-center p-6 rounded-lg bg-muted/50">
                  <HandHeart className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">
                    Struggling to study effectively with friends?
                  </h3>
                </div>
              </div>
              <div className="text-center mb-8">
                <p className="text-lg text-muted-foreground">
                  Scribly makes studying simple — clean notes, smart AI
                  summaries and practice questions, and shared learning.
                </p>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePrevious}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleNext}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Persona Step */}
        {currentStep === "persona" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold mb-2">
                What best describes you?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 mb-8">
                {[
                  {
                    id: "freshman",
                    label: "Freshman / Sophomore",
                    icon: GraduationCap,
                  },
                  {
                    id: "upperclassman",
                    label: "Upperclassman",
                    icon: BookOpen,
                  },
                  { id: "grad", label: "Grad Student", icon: Brain },
                  { id: "other", label: "Other", icon: Users },
                ].map(({ id, label, icon: Icon }) => (
                  <Button
                    key={id}
                    variant={
                      onboardingData.persona === id ? "default" : "outline"
                    }
                    className="justify-start h-auto p-4"
                    onClick={() =>
                      setOnboardingData({
                        ...onboardingData,
                        persona: id as Persona,
                      })
                    }
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePrevious}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleNext} disabled={!onboardingData.persona}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Goals Step */}
        {currentStep === "goals" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold mb-2">
                What do you want Scribly to help you with most?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 mb-8">
                {[
                  {
                    id: "organize",
                    label: "Organize all my class notes",
                    icon: FileText,
                  },
                  { id: "study", label: "Study more efficiently", icon: Brain },
                  {
                    id: "collaborate",
                    label: "Collaborate with friends",
                    icon: Users,
                  },
                  { id: "exams", label: "Prepare for exams", icon: Target },
                  { id: "other", label: "Other", icon: Lightbulb },
                ].map(({ id, label, icon: Icon }) => (
                  <Button
                    key={id}
                    variant={onboardingData.goal === id ? "default" : "outline"}
                    className="justify-start h-auto p-4"
                    onClick={() =>
                      setOnboardingData({ ...onboardingData, goal: id as Goal })
                    }
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePrevious}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleNext} disabled={!onboardingData.goal}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Classes Step */}
        {currentStep === "classes" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold mb-2">
                Add 2–3 classes you're taking this semester.
              </CardTitle>
              <p className="text-muted-foreground">
                Each class gets its own notebook automatically.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-6">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Biology 101, Calculus II, Psychology"
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddClass()}
                    disabled={onboardingData.classes.length >= 5}
                  />
                  <Button
                    onClick={handleAddClass}
                    disabled={
                      !newClass.trim() || onboardingData.classes.length >= 5
                    }
                  >
                    Add
                  </Button>
                </div>
                {onboardingData.classes.length > 0 && (
                  <div className="space-y-2">
                    {onboardingData.classes.map((className, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span>{className}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveClass(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePrevious}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={onboardingData.classes.length < 1}
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Note Style Step */}
        {currentStep === "noteStyle" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold mb-2">
                How do you prefer to take notes?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 mb-8">
                {[
                  {
                    id: "outline",
                    label: "Outline style",
                    description: "Bulleted, structured",
                  },
                  {
                    id: "cornell",
                    label: "Cornell notes",
                    description: "Q&A format",
                  },
                  {
                    id: "freeform",
                    label: "Free-form",
                    description: "Flexible and creative",
                  },
                ].map(({ id, label, description }) => (
                  <Button
                    key={id}
                    variant={
                      onboardingData.noteStyle === id ? "default" : "outline"
                    }
                    className="justify-start h-auto p-4 flex-col items-start"
                    onClick={() =>
                      setOnboardingData({
                        ...onboardingData,
                        noteStyle: id as NoteStyle,
                      })
                    }
                  >
                    <div className="font-semibold">{label}</div>
                    <div className="text-sm opacity-70">{description}</div>
                  </Button>
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePrevious}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!onboardingData.noteStyle}
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* First Note Step */}
        {currentStep === "firstNote" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold mb-2">
                {onboardingData.classes[0]} - Week 1 Notes
              </CardTitle>
              <p className="text-muted-foreground">
                Type one sentence or paste in your notes.
              </p>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <textarea
                  className="w-full h-32 p-4 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Start typing your first note here..."
                  value={onboardingData.firstNote}
                  onChange={(e) =>
                    setOnboardingData({
                      ...onboardingData,
                      firstNote: e.target.value,
                    })
                  }
                />
              </div>
              {onboardingData.firstNote.trim() && (
                <div className="text-center mb-6">
                  <Badge variant="secondary" className="px-4 py-2">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    That's your first note in Scribly! Easy, right?
                  </Badge>
                </div>
              )}
              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePrevious}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleNext}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Demo Step */}
        {currentStep === "aiDemo" && (
          <Card className="max-w-3xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold mb-2">
                Meet your AI Study Assistant
              </CardTitle>
              <p className="text-muted-foreground">
                Turn any note into instant study material.
              </p>
            </CardHeader>
            <CardContent>
              {/* Video Section */}
              <div className="mb-6">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                    key="ai-demo-video"
                  >
                    <source src="/uploads/AI Demo - Made with Clipchamp.mp4" type="video/mp4" />
                    <source src="/uploads/AI%20Demo%20-%20Made%20with%20Clipchamp.mp4" type="video/mp4" />
                    <p className="text-white p-4">
                      Your browser doesn't support video playback. 
                      <a href="/uploads/AI Demo - Made with Clipchamp.mp4" className="underline">
                        Download the video instead
                      </a>
                    </p>
                  </video>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-6 mb-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Brain className="h-4 w-4 text-primary" />
                    <span>Analyze your notes for key concepts</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Generate comprehensive summaries</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-primary" />
                    <span>Create practice questions and quizzes</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePrevious}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleNext}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Friends Step */}
        {currentStep === "friends" && (
          <Card className="max-w-3xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold mb-2">
                Want to study smarter with friends?
              </CardTitle>
              <p className="text-muted-foreground">
                Shared notes = shared success.
              </p>
            </CardHeader>
            <CardContent>
              {/* Video Section */}
              <div className="mb-6">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                  >
                    <source
                      src="/uploads/Friends%20Demo%20-%20Made%20with%20Clipchamp.mp4"
                      type="video/mp4"
                    />
                    <p className="text-white p-4">
                      Your browser doesn't support video playback.
                      <a
                        href="/uploads/Friends%20Demo%20-%20Made%20with%20Clipchamp.mp4"
                        className="underline"
                      >
                        Download the video instead
                      </a>
                    </p>
                  </video>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-6 mb-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-primary" />
                    <span>Connect with classmates</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Share notes securely</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span>Collaborate on study materials</span>
                  </div>
                </div>
              </div>
              <div className="text-center mb-6">
                <Button variant="outline" className="mb-2">
                  Invite a friend via email
                </Button>
                <p className="text-sm text-muted-foreground">
                  You can always do this later from your dashboard
                </p>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePrevious}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleNext}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tour Step */}
        {currentStep === "tour" && (
          <Card className="max-w-3xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold mb-2">
                Quick Tour of Scribly
              </CardTitle>
              <p className="text-muted-foreground">
                Let's walk through the key features you'll use every day.
              </p>
            </CardHeader>
            <CardContent>
              {/* Video Section */}
              <div className="mb-6">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                  >
                    <source
                      src="/uploads/Tour%20Demo%20Video%20-%20Made%20with%20Clipchamp.mp4"
                      type="video/mp4"
                    />
                    <p className="text-white p-4">
                      Your browser doesn't support video playback.
                      <a
                        href="/uploads/Tour%20Demo%20Video%20-%20Made%20with%20Clipchamp.mp4"
                        className="underline"
                      >
                        Download the video instead
                      </a>
                    </p>
                  </video>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="text-center p-6 rounded-lg bg-muted/50">
                  <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Organized Notebooks</h3>
                  <p className="text-sm text-muted-foreground">
                    Each class gets its own notebook with sections and pages
                  </p>
                </div>
                <div className="text-center p-6 rounded-lg bg-muted/50">
                  <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">AI Assistant</h3>
                  <p className="text-sm text-muted-foreground">
                    Get summaries, practice questions, and study help
                  </p>
                </div>
                <div className="text-center p-6 rounded-lg bg-muted/50">
                  <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Friend Sharing</h3>
                  <p className="text-sm text-muted-foreground">
                    Share notes and collaborate with classmates
                  </p>
                </div>
                <div className="text-center p-6 rounded-lg bg-muted/50">
                  <Target className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Progress Tracking</h3>
                  <p className="text-sm text-muted-foreground">
                    Earn XP and track your study streaks
                  </p>
                </div>
              </div>

              <div className="bg-primary/10 rounded-lg p-6 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Pro Tip</h4>
                </div>
                <p className="text-sm">
                  Start by creating a note in your first class, then ask the AI
                  assistant to generate a summary or practice questions. You'll
                  see how powerful this combination can be!
                </p>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePrevious}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleNext}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feedback Demo Step */}
        {currentStep === "feedbackDemo" && (
          <Card className="max-w-3xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold mb-2">
                Help us improve Scribly
              </CardTitle>
              <p className="text-muted-foreground">
                Your feedback shapes the future of the platform.
              </p>
            </CardHeader>
            <CardContent>
              {/* Video Section */}
              <div className="mb-6">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                  >
                    <source
                      src="/uploads/Feedback%20Demo%20-%20Made%20with%20Clipchamp.mp4"
                      type="video/mp4"
                    />
                    <p className="text-white p-4">
                      Your browser doesn't support video playback.
                      <a
                        href="/uploads/Feedback%20Demo%20-%20Made%20with%20Clipchamp.mp4"
                        className="underline"
                      >
                        Download the video instead
                      </a>
                    </p>
                  </video>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-6 mb-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span>Share feature requests and ideas</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-primary" />
                    <span>Vote on community suggestions</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>Help prioritize new features</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePrevious}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleNext}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Step */}
        {currentStep === "complete" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">
                You're ready to ace this semester with Scribly.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>Added {onboardingData.classes.length} classes</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>Created first note</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>Experienced the AI assistant</span>
                </div>
              </div>
              <div className="text-center mb-8">
                <h3 className="text-xl font-semibold mb-2">
                  Unlock Full Access
                </h3>
                <p className="text-muted-foreground">
                  Get unlimited notes, AI study assistant, and friend sharing —
                  everything you need to succeed.
                </p>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePrevious}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleCompleteOnboarding}
                  disabled={isSubmitting}
                  size="lg"
                  className="px-8"
                >
                  {isSubmitting ? "Setting up..." : "Start Learning"}
                  {!isSubmitting && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}