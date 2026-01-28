"use client"

import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { SidebarContent } from "@/components/layout/sidebar-content"
import { useState } from "react"

export function MobileSidebar({ tenantSlug }: { tenantSlug: string }) {
    const [open, setOpen] = useState(false)

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle Sidebar</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
                <SidebarContent tenantSlug={tenantSlug} onNavigate={() => setOpen(false)} />
            </SheetContent>
        </Sheet>
    )
}
