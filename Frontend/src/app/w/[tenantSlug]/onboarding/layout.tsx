/**
 * Onboarding Layout - Standalone layout without sidebar
 * This bypasses the default tenant layout for a clean onboarding experience
 */
export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen">
            {children}
        </div>
    );
}
