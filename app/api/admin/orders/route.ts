import { env } from "cloudflare:workers";
import { adminIdentity, requireAdmin } from "../../../../lib/admin-auth";

export const runtime = "edge";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const rows = await env.DB.prepare(
    `SELECT id, client_name AS clientName, email, contact_no AS contactNo,
      billing_address AS billingAddress, shipping_address AS shippingAddress,
      jersey_size AS jerseySize, amount_centavos AS amountCentavos,
      gcash_reference AS gcashReference, transaction_date AS transactionDate,
      validation_status AS validationStatus, admin_notes AS adminNotes,
      reviewed_at AS reviewedAt, reviewed_by AS reviewedBy, created_at AS createdAt
     FROM orders ORDER BY created_at DESC LIMIT 500`
  ).all();
  return Response.json({ orders: rows.results });
}

export async function PATCH(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await request.json() as { id?: number; decision?: string; notes?: string };
  const id = Number(body.id);
  const decision = body.decision;
  const notes = String(body.notes ?? "").trim().slice(0, 1000);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Invalid order." }, { status: 400 });
  if (decision !== "approved" && decision !== "declined" && decision !== "pending_review") return Response.json({ error: "Invalid decision." }, { status: 400 });
  const result = await env.DB.prepare(
    `UPDATE orders SET validation_status = ?1, admin_notes = ?2, reviewed_at = ?3,
      reviewed_by = ?4 WHERE id = ?5`
  ).bind(decision, notes, decision === "pending_review" ? null : new Date().toISOString(), adminIdentity(request), id).run();
  if (!result.meta.changes) return Response.json({ error: "Order not found." }, { status: 404 });
  return Response.json({ ok: true, id, status: decision });
}
