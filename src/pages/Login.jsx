import { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotView, setIsForgotView] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      // Reverted to default Firebase handling
      await sendPasswordResetEmail(auth, resetEmail);
      
      setMessage('Password reset email sent! Please check your inbox.');
      setResetEmail('');
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else {
        setError('Failed to send reset email. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleView = (toForgot) => {
    setIsForgotView(toForgot);
    setError('');
    setMessage('');
    setEmail('');
    setPassword('');
    setResetEmail('');
  };

  const inputClass = "w-full pl-10 pr-3 py-2 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm";

  return (
    <div className="min-h-screen flex items-center justify-center bg-pageLight dark:bg-pageDark p-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4">
        
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center text-white font-bold text-xl shadow-sm">
              F
            </div>
            <span className="text-2xl font-bold text-textLight dark:text-textDark tracking-tight">Fano Laboratory System</span>
          </div>
          <h2 className="text-base font-semibold text-textLight dark:text-textDark">
            {isForgotView ? 'Reset your password' : 'Sign in to your account'}
          </h2>
        </div>

        <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm p-6 sm:p-8">
          
          {error && (
            <div className="mb-4 px-3 py-2 text-sm rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-900/30 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 px-3 py-2 text-sm rounded bg-green-50 text-green-700 border border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-900/30 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5l10 -10"></path>
              </svg>
              {message}
            </div>
          )}

          {!isForgotView ? (
            <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in">
              <div>
                <label className="block text-sm font-medium text-textLight dark:text-textDark mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-mutedLight dark:text-mutedDark">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                      <path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z" />
                      <path d="M3 7l9 6l9 -6" />
                    </svg>
                  </div>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-textLight dark:text-textDark">
                    Password
                  </label>
                  <button 
                    type="button" 
                    onClick={() => toggleView(true)}
                    className="text-xs font-medium text-primary hover:underline focus:outline-none transition-colors"
                  >
                    I forgot password
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-mutedLight dark:text-mutedDark">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                      <path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z" />
                      <path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
                      <path d="M8 11v-4a4 4 0 1 1 8 0v4" />
                    </svg>
                  </div>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primaryHover transition-colors shadow-sm disabled:opacity-50"
                >
                  {isLoading ? 'Signing in...' : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M15 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" />
                        <path d="M21 12h-13l3 -3" />
                        <path d="M11 15l-3 -3" />
                      </svg>
                      Sign in
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 animate-in fade-in">
              <p className="text-sm text-mutedLight dark:text-mutedDark mb-4">
                Enter the email address associated with your account and we will send you a link to reset your password.
              </p>
              <div>
                <label className="block text-sm font-medium text-textLight dark:text-textDark mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-mutedLight dark:text-mutedDark">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                      <path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z" />
                      <path d="M3 7l9 6l9 -6" />
                    </svg>
                  </div>
                  <input 
                    type="email" 
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="your@email.com"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button 
                  type="submit" 
                  disabled={isLoading || !resetEmail}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primaryHover transition-colors shadow-sm disabled:opacity-50"
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button 
                  type="button" 
                  onClick={() => toggleView(false)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-sm font-medium rounded-md hover:bg-pageLight dark:hover:bg-pageDark transition-colors shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
                  Back to sign in
                </button>
              </div>
            </form>
          )}

        </div>
        
        <div className="text-center mt-6 text-sm text-mutedLight dark:text-mutedDark">
          Developed by Keith David.
        </div>

      </div>
    </div>
  );
}