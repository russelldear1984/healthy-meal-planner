import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, CircleUserRound, ExternalLink, ListChecks, LoaderCircle, LogIn, Menu, Plus, ShoppingBasket, Sparkles, X } from 'lucide-react'
import { demoRecipes, type Recipe } from './data'
import { supabase } from './lib/supabase'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
type Course = 'starter' | 'main' | 'dessert'
const courseFor = (recipe: Recipe): Course => recipe.tags.includes('course-starter') || recipe.tags.includes('starter') ? 'starter' : recipe.tags.includes('course-dessert') || recipe.tags.includes('dessert') ? 'dessert' : 'main'
const monday = () => { const d = new Date(); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return d }
const weekLabel = (date: Date) => `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(date.getTime() + 6 * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
const category = (name: string) => /chicken|beef|fish|salmon|tuna|pork|meat/.test(name) ? 'Meat & seafood' : /cheese|milk|butter|yogurt|egg/.test(name) ? 'Dairy & eggs' : /onion|pepper|broccoli|fennel|lemon|lime|tomato|spinach|garlic|beans/.test(name) ? 'Produce' : 'Pantry'

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[]>(demoRecipes)
  const [selectedTags, setSelectedTags] = useState<string[]>(['low-carb-candidate'])
  const [course, setCourse] = useState<Course>('main')
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState<(Recipe | null)[]>(Array(7).fill(null))
  const [week, setWeek] = useState(monday)
  const [activeView, setActiveView] = useState<'recipes' | 'planner' | 'shopping'>('recipes')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.from('recipes').select('*, recipe_tags(tags(name)), recipe_ingredients(quantity, unit, raw_text, ingredients(name))').order('title').then(({ data, error }) => {
      if (error || !data?.length) return
      setRecipes(data.map((r: any) => ({ ...r, tags: r.recipe_tags.map((x: any) => x.tags.name), ingredients: r.recipe_ingredients.map((x: any) => ({ ...x, name: x.ingredients.name })) })))
    })
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data: { session } }) => setSignedInEmail(session?.user.email ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedInEmail(session?.user.email ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !signedInEmail) return
    let active = true
    async function loadSavedWeek() {
      const { data: { user } } = await supabase!.auth.getUser()
      if (!user) return
      const { data, error } = await supabase!.from('meal_plans').select('meal_plan_entries(day_of_week, recipes(id, title, image_url, source_url, source_name, recipe_tags(tags(name)), recipe_ingredients(quantity, unit, raw_text, ingredients(name))))').eq('user_id', user.id).eq('week_start_date', week.toISOString().slice(0, 10)).maybeSingle()
      if (error || !data || !active) return
      const restored: (Recipe | null)[] = Array(7).fill(null)
      for (const entry of data.meal_plan_entries as any[]) {
        const recipe = entry.recipes
        if (!recipe) continue
        restored[entry.day_of_week] = {
          ...recipe,
          tags: recipe.recipe_tags.map((item: any) => item.tags.name),
          ingredients: recipe.recipe_ingredients.map((item: any) => ({ ...item, name: item.ingredients.name })),
        }
      }
      setPlan(restored)
    }
    loadSavedWeek()
    return () => { active = false }
  }, [signedInEmail, week])

  const allTags = useMemo(() => Array.from(new Set(recipes.flatMap((r) => r.tags))).sort(), [recipes])
  const visible = recipes.filter((r) => courseFor(r) === course && r.title.toLowerCase().includes(query.toLowerCase()) && selectedTags.every((tag) => r.tags.includes(tag)))
  const shopping = useMemo(() => {
    const items = new Map<string, { name: string; lines: string[]; group: string }>()
    plan.filter(Boolean).flatMap((r) => r!.ingredients).forEach((item) => {
      const key = item.name.toLowerCase()
      const current = items.get(key) ?? { name: item.name, lines: [], group: category(key) }
      current.lines.push(item.raw_text); items.set(key, current)
    })
    return [...items.values()].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
  }, [plan])

  function addToPlan(recipe: Recipe, day?: number) {
    const target = day ?? plan.findIndex((entry) => !entry)
    if (target < 0) { setNotice('Your week is full — replace a dinner to add another.'); return }
    if (plan.some((entry) => entry?.id === recipe.id)) { setNotice('That dinner is already in this week.'); return }
    setPlan((current) => current.map((entry, index) => index === target ? recipe : entry)); setNotice(`${recipe.title} added to ${days[target]}.`)
  }
  function autoFill() { const choices = [...visible].sort(() => Math.random() - .5).slice(0, 7); setPlan(days.map((_, i) => choices[i] ?? null)); setNotice(choices.length === 7 ? 'Your seven dinner ideas are ready.' : `Only ${choices.length} matching recipes are available.`) }
  async function savePlan() {
    if (!supabase) { setNotice('Demo mode: add Supabase keys to save this plan.'); return }
    const { data: { user } } = await supabase.auth.getUser(); if (!user) { setAuthOpen(true); return }
    setLoading(true); const date = week.toISOString().slice(0, 10)
    const { data: saved, error } = await supabase.from('meal_plans').upsert({ user_id: user.id, week_start_date: date }, { onConflict: 'user_id,week_start_date' }).select('id').single()
    if (!error && saved) { await supabase.from('meal_plan_entries').delete().eq('meal_plan_id', saved.id); await supabase.from('meal_plan_entries').insert(plan.flatMap((recipe, day_of_week) => recipe ? [{ meal_plan_id: saved.id, recipe_id: recipe.id, day_of_week, meal_type: 'dinner' }] : [])); setNotice('Plan saved securely to your account.') } else setNotice('Could not save your plan. Please try again.')
    setLoading(false)
  }
  async function sendMagicLink(e: React.FormEvent) { e.preventDefault(); if (!supabase) { setNotice('Add Supabase environment values to enable sign-in.'); setAuthOpen(false); return }; const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }); setNotice(error ? error.message : 'Check your inbox for your magic link.'); setAuthOpen(false) }
  async function signOut() { if (!supabase) return; await supabase.auth.signOut(); setNotice('You have signed out.') }

  return <div className="min-h-screen bg-[#f9f8f4] text-[#17302b]">
    <header className="sticky top-0 z-30 border-b border-[#dde4dc] bg-[#f9f8f4eF] backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><button onClick={() => setActiveView('recipes')} className="flex items-center gap-2 font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-[#295b4e] text-xl text-white">⌁</span><span>Sprout<span className="text-[#b65d3c]">ly</span></span></button><nav className="hidden gap-7 text-sm font-medium md:flex"><button onClick={() => setActiveView('recipes')}>Recipes</button><button onClick={() => setActiveView('planner')}>Meal planner</button><button onClick={() => setActiveView('shopping')}>Shopping list</button></nav><div className="flex items-center gap-2">{signedInEmail ? <><span className="hidden max-w-44 truncate text-sm text-[#527067] md:block">{signedInEmail}</span><button onClick={signOut} className="hidden items-center gap-2 rounded-full border border-[#cdd8cf] px-4 py-2 text-sm md:flex"><CircleUserRound size={17}/> Sign out</button></> : <button onClick={() => setAuthOpen(true)} className="hidden items-center gap-2 rounded-full border border-[#cdd8cf] px-4 py-2 text-sm md:flex"><CircleUserRound size={17}/> Sign in</button>}<button className="md:hidden" onClick={() => setDrawerOpen(true)}><Menu /></button></div></div></header>
    {notice && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#17302b] px-5 py-3 text-sm text-white shadow-xl"><button className="mr-3" onClick={() => setNotice('')}><X size={15}/></button>{notice}</div>}
    <main className="mx-auto max-w-7xl px-5 pb-16">
      {activeView === 'recipes' && <><section className="grid gap-7 py-12 md:grid-cols-[1.1fr_.9fr] md:py-20"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[#b65d3c]">Simple dinners, thoughtfully chosen</p><h1 className="max-w-xl font-serif text-5xl leading-[.98] tracking-tight md:text-7xl">A calmer way to plan <em className="font-light">dinner.</em></h1><p className="mt-6 max-w-lg text-lg leading-8 text-[#527067]">Discover ingredient-led low-carb candidates, arrange your week, and turn it into one useful shopping list.</p><button onClick={() => setActiveView('planner')} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#295b4e] px-5 py-3 font-semibold text-white shadow-sm">Plan this week <CalendarDays size={17}/></button></div><div className="relative overflow-hidden rounded-[2.5rem] bg-[#dce8c9] p-8"><div className="absolute -right-5 -top-7 text-[14rem] leading-none">🥬</div><p className="relative mt-40 max-w-xs font-serif text-3xl leading-tight">Fresh ideas, without the daily decision fatigue.</p></div></section><section className="border-y border-[#dde4dc] py-7"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h2 className="font-serif text-3xl">Browse meal ideas</h2><p className="mt-1 text-sm text-[#527067]">Low-carb is an ingredient-based estimate, not nutrition advice.</p></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes" className="w-full rounded-full border border-[#cdd8cf] bg-white px-5 py-3 outline-none md:w-64" /></div><div className="mt-5 flex flex-wrap gap-2"><span className="mr-1 self-center text-sm font-semibold text-[#527067]">Course</span>{(['starter', 'main', 'dessert'] as Course[]).map((item) => <button key={item} onClick={() => setCourse(item)} className={`rounded-full px-3 py-1.5 text-sm capitalize ${course === item ? 'bg-[#b65d3c] text-white' : 'bg-white text-[#527067] ring-1 ring-[#d6dfd8]'}`}>{item}</button>)}</div><div className="mt-3 flex flex-wrap gap-2">{allTags.filter((tag) => !tag.startsWith('course-')).map((tag) => <button key={tag} onClick={() => setSelectedTags((tags) => tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag])} className={`rounded-full px-3 py-1.5 text-sm ${selectedTags.includes(tag) ? 'bg-[#295b4e] text-white' : 'bg-white text-[#527067] ring-1 ring-[#d6dfd8]'}`}>{tag.replaceAll('-', ' ')}</button>)}</div></section><section className="grid gap-6 py-9 sm:grid-cols-2 lg:grid-cols-3">{visible.map((recipe) => <RecipeCard recipe={recipe} onAdd={() => addToPlan(recipe)} key={recipe.id}/>)}</section></>}
      {activeView === 'planner' && <section className="py-10"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-sm font-semibold uppercase tracking-[.18em] text-[#b65d3c]">Your dinner plan</p><h1 className="mt-2 font-serif text-5xl">Make room for your week.</h1></div><div className="flex items-center gap-2 rounded-full border border-[#cdd8cf] bg-white p-1"><button onClick={() => setWeek(new Date(week.getTime() - 7 * 86400000))} className="p-2"><ChevronLeft size={18}/></button><span className="min-w-36 text-center text-sm font-semibold">{weekLabel(week)}</span><button onClick={() => setWeek(new Date(week.getTime() + 7 * 86400000))} className="p-2"><ChevronRight size={18}/></button></div></div><div className="mt-7 flex flex-wrap items-center gap-2"><span className="mr-1 text-sm font-semibold text-[#527067]">Plan recipes from</span>{(['starter', 'main', 'dessert'] as Course[]).map((item) => <button key={item} onClick={() => setCourse(item)} className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${course === item ? 'bg-[#b65d3c] text-white' : 'bg-white text-[#527067] ring-1 ring-[#d6dfd8]'}`}>{item}</button>)}</div><div className="mt-5 flex flex-wrap gap-3"><button onClick={autoFill} className="inline-flex items-center gap-2 rounded-full bg-[#b65d3c] px-5 py-3 font-semibold text-white"><Sparkles size={17}/> Auto-generate week</button><button disabled={loading} onClick={savePlan} className="inline-flex items-center gap-2 rounded-full border border-[#295b4e] px-5 py-3 font-semibold text-[#295b4e]">{loading ? <LoaderCircle className="animate-spin" size={17}/> : <Check size={17}/>} Save plan</button><button onClick={() => setActiveView('shopping')} className="inline-flex items-center gap-2 rounded-full border border-[#cdd8cf] px-5 py-3 font-semibold"><ShoppingBasket size={17}/> View shopping list</button></div><div className="mt-8 grid gap-3 md:grid-cols-7">{days.map((day, index) => <div key={day} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const r = recipes.find((x) => x.id === e.dataTransfer.getData('recipe')); if (r) addToPlan(r, index) }} className="min-h-64 rounded-3xl border border-[#d7e0d8] bg-white p-3"><p className="mb-3 text-sm font-semibold text-[#527067]">{day}</p>{plan[index] ? <div className="group relative overflow-hidden rounded-2xl bg-[#edf2ec]"><img src={plan[index]!.image_url} alt="" className="h-28 w-full object-cover"/><p className="p-3 text-sm font-semibold leading-tight">{plan[index]!.title}</p><button onClick={() => setPlan((current) => current.map((x, i) => i === index ? null : x))} className="absolute right-2 top-2 rounded-full bg-white p-1.5"><X size={14}/></button></div> : <button onClick={() => { const r = visible.find((r) => !plan.includes(r)); if (r) addToPlan(r, index) }} className="grid w-full place-items-center gap-2 rounded-2xl border border-dashed border-[#b8c8bd] py-14 text-sm text-[#527067]"><Plus size={19}/>Add dinner</button>}</div>)}</div><section className="mt-12"><h2 className="font-serif text-3xl">Add from recipes</h2><p className="mt-1 text-sm text-[#527067]">Drag a card into a day, or use the plus button.</p><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{visible.slice(0, 8).map((r) => <RecipeCard key={r.id} recipe={r} compact draggable onAdd={() => addToPlan(r)} />)}</div></section></section>}
      {activeView === 'shopping' && <section className="py-10"><p className="text-sm font-semibold uppercase tracking-[.18em] text-[#b65d3c]">For your week</p><h1 className="mt-2 font-serif text-5xl">One simple shopping list.</h1><p className="mt-4 max-w-xl text-lg text-[#527067]">Built from your planned dinners. Checks are kept for this visit only.</p>{shopping.length ? <div className="mt-9 max-w-2xl overflow-hidden rounded-3xl border border-[#d7e0d8] bg-white">{['Produce', 'Meat & seafood', 'Dairy & eggs', 'Pantry'].map((group) => { const items = shopping.filter((x) => x.group === group); return items.length ? <div key={group} className="border-b border-[#e7ece7] p-6 last:border-0"><h2 className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[#b65d3c]">{group}</h2>{items.map((item) => <label key={item.name} className="flex cursor-pointer items-center gap-3 border-t border-[#f0f3f0] py-3 first:border-0"><input type="checkbox" className="size-4 accent-[#295b4e]"/><span className="flex-1 font-medium">{item.name}</span><span className="text-right text-xs text-[#6d847b]">{[...new Set(item.lines)].join(' · ')}</span></label>)}</div> : null })}</div> : <div className="mt-8 rounded-3xl border border-dashed border-[#bdcbbf] p-12 text-center"><ListChecks className="mx-auto text-[#b65d3c]"/><h2 className="mt-4 font-serif text-2xl">Your list will appear here.</h2><button onClick={() => setActiveView('planner')} className="mt-4 font-semibold text-[#295b4e]">Plan some dinners first →</button></div>}</section>}
    </main><footer className="border-t border-[#dde4dc] px-5 py-8 text-center text-sm text-[#6d847b]">Recipe data and imagery sourced from <a className="font-semibold text-[#295b4e]" href="https://www.themealdb.com" target="_blank">TheMealDB</a>. Low-carb candidate labels are ingredient-based estimates.</footer>
    {(drawerOpen || authOpen) && <div className="fixed inset-0 z-50 grid place-items-center bg-[#17302b88] p-5"><div className="w-full max-w-md rounded-3xl bg-[#f9f8f4] p-7 shadow-2xl"><button className="float-right" onClick={() => { setDrawerOpen(false); setAuthOpen(false) }}><X/></button>{authOpen ? <><LogIn className="text-[#b65d3c]"/><h2 className="mt-4 font-serif text-3xl">Welcome back</h2><p className="mt-2 text-[#527067]">We’ll send a secure sign-in link to your email.</p><form onSubmit={sendMagicLink} className="mt-6"><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-[#cdd8cf] bg-white px-4 py-3"/><button className="mt-3 w-full rounded-xl bg-[#295b4e] px-4 py-3 font-semibold text-white">Send magic link</button></form></> : <nav className="mt-8 grid gap-4 text-xl font-semibold">{(['recipes','planner','shopping'] as const).map((view) => <button key={view} onClick={() => { setActiveView(view); setDrawerOpen(false) }} className="text-left capitalize">{view === 'planner' ? 'Meal planner' : view === 'shopping' ? 'Shopping list' : 'Recipes'}</button>)}</nav>}</div></div>}
  </div>
}

function RecipeCard({ recipe, onAdd, compact = false, draggable = false }: { recipe: Recipe; onAdd: () => void; compact?: boolean; draggable?: boolean }) { return <article draggable={draggable} onDragStart={(e) => e.dataTransfer.setData('recipe', recipe.id)} className="overflow-hidden rounded-3xl border border-[#d7e0d8] bg-white shadow-[0_3px_14px_rgba(23,48,43,.04)]"><img src={recipe.image_url} alt={recipe.title} className={`${compact ? 'h-36' : 'h-52'} w-full object-cover`} /><div className="p-5"><div className="mb-3 flex flex-wrap gap-1.5">{recipe.tags.slice(0, 2).map((tag) => <span key={tag} className="rounded-full bg-[#edf2ec] px-2 py-1 text-[11px] font-semibold text-[#295b4e]">{tag.replaceAll('-', ' ')}</span>)}</div><h3 className="font-serif text-2xl leading-tight">{recipe.title}</h3><p className="mt-2 line-clamp-2 text-sm text-[#6d847b]">{recipe.ingredients.slice(0, 3).map((i) => i.name).join(' · ')}</p><div className="mt-5 flex items-center justify-between"><a href={recipe.source_url || 'https://www.themealdb.com'} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-[#527067]">Source <ExternalLink size={13}/></a><button onClick={onAdd} className="inline-flex items-center gap-1 rounded-full bg-[#295b4e] px-3 py-2 text-sm font-semibold text-white"><Plus size={15}/> Plan</button></div></div></article> }
