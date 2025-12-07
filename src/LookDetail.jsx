import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase"; // sesuaikan path kamu

export default function LookDetail() {
  const { id } = useParams();
  const [combo, setCombo] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Utilities ---
function formatPrice(p) { const n = Number(p); if (!Number.isFinite(n)) return '—'; return n.toLocaleString('id-ID'); }
function normalizeAffiliate(url) { if (!url) return null; return url.startsWith('http') ? url : `https://${url}`; }

  useEffect(() => {
    async function loadCombo() {
      // 1. Ambil combo berdasarkan ID
      const { data: comboData, error } = await supabase
        .from("combos")
        .select("*")
        .eq("id", id)
        .single();

      if (!comboData || error) {
        setLoading(false);
        return;
      }

      setCombo(comboData);

      // 2. Ambil produk berdasarkan ID array
      const { data: productData } = await supabase
        .from("products") // tabel produk kamu
        .select("*, brands(name)")
        .in("id", comboData.items);

      setProducts(productData || []);
      setLoading(false);
    }

    loadCombo();
  }, [id]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!combo) return <div className="p-4">Combo tidak ditemukan.</div>;

  return (
    <div className="p-4 space-y-4">

    <h2 className="text-lg font-semibold">Hasil Mix and Match</h2>
      {/* Gambar hasil generate */}
      {combo.image_url && (
        <div>
          <img
            src={combo.image_url}
            className="w-full rounded-lg shadow"
            alt="Generated Look"
          />
        </div>
      )}

      <h2 className="text-lg font-semibold">Produk yang dipilih</h2>

      <div className="grid grid-cols-2 gap-3">
        {products.map((item) => (
        <div key={item.id} className="border rounded-xl p-2 flex flex-col bg-white dark:bg-gray-800 dark:border-gray-700 transition-colors duration-300">
            {item.image_url 
              ? <img src={item.image_url} alt={item.name} className="w-full h-36 object-cover rounded-lg mb-1" /> 
              : <div className="w-full h-36 bg-gray-100 dark:bg-gray-700 rounded-lg mb-1 flex items-center justify-center text-gray-400">No Image</div>
            }
            <p className="text-xs text-gray-400">{item.code}</p>
            <h3 className="font-semibold text-sm">{item.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-300">{item.brands?.name || '—'}</p>
            <p className="text-sm font-bold mt-1">Rp{formatPrice(item.price)}</p>

            {item.affiliate_url && (
              <a href={normalizeAffiliate(item.affiliate_url)} target="_blank" rel="noopener noreferrer" className="mt-2 bg-blue-600 text-white text-xs py-1 rounded-full text-center hover:bg-blue-700 transition">Beli Sekarang</a>
            )}

          </div>
        ))}
      </div>

    </div>
  );
}
