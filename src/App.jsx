// Final Product Catalog - Consolidated + Stable
// Features combined:
// - Minimalist Header (given by user)
// - Auth with Supabase
// - Dashboard (CRUD) with upload/edit image, reset file input
// - Auto code generation: 3-letter category prefix + 3-digit index per category
// - `available` boolean filter; only available products show in catalogs
// - Affiliate link opens as `https://${p.affiliate_url}`
// - Catalog grouped by category with emoji titles (only categories that have products)
// - Placeholder for missing images
// - Floating blue action button (add/save) and floating theme toggle (bottom-right)
// - Toast notifications (sonner)
// - Safe rendering for price (avoids toLocaleString errors when data async)

import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';

// --- Supabase setup ---
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// --- AuthContext ---
const AuthContext = React.createContext();
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(data?.user || null);
    }).catch(()=>{});
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user || null);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}

// --- Minimalist Navbar (user-provided) ---
function Header() {
  const { user } = React.useContext(AuthContext);
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success('Berhasil logout!');
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        <Link to="/catalog" className="text-lg font-semibold text-gray-900 tracking-tight">
          Katalog<span className="text-gray-400">Admin</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link to="/catalog" className="text-gray-600 hover:text-black transition">Katalog</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="text-gray-600 hover:text-black transition">Dashboard</Link>
              <button
                onClick={handleLogout}
                className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full hover:bg-blue-700 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full hover:bg-blue-700 transition"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

// --- Theme Toggle Floating Button ---
function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('theme') === 'dark';
    } catch { return false; }
  });
  useEffect(() => {
    try {
      if (dark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {}
  }, [dark]);
  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setDark((s) => !s)}
      className="fixed bottom-6 right-20 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}

// --- Utility: safe price formatter ---
function formatPrice(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

// --- Dashboard (Admin) ---
function Dashboard() {
  const { user } = React.useContext(AuthContext);
  const fileRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ id: null, code: '', name: '', brand: '', category: 'Shirts', price: '', available: true, affiliate_url: '', image_url: '' });
  const [file, setFile] = useState(null);
  const categories = ['Shirts', 'T-Shirts', 'Jackets', 'Pants', 'Accessories', 'Shoes', 'Bags'];

  useEffect(() => {
    if (!user) return;
    fetchProducts();
  }, [user]);

  async function fetchProducts() {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  }

  async function uploadFileIfAny() {
    if (!file) return form.image_url || null;
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from('product-images').upload(fileName, file);
    if (error) {
      console.error(error);
      toast.error('Gagal upload gambar');
      return form.image_url || null;
    }
    const { data: publicUrl } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return publicUrl.publicUrl;
  }

  // generate code per category using existing count of that category
  function generateCodeForCategory(cat) {
    const prefix = (cat || 'OTH').substring(0, 3).toUpperCase();
    const countInCategory = products.filter((p) => p.category === cat).length;
    return `${prefix}${String(countInCategory + 1).padStart(3, '0')}`;
  }

  async function handleSaveOrUpdate(e) {
    e && e.preventDefault();
    setLoading(true);
    const imageUrl = await uploadFileIfAny();
    const payload = {
      code: form.code || generateCodeForCategory(form.category),
      name: form.name || '',
      brand: form.brand || '',
      category: form.category || 'Other',
      price: Number(form.price) || 0,
      available: !!form.available,
      affiliate_url: form.affiliate_url || null,
      image_url: imageUrl || null,
    };

    if (form.id) {
      const { error } = await supabase.from('products').update(payload).eq('id', form.id);
      if (error) toast.error('Gagal update produk'); else toast.success('Produk berhasil diupdate');
    } else {
      const { error } = await supabase.from('products').insert([payload]);
      if (error) toast.error('Gagal menyimpan produk'); else toast.success('Produk berhasil disimpan');
    }

    // reset form and file input
    setForm({ id: null, code: '', name: '', brand: '', category: 'Shirts', price: '', available: true, affiliate_url: '', image_url: '' });
    setFile(null);
    if (fileRef.current) fileRef.current.value = null;
    await fetchProducts();
    setLoading(false);
  }

  async function handleEdit(product) {
    setForm({
      id: product.id,
      code: product.code,
      name: product.name,
      brand: product.brand,
      category: product.category,
      price: product.price ?? '',
      available: !!product.available,
      affiliate_url: product.affiliate_url || '',
      image_url: product.image_url || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!confirm('Hapus produk ini?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) toast.error('Gagal menghapus'); else { toast.success('Produk dihapus'); fetchProducts(); }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Dashboard Produk</h1>

        <form onSubmit={handleSaveOrUpdate} className="space-y-3 bg-white p-4 rounded-xl shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select value={form.category} onChange={(e)=>setForm({...form, category:e.target.value})} className="border p-2 rounded-lg">
              {categories.map((c)=> <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Nama" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} className="border p-2 rounded-lg" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input placeholder="Brand" value={form.brand} onChange={(e)=>setForm({...form, brand:e.target.value})} className="border p-2 rounded-lg" />
            <input placeholder="Harga" type="number" value={form.price} onChange={(e)=>setForm({...form, price:e.target.value})} className="border p-2 rounded-lg" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.available} onChange={(e)=>setForm({...form, available:e.target.checked})} />
              <span className="text-sm">Tersedia</span>
            </label>
            <input placeholder="Link affiliate (tanpa https://)" value={form.affiliate_url} onChange={(e)=>setForm({...form, affiliate_url:e.target.value})} className="border p-2 rounded-lg" />
          </div>

          <div>
            <input ref={fileRef} type="file" accept="image/*" onChange={(e)=>setFile(e.target.files?.[0] || null)} className="w-full" />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
              {form.id ? (loading ? 'Updating...' : 'Update Produk') : (loading ? 'Saving...' : 'Simpan Produk')}
            </button>
            <button type="button" onClick={()=>{ setForm({ id:null, code:'', name:'', brand:'', category:'Shirts', price:'', available:true, affiliate_url:'', image_url:'' }); setFile(null); if (fileRef.current) fileRef.current.value = null; }} className="bg-gray-100 px-4 py-2 rounded-lg">Reset</button>
          </div>
        </form>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Semua Produk</h2>
          {loading ? (<div>Loading...</div>) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {products.map((p)=> (
                <div key={p.id} className="bg-white p-3 rounded-xl shadow-sm flex flex-col">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover rounded-lg mb-2" />
                  ) : (
                    <div className="w-full h-36 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-gray-400">No Image</div>
                  )}
                  <h3 className="font-semibold text-sm">{p.name}</h3>
                  <p className="text-xs text-gray-500">{p.brand} • {p.category}</p>
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

// --- Catalog grouped by category (used by both public and optionally admin) ---
function Catalog() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const categoriesOrder = ['Shirts','T-Shirts','Jackets','Pants','Accessories','Shoes','Bags'];

  useEffect(()=>{ fetchProducts(); }, []);
  async function fetchProducts(){
    const { data } = await supabase.from('products').select('*').eq('available', true).order('created_at', { ascending: false });
    setProducts(data || []);
  }

  const filtered = products.filter(p => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (p.name || '').toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q);
  });

  // group by category preserving order and skipping empty
  const grouped = {};
  categoriesOrder.forEach(cat => grouped[cat] = []);
  filtered.forEach(p => {
    const cat = categoriesOrder.includes(p.category) ? p.category : 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  const categoryIcons = {
    Shirts: '👕',
    'T-Shirts': '👚',
    Jackets: '🧥',
    Pants: '👖',
    Accessories: '🕶️',
    Shoes: '👟',
    Bags: '👜',
    Other: '📦'
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Katalog Produk</h1>
        <input placeholder="Cari kode / nama / brand..." value={search} onChange={(e)=>setSearch(e.target.value)} className="w-full border p-2 rounded-lg mb-6" />

        {Object.keys(grouped).map((cat) => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return (
            <section key={cat} className="mb-8">
              <h2 className="text-lg font-semibold mb-3">{categoryIcons[cat] || '📦'} {cat}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {items.map(p => (
                  <div key={p.id} className="border rounded-xl p-2 flex flex-col">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover rounded-lg mb-1" />
                    ) : (
                      <div className="w-full h-36 bg-gray-100 rounded-lg mb-1 flex items-center justify-center text-gray-400">No Image</div>
                    )}
                    <p className="text-xs text-gray-400">{p.code}</p>
                    <h3 className="font-semibold text-sm">{p.name}</h3>
                    <p className="text-xs text-gray-500">{p.brand}</p>
                    <p className="text-sm font-bold mt-1">Rp{formatPrice(p.price)}</p>
                    {p.affiliate_url && (
                      <a href={`https://${p.affiliate_url}`} target="_blank" rel="noopener noreferrer" className="mt-2 bg-blue-600 text-white text-xs py-1 rounded-full text-center hover:bg-blue-700 transition">Beli Sekarang</a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* floating buttons */}
      <button onClick={()=>{document.querySelector('input[type=file]')?.scrollIntoView({behavior:'smooth'});}} className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition">+</button>
      <ThemeToggle />
    </div>
  );
}

// --- ProtectedRoute ---
const ProtectedRoute = ({ children }) => {
  const { user } = React.useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// --- App (root) ---
export default function App(){
  return (
    <AuthProvider>
      <Router>
        <Header />
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="*" element={<Navigate to="/catalog" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

// --- Login Page --- (diletakkan di akhir agar lebih ringkas)
function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      toast.error('Login gagal!');
    } else {
      toast.success('Login berhasil!');
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 px-6 py-10">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        <h1 className="text-3xl font-extrabold text-center text-gray-900 mb-2 tracking-tight">KatalogAdmin</h1>
        <p className="text-center text-gray-500 mb-6 text-sm">Masuk untuk mengelola produk Anda</p>
        {error && <p className="text-red-500 text-sm mb-2 text-center">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition"
              required
            />
          </div>
          <button type="submit" className="w-full bg-black text-white py-2.5 rounded-lg font-semibold hover:bg-gray-800 transition">
            Login
          </button>
        </form>
      </div>
      <p className="text-xs text-gray-400 mt-6">© {new Date().getFullYear()} KatalogAdmin. All rights reserved.</p>
    </div>
  );
}

// ---------------- SQL
/*
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS affiliate_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available boolean DEFAULT true;
*/
