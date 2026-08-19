import type { Metadata, Viewport } from "next";
import "./globals.css";
import CursorProvider from "@/components/ui/CursorProvider";
import PwaBootstrap from "@/components/ui/PwaBootstrap";

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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Threshold",
  },
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
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/logo_round.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}><PwaBootstrap /><CursorProvider>{children}</CursorProvider></body>
    </html>
  );
}
