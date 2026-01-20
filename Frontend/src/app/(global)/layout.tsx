import { GlobalSidebar } from "@/components/layout/global-sidebar"

export default function GlobalLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-[#0a0a0f]">
            <GlobalSidebar />
            <main className="pl-64 transition-all duration-300">
                {children}
            </main>
        </div>
    )
}
