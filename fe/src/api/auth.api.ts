import type {
	LoginPayload,
	LoginResponse,
	UserPagedResult,
	UserPermissionDetail,
} from "@/types/api"
import { request } from "./api"

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
