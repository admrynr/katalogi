import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase"; // SESUAIKAN PATH
import { toast } from "sonner";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setUser(session?.user || null);
      } catch (e) {
        console.error("getSession failed", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    // listen auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setUser(session?.user || null);
      }
    );

    // auto logout
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const exp = data?.session?.expires_at;

        if (exp && Date.now() / 1000 > exp) {
          await supabase.auth.signOut();
          toast.error("Sesi berakhir, silakan login kembali");
        }
      } catch (e) {}
    }, 60 * 1000);

    return () => {
      mounted = false;
      try {
        listener.subscription.unsubscribe();
      } catch (e) {}
      clearInterval(interval);
    };
  }, []);

  if (loading)
    return <div className="text-center p-8">Loading session...</div>;

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
}

// 🔥 *Custom hook biar simpel saat import*
export function useAuth() {
  return useContext(AuthContext);
}
