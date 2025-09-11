import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️ STRIPE_SECRET_KEY is not set in environment variables");
}

// Initialize Stripe with the secret key (or empty string if not available)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
  typescript: true,
});

// Export getStripe function for backward compatibility
export const getStripe = () => stripe;