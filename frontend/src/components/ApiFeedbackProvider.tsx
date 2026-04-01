"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { registerLoadingStateCallback, registerServerErrorCallback } from "@/lib/api";

interface ApiFeedbackContextValue {
  showToast: (message: string) => void;
}

const ApiFeedbackContext = createContext<ApiFeedbackContextValue | undefined>(undefined);

export function useApiFeedback() {
  const ctx = useContext(ApiFeedbackContext);
  if (!ctx) {
    throw new Error("useApiFeedback must be used within ApiFeedbackProvider");
  }
  return ctx;
}

export default function ApiFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  const dismissToast = () => {
    setToastMessage(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 6000);
  };

  useEffect(() => {
    registerServerErrorCallback(showToast);
    registerLoadingStateCallback((loading) => {
      if (loading) {
        setIsCompleting(false);
        setIsLoading(true);
      } else {
        setIsCompleting(true);
        window.setTimeout(() => {
          setIsLoading(false);
          setIsCompleting(false);
        }, 250);
      }
    });
    return () => {
      registerServerErrorCallback(() => undefined);
      registerLoadingStateCallback(() => undefined);
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const value = useMemo(() => ({ showToast }), []);

  return (
    <ApiFeedbackContext.Provider value={value}>
      {(isLoading || isCompleting) && (
        <div className={`api-loading-bar ${isCompleting ? "api-loading-bar--complete" : ""}`} />
      )}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-md bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg">
          <div className="mb-2">{toastMessage}</div>
          <button
            type="button"
            onClick={dismissToast}
            className="rounded border border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-800"
          >
            Dismiss
          </button>
        </div>
      )}
      {children}
    </ApiFeedbackContext.Provider>
  );
}
