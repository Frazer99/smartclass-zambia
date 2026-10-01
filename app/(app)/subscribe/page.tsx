'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { supabase, Subject } from '@/lib/supabase-client';

export default function SubscribePage() {
  const { profile } = useAuth();
  const [price, setPrice] = useState(50);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [targetGrade, setTargetGrade] = useState<number | null>(null);
  const [targetChildId, setTargetChildId] = useState<string | null>(null);
  const [targetChildName, setTargetChildName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'mobile_money' | 'airtel_money' | 'card' | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('260');

  useEffect(() => {
    void (async () => {
      const childId = new URLSearchParams(window.location.search).get('child');
      const requestedSubjectId = new URLSearchParams(window.location.search).get('subject');
      if (childId) {
        const { data: children } = await supabase.rpc('get_my_children');
        const child = (children || []).find((item: { child_id: string }) => item.child_id === childId);
        if (child) {
          setTargetChildId(child.child_id);
          setTargetChildName(child.full_name);
          setTargetGrade(child.grade);
        }
      }
      const { data } = await supabase.from('platform_settings').select('value').eq('key', 'subscription_price_zmw').maybeSingle();
      if (data?.value) setPrice(Number(data.value));
      const grade = targetGrade ?? profile?.grade;
      if (grade) {
        const { data: subjectData } = await supabase.from('subjects').select('*').order('display_order');
        const available = ((subjectData || []) as Subject[]).filter((subject) => subject.grades.includes(grade));
        setSubjects(available);
        if (available.length > 0) setSubjectId(available.some((subject) => subject.id === requestedSubjectId) ? requestedSubjectId! : available[0].id);
      }
    })();
  }, [profile, targetGrade]);

  async function startPayment(paymentMethod: 'mobile_money' | 'airtel_money' | 'card') {
    if (!subjectId) {
      toast.error('Select a subject before starting payment.');
      return;
    }
    setSubmitting(paymentMethod);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in again.');
        return;
      }
      const isAirtel = paymentMethod === 'airtel_money';
      const mobileMoneyNumber = phoneNumber.startsWith('0') ? `260${phoneNumber.slice(1)}` : phoneNumber;
      if ((isAirtel || paymentMethod === 'mobile_money') && !/^260\d{9}$/.test(mobileMoneyNumber)) {
        toast.error(`Enter a valid ${isAirtel ? 'Airtel' : 'MTN'} Zambia number, for example 0971234567 or 260971234567.`);
        return;
      }
      const reference = `SCZ-${(targetChildId || session.user.id).slice(0, 8)}-${Date.now()}`;
      const response = await fetch(isAirtel ? '/api/payments/airtel/initiate' : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(isAirtel ? { msisdn: mobileMoneyNumber, reference, childId: targetChildId, subjectId } : { paymentMethod, childId: targetChildId, subjectId, ...(paymentMethod === 'mobile_money' ? { phoneNumber: mobileMoneyNumber } : {}) }),
      });
      const data = await response.json();
      if (!response.ok || (!data.paymentUrl && !data.paymentReference)) {
        toast.error(data.error || data.message || 'Could not start payment. Please try again.');
        return;
      }
      window.location.assign(data.paymentUrl || `/subscribe/complete?reference=${encodeURIComponent(data.paymentReference)}${targetChildId ? `&child=${encodeURIComponent(targetChildId)}` : ''}&subject=${encodeURIComponent(subjectId)}`);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6 animate-fade-in">
      <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted-board hover:text-chalk transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>
      <div>
        <h1 className="font-display text-2xl font-semibold text-chalk mb-1">Subscribe to SmartClass Zambia</h1>
        <p className="text-sm text-muted-board">{targetChildName ? `Paying for ${targetChildName}.` : 'Choose one subject for unlimited AI chat and lessons.'}</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="subscription-subject" className="block text-xs uppercase tracking-widest text-muted-board font-semibold">Subject</label>
        <select id="subscription-subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} disabled={submitting !== null} className="w-full rounded-lg border border-white/15 bg-board-deep px-4 py-3 text-sm text-chalk outline-none focus:border-gold">
          {subjects.length === 0 && <option value="">No subjects available</option>}
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
        <p className="text-xs text-muted-board">A subscription applies only to the selected subject. Subscribe again to unlock another subject.</p>
      </div>
      <div className="card-board p-6 text-center">
        <p className="font-mono-sc text-3xl font-bold text-chalk">K{price}</p>
        <p className="text-sm text-muted-board">per month</p>
      </div>
      <div className="space-y-3">
        <button onClick={() => void startPayment('mobile_money')} disabled={submitting !== null} className="w-full flex items-center gap-3 border border-white/15 hover:border-gold rounded-lg px-4 py-4 transition-colors disabled:opacity-50">
          <Smartphone className="h-5 w-5 text-gold" />
          <span className="text-left flex-1"><span className="block text-sm font-semibold text-chalk">MTN Mobile Money</span><span className="block text-xs text-muted-board">Approve the request on your MTN phone</span></span>
          {submitting === 'mobile_money' && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
        </button>
        <input
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, '').slice(0, 12))}
          inputMode="numeric"
          aria-label="Mobile money Zambia phone number"
          placeholder="260971234567"
          className="w-full rounded-lg border border-white/15 bg-transparent px-4 py-3 text-sm text-chalk outline-none focus:border-gold"
        />
        <button onClick={() => void startPayment('airtel_money')} disabled={submitting !== null} className="w-full flex items-center gap-3 border border-white/15 hover:border-gold rounded-lg px-4 py-4 transition-colors disabled:opacity-50">
          <Smartphone className="h-5 w-5 text-gold" />
          <span className="text-left flex-1"><span className="block text-sm font-semibold text-chalk">Airtel Money</span><span className="block text-xs text-muted-board">Approve the request on your Airtel phone</span></span>
          {submitting === 'airtel_money' && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
        </button>
        <button onClick={() => void startPayment('card')} disabled={submitting !== null} className="w-full flex items-center gap-3 border border-white/15 hover:border-gold rounded-lg px-4 py-4 transition-colors disabled:opacity-50">
          <CreditCard className="h-5 w-5 text-gold" />
          <span className="text-left flex-1"><span className="block text-sm font-semibold text-chalk">Card</span><span className="block text-xs text-muted-board">Visa or Mastercard</span></span>
          {submitting === 'card' && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
        </button>
      </div>
      <p className="text-xs text-muted-board text-center">Your mobile network will send an approval prompt. SmartClass Zambia never sees your mobile money PIN.</p>
    </div>
  );
}
