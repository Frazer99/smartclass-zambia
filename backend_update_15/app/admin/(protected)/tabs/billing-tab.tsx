'use client';

import { useState } from 'react';
import { Loader as Loader2, Wallet, TrendingUp, Gift, Users } from 'lucide-react';

interface Payment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method: 'mobile_money' | 'card';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  completed_at: string | null;
  profile?: { full_name: string } | null;
}

interface BillingTabProps {
  payments: Payment[];
  revenueSummary: { period: string; total_amount: number; payment_count: number }[];
  isPlatformFree: boolean;
  subscriptionPrice: number;
  loading: boolean;
  onToggleFreeMode: (enabled: boolean) => void;
  onUpdatePrice: (price: number) => void;
  onGrantBonus: (userId: string, days: number | null) => void;
}

/**
 * Real payment visibility (who's paid, daily/monthly revenue) plus the
 * two things an admin controls about "free": a global platform-wide
 * free-mode toggle, and per-pupil bonus grants. Revenue is intentionally
 * only ever computed from payments.status = 'completed' — a pending or
 * failed payment attempt is visible in the table below for
 * troubleshooting, but never counted toward the totals.
 */
export function BillingTab({
  payments, revenueSummary, isPlatformFree, subscriptionPrice, loading,
  onToggleFreeMode, onUpdatePrice, onGrantBonus,
}: BillingTabProps) {
  const [priceInput, setPriceInput] = useState(String(subscriptionPrice));
  const [grantUserId, setGrantUserId] = useState('');
  const [grantDays, setGrantDays] = useState('30');

  if (loading) {
    return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStr = new Date().toISOString().slice(0, 7);
  const todayRevenue = revenueSummary.find((r) => r.period === todayStr);
  const monthRevenue = revenueSummary
    .filter((r) => r.period.startsWith(monthStr))
    .reduce((sum, r) => sum + Number(r.total_amount), 0);
  const completedPayments = payments.filter((p) => p.status === 'completed');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-chalk mb-1">Billing</h2>
        <p className="text-sm text-muted-board">
          Real payments via DPO Group (mobile money and card), the platform-wide free-mode switch, and per-pupil
          bonus access grants.
        </p>
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card-board p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-board mb-1"><Wallet className="h-3.5 w-3.5" /> Today</div>
          <div className="font-mono-sc text-xl font-bold text-chalk">K{(todayRevenue?.total_amount ?? 0).toFixed(2)}</div>
          <div className="text-xs text-muted-board">{todayRevenue?.payment_count ?? 0} payments</div>
        </div>
        <div className="card-board p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-board mb-1"><TrendingUp className="h-3.5 w-3.5" /> This month</div>
          <div className="font-mono-sc text-xl font-bold text-chalk">K{monthRevenue.toFixed(2)}</div>
          <div className="text-xs text-muted-board">last 30 days shown</div>
        </div>
        <div className="card-board p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-board mb-1"><Users className="h-3.5 w-3.5" /> Paid pupils</div>
          <div className="font-mono-sc text-xl font-bold text-chalk">{new Set(completedPayments.map((p) => p.user_id)).size}</div>
          <div className="text-xs text-muted-board">{completedPayments.length} total payments</div>
        </div>
        <div className="card-board p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-board mb-1">Current price</div>
          <div className="font-mono-sc text-xl font-bold text-chalk">K{subscriptionPrice}<span className="text-xs text-muted-board">/mo</span></div>
        </div>
      </div>

      {/* Free mode + price controls */}
      <div className="card-board p-5 grid sm:grid-cols-2 gap-6">
        <div>
          <h3 className="font-display text-sm font-semibold text-chalk mb-2">Platform-Wide Free Mode</h3>
          <p className="text-xs text-muted-board mb-3">
            When on, every pupil gets unlimited AI chat regardless of subscription — a promo period, not a
            replacement for individual bonus grants below.
          </p>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isPlatformFree}
              onChange={(e) => onToggleFreeMode(e.target.checked)}
              className="h-4 w-4 rounded border-white/30 accent-gold"
            />
            <span className="text-sm text-chalk">{isPlatformFree ? 'Free mode is ON — everyone has unlimited access' : 'Free mode is off — daily quota applies'}</span>
          </label>
        </div>
        <div>
          <h3 className="font-display text-sm font-semibold text-chalk mb-2">Subscription Price</h3>
          <p className="text-xs text-muted-board mb-3">Monthly price in Zambian Kwacha, charged via DPO Group.</p>
          <div className="flex gap-2">
            <div className="flex items-center gap-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2">
              <span className="text-muted-board text-sm">K</span>
              <input
                type="number" value={priceInput} onChange={(e) => setPriceInput(e.target.value)}
                className="bg-transparent text-chalk text-sm w-16 focus:outline-none"
              />
            </div>
            <button onClick={() => onUpdatePrice(Number(priceInput))} className="btn-gold text-sm px-4 py-2">Save</button>
          </div>
        </div>
      </div>

      {/* Bonus grant */}
      <div className="card-board p-5">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="h-5 w-5 text-gold" />
          <h3 className="font-display text-sm font-semibold text-chalk">Grant Bonus Access</h3>
        </div>
        <p className="text-xs text-muted-board mb-3">
          Give a specific pupil free access without a payment — a scholarship, a promotion, or making something
          right. Find the pupil&apos;s user ID from the Users tab.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text" value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)}
            placeholder="Pupil user ID"
            className="flex-1 min-w-[200px] bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-chalk placeholder:text-muted-board focus:outline-none focus:ring-1 focus:ring-gold"
          />
          <select
            value={grantDays} onChange={(e) => setGrantDays(e.target.value)}
            className="bg-white/5 border border-white/15 text-chalk text-sm rounded-lg px-3 py-2 focus:outline-none"
          >
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
            <option value="">No expiry</option>
          </select>
          <button
            onClick={() => grantUserId && onGrantBonus(grantUserId, grantDays ? Number(grantDays) : null)}
            className="btn-gold text-sm px-4 py-2"
          >
            Grant
          </button>
        </div>
      </div>

      {/* Payments list */}
      <div className="card-board p-5">
        <h3 className="font-display text-sm font-semibold text-chalk mb-3">Recent Payments</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-board">No payment attempts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-board border-b border-white/10">
                  <th className="py-2 pr-3">Pupil</th>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pl-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-white/5">
                    <td className="py-2.5 pr-3 text-chalk">{p.profile?.full_name || 'Unknown'}</td>
                    <td className="py-2.5 pr-3 text-muted-board capitalize">{p.payment_method.replace('_', ' ')}</td>
                    <td className="py-2.5 pr-3 text-right font-mono-sc text-chalk">K{Number(p.amount).toFixed(2)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={
                        p.status === 'completed' ? 'text-teal' :
                        p.status === 'pending' ? 'text-gold' : 'text-rust'
                      }>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right text-xs text-muted-board">
                      {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
