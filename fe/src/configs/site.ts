import type { LucideIcon } from "lucide-react"
import { LayoutDashboard, LogIn, PackageCheck, Users } from "lucide-react"

export type SitePageId = "login" | "dashboard"
export type DashboardSectionId = "products" | "users"

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
]

const defaultPageId: SitePageId = "login"
const defaultDashboardSectionId: DashboardSectionId = "products"

export const siteConfig = {
  name: "API Gateway Admin",
  description: "Azure demo dashboard",
  entities: "Product, Account, User, Permission",
  defaultPageId,
  defaultDashboardSectionId,
  pages,
  dashboardSections,
}
