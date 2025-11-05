// Simple Product Catalog - React + Supabase (Enhanced UI + Animations + Bug Fixes)
// -----------------------------------------------------------
// Fitur: Auth (Supabase), CRUD + Upload Gambar + Edit, Katalog Publik (Affiliate Link), RLS Supabase, Toast (Sonner), Animasi

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { motion } from 'framer-motion';

// --- Supabase setup ---
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// --- AuthContext ---
const AuthContext = React.createContext();
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
};

// --- Header ---
function Header() {
  const { user } = React.useContext(AuthContext);
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success('Berhasil logout!');
    navigate('/login');
  }

  return (
    <header className="bg-black text-white flex justify-between items-center px-4 py-3 sticky top-0 z-50 shadow-md">
      <Link to="/catalog" className="text-lg font-bold tracking-tight">
        Katalog<span className="text-gray-300">Admin</span>
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link to="/catalog" className="hover:text-gray-300 transition">
          Katalog
        </Link>
        {user ? (
          <>
            <Link to="/dashboard" className="hover:text-gray-300 transition">
              Dashboard
            </Link>
            {user && <span className="hidden md:inline text-gray-300">{user.email}</span>}
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-black px-3 py-1.5 rounded-md transition"
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="bg-white text-black px-3 py-1.5 rounded-lg hover:bg-gray-200 transition"
          >
            Login
          </Link>
        )}
      </nav>
    </header>
  );
}

// --- Dashboard ---
function Dashboard() {
  const { user } = React.useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    code: '',
    name: '',
    brand: '',
    category: 'Shirts',
    price: '',
    available: true,
    affiliate_url: '',
    image_url: '',
  });
  const [file, setFile] = useState(null);
  const [editId, setEditId] = useState(null);

  const categories = ['Shirts', 'T-Shirts', 'Jackets', 'Pants', 'Accessories', 'Shoes', 'Bags'];

  useEffect(() => {
    if (!user) return;
    fetchProducts();
  }, [user]);

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(data || []);
  }

  async function handleUpload() {
    if (!file) return null;
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('product-images').upload(fileName, file);
    if (error) {
      toast.error('Gagal upload gambar!');
      console.error(error);
      return null;
    }
    const { data: publicUrl } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return publicUrl.publicUrl;
  }

  function generateCode(category, index) {
    const prefix = category.substring(0, 3).toUpperCase();
    const number = String(index + 1).padStart(3, '0');
    return `${prefix}${number}`;
  }

  async function handleSave(e) {
    e.preventDefault();
    let imageUrl = form.image_url;
    if (file) imageUrl = await handleUpload();

    const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const code = generateCode(form.category, count || 0);

    const newProduct = {
      ...form,
      code,
      price: parseFloat(form.price),
      available: form.available,
      image_url: imageUrl,
    };

    const { error } = await supabase.from('products').insert([newProduct]);
    if (error) toast.error('Gagal menyimpan produk!');
    else {
      toast.success('Produk berhasil disimpan!');
      setForm({ code: '', name: '', brand: '', category: 'Shirts', price: '', available: true, affiliate_url: '', image_url: '' });
      setFile(null);
      fetchProducts();
      document.querySelector('input[type="file"]').value = null;
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    let imageUrl = form.image_url;
    if (file) imageUrl = await handleUpload();

    const updated = { ...form, image_url: imageUrl };
    const { error } = await supabase.from('products').update(updated).eq('id', editId);
    if (error) toast.error('Gagal update produk!');
    else {
      toast.success('Produk berhasil diupdate!');
      setEditId(null);
      setForm({ code: '', name: '', brand: '', category: 'Shirts', price: '', available: true, affiliate_url: '', image_url: '' });
      setFile(null);
      fetchProducts();
      document.querySelector('input[type="file"]').value = null;
    }
  }

  async function handleDelete(id) {
    if (confirm('Hapus produk ini?')) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) toast.error('Gagal menghapus produk!');
      else {
        toast.success('Produk berhasil dihapus!');
        fetchProducts();
      }
    }
  }

  function handleEdit(p) {
    setEditId(p.id);
    setForm(p);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <h1 className="text-xl font-bold mb-4">Dashboard Produk</h1>
      <form onSubmit={editId ? handleUpdate : handleSave} className="space-y-2 bg-white p-4 rounded-xl shadow-md">
        <input placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border p-2 rounded-lg" />
        <input placeholder="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full border p-2 rounded-lg" />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border p-2 rounded-lg">
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input placeholder="Harga" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full border p-2 rounded-lg" />
        <input placeholder="Link Affiliate" value={form.affiliate_url} onChange={(e) => setForm({ ...form, affiliate_url: e.target.value })} className="w-full border p-2 rounded-lg" />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
          <span>Tersedia</span>
        </label>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} className="w-full" />
        <button type="submit" className="w-full bg-black text-white py-2 rounded-lg">
          {editId ? 'Update Produk' : 'Simpan Produk'}
        </button>
      </form>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="bg-white p-3 rounded-xl shadow-sm flex flex-col"
          >
            {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-32 object-cover rounded-lg mb-2" />}
            <h3 className="font-semibold text-sm">{p.name}</h3>
            <p className="text-xs text-gray-500">{p.brand} • {p.category}</p>
            <p className="text-sm font-bold mt-1">Rp{p.price.toLocaleString()}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => handleEdit(p)} className="text-xs bg-blue-100 text-blue-600 rounded-lg py-1 px-2">Edit</button>
              <button onClick={() => handleDelete(p.id)} className="text-xs bg-red-100 text-red-600 rounded-lg py-1 px-2">Hapus</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// --- Catalog ---
function Catalog() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').eq('available', true);
    setProducts(data || []);
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white p-4">
      <h1 className="text-xl font-bold mb-2">Katalog Produk</h1>
      <input placeholder="Cari kode / nama / brand..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border p-2 rounded-lg mb-4" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filtered.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="border rounded-xl p-2 flex flex-col"
          >
            {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover rounded-lg mb-1" />}
            <p className="text-xs text-gray-400">{p.code}</p>
            <h3 className="font-semibold text-sm">{p.name}</h3>
            <p className="text-xs text-gray-500">{p.brand}</p>
            <p className="text-sm font-bold mt-1">Rp{p.price.toLocaleString()}</p>
            {p.affiliate_url && (
              <a
                href={`https://${p.affiliate_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 bg-blue text-white text-center text-xs py-1.5 rounded-lg hover:bg-gray-800 transition"
              >
                Beli Sekarang
              </a>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// --- Protected Route ---
const ProtectedRoute = ({ children }) => {
  const { user } = React.useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// --- App ---
export default function App() {
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