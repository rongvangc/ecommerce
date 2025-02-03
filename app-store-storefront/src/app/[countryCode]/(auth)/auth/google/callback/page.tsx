import { Metadata } from "next";
import { decodeToken } from "react-jwt";

type Props = {
    searchParams: { code: string; state: string };
}

export const metadata: Metadata = {
  title: "Google Callback",
  description: "Google Callback",
}

export default async function GoogleCallbackPage({ searchParams }: Props) {
  const { code, state } = searchParams;

  if (!code || !state) {
    return <div>Missing code or state</div>;
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

      return (
        <div>
          <h1>Customer Data</h1>
          <pre>{JSON.stringify(customer, null, 2)}</pre>
        </div>
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return <div>Error: {error?.message}</div>;
  }

  return <div>Loading...</div>;
}
