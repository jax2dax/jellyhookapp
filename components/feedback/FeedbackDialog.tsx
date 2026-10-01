// components/feedback/FeedbackDialog.tsx
// Shared star-rating + optional-comment form, mounted from two independent
// places with two independent open-state instances: the sidebar's Feedback
// half (SupportFeedbackButton, source="manual") and FeedbackAutoPrompt
// (source="auto", triggered by its own returning-user heuristic). Each
// instance owns its own state; there is no shared singleton dialog.
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { submitFeedback } from "@/lib/actions/feedback.actions";

export function FeedbackDialog({
  open,
  onOpenChange,
  source = "manual",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: "manual" | "auto";
}) {
  const pathname = usePathname();
  const [rating, setRating] = React.useState(0);
  const [hovered, setHovered] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  function reset() {
    setRating(0);
    setHovered(0);
    setComment("");
    setSubmitted(false);
  }

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    const result = await submitFeedback({ rating, comment, pagePath: pathname, source });
    setSubmitting(false);
    if (result.success) {
      setSubmitted(true);
      window.setTimeout(() => {
        onOpenChange(false);
        reset();
      }, 1200);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        {submitted ? (
          <div className="py-6 text-center text-sm text-foreground">Thanks for the feedback.</div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>How&apos;s Jellyhook working for you?</DialogTitle>
              <DialogDescription>A quick rating helps us prioritize what to fix next.</DialogDescription>
            </DialogHeader>

            <div className="flex justify-center gap-1 py-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  className="p-1 transition-transform hover:scale-110"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      (hovered || rating) >= n ? "fill-primary text-primary" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>

            <Textarea placeholder="Anything specific? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />

            <DialogFooter>
              <Button disabled={!rating || submitting} onClick={handleSubmit}>
                {submitting ? "Sending..." : "Send feedback"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
