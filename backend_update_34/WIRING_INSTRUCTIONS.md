# Personas tab — files + exact wiring for page.tsx

## Step 1: Run the migration
supabase/migrations/20260802080000_teacher_personas_admin_update.sql
in your Supabase SQL Editor. This adds the admin-only UPDATE policy on
teacher_personas — without it, saves in the new tab will silently fail
(no error, but nothing actually changes), because teacher_personas
previously only had a SELECT policy, never an UPDATE one.

## Step 2: Add the component file
app/admin/(protected)/tabs/personas-tab.tsx — drop this in as a new
file at that exact path.

## Step 3: Wire it into your page.tsx
Your admin page.tsx may look different from what's described here if
you've built other features since — these are the specific, minimal
additions for Personas only. Find the equivalent spot in your file for
each:

### 3a. Import (near your other tab imports)
import { PersonasTab } from './tabs/personas-tab';

### 3b. Add 'personas' to your Tab type union
e.g. if you have:
  type Tab = 'overview' | 'analytics' | ... | 'settings';
change to:
  type Tab = 'overview' | 'analytics' | ... | 'personas' | 'settings';

### 3c. Add a nav entry (wherever your TABS array is)
{ id: 'personas', label: 'Personas', icon: <Users2 className="h-4 w-4" /> },
(Users2 is a real lucide-react icon — import it alongside your other
icons from 'lucide-react' if it's not already imported.)

### 3d. Add state (near your other useState calls)
const [personas, setPersonas] = useState<any[]>([]);
const [personasLoading, setPersonasLoading] = useState(true);

### 3e. Add the fetch function (near your other fetchX functions)
const fetchPersonas = async () => {
  setPersonasLoading(true);
  const { data } = await supabase
    .from('teacher_personas')
    .select('*, subject:subjects(name, color)')
    .order('name');
  setPersonas(data || []);
  setPersonasLoading(false);
};

### 3f. Call it in your fetchAll (or wherever you fetch data on load)
Add fetchPersonas() to whatever Promise.all(...) or sequence of calls
already runs your other fetchX functions on mount.

### 3g. Add the save handler
const handleSavePersona = async (id: string, avatarId: string, voiceId: string) => {
  const { error } = await supabase
    .from('teacher_personas')
    .update({
      liveavatar_avatar_id: avatarId || null,
      liveavatar_voice_id: voiceId || null,
    })
    .eq('id', id);
  if (error) { toast.error('Failed to save. Did the 20260802080000 migration run?'); return; }
  toast.success('Saved.');
  fetchPersonas();
};

### 3h. Render it (wherever your other {activeTab === '...' && (...)} blocks are)
{activeTab === 'personas' && (
  <PersonasTab personas={personas} loading={personasLoading} onSave={handleSavePersona} />
)}

## After wiring this in
Reload /admin, click the new Personas tab, and confirm all five
teacher personas show up (Chipo, Mr Chomba, Linda, Mrs Tembo,
Mr Banda). Chipo should already show "Live avatar connected" if her
avatar_id was set previously — the others will show "Using illustrated
avatar" until you add their avatar_ids here.
