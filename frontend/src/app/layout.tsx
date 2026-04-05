import type { Metadata } from "next";
import { Barlow_Condensed, DM_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CourtEdge | NBA Analytics Platform",
  description: "AI-powered NBA win probability, betting edge detection, and sportsbook analytics",
  keywords: ["NBA", "analytics", "betting", "win probability", "edge", "sportsbook"],
  themeColor: "#040610",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${dmSans.variable} ${jetbrainsMono.variable} dark`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="bg-court-950 text-white font-body antialiased min-h-screen overflow-x-hidden">
        {/* Background grid texture */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,229,255,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,229,255,0.02) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
            zIndex: 0,
          }}
        />
        {/* Radial glow top */}
        <div
          className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at top, rgba(0,229,255,0.06) 0%, transparent 70%)",
            zIndex: 0,
          }}
        />

        <div className="relative z-10">
          <Navbar />
          <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#101828",
              color: "#fff",
              border: "1px solid rgba(0,229,255,0.15)",
              fontFamily: "var(--font-body)",
            },
          }}
        />
      </body>
    </html>
  );
}
