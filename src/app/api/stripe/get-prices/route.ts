import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  try {
    // Get the price IDs from environment variables
    const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY;
    const yearlyPriceId = process.env.STRIPE_PRICE_YEARLY;

    if (!monthlyPriceId || !yearlyPriceId) {
      console.error("Missing Stripe price IDs in environment variables");
      return NextResponse.json(
        { error: "Stripe price IDs not configured" },
        { status: 500 }
      );
    }

    // Fetch prices from Stripe
    const [monthlyPrice, yearlyPrice] = await Promise.all([
      stripe.prices.retrieve(monthlyPriceId),
      stripe.prices.retrieve(yearlyPriceId),
    ]);

    // Extract the amounts (Stripe stores amounts in cents)
    const monthlyAmount = monthlyPrice.unit_amount
      ? monthlyPrice.unit_amount / 100
      : 7.99;
    const yearlyAmount = yearlyPrice.unit_amount
      ? yearlyPrice.unit_amount / 100
      : 59.99;

    return NextResponse.json({
      monthly: {
        amount: monthlyAmount,
        priceId: monthlyPriceId,
      },
      yearly: {
        amount: yearlyAmount,
        priceId: yearlyPriceId,
      },
    });
  } catch (error) {
    console.error("Error fetching Stripe prices:", error);
    
    // Return fallback prices if Stripe API fails
    return NextResponse.json({
      monthly: {
        amount: 7.99,
        priceId: process.env.STRIPE_PRICE_MONTHLY || "",
      },
      yearly: {
        amount: 59.99,
        priceId: process.env.STRIPE_PRICE_YEARLY || "",
      },
    });
  }
}
