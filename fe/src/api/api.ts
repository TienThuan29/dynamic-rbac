import type {
  LoginPayload,
  LoginResponse,
  PermissionPagedResult,
  Product,
  ProductPagedResult,
  ProductPayload,
  QueryValue,
  RequestOptions,
  UserPagedResult,
  UserPermissionDetail,
} from "@/types/api"

const MAIN_API_BASE_URL = import.meta.env.VITE_MAIN_API_BASE_URL ?? "/api"
const AUTH_API_BASE_URL = import.meta.env.VITE_AUTH_API_BASE_URL ?? "/api"

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function joinUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>) {
  const base = baseUrl.replace(/\/$/, "")
  const cleanPath = path.replace(/^\//, "")
  const url = `${base}/${cleanPath}`
  const params = new URLSearchParams()

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value))
    }
  })

  const queryString = params.toString()
  return queryString ? `${url}?${queryString}` : url
}

async function readError(response: Response) {
  try {
    const payload = await response.json()
    return payload?.message ?? payload?.error ?? response.statusText
  } catch {
    return response.statusText
  }
}

async function request<T>(
  baseUrl: string,
  path: string,
  { method = "GET", token, body, query }: RequestOptions = {}
) {
  const response = await fetch(joinUrl(baseUrl, path, query), {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function getProducts(query: {
  page: number
  pageSize: number
  category?: string
  search?: string
}) {
  return request<ProductPagedResult>(MAIN_API_BASE_URL, "/products", { query })
}

export function createProduct(payload: ProductPayload) {
  return request<Product>(MAIN_API_BASE_URL, "/products", {
    method: "POST",
    body: payload,
  })
}

export function updateProduct(id: string, payload: ProductPayload) {
  return request<Product>(MAIN_API_BASE_URL, `/products/${id}`, {
    method: "PUT",
    body: payload,
  })
}

export function updateProductStock(id: string, stockQuantity: number) {
  return request<Product>(MAIN_API_BASE_URL, `/products/${id}/stock`, {
    method: "PATCH",
    body: { stockQuantity },
  })
}

export function deleteProduct(id: string) {
  return request<void>(MAIN_API_BASE_URL, `/products/${id}`, {
    method: "DELETE",
  })
}

export function login(payload: LoginPayload) {
  return request<LoginResponse>(AUTH_API_BASE_URL, "/auth/login", {
    method: "POST",
    body: payload,
  })
}

export function getAccounts(query: {
  token: string
  page: number
  pageSize: number
  search?: string
}) {
  const { token, ...params } = query
  return request<UserPagedResult>(AUTH_API_BASE_URL, "/users/accounts", {
    token,
    query: params,
  })
}

export function getAccountPermissions(token: string, accountId: string) {
  return request<UserPermissionDetail[]>(
    AUTH_API_BASE_URL,
    `/users/account/${accountId}`,
    { token }
  )
}

export function getPermissions(query: {
  token: string
  page: number
  pageSize: number
  search?: string
}) {
  const { token, ...params } = query
  return request<PermissionPagedResult>(AUTH_API_BASE_URL, "/permissions", {
    token,
    query: params,
  })
}

export function assignPermissions(payload: {
  token: string
  accountId: string
  permissionIds: string[]
  expiresAt?: string | null
}) {
  const { token, ...body } = payload
  return request<UserPermissionDetail[]>(AUTH_API_BASE_URL, "/users/assign", {
    token,
    method: "POST",
    body,
  })
}

export function revokePermission(token: string, accountId: string, permissionId: string) {
  return request<void>(
    AUTH_API_BASE_URL,
    `/users/revoke/${accountId}/${permissionId}`,
    {
      token,
      method: "DELETE",
    }
  )
}
