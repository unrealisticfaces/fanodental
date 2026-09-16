import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut, updateProfile, updatePassword } from 'firebase/auth';
import { database, auth } from './firebase';
import { ref, get, update } from 'firebase/database';
import { ToastProvider } from './ToastContext';
import { DataProvider } from './DataContext';
import Login from './pages/Login'; 

const OrderLayout = lazy(() => import('./pages/OrderLayout'));
const Records = lazy(() => import('./pages/Records'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Billing = lazy(() => import('./pages/Billing'));
const Payroll = lazy(() => import('./pages/Payroll'));
const Queue = lazy(() => import('./pages/Queue'));
const SystemLogs = lazy(() => import('./pages/SystemLogs'));
const Settings = lazy(() => import('./pages/Settings'));

const PageLoader = () => (
  <div className="flex h-full w-full items-center justify-center p-10">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const SunIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 3v1"></path><path d="M12 20v1"></path><path d="M3 12h1"></path><path d="M20 12h1"></path><path d="M18.364 5.636l-.707.707"></path><path d="M6.343 17.657l-.707.707"></path><path d="M5.636 5.636l.707.707"></path><path d="M17.657 17.657l.707.707"></path></svg>);
const MoonIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"></path></svg>);
const DashboardIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>);
const OrderIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>);
const RecordsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="9" y1="14" x2="15" y2="14"></line></svg>);
const BillingIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2m4 -14h6m-6 4h6m-2 4h2" /></svg>);
const PayrollIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>);
const QueueIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>);
const LogsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>);
const SettingsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>);

// 🚀 MOBILE FIX: Added Menu and Close icons
const MenuIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>);
const CloseIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);

// 🚀 MOBILE FIX: Added `onLinkClick` to close the menu on mobile after tapping a route
const SidebarContent = ({ onLogout, userProfile, onProfileClick, isOwner, onLinkClick }) => {
  const location = useLocation();

  const links = [
    { path: '/', label: 'Dashboard', icon: <DashboardIcon /> },
    { path: '/order', label: 'New Order', icon: <OrderIcon /> },
    { path: '/records', label: 'Records', icon: <RecordsIcon /> },
    { path: '/billing', label: 'Billing', icon: <BillingIcon /> },
    { path: '/payroll', label: 'Payroll', icon: <PayrollIcon /> },
    { path: '/queue', label: 'Live Queue', icon: <QueueIcon /> },
    { path: '/logs', label: 'System Logs', icon: <LogsIcon /> }
  ];

  if (isOwner) {
    links.push({ path: '/settings', label: 'Settings', icon: <SettingsIcon /> });
  }

  return (
    <>
      <div className="h-16 flex items-center px-6 border-b border-borderLight dark:border-borderDark shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-white font-bold text-sm shadow-sm">F</div>
          <span className="text-base font-bold text-textLight dark:text-textDark tracking-tight">Fano Laboratory</span>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        <div className="text-[10px] font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider mb-3 px-3">Menu</div>
        
        {links.map(link => (
          <Link 
            key={link.path} 
            to={link.path} 
            onClick={onLinkClick} // Closes mobile menu
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium ${location.pathname === link.path || (link.path === '/billing' && location.pathname.startsWith('/billing')) ? 'bg-primary/10 text-primary dark:text-amber-500' : 'text-mutedLight dark:text-mutedDark hover:text-textLight dark:hover:text-textDark hover:bg-pageLight dark:hover:bg-pageDark'}`}
          >
            <span className={location.pathname === link.path || (link.path === '/billing' && location.pathname.startsWith('/billing')) ? 'text-primary dark:text-amber-500' : 'text-mutedLight dark:text-mutedDark'}>{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-borderLight dark:border-borderDark shrink-0">
        <button onClick={() => { onProfileClick(); if(onLinkClick) onLinkClick(); }} className="flex items-center gap-3 w-full text-left px-3 py-2 mb-2 rounded-md hover:bg-pageLight dark:hover:bg-pageDark transition-colors group">
          {userProfile?.photoURL ? (
            <img src={userProfile.photoURL} alt="Profile" className="w-8 h-8 rounded-full object-cover border border-borderLight dark:border-borderDark shadow-sm" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shadow-sm">
              {userProfile?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div className="flex flex-col truncate overflow-hidden">
            <span className="text-sm font-medium text-textLight dark:text-textDark truncate group-hover:text-primary transition-colors">
              {userProfile?.name || 'Administrator'}
            </span>
            <span className="text-[11px] text-mutedLight dark:text-mutedDark truncate">{userProfile?.email}</span>
          </div>
        </button>
        <button onClick={onLogout} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md transition-colors text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sign Out
        </button>
      </div>
    </>
  );
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  
  const [workspaceUid, setWorkspaceUid] = useState(null); 

  // 🚀 MOBILE FIX: State for the mobile slide-out menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileData, setProfileData] = useState({ displayName: '', photoURL: '', password: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState({ type: '', message: '' });

  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [accountMeta, setAccountMeta] = useState(null);
  const [forcedNewPassword, setForcedNewPassword] = useState('');
  const [forcedConfirmPassword, setForcedConfirmPassword] = useState('');
  const [forcedPasswordError, setForcedPasswordError] = useState('');
  const [isUpdatingForcedPassword, setIsUpdatingForcedPassword] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const accSnap = await get(ref(database, `accounts/${currentUser.uid}`));
          if (accSnap.exists()) {
             const accData = accSnap.val();
             setAccountMeta(accData);
             setMustChangePassword(accData.mustChangePassword || false);
             
             const wUid = accData.adminUid || currentUser.uid;
             setWorkspaceUid(wUid); 

             if (wUid !== currentUser.uid) {
                const staffSnap = await get(ref(database, `users/${wUid}/staff/${currentUser.uid}`));
                if (staffSnap.exists()) {
                  const staffData = staffSnap.val();
                  setUserProfile({
                    name: staffData.name,
                    email: staffData.email,
                    photoURL: staffData.photoURL || currentUser.photoURL,
                    role: staffData.role,
                    permissions: {
                      canCreate: staffData.canCreate ?? true,
                      canEdit: staffData.canEdit ?? true,
                      canDelete: staffData.canDelete ?? false
                    }
                  });
                }
             } else {
                setUserProfile({
                  name: currentUser.displayName || 'Administrator',
                  email: currentUser.email,
                  photoURL: currentUser.photoURL,
                  role: 'Admin',
                  permissions: { canCreate: true, canEdit: true, canDelete: true }
                });
             }
          } else {
            setMustChangePassword(false);
            setWorkspaceUid(currentUser.uid);
            setUserProfile({
              name: currentUser.displayName || 'Administrator',
              email: currentUser.email,
              photoURL: currentUser.photoURL,
              role: 'Admin',
              permissions: { canCreate: true, canEdit: true, canDelete: true }
            });
          }
        } catch (err) {
          setMustChangePassword(false);
          setWorkspaceUid(currentUser.uid);
          setUserProfile({
            name: currentUser.displayName || 'Administrator',
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            role: 'Admin',
            permissions: { canCreate: true, canEdit: true, canDelete: true }
          });
        }
      } else {
        setMustChangePassword(false);
        setWorkspaceUid(null);
        setUserProfile(null);
      }
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);
  const handleLogout = async () => await signOut(auth);
  const isOwner = user && workspaceUid && user.uid === workspaceUid;

  const handleOpenProfile = () => {
    setProfileData({
      displayName: userProfile?.name || '',
      photoURL: userProfile?.photoURL || '',
      password: ''
    });
    setProfileStatus({ type: '', message: '' });
    setIsProfileModalOpen(true);
  };

  const handleProfileChange = (e) => setProfileData({ ...profileData, [e.target.name]: e.target.value });

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileStatus({ type: '', message: '' });

    try {
      if (isOwner) {
        if (profileData.displayName !== user.displayName || profileData.photoURL !== user.photoURL) {
          await updateProfile(auth.currentUser, { displayName: profileData.displayName, photoURL: profileData.photoURL });
          setUserProfile(prev => ({
            ...prev,
            name: profileData.displayName || 'Administrator',
            photoURL: profileData.photoURL
          }));
        }
      }
      
      if (profileData.password) await updatePassword(auth.currentUser, profileData.password);

      setUser({ ...auth.currentUser });
      setProfileStatus({ type: 'success', message: 'Account updated successfully!' });
      setTimeout(() => setIsProfileModalOpen(false), 1500);
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        setProfileStatus({ type: 'error', message: 'Changing password requires a recent login. Please log out and log back in.' });
      } else {
        setProfileStatus({ type: 'error', message: error.message });
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleForcedPasswordSubmit = async (e) => {
    e.preventDefault();
    setForcedPasswordError('');

    if (forcedNewPassword.length < 6) {
      setForcedPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (forcedNewPassword !== forcedConfirmPassword) {
      setForcedPasswordError('Passwords do not match.');
      return;
    }

    setIsUpdatingForcedPassword(true);
    try {
      await updatePassword(auth.currentUser, forcedNewPassword);

      const uid = auth.currentUser.uid;
      const updates = {};
      updates[`accounts/${uid}/mustChangePassword`] = false;

      if (accountMeta?.adminUid) {
        updates[`users/${accountMeta.adminUid}/staff/${uid}/mustChangePassword`] = false;
      }

      await update(ref(database), updates);

      setMustChangePassword(false);
      setForcedNewPassword('');
      setForcedConfirmPassword('');
    } catch (err) {
      setForcedPasswordError(err.message);
    } finally {
      setIsUpdatingForcedPassword(false);
    }
  };

  const inputClass = "block w-full px-2.5 py-2 sm:py-1.5 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm";
  const readOnlyInputClass = "block w-full px-2.5 py-2 sm:py-1.5 text-sm bg-gray-50 dark:bg-[#111824] border border-gray-200 dark:border-[#2b3644] rounded text-gray-500 dark:text-gray-400 cursor-not-allowed focus:outline-none shadow-sm font-medium";
  const labelClass = "block text-sm font-medium text-textLight dark:text-textDark mb-1.5";

  if (isAuthChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-pageLight dark:bg-pageDark text-sm text-textLight dark:text-textDark">Loading workspace...</div>;
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        {!user ? (
          <Login />
        ) : (
          <DataProvider workspaceUid={workspaceUid}>
            <div className="flex h-screen bg-pageLight dark:bg-pageDark font-sans transition-colors duration-200 relative overflow-hidden">
              
              {/* Desktop Sidebar (Hidden on Mobile) */}
              <aside className="w-64 bg-surfaceLight dark:bg-surfaceDark border-r border-borderLight dark:border-borderDark flex-col hidden md:flex transition-colors duration-200">
                <SidebarContent onLogout={handleLogout} userProfile={userProfile} onProfileClick={handleOpenProfile} isOwner={isOwner} />
              </aside>

              {/* 🚀 MOBILE FIX: Slide-out Sidebar Overlay (Visible only when toggled on Mobile) */}
              {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>
                  <aside className="relative flex-1 flex flex-col max-w-xs w-full bg-surfaceLight dark:bg-surfaceDark shadow-2xl animate-in slide-in-from-left">
                    <div className="absolute top-0 right-0 -mr-12 pt-4">
                      <button onClick={() => setIsMobileMenuOpen(false)} className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
                        <span className="text-white"><CloseIcon /></span>
                      </button>
                    </div>
                    <SidebarContent onLogout={handleLogout} userProfile={userProfile} onProfileClick={handleOpenProfile} isOwner={isOwner} onLinkClick={() => setIsMobileMenuOpen(false)} />
                  </aside>
                </div>
              )}

              <main className="flex-1 flex flex-col overflow-hidden w-full max-w-full">
                <header className="h-14 sm:h-16 bg-surfaceLight dark:bg-surfaceDark border-b border-borderLight dark:border-borderDark flex items-center justify-between px-4 sm:px-6 transition-colors duration-200 shrink-0">
                  <div className="flex items-center gap-3">
                    {/* 🚀 MOBILE FIX: Hamburger Toggle Button */}
                    <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 -ml-1 rounded-md text-textLight dark:text-textDark md:hidden hover:bg-pageLight dark:hover:bg-pageDark transition-colors">
                      <MenuIcon />
                    </button>
                    <h1 className="text-sm sm:text-base font-medium text-textLight dark:text-textDark truncate max-w-[200px] sm:max-w-none">System Workspace</h1>
                  </div>
                  <button onClick={toggleTheme} className="p-2 rounded-md text-mutedLight dark:text-mutedDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors focus:outline-none focus:ring-1 focus:ring-primary">
                    {isDarkMode ? <SunIcon /> : <MoonIcon />}
                  </button>
                </header>
                
                {/* 🚀 MOBILE FIX: Optimized padding for small screens */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-8">
                  {workspaceUid && !mustChangePassword ? (
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<Dashboard workspaceUid={workspaceUid} />} />
                        <Route path="/order" element={<OrderLayout workspaceUid={workspaceUid} userProfile={userProfile} />} />
                        <Route path="/records" element={<Records workspaceUid={workspaceUid} userProfile={userProfile} />} />
                        <Route path="/billing" element={<Billing workspaceUid={workspaceUid} />} />
                        <Route path="/payroll" element={<Payroll workspaceUid={workspaceUid} />} />
                        <Route path="/queue" element={<Queue workspaceUid={workspaceUid} />} /> 
                        <Route path="/logs" element={<SystemLogs workspaceUid={workspaceUid} />} />
                        {isOwner && <Route path="/settings" element={<Settings workspaceUid={workspaceUid} />} />}
                        <Route path="*" element={<Navigate to="/" />} />
                      </Routes>
                    </Suspense>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-mutedLight dark:text-mutedDark text-center p-4">
                      {mustChangePassword ? "Please update your password to continue." : "Connecting to workspace..."}
                    </div>
                  )}
                </div>
              </main>
            </div>

            {/* Password and Profile Modals */}
            {mustChangePassword && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-2xl w-full max-w-md p-5 sm:p-6 animate-in fade-in">
                  <div className="text-center mb-5 sm:mb-6">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z" /><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M8 11v-4a4 4 0 1 1 8 0v4" /></svg>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-textLight dark:text-textDark">Change Default Password</h3>
                    <p className="text-xs sm:text-sm text-mutedLight dark:text-mutedDark mt-1">
                      You are logging in with a default password. For security, please set a new personal password before continuing.
                    </p>
                  </div>

                  {forcedPasswordError && (
                    <div className="mb-4 px-3 py-2 text-xs sm:text-sm rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-900/30">
                      {forcedPasswordError}
                    </div>
                  )}

                  <form onSubmit={handleForcedPasswordSubmit} className="space-y-4">
                    <div>
                      <label className={labelClass}>New Password</label>
                      <input type="password" value={forcedNewPassword} onChange={e => setForcedNewPassword(e.target.value)} className={inputClass} placeholder="Min. 6 characters" required />
                    </div>
                    <div>
                      <label className={labelClass}>Confirm New Password</label>
                      <input type="password" value={forcedConfirmPassword} onChange={e => setForcedConfirmPassword(e.target.value)} className={inputClass} placeholder="Repeat new password" required />
                    </div>
                    <div className="pt-2">
                      <button type="submit" disabled={isUpdatingForcedPassword} className="w-full px-4 py-2.5 sm:py-2 bg-primary text-white text-sm font-medium rounded hover:bg-primaryHover transition-colors shadow-sm disabled:opacity-50">
                        {isUpdatingForcedPassword ? 'Updating...' : 'Set Password & Enter Workspace'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {isProfileModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6">
                 <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-xl w-full max-w-md flex flex-col animate-in fade-in max-h-[95vh]">
                  <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-borderLight dark:border-borderDark flex items-center justify-between shrink-0">
                    <h3 className="text-base font-semibold text-textLight dark:text-textDark">Update Account</h3>
                    <button onClick={() => setIsProfileModalOpen(false)} className="text-mutedLight dark:text-mutedDark hover:text-textLight dark:hover:text-textDark p-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                  </div>

                  <div className="p-4 sm:p-5 overflow-y-auto">
                    {profileStatus.message && (
                      <div className={`mb-4 px-3 py-2 text-xs sm:text-sm rounded ${profileStatus.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-900/30' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-900/30'}`}>
                        {profileStatus.message}
                      </div>
                    )}
                    <form id="profileForm" onSubmit={handleProfileUpdate} className="space-y-4">
                      <div>
                        <label className={labelClass}>Email Address</label>
                        <input type="email" value={userProfile?.email || ''} readOnly disabled className={readOnlyInputClass} />
                        <p className="text-[10px] sm:text-[11px] text-mutedLight dark:text-mutedDark mt-1">Email cannot be changed.</p>
                      </div>
                      <div>
                        <label className={labelClass}>Display Name</label>
                        <input 
                          type="text" 
                          name="displayName"
                          value={profileData.displayName} 
                          onChange={handleProfileChange} 
                          className={isOwner ? inputClass : readOnlyInputClass} 
                          placeholder="e.g., John Doe"
                          readOnly={!isOwner}
                          disabled={!isOwner}
                        />
                        {!isOwner && <p className="text-[10px] sm:text-[11px] text-mutedLight dark:text-mutedDark mt-1">Only administrators can change display names.</p>}
                      </div>
                      <div>
                        <label className={labelClass}>Profile Photo URL <span className="text-mutedLight dark:text-mutedDark font-normal text-xs">(Optional)</span></label>
                        <input 
                          type="url" 
                          name="photoURL"
                          value={profileData.photoURL} 
                          onChange={handleProfileChange} 
                          className={isOwner ? inputClass : readOnlyInputClass} 
                          placeholder="https://example.com/photo.jpg"
                          readOnly={!isOwner}
                          disabled={!isOwner}
                        />
                        {!isOwner && <p className="text-[10px] sm:text-[11px] text-mutedLight dark:text-mutedDark mt-1">Only administrators can change profile photos.</p>}
                      </div>
                      <div className="pt-2 border-t border-borderLight dark:border-borderDark mt-2">
                        <label className={labelClass}>New Password <span className="text-mutedLight dark:text-mutedDark font-normal text-[10px] sm:text-xs">(Leave blank to keep current)</span></label>
                        <input type="password" name="password" value={profileData.password} onChange={handleProfileChange} className={inputClass} placeholder="••••••••" minLength="6"/>
                      </div>
                    </form>
                  </div>

                  <div className="px-4 sm:px-5 py-3 border-t border-borderLight dark:border-borderDark bg-pageLight/50 dark:bg-pageDark/50 flex justify-end gap-3 rounded-b-md shrink-0">
                    <button type="button" onClick={() => setIsProfileModalOpen(false)} className="px-3 py-1.5 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-sm font-medium rounded hover:bg-pageLight dark:hover:bg-pageDark transition-colors shadow-sm">Cancel</button>
                    <button type="submit" form="profileForm" disabled={isSavingProfile} className="px-4 sm:px-3 py-1.5 bg-primary text-white text-sm font-medium rounded hover:bg-primaryHover transition-colors shadow-sm disabled:opacity-50">{isSavingProfile ? 'Saving...' : 'Save Changes'}</button>
                  </div>
                </div>
              </div>
            )}
          </DataProvider>
        )}
      </BrowserRouter>
    </ToastProvider>
  );
}