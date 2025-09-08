import { EvriCredentialsSchema } from "@/modules/evri/evri.schemas"
import { getTokenFromEvri } from "@/modules/evri/evri.services"
import { HTTPException } from "hono/http-exception"
import { prisma } from "prisma"
import type { AppOpenAPI } from "./types"

export function configureEvriCallback(app: AppOpenAPI) {
  app.get("/oauth/evri/callback", async (c) => {
    const code = c.req.query("code")
    const carrierId = c.req.query("state")

    if (!carrierId) {
      throw new HTTPException(400, { message: "No state found" })
    }

    if (!code) {
      throw new HTTPException(400, { message: "No code found" })
    }

    const carrier = await prisma.carrier.findUnique({
      where: { id: carrierId },
      select: {
        credentials: true,
      },
    })

    if (!carrier) {
      throw new HTTPException(400, { message: "Failed to integrate. Try again" })
    }

    const creds = EvriCredentialsSchema.parse(carrier.credentials)

    const token = await getTokenFromEvri({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      code: code,
    })

    if (!token?.access_token) {
      throw new HTTPException(400, { message: "Failed to integrate. Try again" })
    }

    const updatedCarrier = await prisma.carrier.update({
      where: { id: carrierId },
      data: { credentials: { ...(creds as object), accessToken: token.access_token } },
    })

    if (!updatedCarrier) {
      throw new HTTPException(400, { message: "Failed to integrate. Try again" })
    }

    return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Evri Authorization Successful</title>
      <style>
        body {
          font-family: "Segoe UI", Roboto, Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background: #F5F7FA;
          margin: 0;
        }
        .card {
          background: white;
          padding: 2.5rem 3rem;
          border-radius: 1rem;
          box-shadow: 0 6px 18px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 420px;
          width: 100%;
          animation: fadeIn 0.4s ease-in-out;
        }
        h1 {
          color: #00B6F0;
          font-size: 1.8rem;
          margin-bottom: 1rem;
        }
        p {
          color: #1C1C1C;
          font-size: 1rem;
          margin-bottom: 2rem;
        }
        .button {
          display: inline-block;
          background: #00B6F0;
          color: white;
          padding: 0.85rem 1.8rem;
          border-radius: 0.5rem;
          text-decoration: none;
          font-weight: 600;
          transition: background 0.2s ease;
        }
        .button:hover {
          background: #009BCC;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Connected with Evri</h1>
        <p>Your Evri account has been linked successfully. You can now continue using our services.</p>
        <a class="button" href="/">Return to Dashboard</a>
      </div>
    </body>
    </html>
  `)
  })
}
