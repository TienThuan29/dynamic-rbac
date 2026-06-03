import { useMemo, useState } from "react"
import { Boxes, LogOut, ShieldCheck } from "lucide-react"
import { ProductManager } from "@/components/dashboard/product-manager"
import { UserManager } from "@/components/dashboard/user-manager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  siteConfig,
  type DashboardSectionId,
  type SitePageId,
} from "@/configs/site"
import { cn } from "@/lib/utils"
import type { LoginResponse } from "@/types/api"

export type DashboardPageProps = {
  session: LoginResponse | null
  onLogout: () => void
  onNavigate: (pageId: SitePageId) => void
}

function getInitials(name: string) {
  return name
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function DashboardPage({
  session,
  onLogout,
  onNavigate,
}: DashboardPageProps) {
  const [activeSectionId, setActiveSectionId] = useState<DashboardSectionId>(
    siteConfig.defaultDashboardSectionId
  )

  const activeSection = useMemo(() => {
    return (
      siteConfig.dashboardSections.find((section) => section.id === activeSectionId) ??
      siteConfig.dashboardSections[0]
    )
  }, [activeSectionId])
  const ActiveSectionIcon = activeSection.icon

  function handleSectionChange(sectionId: DashboardSectionId) {
    const nextSection =
      siteConfig.dashboardSections.find((section) => section.id === sectionId) ??
      siteConfig.dashboardSections[0]

    if (nextSection.requiresAuth && !session) {
      onNavigate("login")
      return
    }

    setActiveSectionId(nextSection.id)
  }

  function renderSection() {
    if (activeSection.id === "users") {
      return <UserManager session={session} onLogout={onLogout} />
    }

    return <ProductManager />
  }

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f9f8] p-4 text-foreground">
        <div className="w-full max-w-md rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-normal">
            Dashboard requires login
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with an AuthModule identity before managing users.
          </p>
          <Button className="mt-5 w-full" onClick={() => onNavigate("login")}>
            Go to login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f9f8] text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r bg-white lg:min-h-screen">
          <div className="flex h-full flex-col lg:sticky lg:top-0 lg:min-h-screen">
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                  <ActiveSectionIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-semibold">{siteConfig.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {siteConfig.description}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {siteConfig.dashboardSections.map((section) => (
                  <Badge
                    key={section.id}
                    className={cn(
                      "border bg-white",
                      section.id === "products" &&
                        "border-emerald-200 bg-emerald-50 text-emerald-700",
                      section.id === "users" &&
                        "border-sky-200 bg-sky-50 text-sky-700"
                    )}
                  >
                    {section.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <nav className="grid grid-cols-2 gap-2 p-3 lg:block lg:flex-1 lg:space-y-1">
              {siteConfig.dashboardSections.map((section) => {
                const Icon = section.icon
                const active = activeSection.id === section.id

                return (
                  <Button
                    key={section.id}
                    variant="ghost"
                    className={cn(
                      "h-auto w-full justify-start gap-3 px-3 py-3 text-left",
                      active &&
                        "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
                    )}
                    onClick={() => handleSectionChange(section.id)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {section.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {section.module}
                      </span>
                    </span>
                  </Button>
                )
              })}
            </nav>

            <div className="hidden border-t p-4 lg:block">
              <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-medium text-sky-700">
                    {getInitials(session.fullName || session.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {session.fullName}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {session.email}
                    </div>
                  </div>
                </div>
                <Button className="w-full" variant="outline" size="sm" onClick={onLogout}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                <Boxes className="h-4 w-4 text-amber-600" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">Backend entities</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {siteConfig.entities}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  )
}
