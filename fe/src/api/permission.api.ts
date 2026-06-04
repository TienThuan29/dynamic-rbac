import type {
	Permission,
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
