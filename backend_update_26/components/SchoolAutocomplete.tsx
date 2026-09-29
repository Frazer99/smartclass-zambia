'use client';

import { useEffect, useId, useState } from 'react';
import { supabase } from '@/lib/supabase-client';

interface SchoolAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

/**
 * Free-text input, but suggests existing school names via a native
 * HTML datalist — nudging new signups toward consistent spelling
 * instead of typing a fresh variant every time, without forcing a
 * strict dropdown that would block a genuinely new school from being
 * entered. Reads from the `schools` table (migration 20260804080000),
 * which auto-populates itself via a trigger whenever a new school name
 * is actually used — this component only ever reads, never writes.
 *
 * profiles.school stays exactly as it always was — plain text, no
 * foreign key. This is a lower-risk, incremental improvement (better
 * suggestions going forward) rather than a full normalization of the
 * school relationship, which would mean touching every function and
 * query that currently reads school as text.
 *
 * useId() generates a unique datalist id per instance — safe even if
 * more than one of these somehow ends up on the same page, though in
 * practice each page that uses this only ever renders one.
 */
export function SchoolAutocomplete({ value, onChange, disabled, placeholder, className, required }: SchoolAutocompleteProps) {
  const [schools, setSchools] = useState<string[]>([]);
  const listId = useId();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('schools').select('name').order('name');
      setSchools((data || []).map((s: any) => s.name));
    })();
  }, []);

  return (
    <>
      <input
        list={listId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        className={className}
      />
      <datalist id={listId}>
        {schools.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
