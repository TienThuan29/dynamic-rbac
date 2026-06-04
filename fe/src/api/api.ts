import axios from "axios"
import type {
  RequestOptions,
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
