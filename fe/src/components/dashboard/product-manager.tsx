import { useEffect, useState } from "react"
import {
  AlertCircle,
  Boxes,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
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
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
  updateProductStock,
} from "@/api/product.api"
import type { LoginResponse, Product, ProductPayload } from "@/types/api"

type ProductFormState = {
  name: string
  description: string
  price: string
  stockQuantity: string
  sku: string
  category: string
  imageUrl: string
}

const emptyProductForm: ProductFormState = {
  name: "",
  description: "",
  price: "",
  stockQuantity: "0",
  sku: "",
  category: "",
  imageUrl: "",
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const numberFormatter = new Intl.NumberFormat("en-US")

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function formatDate(value?: string | null) {
  if (!value) return "Never"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

function toForm(product: Product): ProductFormState {
  return {
    name: product.name,
    description: product.description ?? "",
    price: String(product.price),
    stockQuantity: String(product.stockQuantity),
    sku: product.sku,
    category: product.category ?? "",
    imageUrl: product.imageUrl ?? "",
  }
}

function toPayload(form: ProductFormState): ProductPayload {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    price: Number(form.price || 0),
    stockQuantity: Number(form.stockQuantity || 0),
    sku: form.sku.trim(),
    category: form.category.trim() || null,
    imageUrl: form.imageUrl.trim() || null,
  }
}

function getStockBadge(product: Product) {
  if (product.stockQuantity === 0) {
    return <Badge variant="destructive">Out of stock</Badge>
  }

  if (product.stockQuantity <= 10) {
    return <Badge className="border-amber-200 bg-amber-50 text-amber-700">Low stock</Badge>
  }

  return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">In stock</Badge>
}

export function ProductManager({ session }: { session: LoginResponse | null }) {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(8)
  const [searchDraft, setSearchDraft] = useState("")
  const [categoryDraft, setCategoryDraft] = useState("")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductFormState>(emptyProductForm)
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  const [stockValue, setStockValue] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const token = session?.accessToken ?? ""

  useEffect(() => {
    let ignore = false

    async function loadProducts() {
      setLoading(true)
      setError(null)

      try {
        const result = await getProducts({
          token,
          page,
          pageSize,
          category,
          search,
        })

        if (!ignore) {
          setProducts(result.items)
          setTotal(result.total)
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to load products.")
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadProducts()

    return () => {
      ignore = true
    }
  }, [category, page, pageSize, refreshKey, search, session?.accessToken])

  function openCreateDialog() {
    setEditingProduct(null)
    setForm(emptyProductForm)
    setIsFormOpen(true)
  }

  function openEditDialog(product: Product) {
    setEditingProduct(product)
    setForm(toForm(product))
    setIsFormOpen(true)
  }

  function openStockDialog(product: Product) {
    setStockProduct(product)
    setStockValue(String(product.stockQuantity))
  }

  function applyFilters() {
    setSearch(searchDraft.trim())
    setCategory(categoryDraft.trim())
    setPage(1)
  }

  function clearFilters() {
    setSearchDraft("")
    setCategoryDraft("")
    setSearch("")
    setCategory("")
    setPage(1)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const payload = toPayload(form)

      if (editingProduct) {
        await updateProduct(token, editingProduct.id, payload)
        setNotice(`${payload.name} updated.`)
      } else {
        await createProduct(token, payload)
        setNotice(`${payload.name} created.`)
      }

      setIsFormOpen(false)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save product.")
    } finally {
      setSaving(false)
    }
  }

  async function handleStockSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!stockProduct) return

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      await updateProductStock(token, stockProduct.id, Number(stockValue || 0))
      setStockProduct(null)
      setNotice(`${stockProduct.name} stock updated.`)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update stock.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      await deleteProduct(token, deleteTarget.id)
      setNotice(`${deleteTarget.name} archived.`)
      setDeleteTarget(null)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to archive product.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <PackageCheck className="h-4 w-4" />
            MainModule products
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            Product Management
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((value) => value + 1)}
            title="Refresh products"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Product
          </Button>
        </div>
      </div>

      <Card className="rounded-lg">
        <CardHeader className="p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-base">Catalog</CardTitle>
              <CardDescription>{numberFormatter.format(total)} active records</CardDescription>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(150px,220px)_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyFilters()
                  }}
                  placeholder="Search name or description"
                />
              </div>
              <Input
                value={categoryDraft}
                onChange={(event) => setCategoryDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyFilters()
                }}
                placeholder="Category"
              />
              <Button variant="secondary" onClick={applyFilters}>
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="mx-4 mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="mx-4 mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted-foreground" colSpan={7}>
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Loading products
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted-foreground" colSpan={7}>
                      No products found
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} className="border-b transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                onError={(event) => {
                                  event.currentTarget.src = "/favicon.svg"
                                }}
                              />
                            ) : (
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{product.name}</div>
                            <div className="max-w-[320px] truncate text-xs text-muted-foreground">
                              {product.description || "No description"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{product.sku}</td>
                      <td className="px-4 py-3">
                        {product.category ? (
                          <Badge variant="outline">{product.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground">Uncategorized</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {numberFormatter.format(product.stockQuantity)}
                          </span>
                          {getStockBadge(product)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(product.updatedAt ?? product.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openStockDialog(product)}
                            title="Update stock"
                          >
                            <Boxes className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(product)}
                            title="Edit product"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(product)}
                            title="Archive product"
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
              Page {page} of {totalPages}
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

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit product" : "Create product"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? editingProduct.sku : "Add a new active product record"}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-name">Name</Label>
                <Input
                  id="product-name"
                  required
                  maxLength={255}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-sku">SKU</Label>
                <Input
                  id="product-sku"
                  required
                  maxLength={100}
                  value={form.sku}
                  onChange={(event) => setForm({ ...form, sku: event.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="product-price">Price</Label>
                <Input
                  id="product-price"
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-stock">Stock</Label>
                <Input
                  id="product-stock"
                  min="0"
                  step="1"
                  type="number"
                  value={form.stockQuantity}
                  onChange={(event) =>
                    setForm({ ...form, stockQuantity: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-category">Category</Label>
                <Input
                  id="product-category"
                  maxLength={255}
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-image">Image URL</Label>
              <Input
                id="product-image"
                maxLength={500}
                value={form.imageUrl}
                onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-description">Description</Label>
              <Textarea
                id="product-description"
                maxLength={1000}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(stockProduct)} onOpenChange={(open) => !open && setStockProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update stock</DialogTitle>
            <DialogDescription>{stockProduct?.name}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleStockSubmit}>
            <div className="space-y-2">
              <Label htmlFor="stock-quantity">Stock quantity</Label>
              <Input
                id="stock-quantity"
                min="0"
                step="1"
                type="number"
                value={stockValue}
                onChange={(event) => setStockValue(event.target.value)}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive product</DialogTitle>
            <DialogDescription>{deleteTarget?.name} will be hidden from active catalog results.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
