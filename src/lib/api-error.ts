import { env } from "./env"

/**
 * Custom error class for API errors, extending the base Error class.
 * Provides additional information such as HTTP status code, metadata, and an optional cause for error chaining.
 */
export class ApiError extends Error {
  // The HTTP status code associated with the error (e.g., 404, 500).
  public readonly statusCode: number

  // Additional metadata associated with the error, typically used for logging or debugging.
  public readonly meta: Record<string, unknown>

  /**
   * Creates an instance of ApiError.
   * @param message - A descriptive error message.
   * @param statusCode - The HTTP status code for the error. Defaults to 500 if not specified.
   * @param meta - An object containing additional information related to the error. Defaults to an empty object.
   * @param name - The name of the error. Defaults to the class name.
   */
  constructor(
    statusCode: number,
    message: string,
    meta: Record<string, unknown> = {},
    name?: string,
  ) {
    super(message) // Call the base Error constructor with the error message
    this.statusCode = statusCode
    this.meta = meta

    // Captures the stack trace and associates it with this class for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }

    // Sets the name property to the class name for better stack trace readability
    this.name = name ?? this.constructor.name
  }

  /**
   * Converts the ApiError instance to a JSON object, typically used for logging or sending error responses in APIs.
   * @returns A JSON object with relevant error details.
   */
  public toJSON(): {
    name: string
    message: string
    statusCode: number
    meta: Record<string, unknown>
    stack?: string
  } {
    // Conditionally include the stack trace only in development and for non-Zod errors
    const response: {
      name: string
      message: string
      statusCode: number
      meta: Record<string, unknown>
      stack?: string
    } = {
      name: this.name,
      message: this.name !== "zod" ? this.message : "Zod Validation Error",
      statusCode: this.statusCode,
      meta: this.meta,
    }

    if (env.NODE_ENV === "development" && this.name !== "zod") {
      response.stack = this.stack
    }

    return response
  }
}
