import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getConversionPaths } from "@/lib/actions/supabase.actions";
import PlanGate from "@/components/PlanGate";
import { ConversionRateChart } from "@/components/charts/conversionRate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ConversionsPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);
  const paths = await getConversionPaths(site.id);

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="mb-6 text-lg font-semibold text-foreground">Conversion Paths</h1>

        <div className="mb-6">
          <ConversionRateChart siteId={site.id} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top paths to conversion</CardTitle>
            <CardDescription>The most common page sequences visitors follow before submitting a form.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {paths.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No conversions yet.</div>}
            {paths.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="text-sm text-foreground">{p.path}</span>
                <Badge variant="outline">{p.conversions} conversion{p.conversions !== 1 ? "s" : ""}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      
    </div>
  );
}
