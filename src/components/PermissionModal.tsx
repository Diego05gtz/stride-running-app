import React from 'react';
import { Navigation, X } from 'lucide-react';
import { AccentTheme } from '../types/run';
import { ACCENT_PALETTES } from '../utils/theme';

interface PermissionModalProps {
  isOpen: boolean;
  message: string | null;
  accent: AccentTheme;
  onClose: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({
  isOpen,
  message,
  accent,
  onClose,
}) => {
  if (!isOpen) return null;
  const palette = ACCENT_PALETTES[accent];

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] min-h-[100dvh] flex items-center justify-center p-5 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#10121A] border border-white/10 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mb-4">
          <Navigation className={`w-6 h-6 ${palette.textClass}`} />
        </div>

        <h3 className="font-display text-xl font-bold text-white tracking-tight">
          Permiso de Ubicación GPS
        </h3>

        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          {message ||
            'STRIDE utiliza el GPS de alta precisión de tu dispositivo únicamente mientras corres para trazar tu ruta en vivo y calcular tu ritmo real.'}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={onClose}
            className={`w-full rounded-2xl py-3.5 px-4 font-semibold text-sm text-[#090A0F] ${palette.bgClass} active:scale-[0.98] transition`}
          >
            Entendido, revisaré mis permisos
          </button>
        </div>
      </div>
    </div>
  );
};
