import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/admin-auth";

export const runtime = "edge";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return new Response("Invalid order", { status: 400 });
  const row = await env.DB.prepare("SELECT receipt_key AS receiptKey FROM orders WHERE id = ?1").bind(Number(id)).first<{ receiptKey: string }>();
  if (!row) return new Response("Receipt not found", { status: 404 });
  const object = await env.BUCKET.get(row.receiptKey);
  if (!object) return new Response("Receipt not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, no-store");
  headers.set("content-security-policy", "default-src 'none'; img-src 'self'");
  return new Response(object.body, { headers });
}
