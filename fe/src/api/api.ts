import axios from "axios"
import type {
  LoginPayload,
  LoginResponse,
  Permission,
  PermissionPagedResult,
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

export async function request<T>(
  path: string,
  { method = "GET", token, body, query }: RequestOptions = {},
  baseUrl = AUTH_API_BASE_URL
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

export { MAIN_API_BASE_URL }

export function login(payload: LoginPayload) {
  return request<LoginResponse>("/auth/login", {
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
  return request<UserPagedResult>("/users/accounts", { token, query: params })
}

export function getAccountPermissions(token: string, accountId: string) {
  return request<UserPermissionDetail[]>(`/users/account/${accountId}`, { token })
}

export function getPermissions(query: {
  token: string
  page: number
  pageSize: number
  search?: string
  method?: string
  isSystem?: boolean
  isActive?: boolean
  resource?: string
}) {
  const { token, ...params } = query
  return request<PermissionPagedResult>("/permissions", { token, query: params })
}

export function getPermissionResources(token: string) {
  return request<string[]>("/permissions/resources", { token })
}

export function assignPermissions(payload: {
  token: string
  accountId: string
  permissionIds: string[]
  expiresAt?: string | null
}) {
  const { token, ...body } = payload
  return request<UserPermissionDetail[]>("/users/assign", {
    token,
    method: "POST",
    body,
  })
}

export function revokePermission(token: string, accountId: string, permissionId: string) {
  return request<void>(`/users/revoke/${accountId}/${permissionId}`, {
    token,
    method: "DELETE",
  })
}

export function getPermission(token: string, id: string) {
  return request<Permission>(`/permissions/${id}`, { token })
}

export function updatePermission(
  token: string,
  id: string,
  payload: UpdatePermissionPayload
) {
  return request<Permission>(`/permissions/${id}`, {
    token,
    method: "PUT",
    body: payload,
  })
}

export function deletePermission(token: string, id: string) {
  return request<void>(`/permissions/${id}`, {
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
  return request<UserPermissionDetail[]>("/users/assign", {
    token,
    method: "POST",
    body,
  })
}
