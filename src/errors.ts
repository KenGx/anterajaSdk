import { SupportedResponse } from "./types/fetch-types"
import { isObject } from "../src/utils/utils"

export enum APIErrorCode {
  Unauthorized = "unauthorized",
  RestrictedResource = "restricted_resource",
  ObjectNotFound = "object_not_found",
  RateLimited = "rate_limited",
  InvalidJSON = "invalid_json",
  InvalidRequestURL = "invalid_request_url",
  InvalidRequest = "invalid_request",
  ValidationError = "validation_error",
  ConflictError = "conflict_error",
  InternalServerError = "internal_server_error",
  ServiceUnavailable = "service_unavailable",
}

export enum ClientErrorCode {
  RequestTimeout = "request_timeout",
  ResponseError = "response_error",
}

export type errorCode = APIErrorCode | ClientErrorCode

abstract class clientBaseError<Code extends errorCode> extends Error {
  abstract code: Code
}

export type clientError =
  | RequestTimeoutError
  | UnknownHTTPResponseError
  | APIResponseError

export function isClientError(error: unknown): error is clientError {
  return isObject(error) && error instanceof clientBaseError
}

function isClientErrorWithCode<Code extends errorCode>(
  error: unknown,
  codes: { [C in Code]: true }
): error is clientError & { code: Code } {
  return isClientError(error) && error.code in codes
}

type HTTPResponseErrorCode = ClientErrorCode.ResponseError | APIErrorCode

class HTTPResponseError<
  Code extends HTTPResponseErrorCode,
> extends clientBaseError<Code> {
  readonly name: string = "HTTPResponseError"
  readonly code: Code
  readonly status: number
  readonly headers: SupportedResponse["headers"]
  readonly body: string

  constructor(args: {
    code: Code
    status: number
    message: string
    headers: SupportedResponse["headers"]
    rawBodyText: string
  }) {
    super(args.message)
    const { code, status, headers, rawBodyText } = args
    this.code = code
    this.status = status
    this.headers = headers
    this.body = rawBodyText
  }
}

const httpResponseErrorCodes: { [C in HTTPResponseErrorCode]: true } = {
  [ClientErrorCode.ResponseError]: true,
  [APIErrorCode.Unauthorized]: true,
  [APIErrorCode.RestrictedResource]: true,
  [APIErrorCode.ObjectNotFound]: true,
  [APIErrorCode.RateLimited]: true,
  [APIErrorCode.InvalidJSON]: true,
  [APIErrorCode.InvalidRequestURL]: true,
  [APIErrorCode.InvalidRequest]: true,
  [APIErrorCode.ValidationError]: true,
  [APIErrorCode.ConflictError]: true,
  [APIErrorCode.InternalServerError]: true,
  [APIErrorCode.ServiceUnavailable]: true,
}

export function isHTTPResponseError(
  error: unknown
): error is UnknownHTTPResponseError | APIResponseError {
  if (!isClientErrorWithCode(error, httpResponseErrorCodes)) {
    return false
  }

  return true
}

export class UnknownHTTPResponseError extends HTTPResponseError<ClientErrorCode.ResponseError> {
  readonly name = "UnknownHTTPResponseError"

  constructor(args: {
    status: number
    message: string | undefined
    headers: SupportedResponse["headers"]
    rawBodyText: string
  }) {
    super({
      ...args,
      code: ClientErrorCode.ResponseError,
      message: args.message ?? `Request failed with status: ${args.status}`,
    })
  }

  static isUnknownHTTPResponseError(
    error: unknown
  ): error is UnknownHTTPResponseError {
    return isClientErrorWithCode(error, {
      [ClientErrorCode.ResponseError]: true,
    })
  }
}

const apiErrorCodes: { [C in APIErrorCode]: true } = {
  [APIErrorCode.Unauthorized]: true,
  [APIErrorCode.RestrictedResource]: true,
  [APIErrorCode.ObjectNotFound]: true,
  [APIErrorCode.RateLimited]: true,
  [APIErrorCode.InvalidJSON]: true,
  [APIErrorCode.InvalidRequestURL]: true,
  [APIErrorCode.InvalidRequest]: true,
  [APIErrorCode.ValidationError]: true,
  [APIErrorCode.ConflictError]: true,
  [APIErrorCode.InternalServerError]: true,
  [APIErrorCode.ServiceUnavailable]: true,
}

export class APIResponseError extends HTTPResponseError<APIErrorCode> {
  readonly name = "APIResponseError"

  static isAPIResponseError(error: unknown): error is APIResponseError {
    return isClientErrorWithCode(error, apiErrorCodes)
  }
}

export function buildRequestError(
  response: SupportedResponse,
  bodyText: string
): APIResponseError | UnknownHTTPResponseError {
  const apiErrorResponseBody = parseAPIErrorResponseBody(bodyText)
  if (apiErrorResponseBody !== undefined) {
    return new APIResponseError({
      code: apiErrorResponseBody.code,
      message: apiErrorResponseBody.message,
      headers: response.headers,
      status: response.status,
      rawBodyText: bodyText,
    })
  }

  return new UnknownHTTPResponseError({
    message: undefined,
    headers: response?.headers,
    status: response?.status,
    rawBodyText: bodyText,
  })
}

function parseAPIErrorResponseBody(
  body: string
): { code: APIErrorCode; message: string } | undefined {
  if (typeof body !== "string") {
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch (parseError) {
    return
  }

  if (
    !isObject(parsed) ||
    typeof parsed["message"] !== "string" ||
    !isAPIErrorCode(parsed["code"])
  ) {
    return
  }

  return {
    ...parsed,
    code: parsed["code"],
    message: parsed["message"],
  }
}

function isAPIErrorCode(code: unknown): code is APIErrorCode {
  return typeof code === "string" && code in apiErrorCodes
}

export class RequestTimeoutError extends clientBaseError<ClientErrorCode.RequestTimeout> {
  readonly code = ClientErrorCode.RequestTimeout
  readonly name = "RequestTimeoutError"

  constructor(message = "Request has timed out") {
    super(message)
  }

  static rejectAfterTimeout<T>(
    promise: Promise<T>,
    timeoutMS: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new RequestTimeoutError())
      }, timeoutMS)

      promise
        .then(resolve)
        .catch(reject)
        .then(() => clearTimeout(timeoutId))
    })
  }
}
