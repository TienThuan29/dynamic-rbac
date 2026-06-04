import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  KeyRound,
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
  getPermissions,
  revokePermission,
} from "@/api/api"
import { cn } from "@/lib/utils"
import type {
  LoginResponse,
  Permission,
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
  }>({
    search: "",
    method: [],
    type: [],
    status: [],
    resource: "",
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [permDialogUser, setPermDialogUser] = useState<UserAccount | null>(null)
  const [accountPermissions, setAccountPermissions] = useState<UserPermissionDetail[]>([])
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [permError, setPermError] = useState<string | null>(null)

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
    setPermError(null)
    setExpiryDate("")
    setLoadingPerms(true)

    try {
      const [assigned, available] = await Promise.all([
        getAccountPermissions(token, user.accountId),
        getPermissions({
          token,
          page: 1,
          pageSize: 100,
          search: permFilters.search || undefined,
          method: permFilters.method.length === 1 ? permFilters.method[0] : undefined,
          isSystem:
            permFilters.type.length === 1
              ? permFilters.type[0] === "system"
              : undefined,
          isActive:
            permFilters.status.length === 1
              ? permFilters.status[0] === "active"
              : undefined,
        }),
      ])
      setAccountPermissions(assigned)
      setPermissions(available.items)
      setDraftPermissionIds(assigned.map((p) => p.permissionId))
    } catch (err) {
      setPermError(err instanceof Error ? err.message : "Unable to load permissions.")
    } finally {
      setLoadingPerms(false)
    }
  }

  function closePermDialog() {
    setPermDialogUser(null)
    setAccountPermissions([])
    setPermissions([])
    setDraftPermissionIds([])
    setPermError(null)
    setPermFilters({ search: "", method: [], type: [], status: [], resource: "" })
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
      setNotice("Permissions already up to date.")
      return
    }

    setSaving(true)
    setPermError(null)

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

      setNotice(
        `${permDialogUser.fullName ?? permDialogUser.email} permissions updated.`
      )
      setExpiryDate("")
      setRefreshKey((value) => value + 1)
      closePermDialog()
    } catch (err) {
      setPermError(err instanceof Error ? err.message : "Unable to save permissions.")
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

      {notice ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
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

      {/* Permissions Dialog */}
      <Dialog
        open={permDialogUser !== null}
        onOpenChange={(open) => !open && closePermDialog()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-sky-100 text-sm font-medium text-sky-700">
                  {permDialogUser
                    ? getInitials(permDialogUser.fullName, permDialogUser.email)
                    : ""}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle>
                  {permDialogUser?.fullName || permDialogUser?.username || "User"}
                </DialogTitle>
                <DialogDescription>{permDialogUser?.email}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {permError ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {permError}
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Username</div>
                <div className="mt-1 truncate font-medium">
                  {permDialogUser?.username ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Role</div>
                <div className="mt-1">
                  <Badge variant="outline">{permDialogUser?.role}</Badge>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="mt-1">
                  <Badge
                    className={
                      permDialogUser?.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : undefined
                    }
                    variant={permDialogUser?.isActive ? "outline" : "destructive"}
                  >
                    {permDialogUser?.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-0">
                <PermissionSearchBox
                  value={permFilters}
                  onChange={handlePermFiltersChange}
                  loading={loadingPerms}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="whitespace-nowrap text-sm text-muted-foreground">
                  Expiry:
                </label>
                <input
                  type="date"
                  className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto rounded-md border">
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
                  {permissions.map((permission) => {
                    const checked = draftPermissionSet.has(permission.id)
                    const assigned = assignedPermissionIds.has(permission.id)
                    const isAdmin = isAdminPermission(permission)

                    return (
                      <label
                        key={permission.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30",
                          checked && "bg-emerald-50/60",
                          isAdmin && checked && "bg-violet-50/60",
                          isAdmin && !checked && "bg-violet-50/20"
                        )}
                      >
                        <Checkbox
                          className="mt-1"
                          checked={checked}
                          onCheckedChange={(value) =>
                            togglePermission(permission.id, value === true)
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {isAdmin && (
                              <Crown className="h-4 w-4 shrink-0 text-violet-600" />
                            )}
                            <span className="font-medium">
                              {permissionTitle(permission)}
                            </span>
                            {assigned ? (
                              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                Assigned
                              </Badge>
                            ) : null}
                            {permission.isPublic ? (
                              <Badge variant="outline">Public</Badge>
                            ) : null}
                            {permission.isSystem ? (
                              <Badge variant="secondary">System</Badge>
                            ) : null}
                            {isAdmin && (
                              <Badge
                                variant="outline"
                                className="border-violet-200 bg-violet-50 text-violet-700"
                              >
                                Admin wildcard
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge className={methodClass(permission.method)}>
                              {permission.method ?? "ANY"}
                            </Badge>
                            <span className="font-mono">
                              {permission.endpoint ?? "All endpoints"}
                            </span>
                          </div>
                          {permission.description ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {permission.description}
                            </p>
                          ) : null}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {accountPermissions.length > 0 ? (
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="mb-2 text-sm font-medium">
                  Current assignments ({accountPermissions.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {accountPermissions.map((p) => (
                    <Badge key={p.permissionId} variant="outline" className="gap-1">
                      {p.permissionCode ?? p.method ?? "Permission"}
                      <span className="text-muted-foreground">
                        {formatDate(p.expiresAt)}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={handleSavePermissions} disabled={saving || loadingPerms}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
