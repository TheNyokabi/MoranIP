import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeScript } from "@/components/theme-script";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
    ],
};

export const metadata: Metadata = {
    title: {
        default: "MoranERP",
        template: "%s | MoranERP",
    },
    description: "Sovereign, Enterprise-Grade Digital Platform for African Businesses",
    applicationName: "MoranERP",
    manifest: "/manifest.json",
    keywords: ["ERP", "POS", "Inventory", "Accounting", "CRM", "HR", "Africa", "Kenya"],
    authors: [{ name: "Moran Technologies" }],
    creator: "Moran Technologies",
    publisher: "Moran Technologies",
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    icons: {
        icon: [
            { url: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png" },
            { url: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" },
            { url: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png" },
            { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
            { url: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
            { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: [
            { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
            { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
        ],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "MoranERP",
    },
    openGraph: {
        type: "website",
        locale: "en_US",
        siteName: "MoranERP",
        title: "MoranERP - Enterprise Resource Planning",
        description: "Sovereign, Enterprise-Grade Digital Platform for African Businesses",
    },
    twitter: {
        card: "summary_large_image",
        title: "MoranERP",
        description: "Sovereign, Enterprise-Grade Digital Platform for African Businesses",
    },
    robots: {
        index: true,
        follow: true,
    },
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
                <link rel="manifest" href="/manifest.json" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <meta name="apple-mobile-web-app-title" content="MoranERP" />
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
