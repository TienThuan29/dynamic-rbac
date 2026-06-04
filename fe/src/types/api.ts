export type QueryValue = string | number | boolean | null | undefined

export type Product = {
  id: string
  name: string
  description?: string | null
  price: number
  stockQuantity: number
  sku: string
  category?: string | null
  imageUrl?: string | null
  isActive: boolean
  createdAt: string
  updatedAt?: string | null
}

export type ProductPayload = {
  name: string
  description?: string | null
  price: number
  stockQuantity: number
  sku: string
  category?: string | null
  imageUrl?: string | null
}

export type ProductPagedResult = {
  total: number
  page: number
  pageSize: number
  items: Product[]
}

export type UserAccount = {
  accountId: string
  username: string
  email: string
  role: string
  isActive: boolean
  fullName?: string | null
}

export type Permission = {
  id: string
  method?: string | null
  endpoint?: string | null
  permissionName?: string | null
  permissionCode?: string | null
  description?: string | null
  isPublic: boolean
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt?: string | null
}

export type UserPermissionDetail = {
  accountId: string
  permissionId: string
  permissionCode?: string | null
  permissionName?: string | null
  method?: string | null
  endpoint?: string | null
  description?: string | null
  isPublic: boolean
  assignedAt: string
  assignedBy?: string | null
  expiresAt?: string | null
}

export type UserPagedResult = {
  items: UserAccount[]
  totalCount: number
  page: number
  pageSize: number
  totalPages?: number
  hasNextPage?: boolean
  hasPreviousPage?: boolean
}

export type PermissionPagedResult = {
  items: Permission[]
  totalCount: number
  page: number
  pageSize: number
}

export type UpdatePermissionPayload = {
  permissionName?: string | null
  permissionCode?: string | null
  description?: string | null
  isPublic?: boolean | null
  isActive?: boolean | null
}

export type LoginPayload = {
  email: string
  entraIdObjectId: string
}

export type LoginResponse = {
  userId: string
  accountId: string
  email: string
  fullName: string
  role: string
  isNewAccount: boolean
  accessToken: string
  expiresIn: number
  permissions: UserPermissionDetail[]
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  token?: string | null
  body?: unknown
  query?: Record<string, QueryValue>
}
