// components/feedback/SupportDialog.tsx
// The sidebar's Support button: the same dialog as feedback, without the
// star rating. A message to the team, sent with the page it was written
// on; we reply to the account's email. See submitSupportRequest.
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { submitSupportRequest } from "@/lib/actions/feedback.actions";

export function SupportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setMessage("");
    setSubmitted(false);
    setError(null);
  }

  async function handleSubmit() {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitSupportRequest({ message, pagePath: pathname });
      if (result.success) {
        setSubmitted(true);
        window.setTimeout(() => {
          onOpenChange(false);
          reset();
        }, 1600);
      } else {
        setError(result.error ?? "Couldn't send your message.");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
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
          <div className="py-6 text-center text-sm text-foreground">Message sent. We&apos;ll reply to your account email.</div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Contact support</DialogTitle>
              <DialogDescription>Tell us what&apos;s wrong or what you need. We&apos;ll reply to your account email.</DialogDescription>
            </DialogHeader>
            <Textarea placeholder="What can we help with?" value={message} maxLength={5000} rows={5} onChange={(e) => setMessage(e.target.value)} />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <DialogFooter>
              <Button disabled={!message.trim() || submitting} onClick={handleSubmit}>
                {submitting ? "Sending..." : "Send message"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
