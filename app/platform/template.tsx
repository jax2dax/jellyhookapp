// app/platform/template.tsx
// Wraps every platform page and is created anew on each navigation (unlike the layout), so each page fades in once
// when it arrives. Opacity only: a transform here would become the containing block of the pages' fixed dialogs.
export default function PlatformTemplate({ children }: { children: React.ReactNode }) {
  return <div className="jh-page-in flex min-w-0 flex-1 flex-col">{children}</div>;
}
