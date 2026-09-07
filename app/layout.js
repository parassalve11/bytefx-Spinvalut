import { Inter, Space_Grotesk } from "next/font/google";

import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  icons: { icon: { url: "/icon.webp", type: "image/webp" } },
  title: "SpinVault — Giveaway Winner Picker",
  description: "One Draw · One Winner · Provably Fair.",
};

export const viewport = {
  themeColor: "#07090F",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen font-body antialiased">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
