import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/context/WalletProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UmbraMix - Privacy Mixer",
  description: "Break on-chain linkability with multi-layer privacy routing on Starknet through Lightning Network and Cashu ecash",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#030712] text-gray-100 min-h-screen overflow-x-hidden`}>
        {/* Ambient background glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-violet-600/[0.07] rounded-full blur-[120px]" style={{ animation: 'orbFloat1 20s ease-in-out infinite' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-600/[0.05] rounded-full blur-[100px]" style={{ animation: 'orbFloat2 25s ease-in-out infinite' }} />
        </div>
        <WalletProvider>
          <div className="relative z-10">
            {children}
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
