// lib/actions/feedback.actions.js
// Two independent surfaces write here: the sidebar's Feedback half (manual)
// and FeedbackAutoPrompt (auto, triggered by the returning-user heuristic in
// that component). `source` just records which one it was, for later
// analysis of whether the auto-prompt actually gets better response than
// the manual button.
"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * @param {{ rating: number, comment?: string, pagePath?: string, source?: "manual" | "auto" }} params
 */
export async function submitFeedback({ rating, comment, pagePath, source } = {}) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not signed in" };
  if (!rating || rating < 1 || rating > 5) return { success: false, error: "Rating is required" };

  const { error } = await supabaseAdmin.from("feedback").insert({
    user_id: userId,
    rating,
    comment: comment?.trim() || null,
    page_path: pagePath || null,
    source: source === "auto" ? "auto" : "manual",
  });

  if (error) {
    console.error("[feedback] submitFeedback error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * @param {{ description: string, pagePath?: string, userAgent?: string }} params
 */
export async function submitBugReport({ description, pagePath, userAgent } = {}) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not signed in" };
  const trimmed = description?.trim();
  if (!trimmed) return { success: false, error: "Description is required" };

  const { error } = await supabaseAdmin.from("bug_reports").insert({
    user_id: userId,
    description: trimmed,
    page_path: pagePath || null,
    user_agent: userAgent || null,
  });

  if (error) {
    console.error("[feedback] submitBugReport error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * The sidebar's Support button: a free-text message to the team, no rating.
 * Stored in its own table (support_requests, SQL in mds/database.md) rather
 * than in `feedback`, whose rating is the whole point of that table.
 * We reply to the account's email (looked up from user_id).
 * @param {{ message: string, pagePath?: string }} params
 */
export async function submitSupportRequest({ message, pagePath } = {}) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not signed in" };
  const trimmed = message?.trim();
  if (!trimmed) return { success: false, error: "Please write a message" };
  if (trimmed.length > 5000) return { success: false, error: "Please keep the message under 5,000 characters" };

  const { error } = await supabaseAdmin.from("support_requests").insert({
    user_id: userId,
    message: trimmed,
    page_path: pagePath || null,
  });

  if (error) {
    console.error("[feedback] submitSupportRequest error:", error.message);
    return { success: false, error: "Couldn't send your message. Please try again in a moment." };
  }
  return { success: true };
}
