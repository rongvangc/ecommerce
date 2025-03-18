import { setAuthToken } from "@lib/data/cookies"
import { revalidateTag } from "next/cache"
import { NextRequest } from "next/server"
import { decodeToken } from "react-jwt"

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "temp"

const defaultHeaders = {
  "Content-Type": "application/json",
  "x-publishable-api-key": PUBLISHABLE_KEY,
}

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`)
  }

  return response.json()
}

export async function GET(
  request: NextRequest,
  { params }: { params: { countryCode: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const { countryCode } = params

    if (!code || !state) {
      return Response.json({ error: "Missing code or state" }, { status: 400 })
    }

    const data = await fetchWithAuth(
      `${BACKEND_URL}/auth/customer/google/callback?code=${code}&state=${state}`,
      { method: "POST" }
    )
    let token = data.token

    if (token) {
      const shouldCreateCustomer =
        (decodeToken(token) as { actor_id: string }).actor_id === ""

      if (shouldCreateCustomer) {
        await fetchWithAuth(`${BACKEND_URL}/store/customers`, {
          method: "POST",
          headers: {
            ...defaultHeaders,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: "example@medusajs.com",
          }),
        })

        const refreshResult = await fetchWithAuth(
          `${BACKEND_URL}/auth/token/refresh`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )
        token = refreshResult.token
      }

      const { customer } = await fetchWithAuth(
        `${BACKEND_URL}/store/customers/me`,
        {
          headers: {
            ...defaultHeaders,
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (customer) {
        await setAuthToken(token)
        revalidateTag("customer")
        return Response.redirect(
          new URL(`/${countryCode}/account`, request.url)
        )
      }
    }

    return Response.redirect(
      new URL(`/${countryCode}/account/login`, request.url)
    )
  } catch (error) {
    console.error("Error:", error)
    return Response.json({ error: "Authentication failed" }, { status: 500 })
  }
}
