import xior from "xior"
import errorRetryPlugin from "xior/plugins/error-retry"

export const http = xior.create()
http.plugins.use(errorRetryPlugin({ retryTimes: 1, retryInterval: 1_000 }))
