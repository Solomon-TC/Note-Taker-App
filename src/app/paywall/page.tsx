"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Check, Zap, Crown, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase-client";

const MONTHLY_PRICE = "$7.99";
const YEARLY_PRICE = "$59.99";
const YEARLY_MONTHLY_EQUIVALENT = "$4.99";
const YEARLY_SAVINGS = "$35";

const features = [
  "Unlimited notes",
  "AI study assistant",
  "Friend note sharing",
];

export default function PaywallPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const supabase = createClient();

  // Handle checkout success/cancelled states
  useEffect(() => {
    const checkout = searchParams.get("checkout");

    if (checkout === "success") {
      toast({
        title: "Welcome to Scribly Pro! 🎉",
        description:
          "Your subscription is now active. Enjoy unlimited access to all features!",
        duration: 5000,
      });
      // Remove the query parameter and redirect to dashboard after a delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } else if (checkout === "cancelled") {
      toast({
        title: "Checkout Cancelled",
        description: "No worries! You can upgrade to Pro anytime.",
        variant: "destructive",
        duration: 5000,
      });
      // Remove the query parameter
      router.replace("/paywall");
    }
  }, [searchParams, toast, router]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  const handleUpgrade = async (plan: "monthly" | "yearly") => {
    if (!user) {
      router.push("/auth");
      return;
    }

    setLoadingPlan(plan);

    try {
      // Get the user's session token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to start checkout process. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Crown className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Scribly Pro</h1>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Unlock your full study potential
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-4">
            Get unlimited access to AI-powered study tools, seamless note
            organization, and friend collaboration. Everything you need to excel
            in your classes.
          </p>
          <p className="text-lg text-primary font-semibold">
            Cheaper than a night of takeout. Priceless for better grades.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {/* Monthly Plan */}
          <Card className="relative border-2 border-border hover:border-primary/50 transition-colors">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Monthly</CardTitle>
              <CardDescription className="text-lg">
                Perfect for getting started
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">
                  {MONTHLY_PRICE}
                </span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-8">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleUpgrade("monthly")}
                disabled={loadingPlan !== null}
                className="w-full h-12 text-lg font-semibold"
                size="lg"
              >
                {loadingPlan === "monthly" ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Upgrade to Monthly"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Yearly Plan */}
          <Card className="relative border-2 border-primary shadow-lg">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground px-4 py-1 text-sm font-semibold">
                <Sparkles className="h-4 w-4 mr-1" />
                Save {YEARLY_SAVINGS} (25% off)
              </Badge>
            </div>
            <CardHeader className="text-center pb-6 pt-8">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-4">
                <Crown className="h-8 w-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold">Yearly</CardTitle>
              <CardDescription className="text-lg">
                Save 25% with annual billing
              </CardDescription>
              <div className="mt-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-4xl font-bold text-foreground">
                    {YEARLY_PRICE}
                  </span>
                  <span className="text-muted-foreground">/year</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  ({YEARLY_MONTHLY_EQUIVALENT}/month)
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-8">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleUpgrade("yearly")}
                disabled={loadingPlan !== null}
                className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90"
                size="lg"
              >
                {loadingPlan === "yearly" ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Upgrade to Yearly"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Value Proposition */}
        <div className="text-center mb-16">
          <div className="bg-muted/30 rounded-2xl p-8 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Stop wasting hours on inefficient studying
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div>
                <h4 className="font-semibold text-lg mb-3 text-destructive">
                  Without Scribly Pro:
                </h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Spend 3+ hours rewriting messy notes</li>
                  <li>• Struggle to create effective study materials</li>
                  <li>• Miss out on collaborative learning</li>
                  <li>• Pay $15/month for Quizlet + Notion separately</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-lg mb-3 text-primary">
                  With Scribly Pro:
                </h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• AI generates summaries in seconds</li>
                  <li>• Instant practice questions from your notes</li>
                  <li>• Share and collaborate seamlessly with friends</li>
                  <li>• All-in-one solution for just $7.99/month</li>
                </ul>
              </div>
            </div>
            <div className="mt-8 p-4 bg-primary/10 rounded-lg">
              <p className="text-lg font-semibold text-primary mb-2">
                Academic ROI: Save 10+ hours per week
              </p>
              <p className="text-muted-foreground">
                Time saved = better grades = higher GPA = better career
                opportunities
              </p>
            </div>
          </div>
        </div>

        {/* Features Highlight */}
        <div className="text-center">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Everything you need in one place
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-semibold mb-2">AI Study Assistant</h4>
              <p className="text-sm text-muted-foreground">
                Turn any note into summaries and practice questions instantly.
                <span className="block mt-1 font-medium text-primary">
                  Save 5+ hours per week
                </span>
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-semibold mb-2">Unlimited Notes</h4>
              <p className="text-sm text-muted-foreground">
                Organize all your classes without limits. Rich formatting,
                images, and more.
                <span className="block mt-1 font-medium text-primary">
                  Never lose important information
                </span>
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-semibold mb-2">Friend Note Sharing</h4>
              <p className="text-sm text-muted-foreground">
                Study together, share insights, and learn from classmates.
                <span className="block mt-1 font-medium text-primary">
                  Collaborative learning advantage
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground mb-2">
            Cancel anytime. No hidden fees. 30-day money-back guarantee.
          </p>
          <p className="text-xs text-muted-foreground">
            Join thousands of students already improving their grades with
            Scribly Pro
          </p>
        </div>
      </div>
    </div>
  );
}
