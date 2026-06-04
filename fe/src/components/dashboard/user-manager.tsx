import { useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import {
  AlertCircle,
  Crown,
  KeyRound,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PermissionSearchBox } from "@/components/permission-search-box"
import {
  assignPermissionsWithExpiry,
  getAccountPermissions,
  getAccounts,
  revokePermission,
} from "@/api/auth.api"
import { getPermissionGroups, getPermissions, getPermissionResources } from "@/api/permission.api"
import { permissionScopeLabel } from "@/lib/permission.util"
import { cn } from "@/lib/utils"
import type {
  LoginResponse,
  Permission,
  PermissionGroup,
  UserAccount,
  UserPermissionDetail,
} from "@/types/api"

function getInitials(name?: string | null, email?: string) {
  const source = name?.trim() || email || "User"
  return source
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function formatDate(value?: string | null) {
  if (!value) return "No expiry"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

function methodClass(method?: string | null) {
  switch (method?.toUpperCase()) {
    case "GET":
      return "border-sky-200 bg-sky-50 text-sky-700"
    case "POST":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "PUT":
    case "PATCH":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "DELETE":
      return "border-rose-200 bg-rose-50 text-rose-700"
    default:
      return "border-muted bg-muted text-muted-foreground"
  }
}

function permissionTitle(permission: Permission | UserPermissionDetail) {
  return (
    permission.permissionName ||
    permission.permissionCode ||
    permission.endpoint ||
    ("permissionId" in permission ? permission.permissionId : permission.id)
  )
}

function isAdminPermission(permission: Permission | UserPermissionDetail) {
  return (
    permission.permissionCode?.endsWith(":admin") &&
    permission.method === null &&
    permission.endpoint === null
  )
}


// ─────────────────────────────────────────────────────────────────────────────

export type UserManagerProps = {
  session: LoginResponse | null
}

export function UserManager({ session }: UserManagerProps) {
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [draftPermissionIds, setDraftPermissionIds] = useState<string[]>([])
  const [expiryDate, setExpiryDate] = useState<string>("")
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [searchDraft, setSearchDraft] = useState("")
  const [search, setSearch] = useState("")
  const [permFilters, setPermFilters] = useState<{
    search: string
    method: string[]
    type: ("system" | "custom")[]
    status: ("active" | "inactive")[]
    resource: string
    isAdmin: "" | "admin" | "non-admin"
  }>({
    search: "",
    method: [],
    type: [],
    status: [],
    resource: "",
    isAdmin: "",
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [permDialogUser, setPermDialogUser] = useState<UserAccount | null>(null)
  const [accountPermissions, setAccountPermissions] = useState<UserPermissionDetail[]>([])
  const [resourceOptions, setResourceOptions] = useState<string[]>([])
  const [permGroups, setPermGroups] = useState<PermissionGroup[]>([])
  const [loadingPerms, setLoadingPerms] = useState(false)

  const token = session?.accessToken ?? ""
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const assignedPermissionIds = useMemo(
    () => new Set(accountPermissions.map((p) => p.permissionId)),
    [accountPermissions]
  )

  const draftPermissionSet = useMemo(
    () => new Set(draftPermissionIds),
    [draftPermissionIds]
  )

  const filteredPermissions = useMemo(() => {
    let result = permissions

    if (permFilters.search) {
      const q = permFilters.search.toLowerCase()
      result = result.filter(
        (p) =>
          p.permissionName?.toLowerCase().includes(q) ||
          p.permissionCode?.toLowerCase().includes(q) ||
          p.endpoint?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      )
    }

    if (permFilters.method.length > 0) {
      result = result.filter((p) => p.method && permFilters.method.includes(p.method))
    }

    if (permFilters.type.length === 1) {
      const wantSystem = permFilters.type[0] === "system"
      result = result.filter((p) => p.isSystem === wantSystem)
    }

    if (permFilters.status.length === 1) {
      const wantActive = permFilters.status[0] === "active"
      result = result.filter((p) => p.isActive === wantActive)
    }

    if (permFilters.resource) {
      result = result.filter((p) =>
        p.permissionCode?.startsWith(permFilters.resource + ":")
      )
    }

    if (permFilters.isAdmin === "admin") {
      result = result.filter((p) => p.permissionCode?.endsWith(":admin"))
    } else if (permFilters.isAdmin === "non-admin") {
      result = result.filter((p) => !p.permissionCode?.endsWith(":admin"))
    }

    return result
  }, [permissions, permFilters])

  useEffect(() => {
    if (!session) return

    let ignore = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const result = await getAccounts({ token, page, pageSize, search })

        if (!ignore) {
          setAccounts(result.items)
          setTotal(result.totalCount)
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to load users.")
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      ignore = true
    }
  }, [page, pageSize, refreshKey, search, session, token])

  async function openPermDialog(user: UserAccount) {
    setPermDialogUser(user)
    setExpiryDate("")
    setLoadingPerms(true)

    try {
      const [assigned, available, resources, groups] = await Promise.all([
        getAccountPermissions(token, user.accountId),
        getPermissions({ token, page: 1, pageSize: 100 }),
        getPermissionResources(token),
        getPermissionGroups({ token, page: 1, pageSize: 100 }),
      ])
      setAccountPermissions(assigned)
      setPermissions(available.items)
      setResourceOptions(resources)
      setPermGroups(groups.items)
      setDraftPermissionIds(assigned.map((p) => p.permissionId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load permissions.")
    } finally {
      setLoadingPerms(false)
    }
  }

  function closePermDialog() {
    setPermDialogUser(null)
    setAccountPermissions([])
    setPermissions([])
    setResourceOptions([])
    setPermGroups([])
    setDraftPermissionIds([])
    setPermFilters({ search: "", method: [], type: [], status: [], resource: "", isAdmin: "" })
  }

  function applyPermissionIds(ids: string[]) {
    setDraftPermissionIds((current) => {
      const set = new Set(current)
      ids.forEach((id) => set.add(id))
      return [...set]
    })
  }

  function applySearch() {
    setSearch(searchDraft.trim())
    setPage(1)
  }

  function handlePermFiltersChange(newFilters: typeof permFilters) {
    setPermFilters(newFilters)
  }

  function togglePermission(permissionId: string, checked: boolean) {
    setDraftPermissionIds((current) => {
      if (checked) {
        return current.includes(permissionId) ? current : [...current, permissionId]
      }
      return current.filter((id) => id !== permissionId)
    })
  }

  async function handleSavePermissions() {
    if (!token || !permDialogUser) return

    const nextIds = new Set(draftPermissionIds)
    const idsToAdd = [...nextIds].filter((id) => !assignedPermissionIds.has(id))
    const idsToRemove = [...assignedPermissionIds].filter((id) => !nextIds.has(id))

    if (idsToAdd.length === 0 && idsToRemove.length === 0) {
      toast("Permissions already up to date.")
      return
    }

    setSaving(true)

    try {
      if (idsToAdd.length > 0) {
        await assignPermissionsWithExpiry({
          token,
          accountId: permDialogUser.accountId,
          permissionIds: idsToAdd,
          expiresAt: expiryDate || null,
        })
      }

      if (idsToRemove.length > 0) {
        await Promise.all(
          idsToRemove.map((permissionId) =>
            revokePermission(token, permDialogUser.accountId, permissionId)
          )
        )
      }

      toast.success(
        `${permDialogUser.fullName ?? permDialogUser.email} permissions updated.`
      )
      setExpiryDate("")
      setRefreshKey((value) => value + 1)
      closePermDialog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save permissions.")
    } finally {
      setSaving(false)
    }
  }

  if (!session) {
    return (
      <Card className="rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-base">User Management</CardTitle>
          <CardDescription>AuthModule session required</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-sm text-muted-foreground">Sign in to manage users.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-sky-700">
            <Users className="h-4 w-4" />
            AuthModule users
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            User Management
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-8 gap-2 px-3">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            {session.role}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((value) => value + 1)}
            title="Refresh users"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <Card className="rounded-lg">
        <CardHeader className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Accounts</CardTitle>
              <CardDescription>
                {total > 0 ? `${total} account${total !== 1 ? "s" : ""} total` : "No accounts"}
              </CardDescription>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applySearch()
                  }}
                  placeholder="Search users..."
                />
              </div>
              <Button variant="secondary" onClick={applySearch}>
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted-foreground" colSpan={5}>
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Loading users
                    </td>
                  </tr>
                ) : accounts.length === 0 ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted-foreground" colSpan={5}>
                      No users found
                    </td>
                  </tr>
                ) : (
                  accounts.map((account) => (
                    <tr
                      key={account.accountId}
                      className="border-b transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-sky-100 text-sm font-medium text-sky-700">
                              {getInitials(account.fullName, account.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {account.fullName || account.username}
                            </div>
                            {account.fullName ? (
                              <div className="truncate text-xs text-muted-foreground">
                                {account.username}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground">{account.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{account.role}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            account.isActive ? "text-emerald-600" : "text-destructive"
                          )}
                        >
                          {account.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPermDialog(account)}
                            title="Manage permissions"
                          >
                            <KeyRound className="h-4 w-4" />
                            Permissions
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} &nbsp;&middot;&nbsp; {total} total
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <UserPermissionDialog
        user={permDialogUser}
        permissions={filteredPermissions}
        accountPermissions={accountPermissions}
        assignedPermissionIds={assignedPermissionIds}
        draftPermissionSet={draftPermissionSet}
        permFilters={permFilters}
        resourceOptions={resourceOptions}
        permGroups={permGroups}
        expiryDate={expiryDate}
        loadingPerms={loadingPerms}
        saving={saving}
        onClose={closePermDialog}
        onFiltersChange={handlePermFiltersChange}
        onTogglePermission={togglePermission}
        onApplyPermissionIds={applyPermissionIds}
        onExpiryChange={setExpiryDate}
        onSave={handleSavePermissions}
      />
    </div>
  )
}


// ─── User Permission Dialog ─────────────────────────────────────────────────

interface UserPermissionDialogProps {
  user: UserAccount | null
  permissions: Permission[]
  accountPermissions: UserPermissionDetail[]
  assignedPermissionIds: Set<string>
  draftPermissionSet: Set<string>
  permFilters: {
    search: string
    method: string[]
    type: ("system" | "custom")[]
    status: ("active" | "inactive")[]
    resource: string
    isAdmin: "" | "admin" | "non-admin"
  }
  resourceOptions: string[]
  permGroups: PermissionGroup[]
  expiryDate: string
  loadingPerms: boolean
  saving: boolean
  onClose: () => void
  onFiltersChange: (filters: UserPermissionDialogProps["permFilters"]) => void
  onTogglePermission: (permissionId: string, checked: boolean) => void
  onApplyPermissionIds: (ids: string[]) => void
  onExpiryChange: (date: string) => void
  onSave: () => void
}

function UserPermissionDialog({
  user,
  permissions,
  accountPermissions,
  assignedPermissionIds,
  draftPermissionSet,
  permFilters,
  resourceOptions,
  permGroups,
  expiryDate,
  loadingPerms,
  saving,
  onClose,
  onFiltersChange,
  onTogglePermission,
  onApplyPermissionIds,
  onExpiryChange,
  onSave,
}: UserPermissionDialogProps) {
  const [permPage, setPermPage] = useState(1)
  const [applyGroupOpen, setApplyGroupOpen] = useState(false)
  const permPageSize = 12

  // Reset to page 1 when permissions list changes (filter applied) — render-phase update
  const [prevPermissions, setPrevPermissions] = useState(permissions)
  if (prevPermissions !== permissions) {
    setPrevPermissions(permissions)
    setPermPage(1)
  }

  const totalPermPages = Math.max(1, Math.ceil(permissions.length / permPageSize))
  const pagedPermissions = permissions.slice(
    (permPage - 1) * permPageSize,
    permPage * permPageSize
  )
  const addedCount = [...draftPermissionSet].filter((id) => !assignedPermissionIds.has(id)).length
  const removedCount = [...assignedPermissionIds].filter((id) => !draftPermissionSet.has(id)).length

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        {/* ── Header ── */}
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-sky-100 text-sm font-medium text-sky-700">
                {user ? getInitials(user.fullName, user.email) : ""}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle>{user?.fullName || user?.username || "User"}</DialogTitle>
              <DialogDescription>{user?.email}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] divide-x overflow-hidden">
          {/* Left panel: user info + draft summary + current assignments */}
          <div className="flex flex-col gap-4 overflow-y-auto p-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Account Info
              </p>
              <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="mt-0.5 truncate font-medium">{user?.username ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <div className="mt-0.5">
                    <Badge variant="outline">{user?.role}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-0.5">
                    <Badge
                      className={
                        user?.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : undefined
                      }
                      variant={user?.isActive ? "outline" : "destructive"}
                    >
                      {user?.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Draft Changes
              </p>
              <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selected</span>
                  <span className="font-medium">{draftPermissionSet.size}</span>
                </div>
                {addedCount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>To assign</span>
                    <span className="font-medium">+{addedCount}</span>
                  </div>
                )}
                {removedCount > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>To revoke</span>
                    <span className="font-medium">−{removedCount}</span>
                  </div>
                )}
                {addedCount === 0 && removedCount === 0 && (
                  <p className="text-muted-foreground">No pending changes</p>
                )}
              </div>
            </div>

            {accountPermissions.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Assignments ({accountPermissions.length})
                </p>
                <div className="space-y-1.5">
                  {accountPermissions.map((p) => (
                    <div
                      key={p.permissionId}
                      className="rounded-md border bg-muted/10 px-2.5 py-2 text-xs"
                    >
                      <p className="truncate font-mono font-medium">
                        {p.permissionCode ?? p.method ?? "Permission"}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">{formatDate(p.expiresAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right panel: filters + list + pagination */}
          <div className="flex min-h-0 flex-col">
            {/* Search + expiry */}
            <div className="space-y-2 border-b p-4">
              <PermissionSearchBox
                value={permFilters}
                onChange={onFiltersChange}
                loading={loadingPerms}
                resourceOptions={resourceOptions}
              />
              <div className="flex items-center gap-2">
                <label className="whitespace-nowrap text-sm text-muted-foreground">
                  Expiry for new assignments:
                </label>
                <input
                  type="date"
                  className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={expiryDate}
                  onChange={(e) => onExpiryChange(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setApplyGroupOpen(true)}
                  disabled={loadingPerms || permGroups.length === 0}
                >
                  <Layers className="h-4 w-4" />
                  Apply group
                </Button>
              </div>
            </div>

            {/* List */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingPerms ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Loading permissions
                </div>
              ) : permissions.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No permissions found
                </div>
              ) : (
                <div className="divide-y">
                  {pagedPermissions.map((permission) => {
                    const checked = draftPermissionSet.has(permission.id)
                    const assigned = assignedPermissionIds.has(permission.id)
                    const isAdmin = isAdminPermission(permission)

                    return (
                      <label
                        key={permission.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 px-3 py-1.5 transition-colors hover:bg-muted/30",
                          checked && "bg-emerald-50/60",
                          isAdmin && checked && "bg-violet-50/60",
                          isAdmin && !checked && "bg-violet-50/20"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            onTogglePermission(permission.id, value === true)
                          }
                        />
                        <div className="min-w-0 flex-1">
                          {/* Row 1: method + name + scope */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isAdmin && <Crown className="h-3.5 w-3.5 shrink-0 text-violet-600" />}
                            <Badge className={cn("shrink-0 text-[10px]", methodClass(permission.method))}>
                              {permission.method ?? "ANY"}
                            </Badge>
                            <span className="text-sm font-medium leading-tight">{permissionTitle(permission)}</span>
                            <span className="truncate font-mono text-xs text-muted-foreground">
                              {permissionScopeLabel(permission)}
                            </span>
                          </div>
                          {/* Row 2: badges + description */}
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            {assigned && (
                              <Badge className="border-emerald-200 bg-emerald-50 py-0 text-[10px] text-emerald-700">
                                Assigned
                              </Badge>
                            )}
                            {permission.isSystem && (
                              <Badge variant="secondary" className="py-0 text-[10px]">System</Badge>
                            )}
                            {permission.isPublic && (
                              <Badge variant="outline" className="py-0 text-[10px]">Public</Badge>
                            )}
                            {isAdmin && (
                              <Badge
                                variant="outline"
                                className="border-violet-200 bg-violet-50 py-0 text-[10px] text-violet-700"
                              >
                                Admin
                              </Badge>
                            )}
                            {permission.description && (
                              <span className="text-[11px] text-muted-foreground">
                                {permission.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            {!loadingPerms && permissions.length > permPageSize && (
              <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm text-muted-foreground">
                <span>
                  {(permPage - 1) * permPageSize + 1}–
                  {Math.min(permPage * permPageSize, permissions.length)} of{" "}
                  {permissions.length}
                </span>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={permPage <= 1}
                    onClick={() => setPermPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={permPage >= totalPermPages}
                    onClick={() => setPermPage((p) => Math.min(totalPermPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="border-t px-6 py-4">
          <DialogClose asChild>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={onSave} disabled={saving || loadingPerms}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save permissions
          </Button>
        </DialogFooter>
      </DialogContent>

      <ApplyGroupDialog
        open={applyGroupOpen}
        groups={permGroups}
        onClose={() => setApplyGroupOpen(false)}
        onApply={(group) => {
          onApplyPermissionIds(group.permissionIds)
          setApplyGroupOpen(false)
          toast.success(
            `Group "${group.groupName}" applied — ${group.permissionIds.length} permission${group.permissionIds.length !== 1 ? "s" : ""} added to draft.`
          )
        }}
      />
    </Dialog>
  )
}


// ─── Apply Group Dialog ─────────────────────────────────────────────────────

interface ApplyGroupDialogProps {
  open: boolean
  groups: PermissionGroup[]
  onClose: () => void
  onApply: (group: PermissionGroup) => void
}

function ApplyGroupDialog({ open, groups, onClose, onApply }: ApplyGroupDialogProps) {
  const [selected, setSelected] = useState<PermissionGroup | null>(null)
  const [groupSearch, setGroupSearch] = useState("")
  const [prevOpen, setPrevOpen] = useState(open)

  // Reset state when dialog re-opens (render-phase update)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (open) {
      setSelected(null)
      setGroupSearch("")
    }
  }

  const filtered = groups.filter(
    (g) =>
      !groupSearch ||
      g.groupName.toLowerCase().includes(groupSearch.toLowerCase()) ||
      g.description?.toLowerCase().includes(groupSearch.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-sky-600" />
            Apply Permission Group
          </DialogTitle>
          <DialogDescription>
            Select a group to add all its permissions to the current draft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search groups…"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
            />
          </div>

          <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No groups found
              </p>
            ) : (
              filtered.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                    selected?.id === group.id && "bg-sky-50 hover:bg-sky-50"
                  )}
                  onClick={() => setSelected(group)}
                >
                  <Layers
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      selected?.id === group.id ? "text-sky-600" : "text-muted-foreground"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{group.groupName}</p>
                    {group.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {group.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {group.permissionIds.length} permission
                      {group.permissionIds.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {selected?.id === group.id && (
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </DialogClose>
          <Button disabled={!selected} onClick={() => selected && onApply(selected)}>
            <Layers className="h-4 w-4" />
            Apply group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
