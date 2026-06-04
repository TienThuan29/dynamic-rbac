import type { Permission, UserPermissionDetail } from "@/types/api"

export function permissionScopeLabel(permission: Permission | UserPermissionDetail) {
  if (permission.endpoint) return permission.endpoint

  const resource = permission.permissionCode?.split(":")[0]
  if (resource) {
    return `(All endpoints in ${resource})`
  }

  return "No endpoint mapping"
}
  