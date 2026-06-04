import type {
	Permission,
	PermissionGroup,
	PermissionGroupPagedResult,
	PermissionGroupPayload,
	PermissionPagedResult,
	UpdatePermissionPayload,
} from "@/types/api"
import { request } from "./api"

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

export function getPermissionGroups(query: {
	token: string
	page: number
	pageSize: number
	search?: string
}) {
	const { token, ...params } = query
	return request<PermissionGroupPagedResult>("/permission-groups", {
		token,
		query: params,
	})
}

export function getPermissionGroup(token: string, id: string) {
	return request<PermissionGroup>(`/permission-groups/${id}`, { token })
}

export function createPermissionGroup(
	token: string,
	payload: PermissionGroupPayload
) {
	return request<PermissionGroup>("/permission-groups", {
		token,
		method: "POST",
		body: payload,
	})
}

export function updatePermissionGroup(
	token: string,
	id: string,
	payload: PermissionGroupPayload
) {
	return request<PermissionGroup>(`/permission-groups/${id}`, {
		token,
		method: "PUT",
		body: payload,
	})
}

export function deletePermissionGroup(token: string, id: string) {
	return request<void>(`/permission-groups/${id}`, {
		token,
		method: "DELETE",
	})
}
