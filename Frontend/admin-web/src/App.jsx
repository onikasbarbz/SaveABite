import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Store, ClipboardCheck, 
  Check, X, Clock, Loader2, AlertCircle,
  LogOut, BarChart3, Gift, TrendingUp, Award, RefreshCw, RotateCcw,
  Users, List, Download, Ban, Trash2, ShieldOff, ShieldCheck, ChevronDown, Megaphone
} from 'lucide-react';

const API_BASE = "https://hanh-vaguer-gordon.ngrok-free.dev";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [currentPage, setCurrentPage] = useState('analytics');
  const [adminName, setAdminName] = useState('');

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('adminToken');
    if (storedToken) {
      setToken(storedToken);
      setIsLoggedIn(true);
      const storedName = localStorage.getItem('adminName');
      if (storedName) setAdminName(storedName);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminName');
    setToken(null);
    setIsLoggedIn(false);
    setAdminName('');
  };

  if (!isLoggedIn) {
    return <LoginPage setIsLoggedIn={setIsLoggedIn} setToken={setToken} setAdminName={setAdminName} />;
  }

  return (
    <div className="flex h-screen bg-[#F3F4F6] font-sans text-slate-900">
      {/* SIDEBAR */}
      <aside className="w-72 bg-[#244F42] text-white flex flex-col shadow-2xl">
        <div className="p-10 flex items-center gap-3">
          <img src="/logo.png" alt="SaveABite logo" className="w-10 h-10 rounded-xl object-cover shadow-lg" />
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">SAVEABITE</h1>
            <span className="text-[10px] text-[#F5A623] font-bold uppercase tracking-widest">Admin</span>
          </div>
        </div>

        <nav className="flex-1 px-6 space-y-3">
          <NavButton 
            icon={<BarChart3 size={20} />}
            label="Analytics"
            isActive={currentPage === 'analytics'}
            onClick={() => setCurrentPage('analytics')}
          />
          <NavButton 
            icon={<ClipboardCheck size={20} />}
            label="NGO Requests"
            isActive={currentPage === 'ngo-requests'}
            onClick={() => setCurrentPage('ngo-requests')}
          />
          <NavButton 
            icon={<BarChart3 size={20} />}
            label="Impact Stats"
            isActive={currentPage === 'impact-stats'}
            onClick={() => setCurrentPage('impact-stats')}
          />
          <NavButton 
            icon={<Gift size={20} />}
            label="Donations"
            isActive={currentPage === 'donations'}
            onClick={() => setCurrentPage('donations')}
          />
          <NavButton 
            icon={<TrendingUp size={20} />}
            label="Dashboard"
            isActive={currentPage === 'dashboard'}
            onClick={() => setCurrentPage('dashboard')}
          />
          <NavButton 
            icon={<Award size={20} />}
            label="Certificates"
            isActive={currentPage === 'certificates'}
            onClick={() => setCurrentPage('certificates')}
          />
          <NavButton 
            icon={<Users size={20} />}
            label="User Management"
            isActive={currentPage === 'users'}
            onClick={() => setCurrentPage('users')}
          />
          <NavButton 
            icon={<List size={20} />}
            label="Listings"
            isActive={currentPage === 'listings'}
            onClick={() => setCurrentPage('listings')}
          />
          <NavButton 
            icon={<Megaphone size={20} />}
            label="Advertisements"
            isActive={currentPage === 'advertisements'}
            onClick={() => setCurrentPage('advertisements')}
          />
        </nav>

        <div className="px-6 pb-6 border-t border-white/20 pt-6">
          <div className="bg-white/10 rounded-2xl p-4 mb-4">
            <p className="text-xs text-white/60 uppercase tracking-widest font-bold">Logged in as</p>
            <p className="font-bold text-white mt-1">{adminName}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-xl font-bold text-sm transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentPage === 'ngo-requests' && <NGORequestsPage token={token} />}
        {currentPage === 'impact-stats' && <ImpactStatsPage token={token} />}
        {currentPage === 'donations' && <DonationsPage token={token} />}
        {currentPage === 'dashboard' && <DashboardPage token={token} />}
        {currentPage === 'certificates' && <CertificatesPage token={token} />}
        {currentPage === 'users' && <UserManagementPage token={token} />}
        {currentPage === 'listings' && <ListingsManagementPage token={token} />}
        {currentPage === 'analytics' && <AnalyticsPage token={token} />}
        {currentPage === 'advertisements' && <AdvertisementsPage token={token} />}
      </main>
    </div>
  );
}

function NavButton({ icon, label, isActive, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${
        isActive 
          ? 'bg-[#F5A623] text-[#244F42] shadow-xl shadow-[#F5A623]/20' 
          : 'text-white/80 hover:text-white hover:bg-white/10'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ==========================================
// LOGIN PAGE
// ==========================================
function LoginPage({ setIsLoggedIn, setToken, setAdminName }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (data.success && data.token) {
        // Check if user is admin
        if (data.user.role !== 'admin') {
          setError('Only admin users can access this panel');
          return;
        }
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminName', data.user.full_name);
        setToken(data.token);
        setAdminName(data.user.full_name);
        setIsLoggedIn(true);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Connection error. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#244F42] to-[#1a3a34]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-12">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-[#F5A623] rounded-2xl flex items-center justify-center">
              <Store className="text-[#244F42]" size={32} />
            </div>
          </div>

          <h1 className="text-3xl font-black text-center text-slate-900 mb-2">SaveABite</h1>
          <p className="text-center text-slate-500 text-sm font-bold mb-8 uppercase tracking-widest">Admin Panel</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Email</label>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@saveabite.com"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#244F42] focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Password</label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#244F42] focus:border-transparent"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-3 bg-[#244F42] hover:bg-[#1a3a34] text-white font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-xs mt-6">
            Demo: <span className="font-bold">admin@saveabite.com</span> / <span className="font-bold">admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// NGO REQUESTS PAGE
// ==========================================
function NGORequestsPage({ token }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [expandedRow, setExpandedRow] = useState(null);

  // Rejection Modal States
  const [rejectModal, setRejectModal] = useState({ isOpen: false, appId: null });
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const url = activeTab === 'pending'
        ? `${API_BASE}/api/ngo/admin/pending`
        : `${API_BASE}/api/ngo/admin/pending?status=${activeTab}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "ngrok-skip-browser-warning": "69420"
        }
      });

      const data = await res.json();
      if (data.success) {
        setApps(data.data);
      } else {
        setError(data.message || "Failed to fetch requests");
      }
    } catch (e) {
      console.error("Fetch Error:", e);
      setError("Server connection failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

  const handleAction = async (regId, status, reason = "") => {
    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_BASE}/api/ngo/verify/${regId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${token}`,
          "ngrok-skip-browser-warning": "69420" 
        },
        body: JSON.stringify({ status, reason })
      });
      
      const result = await res.json();
      
      if (result.success) {
        setApps(prev => prev.filter(app => app.id !== regId));
        if (status === 'rejected') {
          setRejectModal({ isOpen: false, appId: null });
          setRejectionReason("");
        }
      } else {
        alert("Update failed: " + result.message);
      }
    } catch (e) {
      alert("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRejectModal = (appId) => {
    setRejectModal({ isOpen: true, appId });
    setRejectionReason("");
  };

  return (
    <>
      <header className="h-24 bg-white/80 backdrop-blur-md border-b px-12 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">NGO Registration Requests</h2>
          <p className="text-xs text-slate-400 font-medium">Review and verify pending organizations.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            {['pending', 'verified', 'rejected'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-widest ${
                  activeTab === tab 
                    ? 'bg-white text-[#244F42] shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button 
            onClick={fetchRequests} 
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-12">
        {loading ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-[2rem] shadow-sm">
            <Loader2 className="animate-spin text-[#244F42] mb-4" size={40} />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-8 rounded-3xl border border-red-100 flex items-center gap-4">
            <AlertCircle size={24} />
            <p className="font-bold">{error}</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-6 w-72">
              <div className={`p-4 rounded-2xl ${
                activeTab === 'pending' ? 'bg-blue-50 text-blue-500' : 
                activeTab === 'verified' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'
              }`}>
                {activeTab === 'pending' ? <Clock size={24}/> : (activeTab === 'verified' ? <Check size={24}/> : <X size={24}/>)}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{activeTab} Review</p>
                <h3 className="text-3xl font-black text-slate-800">{apps.length}</h3>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Organization</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Reg No.</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contact</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Submitted</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {apps.map((app) => {
                    const isExpanded = expandedRow === app.id;
                    const docUrl = app.document_image || app.users?.identity_document;
                    return (
                      <React.Fragment key={app.id}>
                        {/* ── Main row ── */}
                        <tr
                          className="group hover:bg-slate-50/80 transition-all cursor-pointer"
                          onClick={() => setExpandedRow(isExpanded ? null : app.id)}
                        >
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <ChevronDown
                                size={16}
                                className={`text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              />
                              <div>
                                <p className="font-bold text-slate-800">{app.name}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{app.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className="font-mono text-sm font-bold text-[#244F42] bg-[#244F42]/8 px-2.5 py-1 rounded-lg">
                              {app.reg_number || <span className="text-slate-300 font-normal italic">—</span>}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <p className="text-sm font-semibold text-slate-700">{app.contact_person || '—'}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{app.phone || '—'}</p>
                          </td>
                          <td className="px-8 py-5 text-xs text-slate-400 font-medium">
                            {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-8 py-5 text-right" onClick={e => e.stopPropagation()}>
                            {activeTab === 'pending' ? (
                              <div className="flex justify-end gap-3">
                                <button
                                  onClick={() => handleAction(app.id, 'verified')}
                                  className="w-10 h-10 flex items-center justify-center bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all active:scale-95"
                                  title="Approve"
                                >
                                  <Check size={18}/>
                                </button>
                                <button
                                  onClick={() => openRejectModal(app.id)}
                                  className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all active:scale-95"
                                  title="Reject"
                                >
                                  <X size={18}/>
                                </button>
                              </div>
                            ) : (
                              <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                                activeTab === 'verified' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                              }`}>
                                {activeTab}
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* ── Expanded detail row ── */}
                        {isExpanded && (
                          <tr className="bg-slate-50/60">
                            <td colSpan={5} className="px-8 py-6">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                                {/* Left: all text fields */}
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Full Details</h4>

                                  <DetailField label="NGO Name" value={app.name} />
                                  <DetailField label="Registration Number" value={app.reg_number} mono />
                                  <DetailField label="Contact Person" value={app.contact_person} />
                                  <DetailField label="Phone Number" value={app.phone} />
                                  <DetailField label="Full Address" value={app.address} />
                                  <DetailField label="Email" value={app.email} />
                                  {app.description && (
                                    <div>
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Mission Description</p>
                                      <p className="text-sm text-slate-600 leading-relaxed bg-white rounded-xl p-3 border border-slate-100">
                                        {app.description}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Right: document preview */}
                                <div>
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Verification Document</h4>
                                  {docUrl ? (
                                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                      <SafeImage
                                        src={`${API_BASE}${docUrl}`}
                                        alt="NGO registration document"
                                        className="w-full"
                                        contain
                                      />
                                      <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
                                        <button
                                          onClick={() => setSelectedDoc(`${API_BASE}${docUrl}`)}
                                          className="flex items-center gap-2 px-4 py-2 bg-[#244F42] text-white rounded-xl text-xs font-bold hover:bg-[#1a3a34] transition-colors"
                                        >
                                          <LayoutDashboard size={13} />
                                          View Full Size
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="h-40 rounded-2xl bg-white border border-dashed border-slate-200 flex items-center justify-center">
                                      <p className="text-slate-300 text-xs font-bold italic">No document uploaded</p>
                                    </div>
                                  )}
                                </div>

                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              {apps.length === 0 && (
                <div className="p-20 text-center">
                  <p className="text-slate-300 font-black uppercase tracking-widest text-lg">No {activeTab} Requests</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* DOCUMENT MODAL */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-10">
          <div className="relative bg-white rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-white shrink-0">
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Registration Document</h3>
              <button 
                onClick={() => setSelectedDoc(null)}
                className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            {/* Scrollable image area — image keeps its natural aspect ratio */}
            <div className="flex-1 overflow-auto bg-slate-100 p-6 flex items-start justify-center">
              <SafeImage 
                src={selectedDoc} 
                alt="NGO Document"
                contain
              />
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Rejection Reason</h3>
            <p className="text-slate-500 text-sm font-medium mb-6">Please explain why this application is being rejected. This will be shown to the user in the app.</p>
            
            <textarea 
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Uploaded document is blurred or registration number is invalid..."
              className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none mb-6 font-medium text-slate-700"
            />

            <div className="flex gap-4">
              <button 
                onClick={() => setRejectModal({ isOpen: false, appId: null })}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                disabled={!rejectionReason.trim() || isSubmitting}
                onClick={() => handleAction(rejectModal.appId, 'rejected', rejectionReason)}
                className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl shadow-xl shadow-red-500/20 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// IMPACT STATS PAGE — fetches /api/admin/impact-computed
// ==========================================
function ImpactStatsPage({ token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchImpact = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/admin/impact-computed`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "ngrok-skip-browser-warning": "69420"
        }
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        setError(data.message || "Failed to load impact data");
      }
    } catch (e) {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchImpact(); }, []);

  return (
    <>
      <header className="h-24 bg-white/80 backdrop-blur-md border-b px-12 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Impact Statistics</h2>
          <p className="text-xs text-slate-400 font-medium">Real-time platform sustainability metrics.</p>
        </div>
        <button onClick={fetchImpact} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors">
          Refresh
        </button>
      </header>

      <section className="flex-1 overflow-y-auto p-12">
        {loading ? (
          <div className="flex flex-col items-center py-20">
            <Loader2 className="animate-spin text-[#244F42] mb-4" size={40} />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-8 rounded-3xl border border-red-100 flex items-center gap-4">
            <AlertCircle size={24} /><p className="font-bold">{error}</p>
          </div>
        ) : stats ? (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Primary impact metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Meals Saved" value={stats.meals_saved} color="bg-blue-50" textColor="text-blue-600" />
              <StatCard label="CO₂ Reduced (kg)" value={stats.co2_reduced} color="bg-green-50" textColor="text-green-600" />
              <StatCard label="Kg Rescued" value={stats.kg_rescued} color="bg-amber-50" textColor="text-amber-600" />
              <StatCard label="Donations Completed" value={stats.total_donations_completed} color="bg-purple-50" textColor="text-purple-600" />
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Platform Activity</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b">
                    <span className="text-slate-600 font-medium">Orders Completed</span>
                    <span className="text-2xl font-black text-[#244F42]">{stats.total_orders_completed}</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b">
                    <span className="text-slate-600 font-medium">Active Users (30 days)</span>
                    <span className="text-2xl font-black text-[#244F42]">{stats.active_users_this_month}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Total Revenue</span>
                    <span className="text-2xl font-black text-[#244F42]">Rs. {stats.total_revenue?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Top Performing Stores</h3>
                {stats.top_stores?.length > 0 ? (
                  <div className="space-y-3">
                    {stats.top_stores.map((store, i) => (
                      <div key={store.store_id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-[#244F42]/10 text-[#244F42] text-xs font-black flex items-center justify-center">{i + 1}</span>
                          <span className="text-sm font-bold text-slate-700">{store.store_name}</span>
                        </div>
                        <span className="text-sm font-black text-[#244F42]">{store.order_count} orders</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-300 text-sm font-bold text-center py-8">No data yet</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

// ==========================================
// DONATIONS PAGE
// ==========================================
const STATUS_FILTERS = [
  { key: 'all',                   label: 'All' },
  { key: 'available',             label: 'Available' },
  { key: 'accepted',              label: 'Accepted' },
  { key: 'proof_pending',         label: 'Picked Up' },
  { key: 'verified',              label: 'Completed' },
  { key: 'delivery_unconfirmed',  label: 'Unconfirmed' },
];

const STATUS_STYLE = {
  available:            { bg: 'bg-blue-50',   text: 'text-blue-600',   label: 'Available' },
  accepted:             { bg: 'bg-yellow-50', text: 'text-yellow-600', label: 'Accepted' },
  proof_pending:        { bg: 'bg-orange-50', text: 'text-orange-600', label: 'Picked Up' },
  verified:             { bg: 'bg-green-50',  text: 'text-green-600',  label: 'Completed' },
  delivery_unconfirmed: { bg: 'bg-red-50',    text: 'text-red-600',    label: 'Unconfirmed' },
};

function DonationsPage({ token }) {
  const [donations, setDonations]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDonation, setSelectedDonation] = useState(null);

  const fetchDonations = async (status = statusFilter) => {
    try {
      setLoading(true);
      setError(null);
      const statusParam = status !== 'all' ? `&status=${status}` : '';
      const res = await fetch(
        `${API_BASE}/api/admin/donations?page=1&limit=100${statusParam}`,
        { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': '69420' } }
      );
      const data = await res.json();
      if (data.success) {
        setDonations(data.donations);
        setPagination(data.pagination);
      } else {
        setError(data.message || 'Failed to load donations');
      }
    } catch (e) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDonations(statusFilter); }, [statusFilter]);

  const proofSrc = selectedDonation?.proof_image_url
    ? (selectedDonation.proof_image_url.startsWith('http')
        ? selectedDonation.proof_image_url
        : `${API_BASE}${selectedDonation.proof_image_url}`)
    : null;

  return (
    <>
      <header className="h-24 bg-white/80 backdrop-blur-md border-b px-12 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Donation History</h2>
          <p className="text-xs text-slate-400 font-medium">
            {pagination.total} total donations · click a row to view proof photo
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status filter pills */}
          <div className="flex bg-slate-100 p-1 rounded-2xl gap-0.5">
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-widest ${
                  statusFilter === key
                    ? 'bg-white text-[#244F42] shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchDonations(statusFilter)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-12">
        {loading ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-[2rem] shadow-sm">
            <Loader2 className="animate-spin text-[#244F42] mb-4" size={40} />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-8 rounded-3xl border border-red-100 flex items-center gap-4">
            <AlertCircle size={24} />
            <p className="font-bold">{error}</p>
          </div>
        ) : donations.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 shadow-sm border border-gray-100 text-center">
            <Gift size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest">No donations found</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Restaurant</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Food Item</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">NGO</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Picked Up</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Proof</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Certificate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {donations.map((d) => {
                    const s = STATUS_STYLE[d.status] || { bg: 'bg-slate-50', text: 'text-slate-500', label: d.status };
                    const hasProof = !!d.proof_image_url;
                    const hasCert  = !!d.certificate_url;
                    return (
                      <tr
                        key={d.id}
                        onClick={() => setSelectedDonation(d)}
                        className="group hover:bg-[#244F42]/5 transition-all cursor-pointer"
                      >
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-700 text-sm">{d.store?.name || '—'}</p>
                          <p className="text-[11px] text-slate-400">{d.store?.email || ''}</p>
                        </td>
                        <td className="px-6 py-5">
                          <p className="font-semibold text-slate-700 text-sm">{d.listing?.item_name || '—'}</p>
                          <p className="text-[11px] text-slate-400">{d.listing?.category || ''}</p>
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-500 font-medium">
                          {d.ngo?.name || <span className="text-slate-300 italic">None yet</span>}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${s.bg} ${s.text}`}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-500">
                          {d.picked_up_at
                            ? new Date(d.picked_up_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-6 py-5">
                          {hasProof ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-black uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-400 rounded-lg text-[10px] font-black uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          {hasCert ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#244F42]/10 text-[#244F42] rounded-lg text-[10px] font-black uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#244F42] inline-block" />
                              Issued
                            </span>
                          ) : d.certificate_requested ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                              Pending
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[10px] font-black uppercase">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-center text-slate-400 text-xs mt-4 font-medium">
              Showing {donations.length} of {pagination.total} donations
            </p>
          </div>
        )}
      </section>

      {/* PROOF PHOTO MODAL */}
      {selectedDonation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-8"
          onClick={() => setSelectedDonation(null)}
        >
          <div
            className="bg-white rounded-[2rem] overflow-hidden w-full max-w-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-8 py-6 border-b flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 text-lg">
                  {selectedDonation.listing?.item_name || 'Donation'}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {selectedDonation.store?.name} · NGO: {selectedDonation.ngo?.name || 'None'}
                </p>
              </div>
              <button
                onClick={() => setSelectedDonation(null)}
                className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Status + meta row */}
            <div className="px-8 py-4 bg-slate-50/60 flex flex-wrap gap-6 text-xs font-bold text-slate-500 border-b">
              {(() => {
                const s = STATUS_STYLE[selectedDonation.status] || { bg: 'bg-slate-50', text: 'text-slate-500', label: selectedDonation.status };
                return (
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${s.bg} ${s.text}`}>
                    {s.label}
                  </span>
                );
              })()}
              {selectedDonation.picked_up_at && (
                <span>Picked up: {new Date(selectedDonation.picked_up_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              )}
              {selectedDonation.certificate_url && (
                <a
                  href={selectedDonation.certificate_url.startsWith('http') ? selectedDonation.certificate_url : `${API_BASE}${selectedDonation.certificate_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#244F42] underline underline-offset-2"
                >
                  View Certificate ↗
                </a>
              )}
            </div>

            {/* Proof photo */}
            <div className="p-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                NGO Proof of Impact
              </p>
              {proofSrc ? (
                <SafeImage
                  src={proofSrc}
                  alt="NGO proof of impact"
                  className="w-full max-h-96 object-contain rounded-2xl bg-slate-100"
                />
              ) : (
                <div className="w-full h-48 rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
                  <p className="text-slate-300 text-xs font-bold uppercase tracking-widest">No proof photo uploaded</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// ADMIN DASHBOARD PAGE — fetches /api/admin/dashboard + /api/admin/impact-computed
// ==========================================
function DashboardPage({ token }) {
  const [dashboard, setDashboard] = useState(null);
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const headers = { "Authorization": `Bearer ${token}`, "ngrok-skip-browser-warning": "69420" };

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashRes, impactRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/dashboard`, { headers }),
        fetch(`${API_BASE}/api/admin/impact-computed`, { headers }),
      ]);
      const [dashData, impactData] = await Promise.all([dashRes.json(), impactRes.json()]);
      if (dashData.success) setDashboard(dashData.dashboard);
      if (impactData.success) setImpact(impactData.stats);
      if (!dashData.success) setError("Failed to load dashboard");
    } catch (e) {
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  return (
    <>
      <header className="h-24 bg-white/80 backdrop-blur-md border-b px-12 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Admin Dashboard</h2>
          <p className="text-xs text-slate-400 font-medium">Comprehensive platform overview.</p>
        </div>
        <button onClick={fetchAll} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors">
          Refresh
        </button>
      </header>

      <section className="flex-1 overflow-y-auto p-12">
        {loading ? (
          <div className="flex flex-col items-center py-20">
            <Loader2 className="animate-spin text-[#244F42] mb-4" size={40} />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-8 rounded-3xl border border-red-100 flex items-center gap-4">
            <AlertCircle size={24} /><p className="font-bold">{error}</p>
          </div>
        ) : dashboard ? (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Real computed impact metrics */}
            {impact && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard label="Meals Saved" value={impact.meals_saved} color="bg-blue-50" textColor="text-blue-600" />
                <StatCard label="CO₂ Reduced (kg)" value={impact.co2_reduced} color="bg-green-50" textColor="text-green-600" />
                <StatCard label="Kg Rescued" value={impact.kg_rescued} color="bg-amber-50" textColor="text-amber-600" />
                <StatCard label="Donations Done" value={impact.total_donations_completed} color="bg-purple-50" textColor="text-purple-600" />
                <StatCard label="Revenue (Rs.)" value={impact.total_revenue?.toLocaleString()} color="bg-rose-50" textColor="text-rose-600" />
              </div>
            )}

            {/* Users Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={dashboard.users.total} color="bg-slate-50" textColor="text-slate-700" />
              <StatCard label="New Today" value={dashboard.users.today} color="bg-green-50" textColor="text-green-600" />
              <StatCard label="This Week" value={dashboard.users.this_week} color="bg-purple-50" textColor="text-purple-600" />
              <StatCard label="This Month" value={dashboard.users.this_month} color="bg-orange-50" textColor="text-orange-600" />
            </div>

            {/* Activity Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Listings</h3>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-slate-600">Total</span><span className="font-bold text-[#244F42]">{dashboard.listings.total}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Active</span><span className="font-bold text-[#244F42]">{dashboard.listings.active}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Posted Today</span><span className="font-bold text-[#244F42]">{dashboard.listings.today}</span></div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Reservations</h3>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-slate-600">Total</span><span className="font-bold text-[#244F42]">{dashboard.reservations.total}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Today</span><span className="font-bold text-[#244F42]">{dashboard.reservations.today}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Completed</span><span className="font-bold text-[#244F42]">{dashboard.reservations.completed}</span></div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Donations</h3>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-slate-600">Total</span><span className="font-bold text-[#244F42]">{dashboard.donations.total}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Available</span><span className="font-bold text-[#244F42]">{dashboard.donations.available}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Completed</span><span className="font-bold text-[#244F42]">{dashboard.donations.completed}</span></div>
                </div>
              </div>
            </div>

            {/* NGOs */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-slate-800 mb-6">NGO Applications</h3>
              <div className="flex gap-8">
                <div className="text-center"><p className="text-3xl font-black text-amber-500">{dashboard.ngos.pending}</p><p className="text-xs font-bold text-slate-400 uppercase mt-1">Pending</p></div>
                <div className="text-center"><p className="text-3xl font-black text-green-600">{dashboard.ngos.verified}</p><p className="text-xs font-bold text-slate-400 uppercase mt-1">Verified</p></div>
                <div className="text-center"><p className="text-3xl font-black text-[#244F42]">{dashboard.ngos.total_applications}</p><p className="text-xs font-bold text-slate-400 uppercase mt-1">Total</p></div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

// ==========================================
// CERTIFICATES PAGE
// ==========================================
function CertificatesPage({ token }) {
  const [requests, setRequests] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputRef = useRef(null);
  const [pendingUploadId, setPendingUploadId] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/donations/certificate-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
        },
      });
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      } else {
        setError(data.message || 'Failed to load certificate requests');
      }
    } catch (e) {
      setError('Connection error. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleUploadClick = (id) => {
    setPendingUploadId(id);
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !pendingUploadId) return;

    const formData = new FormData();
    formData.append('certificate', file);

    try {
      setUploadingId(pendingUploadId);
      const res = await fetch(`${API_BASE}/api/donations/${pendingUploadId}/upload-certificate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
        },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        alert('Certificate uploaded successfully. The restaurant can now download it.');
        fetchRequests();
      } else {
        alert('Upload failed: ' + (data.message || 'Unknown error'));
      }
    } catch (e) {
      alert('Upload failed: connection error.');
    } finally {
      setUploadingId(null);
      setPendingUploadId(null);
    }
  };

  return (
    <>
      {/* Hidden file input shared across all cards */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <header className="h-24 bg-white/80 backdrop-blur-md border-b px-12 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Certificate Requests</h2>
          <p className="text-xs text-slate-400 font-medium">Upload donation certificates for verified restaurants.</p>
        </div>
        <button
          onClick={fetchRequests}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
        >
          Refresh
        </button>
      </header>

      <section className="flex-1 overflow-y-auto p-12">
        {loading ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-[2rem] shadow-sm">
            <Loader2 className="animate-spin text-[#244F42] mb-4" size={40} />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-8 rounded-3xl border border-red-100 flex items-center gap-4">
            <AlertCircle size={24} />
            <p className="font-bold">{error}</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center py-24 bg-white rounded-[2rem] shadow-sm border border-gray-100">
            <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mb-6">
              <Award size={40} className="text-amber-400" />
            </div>
            <p className="text-slate-700 font-black text-xl mb-2">No Pending Requests</p>
            <p className="text-slate-400 text-sm font-medium">Certificate requests from restaurants will appear here.</p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            {requests.map((req) => {
              const proofSrc = req.proof_image_url
                ? (req.proof_image_url.startsWith('http') ? req.proof_image_url : `${API_BASE}${req.proof_image_url}`)
                : null;

              return (
                <div key={req.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                  {/* Card header */}
                  <div className="px-8 pt-7 pb-5 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                          Pending
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-slate-800 truncate">{req.store?.name || '—'}</h3>
                      <p className="text-sm text-slate-400 font-medium">{req.store?.email || '—'}</p>
                    </div>
                    <button
                      onClick={() => handleUploadClick(req.id)}
                      disabled={uploadingId === req.id}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#244F42] hover:bg-[#1a3a34] text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 shrink-0"
                    >
                      {uploadingId === req.id ? (
                        <><Loader2 size={15} className="animate-spin" /> Uploading…</>
                      ) : (
                        <><Award size={15} /> Upload Certificate</>
                      )}
                    </button>
                  </div>

                  <div className="px-8 pb-7 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Donation details */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Donation Details</p>
                      <DetailRow label="Item" value={req.item_name || '—'} />
                      <DetailRow label="NGO" value={req.ngo_name || '—'} />
                      <DetailRow
                        label="Picked Up"
                        value={req.picked_up_at
                          ? new Date(req.picked_up_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      />
                      <DetailRow
                        label="Certificate Requested"
                        value={req.certificate_requested_at
                          ? new Date(req.certificate_requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      />
                    </div>

                    {/* NGO proof photo */}
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">NGO Proof of Impact</p>
                      {proofSrc ? (
                        <SafeImage
                          src={proofSrc}
                          alt="NGO delivery proof"
                          className="w-full h-48 object-cover rounded-2xl bg-slate-100"
                        />
                      ) : (
                        <div className="w-full h-48 rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
                          <p className="text-slate-300 text-xs font-bold uppercase tracking-widest">No proof photo</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold text-slate-700">{value}</span>
    </div>
  );
}

// ==========================================
// REUSABLE SAFE IMAGE COMPONENT (Bypass Ngrok)
// ==========================================
function SafeImage({ src, alt, className, contain = false }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!src) return;

    const fetchImage = async () => {
      try {
        setLoading(true);
        const res = await fetch(src, {
          headers: { "ngrok-skip-browser-warning": "69420" }
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err) {
        console.error("SafeImage Error:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchImage();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [src]);

  // Sizing styles: contain mode = natural width, max 100%, auto height (no squish)
  // className mode = caller controls sizing entirely
  const imgStyle = contain
    ? { maxWidth: '100%', height: 'auto', display: 'block' }
    : undefined;

  const wrapperClass = contain
    ? 'bg-slate-100 flex items-center justify-center rounded-lg shadow-2xl overflow-hidden'
    : className;

  if (loading) return (
    <div className={contain ? 'w-full h-48 bg-slate-100 flex items-center justify-center rounded-lg' : `${className} bg-slate-100 flex items-center justify-center`}>
      <Loader2 className="animate-spin text-slate-300" size={20} />
    </div>
  );

  if (error || !blobUrl) return (
    <div className={contain ? 'w-full h-48 bg-red-50 flex items-center justify-center text-red-300 rounded-lg' : `${className} bg-red-50 flex items-center justify-center text-red-300`}>
      <AlertCircle size={20} />
    </div>
  );

  return (
    <div className={contain ? wrapperClass : undefined}>
      <img
        src={blobUrl}
        alt={alt}
        className={contain ? undefined : className}
        style={imgStyle}
      />
    </div>
  );
}

// ==========================================
// REUSABLE STAT CARD COMPONENT
// ==========================================
function StatCard({ label, value, color, textColor }) {
  return (
    <div className={`${color} rounded-3xl p-6 border border-gray-100`}>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-2">{label}</p>
      <h3 className={`text-3xl font-black ${textColor}`}>{value}</h3>
    </div>
  );
}

// ==========================================
// DETAIL FIELD — used in NGO expanded rows
// ==========================================
function DetailField({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm text-slate-700 ${mono ? 'font-mono font-bold text-[#244F42]' : 'font-medium'}`}>
        {value || <span className="text-slate-300 italic font-normal">Not provided</span>}
      </p>
    </div>
  );
}

// ==========================================
// USER MANAGEMENT PAGE
// ==========================================
function UserManagementPage({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('consumer');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const TABS = [
    { key: 'consumer', label: 'Customers' },
    { key: 'business', label: 'Restaurants' },
    { key: 'driver',   label: 'Drivers' },
    { key: 'ngo',      label: 'NGOs' },
  ];

  const headers = { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': '69420' };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ role: activeTab, limit: '100' });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`${API_BASE}/api/admin/users?${params}`, { headers });
      const data = await res.json();
      if (data.success) setUsers(data.users);
      else setError(data.message || 'Failed to load users');
    } catch (e) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [activeTab]);

  const handleBan = async (userId, currentlyBanned) => {
    try {
      setActionLoading(`ban-${userId}`);
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/ban`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        // Send explicit intent so the backend sets the exact value, not a blind toggle
        body: JSON.stringify({ ban: !currentlyBanned }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, isBanned: data.is_banned } : u));
      } else {
        alert('Action failed: ' + (data.message || 'Unknown error'));
      }
    } catch (e) {
      alert('Connection error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId) => {
    try {
      setActionLoading(`del-${userId}`);
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'DELETE', headers,
      });
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        setConfirmDelete(null);
      } else {
        alert('Delete failed: ' + (data.message || 'Unknown error'));
      }
    } catch (e) {
      alert('Connection error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <header className="h-24 bg-white/80 backdrop-blur-md border-b px-12 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
          <p className="text-xs text-slate-400 font-medium">{users.length} {activeTab} accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchUsers()}
            placeholder="Search name or email…"
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#244F42] w-56"
          />
          <button onClick={fetchUsers} className="px-4 py-2 bg-[#244F42] text-white rounded-xl text-xs font-bold hover:bg-[#1a3a34] transition-colors">
            Search
          </button>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-12">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex bg-slate-100 p-1 rounded-2xl w-fit gap-0.5">
            {TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-widest ${
                  activeTab === key ? 'bg-white text-[#244F42] shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-20 bg-white rounded-[2rem] shadow-sm">
              <Loader2 className="animate-spin text-[#244F42] mb-4" size={40} />
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-8 rounded-3xl border border-red-100 flex items-center gap-4">
              <AlertCircle size={24} /><p className="font-bold">{error}</p>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Name</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Email</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Joined</th>
                    {activeTab === 'driver' && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rating</th>}
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-all">
                      <td className="px-8 py-5">
                        <p className="font-bold text-slate-700">{u.store_name || u.full_name}</p>
                        {u.store_name && <p className="text-xs text-slate-400">{u.full_name}</p>}
                      </td>
                      <td className="px-8 py-5 text-sm text-slate-500 font-medium">{u.email}</td>
                      <td className="px-8 py-5 text-sm text-slate-400">{new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      {activeTab === 'driver' && (
                        <td className="px-8 py-5">
                          <span className="text-sm font-bold text-amber-500">{u.rating ? `${u.rating} ★` : '—'}</span>
                        </td>
                      )}
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${!u.isBanned ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                          {u.isBanned ? 'Banned' : 'Active'}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleBan(u.id, u.isBanned)}
                            disabled={actionLoading === `ban-${u.id}`}
                            title={u.isBanned ? 'Unban user' : 'Ban user'}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-50 ${!u.isBanned ? 'bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white' : 'bg-green-50 text-green-600 hover:bg-green-500 hover:text-white'}`}
                          >
                            {actionLoading === `ban-${u.id}` ? <Loader2 size={14} className="animate-spin" /> : (u.isVerified ? <ShieldOff size={14} /> : <ShieldCheck size={14} />)}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(u)}
                            disabled={actionLoading === `del-${u.id}`}
                            title="Delete user"
                            className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                          >
                            {actionLoading === `del-${u.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="p-20 text-center">
                  <p className="text-slate-300 font-black uppercase tracking-widest">No {activeTab} accounts found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Delete User?</h3>
            <p className="text-slate-500 text-sm font-medium mb-6">
              This will permanently delete <strong>{confirmDelete.full_name}</strong> ({confirmDelete.email}). This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete.id)} disabled={actionLoading === `del-${confirmDelete.id}`}
                className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl shadow-xl shadow-red-500/20 transition-all disabled:opacity-50">
                {actionLoading === `del-${confirmDelete.id}` ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// LISTINGS MANAGEMENT PAGE
// ==========================================
function ListingsManagementPage({ token }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedStores, setExpandedStores] = useState(new Set());

  const headers = { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': '69420' };

  const fetchListings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/admin/listings?limit=200`, { headers });
      const data = await res.json();
      if (data.success) setListings(data.listings);
      else setError(data.message || 'Failed to load listings');
    } catch (e) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchListings(); }, []);

  const handleDelete = async (id) => {
    try {
      setDeletingId(id);
      const res = await fetch(`${API_BASE}/api/admin/listings/${id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (data.success) {
        setListings(prev => prev.filter(l => l.id !== id));
        setConfirmDelete(null);
      } else {
        alert('Delete failed: ' + (data.message || 'Unknown error'));
      }
    } catch (e) {
      alert('Connection error');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleStore = (storeKey) => {
    setExpandedStores(prev => {
      const next = new Set(prev);
      next.has(storeKey) ? next.delete(storeKey) : next.add(storeKey);
      return next;
    });
  };

  // Group listings by store
  const byStore = listings.reduce((acc, l) => {
    const key = l.store?.id || 'unknown';
    if (!acc[key]) acc[key] = { store: l.store, items: [] };
    acc[key].items.push(l);
    return acc;
  }, {});

  return (
    <>
      <header className="h-24 bg-white/80 backdrop-blur-md border-b px-12 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Listings</h2>
          <p className="text-xs text-slate-400 font-medium">{listings.length} total listings across {Object.keys(byStore).length} stores</p>
        </div>
        <button onClick={fetchListings} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors">Refresh</button>
      </header>

      <section className="flex-1 overflow-y-auto p-12">
        {loading ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-[2rem] shadow-sm">
            <Loader2 className="animate-spin text-[#244F42] mb-4" size={40} />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-8 rounded-3xl border border-red-100 flex items-center gap-4">
            <AlertCircle size={24} /><p className="font-bold">{error}</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-3">
            {Object.values(byStore).map(({ store, items }) => {
              const storeKey = store?.id || 'unknown';
              const isOpen = expandedStores.has(storeKey);
              return (
                <div key={storeKey} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Accordion header — always visible */}
                  <button
                    onClick={() => toggleStore(storeKey)}
                    className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/80 transition-colors group"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-10 h-10 rounded-xl bg-[#244F42]/10 flex items-center justify-center shrink-0">
                        <Store size={18} className="text-[#244F42]" />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-slate-800 text-sm">{store?.name || 'Unknown Store'}</p>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">{store?.email || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="px-3 py-1 bg-[#244F42]/10 text-[#244F42] rounded-lg text-xs font-black">
                        {items.length} listing{items.length !== 1 ? 's' : ''}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {/* Expandable listings table */}
                  {isOpen && (
                    <div className="border-t border-slate-100">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50/60">
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Item</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Category</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Price</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Stock</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Orders / Donations</th>
                            <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {items.map(l => (
                            <tr key={l.id} className="hover:bg-slate-50/80 transition-all">
                              <td className="px-8 py-4">
                                <p className="font-bold text-slate-700 text-sm">{l.item_name}</p>
                                <p className="text-[10px] text-slate-400">{new Date(l.created_at).toLocaleDateString()}</p>
                              </td>
                              <td className="px-8 py-4 text-sm text-slate-500">{l.category}</td>
                              <td className="px-8 py-4">
                                <p className="text-sm font-bold text-[#244F42]">Rs. {l.selling_price}</p>
                                <p className="text-[10px] text-slate-400 line-through">Rs. {l.original_price}</p>
                              </td>
                              <td className="px-8 py-4 text-sm font-bold text-slate-600">{l.stock_quantity}</td>
                              <td className="px-8 py-4">
                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${l.is_active ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                  {l.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-8 py-4 text-sm text-slate-500">
                                {l.stats?.total_reservations ?? 0} / {l.stats?.total_donations ?? 0}
                              </td>
                              <td className="px-8 py-4 text-right">
                                <button
                                  onClick={() => setConfirmDelete(l)}
                                  disabled={deletingId === l.id}
                                  className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 ml-auto"
                                >
                                  {deletingId === l.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            {listings.length === 0 && (
              <div className="bg-white rounded-3xl p-20 text-center shadow-sm border border-gray-100">
                <p className="text-slate-300 font-black uppercase tracking-widest">No listings found</p>
              </div>
            )}
          </div>
        )}
      </section>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6"><Trash2 size={32} /></div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Delete Listing?</h3>
            <p className="text-slate-500 text-sm font-medium mb-6">
              Permanently delete <strong>{confirmDelete.item_name}</strong> from {confirmDelete.store?.name}? This cannot be undone.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete.id)} disabled={deletingId === confirmDelete.id}
                className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl shadow-xl shadow-red-500/20 disabled:opacity-50">
                {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// ANALYTICS PAGE
// ==========================================
function AnalyticsPage({ token }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('weekly');

  const headers = { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': '69420' };

  const fetchAnalytics = async (p = period) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/admin/analytics?period=${p}`, { headers });
      const data = await res.json();
      if (data.success) setAnalytics(data);
      else setError(data.message || 'Failed to load analytics');
    } catch (e) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(period); }, [period]);

  const exportCSV = () => {
    if (!analytics) return;
    const rows = [
      ['Period', 'Donations'],
      ...analytics.trend.map(t => [t.label, t.count]),
      [],
      ['Top Restaurants', ''],
      ['Store', 'Donations'],
      ...analytics.top_stores.map(s => [s.store_name, s.donation_count]),
      [],
      ['Top NGOs', ''],
      ['NGO', 'Pickups'],
      ...analytics.top_ngos.map(n => [n.ngo_name, n.pickup_count]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saveabite-analytics-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxTrend = analytics ? Math.max(...analytics.trend.map(t => t.count), 1) : 1;

  return (
    <>
      <header className="h-24 bg-white/80 backdrop-blur-md border-b px-12 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Analytics</h2>
          <p className="text-xs text-slate-400 font-medium">Donation trends, top performers, and platform insights.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            {['weekly', 'monthly'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-widest ${period === p ? 'bg-white text-[#244F42] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} disabled={!analytics}
            className="flex items-center gap-2 px-4 py-2 bg-[#244F42] text-white rounded-xl text-xs font-bold hover:bg-[#1a3a34] transition-colors disabled:opacity-40">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-12">
        {loading ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-[2rem] shadow-sm">
            <Loader2 className="animate-spin text-[#244F42] mb-4" size={40} />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-8 rounded-3xl border border-red-100 flex items-center gap-4">
            <AlertCircle size={24} /><p className="font-bold">{error}</p>
          </div>
        ) : analytics ? (
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Donation Trend Chart */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-slate-800 mb-8">Donation Trend ({period})</h3>
              <div className="flex items-end gap-3 h-48">
                {analytics.trend.map((bucket, i) => {
                  const pct = maxTrend > 0 ? (bucket.count / maxTrend) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs font-black text-slate-500">{bucket.count}</span>
                      <div className="w-full rounded-t-xl bg-[#244F42]/10 relative" style={{ height: '160px' }}>
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded-t-xl bg-[#244F42] transition-all duration-500"
                          style={{ height: `${Math.max(pct, bucket.count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{bucket.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Restaurants */}
              <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Top Restaurants by Donations</h3>
                {analytics.top_stores.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.top_stores.map((s, i) => {
                      const maxCount = analytics.top_stores[0]?.donation_count || 1;
                      const pct = (s.donation_count / maxCount) * 100;
                      return (
                        <div key={s.store_id} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-[#244F42]/10 text-[#244F42] text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                              <span className="text-sm font-bold text-slate-700">{s.store_name}</span>
                            </div>
                            <span className="text-sm font-black text-[#244F42]">{s.donation_count}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#244F42] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-300 text-sm font-bold text-center py-8">No data yet</p>
                )}
              </div>

              {/* Top NGOs */}
              <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Top NGOs by Pickups</h3>
                {analytics.top_ngos.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.top_ngos.map((n, i) => {
                      const maxCount = analytics.top_ngos[0]?.pickup_count || 1;
                      const pct = (n.pickup_count / maxCount) * 100;
                      return (
                        <div key={n.ngo_id} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                              <span className="text-sm font-bold text-slate-700">{n.ngo_name}</span>
                            </div>
                            <span className="text-sm font-black text-amber-600">{n.pickup_count}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#F5A623] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-300 text-sm font-bold text-center py-8">No data yet</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

// ==========================================
// ADVERTISEMENTS PAGE
// ==========================================
function AdvertisementsPage({ token }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const fetchAds = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/ads/admin`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
        },
      });
      const data = await res.json();
      if (data.success) {
        setAds(data.ads);
      } else {
        setError(data.message || 'Failed to load advertisements');
      }
    } catch (e) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAds(); }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormError('');
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!imageFile) { setFormError('Please select a poster image'); return; }

    const formData = new FormData();
    formData.append('image', imageFile);

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/api/ads/admin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
          // Do NOT set Content-Type — browser sets it with the correct boundary for multipart
        },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        resetForm();
        fetchAds();
      } else {
        setFormError(data.message || 'Failed to create advertisement');
      }
    } catch (e) {
      setFormError('Connection error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (ad) => {
    try {
      const res = await fetch(`${API_BASE}/api/ads/admin/${ad.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
        },
        body: JSON.stringify({ is_active: !ad.is_active }),
      });
      const data = await res.json();
      if (data.success) {
        setAds(prev => prev.map(a => a.id === ad.id ? { ...a, is_active: !a.is_active } : a));
      }
    } catch (e) {
      alert('Failed to update advertisement');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this advertisement? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/ads/admin/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
        },
      });
      const data = await res.json();
      if (data.success) {
        setAds(prev => prev.filter(a => a.id !== id));
      } else {
        alert(data.message || 'Failed to delete');
      }
    } catch (e) {
      alert('Connection error');
    }
  };

  const resolveImageUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE}${url}`;
  };

  return (
    <>
      <header className="h-24 bg-white/80 backdrop-blur-md border-b px-12 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Advertisements</h2>
          <p className="text-xs text-slate-400 font-medium">Manage banner posters shown on the user homepage.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAds}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#244F42] hover:bg-[#1a3a34] text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-[#244F42]/20"
          >
            <Megaphone size={16} />
            {showForm ? 'Cancel' : 'Add Poster'}
          </button>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-12">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* ── Upload Form ── */}
          {showForm && (
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Megaphone size={20} className="text-[#F5A623]" />
                New Advertisement Poster
              </h3>
              <form onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Poster Image <span className="text-red-400">*</span>
                  </label>
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-[#244F42]/40 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-56 rounded-xl object-cover shadow-md"
                      />
                    ) : (
                      <>
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
                          <Megaphone size={24} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-bold text-slate-400">Click to upload poster image</p>
                        <p className="text-xs text-slate-300 mt-1">JPG, PNG, WebP — max 5 MB</p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </div>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="mt-2 text-xs text-red-400 hover:text-red-600 font-bold"
                    >
                      Remove image
                    </button>
                  )}
                </div>

                {formError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
                    <AlertCircle size={16} />
                    {formError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-8 py-3 bg-[#244F42] hover:bg-[#1a3a34] text-white font-bold rounded-xl transition-colors text-sm shadow-lg shadow-[#244F42]/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {submitting ? 'Uploading...' : 'Publish Poster'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Stats bar ── */}
          <div className="flex gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-[#244F42]/10 rounded-xl">
                <Megaphone size={20} className="text-[#244F42]" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Total Posters</p>
                <h3 className="text-2xl font-black text-slate-800">{ads.length}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-xl">
                <Check size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Active</p>
                <h3 className="text-2xl font-black text-slate-800">{ads.filter(a => a.is_active).length}</h3>
              </div>
            </div>
          </div>

          {/* ── Ads list ── */}
          {loading ? (
            <div className="flex flex-col items-center py-20 bg-white rounded-[2rem] shadow-sm">
              <Loader2 className="animate-spin text-[#244F42] mb-4" size={40} />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-8 rounded-3xl border border-red-100 flex items-center gap-4">
              <AlertCircle size={24} />
              <p className="font-bold">{error}</p>
            </div>
          ) : ads.length === 0 ? (
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Megaphone size={28} className="text-slate-300" />
              </div>
              <p className="text-slate-300 font-black uppercase tracking-widest text-lg">No Advertisements Yet</p>
              <p className="text-slate-400 text-sm mt-2">Click "Add Poster" to create your first banner.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ads.map(ad => (
                <div
                  key={ad.id}
                  className={`bg-white rounded-[1.5rem] shadow-sm border overflow-hidden transition-all ${
                    ad.is_active ? 'border-gray-100' : 'border-slate-200 opacity-60'
                  }`}
                >
                  {/* Poster image */}
                  <div className="relative h-44 bg-slate-100">
                    {resolveImageUrl(ad.image_url) ? (
                      <img
                        src={resolveImageUrl(ad.image_url)}
                        alt="Advertisement poster"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Megaphone size={32} className="text-slate-300" />
                      </div>
                    )}
                    {/* Active badge */}
                    <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      ad.is_active ? 'bg-green-500 text-white' : 'bg-slate-400 text-white'
                    }`}>
                      {ad.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Added {new Date(ad.created_at).toLocaleDateString()}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => handleToggleActive(ad)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          ad.is_active
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            : 'bg-green-50 hover:bg-green-100 text-green-600'
                        }`}
                      >
                        {ad.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(ad.id)}
                        className="w-10 h-10 flex items-center justify-center bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
