// components/marketing/fonts.ts
// Shared across every public marketing page (/, /pricing, /about, /terms,
// /docs, /privacy) so they all read as one site instead of the dashboard's
// shadcn theme. next/font/google must be called at module scope — doing it
// once here and exporting the results is the supported way to share it
// across multiple page files without re-declaring the same three fonts in
// each one.
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";

export const display = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const body = Inter_Tight({ subsets: ["latin"], variable: "--font-body" });

export const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const marketingFontVariables = `${display.variable} ${body.variable} ${mono.variable}`;
