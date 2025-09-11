import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Stripe from "stripe";

export const runtime = "nodejs";

// Handle GET requests for Stripe webhook verification
export async function GET(request: NextRequest) {
  console.log("Webhook GET request received for verification");
  return NextResponse.json(
    { message: "Webhook endpoint is active" },
    { status: 200 },
  );
}

// Handle HEAD requests for health checks
export async function HEAD(request: NextRequest) {
  console.log("Webhook HEAD request received for health check");
  return new NextResponse(null, { status: 200 });
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
  console.log("Webhook OPTIONS request received for CORS preflight");
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
    },
  });
}

export async function POST(request: NextRequest) {
  console.log("🎯 Webhook POST request received");
  
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error("❌ Missing stripe-signature header");
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ STRIPE_SECRET_KEY is not configured");
    return NextResponse.json(
      { error: "Payment system is not configured" },
      { status: 500 },
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ Missing STRIPE_WEBHOOK_SECRET environment variable");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    console.log("🔐 Verifying webhook signature...");
    
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
    
    console.log("✅ Webhook signature verified successfully");
  } catch (error) {
    console.error("❌ Webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log(`🎯 Processing webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("💳 Processing checkout.session.completed", {
          sessionId: session.id,
          customerId: session.customer,
          subscriptionId: session.subscription,
          mode: session.mode,
          metadata: session.metadata,
        });

        if (
          session.mode === "subscription" &&
          session.customer &&
          session.subscription
        ) {
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          // Get subscription details
          const stripe = getStripe();
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;

          console.log("📋 Subscription details:", {
            subscriptionId,
            priceId,
            status: subscription.status,
            currentPeriodEnd: subscription.current_period_end,
          });

          // Determine plan based on price ID
          let plan = "monthly";
          if (priceId === process.env.STRIPE_PRICE_YEARLY) {
            plan = "yearly";
          } else if (priceId === process.env.STRIPE_PRICE_MONTHLY) {
            plan = "monthly";
          }

          const currentPeriodEnd = new Date(
            subscription.current_period_end * 1000,
          ).toISOString();

          // Update user in Supabase - first try by user ID from metadata
          const userId = session.metadata?.supabase_user_id;
          console.log(`🔍 Attempting to update user:`, {
            customerId,
            userId,
            plan,
            currentPeriodEnd,
          });

          let updateResult: any = null;

          if (userId) {
            console.log(`🎯 Updating user by ID: ${userId}`);
            // Try updating by user ID first (more reliable)
            updateResult = await supabaseAdmin
              .from("users")
              .update({
                stripe_customer_id: customerId,
                is_pro: true,
                plan: plan,
                current_period_end: currentPeriodEnd,
              })
              .eq("id", userId);

            if (!updateResult.error) {
              console.log(`✅ Successfully updated user by ID: ${userId}`);
            } else {
              console.error(`❌ Failed to update user by ID: ${userId}`, updateResult.error);
            }
          } else {
            console.log(`🔍 No user ID in metadata, trying customer ID lookup: ${customerId}`);
            // Fallback to customer ID lookup
            updateResult = await supabaseAdmin
              .from("users")
              .update({
                stripe_customer_id: customerId,
                is_pro: true,
                plan: plan,
                current_period_end: currentPeriodEnd,
              })
              .eq("stripe_customer_id", customerId);

            if (!updateResult.error) {
              console.log(`✅ Successfully updated user by customer ID: ${customerId}`);
            } else {
              console.error(`❌ Failed to update user by customer ID: ${customerId}`, updateResult.error);
            }
          }

          if (updateResult?.error) {
            console.error(
              "❌ Error updating user after checkout completion:",
              updateResult.error,
            );
            return NextResponse.json(
              { error: "Failed to update user profile" },
              { status: 500 },
            );
          }

          console.log(
            `✅ Successfully processed checkout completion for customer: ${customerId}`,
          );
        } else {
          console.log("ℹ️ Skipping non-subscription checkout session");
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price.id;

        console.log("🔄 Processing customer.subscription.updated", {
          subscriptionId: subscription.id,
          customerId,
          status: subscription.status,
          priceId,
        });

        // Determine plan based on price ID
        let plan = "monthly";
        if (priceId === process.env.STRIPE_PRICE_YEARLY) {
          plan = "yearly";
        } else if (priceId === process.env.STRIPE_PRICE_MONTHLY) {
          plan = "monthly";
        }

        const isActive =
          subscription.status === "active" ||
          subscription.status === "trialing";
        const currentPeriodEnd = new Date(
          subscription.current_period_end * 1000,
        ).toISOString();

        // Update user in Supabase
        const { error } = await supabaseAdmin
          .from("users")
          .update({
            is_pro: isActive,
            plan: plan,
            current_period_end: currentPeriodEnd,
          })
          .eq("stripe_customer_id", customerId);

        if (error) {
          console.error("❌ Error updating user subscription:", error);
          return NextResponse.json(
            { error: "Failed to update user subscription" },
            { status: 500 },
          );
        }

        console.log(
          `✅ Successfully updated subscription for customer: ${customerId}`,
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        console.log("🗑️ Processing customer.subscription.deleted", {
          subscriptionId: subscription.id,
          customerId,
        });

        // Update user in Supabase - set to non-pro
        const { error } = await supabaseAdmin
          .from("users")
          .update({
            is_pro: false,
            plan: null,
            current_period_end: null,
          })
          .eq("stripe_customer_id", customerId);

        if (error) {
          console.error(
            "❌ Error updating user after subscription deletion:",
            error,
          );
          return NextResponse.json(
            { error: "Failed to update user after subscription deletion" },
            { status: 500 },
          );
        }

        console.log(
          `✅ Successfully processed subscription deletion for customer: ${customerId}`,
        );
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    console.log("✅ Webhook processing completed successfully");
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("❌ Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}