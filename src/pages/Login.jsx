import React, { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Clock, LogIn } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import { localClient } from '@/api/localClient';

const inputClass = 'mt-1 bg-slate-50 border-slate-200 text-slate-900';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function decodeJwtPayload(credential) {
  if (!credential || typeof credential !== 'string') return null;
  const parts = credential.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const base64 = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
  try {
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export default function Login() {
  const { isAuthenticated, user, checkAppState, applyAuthUser } = useAuth();
  const googleButtonRef = useRef(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            setError('');
            setLoading(true);
            const payload = decodeJwtPayload(response?.credential);
            const googleEmail = String(payload?.email || '').trim().toLowerCase();
            const googleName = String(payload?.name || '').trim();
            if (!googleEmail) {
              throw new Error('Google sign-in did not return an email.');
            }
            const loggedInUser = await localClient.auth.loginWithGoogle({ email: googleEmail, name: googleName });
            applyAuthUser(loggedInUser);
            checkAppState();
          } catch (err) {
            setError(err?.message || 'Google sign-in failed. Please try again.');
            setLoading(false);
          }
        },
      });
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 320,
        text: 'signin_with',
      });
      setGoogleReady(true);
    };

    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    script.onerror = () => setError('Unable to load Google sign-in.');
    document.head.appendChild(script);
  }, []);

  if (isAuthenticated && user) {
    return <Navigate to={user.setup_complete ? '/Dashboard' : '/Setup'} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loggedInUser = await localClient.auth.login({ email, fullName });
      applyAuthUser(loggedInUser);
      checkAppState();
    } catch (err) {
      setError(err?.message || 'Unable to login. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Shift Track Pro <span className="text-orange-400">&gt;</span></h1>
          <p className="text-slate-400 mt-1 text-sm">Sign in to continue</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
          <div>
            <p className="text-slate-700 text-sm font-medium mb-2">Google Sign-In</p>
            {GOOGLE_CLIENT_ID ? (
              <div className="flex justify-center">
                <div ref={googleButtonRef} className="min-h-11" />
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                Set `VITE_GOOGLE_CLIENT_ID` to enable Google OAuth.
              </div>
            )}
            {!googleReady && GOOGLE_CLIENT_ID && !error && (
              <p className="text-xs text-slate-500 mt-2 text-center">Loading Google sign-in...</p>
            )}
          </div>

          <div className="border-t border-slate-200 pt-3">
            <p className="text-xs text-slate-500 mb-3">Fallback (local demo login)</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-slate-700 text-sm">Email</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@example.com"
                  className={inputClass}
                />
              </div>

              <div>
                <Label className="text-slate-700 text-sm">Name (optional)</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  className={inputClass}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading || !email.trim()}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Login
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
