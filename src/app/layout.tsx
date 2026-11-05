import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { NavRail } from "@/components/NavRail";
import { RunsSidebar } from "@/components/RunsSidebar";
import { RunListSkeleton } from "@/components/skeletons";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "Agent Debugger",
  description: "Record, inspect and replay AI agent runs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <body>
      
        <div className="flex min-h-screen flex-col xl:h-screen">
          <AppHeader />
          <div className="flex flex-1 flex-wrap xl:min-h-0 xl:flex-nowrap">
            <NavRail />
          
            <aside className="scrollbar-dark flex max-h-[45vh] w-full flex-col gap-3 overflow-y-auto border-b border-line px-2.5 py-4 md:max-h-none md:w-67.5 md:shrink-0 md:overflow-visible md:border-r md:border-b-0 xl:overflow-y-auto">
              
              <Suspense fallback={<RunListSkeleton />}>
                <RunsSidebar />
              </Suspense>
            </aside>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
