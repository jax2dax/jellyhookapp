import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"
import Script from 'next/script'
import { SITE_URL, SITE_NAME } from "@/lib/seo"
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Add one script to your site. For every form lead, see the pages they read, how long they stayed, how far they scrolled and how long they spent on each form field. Free during early access.";

// Root defaults. Every marketing page under app/ sets its own title and
// description, which override these via Next's metadata merging; the title
// template means a page only needs to set title: "Pricing" and it renders as
// "Pricing | Jellyhook" everywhere it's used (tab title, search results,
// social share cards).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: See what each lead did before they contacted you`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/jellyhookMark.png",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME}: See what each lead did before they contacted you`,
    description: DESCRIPTION,
    images: [{ url: "/mainLogo.png", width: 1024, height: 1024, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME}: See what each lead did before they contacted you`,
    description: DESCRIPTION,
    images: ["/mainLogo.png"],
  },
  verification: {
    google: "fijlxhgxBZmHouzyiGo4NwfsBWsrWr_c9QcOHGeftoo",
  },
};

// Root layout. Every marketing page under app/ is wrapped in this, which

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
       <head>
        <Script
            src="https://www.googletagmanager.com/gtag/js?id=G-055K1J7VB9"
            strategy="beforeInteractive"
          />
          <Script id="google-tag" strategy="beforeInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-055K1J7VB9');
            `}
          </Script>
        </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Organization structured data — only facts that are true and
            checkable from the site itself (name, url, logo, description).
            No review/rating fields: nothing on this site collects those, so
            adding them would be exactly the kind of fabricated markup
            Google's structured-data guidelines penalize. */}
        <Script id="ld-organization" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Jellyhook",
            url: SITE_URL,
            logo: `${SITE_URL}/mainLogo.png`,
            description:
              "Jellyhook shows what each form lead did on a website before they contacted the owner: pages read, time, scroll depth, conversion paths and time spent on each form field.",
          })}
        </Script>

      {/* <AppSidebar userPlan={userPlan} siteDomain={site.domain} /> */}

        {/* ... */}
      <Analytics/>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
           
          
          <ClerkProvider appearance={{variables:{colorPrimary:'#00C744'}}}>  {/**limecolor */}



{children}

          </ClerkProvider>
        </ThemeProvider>
        {/**got jz92@gmail, Localhost:3k */}
        {/* <Script src="https://jellyhook.com/tracker.js" data-key="3dd16744-dfe1-42b2-864e-bf3eb946ea78" strategy="afterInteractive" /> */}
        {/* jellyhook.com's own tracker now loads from components/marketing/MarketingPage.tsx, so it only runs on the public pages, not inside /platform */}
      </body>
    </html>
  );
}
