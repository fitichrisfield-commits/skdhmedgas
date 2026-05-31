import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard, ShoppingCart, FileText, Package,
  Users, Settings, RefreshCw, Plus, Trash2, Edit2,
  Printer, Save, X, Check, Cloud, CloudOff, Search,
  AlertTriangle, Wind, TrendingUp, ChevronRight,
  Loader2, Github, Eye, EyeOff, UserPlus, Menu,
  ChevronUp, ArrowUp
} from "lucide-react";

// ─── Breakpoint Hook ──────────────────────────────────────────────────────────

function useBreakpoint() {
  const getBreakpoint = () => {
    const w = window.innerWidth;
    if (w < 640) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  };
  const [bp, setBp] = useState(getBreakpoint);
  useEffect(() => {
    const handler = () => setBp(getBreakpoint());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return bp;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES = ["GHS", "USD", "EUR", "GBP", "NGN", "ZAR"];

const DEFAULT_PRODUCTS = [
  { id: "p1",  name: "Medical Oxygen",    code: "O2-E",        unit: "E-Cylinder",        price: 850,  stock: 12, category: "Oxygen",      description: "E-size medical oxygen cylinder" },
  { id: "p2",  name: "Medical Oxygen",    code: "O2-H",        unit: "H-Cylinder",        price: 2400, stock: 6,  category: "Oxygen",      description: "H-size medical oxygen cylinder" },
  { id: "p3",  name: "Medical Oxygen",    code: "O2-D",        unit: "D-Cylinder",        price: 450,  stock: 15, category: "Oxygen",      description: "D-size medical oxygen cylinder" },
  { id: "p4",  name: "Nitrous Oxide",     code: "N2O-E",       unit: "E-Cylinder",        price: 1200, stock: 4,  category: "Nitrous Oxide",description: "Medical grade nitrous oxide" },
  { id: "p5",  name: "Carbon Dioxide",    code: "CO2-E",       unit: "E-Cylinder",        price: 950,  stock: 5,  category: "CO2",         description: "Medical grade carbon dioxide" },
  { id: "p6",  name: "Medical Air",       code: "AIR-H",       unit: "H-Cylinder",        price: 1800, stock: 4,  category: "Medical Air", description: "Compressed medical air" },
  { id: "p7",  name: "Nitrogen",          code: "N2-H",        unit: "H-Cylinder",        price: 1600, stock: 3,  category: "Nitrogen",    description: "Medical grade nitrogen" },
  { id: "p8",  name: "Oxygen Refill",     code: "O2-REFILL-E", unit: "E-Cylinder Refill", price: 350,  stock: 20, category: "Refill",      description: "Oxygen cylinder refill service" },
  { id: "p9",  name: "Oxygen Regulator",  code: "REG-O2",      unit: "pcs",               price: 2500, stock: 8,  category: "Equipment",   description: "Single-stage oxygen regulator" },
  { id: "p10", name: "Oxygen Tubing",     code: "TUBE-O2",     unit: "pcs",               price: 120,  stock: 30, category: "Consumables", description: "3m oxygen delivery tubing" },
];

const DEFAULT_SETTINGS = {
  companyName: "Sekyere Kumawu District Hospital",
  companyAddress: "Kumawu, Ashanti Region, Ghana",
  companyPhone: "+233 00 000 0000",
  companyEmail: "info@kumawuhospital.gov.gh",
  tinNumber: "",
  currency: "GHS",
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  githubBranch: "main",
  invoicePrefix: "OXY",
  vatRate: 0,
};

const PAYMENT_STATUS = {
  unpaid: { label: "Unpaid", tone: "bg-red-50 text-red-600" },
  partial: { label: "Partial", tone: "bg-amber-50 text-amber-600" },
  paid: { label: "Paid", tone: "bg-emerald-50 text-emerald-600" },
};

// ─── GitHub API ───────────────────────────────────────────────────────────────

const githubApi = {
  headers: (token) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github.v3+json",
  }),
  async getFile(owner, repo, path, token, branch = "main") {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
    if (branch) url.searchParams.set("ref", branch);
    url.searchParams.set("t", Date.now());
    const res = await fetch(url, { headers: this.headers(token) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub error: ${res.status}`);
    const data = await res.json();
    return { data: JSON.parse(atob(data.content.replace(/\n/g, ""))), sha: data.sha };
  },
  async putFile(owner, repo, path, content, token, branch = "main", sha = null) {
    const body = {
      message: `Backup ${path} via MedGas POS`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
      branch,
    };
    if (sha) body.sha = sha;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { method: "PUT", headers: this.headers(token), body: JSON.stringify(body) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `GitHub error: ${res.status}`); }
    return res.json();
  },
  async verifyToken(token) {
    const res = await fetch(`https://api.github.com/user`, { headers: this.headers(token) });
    if (res.status === 401) throw new Error("Invalid token — check it was copied correctly with no extra spaces.");
    if (!res.ok) throw new Error(`Token check failed: ${res.status}`);
    return res.json(); // returns { login: "username", ... }
  },
  async createRepo(owner, name, token) {
    // First verify token & get real username
    const user = await this.verifyToken(token);
    const existing = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers: this.headers(token) });
    if (existing.ok) {
      return { already_exists: true, owner: user.login };
    }
    if (existing.status !== 404) {
      const e = await existing.json().catch(() => ({}));
      throw new Error(e.message || `Repository check failed: ${existing.status}`);
    }
    // Create repo
    const res = await fetch(`https://api.github.com/user/repos`, {
      method: "POST",
      headers: this.headers(token),
      body: JSON.stringify({ name, description: "MedGas POS Data Repository", private: true, auto_init: true }),
    });
    if (res.status === 422) {
      // Repo already exists — that's fine, treat as success
      return { already_exists: true, owner: user.login };
    }
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.message || "Failed to create repository");
    }
    return res.json();
  },
};

const backupSettings = (settings) => {
  const { githubToken, ...safeSettings } = settings;
  return safeSettings;
};

const mergeSettings = (base) => {
  const connection = ls.get("pos_github_connection", {});
  return { ...DEFAULT_SETTINGS, ...base, ...connection };
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const genInvoiceNo = (prefix, invoices = []) => {
  const year = new Date().getFullYear();
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const max = invoices.reduce((highest, inv) => {
    const match = inv.invoiceNo?.match(re);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(5, "0")}`;
};
const formatCurrency = (amount, currency) => new Intl.NumberFormat("en-GH", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
const formatDate = (iso) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const ls = {
  get: (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

const getPaymentStatus = (invoice) => PAYMENT_STATUS[invoice.status] || PAYMENT_STATUS[invoice.status === "part-paid" ? "partial" : "paid"];
const paymentLabel = (invoice) => getPaymentStatus(invoice).label;
const saveSettings = (nextSettings) => {
  ls.set("pos_settings", nextSettings);
  ls.set("pos_github_connection", {
    githubToken: nextSettings.githubToken || "",
    githubOwner: nextSettings.githubOwner || "",
    githubRepo: nextSettings.githubRepo || "",
    githubBranch: nextSettings.githubBranch || "main",
  });
};

// ─── Invoice Preview ──────────────────────────────────────────────────────────

function InvoicePreview({ invoice, settings, onClose }) {
  const subtotal = invoice.items.reduce((s, i) => s + i.qty * i.price, 0);
  const vatAmt = subtotal * (settings.vatRate / 100);
  const total = subtotal + vatAmt - (invoice.discount || 0);
  const cur = settings.currency;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-4 px-2">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center px-5 py-3 bg-slate-800 print:hidden">
          <span className="text-white font-semibold text-sm">Invoice Preview</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 bg-cyan-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-cyan-400 transition-colors">
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
          </div>
        </div>
        <div className="p-6 sm:p-10" id="invoice-print">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                  <Wind size={16} className="text-white" />
                </div>
                <h1 className="text-lg font-bold text-slate-800">{settings.companyName}</h1>
              </div>
              <p className="text-xs text-slate-500">{settings.companyAddress}</p>
              <p className="text-xs text-slate-500">{settings.companyPhone} · {settings.companyEmail}</p>
              {settings.tinNumber && <p className="text-xs text-slate-500">TIN: {settings.tinNumber}</p>}
            </div>
            <div className="text-left sm:text-right">
              <div className="inline-block bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-2">
                <p className="text-xs text-cyan-600 font-medium uppercase tracking-wider">Invoice</p>
                <p className="text-lg font-bold text-cyan-700">{invoice.invoiceNo}</p>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">Date: {formatDate(invoice.date)}</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Bill To</p>
            <p className="font-semibold text-slate-700">{invoice.customerName || "Walk-in Customer"}</p>
            {invoice.customerAddress && <p className="text-xs text-slate-500">{invoice.customerAddress}</p>}
            {invoice.customerPhone && <p className="text-xs text-slate-500">{invoice.customerPhone}</p>}
            <p className="text-xs text-slate-500 mt-2">Payment: {invoice.paymentMethod || "Cash"} · {paymentLabel(invoice)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm mb-5 min-w-[400px]">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  {["#","Item","Unit","Qty","Unit Price","Amount"].map(h => (
                    <th key={h} className="text-left py-2 text-xs text-slate-500 font-semibold uppercase tracking-wider pr-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2.5 text-slate-400 text-xs pr-2">{i + 1}</td>
                    <td className="py-2.5 pr-2"><p className="font-medium text-slate-700">{item.name}</p><p className="text-xs text-slate-400">{item.code}</p></td>
                    <td className="py-2.5 text-slate-500 text-xs pr-2">{item.unit}</td>
                    <td className="py-2.5 text-slate-700 pr-2">{item.qty}</td>
                    <td className="py-2.5 text-slate-700 pr-2">{formatCurrency(item.price, cur)}</td>
                    <td className="py-2.5 font-medium text-slate-800">{formatCurrency(item.qty * item.price, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <div className="w-56 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500"><span>Subtotal</span><span>{formatCurrency(subtotal, cur)}</span></div>
              {settings.vatRate > 0 && <div className="flex justify-between text-xs text-slate-500"><span>VAT ({settings.vatRate}%)</span><span>{formatCurrency(vatAmt, cur)}</span></div>}
              {invoice.discount > 0 && <div className="flex justify-between text-xs text-emerald-600"><span>Discount</span><span>-{formatCurrency(invoice.discount, cur)}</span></div>}
              <div className="flex justify-between font-bold text-sm text-slate-800 border-t-2 border-slate-200 pt-2"><span>TOTAL</span><span>{formatCurrency(total, cur)}</span></div>
              <div className="flex justify-between text-xs text-slate-500"><span>Paid</span><span>{formatCurrency(invoice.amountPaid || 0, cur)}</span></div>
              {(invoice.balance || 0) > 0 && <div className="flex justify-between text-xs font-semibold text-amber-600"><span>Balance</span><span>{formatCurrency(invoice.balance, cur)}</span></div>}
            </div>
          </div>
          {invoice.notes && (
            <div className="mt-5 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-600 mb-1">Notes</p>
              <p className="text-xs text-slate-600">{invoice.notes}</p>
            </div>
          )}
          <div className="mt-8 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">Thank you for your business · {settings.companyName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Navigation Config ────────────────────────────────────────────────────────

const NAV = [
  { id: "dashboard",   icon: LayoutDashboard, label: "Dashboard" },
  { id: "new-invoice", icon: ShoppingCart,     label: "New Invoice" },
  { id: "invoices",    icon: FileText,         label: "Invoices" },
  { id: "products",    icon: Package,          label: "Products" },
  { id: "customers",   icon: Users,            label: "Customers" },
  { id: "settings",    icon: Settings,         label: "Settings" },
];

// ─── Desktop/Tablet Sidebar ───────────────────────────────────────────────────

function Sidebar({ view, setView, syncStatus, onSync, collapsed, setCollapsed, bp }) {
  const isTablet = bp === "tablet";

  return (
    <aside className={`${collapsed ? "w-16" : "w-56"} bg-slate-900 flex flex-col h-screen sticky top-0 transition-all duration-300 shrink-0`}>
      {/* Logo */}
      <div className={`px-4 py-5 border-b border-slate-800 flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shrink-0">
          <Wind size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-white font-bold text-sm leading-none">MedGas</p>
            <p className="text-slate-400 text-xs mt-0.5">Point of Sale</p>
          </div>
        )}
        {isTablet && (
          <button onClick={() => setCollapsed(v => !v)} className={`ml-auto text-slate-500 hover:text-slate-300 transition-colors ${collapsed ? "hidden" : ""}`}>
            <Menu size={15} />
          </button>
        )}
      </div>

      {/* Collapse toggle for tablet when collapsed */}
      {isTablet && collapsed && (
        <button onClick={() => setCollapsed(false)} className="py-2 flex justify-center text-slate-500 hover:text-slate-300 border-b border-slate-800">
          <Menu size={15} />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setView(id)}
            title={collapsed ? label : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              collapsed ? "justify-center" : ""
            } ${view === id ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}>
            <Icon size={16} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
            {!collapsed && view === id && <ChevronRight size={12} className="ml-auto text-cyan-400 shrink-0" />}
          </button>
        ))}
      </nav>

      {/* Sync */}
      <div className="px-2 pb-4">
        <button onClick={onSync} disabled={syncStatus === "syncing"}
          title={collapsed ? "Sync to GitHub" : undefined}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all ${collapsed ? "justify-center" : ""}`}>
          {syncStatus === "syncing" ? <Loader2 size={14} className="animate-spin text-cyan-400 shrink-0" />
           : syncStatus === "success" ? <Cloud size={14} className="text-emerald-400 shrink-0" />
           : syncStatus === "error"   ? <CloudOff size={14} className="text-red-400 shrink-0" />
           : <Github size={14} className="text-slate-400 shrink-0" />}
          {!collapsed && (
            <span>{syncStatus === "syncing" ? "Syncing..." : syncStatus === "success" ? "Synced" : syncStatus === "error" ? "Sync Failed" : "Sync to GitHub"}</span>
          )}
        </button>
      </div>
    </aside>
  );
}

// ─── Mobile Bottom Nav ────────────────────────────────────────────────────────

function BottomNav({ view, setView }) {
  const MOBILE_NAV = NAV.slice(0, 5); // Show first 5 in bottom nav
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex safe-bottom">
      {MOBILE_NAV.map(({ id, icon: Icon, label }) => (
        <button key={id} onClick={() => setView(id)}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
            view === id ? "text-cyan-500" : "text-slate-400"
          }`}>
          <Icon size={20} strokeWidth={view === id ? 2.5 : 1.8} />
          <span className="text-[9px] font-medium leading-none">{label.replace(" Invoice", "")}</span>
        </button>
      ))}
      <button onClick={() => setView("settings")}
        className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${view === "settings" ? "text-cyan-500" : "text-slate-400"}`}>
        <Settings size={20} strokeWidth={view === "settings" ? 2.5 : 1.8} />
        <span className="text-[9px] font-medium leading-none">More</span>
      </button>
    </nav>
  );
}

// ─── Mobile Header ────────────────────────────────────────────────────────────

function MobileHeader({ view, settings, onSync, syncStatus, onPull }) {
  const title = NAV.find(n => n.id === view)?.label || "";
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
          <Wind size={13} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800 leading-none">{title}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{settings.companyName}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onPull} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
          <RefreshCw size={16} />
        </button>
        <button onClick={onSync} disabled={syncStatus === "syncing"}
          className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
          {syncStatus === "syncing" ? <Loader2 size={16} className="animate-spin text-cyan-500" />
           : syncStatus === "success" ? <Cloud size={16} className="text-emerald-500" />
           : syncStatus === "error"   ? <CloudOff size={16} className="text-red-500" />
           : <Github size={16} />}
        </button>
      </div>
    </header>
  );
}

// ─── ClipboardList Icon (custom) ──────────────────────────────────────────────

const ClipboardList = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
    <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
  </svg>
);

// ─── Dashboard View ───────────────────────────────────────────────────────────

function Dashboard({ invoices, products, customers, settings, bp }) {
  const today = new Date().toDateString();
  const todayInvoices = invoices.filter(i => new Date(i.date).toDateString() === today);
  const todaySales = todayInvoices.reduce((s, inv) => {
    const sub = inv.items.reduce((a, i) => a + i.qty * i.price, 0);
    return s + sub + sub * (settings.vatRate / 100) - (inv.discount || 0);
  }, 0);
  const totalSales = invoices.reduce((s, inv) => {
    const sub = inv.items.reduce((a, i) => a + i.qty * i.price, 0);
    return s + sub + sub * (settings.vatRate / 100) - (inv.discount || 0);
  }, 0);

  const productSales = {};
  invoices.forEach(inv => inv.items.forEach(item => {
    productSales[item.name] = (productSales[item.name] || 0) + item.qty;
  }));
  const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const stats = [
    { label: "Today's Sales",   value: formatCurrency(todaySales, settings.currency), color: "text-emerald-500", bg: "bg-emerald-50",  icon: TrendingUp },
    { label: "Today's Invoices",value: todayInvoices.length,                           color: "text-blue-500",   bg: "bg-blue-50",     icon: FileText },
    { label: "Total Revenue",   value: formatCurrency(totalSales, settings.currency),  color: "text-cyan-500",   bg: "bg-cyan-50",     icon: TrendingUp },
    { label: "All Invoices",    value: invoices.length,                                color: "text-purple-500", bg: "bg-purple-50",   icon: ClipboardList },
  ];

  const isMobile = bp === "mobile";

  return (
    <div className={`p-4 ${isMobile ? "pb-24" : "p-6"} space-y-4`}>
      {!isMobile && (
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      )}

      <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-2.5`}>
              <s.icon size={16} className={s.color} />
            </div>
            <p className={`font-bold text-slate-800 ${isMobile ? "text-lg" : "text-2xl"}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h2 className="font-semibold text-slate-700 mb-3 text-sm">Recent Invoices</h2>
          {invoices.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No invoices yet</p>
          ) : invoices.slice(-5).reverse().map(inv => {
            const sub = inv.items.reduce((a, i) => a + i.qty * i.price, 0);
            const total = sub + sub * (settings.vatRate / 100) - (inv.discount || 0);
            return (
              <div key={inv.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700">{inv.invoiceNo}</p>
                  <p className="text-xs text-slate-400">{inv.customerName || "Walk-in"} · {formatDate(inv.date)}</p>
                </div>
                <span className="text-sm font-semibold text-slate-800">{formatCurrency(total, settings.currency)}</span>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h2 className="font-semibold text-slate-700 mb-3 text-sm">Top Products</h2>
          {topProducts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No sales data yet</p>
          ) : topProducts.map(([name, qty], i) => (
            <div key={i} className="flex items-center gap-3 mb-2.5">
              <span className="text-xs font-bold text-slate-400 w-4 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-700 font-medium truncate mr-2">{name}</span>
                  <span className="text-slate-400 shrink-0">{qty} units</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full" style={{ width: `${(qty / topProducts[0][1]) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── New Invoice View ─────────────────────────────────────────────────────────

function NewInvoice({ products, customers, invoices, settings, onSave, bp }) {
  const isMobile = bp === "mobile";
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [customerMode, setCustomerMode] = useState("select");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [manualCustomer, setManualCustomer] = useState({ name: "", address: "", phone: "" });
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(null);
  const [cartOpen, setCartOpen] = useState(false); // mobile cart drawer

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product) => {
    if ((product.stock ?? 0) <= 0) return;
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) {
        const nextQty = Math.min(ex.qty + 1, product.stock ?? ex.qty + 1);
        return prev.map(i => i.id === product.id ? { ...i, qty: nextQty } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
    if (isMobile) setCartOpen(true);
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) setCart(prev => prev.filter(i => i.id !== id));
    else setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.min(qty, i.stock ?? qty) } : i));
  };

  const updatePrice = (id, price) => setCart(prev => prev.map(i => i.id === id ? { ...i, price: parseFloat(price) || 0 } : i));

  const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const vatAmt = subtotal * (settings.vatRate / 100);
  const total = subtotal + vatAmt - discount;
  const effectiveAmountPaid = Math.min(Math.max(amountPaid, 0), total);
  const balance = Math.max(total - effectiveAmountPaid, 0);
  const paymentStatus = effectiveAmountPaid <= 0 ? "unpaid" : balance > 0 ? "partial" : "paid";
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const customer = customerMode === "select" ? selectedCustomer : manualCustomer;

  const handleSave = (andPrint = false) => {
    if (cart.length === 0) return;
    const invoice = {
      id: genId(),
      invoiceNo: genInvoiceNo(settings.invoicePrefix, invoices),
      date: new Date().toISOString(),
      dueDate: new Date().toISOString(),
      customerName: customer?.name || "",
      customerAddress: customer?.address || "",
      customerPhone: customer?.phone || "",
      items: cart.map(i => ({ id: i.id, name: i.name, code: i.code, unit: i.unit, qty: i.qty, price: i.price })),
      discount,
      amountPaid: effectiveAmountPaid,
      balance,
      paymentMethod,
      notes,
      status: paymentStatus,
    };
    onSave(invoice);
    setSaved(true);
    if (andPrint) setPreview(invoice);
    setTimeout(() => {
      setCart([]); setSelectedCustomer(null); setManualCustomer({ name: "", address: "", phone: "" });
      setDiscount(0); setAmountPaid(0); setPaymentMethod("Cash"); setNotes(""); setSaved(false); setCartOpen(false);
    }, 1500);
  };

  // Shared cart panel content — rendered as JSX, not a component, to avoid remount on keystroke
  const renderCartPanel = () => (
    <>
      {/* Customer */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex gap-2 mb-2.5">
          <button onClick={() => setCustomerMode("select")} className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${customerMode === "select" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>Existing</button>
          <button onClick={() => setCustomerMode("manual")} className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${customerMode === "manual" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>Walk-in</button>
        </div>
        {customerMode === "select" ? (
          <select value={selectedCustomer?.id || ""} onChange={e => setSelectedCustomer(customers.find(c => c.id === e.target.value) || null)}
            className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none">
            <option value="">-- Select Customer --</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : (
          <div className="space-y-2">
            {[["name","Customer Name"],["address","Address"],["phone","Phone"]].map(([k,ph]) => (
              <input key={k} value={manualCustomer[k]} onChange={e => setManualCustomer(p => ({ ...p, [k]: e.target.value }))}
                placeholder={ph} className="w-full text-xs py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none" />
            ))}
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {cart.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <ShoppingCart size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">Add products to cart</p>
          </div>
        ) : cart.map(item => (
          <div key={item.id} className="bg-slate-50 rounded-xl p-3">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 mr-2">
                <p className="text-xs font-semibold text-slate-700 leading-tight">{item.name}</p>
                <p className="text-xs text-slate-400">{item.unit} · {item.stock ?? 0} in stock</p>
              </div>
              <button onClick={() => updateQty(item.id, 0)} className="text-slate-300 hover:text-red-400"><X size={13} /></button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200">
                <button onClick={() => updateQty(item.id, item.qty - 1)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-700 text-sm font-bold">-</button>
                <span className="text-xs font-semibold w-6 text-center text-slate-700">{item.qty}</span>
                <button onClick={() => updateQty(item.id, item.qty + 1)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-700 text-sm font-bold">+</button>
              </div>
              <span className="text-slate-400 text-xs">×</span>
              <input type="number" value={item.price} onChange={e => updatePrice(item.id, e.target.value)}
                className="flex-1 text-xs text-right py-1 px-2 border border-slate-200 rounded-lg bg-white focus:outline-none w-0" />
            </div>
            <p className="text-right text-xs font-bold text-slate-700 mt-1.5">{formatCurrency(item.qty * item.price, settings.currency)}</p>
          </div>
        ))}
      </div>

      {/* Totals & Actions */}
      <div className="p-4 border-t border-slate-100 space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 w-16 shrink-0">Discount</label>
          <input type="number" min={0} value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
            className="flex-1 text-xs py-1.5 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
            className="text-xs py-1.5 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none">
            {["Cash", "Mobile Money", "Bank Transfer", "NHIS/Account"].map(method => <option key={method}>{method}</option>)}
          </select>
          <input type="number" min={0} value={amountPaid} onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
            placeholder="Amount paid" className="text-xs py-1.5 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setAmountPaid(0)}
            className={`py-2 rounded-xl text-xs font-semibold transition-colors ${paymentStatus === "unpaid" ? "bg-red-500 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"}`}>
            Mark Unpaid
          </button>
          <button type="button" onClick={() => setAmountPaid(total)}
            className={`py-2 rounded-xl text-xs font-semibold transition-colors ${paymentStatus === "paid" ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}>
            Mark Paid
          </button>
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
          rows={2} className="w-full text-xs py-1.5 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none resize-none" />
        <div className="bg-slate-50 rounded-xl p-3 space-y-1">
          <div className="flex justify-between text-xs text-slate-500"><span>Subtotal</span><span>{formatCurrency(subtotal, settings.currency)}</span></div>
          {settings.vatRate > 0 && <div className="flex justify-between text-xs text-slate-500"><span>VAT {settings.vatRate}%</span><span>{formatCurrency(vatAmt, settings.currency)}</span></div>}
          {discount > 0 && <div className="flex justify-between text-xs text-emerald-600"><span>Discount</span><span>-{formatCurrency(discount, settings.currency)}</span></div>}
          <div className="flex justify-between text-sm font-bold text-slate-800 border-t border-slate-200 pt-1.5"><span>TOTAL</span><span>{formatCurrency(total, settings.currency)}</span></div>
          <div className="flex justify-between text-xs font-semibold"><span>Status</span><span className={PAYMENT_STATUS[paymentStatus].tone.split(" ")[1]}>{PAYMENT_STATUS[paymentStatus].label}</span></div>
          <div className="flex justify-between text-xs text-slate-500"><span>Paid</span><span>{formatCurrency(effectiveAmountPaid, settings.currency)}</span></div>
          {balance > 0 && <div className="flex justify-between text-xs font-semibold text-amber-600"><span>Balance</span><span>{formatCurrency(balance, settings.currency)}</span></div>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => handleSave(false)} disabled={cart.length === 0}
            className={`py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 ${saved ? "bg-emerald-500 text-white" : "bg-slate-800 text-white hover:bg-slate-700"}`}>
            {saved ? <><Check size={13} /> Saved!</> : <><Save size={13} /> Save</>}
          </button>
          <button onClick={() => handleSave(true)} disabled={cart.length === 0}
            className="py-3 rounded-xl text-xs font-semibold bg-cyan-500 text-white hover:bg-cyan-400 flex items-center justify-center gap-1.5 disabled:opacity-40">
            <Printer size={13} /> Print
          </button>
        </div>
      </div>
    </>
  );

  // ── Mobile layout: products full-width + cart drawer ──
  if (isMobile) {
    return (
      <div className="pb-32 relative">
        {/* Search */}
        <div className="px-4 pb-3 pt-1">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" />
          </div>
        </div>

        {/* Products grid */}
        <div className="px-4 grid grid-cols-2 gap-2.5">
          {filtered.map(p => (
            <button key={p.id} onClick={() => addToCart(p)} disabled={(p.stock ?? 0) <= 0}
              className="text-left bg-white border border-slate-200 rounded-2xl p-3.5 hover:border-cyan-400 active:scale-95 transition-all group shadow-sm disabled:opacity-40">
              <span className="text-[10px] font-semibold text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded-md">{p.category}</span>
              <p className="font-semibold text-slate-700 text-xs leading-tight mt-1.5">{p.name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{p.code} · {p.stock ?? 0} left</p>
              <p className="text-sm font-bold text-slate-800 mt-2">{formatCurrency(p.price, settings.currency)}</p>
            </button>
          ))}
        </div>

        {/* Cart FAB */}
        {cartCount > 0 && !cartOpen && (
          <button onClick={() => setCartOpen(true)}
            className="fixed bottom-20 right-4 z-40 bg-cyan-500 text-white w-14 h-14 rounded-2xl shadow-xl flex flex-col items-center justify-center hover:bg-cyan-400 active:scale-95 transition-all">
            <ShoppingCart size={20} />
            <span className="text-[10px] font-bold mt-0.5">{cartCount}</span>
          </button>
        )}

        {/* Cart Drawer */}
        {cartOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
            <div className="relative bg-white rounded-t-3xl flex flex-col max-h-[90vh] shadow-2xl">
              {/* Drawer handle */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div>
                  <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
                  <p className="font-bold text-slate-800 text-sm">Cart · {cartCount} item{cartCount !== 1 ? "s" : ""}</p>
                </div>
                <button onClick={() => setCartOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden">
                {renderCartPanel()}
              </div>
            </div>
          </div>
        )}

        {preview && <InvoicePreview invoice={preview} settings={settings} onClose={() => setPreview(null)} />}
      </div>
    );
  }

  // ── Desktop/Tablet layout: side-by-side ──
  return (
    <div className="flex h-[calc(100vh-53px)] overflow-hidden">
      {/* Products panel */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-100">
        <div className="p-5 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-800 mb-3">New Invoice</h1>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className={`grid gap-3 ${bp === "tablet" ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-3"}`}>
            {filtered.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} disabled={(p.stock ?? 0) <= 0}
                className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-cyan-400 hover:shadow-md hover:shadow-cyan-500/10 transition-all group disabled:opacity-40">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-semibold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-lg">{p.category}</span>
                  <Plus size={14} className="text-slate-300 group-hover:text-cyan-500 transition-colors mt-0.5" />
                </div>
                <p className="font-semibold text-slate-700 text-sm leading-tight">{p.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{p.code} · {p.unit} · {p.stock ?? 0} left</p>
                <p className="text-base font-bold text-slate-800 mt-2">{formatCurrency(p.price, settings.currency)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-72 xl:w-80 flex flex-col bg-white overflow-hidden">
        {renderCartPanel()}
      </div>

      {preview && <InvoicePreview invoice={preview} settings={settings} onClose={() => setPreview(null)} />}
    </div>
  );
}

// ─── Invoices View ────────────────────────────────────────────────────────────

function Invoices({ invoices, settings, onDelete, onUpdate, bp }) {
  const isMobile = bp === "mobile";
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);
  const [paying, setPaying] = useState(null);
  const [payInput, setPayInput] = useState(0);

  const openPay = (inv) => {
    const sub = inv.items.reduce((a, i) => a + i.qty * i.price, 0);
    const total = sub + sub * (settings.vatRate / 100) - (inv.discount || 0);
    setPaying({ ...inv, _total: total });
    setPayInput(inv.amountPaid || 0);
  };

  const handleUpdatePayment = () => {
    const total = paying._total;
    const paid = Math.min(Math.max(parseFloat(payInput) || 0, 0), total);
    const balance = Math.max(total - paid, 0);
    const status = paid <= 0 ? "unpaid" : balance > 0 ? "partial" : "paid";
    onUpdate({ ...paying, amountPaid: paid, balance, status, _total: undefined });
    setPaying(null);
  };

  const filtered = invoices.filter(inv =>
    inv.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
    (inv.customerName || "").toLowerCase().includes(search.toLowerCase())
  ).slice().reverse();

  return (
    <div className={`p-4 ${isMobile ? "pb-24" : "p-6"}`}>
      <div className="flex justify-between items-center mb-4">
        {!isMobile && <div><h1 className="text-xl font-bold text-slate-800">Invoice History</h1><p className="text-slate-500 text-sm">{invoices.length} total</p></div>}
        <div className={`relative ${isMobile ? "w-full" : ""}`}>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..."
            className={`pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${isMobile ? "w-full" : "w-56"}`} />
        </div>
      </div>

      {/* Mobile: card list */}
      {isMobile ? (
        <div className="space-y-2.5">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400"><FileText size={32} className="mx-auto mb-2 opacity-20" /><p className="text-sm">No invoices found</p></div>
          ) : filtered.map(inv => {
            const sub = inv.items.reduce((a, i) => a + i.qty * i.price, 0);
            const total = sub + sub * (settings.vatRate / 100) - (inv.discount || 0);
            return (
              <div key={inv.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-cyan-600 text-sm">{inv.invoiceNo}</span>
                  <span className="font-bold text-slate-800">{formatCurrency(total, settings.currency)}</span>
                </div>
                <p className="text-sm font-medium text-slate-700">{inv.customerName || <span className="text-slate-400 italic">Walk-in</span>}</p>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-slate-400">{formatDate(inv.date)} · {inv.paymentMethod || "Cash"} · <span className={getPaymentStatus(inv).tone.split(" ")[1]}>{paymentLabel(inv)}</span></p>
                  <div className="flex gap-1">
                    {inv.status !== "paid" && (
                      <button onClick={() => openPay(inv)} className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="Update Payment"><Check size={14} /></button>
                    )}
                    <button onClick={() => setPreview(inv)} className="p-1.5 text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 rounded-lg transition-colors"><Eye size={14} /></button>
                    <button onClick={() => onDelete(inv.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop/Tablet: table */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{["Invoice No.","Date","Customer","Payment","Status","Total","Actions"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No invoices found</td></tr>
              ) : filtered.map(inv => {
                const sub = inv.items.reduce((a, i) => a + i.qty * i.price, 0);
                const total = sub + sub * (settings.vatRate / 100) - (inv.discount || 0);
                return (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5"><span className="font-semibold text-cyan-600">{inv.invoiceNo}</span></td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{formatDate(inv.date)}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-700">{inv.customerName || <span className="text-slate-400 italic">Walk-in</span>}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{inv.paymentMethod || "Cash"}</td>
                    <td className="px-5 py-3.5"><span className={`text-xs px-2 py-0.5 rounded-lg ${getPaymentStatus(inv).tone}`}>{paymentLabel(inv)}</span></td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">{formatCurrency(total, settings.currency)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1">
                        {inv.status !== "paid" && (
                          <button onClick={() => openPay(inv)} className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="Update Payment"><Check size={14} /></button>
                        )}
                        <button onClick={() => setPreview(inv)} className="p-1.5 text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 rounded-lg transition-colors"><Eye size={14} /></button>
                        <button onClick={() => onDelete(inv.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Update Payment Modal */}
      {paying && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:w-[380px] p-6">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-slate-800">Update Payment</h2>
              <button onClick={() => setPaying(null)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-1">
              <div className="flex justify-between text-xs text-slate-500"><span>Invoice</span><span className="font-semibold text-cyan-600">{paying.invoiceNo}</span></div>
              <div className="flex justify-between text-xs text-slate-500"><span>Customer</span><span>{paying.customerName || "Walk-in"}</span></div>
              <div className="flex justify-between text-xs font-bold text-slate-800"><span>Total</span><span>{formatCurrency(paying._total, settings.currency)}</span></div>
              <div className="flex justify-between text-xs text-slate-500"><span>Previously Paid</span><span>{formatCurrency(paying.amountPaid || 0, settings.currency)}</span></div>
            </div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount Paid</label>
            <input type="number" value={payInput} onChange={e => setPayInput(e.target.value)}
              className="mt-1 w-full text-sm py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 mb-2" />
            <button onClick={() => setPayInput(paying._total)} className="text-xs text-cyan-600 hover:underline mb-4 block">Mark as fully paid</button>
            <div className="flex gap-2">
              <button onClick={() => setPaying(null)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm text-slate-600">Cancel</button>
              <button onClick={handleUpdatePayment} className="flex-1 py-3 bg-emerald-500 rounded-xl text-sm text-white font-semibold">Update</button>
            </div>
          </div>
        </div>
      )}

      {preview && <InvoicePreview invoice={preview} settings={settings} onClose={() => setPreview(null)} />}
    </div>
  );
}

// ─── Products View ────────────────────────────────────────────────────────────

const BLANK_PRODUCT = { name: "", code: "", unit: "pcs", price: 0, stock: 0, category: "Oxygen", description: "" };

function Products({ products, settings, onSave, onDelete, bp }) {
  const isMobile = bp === "mobile";
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_PRODUCT);

  const startEdit = (p) => { setForm({ ...p }); setEditing(p); };
  const startNew = () => { setForm({ ...BLANK_PRODUCT, id: genId() }); setEditing("new"); };
  const handleSave = () => { onSave(form); setEditing(null); };

  return (
    <div className={`p-4 ${isMobile ? "pb-24" : "p-6"}`}>
      <div className="flex justify-between items-center mb-4">
        {!isMobile && <div><h1 className="text-xl font-bold text-slate-800">Products</h1><p className="text-slate-500 text-sm">{products.length} products</p></div>}
        <button onClick={startNew} className={`flex items-center gap-2 bg-cyan-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-cyan-400 transition-colors ${isMobile ? "w-full justify-center" : ""}`}>
          <Plus size={15} /> Add Product
        </button>
      </div>

      {isMobile ? (
        <div className="space-y-2.5">
          {products.map(p => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-medium">{p.category}</span>
                    <span className="text-[10px] font-mono text-cyan-600">{p.code}</span>
                  </div>
                  <p className="font-semibold text-slate-700 text-sm">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.unit} · {p.stock ?? 0} in stock</p>
                  {p.description && <p className="text-xs text-slate-400 mt-0.5">Purity: {p.description}%</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-slate-800 text-sm">{formatCurrency(p.price, settings.currency)}</p>
                  <div className="flex gap-1 mt-1.5 justify-end">
                    <button onClick={() => startEdit(p)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={13} /></button>
                    <button onClick={() => onDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{["Code","Name","Category","Unit","Stock","Purity Level","Price",""].map((h,i) => (
                <th key={i} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs text-cyan-600 font-semibold">{p.code}</td>
                  <td className="px-5 py-3.5 font-medium text-slate-700">{p.name}</td>
                  <td className="px-5 py-3.5"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{p.category}</span></td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{p.unit}</td>
                  <td className={`px-5 py-3.5 text-xs font-semibold ${(p.stock ?? 0) <= 3 ? "text-red-500" : "text-slate-600"}`}>{p.stock ?? 0}</td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{p.description ? `${p.description}%` : "—"}</td>
                  <td className="px-5 py-3.5 font-bold text-slate-800">{formatCurrency(p.price, settings.currency)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(p)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                      <button onClick={() => onDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:w-[440px] p-6 max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-slate-800">{editing === "new" ? "Add Product" : "Edit Product"}</h2>
              <button onClick={() => setEditing(null)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              {[["name","Product Name","text"],["code","Product Code","text"],["unit","Unit","text"],["price","Price","number"],["stock","Stock on Hand","number"],["category","Category","text"],["description","Purity Level","text"]].map(([k,ph,t]) => (
                <div key={k}>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{ph}</label>
                  <input type={t} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: t === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
                    placeholder={ph} className="mt-1 w-full text-sm py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm text-slate-600">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-3 bg-cyan-500 rounded-xl text-sm text-white font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Customers View ───────────────────────────────────────────────────────────

const BLANK_CUSTOMER = { name: "", address: "", phone: "", email: "", notes: "" };

function CustomersView({ customers, onSave, onDelete, bp }) {
  const isMobile = bp === "mobile";
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_CUSTOMER);
  const startNew = () => { setForm({ ...BLANK_CUSTOMER, id: genId() }); setEditing("new"); };
  const startEdit = (c) => { setForm({ ...c }); setEditing(c); };

  return (
    <div className={`p-4 ${isMobile ? "pb-24" : "p-6"}`}>
      <div className="flex justify-between items-center mb-4">
        {!isMobile && <div><h1 className="text-xl font-bold text-slate-800">Customers</h1><p className="text-slate-500 text-sm">{customers.length} customers</p></div>}
        <button onClick={startNew} className={`flex items-center gap-2 bg-cyan-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-cyan-400 transition-colors ${isMobile ? "w-full justify-center" : ""}`}>
          <UserPlus size={15} /> Add Customer
        </button>
      </div>

      <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"}`}>
        {customers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400"><Users size={36} className="mx-auto mb-2 opacity-20" /><p>No customers yet</p></div>
        ) : customers.map(c => (
          <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex gap-3 items-start">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-800 text-sm truncate">{c.name}</h3>
              {c.phone && <p className="text-xs text-slate-500 mt-0.5">{c.phone}</p>}
              {c.email && <p className="text-xs text-slate-400 truncate">{c.email}</p>}
              {c.address && <p className="text-xs text-slate-400 mt-1 leading-tight">{c.address}</p>}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={() => startEdit(c)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={13} /></button>
              <button onClick={() => onDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:w-[400px] p-6 max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-slate-800">{editing === "new" ? "Add Customer" : "Edit Customer"}</h2>
              <button onClick={() => setEditing(null)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              {[["name","Full Name / Company"],["address","Address"],["phone","Phone"],["email","Email"],["notes","Notes"]].map(([k,ph]) => (
                <div key={k}>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{ph}</label>
                  <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={ph}
                    className="mt-1 w-full text-sm py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm text-slate-600">Cancel</button>
              <button onClick={() => { onSave(form); setEditing(null); }} className="flex-1 py-3 bg-cyan-500 rounded-xl text-sm text-white font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings View ────────────────────────────────────────────────────────────

function SettingsSection({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
      <h2 className="font-semibold mb-4 text-xs uppercase tracking-wider text-slate-400">{title}</h2>
      {children}
    </div>
  );
}

function SettingsView({ settings, onSave, onCreateRepo, repoStatus, bp }) {
  const isMobile = bp === "mobile";
  const [form, setForm] = useState({ ...settings });
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const repoStatusType = typeof repoStatus === "string" ? repoStatus : repoStatus?.type;

  const handleSave = () => {
    const nextForm = {
      ...form,
      githubToken: (form.githubToken || "").trim(),
      githubOwner: (form.githubOwner || "").trim(),
      githubRepo: (form.githubRepo || "").trim(),
      githubBranch: (form.githubBranch || "main").trim(),
    };
    onSave(nextForm);
    setForm(nextForm);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className={`p-4 ${isMobile ? "pb-28" : "p-6"} max-w-2xl`}>
      {!isMobile && <h1 className="text-xl font-bold text-slate-800 mb-5">Settings</h1>}

      <SettingsSection title="Company Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[["companyName","Company Name"],["companyPhone","Phone"],["companyEmail","Email"],["tinNumber","TIN Number"]].map(([k,ph]) => (
            <div key={k}>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{ph}</label>
              <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={ph}
                className="mt-1 w-full text-sm py-2.5 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none" />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Address</label>
            <input value={form.companyAddress} onChange={e => setForm(p => ({ ...p, companyAddress: e.target.value }))}
              className="mt-1 w-full text-sm py-2.5 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none" />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Invoice Settings">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Currency</label>
            <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
              className="mt-1 w-full text-sm py-2.5 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {[["vatRate","VAT %","number"],["invoicePrefix","Prefix","text"]].map(([k,ph,t]) => (
            <div key={k}>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{ph}</label>
              <input type={t} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: t === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
                className="mt-1 w-full text-sm py-2.5 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none" />
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="GitHub Data Sync">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-xs text-blue-700 leading-relaxed">
          Data syncs to a private GitHub repo as JSON. Generate a token with <strong>repo</strong> scope at github.com/settings/tokens.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">GitHub Token</label>
            <div className="relative mt-1">
              <input type={showToken ? "text" : "password"} value={form.githubToken} onChange={e => setForm(p => ({ ...p, githubToken: e.target.value }))}
                className="w-full text-sm py-2.5 px-3 pr-9 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none" />
              <button onClick={() => setShowToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          {[["githubOwner","Username"],["githubRepo","Repository"],["githubBranch","Branch"]].map(([k,ph]) => (
            <div key={k}>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{ph}</label>
              <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={ph}
                className="mt-1 w-full text-sm py-2.5 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none" />
            </div>
          ))}
        </div>
        <button onClick={() => onCreateRepo(form)} disabled={repoStatusType === "creating"}
          className={`mt-3 flex items-center gap-2 text-white text-xs px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60
            ${repoStatusType === "error" ? "bg-red-500 hover:bg-red-400" : repoStatusType === "created" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-800 hover:bg-slate-700"}`}>
          {repoStatusType === "creating" ? <Loader2 size={13} className="animate-spin" /> : <Github size={13} />}
          {repoStatusType === "creating" ? "Verifying..." : repoStatusType === "created" ? "✓ Repository Ready — Save Settings!" : repoStatusType === "error" ? "⚠ Failed — Check token & username, then retry" : "Create / Verify Repository"}
        </button>
        {repoStatusType === "error" && (
          <div className="mt-2 bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 space-y-1">
            {repoStatus.message && <p className="font-semibold">{repoStatus.message}</p>}
            <p className="font-semibold">Common fixes:</p>
            <p>• Make sure the token was copied with no extra spaces</p>
            <p>• GitHub Username must match exactly (case-sensitive)</p>
            <p>• Token must have the <strong>repo</strong> scope checked</p>
            <p>• Try generating a fresh token at github.com/settings/tokens</p>
          </div>
        )}
      </SettingsSection>

      <button onClick={handleSave}
        className={`w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${saved ? "bg-emerald-500 text-white" : "bg-cyan-500 text-white hover:bg-cyan-400"}`}>
        {saved ? <><Check size={15} /> Settings Saved!</> : <><Save size={15} /> Save Settings</>}
      </button>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";

  const [view, setView] = useState("dashboard");
  const [products,  setProducts]  = useState(() => ls.get("pos_products",  DEFAULT_PRODUCTS));
  const [invoices,  setInvoices]  = useState(() => ls.get("pos_invoices",  []));
  const [customers, setCustomers] = useState(() => ls.get("pos_customers", []));
  const [settings,  setSettings]  = useState(() => mergeSettings(ls.get("pos_settings",  DEFAULT_SETTINGS)));
  const [syncStatus,  setSyncStatus]  = useState("idle");
  const [repoStatus,  setRepoStatus]  = useState("idle");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTablet);
  const [toast, setToast] = useState(null);
  const autoPullDoneRef = useRef(false);
  const autoSyncReadyRef = useRef(false);
  const syncingFromRemoteRef = useRef(false);
  const syncTimerRef = useRef(null);
  const justPulledRef = useRef(false);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const hasGitHubConfig = Boolean(settings.githubToken && settings.githubOwner && settings.githubRepo);

  useEffect(() => { setSidebarCollapsed(isTablet); }, [isTablet]);
  useEffect(() => { ls.set("pos_products",  products);  }, [products]);
  useEffect(() => { ls.set("pos_invoices",  invoices);  }, [invoices]);
  useEffect(() => { ls.set("pos_customers", customers); }, [customers]);
  useEffect(() => { saveSettings(settings); }, [settings]);

  const handleSync = useCallback(async ({ silent = false } = {}) => {
    if (!settings.githubToken || !settings.githubOwner || !settings.githubRepo) {
      showToast("Configure GitHub settings first", "error"); setView("settings"); return;
    }
    setSyncStatus("syncing");
    try {
      const branch = settings.githubBranch || "main";
      const files = [
        ["data/products.json", products],
        ["data/invoices.json", invoices],
        ["data/customers.json", customers],
        ["data/settings.json", backupSettings(settings)],
      ];
      for (const [path, data] of files) {
        const existing = await githubApi.getFile(settings.githubOwner, settings.githubRepo, path, settings.githubToken, branch);
        await githubApi.putFile(settings.githubOwner, settings.githubRepo, path, data, settings.githubToken, branch, existing?.sha);
      }
      setSyncStatus("success");
      if (!silent) showToast("Synced to GitHub!");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (err) {
      setSyncStatus("error"); showToast(err.message || "Sync failed", "error"); setTimeout(() => setSyncStatus("idle"), 4000);
    }
  }, [settings, products, invoices, customers]);

  const handlePull = useCallback(async ({ silent = false } = {}) => {
    if (!settings.githubToken || !settings.githubOwner || !settings.githubRepo) {
      showToast("Configure GitHub settings first", "error"); setView("settings"); return;
    }
    try {
      syncingFromRemoteRef.current = true;
      const branch = settings.githubBranch || "main";
      const [p, inv, cust, cfg] = await Promise.all([
        githubApi.getFile(settings.githubOwner, settings.githubRepo, "data/products.json",  settings.githubToken, branch),
        githubApi.getFile(settings.githubOwner, settings.githubRepo, "data/invoices.json",  settings.githubToken, branch),
        githubApi.getFile(settings.githubOwner, settings.githubRepo, "data/customers.json", settings.githubToken, branch),
        githubApi.getFile(settings.githubOwner, settings.githubRepo, "data/settings.json",  settings.githubToken, branch),
      ]);
      if (p)    setProducts(p.data);
      if (inv)  setInvoices(inv.data);
      if (cust) setCustomers(cust.data);
      if (cfg)  setSettings(s => mergeSettings({ ...s, ...cfg.data, githubToken: settings.githubToken }));
      if (!silent) showToast("Data pulled from GitHub!");
      justPulledRef.current = true;
      setTimeout(() => {
        syncingFromRemoteRef.current = false;
        autoSyncReadyRef.current = true;
        // Allow auto-sync again after a brief delay so pulled data settles
        setTimeout(() => { justPulledRef.current = false; }, 2000);
      }, 500);
    } catch (err) {
      syncingFromRemoteRef.current = false;
      autoSyncReadyRef.current = true;
      showToast("Pull failed: " + err.message, "error");
    }
  }, [settings]);

  useEffect(() => {
    if (autoPullDoneRef.current || !hasGitHubConfig) return;
    autoPullDoneRef.current = true;
    handlePull({ silent: true });
  }, [hasGitHubConfig, handlePull]);

  // Auto-refresh from GitHub every 30 seconds
  useEffect(() => {
    if (!hasGitHubConfig) return;
    const interval = setInterval(() => {
      if (!syncingFromRemoteRef.current) {
        handlePull({ silent: true });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [hasGitHubConfig, handlePull]);

  useEffect(() => {
    if (!hasGitHubConfig || !autoPullDoneRef.current || !autoSyncReadyRef.current || syncingFromRemoteRef.current || justPulledRef.current) return;
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => handleSync({ silent: true }), 1200);
    return () => clearTimeout(syncTimerRef.current);
  }, [hasGitHubConfig, products, invoices, customers, settings, handleSync]);

  const handleCreateRepo = async (cfg) => {
    const token = (cfg.githubToken || "").trim();
    const owner = (cfg.githubOwner || "").trim();
    const repo  = (cfg.githubRepo  || "").trim();
    if (!token || !owner || !repo) {
      showToast("Fill in token, username, and repo name first", "error");
      return;
    }
    setRepoStatus("creating");
    try {
      const result = await githubApi.createRepo(owner, repo, token);
      setRepoStatus({ type: "created", message: "" });
      const nextSettings = { ...settings, githubToken: token, githubOwner: owner, githubRepo: repo, githubBranch: cfg.githubBranch || "main" };
      saveSettings(nextSettings);
      setSettings(nextSettings);
      showToast(result.already_exists ? "Repo already exists — ready to sync!" : "Repository created successfully!");
    } catch (err) {
      setRepoStatus({ type: "error", message: err.message || "Verification failed — check your token and username" });
      showToast(err.message || "Verification failed — check your token and username", "error");
    }
  };

  const saveProduct   = (p) => setProducts(prev  => prev.find(x => x.id === p.id) ? prev.map(x  => x.id  === p.id  ? p : x)  : [...prev, p]);
  const deleteProduct = (id) => setProducts(prev  => prev.filter(p => p.id !== id));
  const saveCustomer  = (c) => setCustomers(prev  => prev.find(x => x.id === c.id) ? prev.map(x  => x.id  === c.id  ? c : x)  : [...prev, c]);
  const deleteCustomer= (id) => setCustomers(prev => prev.filter(c => c.id !== id));
  const saveInvoice   = (inv) => {
    setInvoices(prev => {
      const updated = [...prev, inv];
      setTimeout(() => handleSync({ silent: true }), 300);
      return updated;
    });
    setProducts(prev => prev.map(product => {
      const sold = inv.items.find(item => item.id === product.id);
      return sold ? { ...product, stock: Math.max((product.stock ?? 0) - sold.qty, 0) } : product;
    }));
  };
  const deleteInvoice = (id) => { if (confirm("Delete this invoice?")) setInvoices(prev => prev.filter(i => i.id !== id)); };
  const updateInvoice = (inv) => { setInvoices(prev => prev.map(i => i.id === inv.id ? inv : i)); setTimeout(() => handleSync({ silent: true }), 300); };

  const sharedProps = { bp };

  const renderView = () => {
    switch (view) {
      case "dashboard":   return <Dashboard   invoices={invoices}  products={products}  customers={customers}  settings={settings} {...sharedProps} />;
      case "new-invoice": return <NewInvoice  products={products}  customers={customers} invoices={invoices}  settings={settings}  onSave={saveInvoice}    {...sharedProps} />;
      case "invoices":    return <Invoices    invoices={invoices}  settings={settings}  onDelete={deleteInvoice} onUpdate={updateInvoice}                                    {...sharedProps} />;
      case "products":    return <Products    products={products}  settings={settings}  onSave={saveProduct}   onDelete={deleteProduct}                    {...sharedProps} />;
      case "customers":   return <CustomersView customers={customers} onSave={saveCustomer} onDelete={deleteCustomer}                                      {...sharedProps} />;
      case "settings":    return <SettingsView settings={settings} onSave={setSettings} onCreateRepo={handleCreateRepo} repoStatus={repoStatus}            {...sharedProps} />;
      default: return null;
    }
  };

  return (
    <div className="flex bg-slate-50 min-h-screen" style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        @media print {
          html, body {
            background: #fff !important;
            margin: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #invoice-print,
          #invoice-print * {
            visibility: visible !important;
          }
          #invoice-print {
            background: #fff !important;
            display: block !important;
            left: 0 !important;
            padding: 24px !important;
            position: absolute !important;
            top: 0 !important;
            width: 100% !important;
          }
          .print\\:hidden { display: none !important; }
        }
        .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>

      {/* Sidebar: hidden on mobile, shown on tablet/desktop */}
      {!isMobile && (
        <Sidebar
          view={view} setView={setView}
          syncStatus={syncStatus} onSync={handleSync}
          collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed}
          bp={bp}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar: desktop/tablet */}
        {!isMobile && (
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-slate-100 px-5 py-3 flex justify-between items-center shrink-0">
            <p className="text-xs text-slate-400 truncate">{settings.companyName}</p>
            <div className="flex items-center gap-2.5 shrink-0">
              <button onClick={handlePull} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                <RefreshCw size={11} /> Pull
              </button>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Local Storage Active
              </div>
            </div>
          </div>
        )}

        {/* Mobile header */}
        {isMobile && (
          <MobileHeader view={view} settings={settings} onSync={handleSync} syncStatus={syncStatus} onPull={handlePull} />
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>

      {/* Bottom nav: mobile only */}
      {isMobile && <BottomNav view={view} setView={setView} />}

      {/* Toast */}
      {toast && (
        <div className={`fixed z-[60] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium transition-all
          ${isMobile ? "bottom-20 left-4 right-4" : "bottom-6 right-6"}
          ${toast.type === "error" ? "bg-red-500 text-white" : "bg-slate-800 text-white"}`}>
          {toast.type === "error" ? <AlertTriangle size={15} /> : <Check size={15} className="text-emerald-400" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
