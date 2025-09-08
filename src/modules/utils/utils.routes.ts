import { createRoute, z } from "@hono/zod-openapi"
import { createErrorSchema } from "stoker/openapi/schemas"
import {
  ConvertFileSchema,
  ConvertPdfSchema,
  FindZPLSchema,
  UploadFileSchema,
  ValidateAddressSchema,
} from "./utils.schema"

const tags = ["Utils"]

export const convertFile = createRoute({
  tags,
  method: "post",
  path: "/utils/convert/file",
  summary: "Convert a URL to a PDF",
  description: "Convert a URL to a Postage file.",
  request: {
    body: {
      description: "The URL to convert to a Postage file",
      content: {
        "application/json": {
          schema: ConvertFileSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "successful operation",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            message: z
              .string()
              .openapi({ example: "URL to file converted successfully" }),
            base64: z.string().optional(),
          }),
        },
      },
    },
    400: {
      description: "bad request",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: false }),
            message: z.string().openapi({ example: "Invalid HTML string" }),
            invalid: z.array(z.string()).openapi({
              example: ["https://example.com/invalid-url"],
            }),
          }),
        },
      },
    },
    422: {
      description: "invalid body",
      content: {
        "application/json": {
          schema: createErrorSchema(ConvertFileSchema),
        },
      },
    },
  },
})

export const mergePDF = createRoute({
  tags,
  method: "post",
  path: "/utils/pdf/merge",
  summary: "Merge PDF from URL",
  description: "Convert a URL to a PDF",
  request: {
    body: {
      description: "The URL to convert to a Postage file",
      content: {
        "application/json": {
          schema: ConvertFileSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "successful operation",
      content: {
        "application/pdf": {
          schema: z.any().openapi({
            type: "string",
            format: "binary",
            example: "<binary-pdf-content>",
          }),
        },
      },
    },
    400: {
      description: "bad request",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: false }),
            message: z.string().openapi({ example: "Invalid HTML string" }),
            invalid: z.array(z.string()).openapi({
              example: ["https://example.com/invalid-url"],
            }),
          }),
        },
      },
    },
    422: {
      description: "invalid body",
      content: {
        "application/json": {
          schema: createErrorSchema(ConvertFileSchema),
        },
      },
    },
  },
})

export const convertPdf = createRoute({
  tags,
  method: "post",
  path: "/utils/convert/pdf",
  summary: "Convert html to PDF",
  description: "Convert a HTML string to a PDF file.",
  request: {
    body: {
      description: "The HTML string to convert to a PDF file",
      content: {
        "application/json": {
          schema: ConvertPdfSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "successful operation",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            message: z
              .string()
              .openapi({ example: "HTML string to PDF converted successfully" }),
            base64: z.string().openapi({ example: "base64-encoded-pdf-string" }),
          }),
        },
      },
    },
    400: {
      description: "bad request",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: false }),
            message: z.string().openapi({ example: "Invalid HTML string" }),
          }),
        },
      },
    },
    422: {
      description: "invalid body",
      content: {
        "application/json": {
          schema: createErrorSchema(ConvertPdfSchema),
        },
      },
    },
  },
})

export const findZPL = createRoute({
  tags,
  method: "post",
  path: "/utils/find/zpl",
  summary: "Find ZPL",
  description: "Find ZPL for a given url.",
  request: {
    body: {
      description: "The url to find ZPL for",
      content: {
        "application/json": {
          schema: FindZPLSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "successful operation",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            message: z.string().openapi({ example: "ZPL found successfully" }),
            isZPLFound: z.boolean().openapi({ example: true }),
            zpl: z.array(z.string()).openapi({ example: ["zpl-string"] }),
            pdf: z.array(z.string()).openapi({ example: ["base64-encoded-pdf-string"] }),
          }),
        },
      },
    },
    422: {
      description: "invalid body",
      content: {
        "application/json": {
          schema: createErrorSchema(FindZPLSchema),
        },
      },
    },
  },
})

export const uploadFile = createRoute({
  tags,
  method: "post",
  path: "/utils/upload/file",
  summary: "Upload a file",
  description: "Upload a file.",
  request: {
    body: {
      description: "The file to upload",
      content: {
        "application/json": {
          schema: UploadFileSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "successful operation",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            message: z.string().openapi({ example: "File uploaded successfully" }),
          }),
        },
      },
    },
    422: {
      description: "invalid body",
      content: {
        "application/json": {
          schema: createErrorSchema(FindZPLSchema),
        },
      },
    },
  },
})

export const validateAddress = createRoute({
  tags,
  method: "post",
  path: "/utils/address/validate",
  summary: "Validate Address List",
  description: "Validate addresses in bulk",
  request: {
    body: {
      description: "Validate addresses in bulk",
      content: {
        "application/json": {
          schema: ValidateAddressSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "successful operation",
      content: {
        "application/json": {
          schema: z.any(),
        },
      },
    },
    422: {
      description: "invalid body",
      content: {
        "application/json": {
          schema: createErrorSchema(ValidateAddressSchema),
        },
      },
    },
  },
})

export type ConvertFileRoute = typeof convertFile
export type ConvertPdfRoute = typeof convertPdf
export type FindZPLRoute = typeof findZPL
export type UploadFileRoute = typeof uploadFile
export type ValidateAddressRoute = typeof validateAddress
export type MergePDFRoute = typeof mergePDF
