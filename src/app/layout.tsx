import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// Deliberately system fonts, not next/font/google: this app should render
// identically on venue wifi that can't reach Google Fonts. See PROJECT_GUIDE.md.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
  themeColor: "#2F6D51",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
