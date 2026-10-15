import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientName: text("client_name").notNull(),
    email: text("email").notNull(),
    contactNo: text("contact_no").notNull(),
    billingAddress: text("billing_address").notNull().default("{}"),
    shippingAddress: text("shipping_address").notNull().default("{}"),
    jerseySize: text("jersey_size").notNull(),
    amountCentavos: integer("amount_centavos").notNull(),
    gcashReference: text("gcash_reference").notNull(),
    transactionDate: text("transaction_date"),
    receiptHash: text("receipt_hash").notNull(),
    receiptKey: text("receipt_key").notNull(),
    extractedText: text("extracted_text").notNull(),
    validationStatus: text("validation_status").notNull().default("pending_review"),
    adminNotes: text("admin_notes").notNull().default(""),
    reviewedAt: text("reviewed_at"),
    reviewedBy: text("reviewed_by"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("orders_gcash_reference_unique").on(table.gcashReference),
    uniqueIndex("orders_receipt_hash_unique").on(table.receiptHash),
  ]
);
