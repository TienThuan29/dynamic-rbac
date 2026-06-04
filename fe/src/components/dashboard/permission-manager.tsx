import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import {
  AlertCircle,
  Crown,
  Edit2,
  Loader2,
  RefreshCw,
  Save,
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
import { PermissionSearchBox, type PermissionFilters } from "@/components/permission-search-box"
import {
  deletePermission,
  getPermissionResources,
  getPermissions,
  updatePermission,
} from "@/api/permission.api"
import { permissionScopeLabel } from "@/lib/permission.util"
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
  const [filters, setFilters] = useState<PermissionFilters>({
    search: "",
    method: [],
    type: [],
    status: [],
    resource: "",
    isAdmin: "",
  })
  const [resourceOptions, setResourceOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [editDialog, setEditDialog] = useState<EditDialogState>({
    permission: null,
    permissionName: "",
    permissionCode: "",
    description: "",
    isActive: true,
  })
  const [saving, setSaving] = useState(false)

  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({ permission: null })
  const [deleting, setDeleting] = useState(false)

  const token = session?.accessToken ?? ""
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    if (!token) return
    let ignore = false
    getPermissionResources(token)
      .then((resources) => { if (!ignore) setResourceOptions(resources) })
      .catch(() => {})
    return () => { ignore = true }
  }, [token])

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
          search: filters.search || undefined,
          method: filters.method.length === 1 ? filters.method[0] : undefined,
          isSystem:
            filters.type.length === 1
              ? filters.type[0] === "system"
              : undefined,
          isActive:
            filters.status.length === 1
              ? filters.status[0] === "active"
              : undefined,
          resource: filters.resource || undefined,
        })

        if (!ignore) {
          const items =
            filters.isAdmin === "admin"
              ? result.items.filter((p) => p.permissionCode?.endsWith(":admin"))
              : filters.isAdmin === "non-admin"
              ? result.items.filter((p) => !p.permissionCode?.endsWith(":admin"))
              : result.items
          setPermissions(items)
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
  }, [page, pageSize, refreshKey, filters, session, token])

  function handleFiltersChange(newFilters: PermissionFilters) {
    setFilters(newFilters)
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
  }

  function closeEditDialog() {
    setEditDialog({
      permission: null,
      permissionName: "",
      permissionCode: "",
      description: "",
      isActive: true,
    })
  }

  async function handleSaveEdit() {
    if (!token || !editDialog.permission) return

    const payload: UpdatePermissionPayload = {
      permissionName: editDialog.permissionName || null,
      description: editDialog.description || null,
      isActive: editDialog.isActive,
    }

    if (!editDialog.permission.isSystem) {
      payload.permissionCode = editDialog.permissionCode || null
    }

    setSaving(true)

    try {
      await updatePermission(token, editDialog.permission.id, payload)
      toast.success(`Permission "${permissionTitle(editDialog.permission)}" updated.`)
      closeEditDialog()
      setRefreshKey((value) => value + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update permission.")
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
      toast.success(`Permission deleted.`)
      closeDeleteDialog()
      setRefreshKey((value) => value + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete permission.")
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

      {/* Alerts */}
      {error ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      {/* Table */}
      <Card className="rounded-lg">
        <CardHeader className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Permission Catalog</CardTitle>
              <CardDescription>
                {filters.search
                  ? `Searching: "${filters.search}"`
                  : "Browse and manage permission records"}
              </CardDescription>
            </div>
          </div>
          <PermissionSearchBox
            value={filters}
            onChange={handleFiltersChange}
            totalResults={total}
            loading={loading}
            resourceOptions={resourceOptions}
            className="mt-3"
          />
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
                                      Admin
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
                            <code className="font-mono text-xs">{permissionScopeLabel(permission)}</code>
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

      <EditPermissionDialog
        state={editDialog}
        saving={saving}
        onChange={setEditDialog}
        onSave={handleSaveEdit}
        onClose={closeEditDialog}
      />

      <DeletePermissionDialog
        state={deleteDialog}
        deleting={deleting}
        onConfirm={handleConfirmDelete}
        onClose={closeDeleteDialog}
      />
    </div>
  )
}


// ─── Edit Dialog ────────────────────────────────────────────────────────────

interface EditPermissionDialogProps {
  state: EditDialogState
  saving: boolean
  onChange: (state: EditDialogState) => void
  onSave: () => void
  onClose: () => void
}

function EditPermissionDialog({
  state,
  saving,
  onChange,
  onSave,
  onClose,
}: EditPermissionDialogProps) {
  const perm = state.permission
  const isAdmin = perm ? isAdminPermission(perm) : false

  return (
    <Dialog
      open={perm !== null}
      onOpenChange={(open) => { if (!open) onClose() }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-sky-600" />
            Edit Permission
          </DialogTitle>
          <DialogDescription>
            Modify metadata for{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              {perm?.permissionCode ?? perm?.id}
            </code>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_1.6fr] gap-5 pt-1">
          {/* ── Left: read-only current details ── */}
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current Details
            </p>

            <div className="space-y-3 text-sm">
              <div>
                <p className="mb-0.5 text-xs text-muted-foreground">Code</p>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
                  {perm?.permissionCode ?? "—"}
                </code>
              </div>

              <div>
                <p className="mb-0.5 text-xs text-muted-foreground">Method</p>
                {perm?.method ? (
                  <Badge className={cn("text-xs", methodClass(perm.method))}>
                    {perm.method}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">ANY</span>
                )}
              </div>

              <div>
                <p className="mb-0.5 text-xs text-muted-foreground">Endpoint / Scope</p>
                <code className="font-mono text-xs text-foreground/80">
                  {perm ? permissionScopeLabel(perm) : "—"}
                </code>
              </div>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">Flags</p>
                <div className="flex flex-wrap gap-1">
                  {perm?.isSystem && (
                    <Badge variant="secondary" className="text-xs">System</Badge>
                  )}
                  {perm?.isPublic && (
                    <Badge variant="outline" className="text-xs">Public</Badge>
                  )}
                  {isAdmin && (
                    <Badge
                      variant="outline"
                      className="border-violet-200 bg-violet-50 text-violet-700 text-xs"
                    >
                      Admin
                    </Badge>
                  )}
                  {!perm?.isSystem && !perm?.isPublic && !isAdmin && (
                    <span className="text-xs text-muted-foreground">None</span>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-0.5 text-xs text-muted-foreground">Created</p>
                <p className="text-xs">{formatDate(perm?.createdAt)}</p>
              </div>
            </div>

            {perm?.isSystem && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                System permission — code cannot be changed.
              </div>
            )}
          </div>

          {/* ── Right: edit form ── */}
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Edit Fields
            </p>

            <div className="grid gap-1.5">
              <Label htmlFor="perm-name">Permission Name</Label>
              <Input
                id="perm-name"
                value={state.permissionName}
                onChange={(e) => onChange({ ...state, permissionName: e.target.value })}
                placeholder="e.g. View products"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="perm-code">Permission Code</Label>
              <Input
                id="perm-code"
                value={state.permissionCode}
                onChange={(e) => onChange({ ...state, permissionCode: e.target.value })}
                placeholder="e.g. products:read"
                disabled={perm?.isSystem}
              />
              {perm?.isSystem && (
                <p className="text-xs text-muted-foreground">
                  Cannot edit code for system permissions.
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="perm-desc">Description</Label>
              <Textarea
                id="perm-desc"
                value={state.description}
                onChange={(e) => onChange({ ...state, description: e.target.value })}
                placeholder="Optional description..."
                className="min-h-22.5 resize-none"
              />
            </div>

            <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
              <input
                type="checkbox"
                id="perm-active"
                className="h-4 w-4 rounded border-input accent-primary"
                checked={state.isActive}
                onChange={(e) => onChange({ ...state, isActive: e.target.checked })}
              />
              <div>
                <Label htmlFor="perm-active" className="cursor-pointer font-medium">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  {state.isActive
                    ? "This permission is currently active."
                    : "This permission is disabled."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Dialog ───────────────────────────────────────────────────────────

interface DeletePermissionDialogProps {
  state: DeleteDialogState
  deleting: boolean
  onConfirm: () => void
  onClose: () => void
}

function DeletePermissionDialog({
  state,
  deleting,
  onConfirm,
  onClose,
}: DeletePermissionDialogProps) {
  return (
    <Dialog
      open={state.permission !== null}
      onOpenChange={(open) => { if (!open) onClose() }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Permission</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong>
              {state.permission ? permissionTitle(state.permission) : "this permission"}
            </strong>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
