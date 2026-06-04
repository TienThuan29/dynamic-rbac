import type { LucideIcon } from "lucide-react"
import { LayoutDashboard, LogIn, PackageCheck, Shield, Users } from "lucide-react"

export type SitePageId = "login" | "dashboard"
export type DashboardSectionId = "products" | "users" | "permissions"

export type SitePage = {
  id: SitePageId
  label: string
  path: string
  icon: LucideIcon
  requiresAuth?: boolean
}

export type DashboardSection = {
  id: DashboardSectionId
  label: string
  module: string
  path: string
  icon: LucideIcon
  requiresAuth?: boolean
}

const pages: SitePage[] = [
  {
    id: "login",
    label: "Login",
    path: "/login",
    icon: LogIn,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    requiresAuth: true,
  },
]

const dashboardSections: DashboardSection[] = [
  {
    id: "products",
    label: "Products",
    module: "MainModule",
    path: "/dashboard/products",
    icon: PackageCheck,
  },
  {
    id: "users",
    label: "Users",
    module: "AuthModule",
    path: "/dashboard/users",
    icon: Users,
    requiresAuth: true,
  },
  {
    id: "permissions",
    label: "Permissions",
    module: "AuthModule",
    path: "/dashboard/permissions",
    icon: Shield,
    requiresAuth: true,
  },
]

const defaultPageId: SitePageId = "login"
const defaultDashboardSectionId: DashboardSectionId = "products"

export const siteConfig = {
  name: "Permission Demo",
  description: "",
  entities: "",
  defaultPageId,
  defaultDashboardSectionId,
  pages,
  dashboardSections,
}
