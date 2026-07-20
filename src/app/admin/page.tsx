'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ShieldAlert,
  Trash2,
  LogOut,
  RefreshCw,
  Image as ImageIcon,
  MessageSquare,
  User,
  Calendar,
  Loader2,
  Lock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface Wish {
  id?: string | number;
  author_name: string;
  message?: string | null;
  image_url?: string | null;
  created_at?: string;
}

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '1234';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [wishes, setWishes] = useState<Wish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  // 1. Verificar si ya existe sesión de administrador guardada
  useEffect(() => {
    const sessionAuth = localStorage.getItem('admin_session_auth');
    if (sessionAuth === 'true') {
      setIsAuthenticated(true);
    } else {
      setIsLoading(false);
    }
  }, []);

  // 2. Cargar lista de publicaciones cuando esté autenticado
  const fetchWishes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('wishes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al obtener saludos:', error);
      } else if (data) {
        setWishes(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchWishes();
    }
  }, [isAuthenticated]);

  // 3. Suscripción a cambios en tiempo real (INSERT y DELETE)
  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase
      .channel('admin-wishes-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wishes' },
        (payload) => {
          const newWish = payload.new as Wish;
          setWishes((prev) => [newWish, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'wishes' },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setWishes((prev) =>
              prev.filter((item) => item.id !== deletedId && item.id !== Number(deletedId))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  // Manejo del Login por PIN
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      localStorage.setItem('admin_session_auth', 'true');
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_session_auth');
    setIsAuthenticated(false);
    setPinInput('');
  };

  // Lógica de Borrado Completo (Storage + DB)
  const handleDelete = async (item: Wish) => {
    if (!item.id) return;
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar la publicación de ${item.author_name}? Esta acción se reflejará al instante en la TV.`
    );
    if (!confirmDelete) return;

    setDeletingId(item.id);
    try {
      // 1. Si tiene imagen asociada, intentar borrarla del Storage bucket 'photos'
      if (item.image_url) {
        try {
          const urlParts = item.image_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          if (fileName && fileName.includes('.')) {
            await supabase.storage.from('photos').remove([fileName]);
          }
        } catch (storageErr) {
          console.warn('No se pudo borrar el archivo de storage:', storageErr);
        }
      }

      // 2. Borrar registro de la tabla 'wishes' en Supabase
      const { error } = await supabase.from('wishes').delete().eq('id', item.id);

      if (error) {
        alert('Hubo un error al eliminar el registro: ' + error.message);
      } else {
        // 3. Actualizar estado local al instante para feedback inmediato
        setWishes((prev) => prev.filter((w) => w.id !== item.id));
      }
    } catch (err) {
      console.error('Error en borrado:', err);
      alert('Ocurrió un error inesperado al eliminar.');
    } finally {
      setDeletingId(null);
    }
  };

  // ==========================================
  // VISTA DE LOGIN (ACCESO POR PIN)
  // ==========================================
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-black text-white tracking-wide mb-2">
            🛡️ Panel de Moderación
          </h1>
          <p className="text-slate-400 text-sm mb-6">
            Ingresa el PIN de seguridad para gestionar o eliminar saludos y fotos del muro.
          </p>

          <form onSubmit={handlePinSubmit} className="w-full flex flex-col gap-4">
            <div>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                placeholder="PIN de Acceso"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-center text-xl tracking-widest text-white placeholder:text-slate-600 placeholder:text-base placeholder:tracking-normal focus:outline-none focus:border-amber-400 transition-all shadow-inner"
                autoFocus
              />
              {pinError && (
                <p className="text-rose-400 text-xs mt-2.5 flex items-center justify-center gap-1.5 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>PIN incorrecto. Inténtalo nuevamente.</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-base rounded-2xl shadow-xl shadow-amber-500/20 transition-all active:scale-[0.98]"
            >
              Entrar al Panel 🚀
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ==========================================
  // VISTA DEL PANEL DE MODERACIÓN
  // ==========================================
  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* ENCABEZADO OPTIMIZADO PARA MÓVIL */}
        <header className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>🛡️ Moderación de Publicaciones</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {wishes.length} {wishes.length === 1 ? 'publicación guardada' : 'publicaciones guardadas'} en Supabase
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={fetchWishes}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              title="Refrescar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 text-rose-400 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </header>

        {/* CONTENIDO DE REJILLA/LISTA */}
        {isLoading && wishes.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
            <p className="text-sm font-medium">Cargando publicaciones desde Supabase...</p>
          </div>
        ) : wishes.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
            <p className="text-base">No hay ninguna publicación en el muro todavía.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {wishes.map((item) => {
              const isDeleting = deletingId === item.id;
              const formattedDate = item.created_at
                ? new Date(item.created_at).toLocaleString('es-ES', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  })
                : 'Reciente';

              return (
                <article
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between gap-4 transition-all hover:border-slate-700 group"
                >
                  {/* SECCIÓN SUPERIOR: FOTO Y FECHA */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400 border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                        <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate max-w-[150px]">{item.author_name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>

                    {item.image_url ? (
                      <div className="w-full h-48 sm:h-56 rounded-xl overflow-hidden bg-slate-950 border border-white/10 shadow-inner relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image_url}
                          alt={`Foto de ${item.author_name}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="w-full py-4 px-3 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-500 italic">
                        <ImageIcon className="w-4 h-4 opacity-50" />
                        <span>Sin foto adjunta</span>
                      </div>
                    )}

                    {/* SECCIÓN INTERMEDIA: SALUDO O MENSAJE */}
                    {item.message ? (
                      <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
                        <p className="text-sm text-slate-200 italic font-serif leading-relaxed line-clamp-4">
                          &ldquo;{item.message}&rdquo;
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic px-1">
                        Solo subió fotografía.
                      </p>
                    )}
                  </div>

                  {/* SECCIÓN INFERIOR: BOTÓN ELIMINAR */}
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={isDeleting}
                    className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Eliminando...</span>
                      </>
                    ) : (
                      <>
                        <span>Eliminar 🗑️</span>
                      </>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
