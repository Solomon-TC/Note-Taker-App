import Stripe from "stripe";

// Initialize Stripe only when needed to avoid startup errors
let stripeInstance: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!stripeInstance) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set in environment variables. Please check your environment configuration.",
      );
    }

    stripeInstance = new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20",
      typescript: true,
    });
  }

  return stripeInstance;
};

// For backward compatibility
export const stripe = getStripe();

export default getStripe;
