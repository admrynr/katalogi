// App.jsx — Final consolidated file (full dark-mode, auto-logout, dashboard, catalog, auth)
import React, { useEffect, useRef, useState, createContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';

// --- Supabase setup ---
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// --- Auth Context ---
const AuthContext = createContext();
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    // initial session
    supabase.auth.getSession().then(({ data }) => { if (mounted) setUser(data?.session?.user || null); }).catch(()=>{});

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') setUser(null);
      else setUser(session?.user || null);
    });

    // poll session expiry every minute and sign out if expired
    const interval = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      const exp = data?.session?.expires_at;
      if (exp && Date.now() / 1000 > exp) {
        await supabase.auth.signOut();
        toast.error('Sesi berakhir, silakan login kembali');
      }
    }, 60 * 1000);

    return () => { mounted = false; listener.subscription.unsubscribe(); clearInterval(interval); };
  }, []);

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}

// --- Theme hook (manual only, default light) ---
function useTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    try {
      // apply to <html> so both tailwind and CSS selectors work
      if (dark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {}
  }, [dark]);

  return [dark, setDark];
}

// --- Header ---
function Header({ dark, setDark }) {
  const { user } = React.useContext(AuthContext);
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success('Berhasil logout!');
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        <div>
          <Link to="/catalog" className="text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Katalog<span className="text-gray-400">in</span></Link>
        </div>

        <nav className="flex items-center gap-3 text-sm">
          <Link to="/catalog" className="text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition">Katalog</Link>

          {user ? (
            <>
              <Link to="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition">Dashboard</Link>
              <button onClick={handleLogout} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full hover:bg-blue-700 transition">Logout</button>
            </>
          ) : (
            <Link to="/login" className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full hover:bg-blue-700 transition">Login</Link>
          )}

          <button
            aria-label="Toggle theme"
            onClick={() => setDark(v => !v)}
            className="fixed bottom-6 right-6 ml-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 rounded-full transition-colors duration-300"
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </nav>
      </div>
    </header>
  );
}

// --- Utilities ---
function formatPrice(p) { const n = Number(p); if (!Number.isFinite(n)) return '—'; return n.toLocaleString(); }
function normalizeAffiliate(url) { if (!url) return null; return url.startsWith('http') ? url : `https://${url}`; }

// --- Dashboard ---
function Dashboard() {
  const { user } = React.useContext(AuthContext);
  const fileRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ id: null, code: '', name: '', brand: '', category: 'Shirts', price: '', available: true, affiliate_url: '', image_url: '' });
  const [file, setFile] = useState(null);
  const categories = ['Shirts','T-Shirts','Jackets','Pants','Accessories','Shoes','Bags'];

  useEffect(() => { if (!user) return; fetchProducts(); }, [user]);

  async function fetchProducts() {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  }

  async function uploadFileIfAny() {
    if (!file) return form.image_url || null;
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g,'_')}`;
    const { error } = await supabase.storage.from('product-images').upload(fileName, file);
    if (error) { console.error(error); toast.error('Gagal upload gambar'); return form.image_url || null; }
    const { data: publicUrl } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return publicUrl.publicUrl;
  }

  function generateCodeForCategory(cat) {
    const prefix = (cat || 'OTH').substring(0,3).toUpperCase();
    const countInCategory = products.filter(p => p.category === cat).length;
    return `${prefix}${String(countInCategory+1).padStart(3,'0')}`;
  }

  async function handleSaveOrUpdate(e) {
    e && e.preventDefault();
    setLoading(true);
    const imageUrl = await uploadFileIfAny();
    const payload = { code: form.code || generateCodeForCategory(form.category), name: form.name||'', brand: form.brand||'', category: form.category||'Other', price: Number(form.price)||0, available: !!form.available, affiliate_url: form.affiliate_url||null, image_url: imageUrl||null };
    if (form.id) {
      const { error } = await supabase.from('products').update(payload).eq('id', form.id);
      if (error) toast.error('Gagal update produk'); else toast.success('Produk berhasil diupdate');
    } else {
      const { error } = await supabase.from('products').insert([payload]);
      if (error) toast.error('Gagal menyimpan produk'); else toast.success('Produk berhasil disimpan');
    }
    setForm({ id:null, code:'', name:'', brand:'', category:'Shirts', price:'', available:true, affiliate_url:'', image_url:'' });
    setFile(null); if (fileRef.current) fileRef.current.value = null;
    await fetchProducts(); setLoading(false);
  }

  async function handleEdit(p) { setForm({ id:p.id, code:p.code, name:p.name, brand:p.brand, category:p.category, price:p.price??'', available:!!p.available, affiliate_url:p.affiliate_url||'', image_url:p.image_url||'' }); window.scrollTo({top:0, behavior:'smooth'}); }
  async function handleDelete(id) { if (!confirm('Hapus produk ini?')) return; const { error } = await supabase.from('products').delete().eq('id', id); if (error) toast.error('Gagal menghapus'); else { toast.success('Produk dihapus'); fetchProducts(); } }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Dashboard Produk</h1>

        <form onSubmit={handleSaveOrUpdate} className="space-y-3 bg-white dark:bg-gray-800 dark:border-gray-700 border rounded-xl p-4 shadow transition-colors duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select value={form.category} onChange={(e)=>setForm({...form, category:e.target.value})} className="border p-2 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600">
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Nama" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} className="border p-2 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input placeholder="Brand" value={form.brand} onChange={(e)=>setForm({...form, brand:e.target.value})} className="border p-2 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600" />
            <input placeholder="Harga" type="number" value={form.price} onChange={(e)=>setForm({...form, price:e.target.value})} className="border p-2 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.available} onChange={(e)=>setForm({...form, available:e.target.checked})} /> <span className="text-sm">Tersedia</span></label>
            <input placeholder="Link affiliate" value={form.affiliate_url} onChange={(e)=>setForm({...form, affiliate_url:e.target.value})} className="border p-2 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600" />
          </div>

          <div><input ref={fileRef} type="file" accept="image/*" onChange={(e)=>setFile(e.target.files?.[0]||null)} className="w-full bg-white dark:bg-gray-700" /></div>

          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">{form.id ? (loading ? 'Updating...' : 'Update Produk') : (loading ? 'Saving...' : 'Simpan Produk')}</button>
            <button type="button" onClick={()=>{ setForm({ id:null, code:'', name:'', brand:'', category:'Shirts', price:'', available:true, affiliate_url:'', image_url:'' }); setFile(null); if (fileRef.current) fileRef.current.value = null; }} className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg">Reset</button>
          </div>
        </form>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Semua Produk</h2>
          {loading ? (<div>Loading...</div>) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {products.map(p => (
                <div key={p.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm flex flex-col border dark:border-gray-700 transition-colors duration-300">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover rounded-lg mb-2" /> : <div className="w-full h-36 bg-gray-100 dark:bg-gray-700 rounded-lg mb-2 flex items-center justify-center text-gray-400">No Image</div>}
                  <h3 className="font-semibold text-sm">{p.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-300">{p.brand} • {p.category}</p>
                  <p className="text-sm font-bold mt-1">Rp{formatPrice(p.price)}</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={()=>handleEdit(p)} className="bg-blue-600 text-white px-3 py-1 rounded-md text-xs hover:bg-blue-700">Edit</button>
                    <button onClick={()=>handleDelete(p.id)} className="bg-red-100 text-red-600 px-3 py-1 rounded-md text-xs">Hapus</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Catalog ---
function Catalog() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const categoriesOrder = ['Shirts','T-Shirts','Jackets','Pants','Accessories','Shoes','Bags'];

  useEffect(()=>{ fetchProducts(); }, []);
  async function fetchProducts(){ const { data } = await supabase.from('products').select('*').eq('available', true).order('created_at', { ascending: false }); setProducts(data || []); }

  const filtered = products.filter(p => { const q = search.trim().toLowerCase(); if (!q) return true; return (p.name||'').toLowerCase().includes(q) || (p.brand||'').toLowerCase().includes(q) || (p.code||'').toLowerCase().includes(q); });

  const grouped = {}; categoriesOrder.forEach(cat => grouped[cat]=[]); filtered.forEach(p => { const cat = categoriesOrder.includes(p.category) ? p.category : 'Other'; if (!grouped[cat]) grouped[cat]=[]; grouped[cat].push(p); });

  const categoryIcons = { Shirts:'👕','T-Shirts':'👚',Jackets:'🧥',Pants:'👖',Accessories:'🕶️',Shoes:'👟',Bags:'👜',Other:'📦' };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Katalog Produk</h1>
        <input placeholder="Cari kode / nama / brand..." value={search} onChange={(e)=>setSearch(e.target.value)} className="w-full border p-2 rounded-lg mb-6 bg-white dark:bg-gray-800 dark:border-gray-700" />

        {Object.keys(grouped).map(cat => {
          const items = grouped[cat]; if (!items || items.length===0) return null;
          return (
            <section key={cat} className="mb-8">
              <h2 className="text-lg font-semibold mb-3">{categoryIcons[cat] || '📦'} {cat}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {items.map(p => (
                  <div key={p.id} className="border rounded-xl p-2 flex flex-col bg-white dark:bg-gray-800 dark:border-gray-700 transition-colors duration-300">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover rounded-lg mb-1" /> : <div className="w-full h-36 bg-gray-100 dark:bg-gray-700 rounded-lg mb-1 flex items-center justify-center text-gray-400">No Image</div>}
                    <p className="text-xs text-gray-400">{p.code}</p>
                    <h3 className="font-semibold text-sm">{p.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-300">{p.brand}</p>
                    <p className="text-sm font-bold mt-1">Rp{formatPrice(p.price)}</p>
                    {p.affiliate_url && (
                      <a href={normalizeAffiliate(p.affiliate_url)} target="_blank" rel="noopener noreferrer" className="mt-2 bg-blue-600 text-white text-xs py-1 rounded-full text-center hover:bg-blue-700 transition">Beli Sekarang</a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// --- ProtectedRoute ---
const ProtectedRoute = ({ children }) => { const { user } = React.useContext(AuthContext); if (!user) return <Navigate to="/login" replace />; return children; };

// --- Login ---
function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); toast.error('Login gagal!'); }
    else { toast.success('Login berhasil!'); navigate('/dashboard'); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-800 dark:to-gray-900 transition-colors duration-300 px-6 py-10">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 border border-gray-100 dark:border-gray-700">
        <h1 className="text-3xl font-extrabold text-center dark:text-white text-gray-900 mb-2 tracking-tight">Katalog<span className="text-gray-400">in</span></h1>
        <p className="text-center text-gray-500 dark:text-gray-300 mb-6 text-sm">Masuk untuk mengelola produk Anda</p>
        {error && <p className="text-red-500 text-sm mb-2 text-center">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 p-2.5 rounded-lg bg-white dark:bg-gray-700" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Password</label>
            <input type="password" placeholder="••••••••" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 p-2.5 rounded-lg bg-white dark:bg-gray-700" required />
          </div>
          <button type="submit" className="w-full bg-black text-white py-2.5 rounded-lg font-semibold hover:bg-gray-800 transition">Login</button>
        </form>
      </div>
      <p className="text-xs text-gray-400 mt-6">© {new Date().getFullYear()} Katalogin. All rights reserved.</p>
    </div>
  );
}

// --- App (root) ---
export default function App(){
  const [dark, setDark] = useTheme();

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
          <Header dark={dark} setDark={setDark} />
          <Toaster position="top-center" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/" element={<Navigate to="/catalog" replace />} />
            <Route path="*" element={<Navigate to="/catalog" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

// ---------------- SQL
/*
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS affiliate_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available boolean DEFAULT true;
*/
