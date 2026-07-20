'use client';

import { useState, useRef, ChangeEvent, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Camera,
  Image as ImageIcon,
  Send,
  Loader2,
  Sparkles,
  User,
  MessageSquare,
  PartyPopper,
  Trash2,
  AlertCircle,
  Heart,
  Tv,
  PlusCircle
} from 'lucide-react';

export default function MobileWishPage() {
  const [authorName, setAuthorName] = useState('');
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [lastSubmitted, setLastSubmitted] = useState<{
    name: string;
    message: string;
    preview: string | null;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, selecciona un archivo de imagen válido.');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!authorName.trim()) {
      setErrorMessage('Por favor ingresa tu nombre.');
      return;
    }

    if (!message.trim() && !selectedFile) {
      setErrorMessage('Por favor escribe un mensaje o selecciona una foto para enviar.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      let publicUrl: string | null = null;

      // 1. If photo attached, upload to Supabase Storage bucket 'photos'
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop() || 'jpg';
        const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${cleanName}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(
            `Error al subir la imagen: ${uploadError.message}. Verifica que el bucket 'photos' exista.`
          );
        }

        const { data: publicUrlData } = supabase.storage
          .from('photos')
          .getPublicUrl(filePath);

        publicUrl = publicUrlData.publicUrl;
      }

      // 2. Insert record into 'wishes' table (author_name, message, image_url)
      const { error: dbError } = await supabase.from('wishes').insert([
        {
          author_name: authorName.trim(),
          message: message.trim() || null,
          image_url: publicUrl,
        },
      ]);

      if (dbError) {
        throw new Error(`Error al guardar tu publicación: ${dbError.message}`);
      }

      // Record last submitted data for success view
      setLastSubmitted({
        name: authorName.trim(),
        message: message.trim(),
        preview: previewUrl,
      });

      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Ocurrió un error inesperado al enviar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setAuthorName('');
    setMessage('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsSuccess(false);
    setErrorMessage(null);
    setLastSubmitted(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canSubmit = authorName.trim() !== '' && (message.trim() !== '' || selectedFile !== null);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Background glow FX */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header Container */}
      <div className="w-full max-w-md mx-auto pt-6 px-4 text-center z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-3 backdrop-blur-md shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>Cumpleaños Especial</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-snug">
          🎉 ¡Envía tu saludo o foto para el Cumpleañero!
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-2">
          Escribe un mensaje, sube una foto o ambos. ¡Aparecerá en vivo en la pantalla de la fiesta!
        </p>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-md mx-auto px-4 py-6 z-10 flex-1 flex flex-col justify-center">
        {isSuccess ? (
          /* SUCCESS FESTIVE VIEW */
          <div className="bg-slate-900/90 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-amber-500/10 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30 ring-4 ring-amber-500/20">
              <PartyPopper className="w-8 h-8 text-slate-950 animate-bounce" />
            </div>

            <h2 className="text-2xl font-black text-white mb-2">
              ¡Tu mensaje ya está apareciendo en la TV! 🥳
            </h2>

            <p className="text-sm text-slate-300 mb-6">
              ¡Gracias por compartir tu cariño y acompañar a mi papá en su día!
            </p>

            {/* Preview Card of Submitted Wish */}
            {lastSubmitted && (
              <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800 text-left mb-6 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-3 text-amber-400 text-xs font-semibold">
                  <Tv className="w-4 h-4" />
                  <span>Proyectado en pantalla</span>
                </div>

                {lastSubmitted.preview && (
                  <div className="relative w-full h-48 rounded-xl overflow-hidden mb-3 bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lastSubmitted.preview}
                      alt="Foto subida"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <User className="w-4 h-4 text-amber-400" />
                  <span>{lastSubmitted.name}</span>
                </div>

                {lastSubmitted.message && (
                  <p className="text-xs text-slate-300 mt-1 italic pl-6 border-l-2 border-amber-500/40">
                    &ldquo;{lastSubmitted.message}&rdquo;
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handleReset}
              className="w-full py-3.5 px-6 rounded-2xl font-bold bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Enviar otra publicación</span>
            </button>
          </div>
        ) : (
          /* FORM VIEW */
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col gap-5"
          >
            {/* Error Banner */}
            {errorMessage && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 flex items-start gap-3 text-rose-300 text-xs sm:text-sm animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            {/* Input 1: Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  Tu Nombre
                </span>
                <span className="text-amber-400 text-[11px] lowercase font-normal">* obligatorio</span>
              </label>
              <input
                type="text"
                required
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all text-sm"
              />
            </div>

            {/* Hint Notice */}
            <div className="text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-center">
              💡 Puedes enviar un <strong>mensaje</strong>, una <strong>foto</strong> o <strong>ambos</strong>.
            </div>

            {/* Input 2: Message */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  Tu Mensaje o Deseo
                </span>
                <span className="text-slate-500 text-[11px] lowercase font-normal">opcional</span>
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="¡Feliz cumpleaños papá! Que pases un día extraordinario..."
                className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all text-sm resize-none"
              />
            </div>

            {/* Input 3: Photo picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                  Añadir Foto
                </span>
                <span className="text-slate-500 text-[11px] lowercase font-normal">opcional</span>
              </label>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="photo-upload"
              />

              {previewUrl ? (
                /* Selected Photo Preview */
                <div className="relative w-full rounded-2xl overflow-hidden border border-amber-500/40 bg-slate-950 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Vista previa"
                    className="w-full h-52 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent flex items-end justify-between p-3">
                    <div className="flex items-center gap-2 text-xs text-slate-200 truncate max-w-[65%]">
                      <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="truncate">{selectedFile?.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold rounded-lg backdrop-blur-md flex items-center gap-1 transition-all shadow-md active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar Foto</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Optional Photo Dropzone */
                <label
                  htmlFor="photo-upload"
                  className="cursor-pointer border-2 border-dashed border-slate-700 hover:border-amber-400/60 bg-slate-950/50 hover:bg-slate-950/90 rounded-2xl p-5 flex items-center justify-center gap-3 transition-all group active:scale-[0.99]"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold text-white block">
                      Tomar Foto / Abrir Galería
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Toca aquí para seleccionar una imagen
                    </span>
                  </div>
                </label>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !canSubmit}
              className="mt-2 w-full py-4 px-6 rounded-2xl font-bold bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 shadow-xl shadow-amber-500/20 disabled:shadow-none transition-all transform active:scale-95 flex items-center justify-center gap-2 text-base"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Enviando a la TV...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Enviar a la Pantalla 🚀</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="w-full max-w-md mx-auto pb-4 px-4 text-center text-xs text-slate-500 z-10 flex items-center justify-center gap-1">
        <span>Hecho con</span>
        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
        <span>para la celebración</span>
      </div>
    </main>
  );
}
