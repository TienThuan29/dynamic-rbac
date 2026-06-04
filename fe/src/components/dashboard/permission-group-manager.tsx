import { useEffect, useMemo, useState, type FormEvent } from "react"
import toast from "react-hot-toast"
import {
  AlertCircle,
  Crown,
  Edit2,
  Eye,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
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
import {
  PermissionSearchBox,
  type PermissionFilters,
} from "@/components/permission-search-box"
import {
  createPermissionGroup,
  deletePermissionGroup,
  getPermissionGroup,
  getPermissionGroups,
  getPermissionResources,
  getPermissions,
  updatePermissionGroup,
} from "@/api/permission.api"
import { permissionScopeLabel } from "@/lib/permission.util"
import { cn } from "@/lib/utils"
import type {
  LoginResponse,
  Permission,
  PermissionGroup,
  PermissionGroupPayload,
} from "@/types/api"

const numberFormatter = new Intl.NumberFormat("en-US")

const emptyForm: PermissionGroupFormState = {
  groupName: "",
  description: "",
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

type PermissionGroupFormState = {
  groupName: string
  description: string
  permissionIds: string[]
}

export type PermissionGroupManagerProps = {
  session: LoginResponse | null
}

function formatDate(value?: string | null) {
  if (!value) return "—"
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

function permissionTitle(permission: Permission) {
  return (
    permission.permissionName ||
    permission.permissionCode ||
    permission.endpoint ||
    permission.id
  )
}

function isAdminPermission(permission: Permission) {
  return (
    permission.permissionCode?.endsWith(":admin") &&
    permission.method === null &&
    permission.endpoint === null
  )
}

function toForm(group: PermissionGroup): PermissionGroupFormState {
  return {
    groupName: group.groupName,
    description: group.description ?? "",
    permissionIds: group.permissionIds ?? group.permissions.map((p) => p.id),
  }
}

function toPayload(form: PermissionGroupFormState): PermissionGroupPayload {
  return {
    groupName: form.groupName.trim(),
    description: form.description.trim() || null,
    permissionIds: form.permissionIds,
  }
}

export function PermissionGroupManager({ session }: PermissionGroupManagerProps) {
  const [groups, setGroups] = useState<PermissionGroup[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [searchDraft, setSearchDraft] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null)
  const [form, setForm] = useState<PermissionGroupFormState>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<PermissionGroup | null>(null)
  const [viewTarget, setViewTarget] = useState<PermissionGroup | null>(null)

  const [permissions, setPermissions] = useState<Permission[]>([])
  const [resourceOptions, setResourceOptions] = useState<string[]>([])
  const [permissionFilters, setPermissionFilters] = useState<PermissionFilters>(
    defaultPermissionFilters
  )
  const [loadingPermissions, setLoadingPermissions] = useState(false)

  const token = session?.accessToken ?? ""
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const selectedPermissionSet = useMemo(
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

    async function loadGroups() {
      setLoading(true)
      setError(null)

      try {
        const result = await getPermissionGroups({
          token,
          page,
          pageSize,
          search: search || undefined,
        })

        if (!ignore) {
          setGroups(result.items)
          setTotal(result.totalCount)
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load permission groups."
          )
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadGroups()

    return () => {
      ignore = true
    }
  }, [page, pageSize, refreshKey, search, session, token])

  async function loadPermissionCatalog() {
    setLoadingPermissions(true)

    try {
      const [permissionResult, resources] = await Promise.all([
        getPermissions({ token, page: 1, pageSize: 100 }),
        getPermissionResources(token),
      ])
      setPermissions(permissionResult.items)
      setResourceOptions(resources)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to load permission catalog."
      )
    } finally {
      setLoadingPermissions(false)
    }
  }

  function applySearch() {
    setSearch(searchDraft.trim())
    setPage(1)
  }

  function clearSearch() {
    setSearchDraft("")
    setSearch("")
    setPage(1)
  }

  async function openCreateDialog() {
    setEditingGroup(null)
    setForm(emptyForm)
    setPermissionFilters(defaultPermissionFilters)
    setIsFormOpen(true)
    await loadPermissionCatalog()
  }

  async function openEditDialog(group: PermissionGroup) {
    setEditingGroup(group)
    setForm(toForm(group))
    setPermissionFilters(defaultPermissionFilters)
    setIsFormOpen(true)
    setLoadingPermissions(true)

    try {
      const [freshGroup, permissionResult, resources] = await Promise.all([
        getPermissionGroup(token, group.id),
        getPermissions({ token, page: 1, pageSize: 100 }),
        getPermissionResources(token),
      ])
      setEditingGroup(freshGroup)
      setForm(toForm(freshGroup))
      setPermissions(permissionResult.items)
      setResourceOptions(resources)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to load permission group."
      )
    } finally {
      setLoadingPermissions(false)
    }
  }

  function closeFormDialog() {
    setIsFormOpen(false)
    setEditingGroup(null)
    setForm(emptyForm)
    setPermissionFilters(defaultPermissionFilters)
  }

  function togglePermission(permissionId: string, checked: boolean) {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload = toPayload(form)
    if (!payload.groupName) {
      toast.error("Group name is required.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (editingGroup) {
        await updatePermissionGroup(token, editingGroup.id, payload)
        toast.success(`${payload.groupName} updated.`)
      } else {
        await createPermissionGroup(token, payload)
        toast.success(`${payload.groupName} created.`)
      }

      closeFormDialog()
      setRefreshKey((value) => value + 1)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to save permission group."
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return

    setSaving(true)
    setError(null)

    try {
      await deletePermissionGroup(token, deleteTarget.id)
      toast.success(`${deleteTarget.groupName} deleted.`)
      setDeleteTarget(null)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to delete permission group."
      )
    } finally {
      setSaving(false)
    }
  }

  if (!session) {
    return (
      <Card className="rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-base">Permission Group Manager</CardTitle>
          <CardDescription>AuthModule session required</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-sm text-muted-foreground">
            Sign in to manage permission groups.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-violet-700">
            <KeyRound className="h-4 w-4" />
            AuthModule permission groups
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            Permission Group Management
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
            title="Refresh permission groups"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Group
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
              <CardTitle className="text-base">Groups</CardTitle>
              <CardDescription>
                {numberFormatter.format(total)} group{total !== 1 ? "s" : ""} total
              </CardDescription>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applySearch()
                  }}
                  placeholder="Search group name or description"
                />
              </div>
              <Button variant="secondary" onClick={applySearch}>
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button variant="ghost" onClick={clearSearch}>
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 font-medium">Permissions</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      className="px-4 py-12 text-center text-muted-foreground"
                      colSpan={4}
                    >
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Loading permission groups
                    </td>
                  </tr>
                ) : groups.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-12 text-center text-muted-foreground"
                      colSpan={4}
                    >
                      No permission groups found
                    </td>
                  </tr>
                ) : (
                  groups.map((group) => (
                    <tr
                      key={group.id}
                      className="border-b transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-700">
                            <KeyRound className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {group.groupName}
                            </div>
                            <div className="mt-0.5 max-w-[420px] truncate text-xs text-muted-foreground">
                              {group.description || "No description"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <div>
                            <Badge
                              variant="outline"
                              className="border-violet-200 bg-violet-50 text-violet-700"
                            >
                              {group.permissionIds.length} permission
                              {group.permissionIds.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          {group.permissions.length > 0 ? (
                            <div className="flex max-w-[520px] flex-wrap gap-1">
                              {group.permissions.slice(0, 4).map((permission) => (
                                <Badge
                                  key={permission.id}
                                  variant="secondary"
                                  className="max-w-[180px] truncate font-mono text-[11px]"
                                >
                                  {permission.permissionCode ??
                                    permission.permissionName ??
                                    permission.id}
                                </Badge>
                              ))}
                              {group.permissions.length > 4 ? (
                                <Badge variant="outline" className="text-[11px]">
                                  +{group.permissions.length - 4}
                                </Badge>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Empty group
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(group.updatedAt ?? group.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewTarget(group)}
                            title="View permission group details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(group)}
                            title="Edit permission group"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(group)}
                            title="Delete permission group"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PermissionGroupDetailDialog
        group={viewTarget}
        onClose={() => setViewTarget(null)}
        onEdit={(group) => {
          setViewTarget(null)
          openEditDialog(group)
        }}
      />

      <PermissionGroupFormDialog
        key={isFormOpen ? editingGroup?.id ?? "new" : "closed"}
        open={isFormOpen}
        editingGroup={editingGroup}
        form={form}
        permissions={filteredPermissions}
        selectedPermissionSet={selectedPermissionSet}
        permissionFilters={permissionFilters}
        resourceOptions={resourceOptions}
        loadingPermissions={loadingPermissions}
        saving={saving}
        totalPermissions={permissions.length}
        onClose={closeFormDialog}
        onFormChange={setForm}
        onFiltersChange={setPermissionFilters}
        onTogglePermission={togglePermission}
        onSubmit={handleSubmit}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Permission Group</DialogTitle>
            <DialogDescription>
              {deleteTarget?.groupName} will be permanently removed. This does
              not delete the permissions inside the group.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Detail Dialog ──────────────────────────────────────────────────────────

function PermissionGroupDetailDialog({
  group,
  onClose,
  onEdit,
}: {
  group: PermissionGroup | null
  onClose: () => void
  onEdit: (group: PermissionGroup) => void
}) {
  return (
    <Dialog open={group !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-700">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate">{group?.groupName}</DialogTitle>
              <DialogDescription className="truncate">
                {group?.description || "No description"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-4 border-b px-6 py-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Permissions</p>
              <p className="mt-0.5 font-medium">{group?.permissionIds.length ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="mt-0.5 font-medium">{formatDate(group?.createdAt)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Last updated</p>
              <p className="mt-0.5 font-medium">{formatDate(group?.updatedAt ?? group?.createdAt)}</p>
            </div>
          </div>

          {/* Permissions list */}
          <div className="px-6 py-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Permissions in this group ({group?.permissions.length ?? 0})
            </p>
            {group?.permissions.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                This group has no permissions.
              </div>
            ) : (
              <div className="divide-y rounded-lg border">
                {group?.permissions.map((permission) => {
                  const isAdmin = isAdminPermission(permission)
                  return (
                    <div
                      key={permission.id}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2",
                        isAdmin && "bg-violet-50/30"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isAdmin && <Crown className="h-3.5 w-3.5 shrink-0 text-violet-600" />}
                          <Badge className={cn("shrink-0 text-[10px]", methodClass(permission.method))}>
                            {permission.method ?? "ANY"}
                          </Badge>
                          <span className="text-sm font-medium leading-tight">
                            {permissionTitle(permission)}
                          </span>
                          <span className="truncate font-mono text-xs text-muted-foreground">
                            {permissionScopeLabel(permission)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          {permission.isSystem && (
                            <Badge variant="secondary" className="py-0 text-[10px]">System</Badge>
                          )}
                          {permission.isPublic && (
                            <Badge variant="outline" className="py-0 text-[10px]">Public</Badge>
                          )}
                          {isAdmin && (
                            <Badge variant="outline" className="border-violet-200 bg-violet-50 py-0 text-[10px] text-violet-700">
                              Admin
                            </Badge>
                          )}
                          {permission.description && (
                            <span className="text-[11px] text-muted-foreground">{permission.description}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t px-6 py-4">
          <DialogClose asChild>
            <Button variant="outline" type="button">Close</Button>
          </DialogClose>
          <Button
            onClick={() => group && onEdit(group)}
          >
            <Edit2 className="h-4 w-4" />
            Edit group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Form Dialog ─────────────────────────────────────────────────────────────

type PermissionGroupFormDialogProps = {
  open: boolean
  editingGroup: PermissionGroup | null
  form: PermissionGroupFormState
  permissions: Permission[]
  selectedPermissionSet: Set<string>
  permissionFilters: PermissionFilters
  resourceOptions: string[]
  loadingPermissions: boolean
  saving: boolean
  totalPermissions: number
  onClose: () => void
  onFormChange: (form: PermissionGroupFormState) => void
  onFiltersChange: (filters: PermissionFilters) => void
  onTogglePermission: (permissionId: string, checked: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function PermissionGroupFormDialog({
  open,
  editingGroup,
  form,
  permissions,
  selectedPermissionSet,
  permissionFilters,
  resourceOptions,
  loadingPermissions,
  saving,
  totalPermissions,
  onClose,
  onFormChange,
  onFiltersChange,
  onTogglePermission,
  onSubmit,
}: PermissionGroupFormDialogProps) {
  const [permissionPage, setPermissionPage] = useState(1)
  const permissionPageSize = 12

  const totalPermissionPages = Math.max(
    1,
    Math.ceil(permissions.length / permissionPageSize)
  )
  const pagedPermissions = permissions.slice(
    (permissionPage - 1) * permissionPageSize,
    permissionPage * permissionPageSize
  )

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-violet-700" />
            {editingGroup ? "Edit Permission Group" : "Create Permission Group"}
          </DialogTitle>
          <DialogDescription>
            Bundle related permissions so they can be assigned together.
          </DialogDescription>
        </DialogHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <div className="grid min-h-0 flex-1 grid-cols-1 divide-y overflow-hidden lg:grid-cols-[310px_1fr] lg:divide-x lg:divide-y-0">
            <div className="space-y-4 overflow-y-auto p-4">
              <div className="space-y-2">
                <Label htmlFor="permission-group-name">Group Name</Label>
                <Input
                  id="permission-group-name"
                  required
                  maxLength={255}
                  value={form.groupName}
                  onChange={(event) =>
                    onFormChange({ ...form, groupName: event.target.value })
                  }
                  placeholder="e.g. Product operator"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="permission-group-description">Description</Label>
                <Textarea
                  id="permission-group-description"
                  maxLength={1000}
                  className="min-h-28 resize-none"
                  value={form.description}
                  onChange={(event) =>
                    onFormChange({ ...form, description: event.target.value })
                  }
                  placeholder="Optional notes about when this group should be used"
                />
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Selection Summary
                </p>
                <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Selected</span>
                    <span className="font-medium">
                      {form.permissionIds.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Catalog loaded</span>
                    <span className="font-medium">{totalPermissions}</span>
                  </div>
                  {editingGroup ? (
                    <div className="pt-2 text-xs text-muted-foreground">
                      Last updated {formatDate(editingGroup.updatedAt)}
                    </div>
                  ) : null}
                </div>
              </div>

              {form.permissionIds.length > 0 ? (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Selected Ids
                  </p>
                  <div className="max-h-44 space-y-1 overflow-y-auto">
                    {form.permissionIds.map((permissionId) => (
                      <div
                        key={permissionId}
                        className="truncate rounded-md border bg-muted/10 px-2.5 py-1.5 font-mono text-[11px]"
                      >
                        {permissionId}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  This group has no permissions selected yet.
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="space-y-2 border-b p-4">
                <PermissionSearchBox
                  value={permissionFilters}
                  onChange={(filters) => {
                    setPermissionPage(1)
                    onFiltersChange(filters)
                  }}
                  totalResults={permissions.length}
                  loading={loadingPermissions}
                  resourceOptions={resourceOptions}
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
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
                    {pagedPermissions.map((permission) => {
                      const checked = selectedPermissionSet.has(permission.id)
                      const isAdmin = isAdminPermission(permission)

                      return (
                        <label
                          key={permission.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors hover:bg-muted/30",
                            checked && "bg-emerald-50/60",
                            isAdmin && checked && "bg-violet-50/60",
                            isAdmin && !checked && "bg-violet-50/20"
                          )}
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={checked}
                            onCheckedChange={(value) =>
                              onTogglePermission(permission.id, value === true)
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isAdmin ? (
                                <Crown className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                              ) : null}
                              <Badge
                                className={cn(
                                  "shrink-0 text-[10px]",
                                  methodClass(permission.method)
                                )}
                              >
                                {permission.method ?? "ANY"}
                              </Badge>
                              <span className="font-medium leading-tight">
                                {permissionTitle(permission)}
                              </span>
                              <code className="truncate font-mono text-xs text-muted-foreground">
                                {permissionScopeLabel(permission)}
                              </code>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {permission.isSystem ? (
                                <Badge variant="secondary" className="py-0 text-[10px]">
                                  System
                                </Badge>
                              ) : null}
                              {permission.isPublic ? (
                                <Badge variant="outline" className="py-0 text-[10px]">
                                  Public
                                </Badge>
                              ) : null}
                              {isAdmin ? (
                                <Badge
                                  variant="outline"
                                  className="border-violet-200 bg-violet-50 py-0 text-[10px] text-violet-700"
                                >
                                  Admin
                                </Badge>
                              ) : null}
                              {permission.description ? (
                                <span className="text-[11px] text-muted-foreground">
                                  {permission.description}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {!loadingPermissions && permissions.length > permissionPageSize ? (
                <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm text-muted-foreground">
                  <span>
                    {(permissionPage - 1) * permissionPageSize + 1}-
                    {Math.min(
                      permissionPage * permissionPageSize,
                      permissions.length
                    )}{" "}
                    of {permissions.length}
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      disabled={permissionPage <= 1}
                      onClick={() =>
                        setPermissionPage((value) => Math.max(1, value - 1))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      disabled={permissionPage >= totalPermissionPages}
                      onClick={() =>
                        setPermissionPage((value) =>
                          Math.min(totalPermissionPages, value + 1)
                        )
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving || loadingPermissions}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
