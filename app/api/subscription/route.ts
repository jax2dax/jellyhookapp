import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 1. Get logged-in user
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch subscriptions from Clerk Billing
    const subscriptions = await clerkClient.billing.getSubscriptions({
      userId,
    });

    // 3. Return data
    return NextResponse.json({
      success: true,
      subscriptions,
    });
  } catch (err) {
    console.error("Subscription fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}