import { request, MAIN_API_BASE_URL } from "./api"
import type { Product, ProductPagedResult, ProductPayload } from "@/types/api"

export function getProducts(query: {
  token?: string | null
  page: number
  pageSize: number
  category?: string
  search?: string
}) {
  const { token, ...params } = query
  return request<ProductPagedResult>(
    "/products",
    { token, query: params },
    MAIN_API_BASE_URL
  )
}

export function getProduct(token: string | null, id: string) {
  return request<Product>(
    `/products/${id}`,
    { token },
    MAIN_API_BASE_URL
  )
}

export function createProduct(token: string | null, payload: ProductPayload) {
  return request<Product>(
    "/products",
    { token, method: "POST", body: payload },
    MAIN_API_BASE_URL
  )
}

export function updateProduct(token: string | null, id: string, payload: ProductPayload) {
  return request<Product>(
    `/products/${id}`,
    { token, method: "PUT", body: payload },
    MAIN_API_BASE_URL
  )
}

export function updateProductStock(
  token: string | null,
  id: string,
  stockQuantity: number
) {
  return request<Product>(
    `/products/${id}/stock`,
    { token, method: "PATCH", body: { stockQuantity } },
    MAIN_API_BASE_URL
  )
}

export function deleteProduct(token: string | null, id: string) {
  return request<void>(
    `/products/${id}`,
    { token, method: "DELETE" },
    MAIN_API_BASE_URL
  )
}
