'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import { Smartphone, CreditCard, Loader as Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

/**
 * Starts a real DPO Group payment. Calls create-payment (server-side,
 * holds the DPO company token), then redirects the pupil to DPO's own
 * hosted payment page — this app never collects a card number or mobile
 * money PIN itself. DPO redirects back to /subscribe/complete once the
 * pupil has paid (or cancelled), which is where the payment actually
 * gets confirmed — landing on this page again after payment doesn't
 * mean anything happened yet.
 */
export default function SubscribePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [price, setPrice] = useState(50);
  const [submitting, setSubmitting] = useState<'mobile_money' | 'card' | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('platform_settings').select('value').eq('key', 'subscription_price_zmw').maybeSingle();
      if (data?.value) setPrice(Number(data.value));
    })();
  }, []);

  const handleSubscribe = async (method: 'mobile_money' | 'card') => {
    setSubmitting(method);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) { toast.error('Please log in again.'); setSubmitting(null); return; }

      const response = await fetch(`${supabaseUrl}/functions/v1/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({ paymentMethod: method }),
      });
      const data = await response.json();
      if (!response.ok || !data.paymentUrl) {
        toast.error(data.error || 'Could not start payment. Please try again.');
        setSubmitting(null);
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      toast.error('Something went wrong. Please try again.');
      setSubmitting(null);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 animate-fade-in">
      <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted-board hover:text-chalk transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <div>
        <h1 className="font-display text-2xl font-semibold text-chalk mb-1">Subscribe to SmartClass Zambia</h1>
        <p className="text-sm text-muted-board">
          Unlimited AI chat with Mr. Chomba and the team — no daily limit.
        </p>
      </div>

      <div className="card-board p-6 text-center">
        <p className="font-mono-sc text-3xl font-bold text-chalk">K{price}</p>
        <p className="text-sm text-muted-board">per month</p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => handleSubscribe('mobile_money')}
          disabled={submitting !== null}
          className="w-full flex items-center gap-3 border border-white/15 hover:border-gold rounded-lg px-4 py-4 transition-colors disabled:opacity-50"
        >
          <Smartphone className="h-5 w-5 text-gold" />
          <div className="text-left flex-1">
            <p className="text-sm font-semibold text-chalk">Mobile Money</p>
            <p className="text-xs text-muted-board">MTN Mobile Money or Airtel Money</p>
          </div>
          {submitting === 'mobile_money' && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
        </button>

        <button
          onClick={() => handleSubscribe('card')}
          disabled={submitting !== null}
          className="w-full flex items-center gap-3 border border-white/15 hover:border-gold rounded-lg px-4 py-4 transition-colors disabled:opacity-50"
        >
          <CreditCard className="h-5 w-5 text-gold" />
          <div className="text-left flex-1">
            <p className="text-sm font-semibold text-chalk">Card</p>
            <p className="text-xs text-muted-board">Visa or Mastercard</p>
          </div>
          {submitting === 'card' && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
        </button>
      </div>

      <p className="text-xs text-muted-board text-center">
        You'll be taken to DPO's secure payment page to complete your payment. SmartClass Zambia never sees your
        card number or mobile money PIN.
      </p>
    </div>
  );
}
