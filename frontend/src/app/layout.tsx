import type { Metadata, Viewport } from "next";
import "./globals.css";
import CursorProvider from "@/components/ui/CursorProvider";
import ClickSound from "@/components/ui/ClickSound";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090f",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Threshold — SRM Companion",
  description: "Your SRM companion. Attendance, marks, and CGPA — interpreted, not just displayed.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}><CursorProvider><ClickSound />{children}</CursorProvider></body>
    </html>
  );
}
