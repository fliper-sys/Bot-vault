import { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Wifi, 
  Cpu, 
  CreditCard, 
  FileText, 
  Share2, 
  Activity, 
  Database,
  ExternalLink,
  ChevronRight,
  Sparkles,
  BookOpen
} from "lucide-react";

export default function App() {
  const [status, setStatus] = useState({
    connected: false,
    qr: null,
    error: null,
    adminPhone: "2348000000000"
  });
  
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending">("all");
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [testTxRef, setTestTxRef] = useState("");
  const [testResult, setTestResult] = useState({ success: null, message: "" });
  const [isSimulating, setIsSimulating] = useState(false);
  const [stats, setStats] = useState({
    totalSales: 0,
    dataSales: 0,
    aiSolves: 0,
    docsGenerated: 0
  });

  // Pull Connection Status and Firestore Transactions
  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.warn("Connection Status pull failed:", err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
        
        // Compile simple metrics
        let revenue = 0;
        let datas = 0;
        let solves = 0;
        let docs = 0;
        
        data.forEach(o => {
          if (o.status === "paid") {
            revenue += Number(o.amount || 0);
            if (o.type === "DATA") datas++;
            else if (o.type === "ASSIGNMENT") solves++;
            else if (o.type === "DOCUMENT") docs++;
          }
        });

        setStats({
          totalSales: revenue,
          dataSales: datas,
          aiSolves: solves,
          docsGenerated: docs
        });
      }
    } catch (err) {
      console.warn("Orders fetch failed:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchOrders();

    // Setup polling every 8 seconds to drive reactive state
    const timer = setInterval(() => {
      fetchStatus();
      fetchOrders();
    }, 8000);

    return () => clearInterval(timer);
  }, []);

  // Sandbox testing action: calls /api/test-webhook to bypass bank credentials
  const filteredOrders = orders.filter((ord: any) => {
    if (statusFilter === "all") return true;
    return (ord.status || "").toLowerCase() === statusFilter;
  });

  const handleTestPaymentSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTxRef) return;

    setIsSimulating(true);
    setTestResult({ success: null, message: "" });

    try {
      const res = await fetch("/api/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txRef: testTxRef })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: data.message });
        setTestTxRef("");
        fetchOrders(); // Reload ledger immediately
      } else {
        setTestResult({ success: false, message: data.error || "Failed to bypass settlement." });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-teal-500 selection:text-slate-900">
      {/* Top Banner Accent */}
      <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 via-indigo-500 to-cyan-500"></div>

      {/* Main Header */}
      <header className="border-b border-slate-800 bg-slate-955/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20 shadow-lg shadow-teal-500/5">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                BotVault <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">v1.0.0</span>
              </h1>
              <p className="text-xs text-slate-400">
                Operated by <a href="https://lbtech.site" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline inline-flex items-center gap-0.5">LBtech<ExternalLink className="w-3 h-3" /></a>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {status.connected ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
                <Wifi className="w-3.5 h-3.5" />
                Live on WhatsApp
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm shadow-amber-500/5">
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                Awaiting Connection
              </span>
            )}
            <button 
              onClick={() => { fetchStatus(); fetchOrders(); }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition"
              title="Refresh Stats"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Welcome Block */}
        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              A Complete Business Bot Solution
            </h2>
            <p className="text-slate-400 max-w-xl text-sm sm:text-base">
              BotVault automates data sales delivery, solves homework assignments using Gemini 1.5 Flash AI, and generates complete word (.docx) report files on-the-fly.
            </p>
          </div>
          <div className="shrink-0 bg-slate-855 px-5 py-4 border border-slate-700/60 rounded-xl space-y-1 text-center sm:text-left w-full sm:w-auto">
            <div className="text-xs text-slate-500 uppercase tracking-widest font-mono">Gateway Service</div>
            <div className="text-sm font-semibold text-white flex items-center justify-center sm:justify-start gap-1">
              <CreditCard className="w-4 h-4 text-teal-400 inline" />
              Flutterwave v3 API Verified
            </div>
            <div className="text-xs text-slate-400">Fulfillments cycle: Every 20s</div>
          </div>
        </div>

        {/* STATS COUNT */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/40 border border-slate-800 p-5 rounded-xl space-y-2">
            <div className="text-xs text-slate-400 font-mono tracking-widest uppercase">Verified Revenue</div>
            <div className="text-3xl font-bold text-teal-400">₦{stats.totalSales.toLocaleString()}</div>
            <div className="text-[11px] text-slate-500">Gross processed from paid orders</div>
          </div>
          <div className="bg-slate-800/40 border border-slate-800 p-5 rounded-xl space-y-2">
            <div className="text-xs text-slate-400 font-mono tracking-widest uppercase">Data Subscriptions</div>
            <div className="text-3xl font-bold text-white">{stats.dataSales} dispatched</div>
            <div className="text-[11px] text-slate-500">MTN, Airtel, Glo & 9mobile</div>
          </div>
          <div className="bg-slate-800/40 border border-slate-800 p-5 rounded-xl space-y-2">
            <div className="text-xs text-slate-400 font-mono tracking-widest uppercase">AI Tutors Charged</div>
            <div className="text-3xl font-bold text-white">{stats.aiSolves} questions</div>
            <div className="text-[11px] text-slate-500">Gemini 1.5 Flash AI solvers</div>
          </div>
          <div className="bg-slate-800/40 border border-slate-800 p-5 rounded-xl space-y-2">
            <div className="text-xs text-slate-400 font-mono tracking-widest uppercase">Word Manuscripts</div>
            <div className="text-3xl font-bold text-white">{stats.docsGenerated} files</div>
            <div className="text-[11px] text-slate-500">APA format Word .docx packs</div>
          </div>
        </section>

        {/* SPLIT MODULES: CONNECTION & SANDBOX */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: WHATSAPP QR GATEWAY */}
          <div className="lg:col-span-5 bg-slate-850/50 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Wifi className="w-5 h-5 text-teal-400" />
                WhatsApp Authenticator
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Scan this QR code from WhatsApp &gt; Linked Devices to start the bot session database. Credentials save locally.
              </p>
            </div>

            {/* QR BOX DISPLAY */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-900/60 rounded-xl border border-slate-800 min-h-[300px]">
              {status.connected ? (
                <div className="text-center space-y-4">
                  <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-white">BotVault Connection Secured</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Ready to answer customers, load data bundles, and generate coursework materials.
                    </p>
                  </div>
                </div>
              ) : status.qr ? (
                <div className="text-center space-y-4">
                  {/* Clean QR generation using public secure QR endpoint */}
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(status.qr)}`} 
                    alt="WhatsApp QR Code Authentication" 
                    className="w-[200px] h-[200px] rounded-lg border-2 border-slate-700 bg-white p-2 mx-auto"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="font-semibold text-amber-400 text-sm">Action Needed: Scan QR Code</h4>
                    <p className="text-[11px] text-slate-450 mt-1 max-w-xs mx-auto">
                      Scan within 35 seconds. This code updates automatically.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-450">Generating Authentication States</h4>
                    <p className="text-xs text-slate-550 mt-1 max-w-xs">
                      Checking local auth session directories... Please wait.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Meta values */}
            <div className="text-[11px] text-slate-500 space-y-1 bg-slate-900/40 p-3 rounded-lg font-mono border border-slate-800/40">
              <div>📍 Project DB: <span className="text-teal-400">aerobic-limiter-jtsmh</span></div>
              <div>💬 Cust Admin: <span className="text-slate-350">+{status.adminPhone}</span></div>
            </div>
          </div>

          {/* RIGHT: TRANS-SANDBOX TESTING UNIT */}
          <div className="lg:col-span-7 bg-slate-850/50 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-400" />
                  Developer Sandbox & Trigger Panel
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Because this is running in a preview container, you can bypass real credit card billing. Create an order on the bot, copy the transaction invoice reference code (e.g. <span className="font-mono text-teal-400">BV-XXXXXX-XXX</span>), and paste it below to mock a successful Flutterwave webhook payout!
                </p>
              </div>

              {/* Developer Test Form */}
              <form onSubmit={handleTestPaymentSimulation} className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">Invoice Order Reference Code (txRef)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="e.g. BV-123456-789"
                      value={testTxRef}
                      onChange={(e) => setTestTxRef(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 font-mono uppercase text-white placeholder:text-slate-600"
                    />
                    <button 
                      type="submit" 
                      disabled={isSimulating || !testTxRef}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 px-4 py-2 rounded-lg text-sm font-semibold transition hover:cursor-pointer flex items-center gap-1 w-auto shrink-0"
                    >
                      {isSimulating ? (
                        <div className="w-4 h-4 border-2 border-indigo-200 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        "Simulate Payout"
                      )}
                    </button>
                  </div>
                </div>

                {/* Simulated payment output */}
                {testResult.success !== null && (
                  <div className={`p-3 rounded-lg text-xs border ${testResult.success ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}`}>
                    <div className="font-semibold">{testResult.success ? "🎉 MOCK PAYMENT SUCCESSFUL" : "⚠️ GATEWAY REJECT"}</div>
                    <div className="mt-1 font-mono text-[11px]">{testResult.message}</div>
                  </div>
                )}
              </form>

              {/* Step manual walkthrough */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">How to test BotVault:</h4>
                <ol className="text-xs text-slate-400 list-decimal list-inside space-y-1.5 pl-1.5">
                  <li>Scan the WhatsApp QR code with your phone to connect the bot</li>
                  <li>Open the WhatsApp chat of the connected number on another device</li>
                  <li>Type <span className="font-semibold text-white">"hi"</span> to open BotVault's main menu, select any package, and proceed to invoice generation</li>
                  <li>Copy the reference code (starts with <span className="font-mono text-teal-400">BV-</span>)</li>
                  <li>Paste it into the sandbox block above and click <span className="font-semibold text-white">"Simulate Payout"</span>. The bot will automatically verify, compile the text or Word .docx, and dispatch it to your chat instantly!</li>
                </ol>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 font-mono mt-4 leading-relaxed pt-2 border-t border-slate-800 flex items-center justify-between">
              <span>LBtech Webhook Client endpoint:</span>
              <span className="text-indigo-400 text-right cursor-pointer" onClick={() => setTestTxRef(orders[0]?.txRef || "")}>
                {orders[0] ? `Load latest Ref (${orders[0].txRef})` : "No pending orders on file"}
              </span>
            </div>
          </div>
        </div>

        {/* LEDGER LOGGER TABLE */}
        <section className="bg-slate-850/50 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Durable Transactional Ledger (Firestore "orders")
              </h3>
              <p className="text-xs text-slate-400">
                Pulls the live transaction list of the 10 most recent automated order logs.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700/80">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Status:</span>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-transparent border-none text-xs text-white font-semibold focus:outline-none focus:ring-0 cursor-pointer pr-1"
                >
                  <option value="all" className="bg-slate-900 text-white">All Orders</option>
                  <option value="paid" className="bg-slate-900 text-white">Paid</option>
                  <option value="pending" className="bg-slate-900 text-white">Pending</option>
                </select>
              </div>
              <button 
                onClick={fetchOrders}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium border border-slate-700/60 hover:border-slate-600 rounded-lg transition text-center shrink-0"
              >
                Force Sync Ledger
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-850 bg-slate-900/20">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/50 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Order Ref</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Recipient (JID)</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Item Details</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loadingOrders ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 animate-pulse font-mono">
                      Establishing database connection...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                      {statusFilter === "all" 
                        ? "Empty Ledger. Trigger a conversation on WhatsApp to register pending transactions." 
                        : `No ${statusFilter} orders on file.`}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord: any) => (
                    <tr key={ord.id} className="hover:bg-slate-800/20 transition">
                      <td className="p-4 font-mono text-slate-450">
                        {ord.createdAt ? new Date(ord.createdAt).toLocaleTimeString() : "N/A"}
                      </td>
                      <td className="p-4 font-mono font-semibold text-slate-100">{ord.txRef}</td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                          ord.type === "DATA" 
                            ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" 
                            : ord.type === "ASSIGNMENT" 
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                            : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        }`}>
                          {ord.type === "DATA" ? <Share2 className="w-3 h-3" /> : ord.type === "ASSIGNMENT" ? <BookOpen className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                          {ord.type}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-400 max-w-[150px] truncate" title={ord.phone}>
                        {ord.phone.split("@")[0]}
                      </td>
                      <td className="p-4 font-mono font-bold text-white">₦{ord.amount}</td>
                      <td className="p-4 max-w-[200px] truncate text-slate-350" title={ord.planName || ord.details?.title || ""}>
                        {ord.type === "DATA" ? `${ord.network} - ${ord.planName}` : ord.type === "ASSIGNMENT" ? ord.details?.question : `Paper: "${ord.details?.title}"`}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        {ord.status === "paid" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                            ✅ Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                            ⏳ Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* Footer Copyright */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 space-y-2">
          <div>BotVault by LBtech. Built for automated digital product operations.</div>
          <div className="font-mono text-[10px] text-slate-650">Cloud Run Sandboxed Session. Database backed by Google Firestore. AI by Gemini 1.5 Flash.</div>
        </div>
      </footer>
    </div>
  );
}
