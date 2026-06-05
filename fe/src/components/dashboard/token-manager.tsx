import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import toast from "react-hot-toast"
import {
  AlertCircle,
  Copy,
  Eye,
  Fingerprint,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react"
import {
  addTokenPermissions,
  createToken,
  deleteToken,
  getToken,
  getTokens,
  refreshToken,
  removeTokenPermission,
  revokeToken,
} from "@/api/token.api"
import { getAccounts } from "@/api/auth.api"
import { getAccountPermissions } from "@/api/auth.api"
import {
  getPermissionResources,
  getPermissions,
} from "@/api/permission.api"
import {
  PermissionSearchBox,
  type PermissionFilters,
} from "@/components/permission-search-box"
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { permissionScopeLabel } from "@/lib/permission.util"
import { cn } from "@/lib/utils"
import type {
  CreateTokenPayload,
  LoginResponse,
  ManagedToken,
  Permission,
  RefreshTokenResponse,
  UserAccount,
} from "@/types/api"

type StatusFilter = "all" | "active" | "revoked"

type TokenFormState = {
  accountId: string
  expiresInMinutes: string
  permissionIds: string[]
}

const numberFormatter = new Intl.NumberFormat("en-US")

const emptyForm: TokenFormState = {
  accountId: "",
  expiresInMinutes: "",
  permissionIds: [],
}

const defaultPermissionFilters: PermissionFilters = {
  search: "",
  method: [],
  type: [],
  status: [],
  resource: "",
  isAdmin: "",
}

export type TokenManagerProps = {
  session: LoginResponse | null
}

function formatDate(value?: string | null) {
  if (!value) return "Never"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

function permissionTitle(permission: Permission) {
  return (
    permission.permissionName ||
    permission.permissionCode ||
    permission.endpoint ||
    permission.id
  )
}

function tokenOwner(token: ManagedToken) {
  if (token.accountId) {
    return token.accountEmail || token.accountUsername || token.accountId
  }
  return token.createdByEmail || token.createdByUsername || token.createdById
}

function isExpired(token: ManagedToken) {
  return token.expiresAt ? new Date(token.expiresAt).getTime() <= Date.now() : false
}

function tokenState(token: ManagedToken) {
  if (token.isRevoked) return "revoked"
  if (isExpired(token)) return "expired"
  return "active"
}

function tokenStateBadge(token: ManagedToken) {
  const state = tokenState(token)

  if (state === "revoked") {
    return <Badge variant="destructive">Revoked</Badge>
  }

  if (state === "expired") {
    return <Badge className="border-amber-200 bg-amber-50 text-amber-700">Expired</Badge>
  }

  return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge>
}

function toPayload(form: TokenFormState): CreateTokenPayload {
  const expiresInMinutes = Number(form.expiresInMinutes || 0)

  return {
    accountId: form.accountId,
    permissionIds: form.permissionIds,
    expiresInMinutes: expiresInMinutes > 0 ? expiresInMinutes : null,
  }
}

export function TokenManager({ session }: TokenManagerProps) {
  const [tokens, setTokens] = useState<ManagedToken[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [form, setForm] = useState<TokenFormState>(emptyForm)
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [resourceOptions, setResourceOptions] = useState<string[]>([])
  const [permissionFilters, setPermissionFilters] = useState<PermissionFilters>(
    defaultPermissionFilters
  )
  const [loadingCatalog, setLoadingCatalog] = useState(false)

  const [detailToken, setDetailToken] = useState<ManagedToken | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [refreshTarget, setRefreshTarget] = useState<ManagedToken | null>(null)
  const [extendMinutes, setExtendMinutes] = useState("")
  const [revokeTarget, setRevokeTarget] = useState<ManagedToken | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ManagedToken | null>(null)
  const [permissionTarget, setPermissionTarget] = useState<ManagedToken | null>(null)
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])
  const [generatedToken, setGeneratedToken] = useState<{
    title: string
    rawJwt: string
    expiresAt?: string | null
  } | null>(null)

  const token = session?.accessToken ?? ""
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const isAdmin = session?.role?.toLowerCase() === "admin"
  const selectedPermissionSet = useMemo(
    () => new Set(selectedPermissionIds),
    [selectedPermissionIds]
  )
  const formPermissionSet = useMemo(
    () => new Set(form.permissionIds),
    [form.permissionIds]
  )

  const filteredPermissions = useMemo(() => {
    let result = permissions

    if (permissionFilters.search) {
      const query = permissionFilters.search.toLowerCase()
      result = result.filter(
        (permission) =>
          permission.permissionName?.toLowerCase().includes(query) ||
          permission.permissionCode?.toLowerCase().includes(query) ||
          permission.endpoint?.toLowerCase().includes(query) ||
          permission.description?.toLowerCase().includes(query)
      )
    }

    if (permissionFilters.method.length > 0) {
      result = result.filter(
        (permission) =>
          permission.method && permissionFilters.method.includes(permission.method)
      )
    }

    if (permissionFilters.type.length === 1) {
      const wantSystem = permissionFilters.type[0] === "system"
      result = result.filter((permission) => permission.isSystem === wantSystem)
    }

    if (permissionFilters.status.length === 1) {
      const wantActive = permissionFilters.status[0] === "active"
      result = result.filter((permission) => permission.isActive === wantActive)
    }

    if (permissionFilters.resource) {
      result = result.filter((permission) =>
        permission.permissionCode?.startsWith(permissionFilters.resource + ":")
      )
    }

    if (permissionFilters.isAdmin === "admin") {
      result = result.filter((permission) =>
        permission.permissionCode?.endsWith(":admin")
      )
    } else if (permissionFilters.isAdmin === "non-admin") {
      result = result.filter(
        (permission) => !permission.permissionCode?.endsWith(":admin")
      )
    }

    return result
  }, [permissionFilters, permissions])

  useEffect(() => {
    if (!session) return

    let ignore = false

    async function loadTokens() {
      setLoading(true)
      setError(null)

      try {
        const result = await getTokens({
          token,
          page,
          pageSize,
          isRevoked:
            statusFilter === "all" ? undefined : statusFilter === "revoked",
        })

        if (!ignore) {
          setTokens(result.items)
          setTotal(result.totalCount)
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to load tokens.")
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadTokens()

    return () => {
      ignore = true
    }
  }, [page, pageSize, refreshKey, session, statusFilter, token])

  async function loadCatalog() {
    setLoadingCatalog(true)

    try {
      const [permissionResult, resources, accountResult] = await Promise.all([
        getPermissions({ token, page: 1, pageSize: 100 }),
        getPermissionResources(token),
        getAccounts({ token, page: 1, pageSize: 100 }),
      ])

      setPermissions(permissionResult.items)
      setResourceOptions(resources)
      setAccounts(accountResult.items)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load token form data.")
    } finally {
      setLoadingCatalog(false)
    }
  }

  async function openCreateDialog() {
    setForm({ ...emptyForm, accountId: session?.accountId ?? "" })
    setPermissionFilters(defaultPermissionFilters)
    setIsCreateOpen(true)
    await loadCatalog()
  }

  function closeCreateDialog() {
    setIsCreateOpen(false)
    setForm(emptyForm)
    setPermissionFilters(defaultPermissionFilters)
  }

  function applyStatusFilter(next: StatusFilter) {
    setStatusFilter(next)
    setPage(1)
  }

  const handleAccountChange = useCallback(async (accountId: string) => {
    if (!accountId) return
    try {
      const perms = await getAccountPermissions(token, accountId)
      const ids = perms.map((p) => p.permissionId)
      setForm((current) => ({
        ...current,
        permissionIds: ids,
      }))
    } catch {
      // ignore — permissions will stay as-is
    }
  }, [token])

  function toggleFormPermission(permissionId: string, checked: boolean) {
    setForm((current) => {
      if (checked) {
        return current.permissionIds.includes(permissionId)
          ? current
          : { ...current, permissionIds: [...current.permissionIds, permissionId] }
      }

      return {
        ...current,
        permissionIds: current.permissionIds.filter((id) => id !== permissionId),
      }
    })
  }

  function toggleSelectedPermission(permissionId: string, checked: boolean) {
    setSelectedPermissionIds((current) => {
      if (checked) {
        return current.includes(permissionId) ? current : [...current, permissionId]
      }

      return current.filter((id) => id !== permissionId)
    })
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload = toPayload(form)
    if (!payload.accountId) {
      toast.error("Account is required.")
      return
    }

    setSaving(true)

    try {
      const result = await createToken(token, payload)
      toast.success("Token created.")
      closeCreateDialog()
      setGeneratedToken({
        title: "Token created",
        rawJwt: result.rawJwt,
        expiresAt: result.expiresAt,
      })
      setRefreshKey((value) => value + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create token.")
    } finally {
      setSaving(false)
    }
  }

  async function openDetailDialog(item: ManagedToken) {
    setDetailToken(item)
    setLoadingDetail(true)

    try {
      setDetailToken(await getToken(token, item.id))
    } catch {
      // keep row data
    } finally {
      setLoadingDetail(false)
    }
  }

  async function openPermissionDialog(item: ManagedToken) {
    setPermissionTarget(item)
    setSelectedPermissionIds(item.permissions.map((permission) => permission.permissionId))
    setPermissionFilters(defaultPermissionFilters)
    setLoadingCatalog(true)

    try {
      const [freshToken, permissionResult, resources] = await Promise.all([
        getToken(token, item.id),
        getPermissions({ token, page: 1, pageSize: 100 }),
        getPermissionResources(token),
      ])

      setPermissionTarget(freshToken)
      setSelectedPermissionIds(
        freshToken.permissions.map((permission) => permission.permissionId)
      )
      setPermissions(permissionResult.items)
      setResourceOptions(resources)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load token permissions.")
    } finally {
      setLoadingCatalog(false)
    }
  }

  async function handleSavePermissions() {
    if (!permissionTarget) return

    const currentIds = new Set(
      permissionTarget.permissions.map((permission) => permission.permissionId)
    )
    const nextIds = new Set(selectedPermissionIds)
    const idsToAdd = [...nextIds].filter((id) => !currentIds.has(id))
    const idsToRemove = [...currentIds].filter((id) => !nextIds.has(id))

    if (idsToAdd.length === 0 && idsToRemove.length === 0) {
      toast.success("Token permissions already up to date.")
      return
    }

    setSaving(true)

    try {
      if (idsToAdd.length > 0) {
        await addTokenPermissions(token, permissionTarget.id, idsToAdd)
      }

      if (idsToRemove.length > 0) {
        await Promise.all(
          idsToRemove.map((permissionId) =>
            removeTokenPermission(token, permissionTarget.id, permissionId)
          )
        )
      }

      toast.success("Token permissions saved.")
      setPermissionTarget(null)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save token permissions.")
    } finally {
      setSaving(false)
    }
  }

  async function handleRefresh() {
    if (!refreshTarget) return

    const minutes = Number(extendMinutes || 0)
    setSaving(true)

    try {
      const result: RefreshTokenResponse = await refreshToken(
        token,
        refreshTarget.id,
        minutes > 0 ? minutes : null
      )
      toast.success("Token refreshed.")
      setGeneratedToken({
        title: "Token refreshed",
        rawJwt: result.rawJwt,
        expiresAt: result.expiresAt,
      })
      setRefreshTarget(null)
      setExtendMinutes("")
      setRefreshKey((value) => value + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to refresh token.")
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return

    setSaving(true)

    try {
      await revokeToken(token, revokeTarget.id)
      toast.success("Token revoked.")
      setRevokeTarget(null)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to revoke token.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return

    setSaving(true)

    try {
      await deleteToken(token, deleteTarget.id)
      toast.success("Token deleted.")
      setDeleteTarget(null)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete token.")
    } finally {
      setSaving(false)
    }
  }

  async function copyGeneratedToken() {
    if (!generatedToken) return

    try {
      await navigator.clipboard.writeText(generatedToken.rawJwt)
      toast.success("Token copied to clipboard.")
    } catch {
      toast.error("Unable to copy token.")
    }
  }

  if (!session) {
    return (
      <Card className="rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-base">Token Manager</CardTitle>
          <CardDescription>AuthModule session required</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-sm text-muted-foreground">
            Sign in to manage long-lived tokens.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
            <Fingerprint className="h-4 w-4" />
            AuthModule tokens
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            Token Management
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
            title="Refresh tokens"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Token
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
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-base">Tokens</CardTitle>
              <CardDescription>
                {numberFormatter.format(total)} token{total !== 1 ? "s" : ""} total
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "active", "revoked"] as StatusFilter[]).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => applyStatusFilter(status)}
                >
                  {status === "all"
                    ? "All"
                    : status === "active"
                    ? "Active"
                    : "Revoked"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Token</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Permissions</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted-foreground" colSpan={7}>
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Loading tokens
                    </td>
                  </tr>
                ) : tokens.length === 0 ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted-foreground" colSpan={7}>
                      No tokens found
                    </td>
                  </tr>
                ) : (
                  tokens.map((item) => (
                    <tr key={item.id} className="border-b transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                            <Fingerprint className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-mono text-xs font-medium">
                              {item.id}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline">{item.tokenType}</Badge>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="max-w-[240px] truncate font-medium">
                              {tokenOwner(item)}
                            </div>
                            <div className="truncate font-mono text-xs text-muted-foreground">
                              {item.accountId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{tokenStateBadge(item)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <Badge
                            variant="outline"
                            className="w-fit border-amber-200 bg-amber-50 text-amber-700"
                          >
                            {item.permissions.length} permission
                            {item.permissions.length !== 1 ? "s" : ""}
                          </Badge>
                          {item.permissions.length > 0 ? (
                            <div className="flex max-w-[360px] flex-wrap gap-1">
                              {item.permissions.slice(0, 3).map((permission) => (
                                <Badge
                                  key={permission.permissionId}
                                  variant="secondary"
                                  className="max-w-[170px] truncate font-mono text-[11px]"
                                >
                                  {permission.permissionCode ??
                                    permission.permissionName ??
                                    permission.permissionId}
                                </Badge>
                              ))}
                              {item.permissions.length > 3 ? (
                                <Badge variant="outline" className="text-[11px]">
                                  +{item.permissions.length - 3}
                                </Badge>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(item.expiresAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDetailDialog(item)}
                            title="View token details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!item.isRevoked ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openPermissionDialog(item)}
                                title="Manage token permissions"
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setRefreshTarget(item)
                                  setExtendMinutes("")
                                }}
                                title="Refresh token"
                              >
                                <RotateCw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setRevokeTarget(item)}
                                title="Revoke token"
                              >
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(item)}
                              title="Delete revoked token"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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
              Page {page} of {totalPages} &nbsp;&middot;&nbsp;{" "}
              {numberFormatter.format(total)} total
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

      <CreateTokenDialog
        open={isCreateOpen}
        form={form}
        accounts={accounts}
        permissions={filteredPermissions}
        formPermissionSet={formPermissionSet}
        permissionFilters={permissionFilters}
        resourceOptions={resourceOptions}
        loadingCatalog={loadingCatalog}
        saving={saving}
        isAdmin={isAdmin}
        session={session}
        onClose={closeCreateDialog}
        onFormChange={setForm}
        onFiltersChange={setPermissionFilters}
        onTogglePermission={toggleFormPermission}
        onSubmit={handleCreate}
        onAccountChange={handleAccountChange}
      />

      <TokenDetailDialog
        token={detailToken}
        loading={loadingDetail}
        onClose={() => setDetailToken(null)}
        onPermissions={(item) => {
          setDetailToken(null)
          openPermissionDialog(item)
        }}
      />

      <ManageTokenPermissionsDialog
        token={permissionTarget}
        permissions={filteredPermissions}
        selectedPermissionSet={selectedPermissionSet}
        permissionFilters={permissionFilters}
        resourceOptions={resourceOptions}
        loadingCatalog={loadingCatalog}
        saving={saving}
        onClose={() => setPermissionTarget(null)}
        onFiltersChange={setPermissionFilters}
        onTogglePermission={toggleSelectedPermission}
        onSave={handleSavePermissions}
      />

      <Dialog
        open={Boolean(refreshTarget)}
        onOpenChange={(open) => !open && setRefreshTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refresh Token</DialogTitle>
            <DialogDescription>
              Rotate this token hash. The new raw token is shown once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="extend-minutes">Extend minutes</Label>
            <Input
              id="extend-minutes"
              type="number"
              min="0"
              step="1"
              value={extendMinutes}
              onChange={(event) => setExtendMinutes(event.target.value)}
              placeholder="Leave empty to keep current expiry"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={handleRefresh} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
              Refresh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmTokenDialog
        token={revokeTarget}
        title="Revoke Token"
        description="This token will stop working immediately."
        actionLabel="Revoke"
        saving={saving}
        icon="revoke"
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
      />

      <ConfirmTokenDialog
        token={deleteTarget}
        title="Delete Token"
        description="This permanently deletes a revoked token and its permissions."
        actionLabel="Delete"
        saving={saving}
        icon="delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <Dialog
        open={Boolean(generatedToken)}
        onOpenChange={(open) => !open && setGeneratedToken(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{generatedToken?.title}</DialogTitle>
            <DialogDescription>
              Copy this raw JWT now. The server will not show it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              readOnly
              value={generatedToken?.rawJwt ?? ""}
              className="min-h-40 resize-none font-mono text-xs"
            />
            <div className="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Expires: {formatDate(generatedToken?.expiresAt)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copyGeneratedToken}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button onClick={() => setGeneratedToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateTokenDialog({
  open,
  form,
  accounts,
  permissions,
  formPermissionSet,
  permissionFilters,
  resourceOptions,
  loadingCatalog,
  saving,
  isAdmin,
  session,
  onClose,
  onFormChange,
  onFiltersChange,
  onTogglePermission,
  onSubmit,
  onAccountChange,
}: {
  open: boolean
  form: TokenFormState
  accounts: UserAccount[]
  permissions: Permission[]
  formPermissionSet: Set<string>
  permissionFilters: PermissionFilters
  resourceOptions: string[]
  loadingCatalog: boolean
  saving: boolean
  isAdmin: boolean
  session: LoginResponse
  onClose: () => void
  onFormChange: (form: TokenFormState) => void
  onFiltersChange: (filters: PermissionFilters) => void
  onTogglePermission: (permissionId: string, checked: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onAccountChange: (accountId: string) => void
}) {
  useEffect(() => {
    if (form.accountId) {
      onAccountChange(form.accountId)
    }
  }, [form.accountId, onAccountChange])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Create Token</DialogTitle>
          <DialogDescription>
            Generate a long-lived bearer token for an account.
          </DialogDescription>
        </DialogHeader>
        <form className="min-h-0 flex-1 overflow-y-auto" onSubmit={onSubmit}>
          <div className="grid gap-5 p-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token-account">Account</Label>
                {isAdmin && accounts.length > 0 ? (
                  <select
                    id="token-account"
                    className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.accountId}
                    onChange={(event) =>
                      onFormChange({ ...form, accountId: event.target.value })
                    }
                  >
                    {accounts.map((account) => (
                      <option key={account.accountId} value={account.accountId}>
                        {account.fullName || account.email} ({account.role})
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input value={form.accountId || session.accountId} readOnly />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="token-expiry">Expires in minutes</Label>
                <Input
                  id="token-expiry"
                  min="1"
                  step="1"
                  type="number"
                  value={form.expiresInMinutes}
                  onChange={(event) =>
                    onFormChange({ ...form, expiresInMinutes: event.target.value })
                  }
                  placeholder="Blank means no token row expiry"
                />
              </div>
              <div className="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-700">
                The raw JWT is shown once after creation.
              </div>
            </div>

            <PermissionPicker
              permissions={permissions}
              selectedPermissionSet={formPermissionSet}
              permissionFilters={permissionFilters}
              resourceOptions={resourceOptions}
              loading={loadingCatalog}
              onFiltersChange={onFiltersChange}
              onTogglePermission={onTogglePermission}
            />
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.accountId}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PermissionPicker({
  permissions,
  selectedPermissionSet,
  permissionFilters,
  resourceOptions,
  loading,
  onFiltersChange,
  onTogglePermission,
}: {
  permissions: Permission[]
  selectedPermissionSet: Set<string>
  permissionFilters: PermissionFilters
  resourceOptions: string[]
  loading: boolean
  onFiltersChange: (filters: PermissionFilters) => void
  onTogglePermission: (permissionId: string, checked: boolean) => void
}) {
  return (
    <div className="space-y-2">
      <PermissionSearchBox
        value={permissionFilters}
        onChange={onFiltersChange}
        resourceOptions={resourceOptions}
        totalResults={permissions.length}
        loading={loading}
      />
      <div className="max-h-[430px] overflow-y-auto rounded-md border">
        {loading ? (
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
              const checked = selectedPermissionSet.has(permission.id)

              return (
                <label
                  key={permission.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 px-3 py-1.5 transition-colors hover:bg-muted/30",
                    checked && "bg-amber-50/60"
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      onTogglePermission(permission.id, value === true)
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium leading-tight">{permissionTitle(permission)}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {permissionScopeLabel(permission)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge className={cn("shrink-0 text-[10px]", methodClass(permission.method))}>
                        {permission.method ?? "ANY"}
                      </Badge>
                      {permission.isSystem && (
                        <Badge variant="secondary" className="py-0 text-[10px]">System</Badge>
                      )}
                      {permission.isPublic && (
                        <Badge variant="outline" className="py-0 text-[10px]">Public</Badge>
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
    </div>
  )
}

function TokenDetailDialog({
  token,
  loading,
  onClose,
  onPermissions,
}: {
  token: ManagedToken | null
  loading: boolean
  onClose: () => void
  onPermissions: (token: ManagedToken) => void
}) {
  return (
    <Dialog open={token !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Token Details</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {token?.id}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Loading token
            </div>
          ) : token ? (
            <div className="space-y-5 p-6">
              <div className="grid gap-4 rounded-md border bg-muted/20 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Owner</p>
                  <p className="mt-1 truncate font-medium">{tokenOwner(token)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">{tokenStateBadge(token)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p className="mt-1 font-medium">{formatDate(token.expiresAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Token type</p>
                  <p className="mt-1 font-medium">{token.tokenType}</p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Permissions</div>
                    <div className="text-xs text-muted-foreground">
                      {token.permissions.length} assigned
                    </div>
                  </div>
                  {!token.isRevoked ? (
                    <Button size="sm" variant="outline" onClick={() => onPermissions(token)}>
                      <KeyRound className="h-4 w-4" />
                      Manage
                    </Button>
                  ) : null}
                </div>
                <div className="max-h-72 overflow-y-auto rounded-md border">
                  {token.permissions.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No permissions assigned
                    </div>
                  ) : (
                    <div className="divide-y">
                      {token.permissions.map((permission) => (
                        <div key={permission.permissionId} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {permission.permissionName ??
                                permission.permissionCode ??
                                permission.permissionId}
                            </span>
                            <Badge className={methodClass(permission.method)}>
                              {permission.method ?? "ANY"}
                            </Badge>
                          </div>
                          <div className="mt-1 font-mono text-xs text-muted-foreground">
                            {permission.endpoint ?? permission.permissionCode ?? "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ManageTokenPermissionsDialog({
  token,
  permissions,
  selectedPermissionSet,
  permissionFilters,
  resourceOptions,
  loadingCatalog,
  saving,
  onClose,
  onFiltersChange,
  onTogglePermission,
  onSave,
}: {
  token: ManagedToken | null
  permissions: Permission[]
  selectedPermissionSet: Set<string>
  permissionFilters: PermissionFilters
  resourceOptions: string[]
  loadingCatalog: boolean
  saving: boolean
  onClose: () => void
  onFiltersChange: (filters: PermissionFilters) => void
  onTogglePermission: (permissionId: string, checked: boolean) => void
  onSave: () => void
}) {
  return (
    <Dialog open={token !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Manage Token Permissions</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {token?.id}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto p-6">
          <PermissionPicker
            permissions={permissions}
            selectedPermissionSet={selectedPermissionSet}
            permissionFilters={permissionFilters}
            resourceOptions={resourceOptions}
            loading={loadingCatalog}
            onFiltersChange={onFiltersChange}
            onTogglePermission={onTogglePermission}
          />
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving || token?.isRevoked}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmTokenDialog({
  token,
  title,
  description,
  actionLabel,
  saving,
  icon,
  onClose,
  onConfirm,
}: {
  token: ManagedToken | null
  title: string
  description: string
  actionLabel: string
  saving: boolean
  icon: "revoke" | "delete"
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={token !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
            <span className="mt-2 block truncate font-mono text-xs">
              {token?.id}
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : icon === "delete" ? (
              <Trash2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
