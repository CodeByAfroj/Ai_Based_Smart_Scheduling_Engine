import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { CalendarSync, Sparkles, ShieldCheck, ArrowRight, Loader2, Mail, Lock, Eye, AlertCircle } from 'lucide-react';
import { getApiBase } from '../utils/apiConfig';
import MobileLanding from '../components/MobileLanding';

export default function Login() {

  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleAuthSuccess = async (token) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (res.ok) {
        const data = await res.json();
        login(data.access_token);
        navigate('/', { replace: true });
      } else {
        const errorText = await res.text();
        console.error("Backend auth failed", errorText);
        setErrorMessage(`Authentication Failed: ${res.statusText}`);
      }
    } catch (err) {
      console.error('Login failed', err);
      setErrorMessage(`Connection Error: Unable to reach server.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebGoogleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => handleAuthSuccess(tokenResponse.access_token),
    onError: errorResponse => {
      console.error('Google Login Error:', errorResponse);
      setErrorMessage(`Sign-In Error: ${errorResponse.error_description || 'Cancelled'}`);
      setIsLoading(false);
    },
  });

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    setIsLoading(true);
    
    const isNative = typeof window !== 'undefined' && 
                     (window.AndroidNative || (window.Capacitor && window.Capacitor.isNativePlatform()) || window.location.protocol === 'capacitor:');
                     
    if (isNative) {
      try {
        await GoogleAuth.initialize({
          clientId: '397100048038-lb4broqvu771adseev9as4njei0bqc6v.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        });
        const googleUser = await GoogleAuth.signIn();
        if (googleUser && googleUser.authentication && googleUser.authentication.accessToken) {
          handleAuthSuccess(googleUser.authentication.accessToken);
        } else {
          throw new Error('Missing access token');
        }
      } catch (error) {
        console.error('Native Google Auth Error:', error);
        setErrorMessage(`Sign-In Error: Cancelled or failed`);
        setIsLoading(false);
      }
    } else {
      handleWebGoogleLogin();
    }
  };
  return (
    <div className="w-full min-h-screen bg-[var(--bg-app)]">
      {errorMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-3 shadow-lg">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{errorMessage}</p>
          </div>
        </div>
      )}
      <MobileLanding onLogin={handleGoogleLogin} isLoading={isLoading} />
    </div>
  );
}
