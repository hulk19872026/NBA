import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "CourtEdge | NBA Analytics Platform",
  description: "AI-powered NBA win probability, betting edge detection, and sportsbook analytics",
  keywords: ["NBA", "analytics", "betting", "win probability", "edge", "sportsbook"],
  themeColor: "#040610",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
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
