import type { Agent } from "http"
import { buildRequestError, isClientError, RequestTimeoutError } from "./errors"
import nodeFetch from "node-fetch"
import { version as PACKAGE_VERSION } from "../package.json"
import { SupportedFetch } from "./types/fetch-types"

export interface Options {
  auth?: object
  timeoutMs?: number
  baseUrl?: string
  fetch?: SupportedFetch
  agent?: Agent
}

export interface RequestParameters {
  path: string
  method: Method
  query?: QueryParams
  body?: Record<string, unknown>
  auth?: {
    client_id: string
    client_secret: string
  }
}

export default class Client {
  #auth?: object
  #prefixUrl: string
  #timeoutMs: number
  #fetch: SupportedFetch
  #agent: Agent | undefined
  #userAgent: string

  public constructor(options?: Options) {
    this.#auth = options?.auth
    this.#prefixUrl = options?.baseUrl ?? ""
    this.#timeoutMs = options?.timeoutMs ?? 60_000
    this.#fetch = options?.fetch ?? nodeFetch
    this.#agent = options?.agent
    this.#userAgent = `anteraja-client/${PACKAGE_VERSION}`
  }

  public async request<ResponseBody>({
    path,
    method,
    query,
    body,
  }: RequestParameters): Promise<ResponseBody> {
    const bodyAsJsonString =
      !body || Object.entries(body).length === 0
        ? undefined
        : JSON.stringify(body)

    const url = new URL(`${this.#prefixUrl}${path}`)

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(val =>
              url.searchParams.append(key, decodeURIComponent(val))
            )
          } else {
            url.searchParams.append(key, String(value))
          }
        }
      }
    }

    const headers: Record<string, string> = {
      ...this.#auth,
      "user-agent": this.#userAgent,
    }

    if (bodyAsJsonString !== undefined) {
      headers["content-type"] = "application/json"
    }

    try {
      const response = await RequestTimeoutError.rejectAfterTimeout(
        this.#fetch(url.toString(), {
          method: method.toUpperCase(),
          headers,
          body: bodyAsJsonString,
          agent: this.#agent,
        }),
        this.#timeoutMs
      )

      const responseText = await response.text()
      if (!response.ok) {
        throw buildRequestError(response, responseText)
      }

      const responseJson: ResponseBody = JSON.parse(responseText)

      return responseJson
    } catch (error: unknown) {
      if (!isClientError(error)) {
        throw error
      }

      throw error
    }
  }
}

type Method = "get" | "post" | "patch" | "delete"
type QueryParams = Record<string, string | number | string[]> | URLSearchParams
