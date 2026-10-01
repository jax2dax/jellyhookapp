// components/feedback/BugReportDialog.tsx
// Opened from nav-user.tsx's "Report a bug" menu item. Just a description
// box per the user's call — page path and browser info are attached
// automatically so the reporter never has to type either.
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { submitBugReport } from "@/lib/actions/feedback.actions";

export function BugReportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  function reset() {
    setDescription("");
    setSubmitted(false);
  }

  async function handleSubmit() {
    if (!description.trim()) return;
    setSubmitting(true);
    const result = await submitBugReport({
      description,
      pagePath: pathname,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
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
          <div className="py-6 text-center text-sm text-foreground">Thanks, we&apos;ll look into it.</div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Report a bug</DialogTitle>
              <DialogDescription>Describe what happened. The page and browser info are attached automatically.</DialogDescription>
            </DialogHeader>

            <Textarea placeholder="What went wrong?" rows={5} autoFocus value={description} onChange={(e) => setDescription(e.target.value)} />

            <DialogFooter>
              <Button disabled={!description.trim() || submitting} onClick={handleSubmit}>
                {submitting ? "Sending..." : "Send report"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
