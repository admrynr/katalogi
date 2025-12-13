// App.jsx — Full with brands table (autocomplete lightweight) + relasi brand_id
// Features:
// - brands table (separate) with brand_id in products
// - lightweight autocomplete (no extra libs) for brand input
// - auto-insert brand if not exists on product save
// - display brand name via relation when querying products
// - preserves dark mode, auto-logout, uploads, grouped catalog, affiliate link handling

import React, { useEffect, useRef, useState, createContext } from 'react';
import { AuthProvider } from "./lib/AuthContext";
import { useAuth } from "./lib/AuthContext";
import { createClient } from '@supabase/supabase-js';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { supabase } from "./lib/supabase";
import LookDetail from './LookDetail';
import GeneratedHistory from "./GeneratedHistory";
import { useTheme } from './lib/darkTheme';
import Header from './comp/Header';
import ExportCard from './comp/ExportCard';
import { downloadCard } from "./lib/downloadCard";


// --- Utilities ---
function formatPrice(p) { const n = Number(p); if (!Number.isFinite(n)) return '—'; return n.toLocaleString('id-ID'); }
function normalizeAffiliate(url) { if (!url) return null; return url.startsWith('http') ? url : `https://${url}`; }

// ------------------ Brand-enabled Dashboard (with search + grouped view) ------------------
function Dashboard() {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]); // list of brands for suggestions
  const [brandQuery, setBrandQuery] = useState('');
  const [brandSuggestionsOpen, setBrandSuggestionsOpen] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ id:null, code:'', name:'', brand_name:'', brand_id:null, category:'Shirts', price:'', available:true, affiliate_url:'', image_url:'' });
  const [file, setFile] = useState(null);
  const [search, setSearch] = useState('');
  const categories = ['Shirts','TShirts','Jackets','Pants','Accessories','Shoes','Bags'];
  const exportRef = useRef(null);
  const [exportProduct, setExportProduct] = useState(null);


  useEffect(()=>{ if (!user) return; fetchProducts(); fetchBrands(); }, [user]);

  async function fetchProducts(){ setLoading(true); // include brand relation: brands(name)
    const { data } = await supabase.from('products').select('*, brands(name)').order('created_at', { ascending: false });
    setProducts(data || []); setLoading(false);
  }

  async function fetchBrands(){ const { data } = await supabase.from('brands').select('*').order('name', { ascending: true }); setBrands(data || []); }

  async function uploadFileIfAny(){ if (!file) return form.image_url || null; const fileName = `${Date.now()}_${file.name.replace(/\s+/g,'_')}`; const { error } = await supabase.storage.from('product-images').upload(fileName, file); if (error) { console.error(error); toast.error('Gagal upload gambar'); return form.image_url || null; } const { data: publicUrl } = supabase.storage.from('product-images').getPublicUrl(fileName); return publicUrl.publicUrl; }

  function generateCodeForCategory(cat){ const prefix = (cat||'OTH').substring(0,3).toUpperCase(); const count = products.filter(p=>p.category===cat).length; return `${prefix}${String(count+1).padStart(3,'0')}`; }

  // select a suggestion
  function pickBrandSuggestion(b){ setForm({...form, brand_name: b.name}); setSelectedBrandId(b.id); setBrandQuery(''); setBrandSuggestionsOpen(false); }

  // on save: ensure brand exists (if selectedBrandId use it, else try to find by name or create)
  async function ensureBrandId(brandName){ if (!brandName) return null; // try selected
    if (selectedBrandId) return selectedBrandId; // find existing
    const found = brands.find(b => b.name.toLowerCase() === brandName.trim().toLowerCase()); if (found) return found.id; // insert new
    const { data, error } = await supabase.from('brands').insert([{ name: brandName.trim() }]).select('id').single(); if (error) { console.error(error); toast.error('Gagal menyimpan brand'); return null; } // refresh brands list
    fetchBrands(); return data.id;
  }

  async function handleSaveOrUpdate(e){ e && e.preventDefault(); setLoading(true); const imageUrl = await uploadFileIfAny(); const brandId = await ensureBrandId(form.brand_name); const payload = { code: form.code || generateCodeForCategory(form.category), name: form.name||'', brand_id: brandId||null, category: form.category||'Other', price: Number(form.price)||0, available: !!form.available, affiliate_url: form.affiliate_url||null, image_url: imageUrl||null };
    if (form.id){ const { error } = await supabase.from('products').update(payload).eq('id', form.id); if (error) toast.error('Gagal update produk'); else toast.success('Produk berhasil diupdate'); }
    else { const { error } = await supabase.from('products').insert([payload]); if (error) toast.error('Gagal menyimpan produk'); else toast.success('Produk berhasil disimpan'); }
    setForm({ id:null, code:'', name:'', brand_name:'', brand_id:null, category:'Shirts', price:'', available:true, affiliate_url:'', image_url:'' }); setFile(null); if (fileRef.current) fileRef.current.value=null; setSelectedBrandId(null); await fetchProducts(); setLoading(false); }

  async function handleEdit(p){ // p may include brands object
    setForm({ id:p.id, code:p.code, name:p.name, brand_name: p.brands?.name || '', brand_id: p.brand_id || null, category:p.category, price:p.price ?? '', available:!!p.available, affiliate_url:p.affiliate_url || '', image_url:p.image_url || '' }); setSelectedBrandId(p.brand_id || null); window.scrollTo({top:0, behavior:'smooth'}); }
  
  async function handleConfirmDelete(id){
    toast('Hapus produk ini?', {
      action: {
        label: 'Hapus',
        onClick: () => handleDelete(id),
      },
      cancel: {
        label: 'Batal'
      }
    })
  }
  async function handleDelete(id){
    const { error } = await supabase.from('products').delete().eq('id', id); 
    if (error) toast.error('Gagal menghapus'); else { toast.success('Produk dihapus'); 
      fetchProducts(); } 
  }

  // suggestions filtered locally for instant UX
  const brandSuggestions = brandQuery ? brands.filter(b => b.name.toLowerCase().includes(brandQuery.toLowerCase())).slice(0,8) : [];

  // filtering & grouping for dashboard display
  const filtered = products.filter(p => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return true;
    return (
      (p.name||'').toLowerCase().includes(q) ||
      (p.brands?.name||'').toLowerCase().includes(q) ||
      (p.code||'').toLowerCase().includes(q)
    );
  });

  const grouped = {};
  categories.forEach(c => grouped[c]=[]);
  filtered.forEach(p => { const cat = categories.includes(p.category) ? p.category : 'Other'; if (!grouped[cat]) grouped[cat]=[]; grouped[cat].push(p); });

    const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename || 'file';
      link.click();
      window.URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Download gagal', err);
    }
  };

  return (
  <>
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Dashboard Produk</h1>

        {/* CRUD form (unchanged functionality) */}
        <form onSubmit={handleSaveOrUpdate} className="space-y-3 bg-white dark:bg-gray-800 dark:border-gray-700 border rounded-xl p-4 shadow transition-colors duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select value={form.category} onChange={(e)=>setForm({...form, category:e.target.value})} className="border p-2 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600">{categories.map(c=> <option key={c} value={c}>{c}</option>)}</select>
            <input placeholder="Nama" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} className="border p-2 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* Brand autocomplete input */}
            <div className="relative">
              <input placeholder="Brand" value={form.brand_name} onChange={(e)=>{ setForm({...form, brand_name: e.target.value}); setBrandQuery(e.target.value); setSelectedBrandId(null); setBrandSuggestionsOpen(true); }} onFocus={()=>setBrandSuggestionsOpen(true)} onBlur={()=>setTimeout(()=>setBrandSuggestionsOpen(false), 150)} className="w-full border p-2 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600" />
              {brandSuggestionsOpen && brandSuggestions.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow max-h-44 overflow-auto">
                  {brandSuggestions.map(b=> (
                    <li key={b.id} onMouseDown={() => pickBrandSuggestion(b)} className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">{b.name}</li>
                  ))}
                </ul>
              )}
            </div>

            <input placeholder="Harga" type="number" value={form.price} onChange={(e)=>setForm({...form, price:e.target.value})} className="border p-2 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.available} onChange={(e)=>setForm({...form, available:e.target.checked})} /> <span className="text-sm">Tersedia</span></label>
            <input placeholder="Link affiliate" value={form.affiliate_url} onChange={(e)=>setForm({...form, affiliate_url:e.target.value})} className="border p-2 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600" />
          </div>

          <div><input ref={fileRef} type="file" accept="image/*" onChange={(e)=>setFile(e.target.files?.[0]||null)} className="w-full bg-white dark:bg-gray-700" /></div>

          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">{form.id ? (loading ? 'Updating...' : 'Update Produk') : (loading ? 'Saving...' : 'Simpan Produk')}</button>
            <button type="button" onClick={()=>{ setForm({ id:null, code:'', name:'', brand_name:'', brand_id:null, category:'Shirts', price:'', available:true, affiliate_url:'', image_url:'' }); setFile(null); if (fileRef.current) fileRef.current.value=null; setSelectedBrandId(null); }} className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg">Reset</button>
          </div>
        </form>

        {/* SEARCH + Grouped product listing */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Semua Produk</h2>
            <input placeholder="Cari nama / kode / brand..." value={search} onChange={(e)=>setSearch(e.target.value)} className="border p-2 rounded-lg w-1/2 bg-white dark:bg-gray-800 dark:border-gray-700" />
          </div>

          {Object.keys(grouped).map(cat => {
            const items = grouped[cat];
            if (!items || items.length===0) return null;
            return (
              <section key={cat} className="mb-8">
                <h3 className="text-md font-semibold mb-3">{cat} ({items.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {items.map(p => (
                    <div key={p.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm flex flex-col border dark:border-gray-700 transition-colors duration-300">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover rounded-lg mb-2" /> : <div className="w-full h-36 bg-gray-100 dark:bg-gray-700 rounded-lg mb-2 flex items-center justify-center text-gray-400">No Image</div>}
                      <p className="text-xs text-gray-400">{p.code}</p>
                      <h4 className="font-semibold text-sm">{p.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-300">{p.brands?.name || '—'}</p>
                      <p className="text-sm font-bold mt-1">Rp{formatPrice(p.price)}</p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={()=>handleEdit(p)} className="bg-blue-600 text-white px-3 py-1 rounded-md text-xs hover:bg-blue-700">Edit</button>
                        <button onClick={()=>
                          handleConfirmDelete(p.id)
                        } className="bg-red-100 text-red-600 px-3 py-1 rounded-md text-xs">Hapus</button>
                      </div>
                        {p.image_url && (
                          <button
                          onClick={() => {
                            setExportProduct(p);
                            setTimeout(() => {
                              downloadCard(exportRef, `${p.name}-reels.png`);
                            }, 100);
                          }}
                          className="mt-2 bg-black hover:bg-gray-700 text-white text-xs px-3 py-1 rounded-md"
                        >
                          Download Reels Card
                        </button>

                        )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

        </div>
      </div>
    </div>

    {/* EXPORT RENDER (hidden) */}
    <div className="fixed -left-[9999px] top-0">
      <ExportCard ref={exportRef} product={exportProduct} />
    </div>
  </>
  );


}

// ------------------ Catalog (reads brands relation) ------------------
function Catalog(){
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const categoriesOrder = ['Shirts','TShirts','Jackets','Pants','Accessories','Shoes','Bags'];
  // --- Mix & Match ---
  const [mmOpen, setMMOpen] = useState(false);
  const [mmSelected, setMMSelected] = useState({});
  const [mmLoading, setMMLoading] = useState(false);
  const [mmDone, setMMDone] = useState(false);
  const [mmResultUrl, setMMResultUrl] = useState("");
  const [saving, setSaving] = useState(false);

  


  useEffect(()=>{ fetchProducts(); }, []);
  async function fetchProducts(){ const { data } = await supabase.from('products').select('*, brands(name)').eq('available', true).order('created_at', { ascending: false }); setProducts(data || []); }

  const handleGenerateLook = async () => {
  setSaving(true);

  // ✓ AMBIL USER DI SINI
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    toast.warning("Login untuk mengakses fitur ini.");
    setSaving(false);
    return;
  }  setMMLoading(true);
  setMMDone(false);

  const selected = Object.values(mmSelected);
  if (selected.length === 0) {
    alert("Pilih minimal 1 item");
    setMMLoading(false);
    return;
  }

  // Dummy: ambil gambar pertama
  const dummyUrl = selected[0].image_url;

  // Ambil array product id
  const ids = selected.map(p => p.id);

  // Combo ID random
  const comboId = Math.random().toString(36).substring(2, 9);

  //url hasil generate
  const url = `${window.location.origin}/look/${comboId}`;


  // Simpan ke Supabase
  const { error } = await supabase.from("combos").insert({
    id: comboId,
    items: ids,
    image_url: dummyUrl,
    created_at: new Date(),
    created_by: user.id,   // wajib
    generated_url: url
  });

  if (error) {
    console.error(error);
    alert("Gagal menyimpan combo");
    setMMLoading(false);
    return;
  }

  setMMResultUrl(url);
  setMMDone(true);
  setMMLoading(false);
};


  const filtered = products.filter(p => { const q = search.trim().toLowerCase(); if (!q) return true; return (p.name||'').toLowerCase().includes(q) || (p.brands?.name||'').toLowerCase().includes(q) || (p.code||'').toLowerCase().includes(q); });

  const grouped = {}; categoriesOrder.forEach(cat => grouped[cat]=[]); filtered.forEach(p=>{ const cat = categoriesOrder.includes(p.category)? p.category : 'Other'; if (!grouped[cat]) grouped[cat]=[]; grouped[cat].push(p); });

  const categoryIcons = { Shirts:'👕','TShirts':'👚',Jackets:'🧥',Pants:'👖',Accessories:'🕶️',Shoes:'👟',Bags:'👜',Other:'📦' };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl text-gray-900 font-bold mb-4">Katalog Produk</h1>
        <input placeholder="Cari kode / nama / brand..." value={search} onChange={(e)=>setSearch(e.target.value)} className="w-full border p-2 rounded-lg mb-6 bg-white dark:bg-gray-800 dark:border-gray-700" />

        {Object.keys(grouped).map(cat => {
  const items = grouped[cat];
  if (!items || items.length === 0) return null;
  return (
    <section key={cat} className="mb-8">
      <h2 className="text-lg font-semibold mb-3">{categoryIcons[cat] || '📦'} {cat}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map(p => (
          <div key={p.id} className="border rounded-xl p-2 flex flex-col bg-white dark:bg-gray-800 dark:border-gray-700 transition-colors duration-300">
            {p.image_url 
              ? <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover rounded-lg mb-1" /> 
              : <div className="w-full h-36 bg-gray-100 dark:bg-gray-700 rounded-lg mb-1 flex items-center justify-center text-gray-400">No Image</div>
            }
            <p className="text-xs text-gray-400">{p.code}</p>
            <h3 className="font-semibold text-sm">{p.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-300">{p.brands?.name || '—'}</p>
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
      {/* Floating Mix & Match Button */}
      <button
        onClick={() => setMMOpen(true)}
        className="fixed bottom-4 left-4 bg-blue-600 text-white px-4 py-3 rounded-full shadow-lg z-50 hover:bg-blue-700"
      >
        Mix & Match
      </button>

      
  {/* ---------------- MIX & MATCH MODAL ---------------- */}
{mmOpen && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
    <div className="bg-white dark:bg-gray-900 dark:text-gray-100 w-full md:w-96 max-h-[90vh] rounded-t-2xl md:rounded-xl overflow-y-auto">
      
      {/* HEADER */}
      <div className="p-4 border-b flex justify-between items-center sticky top-0 dark:bg-gray-900 dark:text-gray-100 bg-white z-10">
        <h2 className="text-lg font-semibold">Mix & Match</h2>
        <button onClick={() => setMMOpen(false)}>✕</button>
      </div>

      {/* BODY */}
      <div className="p-4 space-y-4">
        {Object.keys(grouped).map(category => {
          const items = grouped[category];
          if (!items || items.length === 0) return null;

          return (
            <div key={category}>
              <p className="font-medium mb-2">{category}</p>
              <div className="grid grid-cols-3 gap-3">
                {items.map(p => {
                  const active = mmSelected[category]?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() =>
                        setMMSelected(prev => ({ ...prev, [category]: p }))
                      }
                      className={`border rounded-lg overflow-hidden cursor-pointer ${
                        active ? "border-blue-600" : "border-gray-300"
                      }`}
                    >
                      <img src={p.image_url} className="w-full h-24 object-cover" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className="p-4 border-t bg-white dark:bg-gray-900 dark:text-gray-100 sticky bottom-0">

        {/* Loading */}
        {mmLoading && (
          <button className="w-full bg-gray-300 px-4 py-2 rounded-lg">
            Generating...
          </button>
        )}

        {/* Done */}
        {!mmLoading && mmDone && (
          <div className="space-y-2">
            <input
              readOnly
              value={mmResultUrl}
              className="w-full border px-3 py-2 rounded-lg"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(mmResultUrl);
                toast.success("Berhasil menyalin link!");
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Copy URL
            </button>
          </div>
        )}

        {/* Generate Button */}
        {!mmLoading && !mmDone && (
          <button
            onClick={handleGenerateLook}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Generate Look
          </button>
        )}

      </div>
    </div>
  </div>
)}
{/* -------------- END MODAL -------------- */}

    </div>
    
  );
}

// --- ProtectedRoute ---
const ProtectedRoute = ({ children }) => { const { user } = useAuth(); if (!user) return <Navigate to="/login" replace />; return children; };

// --- Login ---
function Login(){ const navigate = useNavigate(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState('');
  const handleLogin = async (e)=>{ e.preventDefault(); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) { setError(error.message); toast.error('Login gagal!'); } else { toast.success('Login berhasil!'); navigate('/dashboard'); } };
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
  ); }

// --- App (root) ---
export default function App(){ const [dark, setDark] = useTheme();
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
            <Route path="/look/:id" element={<LookDetail />} />
            <Route path="/history" element={<GeneratedHistory />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  ); }

// ---------------- SQL (run in Supabase SQL editor)
/*
-- new brands table
create table if not exists public.brands (
  id bigint generated by default as identity primary key,
  name text unique not null,
  created_at timestamptz default now()
);

-- add brand_id to products (nullable, FK to brands.id)
alter table public.products add column if not exists brand_id bigint references public.brands(id) on delete set null;

-- optional: remove old text brand column if you migrated values
-- alter table public.products drop column if exists brand;
*/
