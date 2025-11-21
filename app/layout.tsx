import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rose–Bud–Thorn",
  description: "A weekly ritual tool for small private circles",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

