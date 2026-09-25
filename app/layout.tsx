import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"
import Script from 'next/script'
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jellyhook",
  description: "Lead Intelligence Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
       
  
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
        
      </body>
    </html>
  );
}
