import React, { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * GoogleLoginButton — self-contained Google Sign-In. Renders nothing when the
 * server has no Google/DB configured (so guest play is unaffected). On success
 * it hands the Google ID token to AuthContext.login().
 */
export function GoogleLoginButton() {
  const { googleClientId, accountsEnabled, login } = useAuth();
  const [err, setErr] = useState('');

  if (!accountsEnabled || !googleClientId) return null;

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <GoogleOAuthProvider clientId={googleClientId}>
        <GoogleLogin
          onSuccess={async (resp) => {
            try {
              await login(resp.credential);
            } catch {
              setErr('Sign-in failed. Try again.');
            }
          }}
          onError={() => setErr('Sign-in failed. Try again.')}
          shape="pill"
          text="signin_with"
        />
      </GoogleOAuthProvider>
      {err && <span className="text-xs font-semibold text-coral">{err}</span>}
    </div>
  );
}

/**
 * UserBadge — shows the signed-in user's avatar/name with a dropdown to view the
 * profile or log out. Falls back to the GoogleLoginButton when signed out.
 */
export function UserBadge() {
  const { user, logout, accountsEnabled } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!accountsEnabled) return null;
  if (!user) return <GoogleLoginButton />;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow-pop active:translate-y-0.5"
      >
        {user.picture ? (
          <img src={user.picture} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-grape text-white">
            {user.name?.[0] || '?'}
          </span>
        )}
        <span className="max-w-[8rem] truncate font-display text-sm font-bold">{user.name}</span>
        <span className="font-display text-xs text-sunny">★ {user.points}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-2xl bg-white shadow-pop-lg">
          <button
            className="block w-full px-4 py-3 text-left font-display hover:bg-grape/10"
            onClick={() => {
              setOpen(false);
              navigate('/profile');
            }}
          >
            📊 My Profile
          </button>
          <button
            className="block w-full px-4 py-3 text-left font-display text-coral hover:bg-coral/10"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            🚪 Log out
          </button>
        </div>
      )}
    </div>
  );
}
