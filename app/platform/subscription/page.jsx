import { DashboardPricingCards } from "@/components/billing/DashboardPricingCards";

export default function SubscriptionPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="mb-6 text-xl font-semibold tracking-tight text-foreground">Upgrade your plan</h1>

      <DashboardPricingCards />

    </div>
  );
}
