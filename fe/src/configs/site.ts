import type { LucideIcon } from "lucide-react"
import { Fingerprint, KeyRound, LayoutDashboard, LogIn, PackageCheck, Shield, Users } from "lucide-react"

export type SitePageId = "login" | "dashboard"
export type DashboardSectionId =
  | "products"
  | "users"
  | "permissions"
  | "permission-groups"
  | "tokens"

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
  {
    id: "permission-groups",
    label: "Permission Groups",
    module: "AuthModule",
    path: "/dashboard/permission-groups",
    icon: KeyRound,
    requiresAuth: true,
  },
  {
    id: "tokens",
    label: "Tokens",
    module: "AuthModule",
    path: "/dashboard/tokens",
    icon: Fingerprint,
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
