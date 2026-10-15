"use client";

import { useEffect, useMemo, useState } from "react";
import "./admin.css";
import "./admin-brand.css";

type Address = { line1?: string; barangay?: string; city?: string; province?: string; postalCode?: string };
type Order = {
  id: number; clientName: string; email: string; contactNo: string; billingAddress: string;
  shippingAddress: string; jerseySize: string; amountCentavos: number; gcashReference: string;
  transactionDate: string | null; validationStatus: "pending_review" | "approved" | "declined";
  adminNotes: string; reviewedAt: string | null; reviewedBy: string | null; createdAt: string;
};

const peso = (centavos: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(centavos / 100);
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const address = (value: string) => { try { return JSON.parse(value) as Address; } catch { return {}; } };
const addressLine = (value: string) => { const item = address(value); return [item.line1, item.barangay, item.city, item.province, item.postalCode].filter(Boolean).join(", ") || "Not provided"; };

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try { const response = await fetch("/api/admin/orders", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setOrders(result.orders); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load orders."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const kpis = useMemo(() => ({
    total: orders.length,
    pending: orders.filter(item => item.validationStatus === "pending_review").length,
    approved: orders.filter(item => item.validationStatus === "approved").length,
    declined: orders.filter(item => item.validationStatus === "declined").length,
    revenue: orders.filter(item => item.validationStatus === "approved").reduce((sum, item) => sum + item.amountCentavos, 0),
  }), [orders]);
  const visible = useMemo(() => orders.filter(item => {
    const matchesFilter = filter === "all" || item.validationStatus === filter;
    const haystack = `${item.clientName} ${item.email} ${item.contactNo} ${item.gcashReference}`.toLowerCase();
    return matchesFilter && haystack.includes(query.toLowerCase());
  }), [orders, filter, query]);

  function choose(order: Order) { setSelected(order); setNotes(order.adminNotes ?? ""); }
  async function decide(decision: "approved" | "declined" | "pending_review") {
    if (!selected) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/admin/orders", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: selected.id, decision, notes }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setOrders(items => items.map(item => item.id === selected.id ? { ...item, validationStatus: decision, adminNotes: notes, reviewedAt: new Date().toISOString() } : item));
      setSelected(current => current ? { ...current, validationStatus: decision, adminNotes: notes } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update order."); }
    finally { setSaving(false); }
  }

  return <main className="adminShell">
    <aside className="adminNav"><a className="adminBrand" href="/"><img src="/psits-region-xii-seal.png" alt="PSITS Region XII seal"/><div>PSITS<small>ADMIN CONSOLE</small></div></a><nav><a className="active" href="#dashboard">Overview</a><a href="#orders">Orders</a><a href="/">View storefront ↗</a></nav><div className="adminSecure">● OWNER ACCESS</div></aside>
    <section className="adminMain" id="dashboard">
      <header className="adminHeader"><div><p>14TH REGIONAL CONVENTION</p><h1>Order verification</h1></div><button onClick={() => void load()}>Refresh data</button></header>
      {error && <div className="adminError">{error}</div>}
      <div className="kpiGrid"><article><span>TOTAL ORDERS</span><b>{kpis.total}</b><small>All submissions</small></article><article className="pending"><span>PENDING REVIEW</span><b>{kpis.pending}</b><small>Needs attention</small></article><article className="approved"><span>APPROVED</span><b>{kpis.approved}</b><small>{peso(kpis.revenue)} verified</small></article><article className="declined"><span>DECLINED</span><b>{kpis.declined}</b><small>Rejected payments</small></article></div>
      <section className="ordersPanel" id="orders"><div className="panelHead"><div><span>PAYMENT QUEUE</span><h2>Customer orders</h2></div><div className="adminTools"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, email, reference…"/><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All statuses</option><option value="pending_review">Pending</option><option value="approved">Approved</option><option value="declined">Declined</option></select></div></div>
        {loading ? <div className="emptyAdmin">Loading order records…</div> : visible.length === 0 ? <div className="emptyAdmin">No matching orders found.</div> : <div className="orderTable"><div className="tableRow tableLabels"><span>Customer</span><span>Payment</span><span>Submitted</span><span>Status</span><span></span></div>{visible.map(order => <button className="tableRow" key={order.id} onClick={() => choose(order)}><span><b>{order.clientName}</b><small>{order.email}<br/>{order.contactNo}</small></span><span><b>{peso(order.amountCentavos)}</b><small>{order.gcashReference}</small></span><span>{date(order.createdAt)}</span><span><i className={`status ${order.validationStatus}`}>{order.validationStatus.replace("_", " ")}</i></span><span className="arrow">→</span></button>)}</div>}
      </section>
    </section>
    {selected && <div className="reviewOverlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="reviewDrawer"><div className="reviewTop"><div><span>ORDER #{selected.id}</span><h2>Verify payment</h2></div><button onClick={() => setSelected(null)}>×</button></div><img className="receiptImage" src={`/api/admin/receipts/${selected.id}`} alt={`GCash receipt for order ${selected.id}`}/><div className="receiptFacts"><div><span>Amount</span><b>{peso(selected.amountCentavos)}</b></div><div><span>GCash reference</span><b>{selected.gcashReference}</b></div><div><span>Transaction date</span><b>{selected.transactionDate ?? "Not detected"}</b></div></div><div className="customerBlock"><h3>Customer details</h3><p><b>{selected.clientName}</b><br/>{selected.email}<br/>{selected.contactNo}<br/>Jersey: {selected.jerseySize}</p><h3>Billing address</h3><p>{addressLine(selected.billingAddress)}</p><h3>Shipping address</h3><p>{addressLine(selected.shippingAddress)}</p></div><label className="notesLabel">Review notes<textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Optional internal note…" maxLength={1000}/></label><div className="decisionBar"><button className="declineBtn" disabled={saving} onClick={() => void decide("declined")}>Decline</button><button className="approveBtn" disabled={saving} onClick={() => void decide("approved")}>{saving ? "Saving…" : "Approve receipt"}</button></div>{selected.validationStatus !== "pending_review" && <button className="resetBtn" disabled={saving} onClick={() => void decide("pending_review")}>Return to pending review</button>}</aside></div>}
  </main>;
}
