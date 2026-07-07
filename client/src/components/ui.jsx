import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { initials, hueOf } from '../lib/format.js';
import { api } from '../lib/api.js';

/* ---------------- Image upload ---------------- */
// Drop-in image picker that uploads to /uploads and reports back the URL.
export function ImageUpload({ value, onChange, label = 'Upload image', rounded = false }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr('');
    try {
      const { url } = await api.upload(file);
      onChange(url);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-3">
      <motion.div
        onClick={() => ref.current?.click()}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`${rounded ? 'rounded-full' : 'rounded-xl'} w-16 h-16 shrink-0 border-2 border-dashed border-neutral-300 dark:border-neutral-600
          grid place-items-center overflow-hidden cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 hover:bg-primary-500/5 transition-all duration-300 bg-neutral-100 dark:bg-neutral-800`}
      >
        {busy ? <Spinner className="w-5 h-5" /> : value
          ? <img src={value} alt="" className="w-full h-full object-cover" />
          : <span className="text-2xl opacity-40">＋</span>}
      </motion.div>
      <div className="min-w-0">
        <button type="button" className="btn-ghost !py-1.5 text-xs" onClick={() => ref.current?.click()} disabled={busy}>
          {value ? 'Replace' : label}
        </button>
        {value && <button type="button" className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-accent-red ml-2" onClick={() => onChange('')}>Remove</button>}
        {err && <div className="text-xs text-accent-red mt-1">{err}</div>}
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
      </div>
    </div>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({ name, url, size = 36, className = '' }) {
  const h = hueOf(name || '');
  if (url) return <img src={url} alt={name} style={{ width: size, height: size }} className={`rounded-full object-cover ${className}`} />;
  return (
    <div
      style={{ width: size, height: size, background: `hsl(${h} 38% 88%)`, color: `hsl(${h} 45% 32%)`, fontSize: size * 0.38 }}
      className={`rounded-full grid place-items-center font-bold shrink-0 ${className}`}
    >
      {initials(name) || '?'}
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-8" onMouseDown={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-neutral-900/50 dark:bg-neutral-900/70 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`relative card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} my-auto border-neutral-200 dark:border-neutral-700`}
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700">
                <h3 className="font-heading text-2xl font-bold text-neutral-900 dark:text-white">{title}</h3>
                <motion.button
                  onClick={onClose}
                  className="text-neutral-400 dark:text-neutral-600 hover:text-neutral-900 dark:hover:text-white text-xl leading-none w-8 h-8 grid place-items-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  ×
                </motion.button>
              </div>
            )}
            <div className="px-6 py-5">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Toast ---------------- */
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, message, type }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3200);
  }, []);
  const toast = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  };
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 w-80 max-w-[90vw] pointer-events-none">
        <AnimatePresence mode="popLayout">
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, x: 100 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, y: -20, x: 100 }}
              transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
              className={`pointer-events-auto rounded-xl px-5 py-4 text-sm font-semibold shadow-lg border backdrop-blur-sm
                ${t.type === 'error'
                  ? 'bg-accent-red/90 dark:bg-accent-red/80 text-white border-accent-red'
                  : t.type === 'info'
                    ? 'bg-accent-blue/90 dark:bg-accent-blue/80 text-white border-accent-blue'
                    : 'bg-gradient-primary text-white border-primary-500'}`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Spinner ---------------- */
export function Spinner({ className = '' }) {
  return (
    <motion.div
      className={`rounded-full border-3 border-neutral-300 dark:border-neutral-700 border-t-transparent ${className || 'w-5 h-5'}`}
      style={{
        borderTopColor: 'var(--color-primary)',
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, easing: 'linear' }}
    />
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <Spinner className="w-10 h-10" />
      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{label}</span>
    </div>
  );
}

/* ---------------- Empty state ---------------- */
export function Empty({ icon = '∅', title, hint }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center gap-3 py-20 text-center"
    >
      <motion.div
        className="text-5xl opacity-30"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        {icon}
      </motion.div>
      <p className="font-heading text-xl font-semibold text-neutral-800 dark:text-neutral-200">{title}</p>
      {hint && <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-sm">{hint}</p>}
    </motion.div>
  );
}

/* ---------------- Confirm dialog ---------------- */
export function Confirm({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
      </>}>
      <p className="text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed">{message}</p>
    </Modal>
  );
}
