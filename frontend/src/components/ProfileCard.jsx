import React, { useState } from 'react';
import { User, MapPin, Briefcase, X, Check, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { usersClient } from '../api/client';

/**
 * ProfileCard. Reusable component displaying profile overview with
 * completeness score, missing field chips, and inline editing.
 *
 * Props:
 *   profile             the full profile object
 *   completenessScore   float 0-100
 *   missingFields       array of missing field label strings
 *   onUpdate            async (updates) => void. Called to PATCH profile
 *   loading             boolean
 */
const ProfileCard = ({ profile, user, completenessScore, missingFields, aiPendingFields = [], onUpdate, onRefresh, onAiFill, loading }) => {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filling, setFilling] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  const handleAiFill = async () => {
    if (!onAiFill || filling) return;
    setFilling(true);
    try { await onAiFill(); } finally { setFilling(false); }
  };

  if (loading) {
    return (
      <div
        className="p-8 animate-pulse"
        style={{ background: 'var(--cv-card-bg)', border: '1px solid var(--cv-border)' }}
      >
        <div className="flex items-center gap-6 flex-wrap">
          <div className="w-20 h-20" style={{ background: 'rgba(var(--cv-text-rgb), 0.05)' }} />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-48" style={{ background: 'rgba(var(--cv-text-rgb), 0.05)' }} />
            <div className="h-4 w-64" style={{ background: 'rgba(var(--cv-text-rgb), 0.05)' }} />
            <div className="h-3 w-32" style={{ background: 'rgba(var(--cv-text-rgb), 0.05)' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const personalInfo = profile.personal_info || {};
  const contact = personalInfo.contact || {};
  const location = personalInfo.location || {};
  const fullName = personalInfo.full_name || 'Unknown';
  const headline = personalInfo.headline || '';
  const city = location.city || '';
  const country = location.country || '';
  const locationStr = [city, country].filter(Boolean).join(', ');
  const uploadedAvatarUrl = user?.has_avatar
    ? usersClient.getAvatarUrl(user.user_id, user.avatar_updated_at)
    : null;
  const avatarUrl = uploadedAvatarUrl || contact.profile_picture;

  const getColor = (score) => {
    if (score >= 80) return { stroke: '#10b981', text: '#34d399' };
    if (score >= 50) return { stroke: '#f59e0b', text: '#fbbf24' };
    return { stroke: '#f87171', text: '#f87171' };
  };
  const c = getColor(completenessScore);

  const fieldEditMap = {
    email: { path: 'personal_info.contact.email', label: 'Email', placeholder: 'you@example.com' },
    phone: { path: 'personal_info.contact.phone', label: 'Phone', placeholder: '+1234567890' },
    github_url: { path: 'personal_info.contact.github', label: 'GitHub URL', placeholder: 'https://github.com/...' },
    portfolio_url: { path: 'personal_info.contact.portfolio', label: 'Portfolio URL', placeholder: 'https://...' },
    linkedin_url: { path: 'personal_info.contact.linkedin', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...' },
    headline: { path: 'personal_info.headline', label: 'Headline', placeholder: 'e.g. Full-Stack Developer' },
    summary: { path: 'personal_info.summary', label: 'Summary', placeholder: 'Brief professional summary...' },
    location_city: { path: 'personal_info.location.city', label: 'City', placeholder: 'e.g. San Francisco' },
    languages: { path: 'personal_info.languages', label: 'Languages', placeholder: '[\n  { "language": "English", "proficiency": "Fluent" }\n]', isJson: true, type: 'textarea' },
    full_name: { path: 'personal_info.full_name', label: 'Full Name', placeholder: 'First Last' },
    exact_education_dates: { path: 'education', label: 'Education Dates', placeholder: 'Update education array (JSON)', isJson: true, type: 'textarea' },
    gpa: { path: 'education', label: 'GPA', placeholder: 'Update education array (JSON)', isJson: true, type: 'textarea' },
    education: { path: 'education', label: 'Education', placeholder: 'Edit education (JSON array)', isJson: true, type: 'textarea' },
    work_experience: { path: 'work_experience', label: 'Work Experience', placeholder: 'Edit work_experience (JSON array)', isJson: true, type: 'textarea' },
    skills: { path: 'skills', label: 'Skills', placeholder: 'Edit skills (JSON)', isJson: true, type: 'textarea' },
    projects: { path: 'projects', label: 'Projects', placeholder: 'Edit projects (JSON array)', isJson: true, type: 'textarea' },
    certifications: { path: 'certifications', label: 'Certifications', placeholder: 'Edit certifications (JSON array)', isJson: true, type: 'textarea' },
    personality_and_work_style: { path: 'personality_and_work_style', label: 'Personality', placeholder: 'Edit personality (JSON)', isJson: true, type: 'textarea' },
    preferences_and_goals: { path: 'preferences_and_goals', label: 'Preferences', placeholder: 'Edit preferences (JSON)', isJson: true, type: 'textarea' },
    cv_generation_hints: { path: 'cv_generation_hints', label: 'CV Hints', placeholder: 'Edit hints (JSON)', isJson: true, type: 'textarea' },
  };

  const handleChipClick = (field) => {
    const config = fieldEditMap[field];
    if (!config?.path) return;
    setEditingField(field);

    // Always resolve current value from profile so AI-filled fields are pre-populated
    const parts = config.path.split('.');
    let current = profile;
    for (const part of parts) {
      if (current === undefined || current === null) break;
      current = current[part];
    }

    if (config.isJson) {
      setEditValue(current ? JSON.stringify(current, null, 2) : '[\n  \n]');
    } else {
      setEditValue(current ? String(current) : '');
    }
  };

  const handleSave = async () => {
    if (!editingField || !editValue.trim()) return;
    const config = fieldEditMap[editingField];
    if (!config?.path) return;

    let finalValue = editValue.trim();
    if (config.isJson) {
      try {
        finalValue = JSON.parse(finalValue);
      } catch (err) {
        alert("Invalid JSON format. Please correct it.");
        return;
      }
    }

    setSaving(true);
    try {
      const parts = config.path.split('.');
      const update = {};
      let current = update;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = finalValue;

      await onUpdate(update);

      // If this was an AI-pending field, approve it and refresh
      if (aiPendingFields.includes(editingField) && user?.user_id) {
        try {
          await usersClient.approveAiFields(user.user_id, editingField);
          if (onRefresh) await onRefresh();
        } catch (approveErr) {
          console.warn('Failed to approve AI field:', approveErr);
        }
      }

      setEditingField(null);
      setEditValue('');
    } catch (err) {
      console.error('Failed to update field:', err);
      alert('Failed to save: ' + (err.message || 'Validation error'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Radial progress geometry
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - completenessScore / 100);

  return (
    <div
      className="overflow-hidden"
      style={{
        background: 'var(--cv-card-bg)',
        border: '1px solid var(--cv-border)',
      }}
    >
      {/* Top scan accent */}
      <div
        className="h-[2px]"
        style={{ background: 'linear-gradient(to right, var(--cv-cyan), rgba(108,99,255,0.5), transparent)' }}
      />

      <div className="p-8">
        {/* Header */}
        <div className="flex items-start gap-6 mb-8 flex-wrap">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-20 h-20 object-cover"
                style={{ border: '1px solid rgba(var(--cv-text-rgb), 0.1)' }}
              />
            ) : (
              <div
                className="w-20 h-20 flex items-center justify-center"
                style={{
                  background: 'rgba(var(--cv-cyan-rgb), 0.04)',
                  border: '1px solid rgba(var(--cv-cyan-rgb), 0.2)',
                }}
              >
                <User className="w-8 h-8" style={{ color: 'rgba(var(--cv-cyan-rgb), 0.5)' }} />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span style={{ width: 16, height: 1, background: 'var(--cv-cyan)' }} />
              <p
                className="font-dm"
                style={{ fontSize: '0.55rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}
              >
                Operator
              </p>
            </div>
            <h2
              className="font-syne truncate"
              style={{ fontWeight: 800, fontSize: '1.65rem', letterSpacing: '-0.03em', color: 'var(--cv-text)', lineHeight: 1.05 }}
            >
              {fullName}
            </h2>
            {headline && (
              <p
                className="font-dm flex items-center gap-2 mt-2"
                style={{ fontSize: '0.72rem', color: 'rgba(var(--cv-text-rgb), 0.7)' }}
              >
                <Briefcase className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(var(--cv-text-rgb), 0.42)' }} />
                <span className="truncate">{headline}</span>
              </p>
            )}
            {locationStr && (
              <p
                className="font-dm flex items-center gap-2 mt-1"
                style={{ fontSize: '0.65rem', letterSpacing: '0.08em', color: 'rgba(var(--cv-text-rgb), 0.55)' }}
              >
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span>{locationStr}</span>
              </p>
            )}
          </div>

          {/* Radial progress */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 88 88">
                <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(var(--cv-text-rgb), 0.1)" strokeWidth="3" />
                <circle
                  cx="44" cy="44" r={radius}
                  fill="none"
                  stroke={c.stroke}
                  strokeWidth="3"
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={`${offset}`}
                  style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 6px ${c.stroke}80)` }}
                />
              </svg>
              <div className="text-center">
                <div
                  className="font-syne"
                  style={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.03em', color: c.text, lineHeight: 1 }}
                >
                  {completenessScore}
                </div>
                <div
                  className="font-dm mt-0.5"
                  style={{
                    fontSize: '0.5rem',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'rgba(var(--cv-text-rgb), 0.42)',
                  }}
                >
                  Complete
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {onAiFill && (
                <button
                  onClick={handleAiFill}
                  disabled={filling}
                  title="AI auto-fill missing fields"
                  className="font-dm flex items-center gap-1.5 px-2.5 py-1 transition-all"
                  style={{
                    fontSize: '0.55rem',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: filling ? 'rgba(var(--cv-cyan-rgb), 0.55)' : 'var(--cv-cyan)',
                    background: 'rgba(var(--cv-cyan-rgb), 0.06)',
                    border: '1px solid rgba(var(--cv-cyan-rgb), 0.25)',
                    opacity: filling ? 0.7 : 1,
                  }}
                >
                  <Sparkles className={`w-2.5 h-2.5 ${filling ? 'animate-pulse' : ''}`} />
                  {filling ? 'Filling...' : 'AI Fill'}
                </button>
              )}
              {onRefresh && (
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Re-check completeness"
                  className="font-dm flex items-center gap-1.5 px-2.5 py-1 transition-colors"
                  style={{
                    fontSize: '0.55rem',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'rgba(var(--cv-text-rgb), 0.55)',
                    background: 'var(--cv-card-bg)',
                    border: '1px solid var(--cv-border)',
                  }}
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Missing fields chips */}
        {missingFields && missingFields.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="w-3 h-3" style={{ color: 'rgba(var(--cv-text-rgb), 0.42)' }} />
              <span
                className="font-dm"
                style={{ fontSize: '0.58rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.55)' }}
              >
                Missing fields
              </span>
              <span
                className="font-dm"
                style={{ fontSize: '0.58rem', color: 'rgba(var(--cv-text-rgb), 0.32)' }}
              >
                — click to edit
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {missingFields.map((field) => {
                const config = fieldEditMap[field] || { label: field };
                const isEditable = !!config?.path;
                const isPending = aiPendingFields.includes(field);

                if (isPending) {
                  return (
                    <button
                      key={field}
                      onClick={() => handleChipClick(field)}
                      title="AI suggested — click to review and approve"
                      className="font-dm inline-flex items-center gap-1.5 px-2.5 py-1 transition-all"
                      style={{
                        fontSize: '0.6rem',
                        letterSpacing: '0.1em',
                        background: 'rgba(139,92,246,0.07)',
                        border: '1px solid rgba(139,92,246,0.3)',
                        color: '#a78bfa',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(139,92,246,0.15)';
                        e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(139,92,246,0.07)';
                        e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
                      }}
                    >
                      <Sparkles className="w-2.5 h-2.5" style={{ color: '#a78bfa', flexShrink: 0 }} />
                      {config.label}
                    </button>
                  );
                }

                return (
                  <button
                    key={field}
                    onClick={() => isEditable && handleChipClick(field)}
                    disabled={!isEditable}
                    className="font-dm inline-flex items-center px-2.5 py-1 transition-all"
                    style={{
                      fontSize: '0.6rem',
                      letterSpacing: '0.1em',
                      background: isEditable ? 'rgba(var(--cv-cyan-rgb), 0.05)' : 'var(--cv-card-bg)',
                      border: `1px solid ${isEditable ? 'rgba(var(--cv-cyan-rgb), 0.25)' : 'rgba(var(--cv-text-rgb), 0.06)'}`,
                      color: isEditable ? 'var(--cv-cyan)' : 'rgba(var(--cv-text-rgb), 0.32)',
                      cursor: isEditable ? 'pointer' : 'default',
                    }}
                  >
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Inline edit form */}
        {editingField && (
          <div
            className="mt-5 p-4"
            style={{
              background: 'var(--cv-bg)',
              border: aiPendingFields.includes(editingField)
                ? '1px solid rgba(139,92,246,0.3)'
                : '1px solid rgba(var(--cv-cyan-rgb), 0.2)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              {aiPendingFields.includes(editingField) ? (
                <>
                  <Sparkles className="w-3 h-3" style={{ color: '#a78bfa' }} />
                  <span
                    className="font-dm"
                    style={{ fontSize: '0.58rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#a78bfa' }}
                  >
                    AI Fill · Review &amp; Approve · {fieldEditMap[editingField]?.label}
                  </span>
                </>
              ) : (
                <span
                  className="font-dm"
                  style={{ fontSize: '0.58rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}
                >
                  Edit · {fieldEditMap[editingField]?.label}
                </span>
              )}
            </div>
            <div className="flex items-start gap-3 flex-wrap">
              {fieldEditMap[editingField]?.type === 'textarea' ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={fieldEditMap[editingField]?.placeholder}
                  className="cv-input flex-1"
                  style={{ minHeight: 150, fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', lineHeight: 1.6 }}
                  autoFocus
                />
              ) : (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={fieldEditMap[editingField]?.placeholder}
                  className="cv-input flex-1"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              )}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !editValue.trim()}
                  className="p-2.5 flex items-center justify-center"
                  style={{
                    background: '#6C63FF',
                    color: '#fff',
                    border: 'none',
                    opacity: (saving || !editValue.trim()) ? 0.45 : 1,
                  }}
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  className="p-2.5 flex items-center justify-center"
                  style={{
                    background: 'var(--cv-card-hover)',
                    color: 'rgba(var(--cv-text-rgb), 0.7)',
                    border: '1px solid rgba(var(--cv-text-rgb), 0.1)',
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileCard;
