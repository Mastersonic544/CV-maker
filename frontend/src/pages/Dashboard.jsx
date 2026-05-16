import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';
import { useUser } from '../hooks/useUser';
import ProfileCard from '../components/ProfileCard';
import { apiClient, usersClient } from '../api/client';
import {
  Inbox, Building2, Calendar, Star, ChevronRight,
  Search, CheckSquare, Send, MessageSquare, ArrowRight,
} from 'lucide-react';

/**
 * Dashboard page. Profile overview + application history table.
 */
const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, loading, completenessScore, missingFields, aiPendingFields, updateProfile, refreshProfile } = useProfile();
  const { user } = useUser();

  const handleAiFill = async () => {
    if (!user?.user_id) return;
    await usersClient.aiFillProfile(user.user_id);
    await refreshProfile();
  };
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await apiClient.getHistory();
        setHistory(data || []);
      } catch (err) {
        console.warn("History not available:", err.message);
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const statusStyle = {
    sent:     { bg: 'rgba(59,130,246,0.08)',  br: 'rgba(59,130,246,0.3)',  c: '#60a5fa' },
    opened:   { bg: 'rgba(var(--cv-cyan-rgb), 0.08)', br: 'rgba(var(--cv-cyan-rgb), 0.3)', c: 'var(--cv-cyan)' },
    replied:  { bg: 'rgba(16,185,129,0.08)',  br: 'rgba(16,185,129,0.3)',  c: '#34d399' },
    interview:{ bg: 'rgba(108,99,255,0.08)',  br: 'rgba(108,99,255,0.3)',  c: '#8b85ff' },
    rejected: { bg: 'rgba(239,68,68,0.08)',   br: 'rgba(239,68,68,0.3)',   c: '#f87171' },
    pending:  { bg: 'rgba(var(--cv-text-rgb), 0.04)', br: 'rgba(var(--cv-text-rgb), 0.12)', c: 'rgba(var(--cv-text-rgb), 0.55)' },
  };

  const stats = [
    { n: history.length, em: '', label: 'Applications' },
    { n: history.filter(h => h.status === 'interview').length, em: '', label: 'Interviews' },
    { n: history.filter(h => h.status === 'replied').length, em: '', label: 'Replies' },
    { n: completenessScore, em: '%', label: 'Profile' },
  ];

  const quickActions = [
    { to: '/discover',  icon: Search,        label: 'Discovery', sub: 'Find target roles' },
    { to: '/review',    icon: CheckSquare,   label: 'Review',    sub: 'Generate CVs' },
    { to: '/apply',     icon: Send,          label: 'Apply',     sub: 'Send applications' },
    { to: '/interview', icon: MessageSquare, label: 'Interview', sub: 'Practice persona' },
  ];

  return (
    <div className="space-y-10 cv-reveal">
      {/* Section title */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span style={{ width: 22, height: 1, background: 'var(--cv-cyan)' }} />
          <span
            className="font-dm"
            style={{ fontSize: '0.62rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}
          >
            Phase 01 / Command
          </span>
        </div>
        <h1
          className="font-syne"
          style={{ fontWeight: 800, fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '-0.04em', color: 'var(--cv-text)', lineHeight: 1 }}
        >
          Dashboard.
        </h1>
        <p
          className="font-dm mt-3"
          style={{ fontSize: '0.78rem', color: 'rgba(var(--cv-text-rgb), 0.55)', letterSpacing: '0.02em' }}
        >
          Application pipeline at a glance.
        </p>
      </div>

      {/* Profile Card */}
      <ProfileCard
        profile={profile}
        user={user}
        completenessScore={completenessScore}
        missingFields={missingFields}
        aiPendingFields={aiPendingFields}
        onUpdate={updateProfile}
        onRefresh={refreshProfile}
        onAiFill={handleAiFill}
        loading={loading}
      />

      {/* Stats row */}
      <div
        className="grid grid-cols-2 md:grid-cols-4"
        style={{ border: '1px solid var(--cv-border)', background: 'var(--cv-card-bg)' }}
      >
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="p-6"
            style={{
              borderRight: i < stats.length - 1 ? '1px solid var(--cv-border)' : 'none',
              borderBottom: i < 2 ? '1px solid var(--cv-border)' : 'none',
            }}
          >
            <div
              className="font-syne"
              style={{ fontWeight: 800, fontSize: '2.2rem', letterSpacing: '-0.04em', color: 'var(--cv-text)', lineHeight: 1 }}
            >
              {s.n}
              {s.em && <span style={{ color: 'var(--cv-cyan)', fontStyle: 'normal' }}>{s.em}</span>}
            </div>
            <div
              className="font-dm mt-2"
              style={{ fontSize: '0.55rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.55)' }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <span style={{ width: 16, height: 1, background: 'var(--cv-cyan)' }} />
          <span
            className="font-dm"
            style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}
          >
            Quick Actions
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map(qa => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.to}
                onClick={() => navigate(qa.to)}
                className="group flex items-center justify-between p-5 transition-all duration-200 text-left"
                style={{
                  background: 'var(--cv-card-bg)',
                  border: '1px solid var(--cv-border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(var(--cv-cyan-rgb), 0.04)';
                  e.currentTarget.style.borderColor = 'rgba(var(--cv-cyan-rgb), 0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--cv-card-bg)';
                  e.currentTarget.style.borderColor = 'var(--cv-border)';
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0 group-hover:text-cv-cyan transition-colors" style={{ color: 'rgba(var(--cv-text-rgb), 0.55)' }} />
                  <div className="min-w-0">
                    <p
                      className="font-syne truncate"
                      style={{ fontWeight: 700, fontSize: '0.82rem', letterSpacing: '-0.01em', color: 'var(--cv-text)' }}
                    >
                      {qa.label}
                    </p>
                    <p
                      className="font-dm truncate"
                      style={{ fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.42)' }}
                    >
                      {qa.sub}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'rgba(var(--cv-text-rgb), 0.42)' }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Application History */}
      <div
        className="overflow-hidden"
        style={{
          background: 'var(--cv-card-bg)',
          border: '1px solid var(--cv-border)',
        }}
      >
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: '1px solid var(--cv-border)' }}>
          <div>
            <h2
              className="font-syne"
              style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.02em', color: 'var(--cv-text)' }}
            >
              Application History
            </h2>
            <p
              className="font-dm mt-1"
              style={{ fontSize: '0.55rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.42)' }}
            >
              {history.length} entr{history.length !== 1 ? 'ies' : 'y'} tracked
            </p>
          </div>
        </div>

        {historyLoading ? (
          <div className="p-12 text-center">
            <div className="w-7 h-7 mx-auto rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(var(--cv-text-rgb), 0.08)', borderTopColor: 'var(--cv-cyan)' }} />
            <p
              className="font-dm mt-4"
              style={{ fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.42)' }}
            >
              Loading
            </p>
          </div>
        ) : history.length === 0 ? (
          <div className="p-14 text-center">
            <div
              className="w-14 h-14 mx-auto flex items-center justify-center mb-5"
              style={{ background: 'rgba(var(--cv-cyan-rgb), 0.04)', border: '1px solid rgba(var(--cv-cyan-rgb), 0.2)' }}
            >
              <Inbox className="w-6 h-6" style={{ color: 'rgba(var(--cv-cyan-rgb), 0.55)' }} />
            </div>
            <h3
              className="font-syne mb-2"
              style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--cv-text)' }}
            >
              No applications yet
            </h3>
            <p
              className="font-dm max-w-sm mx-auto"
              style={{ fontSize: '0.72rem', lineHeight: 1.7, color: 'rgba(var(--cv-text-rgb), 0.55)' }}
            >
              Start in <span style={{ color: 'var(--cv-cyan)' }}>Discovery</span> to find jobs and begin the automated pipeline.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--cv-border)' }}>
                  {['Company', 'Role', 'Date', 'Score', 'Status', ''].map(h => (
                    <th
                      key={h}
                      className="font-dm text-left px-6 py-4"
                      style={{
                        fontSize: '0.55rem',
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: 'rgba(var(--cv-text-rgb), 0.42)',
                        fontWeight: 500,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((app, idx) => {
                  const s = statusStyle[app.status] || statusStyle.pending;
                  return (
                    <tr
                      key={`${app.company_id || 'entry'}_${idx}`}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid rgba(var(--cv-text-rgb), 0.04)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--cv-card-bg)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 flex items-center justify-center shrink-0"
                            style={{
                              background: 'rgba(var(--cv-cyan-rgb), 0.04)',
                              border: '1px solid rgba(var(--cv-cyan-rgb), 0.18)',
                            }}
                          >
                            <Building2 className="w-3.5 h-3.5" style={{ color: 'rgba(var(--cv-cyan-rgb), 0.7)' }} />
                          </div>
                          <span
                            className="font-syne"
                            style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--cv-text)', letterSpacing: '-0.01em' }}
                          >
                            {app.company_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-dm" style={{ fontSize: '0.72rem', color: 'rgba(var(--cv-text-rgb), 0.7)' }}>
                          {app.job_title}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-dm" style={{ fontSize: '0.65rem', color: 'rgba(var(--cv-text-rgb), 0.55)', letterSpacing: '0.04em' }}>
                          <Calendar className="w-3 h-3" />
                          {new Date(app.date_sent).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Star className="w-3 h-3" style={{ color: '#fbbf24' }} />
                          <span className="font-dm" style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 500 }}>
                            {app.cv_score_achieved}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="font-dm inline-flex items-center px-2 py-1"
                          style={{
                            fontSize: '0.55rem',
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            background: s.bg,
                            border: `1px solid ${s.br}`,
                            color: s.c,
                          }}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          className="p-1.5 transition-colors"
                          style={{ color: 'rgba(var(--cv-text-rgb), 0.42)', border: '1px solid var(--cv-border)' }}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
