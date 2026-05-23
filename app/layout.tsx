import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YT Downloader — Download YouTube Videos in 1080p+",
  description:
    "Download any YouTube video in 1080p, 4K, or save audio-only as MP3. Fast, free, and private.",
  keywords: ["youtube downloader", "1080p", "4k", "mp3", "video download"],
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
