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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
          <div className="text-center">
            {/* Logo/Brand */}
            <div className="flex items-center justify-center gap-3 mb-12">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Brain className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">Scribly</h1>
            </div>

            {/* Main Headline */}
            <div className="max-w-4xl mx-auto mb-8">
              <h2 className="text-4xl md:text-6xl font-bold text-foreground leading-tight mb-6">
                The Future of Smart Note-Taking
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Transform your study experience with AI-powered assistance and
                collaborative features. Built for students who want to excel.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button
                size="lg"
                onClick={() => router.push("/auth")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
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
                className="border-2 border-border text-foreground hover:border-primary hover:text-primary px-8 py-4 text-lg font-semibold rounded-lg transition-all"
              >
                Explore Features
              </Button>
            </div>

            {/* Feature Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="text-center p-6 rounded-xl bg-card hover:bg-accent/50 transition-colors cursor-pointer border border-border/20"
                  onClick={() => setActiveFeature(index)}
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <div className="text-primary">{feature.icon}</div>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI Assistant Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Your Personal Study Assistant
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Harness the power of artificial intelligence to enhance your
              learning experience with smart insights and personalized
              assistance.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              {aiFeatures.map((feature, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <div className="text-primary">{feature.icon}</div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
              <div className="text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mx-auto">
                  <Brain className="h-10 w-10 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">
                  AI Chat Interface
                </h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Ask questions, get summaries, and generate practice problems -
                  all through natural conversation with your AI study companion.
                </p>
                <div className="bg-muted/50 rounded-xl p-4 text-left border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-chart-2"></div>
                    <span className="text-xs text-muted-foreground font-medium">
                      AI Assistant
                    </span>
                  </div>
                  <p className="text-sm text-foreground">
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
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Organize Like Never Before
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Structure your knowledge with our intuitive hierarchy system. From
              notebooks to sections to pages - everything has its place.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-card hover:bg-accent/50 transition-colors border border-border/20">
              <div className="w-16 h-16 rounded-xl bg-chart-2/20 flex items-center justify-center mx-auto mb-6">
                <BookOpen className="h-8 w-8 text-chart-2" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Notebooks
              </h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Create dedicated notebooks for each subject or course. Keep
                everything organized and easily accessible.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-chart-2" />
                <span>Color coding</span>
              </div>
            </div>

            <div className="text-center p-8 rounded-2xl bg-card hover:bg-accent/50 transition-colors border border-border/20">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Sections
              </h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Break down notebooks into logical sections. Perfect for
                organizing chapters, topics, or time periods.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-chart-2" />
                <span>Easy Organization</span>
              </div>
            </div>

            <div className="text-center p-8 rounded-2xl bg-card hover:bg-accent/50 transition-colors border border-border/20">
              <div className="w-16 h-16 rounded-xl bg-chart-4/20 flex items-center justify-center mx-auto mb-6">
                <Zap className="h-8 w-8 text-chart-4" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Pages
              </h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Individual pages for your notes with rich text editing, images,
                and hierarchical organization.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-chart-2" />
                <span>Auto-save</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rich Editor Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Express Ideas Beautifully
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Create stunning notes with our powerful rich text editor. Format
              text, add colors, create tables, and embed media - all with an
              intuitive interface.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {editorFeatures.map((feature, index) => (
              <div
                key={index}
                className="bg-card rounded-2xl p-6 shadow-sm border border-border hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <div className="text-muted-foreground">{feature.icon}</div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Collaboration Section */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Study Better Together
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Connect with classmates and share notes securely. Build a network
              of study partners and learn together.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-chart-4/20 flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6 text-chart-4" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Friend System
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Connect with classmates and build your study network
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Share2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Note Sharing
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Share your notes with friends and access theirs
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-chart-2/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-6 w-6 text-chart-2" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Privacy Controls
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Control who can see your notes with granular privacy
                    settings
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-8 border border-border">
              <div className="text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-chart-4 flex items-center justify-center mx-auto">
                  <Users className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">
                  Collaborative Learning
                </h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Connect with classmates, share your notes, and learn together.
                  Collaboration makes learning more effective and enjoyable.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-chart-2" />
                  <span>Secure sharing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground">
              Ready to Transform Your Learning?
            </h2>
            <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto leading-relaxed">
              Join students who are already using Scribly to ace their studies.
              Start your journey to smarter, more effective learning today.
            </p>
            <div className="pt-4">
              <Button
                size="lg"
                onClick={() => router.push("/auth")}
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 px-8 py-4 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
                Get Started
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30 border-t border-border py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Brain className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">
                  Scribly
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                The future of smart note-taking and collaborative learning.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-foreground mb-4">
                Features
              </h4>
              <ul className="space-y-3 text-muted-foreground">
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
              <h4 className="text-lg font-semibold text-foreground mb-4">
                Resources
              </h4>
              <ul className="space-y-3 text-muted-foreground">
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
              <h4 className="text-lg font-semibold text-foreground mb-4">
                Company
              </h4>
              <ul className="space-y-3 text-muted-foreground">
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

          <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-foreground">
              © 2024 Scribly. All rights reserved.
            </p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <div className="flex items-center gap-1 text-sm text-muted-foreground border border-border rounded-full px-3 py-1">
                <Globe className="h-3 w-3" />
                <span>Global</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground border border-border rounded-full px-3 py-1">
                <Shield className="h-3 w-3" />
                <span>Secure</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
