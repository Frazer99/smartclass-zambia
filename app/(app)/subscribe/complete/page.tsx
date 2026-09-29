'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, CircleX, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

export default function SubscribeCompletePage() {
  return <Suspense fallback={<div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>}><Confirmation /></Suspense>;
}

function Confirmation() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'checking' | 'success' | 'failed'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('failed');
        setMessage('Please log in again to check your payment.');
        return;
      }
      const childId = searchParams.get('child');
      let transToken = searchParams.get('reference') || searchParams.get('TransID') || searchParams.get('ID') || searchParams.get('TransactionToken') || searchParams.get('token');
      if (!transToken) {
        const { data: pending } = childId
          ? await supabase.rpc('get_parent_pending_payment', { p_child_id: childId })
          : await supabase.from('payments').select('provider_token').eq('user_id', session.user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle();
        transToken = childId ? pending?.[0]?.provider_token || null : pending?.provider_token || null;
      }
      if (!transToken) {
        setStatus('failed');
        setMessage('We could not find your payment. Contact support if money was taken.');
        return;
      }
      try {
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ transToken, childId }),
          });
          const data = await response.json();
          if (data.paid) {
            setStatus('success');
            setMessage('Your subscription is active. Enjoy unlimited access!');
            return;
          }
          if (!data.pending || attempt === 9) {
            setStatus('failed');
            setMessage(data.reason || data.error || 'Payment was not completed.');
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 3000));
        }
      } catch {
        setStatus('failed');
        setMessage('Could not confirm your payment. Contact support if you were charged.');
      }
    })();
  }, [searchParams]);

  return <div className="max-w-md mx-auto animate-fade-in"><div className="card-board p-8 text-center">
    {status === 'checking' && <><Loader2 className="h-10 w-10 animate-spin text-gold mx-auto mb-4" /><p className="text-sm text-muted-board">Waiting for mobile money payment approval...</p></>}
    {status === 'success' && <><CheckCircle2 className="h-10 w-10 text-teal mx-auto mb-4" /><h1 className="font-display text-xl font-semibold text-chalk mb-2">Subscription active</h1><p className="text-sm text-muted-board mb-6">{message}</p><Link href="/dashboard" className="btn-gold px-5 py-2.5 inline-block">Back to Dashboard</Link></>}
    {status === 'failed' && <><CircleX className="h-10 w-10 text-rust mx-auto mb-4" /><h1 className="font-display text-xl font-semibold text-chalk mb-2">Payment not completed</h1><p className="text-sm text-muted-board mb-6">{message}</p><Link href="/subscribe" className="btn-gold px-5 py-2.5 inline-block">Try Again</Link></>}
  </div></div>;
}
