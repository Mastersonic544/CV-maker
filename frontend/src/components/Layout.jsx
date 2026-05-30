import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  CheckSquare,
  Send,
  MessageSquare,
  AlertTriangle,
  Sun,
  Moon,
  Coffee,
} from 'lucide-react';
import { useProfile } from '../hooks/useProfile';
import { useUser } from '../hooks/useUser';
import { usersClient } from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const SidebarItem = ({ to, icon: Icon, label, active }) => (
  <Link
    to={to}
    className={cn(
      "group relative flex items-center gap-3 pl-5 pr-3 py-3 transition-colors duration-200",
      active ? "text-cv-cyan" : "hover:text-cv-text"
    )}
    style={{
      color: active ? 'var(--cv-cyan)' : 'rgba(var(--cv-text-rgb), 0.55)',
      borderLeft: active ? '2px solid var(--cv-cyan)' : '2px solid transparent',
      background: active ? 'rgba(var(--cv-cyan-rgb), 0.04)' : 'transparent',
    }}
  >
    <Icon
      className={cn("w-4 h-4 shrink-0")}
      style={{ color: active ? 'var(--cv-cyan)' : 'rgba(var(--cv-text-rgb), 0.4)' }}
    />
    <span
      className="font-dm uppercase"
      style={{ fontSize: '0.68rem', letterSpacing: '0.16em' }}
    >
      {label}
    </span>
  </Link>
);

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

const LANGS = ['en', 'fr', 'ar'];

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, completenessScore, missingFields, loading } = useProfile();
  const { user } = useUser();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useI18n();

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, labelKey: "nav_dashboard" },
    { to: "/discover",  icon: Search,          labelKey: "nav_discovery" },
    { to: "/review",    icon: CheckSquare,     labelKey: "nav_review"    },
    { to: "/apply",     icon: Send,            labelKey: "nav_apply"     },
    { to: "/interview", icon: MessageSquare,   labelKey: "nav_interview" },
  ];

  return (
    <div
      className="flex h-screen"
      style={{
        background: 'var(--cv-bg)',
        color: 'var(--cv-text)',
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {/* Sidebar — terminal panel */}
      <aside
        className="w-60 flex flex-col shrink-0"
        style={{
          background: 'var(--cv-bg)',
          borderRight: '1px solid var(--cv-border)',
        }}
      >
        {/* Brand */}
        <div
          className="px-5 py-6 flex items-center"
          style={{ borderBottom: '1px solid var(--cv-border)' }}
        >
          <span
            className="font-syne"
            style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em' }}
          >
            CV<span style={{ color: 'var(--cv-cyan)' }}>.</span>MAKER
          </span>
        </div>

        {/* Section label */}
        <div className="px-5 pt-6 pb-3">
          <span
            className="font-dm"
            style={{
              fontSize: '0.55rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'rgba(var(--cv-text-rgb), 0.32)',
            }}
          >
            {t('nav_pipeline')}
          </span>
        </div>

        <nav className="flex-1 flex flex-col">
          {navItems.map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={t(item.labelKey)}
              active={location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to))}
            />
          ))}
        </nav>

        {/* Coffee button */}
        <div className="px-3 pb-1">
          <button
            className="w-full flex flex-col items-center gap-0.5 py-2.5 px-3 transition-all duration-200"
            style={{
              background: 'rgba(255, 92, 53, 0.05)',
              border: '1px solid rgba(255, 92, 53, 0.18)',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 92, 53, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 92, 53, 0.35)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 92, 53, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 92, 53, 0.18)';
            }}
          >
            <span
              className="font-dm"
              style={{ fontSize: '0.48rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,92,53,0.55)' }}
            >
              like what you see?
            </span>
            <span className="flex items-center gap-1.5" style={{ color: 'var(--cv-orange)' }}>
              <Coffee className="w-3 h-3" />
              <span className="font-dm" style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                Buy us a coffee
              </span>
            </span>
          </button>
        </div>

        {/* User card */}
        <div
          onClick={() => navigate('/profile-management')}
          className="cursor-pointer group"
          style={{ borderTop: '1px solid var(--cv-border)' }}
          title="Manage profile"
        >
          <div
            className="m-3 p-3 flex items-center gap-3 transition-colors duration-200"
            style={{
              background: 'var(--cv-card-bg)',
              border: '1px solid var(--cv-border)',
            }}
          >
            <div
              className="w-9 h-9 shrink-0 overflow-hidden"
              style={{
                borderRadius: 0,
                boxShadow: `0 0 0 1px rgba(var(--cv-text-rgb), 0.06), 0 0 12px ${(user?.avatar_color || '#6C63FF')}40`,
              }}
            >
              {user?.has_avatar ? (
                <img
                  src={usersClient.getAvatarUrl(user.user_id, user.avatar_updated_at)}
                  alt={user.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center font-syne text-white"
                  style={{
                    background: user?.avatar_color || 'var(--cv-purple)',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                  }}
                >
                  {getInitials(user?.name || profile?.personal_info?.full_name || '?')}
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className="font-syne truncate transition-colors"
                style={{
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  letterSpacing: '-0.01em',
                  color: 'var(--cv-text)',
                }}
              >
                {loading ? t('loading').replace('...','') : (user?.name || profile?.personal_info?.full_name || 'USER').toUpperCase()}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-[2px]" style={{ background: 'var(--cv-border)' }}>
                  <div
                    className="h-full transition-all duration-700"
                    style={{ width: `${completenessScore}%`, background: 'var(--cv-cyan)' }}
                  />
                </div>
                <span
                  className="font-dm shrink-0"
                  style={{ fontSize: '0.55rem', letterSpacing: '0.12em', color: 'var(--cv-muted)' }}
                >
                  {completenessScore}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">

        {completenessScore !== null && completenessScore < 70 && !loading && (
          <div
            className="px-8 py-3 flex items-center justify-between shrink-0 flex-wrap gap-3"
            style={{
              background: 'rgba(245,158,11,0.07)',
              borderBottom: '1px solid rgba(245,158,11,0.18)',
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#f59e0b' }} />
              <p
                className="font-dm truncate"
                style={{ fontSize: '0.72rem', letterSpacing: '0.04em', color: 'rgba(245,158,11,0.85)' }}
              >
                <span style={{ color: '#f59e0b', fontWeight: 500 }}>{t('banner_profile_incomplete')}</span>
                {' '}{t('banner_missing_fields', { n: missingFields?.length || 5 })}
              </p>
            </div>
            <button
              onClick={() => navigate('/profile-management')}
              className="font-dm uppercase shrink-0"
              style={{
                fontSize: '0.62rem',
                letterSpacing: '0.18em',
                color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.4)',
                padding: '0.4rem 0.85rem',
                background: 'transparent',
              }}
            >
              {t('banner_complete_now')}
            </button>
          </div>
        )}

        <header
          className="h-14 flex items-center justify-between px-8 shrink-0"
          style={{
            background: 'var(--cv-header-bg)',
            borderBottom: '1px solid var(--cv-border)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="font-dm"
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--cv-muted)',
            }}
          >
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-3">
            {/* Language switcher */}
            <div className="flex items-center gap-1">
              {LANGS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className="font-dm uppercase"
                  style={{
                    fontSize: '0.5rem',
                    letterSpacing: '0.18em',
                    padding: '0.25rem 0.5rem',
                    background: 'transparent',
                    border: `1px solid ${lang === l ? 'var(--cv-cyan)' : 'var(--cv-border)'}`,
                    color: lang === l ? 'var(--cv-cyan)' : 'var(--cv-muted)',
                    cursor: 'pointer',
                    transition: 'border-color .2s, color .2s',
                  }}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                background: 'transparent',
                border: '1px solid var(--cv-border)',
                color: 'var(--cv-muted)',
                cursor: 'pointer',
                transition: 'border-color .2s, color .2s',
              }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark'
                ? <Sun className="w-3.5 h-3.5" />
                : <Moon className="w-3.5 h-3.5" />
              }
            </button>

            {/* Live indicator */}
            <div
              className="flex items-center gap-2 px-3 py-1"
              style={{
                background: 'rgba(var(--cv-cyan-rgb), 0.06)',
                border: '1px solid rgba(var(--cv-cyan-rgb), 0.18)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--cv-cyan)', boxShadow: '0 0 8px var(--cv-cyan)' }}
              />
              <span
                className="font-dm"
                style={{
                  fontSize: '0.58rem',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'var(--cv-cyan)',
                }}
              >
                {t('header_live')}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-10 custom-scrollbar">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
