import { getUserSites, getAnalytics } from "@/lib/actions/supabase.actions";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { data: sites } = await getUserSites();
  const site = sites?.[0];

  if (!site) return <div>No site found</div>;

  const data = await getAnalytics(site.id);

  const totalVisits = data.length;

  const avgTime =
    data.reduce((acc, p) => acc + (p.time_on_page || 0), 0) /
    (data.length || 1);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="p-4 border rounded">
          <p>Total Visits</p>
          <h2>{totalVisits}</h2>
        </div>

        <div className="p-4 border rounded">
          <p>Avg Time</p>
          <h2>{Math.round(avgTime / 1000)}s</h2>
        </div>
      </div>

      <div className="mt-8">
        {data.map((page) => (
          <div key={page.id} className="border p-3 mb-2">
            <p>{page.page_path}</p>
            <p>{page.time_on_page || 0} ms</p>
          </div>
        ))}
      </div>
    </div>
  );
}