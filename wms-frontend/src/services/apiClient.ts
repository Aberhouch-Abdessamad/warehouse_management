import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api'

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  meta?: Record<string, unknown>
}

export interface Paginated<T> {
  data: T[]
  links?: unknown
  current_page: number
  from?: number
  last_page: number
  per_page?: number
  to?: number
  total: number
}

const get = async <T,>(url: string, params?: Record<string, unknown>): Promise<T> => {
  const resp = await api.get(url, { params })
  return (resp.data as ApiResponse<T>).data
}

const getList = async <T,>(url: string, params?: Record<string, unknown>): Promise<Paginated<T>> => {
  const resp = await api.get(url, { params })
  const envelope = resp.data as ApiResponse<T[]>
  const meta = (envelope.meta ?? {}) as {
    current_page?: number
    last_page?: number
    total?: number
  }
  // Handle both array and keyed-object responses for backward compatibility
  const data = Array.isArray(envelope.data) ? envelope.data : Object.values(envelope.data as object)
  return {
    data,
    current_page: meta.current_page ?? 1,
    last_page: meta.last_page ?? 1,
    total: meta.total ?? 0,
  }
}

const post = async <T,>(url: string, body?: unknown): Promise<T> => {
  const resp = await api.post(url, body ?? {})
  return (resp.data as ApiResponse<T>).data
}

const put = async <T,>(url: string, body?: unknown): Promise<T> => {
  const resp = await api.put(url, body ?? {})
  return (resp.data as ApiResponse<T>).data
}

const del = async <T,>(url: string): Promise<T> => {
  const resp = await api.delete(url)
  return (resp.data as ApiResponse<T>).data
}

export { get, getList, post, put, del }