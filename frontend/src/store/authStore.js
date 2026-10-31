import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Estado global de la sesión. Se persiste en localStorage para sobrevivir a recargas.
export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      expiraEn: null,
      usuario: null,

      login: ({ token, expiraEn, usuario }) => set({ token, expiraEn, usuario }),
      logout: () => set({ token: null, expiraEn: null, usuario: null }),
      setUsuario: (usuario) => set({ usuario }),

      // La sesión es válida si hay token y aún no expiró.
      isAuthenticated: () => {
        const { token, expiraEn } = get()
        return Boolean(token) && (!expiraEn || new Date(expiraEn) > new Date())
      },
    }),
    { name: 'biess-auth' },
  ),
)
