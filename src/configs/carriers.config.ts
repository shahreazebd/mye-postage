import { env } from "@/lib/env"

const isProd = env.NODE_ENV === "production"

export const carriersConfig = {
  dhl: {
    apiUrl: isProd ? "https://api.dhl.com" : "https://api-sandbox.dhl.com",
    environment: isProd ? "PRODUCTION" : "SANDBOX",
  },

  fedex: {
    apiUrl: isProd ? "https://apis.fedex.com" : "https://apis-sandbox.fedex.com",
    environment: isProd ? "PRODUCTION" : "SANDBOX",
  },

  royalmail: {
    apiUrl: "https://api.parcel.royalmail.com",
    environment: "PRODUCTION",
    limiter: {
      max: 2,
      duration: 1000,
    },
  },
  amazon: {
    apiUrl: "",
    environment: isProd ? "PRODUCTION" : "SANDBOX",
    limiter: {
      max: 5,
      duration: 1000,
    },
  },

  evri: {
    apiUrl: "https://api.myhermes.co.uk",
  },
}
