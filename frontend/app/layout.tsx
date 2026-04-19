import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manex Quality Co-Pilot",
};

export default function RootLayout({ children }: { children: import("react").ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
