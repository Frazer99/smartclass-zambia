"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export default function PaywallModal({
  subjectId,
  subjectName,
  onClose,
  onSubscribed,
}: {
  subjectId: number;
  subjectName: string;
  onClose: () => void;
  onSubscribed: () => void;
}) {
  const [method, setMethod] = useState<"mtn_momo" | "airtel_money" | "visa">("mtn_momo");
  const [msisdn, setMsisdn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post("/api/billing/pay", { subject_id: subjectId, method, msisdn: msisdn || undefined });
      if (res.status === "success") {
        setResult(`Payment successful. Your ${subjectName} subscription is now active.`);
        setTimeout(() => onSubscribed(), 1200);
      } else {
        setResult("Payment initiated -- approve it on your phone to activate your subscription.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Payment failed, please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="card max-w-md w-full">
        <h3 className="text-xl font-bold text-brand-900">Your free trial has ended</h3>
        <p className="text-brand-700 mt-2">
          You've used your 10 free minutes for <strong>{subjectName}</strong>. Subscribe for{" "}
          <strong>K50/month</strong> to keep learning with your AI teacher, unlimited.
        </p>

        <div className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-brand-800">Payment method</label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["mtn_momo", "MTN Money"],
                ["airtel_money", "Airtel Money"],
                ["visa", "Visa Card"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setMethod(val)}
                className={`rounded-lg border px-2 py-2 text-sm font-semibold ${
                  method === val ? "bg-brand-600 text-white border-brand-600" : "border-brand-200 text-brand-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {(method === "mtn_momo" || method === "airtel_money") && (
            <div>
              <label className="block text-sm font-medium text-brand-800 mb-1">Mobile money number</label>
              <input
                className="input"
                placeholder="+2609XXXXXXXX"
                value={msisdn}
                onChange={(e) => setMsisdn(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {result && <p className="text-brand-700 text-sm bg-brand-50 rounded-lg p-2">{result}</p>}

          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={onClose} disabled={busy}>
              Not now
            </button>
            <button className="btn-primary flex-1" onClick={pay} disabled={busy}>
              {busy ? "Processing..." : `Pay K50`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
