import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "StandInv Platform",
  description: "Stand Inventory & Reconciliation Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link
            href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="font-sans" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {children}
          <Toaster position="top-right" richColors />
        </body>
      </html>
    </ClerkProvider>
  );
}
