import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar } from './ui.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◧', end: true },
  { to: '/leads', label: 'Leads', icon: '☰' },
  { to: '/events', label: 'Events', icon: '◈' },
  { to: '/expenses', label: 'Expenses', icon: '◇', perm: 'canManageExpenses' },
  { to: '/analytics', label: 'Analytics', icon: '◔', perm: 'canViewAnalytics' },
  { to: '/accounts', label: 'Accounts', icon: '⚙', perm: 'canManageAccounts' },
];

export default function Layout({ children }) {
  const { user, logout, can } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => !n.perm || can(n.perm));

  return (
    <div className="min-h-screen flex bg-neutral-50 dark:bg-neutral-900">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -256 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 flex flex-col
          lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-5 py-6 flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-700">
          <motion.div
            className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center text-white font-heading text-xl font-bold shadow-glow"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            S
          </motion.div>
          <div className="leading-tight">
            <div className="font-heading text-lg font-bold text-neutral-900 dark:text-white">Sky Root</div>
            <div className="text-[11px] uppercase tracking-wider text-neutral-600 dark:text-neutral-400 font-semibold">Properties CRM</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((n, idx) => (
            <motion.div
              key={n.to}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <NavLink to={n.to} end={n.end} onClick={() => setOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300
                  ${isActive
                    ? 'bg-gradient-primary text-white shadow-glow'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
              >
                <span className="text-base w-5 text-center">{n.icon}</span>{n.label}
              </NavLink>
            </motion.div>
          ))}
        </nav>

        <div className="p-3 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={user?.name} url={user?.avatar_url} size={38} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-neutral-900 dark:text-white truncate">{user?.name}</div>
              <div className="text-[11px] text-neutral-600 dark:text-neutral-400 truncate">{user?.role_name || user?.account_type}</div>
            </div>
          </div>
          <button onClick={() => { logout(); nav('/login'); }}
            className="w-full mt-2 text-left px-3 py-2 rounded-lg text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-accent-red transition-all duration-300">
            Sign out
          </button>
        </div>
      </motion.aside>

      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 bg-neutral-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <motion.header
          initial={{ y: -80 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.3 }}
          className="sticky top-0 z-20 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-6 py-4 flex items-center gap-4"
        >
          <button className="lg:hidden btn-ghost !px-2.5 !py-1.5" onClick={() => setOpen(true)}>☰</button>
          <div className="flex-1" />
          <div className="text-xs text-neutral-600 dark:text-neutral-400 font-semibold hidden sm:flex items-center gap-2">
            <motion.span
              className="w-2 h-2 rounded-full bg-accent-green"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            Viewing as {user?.company || 'Sky Root'}
          </div>
          <ThemeToggle />
          <Avatar name={user?.name} url={user?.avatar_url} size={34} />
        </motion.header>
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
