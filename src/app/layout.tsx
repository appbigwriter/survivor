import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-sans-app", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Survivor",
  description: "Acompanhamento de alimentação, caminhada e treino.",
  appleWebApp: { capable: true, title: "Survivor", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1f6f4a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
