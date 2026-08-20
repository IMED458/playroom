import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleName } from '../types';
import { Shield, Gamepad2, UserCheck, Lock, ArrowRight, Zap } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login, quickLogin } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'ავტორიზაცია ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = async (role: RoleName) => {
    setError(null);
    setLoading(true);
    try {
      await quickLogin(role);
    } catch (err: any) {
      setError(err.message || 'სწრაფი შესვლა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Gamepad2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Play Room Arena</h1>
            <p className="text-xs text-slate-400">მართვისა და POS სისტემა</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              მომხმარებელი
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition"
                placeholder="სახელი / username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              პაროლი
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>{loading ? 'შესვლა...' : 'სისტემაში შესვლა'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="border-t border-slate-800 pt-5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-3">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>სწრაფი ტესტირება როლების მიხედვით:</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuick(RoleName.SUPER_ADMIN)}
              disabled={loading}
              className="px-2.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium flex flex-col items-center gap-1 transition cursor-pointer"
            >
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Super Admin</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuick(RoleName.ADMIN)}
              disabled={loading}
              className="px-2.5 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium flex flex-col items-center gap-1 transition cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-blue-400" />
              <span>Admin</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuick(RoleName.OPERATOR)}
              disabled={loading}
              className="px-2.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex flex-col items-center gap-1 transition cursor-pointer"
            >
              <Gamepad2 className="w-4 h-4 text-emerald-400" />
              <span>Operator</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
