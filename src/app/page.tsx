"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  BookOpen,
  Users,
  Sparkles,
  FileText,
  MessageSquare,
  Zap,
  Target,
  Palette,
  Share2,
  CheckCircle,
  ArrowRight,
  Lightbulb,
  Rocket,
  Shield,
  Globe,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!authLoading && user && mounted) {
      router.push("/dashboard");
    }
  }, [user, authLoading, mounted, router]);

  // Auto-rotate features every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Show loading screen while checking authentication or mounting
  if (!mounted || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render landing page if user is authenticated (redirect will happen)
  if (user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const features = [
    {
      icon: <Brain className="h-6 w-6" />,
      title: "AI-Powered Assistant",
      description:
        "Get instant help with note analysis, summaries, and practice questions",
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: <BookOpen className="h-6 w-6" />,
      title: "Smart Organization",
      description:
        "Organize notes with notebooks, sections, and hierarchical pages",
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Collaborative Study",
      description: "Share notes with friends and study together",
      color: "from-purple-500 to-pink-500",
    },
  ];

  const aiFeatures = [
    {
      icon: <MessageSquare className="h-5 w-5" />,
      title: "Smart Chat Assistant",
      description:
        "Ask questions about your notes and get intelligent responses",
    },
    {
      icon: <FileText className="h-5 w-5" />,
      title: "Auto Summaries",
      description: "Generate comprehensive summaries of your study materials",
    },
    {
      icon: <Target className="h-5 w-5" />,
      title: "Practice Questions",
      description:
        "Create custom quizzes and practice problems from your notes",
    },
    {
      icon: <Lightbulb className="h-5 w-5" />,
      title: "Content Analysis",
      description: "Get insights and key concepts from your study materials",
    },
  ];

  const editorFeatures = [
    {
      icon: <Palette className="h-5 w-5" />,
      title: "Rich Text Editor",
      description:
        "Format text with colors, fonts, and advanced styling options",
    },
    {
      icon: <FileText className="h-5 w-5" />,
      title: "Tables & Lists",
      description:
        "Create structured content with tables, bullet points, and task lists",
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: "Real-time Sync",
      description: "Auto-save your work and access it from anywhere",
    },
    {
      icon: <Share2 className="h-5 w-5" />,
      title: "Media Support",
      description: "Embed images, links, and multimedia content seamlessly",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center space-y-8">
            {/* Logo/Brand */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="stats-card-icon">
                <Brain className="h-8 w-8" />
              </div>
              <h1 className="text-4xl md:text-6xl font-bold">
                <span className="dashboard-accent-text">Scribly</span>
              </h1>
            </div>

            {/* Main Headline */}
            <div className="space-y-4">
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                The Future of
                <br />
                <span className="dashboard-accent-text">Smart Note-Taking</span>
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Transform your study experience with AI-powered assistance and
                collaborative features. Built for students who want to excel.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <Button
                size="lg"
                onClick={() => router.push("/auth")}
                className="hover-glow text-lg px-8 py-6 rounded-xl"
              >
                <Rocket className="h-5 w-5 mr-2" />
                Start Learning Today
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  document
                    .getElementById("features")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-lg px-8 py-6 rounded-xl sleek-button"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Explore Features
              </Button>
            </div>

            {/* Feature Preview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 max-w-4xl mx-auto">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className={`dashboard-card hover-lift cursor-pointer transition-all duration-500 ${
                    activeFeature === index
                      ? "ring-2 ring-primary/50 shadow-2xl"
                      : ""
                  }`}
                  onClick={() => setActiveFeature(index)}
                >
                  <CardContent className="p-6 text-center">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center text-white mx-auto mb-4 shadow-lg`}
                    >
                      {feature.icon}
                    </div>
                    <h3 className="dashboard-subheading mb-2">
                      {feature.title}
                    </h3>
                    <p className="dashboard-body text-sm">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI Assistant Section */}
      <section
        id="features"
        className="py-20 bg-gradient-to-r from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 text-sm">
              <Brain className="h-4 w-4 mr-2" />
              AI-Powered Learning
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold dashboard-heading mb-4">
              Your Personal Study Assistant
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Harness the power of artificial intelligence to enhance your
              learning experience with smart insights and personalized
              assistance.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              {aiFeatures.map((feature, index) => (
                <Card key={index} className="dashboard-card hover-lift">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="stats-card-icon-alt flex-shrink-0">
                        {feature.icon}
                      </div>
                      <div>
                        <h3 className="dashboard-subheading mb-2">
                          {feature.title}
                        </h3>
                        <p className="dashboard-body">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="dashboard-card p-8 bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
              <div className="text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white mx-auto shadow-2xl">
                  <Brain className="h-12 w-12" />
                </div>
                <h3 className="text-2xl font-bold dashboard-heading">
                  AI Chat Interface
                </h3>
                <p className="dashboard-body text-lg">
                  Ask questions, get summaries, and generate practice problems -
                  all through natural conversation with your AI study companion.
                </p>
                <div className="bg-background/80 backdrop-blur-sm rounded-xl p-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-muted-foreground">
                      AI Assistant
                    </span>
                  </div>
                  <p className="text-sm">
                    "I've analyzed your biology notes and created 5 practice
                    questions focusing on cellular respiration. Would you like
                    to try them?"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Organization Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 text-sm">
              <BookOpen className="h-4 w-4 mr-2" />
              Smart Organization
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold dashboard-heading mb-4">
              Organize Like Never Before
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Structure your knowledge with our intuitive hierarchy system. From
              notebooks to sections to pages - everything has its place.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="dashboard-card hover-lift text-center">
              <CardContent className="p-8">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-white mx-auto mb-6 shadow-lg">
                  <BookOpen className="h-8 w-8" />
                </div>
                <h3 className="dashboard-subheading mb-4">Notebooks</h3>
                <p className="dashboard-body mb-4">
                  Create dedicated notebooks for each subject or course. Keep
                  everything organized and easily accessible.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Color coding</span>
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-card hover-lift text-center">
              <CardContent className="p-8">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white mx-auto mb-6 shadow-lg">
                  <FileText className="h-8 w-8" />
                </div>
                <h3 className="dashboard-subheading mb-4">Sections</h3>
                <p className="dashboard-body mb-4">
                  Break down notebooks into logical sections. Perfect for
                  organizing chapters, topics, or time periods.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Easy Organization</span>
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-card hover-lift text-center">
              <CardContent className="p-8">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white mx-auto mb-6 shadow-lg">
                  <Zap className="h-8 w-8" />
                </div>
                <h3 className="dashboard-subheading mb-4">Pages</h3>
                <p className="dashboard-body mb-4">
                  Individual pages for your notes with rich text editing,
                  images, and hierarchical organization.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Auto-save</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Rich Editor Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 text-sm">
              <Palette className="h-4 w-4 mr-2" />
              Rich Text Editor
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold dashboard-heading mb-4">
              Express Ideas Beautifully
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Create stunning notes with our powerful rich text editor. Format
              text, add colors, create tables, and embed media - all with an
              intuitive interface.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {editorFeatures.map((feature, index) => (
              <Card key={index} className="dashboard-card hover-lift">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="stats-card-icon flex-shrink-0">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="dashboard-subheading mb-2">
                        {feature.title}
                      </h3>
                      <p className="dashboard-body">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Collaboration Section */}
      <section className="py-20 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 text-sm">
              <Users className="h-4 w-4 mr-2" />
              Collaboration
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold dashboard-heading mb-4">
              Study Better Together
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Connect with classmates and share notes securely. Build a network
              of study partners and learn together.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Card className="dashboard-card hover-lift">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white flex-shrink-0">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="dashboard-subheading mb-2">
                        Friend System
                      </h3>
                      <p className="dashboard-body">
                        Connect with classmates and build your study network
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="dashboard-card hover-lift">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white flex-shrink-0">
                      <Share2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="dashboard-subheading mb-2">
                        Note Sharing
                      </h3>
                      <p className="dashboard-body">
                        Share your notes with friends and access theirs
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="dashboard-card hover-lift">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-white flex-shrink-0">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="dashboard-subheading mb-2">
                        Privacy Controls
                      </h3>
                      <p className="dashboard-body">
                        Control who can see your notes with granular privacy
                        settings
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="dashboard-card p-8 bg-gradient-to-br from-purple-500/10 to-pink-500/10">
              <div className="text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white mx-auto shadow-2xl">
                  <Users className="h-12 w-12" />
                </div>
                <h3 className="text-2xl font-bold dashboard-heading">
                  Collaborative Learning
                </h3>
                <p className="dashboard-body text-lg">
                  Connect with classmates, share your notes, and learn together.
                  Collaboration makes learning more effective and enjoyable.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Secure sharing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center text-white mx-auto shadow-2xl">
              <Rocket className="h-10 w-10" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold dashboard-heading">
              Ready to Transform Your Learning?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join thousands of students who are already using Scribly to ace
              their studies. Start your journey to smarter, more effective
              learning today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                onClick={() => router.push("/auth")}
                className="hover-glow text-lg px-8 py-6 rounded-xl"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Get Started
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card/50 backdrop-blur-sm border-t border-border/20 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center text-white">
                  <Brain className="h-5 w-5" />
                </div>
                <span className="text-xl font-bold dashboard-accent-text">
                  Scribly
                </span>
              </div>
              <p className="dashboard-body">
                The future of smart note-taking and collaborative learning.
              </p>
            </div>

            <div>
              <h4 className="dashboard-subheading mb-4">Features</h4>
              <ul className="space-y-2 dashboard-body">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    AI Assistant
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Smart Organization
                  </a>
                </li>

                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Collaboration
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="dashboard-subheading mb-4">Resources</h4>
              <ul className="space-y-2 dashboard-body">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Study Tips
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Community
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Blog
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="dashboard-subheading mb-4">Company</h4>
              <ul className="space-y-2 dashboard-body">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/20 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="dashboard-body">
              © 2024 Scribly. All rights reserved.
            </p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <Badge variant="outline" className="gap-1">
                <Globe className="h-3 w-3" />
                <span>Global</span>
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Shield className="h-3 w-3" />
                <span>Secure</span>
              </Badge>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
