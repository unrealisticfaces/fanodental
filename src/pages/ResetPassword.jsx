import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [newPassword, setNewPassword] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  const oobCode = searchParams.get('oobCode');

  useEffect(() => {
    if (!oobCode) {
      setError('Invalid or missing reset link. Please request a new password reset.');
      setIsValidating(false);
      return;
    }

    // Verify the token immediately when the page loads
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setUserEmail(email);
        setIsValidating(false);
      })
      .catch((err) => {
        setError('This reset link has expired or has already been used. Please request a new one.');
        setIsValidating(false);
      });
  }, [oobCode]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setMessage('Password reset successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setError('Failed to reset password. The link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full pl-10 pr-3 py-2 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm";

  return (
    <div className="min-h-screen flex items-center justify-center bg-pageLight dark:bg-pageDark p-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4">
        
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center text-white font-bold text-xl shadow-sm">D</div>
            <span className="text-2xl font-bold text-textLight dark:text-textDark tracking-tight">Fano Laboratory System</span>
          </div>
          <h2 className="text-base font-semibold text-textLight dark:text-textDark">Create New Password</h2>
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

          {isValidating ? (
            <div className="text-center text-sm text-mutedLight dark:text-mutedDark py-4">Validating secure link...</div>
          ) : !error && !message ? (
            <form onSubmit={handleResetPassword} className="space-y-4 animate-in fade-in">
              <div className="text-sm text-mutedLight dark:text-mutedDark mb-4">
                Resetting password for: <strong className="text-textLight dark:text-textDark">{userEmail}</strong>
              </div>

              <div>
                <label className="block text-sm font-medium text-textLight dark:text-textDark mb-1.5">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-mutedLight dark:text-mutedDark">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z" /><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M8 11v-4a4 4 0 1 1 8 0v4" /></svg>
                  </div>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primaryHover transition-colors shadow-sm disabled:opacity-50">
                  {isLoading ? 'Saving...' : 'Save New Password'}
                </button>
              </div>
            </form>
          ) : (
            <div className="pt-4">
              <button onClick={() => navigate('/')} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-sm font-medium rounded-md hover:bg-pageLight dark:hover:bg-pageDark transition-colors shadow-sm">
                Return to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}