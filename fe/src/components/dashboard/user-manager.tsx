import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserRound,
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
  assignPermissions,
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

const numberFormatter = new Intl.NumberFormat("en-US")

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

export type UserManagerProps = {
  session: LoginResponse | null
  onLogout: () => void
}

export function UserManager({ session, onLogout }: UserManagerProps) {
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<UserAccount | null>(null)
  const [accountPermissions, setAccountPermissions] = useState<UserPermissionDetail[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [draftPermissionIds, setDraftPermissionIds] = useState<string[]>([])
  const [accountTotal, setAccountTotal] = useState(0)
  const [permissionTotal, setPermissionTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(8)
  const [searchDraft, setSearchDraft] = useState("")
  const [permissionSearchDraft, setPermissionSearchDraft] = useState("")
  const [search, setSearch] = useState("")
  const [permissionSearch, setPermissionSearch] = useState("")
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [loadingPermissions, setLoadingPermissions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const token = session?.accessToken ?? ""
  const selectedAccountId = selectedAccount?.accountId ?? null
  const accountTotalPages = Math.max(1, Math.ceil(accountTotal / pageSize))

  const assignedPermissionIds = useMemo(
    () => new Set(accountPermissions.map((permission) => permission.permissionId)),
    [accountPermissions]
  )

  const draftPermissionSet = useMemo(
    () => new Set(draftPermissionIds),
    [draftPermissionIds]
  )

  const visibleSystemPermissions = permissions.filter(
    (permission) => permission.isSystem
  ).length

  useEffect(() => {
    if (!session) return

    let ignore = false

    async function loadAccounts() {
      setLoadingAccounts(true)
      setError(null)

      try {
        const result = await getAccounts({ token, page, pageSize, search })

        if (!ignore) {
          setAccounts(result.items)
          setAccountTotal(result.totalCount)

          if (result.items.length === 0) {
            setSelectedAccount(null)
            setAccountPermissions([])
            setPermissions([])
            setDraftPermissionIds([])
            setPermissionTotal(0)
          } else if (!selectedAccountId) {
            setSelectedAccount(result.items[0])
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to load users.")
        }
      } finally {
        if (!ignore) {
          setLoadingAccounts(false)
        }
      }
    }

    loadAccounts()

    return () => {
      ignore = true
    }
  }, [page, pageSize, refreshKey, search, selectedAccountId, session, token])

  useEffect(() => {
    if (!session || !selectedAccountId) return

    let ignore = false
    const accountId = selectedAccountId

    async function loadPermissionData() {
      setLoadingPermissions(true)
      setError(null)

      try {
        const [assigned, available] = await Promise.all([
          getAccountPermissions(token, accountId),
          getPermissions({ token, page: 1, pageSize: 100, search: permissionSearch }),
        ])

        if (!ignore) {
          setAccountPermissions(assigned)
          setPermissions(available.items)
          setPermissionTotal(available.totalCount)
          setDraftPermissionIds(assigned.map((permission) => permission.permissionId))
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "Unable to load permissions."
          )
        }
      } finally {
        if (!ignore) {
          setLoadingPermissions(false)
        }
      }
    }

    loadPermissionData()

    return () => {
      ignore = true
    }
  }, [permissionSearch, refreshKey, selectedAccountId, session, token])

  function handleLogout() {
    setAccounts([])
    setSelectedAccount(null)
    setAccountPermissions([])
    setPermissions([])
    setDraftPermissionIds([])
    setAccountTotal(0)
    setPermissionTotal(0)
    setNotice(null)
    setError(null)
    onLogout()
  }

  function applyUserSearch() {
    setSearch(searchDraft.trim())
    setPage(1)
  }

  function applyPermissionSearch() {
    setPermissionSearch(permissionSearchDraft.trim())
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
    if (!session || !selectedAccount) return

    const nextIds = new Set(draftPermissionIds)
    const idsToAdd = [...nextIds].filter((id) => !assignedPermissionIds.has(id))
    const idsToRemove = [...assignedPermissionIds].filter((id) => !nextIds.has(id))

    if (idsToAdd.length === 0 && idsToRemove.length === 0) {
      setNotice("Permissions already up to date.")
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      if (idsToAdd.length > 0) {
        await assignPermissions({
          token,
          accountId: selectedAccount.accountId,
          permissionIds: idsToAdd,
        })
      }

      if (idsToRemove.length > 0) {
        await Promise.all(
          idsToRemove.map((permissionId) =>
            revokePermission(token, selectedAccount.accountId, permissionId)
          )
        )
      }

      setNotice(`${selectedAccount.fullName ?? selectedAccount.email} permissions saved.`)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save permissions.")
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
          <Button onClick={onLogout}>
            <ShieldCheck className="h-4 w-4" />
            Sign in
          </Button>
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
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Accounts
            </CardTitle>
            <UserRound className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold">
              {numberFormatter.format(accountTotal)}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assigned permissions
            </CardTitle>
            <KeyRound className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold">
              {numberFormatter.format(accountPermissions.length)}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Permission catalog
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold">
              {numberFormatter.format(permissionTotal)}
            </div>
            {visibleSystemPermissions > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {visibleSystemPermissions} system entries visible
              </p>
            ) : null}
          </CardContent>
        </Card>
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

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <Card className="rounded-lg">
          <CardHeader className="p-4">
            <div className="flex flex-col gap-3">
              <div>
                <CardTitle className="text-base">Accounts</CardTitle>
                <CardDescription>{session.email}</CardDescription>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applyUserSearch()
                    }}
                    placeholder="Search users"
                  />
                </div>
                <Button variant="secondary" onClick={applyUserSearch}>
                  <Search className="h-4 w-4" />
                  Search
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingAccounts ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Loading users
              </div>
            ) : accounts.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No users found
              </div>
            ) : (
              <div className="divide-y">
                {accounts.map((account) => {
                  const selected = selectedAccount?.accountId === account.accountId

                  return (
                    <button
                      key={account.accountId}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                        selected && "bg-sky-50"
                      )}
                      onClick={() => setSelectedAccount(account)}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-sky-100 text-sm font-medium text-sky-700">
                          {getInitials(account.fullName, account.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {account.fullName || account.username}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {account.email}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline">{account.role}</Badge>
                        <span
                          className={cn(
                            "text-xs",
                            account.isActive ? "text-emerald-600" : "text-destructive"
                          )}
                        >
                          {account.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {accountTotalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loadingAccounts}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= accountTotalPages || loadingAccounts}
                  onClick={() =>
                    setPage((value) => Math.min(accountTotalPages, value + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle className="text-base">
                  {selectedAccount?.fullName || selectedAccount?.username || "Select user"}
                </CardTitle>
                <CardDescription>
                  {selectedAccount?.email || "No account selected"}
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={handleSavePermissions}
                disabled={!selectedAccount || saving || loadingPermissions}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save permissions
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0">
            {selectedAccount ? (
              <div className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">Username</div>
                  <div className="mt-1 truncate font-medium">{selectedAccount.username}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Account id</div>
                  <div className="mt-1 truncate font-mono text-xs">
                    {selectedAccount.accountId}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1">
                    <Badge
                      className={
                        selectedAccount.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : undefined
                      }
                      variant={selectedAccount.isActive ? "outline" : "destructive"}
                    >
                      {selectedAccount.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={permissionSearchDraft}
                  onChange={(event) => setPermissionSearchDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyPermissionSearch()
                  }}
                  placeholder="Search permissions"
                />
              </div>
              <Button variant="secondary" onClick={applyPermissionSearch}>
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>

            <div className="max-h-[520px] overflow-y-auto rounded-md border">
              {loadingPermissions ? (
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

                    return (
                      <label
                        key={permission.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30",
                          checked && "bg-emerald-50/60"
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
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge className={methodClass(permission.method)}>
                              {permission.method ?? "ANY"}
                            </Badge>
                            <span className="font-mono">{permission.endpoint ?? "No endpoint"}</span>
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
                <div className="mb-2 text-sm font-medium">Current assignments</div>
                <div className="flex flex-wrap gap-2">
                  {accountPermissions.slice(0, 8).map((permission) => (
                    <Badge key={permission.permissionId} variant="outline" className="gap-1">
                      {permission.permissionCode ?? permission.method ?? "Permission"}
                      <span className="text-muted-foreground">
                        {formatDate(permission.expiresAt)}
                      </span>
                    </Badge>
                  ))}
                  {accountPermissions.length > 8 ? (
                    <Badge variant="secondary">
                      +{accountPermissions.length - 8} more
                    </Badge>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
