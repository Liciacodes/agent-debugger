import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Debugger",
  description: "Record, inspect and replay AI agent runs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
