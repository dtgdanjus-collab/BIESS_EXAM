import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Sesión del módulo de administración, separada de la del postulante.
export const useAdminStore = create(
  persist(
    (set, get) => ({
      token: null,
      expiraEn: null,
      admin: null,

      login: ({ token, expiraEn, admin }) => set({ token, expiraEn, admin }),
      logout: () => set({ token: null, expiraEn: null, admin: null }),

      isAuthenticated: () => {
        const { token, expiraEn } = get()
        return Boolean(token) && (!expiraEn || new Date(expiraEn) > new Date())
      },
    }),
    { name: 'biess-admin' },
  ),
)
