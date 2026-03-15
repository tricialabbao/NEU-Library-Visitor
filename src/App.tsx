import React, { useState, useEffect, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  serverTimestamp,
  updateDoc,
  Timestamp,
  getDocs,
  getDocFromServer,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { 
  LogOut, 
  Library, 
  User as UserIcon, 
  ShieldCheck, 
  BarChart3, 
  Search, 
  Filter, 
  Ban, 
  CheckCircle2, 
  Clock,
  Users,
  Calendar,
  ChevronRight,
  AlertCircle,
  Download,
  Maximize,
  X,
  Camera,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { format, startOfDay, endOfDay, subDays, isWithinInterval, startOfWeek, startOfMonth } from 'date-fns';
import { auth, db } from './firebase';
import { COLLEGES, REASONS, UserProfile, VisitorLog, UserRole } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NEU_LOGO = "https://lh3.googleusercontent.com/d/1-OgYjR5nlcREgMRKNUSk1kugK4quk9Ko";
const BG_IMAGE = "https://lh3.googleusercontent.com/d/1-TI8ZC44tYbIWPiODuX6WyvviYOdP7Rq";
// --- Components ---

const LoadingScreen = () => (
  <div 
    className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
    style={{ 
      backgroundImage: `linear-gradient(rgba(245, 245, 240, 0.9), rgba(245, 245, 240, 0.9)), url(${BG_IMAGE})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}
  >
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      className="mb-4"
    >
      <img src={NEU_LOGO} alt="NEU Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
    </motion.div>
    <p className="text-[#5A5A40] font-serif italic">Loading NEU Library System...</p>
  </div>
);

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || '',
      email: auth.currentUser?.email || '',
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || '',
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName || '',
        email: provider.email || '',
        photoUrl: provider.photoURL || ''
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Not throwing to prevent app crash, UI should handle state if needed
}

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setErrorInfo(event.message);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-red-100">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{errorInfo || "An unexpected error occurred."}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-red-500 text-white py-3 rounded-xl font-medium hover:bg-red-600 transition-colors"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  
  // Auth Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
          setFirebaseError("Firestore is offline. This usually means the database configuration is incorrect or the database hasn't been provisioned yet.");
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setProfile({ uid: firebaseUser.uid, ...userDoc.data() } as UserProfile);
          } else {
            setProfile(null);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      // Check if profile exists, if not create it (Google Login acts as registration too)
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!userDoc.exists()) {
        const email = firebaseUser.email || '';
        let role: UserRole = 'student';
        
        if (email.includes('.admin.') || email.startsWith('admin.')) {
          role = 'admin';
        } else if (email.includes('.faculty.') || email.startsWith('faculty.')) {
          role = 'faculty';
        }
        
        const isOwner = email === "tricia.labbao@neu.edu.ph";
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: email,
          displayName: firebaseUser.displayName || '',
          role: role,
          isBlocked: false,
          isApproved: role === 'student' || isOwner,
          needsRoleSelection: true,
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
        setProfile(newProfile);
      }
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/unauthorized-domain') {
        setAuthError("This domain is not authorized in your Firebase Console. Please add it to the 'Authorized Domains' list in Auth Settings.");
      } else {
        setAuthError(error.message || "Google Login failed");
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (!userDoc.exists()) {
        await auth.signOut();
        setAuthError("Account does not exist. Please use Google Login to register.");
        setIsSubmittingAuth(false);
        return;
      }
    } catch (error: any) {
      console.error("Auth error", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
        setAuthError("Invalid email or password.");
      } else {
        setAuthError(error.message || "Authentication failed");
      }
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading || !isAuthReady) return <LoadingScreen />;

  if (firebaseError) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-red-100">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">Database Connection Error</h2>
          <p className="text-gray-600 mb-6">{firebaseError}</p>
          <div className="bg-gray-50 p-4 rounded-xl text-xs text-gray-500 mb-6 font-mono break-all">
            Check firebase-applet-config.json and ensure Firestore is provisioned.
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-[#5A5A40] text-white py-3 rounded-xl font-medium hover:opacity-90 transition-all"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (user && !profile) return <LoadingScreen />;

  if (!user) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{ 
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${BG_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 md:p-10 rounded-[32px] shadow-2xl max-w-md w-full border border-white"
        >
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-[#5A5A40]/10 rounded-full flex items-center justify-center p-4">
              <img src={NEU_LOGO} alt="NEU Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
          </div>
          
          <h1 className="text-3xl font-serif font-bold text-gray-900 text-center mb-2">NEU Library</h1>
          <p className="text-gray-500 text-center mb-8 text-sm">
            Sign in to your account
          </p>

          <form onSubmit={handleEmailAuth} className="space-y-4">

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-[#5A5A40] focus:bg-white transition-all outline-none"
                placeholder="email@neu.edu.ph"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-[#5A5A40] focus:bg-white transition-all outline-none"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <div className="text-xs text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 space-y-2">
                <p>{authError}</p>
                {(authError.includes("domain is not authorized") || authError.includes("authorized in your Firebase Console")) && (
                  <div className="pt-2 border-t border-red-100">
                    <p className="font-bold text-[10px] uppercase mb-1">Domain to authorize:</p>
                    <code className="block bg-white p-2 rounded border border-red-200 break-all select-all">
                      {window.location.hostname}
                    </code>
                    <p className="mt-1 text-[9px] opacity-70 italic">Copy this and add it to Authentication &gt; Settings &gt; Authorized Domains in Firebase Console.</p>
                  </div>
                )}
              </div>
            )}

            <button 
              type="submit"
              disabled={isSubmittingAuth}
              className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmittingAuth ? 'Processing...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[10px] font-bold text-gray-300 uppercase">OR</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full mt-6 bg-white border-2 border-gray-100 text-gray-600 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-gray-50 transition-all"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Continue with Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (profile?.isBlocked) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{ 
          backgroundImage: `linear-gradient(rgba(254, 242, 242, 0.9), rgba(254, 242, 242, 0.9)), url(${BG_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-red-100">
          <Ban className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">Your account has been blocked from entering the library. Please contact the administrator for more information.</p>
          <button 
            onClick={handleLogout}
            className="text-[#5A5A40] font-medium hover:underline flex items-center justify-center gap-2 mx-auto"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (profile && !profile.isApproved && profile.role !== 'student') {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{ 
          backgroundImage: `linear-gradient(rgba(245, 245, 240, 0.9), rgba(245, 245, 240, 0.9)), url(${BG_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100">
          <Clock className="w-16 h-16 text-[#5A5A40] mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">Approval Pending</h2>
          <p className="text-gray-600 mb-6">
            Your request to join as <strong>{profile.role}</strong> is currently pending approval from the system administrator. 
            Please wait for verification.
          </p>
          <button 
            onClick={handleLogout}
            className="text-[#5A5A40] font-medium hover:underline flex items-center justify-center gap-2 mx-auto"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div 
        className="min-h-screen font-sans text-gray-900 relative"
        style={{ 
          backgroundImage: `linear-gradient(rgba(245, 245, 240, 0.92), rgba(245, 245, 240, 0.92)), url(${BG_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={NEU_LOGO} alt="NEU Logo" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
            <span className="font-serif font-bold text-xl tracking-tight hidden sm:block">NEU Library</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-gray-900 leading-none">{profile?.displayName}</p>
              <p className="text-xs text-gray-500">{profile?.email}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-6">
          {profile?.role === 'admin' ? (
            <AdminDashboard profile={profile} />
          ) : (
            <UserDashboard profile={profile} setProfile={setProfile} />
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}

// --- User Dashboard (Visitor Check-In) ---

function UserDashboard({ profile, setProfile }: { profile: UserProfile, setProfile: (p: UserProfile) => void }) {
  const initialStep = profile.needsRoleSelection ? 'role' : (profile.college ? 'reason' : 'college');
  const [step, setStep] = useState<'role' | 'college' | 'reason' | 'welcome'>(initialStep);
  const [selectedRole, setSelectedRole] = useState<UserRole>(profile.role || 'student');
  const [selectedCollege, setSelectedCollege] = useState(profile.college || '');
  const [selectedReason, setSelectedReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userLogs, setUserLogs] = useState<VisitorLog[]>([]);
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    // Removed orderBy to bypass the need for a composite index
    const q = query(
      collection(db, 'logs'), 
      where('userId', '==', profile.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Sort in-memory instead of database-side
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VisitorLog));
      logs.sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeB - timeA;
      });
      setUserLogs(logs);
      setLogError(null);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'logs');
      if (error instanceof Error && error.message.toLowerCase().includes('index')) {
        setLogError("Database index is currently building. Your history will appear shortly.");
      }
    });
    return () => unsubscribe();
  }, [profile.uid]);

  const handleSaveRole = async () => {
    setIsSubmitting(true);
    const isOwner = profile.email === "tricia.labbao@neu.edu.ph";
    const isApproved = selectedRole === 'student' || isOwner;
    try {
      await updateDoc(doc(db, 'users', profile.uid), { 
        role: selectedRole,
        isApproved: isApproved,
        needsRoleSelection: false 
      });
      setProfile({ ...profile, role: selectedRole, isApproved: isApproved, needsRoleSelection: false });
      setStep(profile.college ? 'reason' : 'college');
    } catch (error) {
      console.error("Failed to save role", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCollege = async () => {
    if (!selectedCollege) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), { college: selectedCollege });
      setProfile({ ...profile, college: selectedCollege });
      setStep('reason');
    } catch (error) {
      console.error("Failed to save college", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedReason) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'logs'), {
        userId: profile.uid,
        userEmail: profile.email,
        userName: profile.displayName,
        college: profile.college || selectedCollege,
        reason: selectedReason,
        timestamp: serverTimestamp()
      });
      setStep('welcome');
    } catch (error) {
      console.error("Check-in failed", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Check-in Form */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {step === 'role' && (
              <motion.div 
                key="role"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white p-10 rounded-[32px] shadow-xl border border-white"
              >
                <div className="w-20 h-20 bg-[#5A5A40]/10 rounded-2xl flex items-center justify-center mb-6 p-4">
                  <img src={NEU_LOGO} alt="NEU Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                </div>
                <h2 className="text-3xl font-serif font-bold mb-2">Identify Your Sector</h2>
                <p className="text-gray-500 mb-8">Please select which sector you belong to in the NEU community.</p>
                
                <div className="grid grid-cols-1 gap-4">
                  {(['student', 'faculty', 'admin'] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className={cn(
                        "p-6 rounded-2xl border-2 text-left transition-all flex items-center justify-between group",
                        selectedRole === role 
                          ? "border-[#5A5A40] bg-[#5A5A40]/5 text-[#5A5A40]" 
                          : "border-gray-100 hover:border-gray-200 text-gray-600"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                          selectedRole === role ? "bg-[#5A5A40] text-white" : "bg-gray-100 text-gray-400"
                        )}>
                          {role === 'student' && <Users className="w-6 h-6" />}
                          {role === 'faculty' && <ShieldCheck className="w-6 h-6" />}
                          {role === 'admin' && <BarChart3 className="w-6 h-6" />}
                        </div>
                        <div>
                          <span className="font-bold text-lg capitalize">{role}</span>
                          <p className="text-xs opacity-70">
                            {role === 'student' && 'Access library resources and study areas'}
                            {role === 'faculty' && 'Manage research materials and academic tools'}
                            {role === 'admin' && 'System administration and monitoring'}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedRole === role ? "border-[#5A5A40] bg-[#5A5A40]" : "border-gray-200"
                      )}>
                        {selectedRole === role && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  ))}
                </div>

                <button 
                  onClick={handleSaveRole}
                  disabled={isSubmitting}
                  className="w-full mt-10 bg-[#5A5A40] text-white py-4 rounded-full font-medium text-lg hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                >
                  {isSubmitting ? "Saving..." : "Continue"} <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {step === 'college' && (
              <motion.div 
                key="college"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white p-10 rounded-[32px] shadow-xl border border-white"
              >
                <div className="w-20 h-20 bg-[#5A5A40]/10 rounded-2xl flex items-center justify-center mb-6 p-4">
                  <img src={NEU_LOGO} alt="NEU Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                </div>
                <h2 className="text-3xl font-serif font-bold mb-2">First Time Visit?</h2>
                <p className="text-gray-500 mb-8">Please specify the college or office you belong to. You only need to do this once.</p>
                
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Select College/Office</label>
                  <select 
                    value={selectedCollege}
                    onChange={(e) => setSelectedCollege(e.target.value)}
                    className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-[#5A5A40] focus:outline-none transition-all text-lg appearance-none bg-no-repeat bg-[right_1rem_center]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%235A5A40' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundSize: '1.5em' }}
                  >
                    <option value="">Choose your College...</option>
                    {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <button 
                  onClick={handleSaveCollege}
                  disabled={!selectedCollege || isSubmitting}
                  className="w-full mt-10 bg-[#5A5A40] text-white py-4 rounded-full font-medium text-lg hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? "Saving..." : "Continue"} <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {step === 'reason' && (
              <motion.div 
                key="reason"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white p-10 rounded-[32px] shadow-xl border border-white"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-serif font-bold text-gray-900">Library Check-in</h2>
                    <p className="text-gray-500">Welcome back, {profile.displayName.split(' ')[0]}!</p>
                  </div>
                  <div className="bg-[#5A5A40]/10 px-4 py-2 rounded-xl flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#5A5A40]" />
                    <span className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest">{profile.college}</span>
                  </div>
                </div>
                
                <p className="text-gray-500 mb-6 font-medium">What is your primary reason for visiting today?</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {REASONS.map(reason => (
                    <button
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={cn(
                        "p-6 rounded-2xl border-2 text-left transition-all flex items-center justify-between group",
                        selectedReason === reason 
                          ? "border-[#5A5A40] bg-[#5A5A40]/5 text-[#5A5A40]" 
                          : "border-gray-100 hover:border-gray-200 text-gray-600"
                      )}
                    >
                      <span className="font-medium">{reason}</span>
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedReason === reason ? "border-[#5A5A40] bg-[#5A5A40]" : "border-gray-200"
                      )}>
                        {selectedReason === reason && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  ))}
                </div>

                <button 
                  onClick={handleCheckIn}
                  disabled={!selectedReason || isSubmitting}
                  className="w-full mt-10 bg-[#5A5A40] text-white py-4 rounded-full font-medium text-lg hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                >
                  {isSubmitting ? "Checking in..." : "Confirm Entry"}
                </button>
              </motion.div>
            )}

            {step === 'welcome' && (
              <motion.div 
                key="welcome"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-12 rounded-[32px] shadow-2xl border border-white text-center"
              >
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8"
                >
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                </motion.div>
                <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">Welcome to NEU Library!</h2>
                <p className="text-gray-600 text-lg mb-10 leading-relaxed">
                  Your visit has been successfully recorded. <br />
                  Thank you for using the NEU Library Visitor Log system.
                </p>
                <button 
                  onClick={() => setStep('reason')}
                  className="bg-gray-100 text-gray-600 px-8 py-3 rounded-full font-medium hover:bg-gray-200 transition-all"
                >
                  New Check-in
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: History & Stats */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
            <h3 className="text-xl font-serif font-bold mb-6">Your Visit History</h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {logError ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 text-sm italic">
                  {logError}
                </div>
              ) : userLogs.length > 0 ? (
                userLogs.map((log, i) => (
                  <motion.div 
                    key={log.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-900">{log.reason}</p>
                      <div className="flex items-center gap-1.5 text-gray-400 mt-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium">
                          {log.timestamp ? format(log.timestamp.toDate(), 'MMM d, h:mm a') : '...'}
                        </span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 italic text-sm">No history yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#5A5A40] p-8 rounded-[32px] shadow-xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Total Visits</p>
              <h4 className="text-5xl font-serif font-bold">{userLogs.length}</h4>
              <p className="text-sm mt-4 opacity-80">Keep it up! The library is a great place for learning.</p>
            </div>
            <Library className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Admin Dashboard Component ---

function AdminDashboard({ profile }: { profile: UserProfile }) {
  const [logs, setLogs] = useState<VisitorLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState<'today' | 'weekly' | 'monthly' | 'custom'>('today');
  const [customRange, setCustomRange] = useState({ start: format(subDays(new Date(), 7), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') });
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'approvals'>('overview');

  const handleApproveUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isApproved: true });
    } catch (error) {
      console.error("Failed to approve user", error);
    }
  };

  const handleRejectUser = async (userId: string) => {
    try {
      // If rejected, we reset them to student role and ask them to select role again
      // This allows them to continue as a student if they were just mistaken
      await updateDoc(doc(db, 'users', userId), { 
        isApproved: true, // Students are auto-approved
        role: 'student',
        needsRoleSelection: true 
      });
    } catch (error) {
      console.error("Failed to reject user", error);
    }
  };

  useEffect(() => {
    const qLogs = query(collection(db, 'logs'), orderBy('timestamp', 'desc'));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VisitorLog));
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'logs');
    });

    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    return () => {
      unsubscribeLogs();
      unsubscribeUsers();
    };
  }, []);

  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Period Filter
    const now = new Date();
    if (period === 'today') {
      const start = startOfDay(now);
      const end = endOfDay(now);
      filtered = filtered.filter(log => {
        const date = log.timestamp?.toDate();
        return date && isWithinInterval(date, { start, end });
      });
    } else if (period === 'weekly') {
      const start = startOfWeek(now);
      const end = endOfDay(now);
      filtered = filtered.filter(log => {
        const date = log.timestamp?.toDate();
        return date && isWithinInterval(date, { start, end });
      });
    } else if (period === 'monthly') {
      const start = startOfMonth(now);
      const end = endOfDay(now);
      filtered = filtered.filter(log => {
        const date = log.timestamp?.toDate();
        return date && isWithinInterval(date, { start, end });
      });
    } else if (period === 'custom') {
      const start = startOfDay(new Date(customRange.start));
      const end = endOfDay(new Date(customRange.end));
      filtered = filtered.filter(log => {
        const date = log.timestamp?.toDate();
        return date && isWithinInterval(date, { start, end });
      });
    }

    // Search Filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.userName?.toLowerCase().includes(lowerSearch) || 
        log.userEmail?.toLowerCase().includes(lowerSearch) ||
        log.college?.toLowerCase().includes(lowerSearch)
      );
    }

    return filtered;
  }, [logs, period, customRange, searchTerm]);

  const periodStats = useMemo(() => {
    const uniqueUserIds = new Set(filteredLogs.map(log => log.userId));
    
    const collegeCounts: Record<string, number> = {};
    filteredLogs.forEach(log => {
      collegeCounts[log.college] = (collegeCounts[log.college] || 0) + 1;
    });

    const collegeData = Object.entries(collegeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      uniqueUsers: uniqueUserIds.size,
      collegeData,
      totalLogs: filteredLogs.length
    };
  }, [filteredLogs]);

  const stats = useMemo(() => {
    const reasonCounts: Record<string, number> = {};
    
    filteredLogs.forEach(log => {
      reasonCounts[log.reason] = (reasonCounts[log.reason] || 0) + 1;
    });

    const reasonData = Object.entries(reasonCounts).map(([name, value]) => ({ name, value }));

    return { reasonData, total: filteredLogs.length };
  }, [filteredLogs]);

  const handleBlockUser = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isBlocked: !currentStatus });
    } catch (error) {
      console.error("Failed to toggle block status", error);
    }
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ["Visitor Name", "Email", "College", "Reason", "Timestamp"];
    const csvRows = [
      headers.join(","),
      ...filteredLogs.map(log => {
        const date = log.timestamp ? format(log.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss') : '';
        return [
          `"${log.userName}"`,
          `"${log.userEmail}"`,
          `"${log.college}"`,
          `"${log.reason}"`,
          `"${date}"`
        ].join(",");
      })
    ];

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `library_logs_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearLogs = async () => {
    setIsClearing(true);
    try {
      const logsSnapshot = await getDocs(collection(db, 'logs'));
      const docs = logsSnapshot.docs;
      
      // Delete in batches of 500 (Firestore limit)
      for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 500);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      
      setShowClearConfirm(false);
    } catch (error) {
      console.error("Failed to clear logs", error);
      handleFirestoreError(error, OperationType.DELETE, 'logs');
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><LoadingScreen /></div>;

  return (
    <div className="space-y-8">
      {/* Header Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-serif font-bold text-gray-900">Admin Dashboard</h2>
          <p className="text-gray-500">Manage library visitors, users, and approvals.</p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 self-start">
          {(['overview', 'logs', 'users', 'approvals'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all",
                activeTab === tab 
                  ? "bg-[#5A5A40] text-white shadow-md" 
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              )}
            >
              {tab}
              {tab === 'approvals' && users.filter(u => !u.isApproved && u.role !== 'student').length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {users.filter(u => !u.isApproved && u.role !== 'student').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Stats & Logs */}
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <StatCard 
                title="Total Visitors" 
                value={periodStats.totalLogs} 
                icon={<Users className="w-6 h-6" />} 
                color="bg-blue-500" 
                subtitle={`Total entries for ${period}`}
              />
              <StatCard 
                title="Unique Users" 
                value={periodStats.uniqueUsers} 
                icon={<UserIcon className="w-6 h-6" />} 
                color="bg-emerald-500" 
                subtitle={`Unique visitors for ${period}`}
              />
              <StatCard 
                title="Blocked Users" 
                value={users.filter(u => u.isBlocked).length} 
                icon={<Ban className="w-6 h-6" />} 
                color="bg-red-500" 
                subtitle="Access restricted"
              />
              <StatCard 
                title="Peak College" 
                value={periodStats.collegeData[0]?.name || "N/A"} 
                icon={<Library className="w-6 h-6" />} 
                color="bg-amber-500" 
                subtitle="Most frequent visitors"
                isText
              />
            </div>

            {/* Period Detailed Stats */}
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-gray-900">Visitor Breakdown</h3>
                  <p className="text-gray-500">Detailed statistics for the selected period ({period})</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {periodStats.collegeData.length > 0 ? (
                  periodStats.collegeData.slice(0, 6).map((item, index) => (
                    <div 
                      key={item.name}
                      className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#5A5A40] font-bold shadow-sm">
                          {index + 1}
                        </div>
                        <span className="text-sm font-medium text-gray-700 truncate max-w-[150px]">{item.name}</span>
                      </div>
                      <span className="text-lg font-serif font-bold text-gray-900">{item.value}</span>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-gray-400 italic">No visitors recorded yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Logs Preview */}
            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-serif font-bold">Recent Activity</h3>
                <button onClick={() => setActiveTab('overview')} className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest hover:underline">View All</button>
              </div>
              <div className="divide-y divide-gray-100">
                {filteredLogs.slice(0, 5).map(log => (
                  <div key={log.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                        {log.userName?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{log.userName}</p>
                        <p className="text-xs text-gray-500">{log.college} • {log.reason}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      {log.timestamp ? format(log.timestamp.toDate(), 'h:mm a') : '...'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
              <h3 className="text-lg font-serif font-bold mb-6">Visit Reasons</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.reasonData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.reasonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#5A5A40', '#8E8E6D', '#C2C2A3', '#E6E6D4', '#F5F5F0'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {stats.reasonData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#5A5A40', '#8E8E6D', '#C2C2A3', '#E6E6D4', '#F5F5F0'][i % 5] }} />
                      <span className="text-gray-600">{item.name}</span>
                    </div>
                    <span className="font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Pending Actions */}
            {users.filter(u => !u.isApproved && u.role !== 'student').length > 0 && (
              <div className="bg-amber-50 p-6 rounded-[32px] border border-amber-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Pending Approvals</h4>
                    <p className="text-xs text-amber-700">{users.filter(u => !u.isApproved && u.role !== 'student').length} requests waiting</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('approvals')}
                  className="w-full py-3 rounded-xl bg-amber-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-amber-600 transition-all shadow-md shadow-amber-200"
                >
                  Review Requests
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by name, email, or college..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-[#5A5A40] focus:ring-0 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              {(['today', 'weekly', 'monthly', 'custom'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                    period === p ? "bg-[#5A5A40] text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {period === 'custom' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex gap-4 items-end"
            >
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Start Date</label>
                <input 
                  type="date" 
                  value={customRange.start}
                  onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                  className="w-full p-3 rounded-xl bg-gray-50 border-gray-100 focus:border-[#5A5A40] focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">End Date</label>
                <input 
                  type="date" 
                  value={customRange.end}
                  onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                  className="w-full p-3 rounded-xl bg-gray-50 border-gray-100 focus:border-[#5A5A40] focus:outline-none"
                />
              </div>
            </motion.div>
          )}

          <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-serif font-bold">Visitor Logs</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleExportCSV}
                    disabled={filteredLogs.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5A5A40]/10 text-[#5A5A40] text-xs font-bold uppercase tracking-widest hover:bg-[#5A5A40] hover:text-white transition-all disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                  <button 
                    onClick={() => setShowClearConfirm(true)}
                    disabled={filteredLogs.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear All
                  </button>
                </div>
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{filteredLogs.length} Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Visitor</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">College</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Reason</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                            {log.userName?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{log.userName}</p>
                            <p className="text-xs text-gray-500">{log.userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{log.college}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                          {log.reason}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs">{log.timestamp ? format(log.timestamp.toDate(), 'MMM d, h:mm a') : '...'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No records found for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search users by name or email..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-[#5A5A40] focus:ring-0 transition-all"
              />
            </div>
          </div>

          <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">User</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Role</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Joined</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users
                    .filter(u => 
                      u.displayName.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                      u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
                    )
                    .map(u => (
                    <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                            {u.displayName?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{u.displayName}</p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                          u.role === 'admin' ? "bg-purple-100 text-purple-600" :
                          u.role === 'faculty' ? "bg-blue-100 text-blue-600" :
                          "bg-gray-100 text-gray-600"
                        )}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {!u.isApproved && u.role !== 'student' ? (
                            <span className="flex items-center gap-1.5 text-amber-600 text-xs font-bold">
                              <Clock className="w-3.5 h-3.5" /> Pending
                            </span>
                          ) : u.isBlocked ? (
                            <span className="flex items-center gap-1.5 text-red-600 text-xs font-bold">
                              <Ban className="w-3.5 h-3.5" /> Blocked
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-green-600 text-xs font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-400">
                          {u.createdAt ? format(u.createdAt.toDate(), 'MMM d, yyyy') : '...'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {u.email !== "tricia.labbao@neu.edu.ph" && (
                          <button
                            onClick={() => handleBlockUser(u.uid, u.isBlocked)}
                            className={cn(
                              "p-2 rounded-xl transition-all",
                              u.isBlocked ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            )}
                            title={u.isBlocked ? "Unblock User" : "Block User"}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
            <h3 className="text-2xl font-serif font-bold text-gray-900 mb-2">Pending Approvals</h3>
            <p className="text-gray-500 mb-8">Review and approve requests for Faculty and Admin access.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {users.filter(u => !u.isApproved && u.role !== 'student').length > 0 ? (
                users.filter(u => !u.isApproved && u.role !== 'student').map((u, index) => (
                  <motion.div 
                    key={u.uid}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gray-50 border border-gray-100 rounded-3xl p-6 flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-2xl shadow-sm">
                          {u.displayName?.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">{u.displayName}</h4>
                          <p className="text-sm text-gray-500">{u.email}</p>
                        </div>
                      </div>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                        u.role === 'admin' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                      )}>
                        {u.role}
                      </span>
                    </div>

                    <div className="space-y-3 mb-8">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">College</span>
                        <span className="font-medium text-gray-900">{u.college || 'Not specified'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Requested On</span>
                        <span className="font-medium text-gray-900">{u.createdAt ? format(u.createdAt.toDate(), 'MMM d, yyyy') : '...'}</span>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-auto">
                      <button 
                        onClick={() => handleRejectUser(u.uid)}
                        className="flex-1 py-3 rounded-2xl bg-white border border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-widest hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                      >
                        Reject
                      </button>
                      <button 
                        onClick={() => handleApproveUser(u.uid)}
                        className="flex-1 py-3 rounded-2xl bg-[#5A5A40] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/20"
                      >
                        Approve Access
                      </button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center bg-gray-50 rounded-[32px] border border-dashed border-gray-200">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-green-500 mx-auto mb-6 shadow-sm">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-serif font-bold text-gray-900 mb-2">All Caught Up!</h4>
                  <p className="text-gray-500">There are no pending approval requests at this time.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-[32px] shadow-2xl max-w-md w-full border border-gray-100"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-serif font-bold text-center text-gray-900 mb-2">Clear All Records?</h3>
              <p className="text-gray-500 text-center mb-8">
                This action will permanently delete all visitor logs. This cannot be undone.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  disabled={isClearing}
                  className="flex-1 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleClearLogs}
                  disabled={isClearing}
                  className="flex-1 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isClearing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Clearing...
                    </>
                  ) : 'Yes, Clear All'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, icon, color, subtitle, isText = false }: { title: string, value: string | number, icon: React.ReactNode, color: string, subtitle: string, isText?: boolean }) {
  return (
    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg", color)}>
          {icon}
        </div>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</span>
      </div>
      <div className="mt-auto">
        <h4 className={cn("font-serif font-bold text-gray-900 leading-tight", isText ? "text-xl" : "text-3xl")}>
          {value}
        </h4>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

