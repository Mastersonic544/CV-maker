import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersClient } from '../api/client';
import { Camera, Plus, Loader2, Trash2 } from 'lucide-react';

const COLORS = ['#6C63FF','#00d4ff','#ff5c35','#10b981','#f59e0b','#ec4899','#8b5cf6'];

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

const Avatar = ({ user, size = 76 }) => {
  if (user.has_avatar) {
    return (
      <img
        src={usersClient.getAvatarUrl(user.user_id, user.avatar_updated_at)}
        alt={user.name}
        style={{ width: size, height: size, objectFit: 'cover', display: 'block', borderRadius: 0 }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center font-syne select-none"
      style={{
        width: size, height: size,
        background: user.avatar_color,
        color: '#fff',
        fontWeight: 800,
        fontSize: size * 0.32,
        letterSpacing: '-0.02em',
        borderRadius: 0,
      }}
    >
      {getInitials(user.name)}
    </div>
  );
};

const UserCard = ({ user, onSelect, onDelete, onAvatarUpdate }) => {
  const [deleting, setDeleting]     = useState(false);
  const [hovering, setHovering]     = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [avatarHover, setAvatarHover] = useState(false);
  const fileRef = useRef(null);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete profile "${user.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try { await onDelete(user.user_id); } finally { setDeleting(false); }
  };

  const handleAvatarClick = (e) => {
    e.stopPropagation();
    fileRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await usersClient.uploadAvatar(user.user_id, file);
      onAvatarUpdate(user.user_id);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div
      onClick={() => !deleting && !uploading && onSelect(user)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="relative flex flex-col items-center gap-4 p-6 cursor-pointer transition-all duration-200 group"
      style={{
        width: 200,
        background: hovering ? 'rgba(var(--cv-text-rgb), 0.04)' : 'var(--cv-card-bg)',
        border: `1px solid ${hovering ? user.avatar_color + '60' : 'var(--cv-border)'}`,
        boxShadow: hovering ? `0 0 32px ${user.avatar_color}25` : 'none',
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Avatar with camera overlay */}
      <div
        className="relative"
        style={{
          padding: 4,
          boxShadow: hovering
            ? `0 0 0 2px ${user.avatar_color}, 0 0 24px ${user.avatar_color}55`
            : '0 0 0 1px rgba(var(--cv-text-rgb), 0.08)',
          transition: 'box-shadow .25s',
        }}
        onMouseEnter={() => setAvatarHover(true)}
        onMouseLeave={() => setAvatarHover(false)}
        onClick={handleAvatarClick}
      >
        <Avatar user={user} size={76} />

        {/* Camera overlay */}
        <div
          className="absolute inset-1 flex items-center justify-center transition-opacity duration-150"
          style={{
            background: 'rgba(0,0,0,0.55)',
            opacity: avatarHover || uploading ? 1 : 0,
          }}
        >
          {uploading
            ? <Loader2 className="w-4 h-4 text-white animate-spin" />
            : <Camera className="w-4 h-4 text-white" />
          }
        </div>

        {!user.onboarding_complete && (
          <div
            className="absolute -bottom-1 -right-1 px-1.5 py-0.5"
            style={{
              background: '#f59e0b',
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.5rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#020810',
              fontWeight: 700,
            }}
          >
            Setup
          </div>
        )}
      </div>

      <div className="text-center w-full">
        <p
          className="font-syne truncate"
          style={{ fontWeight: 700, fontSize: '0.92rem', letterSpacing: '-0.01em', color: 'var(--cv-text)' }}
        >
          {user.name}
        </p>
        <p
          className="font-dm mt-1"
          style={{
            fontSize: '0.55rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: user.onboarding_complete ? 'rgba(var(--cv-cyan-rgb), 0.65)' : 'rgba(245,158,11,0.85)',
          }}
        >
          {user.onboarding_complete ? 'Ready' : 'Setup incomplete'}
        </p>
      </div>

      {hovering && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="absolute top-2 right-2 p-1.5 transition-colors"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#f87171',
          }}
        >
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
};

const CreateCard = ({ onClick }) => {
  const [hovering, setHovering] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="flex flex-col items-center gap-4 p-6 cursor-pointer transition-all duration-200"
      style={{
        width: 200,
        background: hovering ? 'rgba(var(--cv-cyan-rgb), 0.04)' : 'transparent',
        border: `1px dashed ${hovering ? 'var(--cv-cyan)' : 'rgba(var(--cv-text-rgb), 0.15)'}`,
      }}
    >
      <div
        className="w-[76px] h-[76px] flex items-center justify-center transition-all"
        style={{
          background: hovering ? 'rgba(var(--cv-cyan-rgb), 0.08)' : 'rgba(var(--cv-text-rgb), 0.03)',
          border: `1px solid ${hovering ? 'rgba(var(--cv-cyan-rgb), 0.4)' : 'rgba(var(--cv-text-rgb), 0.08)'}`,
        }}
      >
        <Plus className="w-7 h-7" style={{ color: hovering ? 'var(--cv-cyan)' : 'rgba(var(--cv-text-rgb), 0.4)' }} />
      </div>
      <div className="text-center">
        <p
          className="font-syne"
          style={{ fontWeight: 700, fontSize: '0.92rem', letterSpacing: '-0.01em', color: hovering ? 'var(--cv-cyan)' : 'var(--cv-text)' }}
        >
          New Profile
        </p>
        <p
          className="font-dm mt-1"
          style={{
            fontSize: '0.55rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(var(--cv-text-rgb), 0.32)',
          }}
        >
          Create
        </p>
      </div>
    </div>
  );
};

const ProfileSelector = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    usersClient.listUsers().then(setUsers).catch(() => setUsers([])).finally(() => setLoading(false));
  }, []);

  const handleSelect = async (user) => {
    await usersClient.switchUser(user.user_id);
    localStorage.setItem('cvmaker_active_user', user.user_id);
    if (!user.onboarding_complete) {
      navigate('/onboarding', { state: { userId: user.user_id } });
    } else {
      navigate('/dashboard');
    }
  };

  const handleDelete = async (userId) => {
    await usersClient.deleteUser(userId);
    setUsers(prev => prev.filter(u => u.user_id !== userId));
    if (localStorage.getItem('cvmaker_active_user') === userId) {
      localStorage.removeItem('cvmaker_active_user');
    }
  };

  const handleAvatarUpdate = async (userId) => {
    const fresh = await usersClient.listUsers();
    setUsers(fresh);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const user = await usersClient.createUser(newName.trim(), selectedColor);
      await usersClient.switchUser(user.user_id);
      localStorage.setItem('cvmaker_active_user', user.user_id);
      navigate('/onboarding', { state: { userId: user.user_id } });
    } catch (e) {
      alert('Failed to create profile: ' + e.message);
      setCreating(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative"
      style={{
        background: 'var(--cv-bg)',
        fontFamily: "'DM Mono', monospace",
        color: 'var(--cv-text)',
      }}
    >
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(var(--cv-cyan-rgb), 0.09) 1px, transparent 1px)',
          backgroundSize: '38px 38px',
          maskImage: 'radial-gradient(ellipse 60% 70% at 50% 40%, rgba(0,0,0,0.8), transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 70% at 50% 40%, rgba(0,0,0,0.8), transparent)',
        }}
      />

      {/* Logo */}
      <div className="relative z-10 mb-3 cv-reveal">
        <div className="flex items-center justify-center gap-1">
          <span
            className="font-syne"
            style={{ fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.04em', color: 'var(--cv-text)' }}
          >
            CV<span style={{ color: 'var(--cv-cyan)' }}>.</span>MAKER
          </span>
        </div>
      </div>

      {/* Eyebrow */}
      <div
        className="relative z-10 flex items-center gap-3 mb-12 cv-reveal"
        style={{ animationDelay: '0.1s' }}
      >
        <span style={{ width: 22, height: 1, background: 'var(--cv-cyan)' }} />
        <span
          className="font-dm"
          style={{
            fontSize: '0.62rem',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: 'rgba(var(--cv-text-rgb), 0.55)',
          }}
        >
          Select Profile
        </span>
      </div>

      {loading ? (
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--cv-cyan)' }} />
      ) : (
        <>
          {/* Profile grid */}
          <div className="relative z-10 flex flex-wrap gap-5 justify-center max-w-3xl cv-reveal" style={{ animationDelay: '0.2s' }}>
            {users.map(user => (
              <UserCard key={user.user_id} user={user} onSelect={handleSelect} onDelete={handleDelete} onAvatarUpdate={handleAvatarUpdate} />
            ))}
            <CreateCard onClick={() => setShowCreateForm(true)} />
          </div>

          {/* Footer line */}
          <p
            className="relative z-10 mt-14 font-dm cv-reveal"
            style={{
              fontSize: '0.58rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(var(--cv-text-rgb), 0.28)',
              animationDelay: '0.3s',
            }}
          >
            Local Storage · Zero Cloud · v1.0
          </p>

          {/* Create form modal */}
          {showCreateForm && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'var(--cv-overlay)', backdropFilter: 'blur(8px)' }}
              onClick={(e) => e.target === e.currentTarget && !creating && setShowCreateForm(false)}
            >
              <div
                className="w-full max-w-sm p-7"
                style={{
                  background: 'var(--cv-surface)',
                  border: '1px solid rgba(var(--cv-text-rgb), 0.10)',
                  boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--cv-cyan-rgb), 0.06)',
                }}
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <span style={{ width: 22, height: 1, background: 'var(--cv-cyan)' }} />
                  <span
                    className="font-dm"
                    style={{
                      fontSize: '0.6rem',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'var(--cv-cyan)',
                    }}
                  >
                    New Profile
                  </span>
                </div>

                <h2
                  className="font-syne mb-6"
                  style={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.03em', color: 'var(--cv-text)' }}
                >
                  Identify yourself.
                </h2>

                <label
                  className="block mb-2 font-dm"
                  style={{
                    fontSize: '0.58rem',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(var(--cv-text-rgb), 0.55)',
                  }}
                >
                  Your name
                </label>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Alex Rivera"
                  className="cv-input mb-6"
                />

                <label
                  className="block mb-3 font-dm"
                  style={{
                    fontSize: '0.58rem',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(var(--cv-text-rgb), 0.55)',
                  }}
                >
                  Avatar color
                </label>
                <div className="flex gap-2 mb-7 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className="w-8 h-8 transition-all"
                      style={{
                        background: c,
                        boxShadow: selectedColor === c
                          ? `0 0 0 2px var(--cv-surface), 0 0 0 3px ${c}`
                          : 'none',
                        transform: selectedColor === c ? 'scale(1.1)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    disabled={creating}
                    className="cv-btn-ghost flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newName.trim()}
                    className="cv-btn-purple flex-1 flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating</>
                    ) : (
                      <>Continue</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProfileSelector;
