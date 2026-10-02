import { useState } from 'react';
import { CreditCard, CircleCheck, CircleX, Clock3, Banknote } from 'lucide-react';

type Payment = {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  provider: string;
  company_ref: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  profile?: { full_name: string } | null;
};

type RevenueRow = { period: string; total_amount: number; payment_count: number };

export function PaymentsTab({ payments, revenue, loading }: { payments: Payment[]; revenue: RevenueRow[]; loading: boolean }) {
  const [showDetails, setShowDetails] = useState(false);
  const completed = payments.filter((payment) => payment.status === 'completed');
  const pending = payments.filter((payment) => payment.status === 'pending');
  const failed = payments.filter((payment) => payment.status === 'failed' || payment.status === 'cancelled');
  const total = completed.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const formatDate = (value: string) => new Date(value).toLocaleString();

  if (loading) return <div className="card-board p-8 text-center text-muted-board">Loading payments...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-chalk">Billing</h2>
        <p className="text-sm text-muted-board">Monitor subscriptions, payment attempts, and revenue.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Banknote />} label="Completed revenue" value={`${total.toFixed(2)} ZMW`} />
        <Stat icon={<CircleCheck />} label="Completed" value={String(completed.length)} color="text-teal" />
        <Stat icon={<Clock3 />} label="Pending" value={String(pending.length)} color="text-gold" />
        <Stat icon={<CircleX />} label="Failed / cancelled" value={String(failed.length)} color="text-rust" />
      </div>

      <button type="button" onClick={() => setShowDetails((visible) => !visible)} className="border border-gold/40 text-gold rounded-lg px-3 py-2 text-sm hover:bg-gold/10 transition-colors">
        {showDetails ? 'Hide payment details' : 'Show payment details'}
      </button>

      {showDetails && <>
      <div className="card-board max-h-[38rem] overflow-auto">
        <div className="p-4 border-b border-white/10 flex items-center gap-2"><CreditCard className="h-4 w-4 text-gold" /><h3 className="font-semibold text-chalk">Recent payment attempts</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/10 text-left text-xs text-muted-board uppercase tracking-widest"><th className="px-4 py-3">Pupil</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Date</th></tr></thead>
            <tbody>{payments.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-board">No payment attempts yet.</td></tr> : payments.map((payment) => <tr key={payment.id} className="border-b border-white/5"><td className="px-4 py-3 text-chalk">{payment.profile?.full_name || 'Unknown pupil'}</td><td className="px-4 py-3 text-chalk">{Number(payment.amount).toFixed(2)} {payment.currency}</td><td className="px-4 py-3 text-muted-board capitalize">{payment.payment_method.replace('_', ' ')}</td><td className="px-4 py-3"><Status value={payment.status} /></td><td className="px-4 py-3 text-muted-board font-mono-sc text-xs">{payment.company_ref}</td><td className="px-4 py-3 text-muted-board text-xs">{formatDate(payment.created_at)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="card-board overflow-hidden">
        <div className="p-4 border-b border-white/10"><h3 className="font-semibold text-chalk">Daily revenue, last 30 days</h3></div>
        <div className="divide-y divide-white/5">{revenue.length === 0 ? <p className="p-4 text-sm text-muted-board">No completed revenue yet.</p> : revenue.map((row) => <div key={row.period} className="px-4 py-3 flex justify-between text-sm"><span className="text-muted-board">{row.period} · {row.payment_count} payments</span><span className="text-chalk font-semibold">{Number(row.total_amount).toFixed(2)} ZMW</span></div>)}</div>
      </div>
      </>}
    </div>
  );
}

function Stat({ icon, label, value, color = 'text-chalk' }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return <div className="card-board p-4"><div className={`${color} mb-2`}>{icon}</div><div className="font-mono-sc text-xl font-bold text-chalk">{value}</div><div className="text-xs text-muted-board">{label}</div></div>;
}

function Status({ value }: { value: string }) {
  const color = value === 'completed' ? 'text-teal border-teal/40 bg-teal/10' : value === 'pending' ? 'text-gold border-gold/40 bg-gold/10' : 'text-rust border-rust/40 bg-rust/10';
  return <span className={`text-xs border rounded-full px-2 py-0.5 ${color}`}>{value}</span>;
}
