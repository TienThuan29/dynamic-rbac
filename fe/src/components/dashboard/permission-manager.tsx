import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Edit2,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  deletePermission,
  getPermissions,
  updatePermission,
} from "@/api/api"
import { cn } from "@/lib/utils"
import type { LoginResponse, Permission, UpdatePermissionPayload } from "@/types/api"

const numberFormatter = new Intl.NumberFormat("en-US")

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

function formatDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

function isAdminPermission(permission: Permission) {
  return (
    permission.permissionCode?.endsWith(":admin") &&
    permission.method === null &&
    permission.endpoint === null
  )
}

export type PermissionManagerProps = {
  session: LoginResponse | null
}

interface EditDialogState {
  permission: Permission | null
  permissionName: string
  permissionCode: string
  description: string
  isActive: boolean
}

interface DeleteDialogState {
  permission: Permission | null
}

export function PermissionManager({ session }: PermissionManagerProps) {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)
  const [searchDraft, setSearchDraft] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [editDialog, setEditDialog] = useState<EditDialogState>({
    permission: null,
    permissionName: "",
    permissionCode: "",
    description: "",
    isActive: true,
  })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({ permission: null })
  const [deleting, setDeleting] = useState(false)

  const token = session?.accessToken ?? ""
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const adminCount = useMemo(
    () => permissions.filter(isAdminPermission).length,
    [permissions]
  )
  const systemCount = useMemo(
    () => permissions.filter((p) => p.isSystem).length,
    [permissions]
  )
  const activeCount = useMemo(
    () => permissions.filter((p) => p.isActive).length,
    [permissions]
  )

  useEffect(() => {
    if (!session) return

    let ignore = false

    async function loadPermissions() {
      setLoading(true)
      setError(null)

      try {
        const result = await getPermissions({
          token,
          page,
          pageSize,
          search,
        })

        if (!ignore) {
          setPermissions(result.items)
          setTotal(result.totalCount)
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to load permissions.")
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadPermissions()

    return () => {
      ignore = true
    }
  }, [page, pageSize, refreshKey, search, session, token])

  function applySearch() {
    setSearch(searchDraft.trim())
    setPage(1)
  }

  function openEditDialog(permission: Permission) {
    setEditDialog({
      permission,
      permissionName: permission.permissionName ?? "",
      permissionCode: permission.permissionCode ?? "",
      description: permission.description ?? "",
      isActive: permission.isActive,
    })
    setEditError(null)
  }

  function closeEditDialog() {
    setEditDialog({
      permission: null,
      permissionName: "",
      permissionCode: "",
      description: "",
      isActive: true,
    })
    setEditError(null)
  }

  async function handleSaveEdit() {
    if (!token || !editDialog.permission) return

    const payload: UpdatePermissionPayload = {
      permissionName: editDialog.permissionName || null,
      permissionCode: editDialog.permissionCode || null,
      description: editDialog.description || null,
      isActive: editDialog.isActive,
    }

    setSaving(true)
    setEditError(null)

    try {
      await updatePermission(token, editDialog.permission.id, payload)
      setNotice(`Permission "${permissionTitle(editDialog.permission)}" updated.`)
      closeEditDialog()
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Unable to update permission.")
    } finally {
      setSaving(false)
    }
  }

  function openDeleteDialog(permission: Permission) {
    setDeleteDialog({ permission })
  }

  function closeDeleteDialog() {
    setDeleteDialog({ permission: null })
  }

  async function handleConfirmDelete() {
    if (!token || !deleteDialog.permission) return

    setDeleting(true)

    try {
      await deletePermission(token, deleteDialog.permission.id)
      setNotice(`Permission deleted.`)
      closeDeleteDialog()
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete permission.")
      closeDeleteDialog()
    } finally {
      setDeleting(false)
    }
  }

  if (!session) {
    return (
      <Card className="rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-base">Permission Manager</CardTitle>
          <CardDescription>AuthModule session required</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-sm text-muted-foreground">Sign in to manage permissions.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-sky-700">
            <Shield className="h-4 w-4" />
            AuthModule permissions
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            Permission Manager
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
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total permissions
            </CardTitle>
            <Shield className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold">{numberFormatter.format(total)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold">{numberFormatter.format(activeCount)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System entries
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold">{numberFormatter.format(systemCount)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Admin wildcards
            </CardTitle>
            <Crown className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold">{numberFormatter.format(adminCount)}</div>
            <p className="mt-1 text-xs text-muted-foreground">Full resource access</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
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

      {/* Table */}
      <Card className="rounded-lg">
        <CardHeader className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Permission Catalog</CardTitle>
              <CardDescription>
                {search ? `Searching: "${search}"` : "Browse and manage permission records"}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch()
                }}
                placeholder="Search permissions..."
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Permission
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Method
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Endpoint
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Created
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {permissions.map((permission) => {
                      const isAdmin = isAdminPermission(permission)

                      return (
                        <tr
                          key={permission.id}
                          className={cn(
                            "transition-colors hover:bg-muted/20",
                            isAdmin && "bg-violet-50/40"
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              {isAdmin && (
                                <Crown className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                              )}
                              <div>
                                <div className="font-medium">
                                  {permission.permissionName || (
                                    <span className="text-muted-foreground italic">No name</span>
                                  )}
                                </div>
                                {permission.description ? (
                                  <div className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                                    {permission.description}
                                  </div>
                                ) : null}
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {permission.isPublic && (
                                    <Badge variant="outline" className="text-xs">
                                      Public
                                    </Badge>
                                  )}
                                  {permission.isSystem && (
                                    <Badge variant="secondary" className="text-xs">
                                      System
                                    </Badge>
                                  )}
                                  {isAdmin && (
                                    <Badge
                                      variant="outline"
                                      className="border-violet-200 bg-violet-50 text-violet-700 text-xs"
                                    >
                                      Admin wildcard
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-xs">
                              {permission.permissionCode ?? "—"}
                            </code>
                          </td>
                          <td className="px-4 py-3">
                            {permission.method ? (
                              <Badge className={cn("text-xs", methodClass(permission.method))}>
                                {permission.method}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">ANY</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {permission.endpoint ? (
                              <code className="font-mono text-xs">{permission.endpoint}</code>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">All endpoints</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "text-xs font-medium",
                                permission.isActive ? "text-emerald-600" : "text-destructive"
                              )}
                            >
                              {permission.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {formatDate(permission.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(permission)}
                                title="Edit permission"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              {!permission.isSystem && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDeleteDialog(permission)}
                                  className="text-destructive hover:text-destructive"
                                  title="Delete permission"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} &nbsp;&middot;&nbsp; {numberFormatter.format(total)} total
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={editDialog.permission !== null}
        onOpenChange={(open) => {
          if (!open) closeEditDialog()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Permission</DialogTitle>
            <DialogDescription>
              Update metadata for{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">
                {editDialog.permission?.permissionCode ?? editDialog.permission?.id}
              </code>
            </DialogDescription>
          </DialogHeader>

          {editDialog.permission?.isSystem && (
            <div className="rounded-md border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This is a system permission — code, method, and endpoint cannot be changed.
            </div>
          )}

          {editError ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {editError}
            </div>
          ) : null}

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="perm-name">Permission Name</Label>
              <Input
                id="perm-name"
                value={editDialog.permissionName}
                onChange={(e) =>
                  setEditDialog((prev) => ({
                    ...prev,
                    permissionName: e.target.value,
                  }))
                }
                placeholder="e.g. View products"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="perm-code">Permission Code</Label>
              <Input
                id="perm-code"
                value={editDialog.permissionCode}
                onChange={(e) =>
                  setEditDialog((prev) => ({
                    ...prev,
                    permissionCode: e.target.value,
                  }))
                }
                placeholder="e.g. products:read"
                disabled={editDialog.permission?.isSystem}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="perm-desc">Description</Label>
              <Textarea
                id="perm-desc"
                value={editDialog.description}
                onChange={(e) =>
                  setEditDialog((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Optional description..."
                className="min-h-20 resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="perm-active"
                className="h-4 w-4 rounded border-input accent-primary"
                checked={editDialog.isActive}
                onChange={(e) =>
                  setEditDialog((prev) => ({
                    ...prev,
                    isActive: e.target.checked,
                  }))
                }
              />
              <Label htmlFor="perm-active" className="font-normal">
                Active
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.permission !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Permission</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {permissionTitle(deleteDialog.permission!)}
              </strong>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
