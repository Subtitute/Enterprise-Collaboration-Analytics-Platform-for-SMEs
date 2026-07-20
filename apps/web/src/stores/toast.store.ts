import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }],
    })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) => useToastStore.getState().push({ title, description, variant: 'success' }),
  error: (title: string, description?: string) => useToastStore.getState().push({ title, description, variant: 'error' }),
  info: (title: string, description?: string) => useToastStore.getState().push({ title, description, variant: 'info' }),
};
