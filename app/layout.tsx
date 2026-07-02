import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASC Screenshot Maker",
  description:
    "Create App Store Connect-ready screenshots in your browser with clean iPhone mockups and exact export sizes.",
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
