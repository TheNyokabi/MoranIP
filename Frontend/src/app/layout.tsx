import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeScript } from "@/components/theme-script";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
    title: "Moran Platform",
    description: "Sovereign, Enterprise-Grade Digital Platform",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <ThemeScript />
            </head>
            <body className={cn(
                "min-h-screen bg-background font-sans antialiased",
                inter.variable
            )}>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
