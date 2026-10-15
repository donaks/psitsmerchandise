"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import AddressSelector from "@/components/address-selector";

declare global {
  interface Window {
    Tesseract?: {
      recognize: (file: File, language: string, options: { logger: (message: { status?: string; progress?: number }) => void }) => Promise<{ data: { text: string } }>;
    };
  }
}

type Scan = { text: string; reference: string | null; amountOk: boolean; date: string | null };

const parseScan = (text: string): Scan => {
  const normalized = text.replace(/[|]/g, "I").toUpperCase();
  const labeled = normalized.match(/(?:REF(?:ERENCE)?(?:\s*(?:NO|NUMBER|#))?|TRACE(?:\s*(?:NO|NUMBER|#))?)[\s:.-]*([A-Z0-9-]{8,28})/);
  const fallback = normalized.match(/\b\d{12,18}\b/);
  const date = text.match(/\b(?:\d{1,2}[\/-]){2}\d{2,4}(?:\s+\d{1,2}:\d{2}(?:\s*[AP]M)?)?/i)?.[0] ?? null;
  return { text, reference: (labeled?.[1] ?? fallback?.[0] ?? null)?.replace(/[^A-Z0-9]/gi, "") ?? null, amountOk: /(?:PHP|₱|P)?\s*630(?:[.,]00)?\b/i.test(text), date };
};

function loadTesseract() {
  return new Promise<void>((resolve, reject) => {
    if (window.Tesseract) return resolve();
    const existing = document.querySelector<HTMLScriptElement>("script[data-ocr]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("OCR failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.dataset.ocr = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("OCR failed to load"));
    document.head.appendChild(script);
  });
}

export default function Home() {
  const [receipt, setReceipt] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "scanning" | "ready" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const scanReady = useMemo(() => Boolean(scan?.reference && scan.amountOk && /gcash/i.test(scan.text)), [scan]);

  async function readReceipt(file: File) {
    setReceipt(file); setPreview(URL.createObjectURL(file)); setScan(null); setStatus("scanning"); setProgress(0); setMessage("Reading your GCash receipt…");
    try {
      await loadTesseract();
      const result = await window.Tesseract!.recognize(file, "eng", { logger: event => { if (event.status === "recognizing text") setProgress(Math.round((event.progress ?? 0) * 100)); } });
      const parsed = parseScan(result.data.text);
      const valid = Boolean(parsed.reference && parsed.amountOk && /gcash/i.test(parsed.text));
      setScan(parsed); setStatus(valid ? "ready" : "error");
      setMessage(valid ? "Receipt details found. Review them before submitting." : "We could not validate the receipt. Use a clear, uncropped GCash screenshot showing ₱630.00 and the reference number.");
    } catch {
      setStatus("error"); setMessage("Receipt reading could not start. Check your connection and try again.");
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receipt || !scan || !scanReady) return;
    setStatus("submitting"); setMessage("Checking for duplicate transactions and saving your order…");
    const data = new FormData(event.currentTarget); data.set("receipt", receipt); data.set("extractedText", scan.text); data.set("transactionDate", scan.date ?? "");
    try {
      const response = await fetch("/api/orders", { method: "POST", body: data });
      const result = await response.json() as { error?: string; orderId?: number; reference?: string };
      if (!response.ok) throw new Error(result.error ?? "Submission failed");
      setStatus("success"); setMessage(`Order #${result.orderId} received. GCash reference ${result.reference} is now pending organizer review.`);
      formRef.current?.reset(); setReceipt(null); setPreview(null); setScan(null);
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Submission failed. Please try again."); }
  }

  return (
    <main>
      <div className="ticker">14TH PSITS REGIONAL CONVENTION <span>•</span> ONE COMPLETE KIT <span>•</span> SECURE GCASH SUBMISSION</div>
      <header><a className="brand" href="#top"><img className="brandLogo" src="/psits-region-xii-seal.png" alt="PSITS Region XII seal"/><div>PSITS<small>REGIONAL CONVENTION</small></div></a><a className="navCta" href="#order">Order Kit</a></header>
      <section className="hero" id="top">
        <div className="heroCopy"><img className="eventLogo" src="/psits-14-official.png" alt="14th PSITS Regional Convention — From Ideas to Impact: IT as the Core Driver of Innovation"/><p className="eyebrow">Official convention bundle</p><h1>ONE KIT.<br/><em>ALL IN.</em></h1><p className="lede">Jersey, lanyard, commemorative pin, and graphic tote—one complete PSITS convention set.</p><div className="price"><small>COMPLETE KIT</small><strong>₱630.00</strong></div><a className="primary" href="#order">Order & upload receipt ↓</a></div>
        <div className="heroVisual"><img src="/psits-kit.png" alt="14th PSITS Regional Convention bundle with jersey, tote bag, lanyard and pin"/><div className="stamp">4 PIECES<br/>1 KIT</div></div>
      </section>
      <section className="kitStrip"><div><b>01</b><span>Convention Jersey</span></div><div><b>02</b><span>Event Lanyard</span></div><div><b>03</b><span>Button Pin</span></div><div><b>04</b><span>Graphic Tote</span></div></section>
      <section className="orderSection" id="order">
        <div className="orderIntro"><p className="eyebrow">Payment & reservation</p><h2>PAY. UPLOAD.<br/><em>YOU&apos;RE IN.</em></h2><p>Send exactly <b>₱630.00</b> through GCash, then upload the original transaction receipt. The system reads the receipt, checks the reference number, and rejects duplicate submissions.</p><div className="gcashCard"><span>GCASH NUMBER</span><strong>0945 406 2928</strong><button type="button" onClick={() => navigator.clipboard.writeText("09454062928")}>Copy number</button><img className="gcashQr" src="/gcash-qr-630.jpg" alt="GCash QR code for the ₱630.00 complete convention kit"/><small>Scan to pay ₱630.00</small></div><div className="securityNote"><b>Duplicate protection</b><p>Every reference number and receipt image fingerprint can only be used once.</p></div></div>
        <form ref={formRef} onSubmit={submitOrder} className="orderForm">
          <div className="formTitle"><span>STEP 01</span><h3>Customer details</h3></div>
          <div className="twoCol"><label>Client name<input name="clientName" required minLength={2} placeholder="Juan Dela Cruz"/></label><label>Email address<input name="email" type="email" required placeholder="juan@email.com"/></label></div>
          <div className="twoCol"><label>Contact number<input name="contactNo" inputMode="tel" required pattern="(?:\+63|0)9[0-9]{9}" placeholder="09XXXXXXXXX"/></label><label>Jersey size<select name="jerseySize" required defaultValue=""><option value="" disabled>Select size</option>{["XS","S","M","L","XL","2XL","3XL"].map(item => <option key={item}>{item}</option>)}</select></label></div>
          <AddressSelector prefix="billing" legend="Billing address" />
          <AddressSelector prefix="shipping" legend="Shipping address" />
          <div className="formTitle second"><span>STEP 02</span><h3>GCash receipt</h3></div>
          <label className={`upload ${preview ? "hasPreview" : ""}`}>{preview ? <img src={preview} alt="Selected GCash receipt preview"/> : <><div className="uploadIcon">↑</div><b>Upload transaction receipt</b><span>JPG, PNG or WebP • 8 MB maximum</span></>}<input type="file" accept="image/png,image/jpeg,image/webp" required onChange={event => { const file=event.target.files?.[0]; if(file) void readReceipt(file); }}/>{preview && <span className="replace">Choose a different image</span>}</label>
          {status === "scanning" && <div className="scanBox"><div><b>Reading receipt</b><span>{progress}%</span></div><progress value={progress} max="100"/></div>}
          {scan && <div className={`scanResult ${scanReady ? "valid" : "invalid"}`}><div className="scanHead"><b>{scanReady ? "Receipt details detected" : "Receipt needs attention"}</b><span>{scanReady ? "VALIDATED" : "NOT READY"}</span></div><dl><div><dt>Amount</dt><dd>{scan.amountOk ? "₱630.00" : "Not found"}</dd></div><div><dt>Reference no.</dt><dd>{scan.reference ?? "Not found"}</dd></div><div><dt>Date / time</dt><dd>{scan.date ?? "Will be reviewed"}</dd></div></dl></div>}
          {message && <div className={`message ${status}`}>{message}</div>}
          <label className="consent"><input type="checkbox" required/> I confirm that the information is correct and authorize PSITS organizers to review this receipt for order verification.</label>
          <button className="submit" disabled={!scanReady || status === "submitting" || status === "success"}>{status === "submitting" ? "Saving order…" : "Submit ₱630 kit order"}</button>
          <p className="privacy">Customer details and the receipt are stored securely for order verification. Successful OCR checks remain subject to organizer review.</p>
        </form>
      </section>
      <section className="tote"><img src="/psits-tote.jpg" alt="PSITS Region Twelve graphic tote bag"/><div><p className="eyebrow">Included in every kit</p><h2>CARRY THE<br/>CONVENTION.</h2><p>The complete bundle includes the official graphic tote—ready for your convention essentials.</p></div></section>
      <footer><div className="brand"><img className="brandLogo" src="/psits-region-xii-seal.png" alt="PSITS Region XII seal"/><div>PSITS<small>REGIONAL CONVENTION</small></div></div><p>Payment confirmation is finalized by the event organizers.</p></footer>
    </main>
  );
}
