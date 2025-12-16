import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from "../lib/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export default function Header({ dark, setDark }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);


  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success('Berhasil logout!');
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        
        {/* Logo */}
        <Link to="/catalog" className="text-lg font-semibold dark:text-gray-100">
          Katalog<span className="text-gray-400">in</span>
        </Link>

        {/* Hamburger (Mobile) */}
        <button
          className="md:hidden p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => setOpen(!open)}
        >
          {open ? "✕" : "☰"}
        </button>

        {/* Nav */}
        <nav
          className={`
            flex-col md:flex md:flex-row md:items-center 
            gap-3 text-sm 
            absolute md:static left-0 right-0 top-full
            bg-white dark:bg-gray-900 border-b md:border-0 
            md:p-0 p-4 transition-all duration-200 
            ${open ? 'flex' : 'hidden'}
          `}
        >
          <Link to="/catalog" className="nav-item">Katalog</Link>

          {user ? (
            <>
              <Link to="/dashboard" className="nav-item">Dashboard</Link>
              <Link to="/history" className="nav-item">History</Link>
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

        {/* Theme Toggle */}
        <button
          aria-label="Toggle theme"
          onClick={() => setDark(v => !v)}
          className="fixed bottom-6 right-6 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 rounded-full"
        >
          {dark ? '☀️' : '🌙'}
        </button>
          
      </div>
      
    </header>
  );
}
