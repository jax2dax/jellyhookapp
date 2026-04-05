import { PricingTable } from "@clerk/nextjs";

export default function SubscriptionPage() {
  return (
    <div style={{ padding: 24, background: "#0a0a0a", minHeight: "100vh" }}>
      <h1 style={{ color: "#fff", fontFamily: "monospace", fontSize: 18, marginBottom: 24 }}>
        Upgrade Your Plan
      </h1>
      <PricingTable />
    </div>
  );
}