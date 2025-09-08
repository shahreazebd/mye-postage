import { app } from "@/app"
import { env } from "@/lib/env"
import type { ServerWebSocket } from "bun"
import { createBunWebSocket } from "hono/bun"

// Store all connected WebSocket clients
export const wsClients = new Set<ServerWebSocket>()

export function broadcast(message: { event: string; data: object }) {
  for (const client of wsClients) {
    client.send(JSON.stringify(message))
  }
}

const { upgradeWebSocket, websocket } = createBunWebSocket()

app.get("/client", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>WebSocket Chat</title>
      </head>
      <body>
        <h1>WebSocket Chat</h1>
        <button onclick="connect()">Connect</button>
        <div id="messages"></div>
        <input id="message" placeholder="Type a message" />
        <button onclick="sendMessage()">Send</button>
        <script>
          let ws;
          function connect() {

            ws = new WebSocket('http://localhost:9099/ws?tokens=shahreaz');

            ws.onmessage = (event) => {
              const messages = document.getElementById('messages');
              const message = document.createElement('div');
              message.textContent = event.data;
              messages.appendChild(message);
            };
            ws.onopen = () => console.log('Connected');
            ws.onclose = () => console.log('Disconnected');
          }
          function sendMessage() {
            const input = document.getElementById('message');
            // ws.send(input.value);

            ws.send(JSON.stringify({event: "join-room", data: {companyId: "company-uuid-01"}}))
            input.value = '';
          }
        </script>
      </body>
    </html>
  `)
})

app.get("/send-message", (c) => {
  broadcast({ event: "order-data", data: { order: "order-id-01" } })
  return c.json({ name: "hello" })
})

app.get(
  "/ws",
  upgradeWebSocket((c) => {
    const jwtPayload = c.req.query("tokens")

    console.log({ jwtPayload })

    return {
      onOpen(_event, ws) {
        console.log("WebSocket connection opened")
        const rawWs = ws.raw as ServerWebSocket

        wsClients.add(rawWs)
      },
      onMessage(event, ws) {
        const data = JSON.parse(event.data as string)

        if (data.event === "join-room") {
          console.log(data.data)
        }

        ws.send(`Server received: ${event.data}`)
      },
      onClose(_event, ws) {
        console.log("WebSocket connection closed")

        wsClients.delete(ws.raw as ServerWebSocket)
      },
    }
  }),
)

Bun.serve({
  idleTimeout: 255,
  port: env.PORT,
  fetch: app.fetch,
  websocket,
})

export default app
