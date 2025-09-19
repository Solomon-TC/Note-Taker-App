import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    // Verify required environment variables
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("STRIPE_SECRET_KEY is not configured");
      return NextResponse.json(
        { error: "Payment system is not configured" },
        { status: 500 },
      );
    }

    // Check if Supabase admin client is available
    let supabaseAdmin;
    try {
      supabaseAdmin = getAdminClient();
    } catch (error) {
      console.error("Supabase admin client not available:", error);
      return NextResponse.json(
        { error: "Authentication system is not configured" },
        { status: 500 },
      );
    }

    // Get the authenticated user from Supabase
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing authorization header" },
        { status: 401 },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 },
      );
    }

    // Get user data from the users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("stripe_customer_id, is_pro, plan, current_period_end")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error("Error fetching user data:", userError);
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 500 },
      );
    }

    const customerId = userData?.stripe_customer_id;

    if (!customerId || !userData?.is_pro) {
      return NextResponse.json({
        hasSubscription: false,
        subscription: null,
        invoices: [],
      });
    }

    // Get active subscriptions for the customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({
        hasSubscription: false,
        subscription: null,
        invoices: [],
      });
    }

    const subscription = subscriptions.data[0];
    const price = subscription.items.data[0]?.price;

    // Get recent invoices
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 5,
    });

    // Format subscription data
    const subscriptionData = {
      id: subscription.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      plan: {
        id: price?.id,
        amount: price?.unit_amount ? price.unit_amount / 100 : 0,
        currency: price?.currency || "usd",
        interval: price?.recurring?.interval || "month",
        interval_count: price?.recurring?.interval_count || 1,
      },
    };

    // Format invoice data
    const invoiceData = invoices.data.map((invoice) => ({
      id: invoice.id,
      amount_paid: invoice.amount_paid / 100,
      currency: invoice.currency,
      status: invoice.status,
      created: new Date(invoice.created * 1000),
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
    }));

    return NextResponse.json({
      hasSubscription: true,
      subscription: subscriptionData,
      invoices: invoiceData,
    });
  } catch (error) {
    console.error("Error fetching subscription info:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}