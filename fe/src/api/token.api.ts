import type {
  CreateTokenPayload,
  CreateTokenResponse,
  ManagedToken,
  RefreshTokenResponse,
  TokenPagedResult,
} from "@/types/api"
import { request } from "./api"

export function getTokens(query: {
  token: string
  page: number
  pageSize: number
  isRevoked?: boolean
}) {
  const { token, ...params } = query
  return request<TokenPagedResult>("/tokens", { token, query: params })
}

export function getToken(token: string, id: string) {
  return request<ManagedToken>(`/tokens/${id}`, { token })
}

export function createToken(token: string, payload: CreateTokenPayload) {
  return request<CreateTokenResponse>("/tokens", {
    token,
    method: "POST",
    body: payload,
  })
}

export function refreshToken(
  token: string,
  id: string,
  extendMinutes?: number | null
) {
  return request<RefreshTokenResponse>(`/tokens/${id}/refresh`, {
    token,
    method: "POST",
    query: { extendMinutes },
  })
}

export function revokeToken(token: string, id: string) {
  return request<{ message: string }>(`/tokens/${id}/revoke`, {
    token,
    method: "POST",
  })
}

export function deleteToken(token: string, id: string) {
  return request<void>(`/tokens/${id}`, {
    token,
    method: "DELETE",
  })
}

export function addTokenPermissions(
  token: string,
  id: string,
  permissionIds: string[]
) {
  return request<ManagedToken>(`/tokens/${id}/permissions`, {
    token,
    method: "POST",
    body: permissionIds,
  })
}

export function removeTokenPermission(
  token: string,
  id: string,
  permissionId: string
) {
  return request<void>(`/tokens/${id}/permissions/${permissionId}`, {
    token,
    method: "DELETE",
  })
}
