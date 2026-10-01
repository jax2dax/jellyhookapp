// app/docs/layout.tsx
// Sidebar + content shell for every page under /docs. Applies to the
// index page too, so the whole /docs section reads as one documentation
// site instead of a single standalone marketing page.
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { DocsSidebar } from "./DocsSidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingPage>
      <div className="mx-auto flex max-w-[1200px] gap-10 px-5 py-12 lg:px-10 lg:py-16">
        <DocsSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </MarketingPage>
  );
}
