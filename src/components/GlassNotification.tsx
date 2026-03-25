"use client";

import { useEffect, useState } from "react";

type NotificationType = "success" | "error" | "info";

interface GlassNotificationProps {
  message: string;
  type?: NotificationType;
  isVisible: boolean;
  onClose: () => void;
}

export default function GlassNotification({ message, type = "info", isVisible, onClose }: GlassNotificationProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 300); // Allow animation to finish
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible && !show) return null;

  const bgColors = {
    success: "bg-green-500/10 border-green-500/20 text-green-200",
    error: "bg-red-500/10 border-red-500/20 text-red-200",
    info: "bg-blue-500/10 border-blue-500/20 text-blue-200",
  };

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className={`fixed top-6 right-6 z-50 transition-all duration-300 transform ${show ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"}`}>
      <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${bgColors[type]}`}>
        <div className={`p-2 rounded-full ${type === 'success' ? 'bg-green-500/20' : type === 'error' ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
          {icons[type]}
        </div>
        <div>
          <h4 className="font-bold text-sm uppercase tracking-wider">{type}</h4>
          <p className="text-sm font-medium opacity-90">{message}</p>
        </div>
        <button onClick={() => setShow(false)} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}