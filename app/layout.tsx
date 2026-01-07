import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavigationBar } from "@/components/navigation-bar";

export const metadata: Metadata = {
  title: "Rose–Bud–Thorn",
  description: "A weekly ritual tool for small private circles",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <NavigationBar>{children}</NavigationBar>
      </body>
    </html>
  );
}

