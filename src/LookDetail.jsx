import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase"; // sesuaikan path kamu
import { useAuth } from "./lib/AuthContext";
import { downloadFile } from "./lib/downloadFile";
import { toast } from "sonner";

export default function LookDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const [combo, setCombo] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
const [modalOpen, setModalOpen] = useState(false);

async function handleUpload(e) {
  try {
    setUploading(true);
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `combo-${id}-${Date.now()}.${fileExt}`;
    const filePath = `combos/${fileName}`;

    // Upload ke Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("combo-images") // ganti sesuai bucket
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Upload gagal");
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("combo-images")
      .getPublicUrl(filePath);
      
    // Tambah cache-buster
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update DB
    const { error: updateError } = await supabase
      .from("combos")
      .update({ image_url: newUrl })
      .eq("id", id);

    if (updateError) {
      toast.error("Gagal update URL");
      return;
    }

    // Update state
    setCombo(prev => ({ ...prev, image_url: newUrl }));
    setModalOpen(false);
    toast.success("Gambar berhasil diubah!");
  } finally {
    setUploading(false);
  }
}


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

      {user && (
  <div className="text-center mt-3">
    <button
      onClick={() => setModalOpen(true)}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
    >
      Ganti Gambar
    </button>
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
              <a href={normalizeAffiliate(item.affiliate_url)} target="_blank" rel="noopener noreferrer" className="mt-2 bg-blue-600 text-white text-xs py-1 rounded-md text-center hover:bg-blue-700 transition">Beli Sekarang</a>
            )}

            {user && (
              <button
                onClick={() => downloadFile(item.image_url, `${item.name}${item.image_url.substring(item.image_url.lastIndexOf('.'))}`)}
                className="mt-2 bg-blue-600 text-white text-xs px-3 py-1 rounded-md text-center hover:bg-blue-700 transition"
              >
                Download Gambar
              </button>
            )}

          </div>
        ))}
      </div>

        {/* Modal Upload */}
{modalOpen && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg w-80 relative">

      <h3 className="text-lg font-semibold mb-4 text-center">
        Upload Gambar Baru
      </h3>

      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
        className="w-full text-sm mb-3"
      />

      {uploading && <p className="text-xs text-gray-500 mt-1">Uploading...</p>}

      <button
        onClick={() => setModalOpen(false)}
        className="mt-4 w-full py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        disabled={uploading}
      >
        Batal
      </button>

    </div>
  </div>
)}

    </div>
  );
}
