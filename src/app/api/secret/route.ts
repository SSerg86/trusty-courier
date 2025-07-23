import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { kv } from "@vercel/kv";

export async function POST(request: Request) {
  try {
    const { encryptedData } = await request.json();
    const id = nanoid(12);

    // Store the secret in Vercel KV with a 24-hour expiration
    await kv.set(id, { encryptedData }, { ex: 60 * 60 * 24 });

    return NextResponse.json({ id });
  } catch (error) {
    console.error(error);
    return new Response("Error creating secret", { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new Response("Secret ID is missing", { status: 400 });
    }

    const secretData = await kv.get(id);

    if (!secretData) {
      return new Response("Secret not found or already viewed", {
        status: 404,
      });
    }

    // Atomically get and delete the secret
    await kv.del(id);

    return NextResponse.json(secretData);
  } catch (error) {
    console.error(error);
    return new Response("Error retrieving secret", { status: 500 });
  }
}
