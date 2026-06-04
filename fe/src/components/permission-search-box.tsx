import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type PermissionFilters = {
  search: string
  method: string[]
  type: ("system" | "custom")[]
  status: ("active" | "inactive")[]
  resource: string
  isAdmin: "" | "admin" | "non-admin"
}

export type PermissionSearchBoxProps = {
  value: PermissionFilters
  onChange: (filters: PermissionFilters) => void
  totalResults?: number
  loading?: boolean
  resourceOptions?: string[]
  className?: string
}

const DEFAULT_FILTERS: PermissionFilters = {
  search: "",
  method: [],
  type: [],
  status: [],
  resource: "",
  isAdmin: "",
}

const METHOD_OPTIONS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
const TYPE_OPTIONS: { value: "system" | "custom"; label: string }[] = [
  { value: "system", label: "System" },
  { value: "custom", label: "Custom" },
]
const STATUS_OPTIONS: { value: "active" | "inactive"; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

interface FilterDropdownProps {
  label: string
  selected: string[]
  options: readonly string[]
  optionLabels?: Record<string, string>
  onToggle: (value: string) => void
  onClear: () => void
}

function FilterDropdown({
  label,
  selected,
  options,
  optionLabels,
  onToggle,
  onClear,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted/60",
          selected.length > 0
            ? "border-sky-300 bg-sky-50 text-sky-700"
            : "border-input bg-background text-foreground"
        )}
      >
        {label}
        {selected.length > 0 && (
          <Badge
            variant="outline"
            className="ml-1 h-5 gap-0.5 px-1.5 text-xs"
          >
            {selected.length}
          </Badge>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[180px] rounded-md border bg-popover p-1 shadow-md">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={selected.includes(opt)}
                onCheckedChange={() => onToggle(opt)}
              />
              {optionLabels?.[opt] ?? opt}
            </label>
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="mt-1 w-full border-t pt-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <Badge
      variant="outline"
      className="inline-flex h-6 items-center gap-1 border-sky-200 bg-sky-50 pr-1 text-xs font-normal text-sky-700"
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-sm hover:bg-sky-200"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )
}

export function PermissionSearchBox({
  value,
  onChange,
  totalResults,
  loading,
  resourceOptions,
  className,
}: PermissionSearchBoxProps) {
  const [draft, setDraft] = useState(value.search)

  const hasActiveFilters = useMemo(
    () =>
      value.method.length > 0 ||
      value.type.length > 0 ||
      value.status.length > 0 ||
      value.resource !== "" ||
      value.isAdmin !== "",
    [value.method, value.type, value.status, value.resource, value.isAdmin]
  )

  function toggleMethod(m: string) {
    onChange({
      ...value,
      method: value.method.includes(m)
        ? value.method.filter((x) => x !== m)
        : [...value.method, m],
    })
  }

  function toggleType(t: "system" | "custom") {
    onChange({
      ...value,
      type: value.type.includes(t)
        ? value.type.filter((x) => x !== t)
        : [...value.type, t],
    })
  }

  function toggleStatus(s: "active" | "inactive") {
    onChange({
      ...value,
      status: value.status.includes(s)
        ? value.status.filter((x) => x !== s)
        : [...value.status, s],
    })
  }

  function clearAll() {
    onChange({ ...DEFAULT_FILTERS, search: "" })
    setDraft("")
  }

  function handleSearch() {
    onChange({ ...value, search: draft.trim() })
  }

  function clearSearch() {
    setDraft("")
    onChange({ ...value, search: "" })
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 pr-8"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch()
              if (e.key === "Escape") clearSearch()
            }}
            placeholder="Search name, code, endpoint, description..."
          />
          {draft && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Resource prefix select */}
        {resourceOptions && resourceOptions.length > 0 && (
          <select
            className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            value={value.resource}
            onChange={(e) => onChange({ ...value, resource: e.target.value })}
          >
            <option value="">All resources</option>
            {resourceOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}

        {/* Admin filter select */}
        <select
          className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          value={value.isAdmin}
          onChange={(e) => onChange({ ...value, isAdmin: e.target.value as "" | "admin" | "non-admin" })}
        >
          <option value="">All scopes</option>
          <option value="admin">Admin wildcard</option>
          <option value="non-admin">Non-admin</option>
        </select>

        {/* Filter dropdowns */}
        <FilterDropdown
          label="Method"
          selected={value.method}
          options={METHOD_OPTIONS}
          onToggle={toggleMethod}
          onClear={() => onChange({ ...value, method: [] })}
        />
        <FilterDropdown
          label="Type"
          selected={value.type}
          options={TYPE_OPTIONS.map((o) => o.value)}
          optionLabels={Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]))}
          onToggle={(v) => toggleType(v as "system" | "custom")}
          onClear={() => onChange({ ...value, type: [] })}
        />
        <FilterDropdown
          label="Status"
          selected={value.status}
          options={STATUS_OPTIONS.map((o) => o.value)}
          optionLabels={Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]))}
          onToggle={(v) => toggleStatus(v as "active" | "inactive")}
          onClear={() => onChange({ ...value, status: [] })}
        />

        {/* Clear all */}
        {hasActiveFilters && (
          <Button
            variant="destructive"
            size="sm"
            onClick={clearAll}
            className="h-8 text-xs"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Active filter chips + results count */}
      <div className="flex min-h-5 flex-wrap items-center gap-1.5">
        {value.resource && (
          <FilterChip
            label={`Resource: ${value.resource}`}
            onRemove={() => onChange({ ...value, resource: "" })}
          />
        )}
        {value.isAdmin && (
          <FilterChip
            label={value.isAdmin === "admin" ? "Scope: Admin" : "Scope: Non-admin"}
            onRemove={() => onChange({ ...value, isAdmin: "" })}
          />
        )}
        {value.method.map((m) => (
          <FilterChip
            key={m}
            label={`Method: ${m}`}
            onRemove={() => toggleMethod(m)}
          />
        ))}
        {value.type.map((t) => (
          <FilterChip
            key={t}
            label={`Type: ${t === "system" ? "System" : "Custom"}`}
            onRemove={() => toggleType(t)}
          />
        ))}
        {value.status.map((s) => (
          <FilterChip
            key={s}
            label={`Status: ${s === "active" ? "Active" : "Inactive"}`}
            onRemove={() => toggleStatus(s)}
          />
        ))}

        {/* Results summary */}
        <span className="ml-auto text-xs text-muted-foreground">
          {loading ? (
            "Searching..."
          ) : totalResults !== undefined ? (
            totalResults === 0 ? (
              "No results"
            ) : (
              `${totalResults.toLocaleString()} result${totalResults !== 1 ? "s" : ""}`
            )
          ) : null}
        </span>
      </div>
    </div>
  )
}
