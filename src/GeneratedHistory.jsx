import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { Link } from "react-router-dom";
import { Toaster, toast } from 'sonner';

export default function GeneratedHistory() {
  const [list, setList] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ambil user ID
  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
      }
    }
    getUser();
  }, []);

  // Ambil combo user
  useEffect(() => {
    if (!userId) return;

    async function loadCombos() {
      const { data, error } = await supabase
        .from("combos")
        .select("*")
        .eq("created_by", userId)
        .order("created_at", { ascending: false });

      if (!error) setList(data);
      setLoading(false);
    }

    loadCombos();
  }, [userId]);

  if (loading) return <div className="p-4">Loading...</div>;

  if (!list.length)
    return (
      <div className="p-4 text-center text-gray-500">
        Belum ada kombinasi yang kamu buat.
      </div>
    );

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold mb-4">Riwayat Generated Look</h2>

      <div className="grid grid-cols-2 gap-4">
        {list.map((c) => (
          <div
            key={c.id}
            className="border rounded-xl overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm"
          >
            {/* Preview gambar */}
            {c.image_url ? (
              <img
                src={c.image_url}
                alt="Generated Look"
                className="w-full h-40 object-cover"
              />
            ) : (
              <div className="w-full h-40 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}

            <div className="p-2 text-xs space-y-2">
              {/* Timestamp */}
              <p className="text-gray-400">
                {new Date(c.created_at).toLocaleString("id-ID")}
              </p>

              {/* Link ke halaman combo */}
              <Link
                to={`/look/${c.id}`}
                className="block bg-blue-600 text-white text-center py-1 rounded-md"
              >
                Lihat Detail
              </Link>

              {/* Link generated_url */}
              {c.generated_url && (
                <button
                    onClick={() => {
                    navigator.clipboard.writeText(c.generated_url);
                    toast.success("Berhasil menyalin link!");
                    }}
                    className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-1 rounded-md text-xs"
                >
                    Copy URL
                </button>
            )}

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
