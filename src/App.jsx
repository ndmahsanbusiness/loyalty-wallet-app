import React, { useState, useEffect, useRef } from "react";

// ============================================================
// DATABASE SIMULATION (Real system: PostgreSQL/MongoDB)
// ============================================================
// Data is now fetched from the MySQL backend via API
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// ============================================================
// HELPERS & CONSTANTS
// ============================================================
const COUNTRY_CODES = [
  { code: "+92", country: "PK" },
  { code: "+1", country: "US" },
  { code: "+44", country: "UK" },
  { code: "+971", country: "AE" },
  { code: "+91", country: "IN" },
];

const C = {
  bg: "#F6F6F7",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F1F1",
  accent: "#008060", // Shopify Green
  accentDim: "#E3F1DF",
  text: "#202223",
  textMuted: "#6D7175",
  textDim: "#8C9196",
  border: "#E1E3E5",
  green: "#008060",
  greenDim: "#D5EAD8",
  red: "#D72C0D",
  redDim: "#FFF4F2",
  gold: "#FFB800",
  white: "#FFFFFF",
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  body { 
    margin: 0; 
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
    background: ${C.bg}; 
    color: ${C.text};
    -webkit-font-smoothing: antialiased;
  }
  
  .card { 
    background: ${C.surface}; 
    border-radius: 8px; 
    box-shadow: 0 0 0 1px rgba(63, 63, 68, 0.05), 0 1px 3px 0 rgba(63, 63, 68, 0.15);
  }
  
  .btn-primary { 
    background: ${C.accent}; 
    color: white; 
    border: none; 
    cursor: pointer; 
    font-weight: 600; 
    transition: all 0.2s;
    border-radius: 4px;
  }
  .btn-primary:hover { background: #006e52; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  
  .btn-ghost { 
    background: transparent; 
    border: 1px solid ${C.border}; 
    color: ${C.text}; 
    cursor: pointer; 
    font-weight: 500;
    border-radius: 4px;
    transition: all 0.2s;
  }
  .btn-ghost:hover { background: ${C.surfaceAlt}; }

  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 4px;
    color: ${C.textMuted};
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  .sidebar-item:hover { background: #EDEEEF; color: ${C.text}; }
  .sidebar-item.active { background: #EDEEEF; color: ${C.accent}; font-weight: 600; }

  @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: slideIn 0.3s ease-out forwards; }
  
  input, select {
    border: 1px solid ${C.border};
    background: ${C.white};
    outline: none;
    transition: border-color 0.2s;
    border-radius: 4px;
  }
  input:focus, select:focus { border-color: ${C.accent}; box-shadow: 0 0 0 2px ${C.accent}20; }
  
  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  
  .sms-float {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 320px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 18px;
    padding: 16px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
    z-index: 10000;
    display: flex;
    gap: 12px;
    border: 1px solid rgba(0,0,0,0.05);
    animation: smsSlideIn 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28);
  }
  
  @keyframes smsSlideIn {
    from { transform: translateX(120%) scale(0.9); opacity: 0; }
    to { transform: translateX(0) scale(1); opacity: 1; }
  }

  .sms-icon {
    width: 38px;
    height: 38px;
    background: #007AFF;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 20px;
  }
  
  .sms-content {
    flex: 1;
  }
  
  .sms-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 2px;
  }
  
  .msg-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .message-item {
    background: white;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid ${C.border};
    border-left: 4px solid #007AFF;
    display: flex;
    gap: 12px;
  }
`;

// ============================================================
// SIMULATED BACKEND ACTIONS
// ============================================================
const sendSMS = async (phone, msg) => {
  try {
    await fetch(`${API_BASE}/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: phone, message: msg })
    });
  } catch (error) {
    console.error("SMS Error:", error);
  }
};

const processTransaction = async (senderId, receiverPhone, points, description) => {
  const response = await fetch(`${API_BASE}/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senderId, receiverPhone, points, description })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Transaction failed");
  return data;
};

const wsListeners = new Set();
const emitBalanceUpdate = (userId, newBalance) => {
  wsListeners.forEach(cb => cb({ type: "balance_update", userId, newBalance }));
};

// ============================================================
// MAIN APP COMPONENT
// ============================================================
export default function LoyaltyWallet() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState("login"); // login | user | admin
  const [notifications, setNotifications] = useState([]);
  const [allSms, setAllSms] = useState([]);

  const addNotification = (msg, phone = null) => {
    const id = Date.now();
    const newNotif = {
      id,
      msg,
      phone,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString()
    };
    setNotifications(prev => [newNotif, ...prev]);
    setAllSms(prev => [newNotif, ...prev]);
    if (phone) sendSMS(phone, msg);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 6000);
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    setView(user.role === "admin" ? "admin" : "user");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView("login");
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 10000, padding: 20, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
        {notifications.map(n => (
          <div key={n.id} className="sms-float" style={{ pointerEvents: "auto" }}>
            <div className="sms-icon">💬</div>
            <div className="sms-content">
              <div className="sms-header">
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1c1c1e" }}>MESSAGES</span>
                <span style={{ fontSize: 11, color: "#8e8e93" }}>{n.timestamp}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#000", marginBottom: 2 }}>{n.phone || "System Notification"}</div>
              <div style={{ fontSize: 14, color: "#3a3a3c", lineHeight: "1.3" }}>{n.msg}</div>
            </div>
          </div>
        ))}
      </div>

      {view === "login" && <LoginView onLogin={handleLogin} addNotification={addNotification} />}
      {view === "user" && currentUser && <UserDashboard user={currentUser} onLogout={handleLogout} addNotification={addNotification} allSms={allSms} />}
      {view === "admin" && <AdminDashboard onLogout={handleLogout} addNotification={addNotification} allSms={allSms} />}
    </div>
  );
}

// ============================================================
// LOGIN VIEW
// ============================================================
function LoginView({ onLogin, addNotification }) {
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+92");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCountryCode, setRegCountryCode] = useState("+92");
  const [regPass, setRegPass] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);

  const normalizePhone = (code, num) => {
    const cleanNum = num.replace(/\D/g, "");
    if (num.startsWith("+")) return num.replace(/\s/g, "");
    return code + cleanNum;
  };

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    const fullPhone = normalizePhone(countryCode, phone);
    try {
      const resp = await fetch(`${API_BASE}/user/${fullPhone}`);
      const user = await resp.json();

      if (!resp.ok) throw new Error(user.error || "Login failed");
      if (password !== user.password) throw new Error("Invalid password");
      if (!user.is_active) throw new Error("Account suspended");

      onLogin(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regName || !regPhone || !regPass) { setError("All fields required"); return; }
    const fullPhone = normalizePhone(regCountryCode, regPhone);
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: regName,
          phone_number: fullPhone,
          password: regPass,
          avatar: regName.slice(0, 2).toUpperCase()
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Registration failed");

      setRegSuccess(true);
      addNotification(`New Account Active: Your LoyalChain wallet (+10,000 pts) is ready for use.`, fullPhone);
      setTimeout(() => { setTab("login"); setPhone(regPhone); setCountryCode(regCountryCode); setRegSuccess(false); }, 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f5", padding: 20 }}>
      <div className="card" style={{ width: "100%", maxWidth: 900, display: "grid", gridTemplateColumns: "1.2fr 1fr", overflow: "hidden", minHeight: 560 }}>
        <div style={{ background: `linear-gradient(135deg, ${C.accent}, #005e46)`, padding: 60, color: "white", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 20 }}>◈ LoyalChain</div>
          <p style={{ fontSize: 18, opacity: 0.9, lineHeight: 1.6 }}>Modern loyalty wallet for modern brands. Secure, instant, and borderless transactions.</p>
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
            <p>✓ Instant P2P Transfers</p>
            <p>✓ 24/7 Global Access</p>
            <p>✓ 10,000 Points Welcome Bonus</p>
          </div>
        </div>
        <div style={{ padding: 50, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", gap: 24, marginBottom: 40 }}>
            <button onClick={() => setTab("login")} style={{ border: "none", background: "none", fontSize: 16, fontWeight: 700, cursor: "pointer", color: tab === "login" ? C.accent : C.textMuted, borderBottom: tab === "login" ? `2px solid ${C.accent}` : "none", paddingBottom: 8 }}>Sign In</button>
            <button onClick={() => setTab("register")} style={{ border: "none", background: "none", fontSize: 16, fontWeight: 700, cursor: "pointer", color: tab === "register" ? C.accent : C.textMuted, borderBottom: tab === "register" ? `2px solid ${C.accent}` : "none", paddingBottom: 8 }}>Register</button>
          </div>

          {regSuccess ? (
            <div className="fade-in" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 20 }}>🌱</div>
              <h2 style={{ fontSize: 24, fontWeight: 700 }}>Profile Created!</h2>
              <p style={{ color: C.textMuted }}>Redirecting to login with 10k points...</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {tab === "register" && (
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Full Name</label>
                  <input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Alexandra Chen" style={{ width: "100%", padding: "12px" }} />
                </div>
              )}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Phone Number</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={tab === "login" ? countryCode : regCountryCode} onChange={e => tab === "login" ? setCountryCode(e.target.value) : setRegCountryCode(e.target.value)} style={{ padding: "12px", border: `1px solid ${C.border}`, background: "white", width: 80 }}>
                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                  <input value={tab === "login" ? phone : regPhone} onChange={e => tab === "login" ? setPhone(e.target.value) : setRegPhone(e.target.value)} placeholder="300 1234567" style={{ flex: 1, padding: "12px" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Password</label>
                <input type="password" value={tab === "login" ? password : regPass} onChange={e => tab === "login" ? setPassword(e.target.value) : setRegPass(e.target.value)} placeholder="••••••••" style={{ width: "100%", padding: "12px" }} />
              </div>
              {error && <p style={{ color: C.red, fontSize: 13, margin: 0 }}>⚠ {error}</p>}
              <button className="btn-primary" onClick={tab === "login" ? handleLogin : handleRegister} disabled={loading} style={{ padding: "14px", fontSize: 15 }}>
                {loading ? "Please wait..." : tab === "login" ? "Sign In →" : "Join LoyalChain"}
              </button>
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <p style={{ fontSize: 12, color: C.textDim }}>Admin Demo: +1 555 9999 (11223344)</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// USER DASHBOARD
// ============================================================
function UserDashboard({ user: initialUser, onLogout, addNotification, allSms }) {
  const [user, setUser] = useState(initialUser);
  const [activeTab, setActiveTab] = useState("home");
  const [transferPhone, setTransferPhone] = useState("");
  const [transferPoints, setTransferPoints] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferResult, setTransferResult] = useState(null);
  const [userTxs, setUserTxs] = useState([]);

  const refreshUser = async () => {
    try {
      const resp = await fetch(`${API_BASE}/user/${user.phone_number}`);
      const updated = await resp.json();
      if (resp.ok) setUser(updated);
    } catch (e) { console.error("Refresh failed", e); }
  };

  const fetchTransactions = async () => {
    try {
      const resp = await fetch(`${API_BASE}/transactions/${user.id}`);
      const data = await resp.json();
      if (resp.ok) setUserTxs(data);
    } catch (e) { console.error("Tx load failed", e); }
  };

  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(() => {
      refreshUser();
      fetchTransactions();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTransfer = async () => {
    setTransferResult(null);
    const pts = parseInt(transferPoints);
    if (!transferPhone || !pts || pts <= 0) { setTransferResult({ error: "Check inputs" }); return; }
    if (pts > user.total_points) { setTransferResult({ error: "Insufficient points" }); return; }

    setTransferLoading(true);
    try {
      const result = await processTransaction(user.id, transferPhone, pts, `Transfer from ${user.full_name}`);

      refreshUser();
      fetchTransactions();

      // SMS Alerts
      addNotification(`Debit Alert: ${pts} pts moved to ${result.receiverName}. New Bal: ${result.newBalance} pts. Ref: #${result.txId}`, user.phone_number);

      setTimeout(() => {
        addNotification(`Credit Alert: You received ${pts} pts from ${user.full_name}. Ref: #${result.txId}`, result.receiverPhone);
      }, 1200);

      setTransferResult({ success: true, name: result.receiverName, pts });
      setTransferPhone(""); setTransferPoints("");
    } catch (e) {
      setTransferResult({ error: e.message });
    }
    setTransferLoading(false);
  };

  const navItems = [
    { id: "home", label: "Home", icon: "🏠" },
    { id: "orders", label: "Orders", icon: "📦" },
    { id: "send", label: "P2P Send", icon: "💸" },
    { id: "messages", label: "Messages", icon: "💬" },
    { id: "rewards", label: "Rewards", icon: "🎁" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <nav style={{ width: 240, background: C.white, borderRight: `1px solid ${C.border}`, padding: "20px 8px", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 12px", marginBottom: 30 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.accent, marginBottom: 20 }}>◈ MyWallet</div>
          <div style={{ padding: "16px", background: C.bg, borderRadius: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Balance</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: C.accent, margin: 0 }}>{user.total_points.toLocaleString()}</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {navItems.map(item => (
            <div key={item.id} className={`sidebar-item ${activeTab === item.id ? "active" : ""}`} onClick={() => setActiveTab(item.id)}>
              <span style={{ fontSize: 18 }}>{item.icon}</span> {item.label}
            </div>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 4, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>{user.avatar}</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{user.full_name}</p>
              <p style={{ fontSize: 10, color: C.textMuted, margin: 0 }}>Active User</p>
            </div>
          </div>
          <button className="btn-ghost" onClick={onLogout} style={{ width: "100%", padding: "8px", fontSize: 12 }}>Sign Out</button>
        </div>
      </nav>

      <main style={{ flex: 1, padding: 40, background: C.bg, overflowY: "auto" }}>
        {activeTab === "home" && (
          <div className="fade-in">
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Warm welcome, {user.full_name}!</h1>
            <p style={{ color: C.textMuted, marginBottom: 32 }}>Here's what happening with your points today.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 40 }}>
              <div className="card" style={{ padding: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.textMuted, marginBottom: 12 }}>Available Points</p>
                <p style={{ fontSize: 32, fontWeight: 700, color: C.accent, margin: 0 }}>{user.total_points.toLocaleString()}</p>
              </div>
              <div className="card" style={{ padding: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.textMuted, marginBottom: 12 }}>Points Earned</p>
                <p style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>14,250</p>
              </div>
              <div className="card" style={{ padding: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.textMuted, marginBottom: 12 }}>Membership Level</p>
                <p style={{ fontSize: 32, fontWeight: 700, color: C.gold, margin: 0 }}>Platinum</p>
              </div>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Recent Activity</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {userTxs.slice(0, 5).map((tx, idx) => (
                  <div key={tx.id} style={{ display: "flex", alignItems: "center", padding: "16px 0", borderBottom: idx < 4 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 4, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 16 }}>{tx.points > 0 ? "📥" : "📤"}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{tx.description}</p>
                      <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                    <p style={{ fontWeight: 600, color: tx.points > 0 ? C.green : C.red }}>{tx.points > 0 ? "+" : ""}{tx.points.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "send" && (
          <div className="fade-in" style={{ maxWidth: 540 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Send Points</h1>
            <p style={{ color: C.textMuted, marginBottom: 32 }}>Move points instantly to any LoyalChain user.</p>
            <div className="card" style={{ padding: 32 }}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Recipient Phone Number</label>
                <input value={transferPhone} onChange={e => setTransferPhone(e.target.value)} placeholder="+1 555 0000" style={{ width: "100%", padding: "12px" }} />
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Point Amount</label>
                <input type="number" value={transferPoints} onChange={e => setTransferPoints(e.target.value)} placeholder="0" style={{ width: "100%", padding: "12px" }} />
              </div>
              <button className="btn-primary" onClick={handleTransfer} disabled={transferLoading} style={{ width: "100%", padding: "14px", fontSize: 16 }}>
                {transferLoading ? "Processing..." : "Confirm Transfer →"}
              </button>
              {transferResult && (
                <div style={{ marginTop: 24, padding: "16px", borderRadius: 4, fontSize: 14, background: transferResult.error ? C.redDim : C.accentDim, color: transferResult.error ? C.red : C.accent, border: `1px solid ${transferResult.error ? C.red : C.accent}30` }}>
                  {transferResult.error ? `⚠ ${transferResult.error}` : `✓ Sent ${transferResult.pts} pts to ${transferResult.name}. Recipient notified via SMS.`}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "messages" && (
          <div className="fade-in">
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>SMS Messages</h1>
            <p style={{ color: C.textMuted, marginBottom: 32 }}>Your official transaction message history.</p>
            <div className="msg-list">
              {allSms.filter(m => m.phone === user.phone_number || !m.phone).length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: C.textDim }}>No messages yet.</div>
              )}
              {allSms.filter(m => m.phone === user.phone_number || !m.phone).map(m => (
                <div key={m.id} className="message-item">
                  <div className="sms-icon" style={{ width: 32, height: 32, fontSize: 16 }}>💬</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{m.phone || "LoyalChain System"}</span>
                      <span style={{ fontSize: 11, color: C.textDim }}>{m.date} {m.timestamp}</span>
                    </div>
                    <div style={{ fontSize: 14 }}>{m.msg}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "rewards" && (
          <div className="fade-in">
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Rewards Store</h1>
            <p style={{ color: C.textMuted, marginBottom: 32 }}>Redeem your hard-earned points for exclusive perks.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
              {[
                { id: "c1", name: "Premium Coffee", cost: 500, icon: "☕" },
                { id: "c2", name: "Gift Card $10", cost: 2000, icon: "🎫" },
                { id: "c3", name: "Tech Bundle", cost: 15000, icon: "🎧" },
                { id: "c4", name: "VIP Lounge Pass", cost: 5000, icon: "🥂" },
              ].map(item => (
                <div key={item.id} className="card" style={{ padding: 24, display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ fontSize: 32 }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{item.name}</p>
                    <p style={{ fontSize: 13, color: C.accent, fontWeight: 600, margin: 0 }}>{item.cost.toLocaleString()} pts</p>
                  </div>
                  <button
                    className="btn-primary"
                    style={{ padding: "8px 16px", fontSize: 13 }}
                    onClick={async () => {
                      if (user.total_points < item.cost) {
                        addNotification("Redemption failed: Insufficient points.", user.phone_number);
                        return;
                      }
                      try {
                        const result = await processTransaction(user.id, null, item.cost, `Purchased ${item.name}`);
                        refreshUser();
                        fetchTransactions();
                        addNotification(`Order Confirmed: ${item.name} purchased for ${item.cost} pts. Ref: #${result.txId}`, user.phone_number);
                      } catch (e) {
                        addNotification(`Error: ${e.message}`, user.phone_number);
                      }
                    }}
                  >
                    Redeem
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="fade-in">
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Transaction Records</h1>
            <div className="card" style={{ padding: 8 }}>
              {userTxs.map((tx, idx) => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", padding: "16px 24px", borderBottom: idx < userTxs.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{tx.description}</p>
                    <p style={{ fontSize: 12, color: C.textMuted, margin: "2px 0 0 0" }}>Ref: #{tx.id} · {new Date(tx.created_at).toLocaleString()}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: tx.points > 0 ? C.green : C.red, margin: 0 }}>{tx.points > 0 ? "+" : ""}{tx.points.toLocaleString()}</p>
                    <p style={{ fontSize: 11, color: C.textDim, margin: 0 }}>Bal: {tx.balance_after.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================
function AdminDashboard({ onLogout, addNotification, allSms }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedUser, setSelectedUser] = useState(null);
  const [pointsAmount, setPointsAmount] = useState("");
  const [opLoading, setOpLoading] = useState(false);
  const [opResult, setOpResult] = useState(null);
  const [search, setSearch] = useState("");
  const [allUsers, setAllUsers] = useState([]);

  const fetchAllUsers = async () => {
    try {
      const resp = await fetch(`${API_BASE}/users`);
      const data = await resp.json();
      if (resp.ok) setAllUsers(data);
    } catch (e) { console.error("Admin load failed", e); }
  };

  useEffect(() => {
    fetchAllUsers();
    const inv = setInterval(fetchAllUsers, 8000);
    return () => clearInterval(inv);
  }, []);

  const users = allUsers.filter(u => u.role !== "admin");
  const filtered = users.filter(u => u.full_name.toLowerCase().includes(search.toLowerCase()) || u.phone_number.includes(search));
  const adminDoc = allUsers.find(u => u.role === "admin");
  const adminBalance = adminDoc?.total_points || 0;
  const circulatingPoints = users.reduce((s, u) => s + u.total_points, 0);

  const handleAdminAction = async (type) => {
    if (!selectedUser || !pointsAmount) return;
    setOpLoading(true);
    setOpResult(null);
    const pts = parseInt(pointsAmount);

    try {
      const resp = await fetch(`${API_BASE}/admin/adjust-points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          points: pts,
          type: type,
          description: `${type === "add" ? "System Credit" : "System Deduction"} (Admin)`
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Action failed");

      addNotification(`${type === "add" ? "Credit" : "Debit"} Alert: ${pts} pts adjusted by Admin. New Bal: ${data.newBalance} pts. Ref: #${data.txId}`, data.phone);
      setOpResult({ msg: `Successful ${type} of ${pts} pts` });
      setPointsAmount("");
      fetchAllUsers();
    } catch (e) {
      setOpResult({ error: e.message });
    }
    setOpLoading(false);
  };

  const refreshStats = () => { }; // Dummy for re-render triggers in this sim

  const sideItems = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "users", label: "Customers", icon: "👥" },
    { id: "audit", label: "Audit Log", icon: "📜" },
    { id: "messages", label: "SMS Logs", icon: "💬" },
    { id: "inventory", label: "Point Stock", icon: "📦" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={{ width: 260, background: C.white, borderRight: `1px solid ${C.border}`, padding: "20px 10px", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 14px", marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.accent, marginBottom: 8 }}>LoyalChain</div>
          <p style={{ fontSize: 11, color: C.textDim, fontWeight: 700, margin: 0 }}>ADMIN CONSOLE</p>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
          {sideItems.map(item => (
            <div key={item.id} className={`sidebar-item ${activeTab === item.id ? "active" : ""}`} onClick={() => setActiveTab(item.id)}>
              <span style={{ fontSize: 18 }}>{item.icon}</span> {item.label}
            </div>
          ))}
        </div>
        <div style={{ padding: 14, borderTop: `1px solid ${C.border}` }}>
          <div style={{ padding: 12, background: C.bg, borderRadius: 8, marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Global Pool</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.accent, margin: 0 }}>{adminBalance.toLocaleString()}</p>
          </div>
          <button className="btn-ghost" onClick={onLogout} style={{ width: "100%", padding: "10px" }}>Log Out</button>
        </div>
      </nav>

      <main style={{ flex: 1, background: C.bg, padding: 40, overflowY: "auto" }}>
        {activeTab === "overview" && (
          <div className="fade-in">
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 32 }}>Platform Overview</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
              {[
                { label: "Active Customers", value: users.length, icon: "👥", trend: "+2" },
                { label: "Points Circulating", value: circulatingPoints.toLocaleString(), icon: "💠", trend: "+14k" },
                { label: "Global Pool Balance", value: adminBalance.toLocaleString(), icon: "💎", trend: "Stable" },
                { label: "Total Volume", value: "Live", icon: "🏷️", trend: "+12%" },
              ].map(stat => (
                <div key={stat.label} className="card" style={{ padding: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{stat.label}</span>
                    <span>{stat.icon}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <p style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{stat.value}</p>
                    <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>{stat.trend}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>High-Value Profiles</h3>
                {users.sort((a, b) => b.total_points - a.total_points).slice(0, 5).map((u, i) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", padding: "12px 0", borderBottom: i < 4 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 4, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 15, fontWeight: 800, fontSize: 11 }}>{u.avatar}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{u.full_name}</p>
                      <p style={{ fontSize: 11, color: C.textDim, margin: 0 }}>{u.phone_number}</p>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{u.total_points.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
                <div style={{ fontSize: 50, marginBottom: 15 }}>📦</div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Inventory Status</h3>
                <p style={{ fontSize: 13, color: C.textMuted }}>Global reserve is at <span style={{ color: C.accent, fontWeight: 700 }}>92%</span> capacity.</p>
                <button className="btn-primary" onClick={() => setActiveTab("inventory")} style={{ marginTop: 20, padding: 12 }}>Manage Stock</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700 }}>Account Directory</h1>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer records..." style={{ padding: "10px 16px", borderRadius: 4, width: 300 }} />
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: C.surfaceAlt }}>
                  <tr>
                    {["Customer", "Phone", "Status", "Balance", ""].map(h => (
                      <th key={h} style={{ padding: "16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 4, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{u.avatar}</div>
                          <span style={{ fontWeight: 600 }}>{u.full_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "16px", fontSize: 14, color: C.textDim }}>{u.phone_number}</td>
                      <td style={{ padding: "16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: u.is_active ? C.greenDim : C.redDim, color: u.is_active ? C.green : C.red }}>{u.is_active ? "Active" : "Locked"}</span>
                      </td>
                      <td style={{ padding: "16px", fontWeight: 700 }}>{u.total_points.toLocaleString()}</td>
                      <td style={{ padding: "16px", textAlign: "right" }}>
                        <button className="btn-ghost" onClick={() => { setSelectedUser(u); setActiveTab("inventory"); }} style={{ padding: "6px 14px", fontSize: 12 }}>View Detail</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="fade-in" style={{ maxWidth: 600 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Point Stock Controller</h1>
            <p style={{ color: C.textMuted, marginBottom: 32 }}>Adjust user balances manually for support or rewards.</p>
            <div className="card" style={{ padding: 40 }}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Select Profile</label>
                <select value={selectedUser?.id || ""} onChange={e => setSelectedUser(allUsers.find(u => u.id === parseInt(e.target.value)) || null)} style={{ width: "100%", padding: "12px", background: "white" }}>
                  <option value="">Choose a customer...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.total_points} pts)</option>)}
                </select>
              </div>
              {selectedUser && (
                <div style={{ padding: 20, background: C.bg, borderRadius: 8, marginBottom: 24, border: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 12, color: C.textMuted, margin: "0 0 5px 0" }}>CURRENT HOLDINGS</p>
                  <p style={{ fontSize: 28, fontWeight: 800, color: C.accent, margin: 0 }}>{selectedUser.total_points.toLocaleString()} pts</p>
                </div>
              )}
              <div style={{ marginBottom: 32 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Quantity</label>
                <input type="number" value={pointsAmount} onChange={e => setPointsAmount(e.target.value)} placeholder="0" style={{ width: "100%", padding: "12px" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <button className="btn-primary" onClick={() => handleAdminAction("add")} disabled={opLoading || !selectedUser} style={{ padding: 14 }}>{opLoading ? "Processing..." : "Issue points"}</button>
                <button className="btn-ghost" onClick={() => handleAdminAction("deduct")} disabled={opLoading || !selectedUser} style={{ padding: 14, color: C.red }}>{opLoading ? "Processing..." : "Deduct points"}</button>
              </div>
              {opResult && (
                <div style={{ marginTop: 24, padding: "16px", borderRadius: 4, fontSize: 14, background: opResult.error ? C.redDim : C.accentDim, color: opResult.error ? C.red : C.accent }}>
                  {opResult.error ? `Error: ${opResult.error}` : `Completed: ${opResult.msg}`}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "messages" && (
          <div className="fade-in">
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>System SMS Broadcasts</h1>
            <div className="msg-list">
              {allSms.map((m, idx) => (
                <div key={m.id} className="message-item" style={{ borderLeftColor: idx % 2 === 0 ? "#007AFF" : "#34C759" }}>
                  <div className="sms-icon" style={{ width: 32, height: 32, fontSize: 16 }}>💬</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>Recipient: {m.phone || "All Users"}</span>
                      <span style={{ fontSize: 11, color: C.textDim }}>{m.date} {m.timestamp}</span>
                    </div>
                    <div style={{ fontSize: 14 }}>{m.msg}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
