import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// Geist via the `geist` package, not next/font/google: the font files ship
// inside the package (next/font/local under the hood) so this renders
// identically on venue wifi that can't reach Google Fonts — no network
// request either way. See PROJECT_GUIDE.md.
//
// `||`, not `??`: an env var left blank in Vercel's dashboard is stored as
// an empty string, not left unset, so `??` never catches it — `new URL("")`
// then throws and takes the whole build down with it (confirmed on the
// first real Vercel deploy, Aug 22). `||` falls back on any falsy value,
// including "".
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Dayflow — Every workday, perfectly aligned",
    template: "%s · Dayflow",
  },
  description:
    "Dayflow is a human resource management system for attendance, leave and payroll — one connected record instead of three spreadsheets.",
  applicationName: "Dayflow",
  manifest: "/site.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Dayflow — Every workday, perfectly aligned",
    description: "Attendance, leave and payroll in one connected record.",
    siteName: "Dayflow",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#010102",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
