"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, Zap, Loader2 } from "lucide-react";

interface PriceData {
  monthly: {
    amount: number;
    priceId: string;
  };
  yearly: {
    amount: number;
    priceId: string;
  };
}

export default function PricingSection() {
  const router = useRouter();
  const [isYearly, setIsYearly] = useState(false);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch pricing from Stripe
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const response = await fetch("/api/stripe/get-prices");
        if (response.ok) {
          const data = await response.json();
          setPriceData(data);
        } else {
          // Fallback to hardcoded prices if API fails
          setPriceData({
            monthly: { amount: 7.99, priceId: "" },
            yearly: { amount: 59.99, priceId: "" },
          });
        }
      } catch (error) {
        console.error("Error fetching prices:", error);
        // Fallback to hardcoded prices
        setPriceData({
          monthly: { amount: 7.99, priceId: "" },
          yearly: { amount: 59.99, priceId: "" },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPricing();
  }, []);

  if (loading) {
    return (
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        </div>
      </section>
    );
  }

  if (!priceData) {
    return null;
  }

  const monthlyPrice = priceData.monthly.amount;
  const yearlyPrice = priceData.yearly.amount;
  const yearlyMonthlyEquivalent = (yearlyPrice / 12).toFixed(2);
  const yearlySavings = (monthlyPrice * 12 - yearlyPrice).toFixed(2);
  const savingsPercentage = Math.round(
    ((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100,
  );

  const features = [
    "Unlimited notes and notebooks",
    "AI-powered chat assistant",
    "Auto-generate summaries & flashcards",
    "Practice question generation",
    "Friend note sharing & collaboration",
    "Export notes to PDF",
    "Priority support",
    "All future features included",
  ];

  return (
    <section className="py-20 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
            Unlock the full power of AI-assisted learning. Choose the plan that
            works best for you.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span
              className={`text-sm font-medium ${
                !isYearly ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Monthly
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-primary"
            />
            <span
              className={`text-sm font-medium ${
                isYearly ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Yearly
            </span>
            {isYearly && (
              <Badge
                variant="secondary"
                className="ml-2 bg-primary/10 text-primary border-primary/20"
              >
                Save {savingsPercentage}%
              </Badge>
            )}
          </div>
        </div>

        {/* Pricing Card */}
        <div className="max-w-2xl mx-auto">
          <Card className="relative overflow-hidden border-primary shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-xs font-semibold rounded-bl-lg">
              BEST VALUE
            </div>

            <CardHeader className="text-center pb-8 pt-8">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold mb-2">
                Scribly Pro
              </CardTitle>
              <p className="text-muted-foreground text-sm mb-6">
                Everything you need to excel in your classes
              </p>

              <div className="mb-2">
                <span className="text-4xl font-bold text-foreground">
                  ${isYearly ? yearlyPrice.toFixed(2) : monthlyPrice.toFixed(2)}
                </span>
                <span className="text-muted-foreground text-sm ml-2">
                  /{isYearly ? "year" : "month"}
                </span>
              </div>

              {isYearly && (
                <div className="space-y-1">
                  <p className="text-sm text-primary font-medium">
                    Save ${yearlySavings} per year ({savingsPercentage}% off)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    That's just ${yearlyMonthlyEquivalent}/month
                  </p>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Features List */}
              <ul className="space-y-3">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground leading-relaxed">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
            </CardContent>
          </Card>
        </div>

        {/* Additional Info */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground text-sm">
            All plans include secure cloud storage and regular updates.
            Questions?{" "}
            <a href="#" className="text-primary hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
