'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { CircleCheck as CheckCircle2, CircleX as XCircle, Loader as Loader2 } from 'lucide-react';
import Link from 'next/link';

/**
 * DPO redirects here after the pupil pays (or cancels) on DPO's own
 * hosted page. This page's only job is calling verify-payment, which
 * re-checks the real payment status directly with DPO server-to-server —
 * never trust the redirect alone, a URL can be replayed by anyone who
 * knows its shape.
 *
 * Genuine uncertainty worth being upfront about: I could not confirm the
 * exact query parameter DPO appends to this redirect URL from available
 * documentation. Rather than guess a specific param name and silently
 * fail if wrong, this checks a few plausible names AND falls back to the
 * pupil's own most recent pending payment (looked up server-side by
 * verify-payment via their authenticated session) — since the token was
 * already stored when create-payment ran, this works regardless of
 * exactly what DPO's redirect includes.
 */
export default function SubscribeCompletePage() {
  return (
    <Suspense fallback={<div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>}>
      <SubscribeCompleteInner />
    </Suspense>
  );
}

function SubscribeCompleteInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'success' | 'failed'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const tokenFromUrl =
        searchParams.get('TransID') || searchParams.get('ID') ||
        searchParams.get('TransactionToken') || searchParams.get('token');

      let transToken = tokenFromUrl;
      if (!transToken) {
        // No recognizable token in the redirect — fall back to this
        // pupil's own most recent pending payment, which we already
        // have the token for from when create-payment ran.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: pending } = await supabase
            .from('payments').select('provider_token')
            .eq('user_id', session.user.id).eq('status', 'pending')
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
          transToken = pending?.provider_token || null;
        }
      }

      if (!transToken) {
        setStatus('failed');
        setMessage("We couldn't find your payment. If money was taken, it will be refunded automatically — contact support if you're unsure.");
        return;
      }

      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession) { setStatus('failed'); setMessage('Please log in again to check your payment.'); return; }

        const response = await fetch(`${supabaseUrl}/functions/v1/verify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
          body: JSON.stringify({ transToken }),
        });
        const data = await response.json();

        if (data.paid) {
          setStatus('success');
          setMessage('Your subscription is active. Enjoy unlimited access!');
        } else {
          setStatus('failed');
          setMessage(data.reason || data.error || 'Payment was not completed.');
        }
      } catch {
        setStatus('failed');
        setMessage('Could not confirm your payment. Please contact support if you were charged.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <div className="card-board p-8 text-center">
        {status === 'checking' && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-gold mx-auto mb-4" />
            <p className="text-sm text-muted-board">Confirming your payment with DPO...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="h-10 w-10 text-teal mx-auto mb-4" />
            <h1 className="font-display text-xl font-semibold text-chalk mb-2">Subscription active</h1>
            <p className="text-sm text-muted-board mb-6">{message}</p>
            <Link href="/dashboard" className="btn-gold px-5 py-2.5 inline-block">Back to Dashboard</Link>
          </>
        )}
        {status === 'failed' && (
          <>
            <XCircle className="h-10 w-10 text-rust mx-auto mb-4" />
            <h1 className="font-display text-xl font-semibold text-chalk mb-2">Payment not completed</h1>
            <p className="text-sm text-muted-board mb-6">{message}</p>
            <Link href="/subscribe" className="btn-gold px-5 py-2.5 inline-block">Try Again</Link>
          </>
        )}
      </div>
    </div>
  );
}
