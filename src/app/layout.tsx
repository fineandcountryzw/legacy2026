import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Stands Recon F&C",
  description: "Stand Inventory & Reconciliation Platform for Fine & Country",
};

// Force dynamic rendering to avoid build-time env var issues
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      
      afterSignOutUrl="/"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <html lang="en" className="bg-brand-light">
        <head>
          <link
            href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
            rel="stylesheet"
          />
          {/* Brand Color Meta Tags */}
          <meta name="theme-color" content="#C5A059" />
          <meta name="msapplication-TileColor" content="#C5A059" />
        </head>
        <body 
          className="font-sans antialiased bg-brand-light text-brand-black" 
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {children}
          <Toaster 
            position="top-right" 
            richColors 
            toastOptions={{
              style: {
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
