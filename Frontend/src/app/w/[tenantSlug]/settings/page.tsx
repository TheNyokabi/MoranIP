import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Package, Users, Shield, ArrowRight, Building2, Database } from "lucide-react"

export default function SettingsPage({ params }: { params: { tenantSlug: string } }) {
    const { tenantSlug } = params

    const settingsSections = [
        {
            title: "Company Setup",
            description: "Configure company details required for Accounting",
            icon: Building2,
            href: `/w/${tenantSlug}/settings/company-setup`,
            color: "text-emerald-600"
        },
        {
            title: "Master Data",
            description: "Set up CRM, HR, Manufacturing, and Projects master data",
            icon: Database,
            href: `/w/${tenantSlug}/settings/master-data`,
            color: "text-indigo-600"
        },
        {
            title: "ERP Modules",
            description: "Enable or disable modules like PoS, Inventory, HR, and Projects",
            icon: Package,
            href: `/w/${tenantSlug}/settings/modules`,
            color: "text-blue-500"
        },
        {
            title: "Team Members",
            description: "Invite users, manage roles, and control workspace access",
            icon: Users,
            href: `/w/${tenantSlug}/settings/members`,
            color: "text-purple-500"
        },
        {
            title: "Roles & Permissions",
            description: "View system roles and their associated permissions",
            icon: Shield,
            href: `/w/${tenantSlug}/settings/roles`,
            color: "text-yellow-500"
        },
    ]

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-2xl font-bold">Settings</h3>
                <p className="text-sm text-muted-foreground">
                    Manage your tenant configuration and preferences
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {settingsSections.map((section) => {
                    const Icon = section.icon
                    return (
                        <Card key={section.href} className="hover:border-primary/50 transition-colors">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-muted ${section.color}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle>{section.title}</CardTitle>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="mb-4">
                                    {section.description}
                                </CardDescription>
                                <Button variant="outline" size="sm" asChild className="w-full">
                                    <Link href={section.href} className="flex items-center justify-between">
                                        <span>Configure</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
