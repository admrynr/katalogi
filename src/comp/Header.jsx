import React, { useEffect, useState, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from "../lib/AuthContext";

// --- Header ---
export default function Header({ dark, setDark }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  async function handleLogout() { await supabase.auth.signOut(); toast.success('Berhasil logout!'); navigate('/login'); }
  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        <div><Link to="/catalog" className="text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Katalog<span className="text-gray-400">in</span></Link></div>
        <nav className="flex items-center gap-3 text-sm">
          <Link to="/catalog" className="text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition">Katalog</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition">Dashboard</Link>
              <Link to="/history" className="text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition">History</Link>
              <button onClick={handleLogout} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full hover:bg-blue-700 transition">Logout</button></>) : (<Link to="/login" className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full hover:bg-blue-700 transition">Login</Link>)}
              <button aria-label="Toggle theme" onClick={() => setDark(v=>!v)} className="fixed bottom-6 right-6 ml-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 rounded-full transition-colors duration-300">{dark ? '☀️' : '🌙'}</button>
        </nav>
      </div>
    </header>
  );
}