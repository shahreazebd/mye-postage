import pino from "pino"
import { env } from "./env"

export const logger = pino({
  level: env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: { colorize: true, translateTime: "yyyy-mm-dd HH:MM:ss" },
  },
})
