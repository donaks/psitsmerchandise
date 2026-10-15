import { env } from "cloudflare:workers";

export const runtime = "edge";

const KIT_AMOUNT_CENTAVOS = 65000;
const ALLOWED_SIZES = new Set(["XS", "S", "M", "L", "XL", "2XL", "3XL"]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function extractReference(text: string) {
  const normalized = text.replace(/[|]/g, "I").toUpperCase();
  const labeled = normalized.match(
    /(?:REF(?:ERENCE)?(?:\s*(?:NO|NUMBER|#))?|TRACE(?:\s*(?:NO|NUMBER|#))?)[\s:.-]*([A-Z0-9-]{8,28})/
  );
  if (labeled?.[1]) return labeled[1].replace(/[^A-Z0-9]/g, "");
  const longNumber = normalized.match(/\b\d{12,18}\b/);
  return longNumber?.[0] ?? null;
}

function receiptHasCorrectAmount(text: string) {
  return /(?:PHP|₱|P)?\s*650(?:[.,]00)?\b/i.test(text);
}

function safeExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const clientName = String(form.get("clientName") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const contactNo = String(form.get("contactNo") ?? "").replace(/[^0-9+]/g, "");
    const billingAddress = {
      line1: String(form.get("billingLine1") ?? "").trim(),
      city: String(form.get("billingCity") ?? "").trim(),
      province: String(form.get("billingProvince") ?? "").trim(),
      barangay: String(form.get("billingBarangay") ?? "").trim(),
      postalCode: String(form.get("billingPostalCode") ?? "").trim(),
    };
    const shippingAddress = {
      line1: String(form.get("shippingLine1") ?? "").trim(),
      city: String(form.get("shippingCity") ?? "").trim(),
      province: String(form.get("shippingProvince") ?? "").trim(),
      barangay: String(form.get("shippingBarangay") ?? "").trim(),
      postalCode: String(form.get("shippingPostalCode") ?? "").trim(),
    };
    const jerseySize = String(form.get("jerseySize") ?? "").trim();
    const extractedText = String(form.get("extractedText") ?? "").trim().slice(0, 12000);
    const transactionDate = String(form.get("transactionDate") ?? "").trim().slice(0, 80) || null;
    const receipt = form.get("receipt");

    if (clientName.length < 2 || clientName.length > 120) return json({ error: "Enter the client's full name." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
    if (!/^(?:\+63|0)9\d{9}$/.test(contactNo)) return json({ error: "Enter a valid Philippine mobile number." }, 400);
    if (Object.values(billingAddress).some((value) => value.length < 2 || value.length > 160)) return json({ error: "Complete the billing address." }, 400);
    if (Object.values(shippingAddress).some((value) => value.length < 2 || value.length > 160)) return json({ error: "Complete the shipping address." }, 400);
    if (!ALLOWED_SIZES.has(jerseySize)) return json({ error: "Select a valid jersey size." }, 400);
    if (!(receipt instanceof File) || !receipt.type.startsWith("image/")) return json({ error: "Upload a JPG, PNG, or WebP receipt image." }, 400);
    if (receipt.size < 10_000 || receipt.size > 8_000_000) return json({ error: "Receipt image must be between 10 KB and 8 MB." }, 400);
    if (!/GCASH/i.test(extractedText)) return json({ error: "The uploaded image was not recognized as a GCash receipt." }, 422);
    if (!receiptHasCorrectAmount(extractedText)) return json({ error: "The receipt amount must be exactly ₱650.00." }, 422);

    const gcashReference = extractReference(extractedText);
    if (!gcashReference || gcashReference.length < 8) return json({ error: "No valid GCash reference number was detected. Upload a clearer receipt." }, 422);

    const bytes = await receipt.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const receiptHash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
    const duplicate = await env.DB.prepare(
      "SELECT id, gcash_reference AS reference FROM orders WHERE gcash_reference = ?1 OR receipt_hash = ?2 LIMIT 1"
    ).bind(gcashReference, receiptHash).first<{ id: number; reference: string }>();
    if (duplicate) return json({ error: "This GCash transaction receipt has already been submitted.", duplicate: true }, 409);

    const receiptKey = `receipts/${new Date().toISOString().slice(0, 10)}/${receiptHash}.${safeExtension(receipt)}`;
    await env.BUCKET.put(receiptKey, bytes, {
      httpMetadata: { contentType: receipt.type },
      customMetadata: { gcashReference, clientName },
    });

    try {
      const result = await env.DB.prepare(
        `INSERT INTO orders
          (client_name, email, contact_no, billing_address, shipping_address, jersey_size,
           amount_centavos, gcash_reference, transaction_date, receipt_hash, receipt_key,
           extracted_text, validation_status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'pending_review', ?13)`
      ).bind(
        clientName, email, contactNo, JSON.stringify(billingAddress), JSON.stringify(shippingAddress),
        jerseySize, KIT_AMOUNT_CENTAVOS, gcashReference, transactionDate, receiptHash,
        receiptKey, extractedText, new Date().toISOString()
      ).run();
      return json({
        ok: true,
        orderId: result.meta.last_row_id,
        reference: gcashReference,
        amount: "₱650.00",
        status: "pending_review",
      }, 201);
    } catch (error) {
      await env.BUCKET.delete(receiptKey);
      const message = error instanceof Error ? error.message : "";
      if (/unique|constraint/i.test(message)) return json({ error: "This GCash transaction receipt has already been submitted.", duplicate: true }, 409);
      throw error;
    }
  } catch (error) {
    console.error("Order submission failed", error);
    return json({ error: "We could not save this order. Please try again." }, 500);
  }
}
