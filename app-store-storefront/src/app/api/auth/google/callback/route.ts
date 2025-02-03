import { NextResponse } from "next/server";
import { decodeToken } from "react-jwt";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state" },
      { status: 400 }
    );
  }

  const sendCallback = async () => {
    const response = await fetch(
      `http://localhost:9000/auth/customer/google/callback?code=${code}&state=${state}`,
      {
        credentials: "include",
        method: "POST",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch token");
    }

    const data = await response.json();
    return data.token;
  };

  const createCustomer = async (token: string) => {
    await fetch(`http://localhost:9000/store/customers`, {
      credentials: "include",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-publishable-api-key":
          process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "temp",
      },
      body: JSON.stringify({
        email: "example@medusajs.com",
      }),
    });
  };

  const refreshToken = async (token: string) => {
    const response = await fetch(`http://localhost:9000/auth/token/refresh`, {
      credentials: "include",
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return data.token;
  };

  try {
    let token = await sendCallback();

    if (token) {
      const shouldCreateCustomer = (decodeToken(token) as { actor_id: string })
        .actor_id === "";

      if (shouldCreateCustomer) {
        await createCustomer(token);
        token = await refreshToken(token);
      }

      const customerResponse = await fetch(
        `http://localhost:9000/store/customers/me`,
        {
          credentials: "include",
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "x-publishable-api-key":
              process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "temp",
          },
        }
      );

      const customer = await customerResponse.json();
      console.log("Customer:", customer);

      return NextResponse.json({ customer });
    }
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}