'use client';

import { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import {
  Sparkles,
  User,
  MessageSquare,
  Gift,
  Loader2,
  Tv
} from 'lucide-react';

interface Wish {
  id?: string | number;
  author_name: string;
  message?: string | null;
  image_url?: string | null;
  created_at?: string;
}

const BANNER_VIDEO_URL =
  process.env.NEXT_PUBLIC_BANNER_VIDEO_URL ||
  'https://res.cloudinary.com/demo/video/upload/v1689000000/party_loop.mp4';

const CAROUSEL_SLIDE_DURATION_MS = 14000; // 14 segundos por diapositiva en carrusel
const LIVE_HIGHLIGHT_DURATION_MS = 18000; // 18 segundos de destaque para nuevas fotos en vivo
const VIDEO_MODE_DURATION_MS = 4 * 60 * 1000; // 4 minutos en modo video de presentación

export default function TVPage() {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'CAROUSEL' | 'VIDEO'>('CAROUSEL');
  const [carouselSlideCount, setCarouselSlideCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveNew, setIsLiveNew] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

  // 1. Configurar URL del QR apuntando al dominio actual
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setQrUrl(window.location.origin);
    }
  }, []);

  // 2. Carga inicial desde Supabase
  useEffect(() => {
    const fetchWishes = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('wishes')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error al cargar saludos:', error);
        } else if (data && data.length > 0) {
          setWishes(data);
          setViewMode('CAROUSEL');
        } else {
          // Si no hay fotos aún, iniciamos en modo video de presentación
          setViewMode('VIDEO');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWishes();
  }, []);

  // 3. Suscripción a Supabase Realtime (INSERT y DELETE en 'wishes')
  useEffect(() => {
    const channel = supabase
      .channel('tv-floating-wall-video-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wishes' },
        (payload) => {
          const newWish = payload.new as Wish;

          setWishes((prev) => [newWish, ...prev]);
          // INTERRUPCIÓN EN TIEMPO REAL: Cambiar inmediatamente a carrusel y mostrar la nueva foto
          setViewMode('CAROUSEL');
          setCurrentIndex(0);
          setCarouselSlideCount(0);
          setIsLiveNew(true);

          // Mantener destacado durante 10 segundos antes de reanudar el ciclo normal
          setTimeout(() => {
            setIsLiveNew(false);
          }, LIVE_HIGHLIGHT_DURATION_MS);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'wishes' },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setWishes((prev) => {
              const filtered = prev.filter((item) => item.id !== deletedId && item.id !== Number(deletedId));
              return filtered;
            });
            setCurrentIndex((prevIdx) => (prevIdx > 0 ? prevIdx - 1 : 0));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 4. Lógica de Rotación y Alternancia entre [MODO_CARRUSEL] y [MODO_BANNER_VIDEO]
  useEffect(() => {
    // Si estamos en modo VIDEO, programamos el regreso a CARRUSEL tras 4 minutos (si hay publicaciones)
    if (viewMode === 'VIDEO') {
      if (wishes.length === 0) return;

      const videoTimer = setTimeout(() => {
        setViewMode('CAROUSEL');
        setCurrentIndex(0);
        setCarouselSlideCount(0);
      }, VIDEO_MODE_DURATION_MS);

      return () => clearTimeout(videoTimer);
    }

    // Si estamos en modo CARRUSEL, rotamos cada 6 segundos (o 10 segundos si es nuevo destaque en vivo)
    if (viewMode === 'CAROUSEL' && wishes.length > 0) {
      const currentDelay = isLiveNew
        ? LIVE_HIGHLIGHT_DURATION_MS
        : CAROUSEL_SLIDE_DURATION_MS;

      const carouselTimer = setTimeout(() => {
        const nextSlideCount = carouselSlideCount + 1;

        // Si ya completamos un ciclo completo por todas las fotos O llegamos a 10 fotos:
        if (nextSlideCount >= wishes.length || nextSlideCount >= 10) {
          setViewMode('VIDEO');
          setCarouselSlideCount(0);
        } else {
          setCurrentIndex((prev) => (prev + 1) % wishes.length);
          setCarouselSlideCount(nextSlideCount);
        }
      }, currentDelay);

      return () => clearTimeout(carouselTimer);
    }
  }, [viewMode, wishes.length, currentIndex, carouselSlideCount, isLiveNew]);

  const currentWish = wishes[currentIndex];

  // Miniaturas laterales para segundo plano
  const leftQueue = wishes
    .filter((_, idx) => idx !== currentIndex && idx % 2 === 0)
    .slice(0, 4);
  const rightQueue = wishes
    .filter((_, idx) => idx !== currentIndex && idx % 2 === 1)
    .slice(0, 4);

  return (
    <main className="h-screen w-screen max-h-screen max-w-full overflow-hidden bg-slate-950 text-white relative select-none font-sans flex items-center justify-center">
      {/* ==================== MODO BANNER VIDEO ==================== */}
      <AnimatePresence mode="wait">
        {viewMode === 'VIDEO' && (
          <motion.div
            key="video-mode"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 z-10 w-full h-full bg-black flex items-center justify-center"
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
              src={BANNER_VIDEO_URL}
            />

            {/* Capa sutil de gradiente e indicador discreto */}
            <div className="absolute top-6 left-6 z-20 px-4 py-2 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/10 text-xs font-semibold text-slate-300 flex items-center gap-2 shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Fiesta en Vivo</span>
            </div>
          </motion.div>
        )}

        {/* ==================== MODO CARRUSEL FLOTANTE ==================== */}
        {viewMode === 'CAROUSEL' && (
          <motion.div
            key="carousel-mode"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 z-10 w-full h-full flex items-center justify-center overflow-hidden"
          >
            {/* Fondo oscuro con desenfoque dinámico */}
            <div className="absolute inset-0 bg-slate-950 -z-20" />
            {currentWish?.image_url && (
              <div
                key={`bg-${currentWish.image_url}`}
                className="absolute inset-0 bg-cover bg-center blur-3xl opacity-25 scale-110 transition-all duration-1000 -z-10 pointer-events-none"
                style={{ backgroundImage: `url(${currentWish.image_url})` }}
              />
            )}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/15 rounded-full blur-[140px] pointer-events-none -z-10" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-[150px] pointer-events-none -z-10" />

            {/* MINIATURAS FLOTANTES EN SEGUNDO PLANO (Con Framer Motion) */}
            {wishes.length > 1 && (
              <>
                {/* Columna Izquierda */}
                <div className="absolute left-6 top-16 bottom-16 w-28 hidden xl:flex flex-col justify-around items-center pointer-events-none z-10">
                  {leftQueue.map((item, idx) => (
                    <motion.div
                      key={`left-${item.id || idx}`}
                      animate={{
                        y: [-12, 12, -12],
                        rotate: [-2, 2, -2]
                      }}
                      transition={{
                        duration: 6 + idx * 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                      className="w-24 h-24 rounded-2xl bg-slate-900/80 border border-white/20 shadow-2xl overflow-hidden backdrop-blur-md flex items-center justify-center"
                    >
                      {item.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.image_url}
                          alt="Miniatura flotante"
                          className="w-full h-full object-cover opacity-75"
                        />
                      ) : (
                        <div className="p-2 text-center flex flex-col items-center justify-center gap-1">
                          <MessageSquare className="w-5 h-5 text-amber-400" />
                          <span className="text-[10px] font-bold text-slate-300 truncate w-20">
                            {item.author_name}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Columna Derecha */}
                <div className="absolute right-6 top-16 bottom-16 w-28 hidden xl:flex flex-col justify-around items-center pointer-events-none z-10">
                  {rightQueue.map((item, idx) => (
                    <motion.div
                      key={`right-${item.id || idx}`}
                      animate={{
                        y: [12, -12, 12],
                        rotate: [2, -2, 2]
                      }}
                      transition={{
                        duration: 7 + idx * 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                      className="w-24 h-24 rounded-2xl bg-slate-900/80 border border-white/20 shadow-2xl overflow-hidden backdrop-blur-md flex items-center justify-center"
                    >
                      {item.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.image_url}
                          alt="Miniatura flotante"
                          className="w-full h-full object-cover opacity-75"
                        />
                      ) : (
                        <div className="p-2 text-center flex flex-col items-center justify-center gap-1">
                          <Sparkles className="w-5 h-5 text-amber-400" />
                          <span className="text-[10px] font-bold text-slate-300 truncate w-20">
                            {item.author_name}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {/* BANNER DE DESTAQUE INSTANTÁNEO EN VIVO */}
            {isLiveNew && currentWish && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: -40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="absolute top-8 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 text-slate-950 font-black text-sm sm:text-xl px-8 py-3 rounded-full shadow-2xl flex items-center gap-3 ring-4 ring-amber-400/40 animate-bounce"
              >
                <Sparkles className="w-6 h-6 fill-slate-950 shrink-0" />
                <span>
                  ✨ ¡NUEVA PUBLICACIÓN EN VIVO DE {currentWish.author_name.toUpperCase()}! ✨
                </span>
              </motion.div>
            )}

            {/* TARJETA CENTRAL MAXIMIZADA (100% Pantalla) */}
            <div className="w-full h-full p-4 sm:p-8 flex items-center justify-center relative z-20">
              {isLoading ? (
                <div className="flex flex-col items-center gap-4 text-slate-400">
                  <Loader2 className="w-14 h-14 animate-spin text-amber-400" />
                  <p className="text-base font-medium">Conectando con la pantalla en vivo...</p>
                </div>
              ) : !currentWish ? (
                <div className="text-center text-slate-400">
                  <p>Sin publicaciones aún en el carrusel.</p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentWish.id || currentIndex}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="w-full h-full flex items-center justify-center"
                  >
                    {/* A) SOLO FOTO */}
                    {currentWish.image_url && !currentWish.message && (
                      <div className="relative max-h-[92vh] max-w-[88vw] rounded-3xl overflow-hidden bg-slate-900/90 border-2 border-white/20 shadow-2xl flex items-center justify-center group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentWish.image_url}
                          alt={`Foto de ${currentWish.author_name}`}
                          className="max-h-[90vh] max-w-[86vw] object-contain rounded-2xl p-2"
                        />
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-950/90 backdrop-blur-xl px-8 py-3 rounded-full border border-amber-400/50 text-base sm:text-xl font-bold text-amber-300 shadow-2xl flex items-center gap-3 whitespace-nowrap">
                          <User className="w-5 h-5 text-amber-400 shrink-0" />
                          <span>Compartido por: {currentWish.author_name}</span>
                        </div>
                      </div>
                    )}

                    {/* B) SOLO MENSAJE */}
                    {!currentWish.image_url && currentWish.message && (
                      <div className="w-full max-w-5xl bg-gradient-to-br from-slate-900/95 via-indigo-950/90 to-slate-900/95 backdrop-blur-3xl border-2 border-amber-500/50 rounded-3xl p-12 sm:p-20 text-center shadow-2xl flex flex-col items-center justify-center gap-8 relative overflow-hidden">
                        <div className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
                          <Gift className="w-10 h-10" />
                        </div>

                        <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-10 sm:p-14 w-full relative shadow-inner">
                          <MessageSquare className="w-8 h-8 text-amber-400/30 absolute top-6 right-6" />
                          <p className="text-3xl sm:text-5xl text-amber-100 font-serif italic leading-relaxed">
                            &ldquo;{currentWish.message}&rdquo;
                          </p>
                        </div>

                        <div className="px-8 py-3.5 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center gap-3">
                          <span className="text-sm uppercase font-bold text-slate-300 tracking-widest">
                            SALUDO DE:
                          </span>
                          <span className="text-xl sm:text-2xl font-black text-amber-400 uppercase">
                            {currentWish.author_name}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* C) FOTO Y MENSAJE */}
                    {currentWish.image_url && currentWish.message && (
                      <div className="relative max-h-[92vh] max-w-[88vw] rounded-3xl overflow-hidden bg-slate-900/90 border-2 border-white/20 shadow-2xl flex items-center justify-center group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentWish.image_url}
                          alt={`Foto de ${currentWish.author_name}`}
                          className="max-h-[90vh] max-w-[86vw] object-contain rounded-2xl p-2"
                        />

                        {/* Tarjeta elegante superpuesta en la parte inferior */}
                        <div className="absolute bottom-6 left-6 right-6 sm:left-12 sm:right-12 bg-slate-950/90 backdrop-blur-2xl border border-amber-400/50 rounded-2xl p-5 sm:p-7 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                          <div className="flex-1 text-left pr-2">
                            <p className="text-lg sm:text-2xl text-white italic font-serif leading-snug">
                              &ldquo;{currentWish.message}&rdquo;
                            </p>
                          </div>
                          <div className="px-6 py-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 font-black text-base shrink-0 flex items-center gap-2.5 shadow-inner">
                            <User className="w-5 h-5 text-amber-400" />
                            <span>{currentWish.author_name}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            {/* Indicador discreto de modo/diapositiva */}
            <div className="absolute top-6 right-6 z-30 px-4 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/10 text-xs font-semibold text-amber-300">
              {currentIndex + 1} / {wishes.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== CÓDIGO QR COMPACTO Y CUADRADO FIJO EN LA ESQUINA ==================== */}
      <div className="qrecito fixed bottom-6 left-6 sm:bottom-8 sm:left-8 z-50 w-52 h-60 sm:w-56 sm:h-68 md:w-60 md:h-72 bg-white rounded-3xl shadow-2xl border-4 border-amber-400 p-3 sm:p-4 flex flex-col items-center justify-between text-center transition-transform hover:scale-105">
        <div className="flex-1 flex items-center justify-center w-full p-1">
          {qrUrl ? (
            <QRCode
              value={qrUrl}
              size={160}
              style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
            />
          ) : (
            <div className="w-36 h-36 bg-slate-200 animate-pulse rounded-2xl" />
          )}
        </div>
        <div className="w-full pt-1.5 sm:pt-2 border-t border-slate-100 mt-1">
          <span className="text-[11px] sm:text-xs md:text-sm font-black text-slate-900 block leading-tight tracking-tight">
            ¡Escanea para subir tu saludo!
          </span>
        </div>
      </div>
    </main>
  );
}
