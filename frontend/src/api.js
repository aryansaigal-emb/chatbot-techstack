export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export function apiUrl(path) {
  const base = API_BASE_URL.replace(/\/+$/, '')
  const route = path.startsWith('/') ? path : `/${path}`
  return `${base}${route}`
}
