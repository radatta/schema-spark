import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/toaster";
import { AppFooter } from "@/components/layout/app-footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Schema Spark",
  description: "Generate full-stack applications from natural language specs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClerkProvider>
          <ConvexClientProvider>
            <div className="min-h-screen flex flex-col">
              <div className="flex-1">{children}</div>
              <AppFooter />
            </div>
            <Toaster />
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
