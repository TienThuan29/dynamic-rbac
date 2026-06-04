import axios from "axios"
import type {
  LoginPayload,
  LoginResponse,
  Permission,
  PermissionPagedResult,
  Product,
  ProductPagedResult,
  ProductPayload,
  RequestOptions,
  UpdatePermissionPayload,
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

function readError(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const payload = data as { message?: unknown; error?: unknown }

    if (typeof payload.message === "string") return payload.message
    if (typeof payload.error === "string") return payload.error
  }

  return fallback
}

async function request<T>(
  baseUrl: string,
  path: string,
  { method = "GET", token, body, query }: RequestOptions = {}
) {
  try {
    const response = await axios.request<T>({
      baseURL: baseUrl,
      url: path,
      method,
      params: query,
      data: body,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })

    if (response.status === 204) {
      return undefined as T
    }

    return response.data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new ApiError(
        readError(err.response?.data, err.message),
        err.response?.status ?? 0
      )
    }

    throw err
  }
}

export function getProducts(query: {
  token?: string | null
  page: number
  pageSize: number
  category?: string
  search?: string
}) {
  const { token, ...params } = query
  return request<ProductPagedResult>(MAIN_API_BASE_URL, "/products", { token, query: params })
}

export function createProduct(token: string | null, payload: ProductPayload) {
  return request<Product>(MAIN_API_BASE_URL, "/products", {
    token,
    method: "POST",
    body: payload,
  })
}

export function updateProduct(token: string | null, id: string, payload: ProductPayload) {
  return request<Product>(MAIN_API_BASE_URL, `/products/${id}`, {
    token,
    method: "PUT",
    body: payload,
  })
}

export function updateProductStock(token: string | null, id: string, stockQuantity: number) {
  return request<Product>(MAIN_API_BASE_URL, `/products/${id}/stock`, {
    token,
    method: "PATCH",
    body: { stockQuantity },
  })
}

export function deleteProduct(token: string | null, id: string) {
  return request<void>(MAIN_API_BASE_URL, `/products/${id}`, {
    token,
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

export function getPermission(token: string, id: string) {
  return request<Permission>(AUTH_API_BASE_URL, `/permissions/${id}`, { token })
}

export function updatePermission(
  token: string,
  id: string,
  payload: UpdatePermissionPayload
) {
  return request<Permission>(AUTH_API_BASE_URL, `/permissions/${id}`, {
    token,
    method: "PUT",
    body: payload,
  })
}

export function deletePermission(token: string, id: string) {
  return request<void>(AUTH_API_BASE_URL, `/permissions/${id}`, {
    token,
    method: "DELETE",
  })
}

export function assignPermissionsWithExpiry(payload: {
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
