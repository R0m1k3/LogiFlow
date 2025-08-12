import { useState, useCallback, useEffect } from "react";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
}

let listeners: Array<(state: ToastState) => void> = [];
let state: ToastState = { toasts: [] };
let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

function dispatch(action: { type: string; toast?: any; toastId?: string }) {
  switch (action.type) {
    case "ADD_TOAST":
      state.toasts = [action.toast, ...state.toasts].slice(0, 3); // Max 3 toasts
      break;
    case "DISMISS_TOAST":
      if (action.toastId) {
        state.toasts = state.toasts.filter(t => t.id !== action.toastId);
      } else {
        state.toasts = [];
      }
      break;
    case "REMOVE_TOAST":
      state.toasts = state.toasts.filter(t => t.id !== action.toastId);
      break;
  }
  
  listeners.forEach(listener => listener(state));
}

function toast({
  title,
  description,
  variant = "default",
  duration = 5000,
  ...props
}: Omit<Toast, "id"> & { duration?: number }) {
  const id = genId();
  
  const newToast: Toast = {
    id,
    title,
    description,
    variant,
    duration,
    ...props,
  };

  dispatch({
    type: "ADD_TOAST",
    toast: newToast,
  });

  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => {
      dispatch({
        type: "REMOVE_TOAST",
        toastId: id,
      });
    }, duration);
  }

  return {
    id,
    dismiss: () => dispatch({ type: "DISMISS_TOAST", toastId: id }),
    update: (updates: Partial<Toast>) => 
      dispatch({ type: "ADD_TOAST", toast: { ...newToast, ...updates } }),
  };
}

function dismiss(toastId?: string) {
  dispatch({
    type: "DISMISS_TOAST",
    toastId,
  });
}

export function useToast() {
  const [toastState, setToastState] = useState<ToastState>(state);

  useEffect(() => {
    listeners.push(setToastState);
    return () => {
      const index = listeners.indexOf(setToastState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    toast,
    dismiss,
    toasts: toastState.toasts,
  };
}