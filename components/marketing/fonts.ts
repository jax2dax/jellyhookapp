// components/marketing/fonts.ts
// Shared across every public marketing page (/, /pricing, /about, /terms,
// /docs, /privacy) so they all read as one site instead of the dashboard's
// shadcn theme. next/font/google must be called at module scope — doing it
// once here and exporting the results is the supported way to share it
// across multiple page files without re-declaring the same three fonts in
// each one.
import { Albert_Sans, Instrument_Serif, Inter_Tight, JetBrains_Mono, Young_Serif } from "next/font/google";

// The magazine look (2026-10-28): Young Serif for headings, Albert Sans for text. The three faces below stay for the
// home page's dark interactive demo.
export const v2Serif = Young_Serif({ weight: "400", subsets: ["latin"], variable: "--font-v2-serif" });
export const v2Sans = Albert_Sans({ weight: ["400", "600", "700", "800"], subsets: ["latin"], variable: "--font-v2-sans" });
export const v2FontVariables = `${v2Serif.variable} ${v2Sans.variable}`;

export const display = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const body = Inter_Tight({ subsets: ["latin"], variable: "--font-body" });

export const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const marketingFontVariables = `${display.variable} ${body.variable} ${mono.variable}`;

