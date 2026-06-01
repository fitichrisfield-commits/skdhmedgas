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

const DEFAULT_MANAGER_PIN = "1234";
const MANAGER_PIN_KEY = "pos_manager_pin";

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

function MobileHeader({ view, settings, onSync, syncStatus, onPull, onManagerClick }) {
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
      <div className="flex items-center gap-1.5">
        <button onClick={onManagerClick} className="p-2 text-violet-500 hover:text-violet-700 rounded-xl hover:bg-violet-50 transition-colors" title="Manager View">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </button>
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

      {/* Payment status summary strip */}
      {invoices.length > 0 && (() => {
        const paid    = invoices.filter(i => i.status === "paid").length;
        const partial = invoices.filter(i => i.status === "partial").length;
        const unpaid  = invoices.filter(i => i.status === "unpaid").length;
        const total   = invoices.length;
        return (
          <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-2.5">
              <h2 className="font-semibold text-slate-700 text-sm">All-time Payment Status</h2>
              <span className="text-xs text-slate-400">{total} invoices</span>
            </div>
            <div className="flex gap-4 flex-wrap mb-3">
              {[
                { label: "Paid",    count: paid,    pct: Math.round(paid/total*100),    dot: "bg-emerald-500", text: "text-emerald-600" },
                { label: "Partial", count: partial, pct: Math.round(partial/total*100), dot: "bg-amber-500",   text: "text-amber-600" },
                { label: "Unpaid",  count: unpaid,  pct: Math.round(unpaid/total*100),  dot: "bg-red-400",     text: "text-red-500" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <span className="text-xs text-slate-500">{s.label}</span>
                  <span className={`text-xs font-bold ${s.text}`}>{s.count}</span>
                  <span className="text-xs text-slate-300">({s.pct}%)</span>
                </div>
              ))}
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
              <div className="bg-emerald-400 h-full transition-all" style={{ width: `${paid/total*100}%` }} />
              <div className="bg-amber-400 h-full transition-all" style={{ width: `${partial/total*100}%` }} />
              <div className="bg-red-400 h-full transition-all" style={{ width: `${unpaid/total*100}%` }} />
            </div>
          </div>
        );
      })()}

      <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h2 className="font-semibold text-slate-700 mb-3 text-sm">Recent Invoices</h2>
          {invoices.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No invoices yet</p>
          ) : invoices.slice(-8).reverse().map(inv => {
            const sub = inv.items.reduce((a, i) => a + i.qty * i.price, 0);
            const total = sub + sub * (settings.vatRate / 100) - (inv.discount || 0);
            const status = inv.status || "unpaid";
            const statusStyles = {
              paid:    { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-600 border border-emerald-100", label: "Paid" },
              partial: { dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-600 border border-amber-100",     label: "Partial" },
              unpaid:  { dot: "bg-red-400",     badge: "bg-red-50 text-red-500 border border-red-100",           label: "Unpaid" },
            };
            const s = statusStyles[status] || statusStyles.unpaid;
            return (
              <div key={inv.id} className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0 gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-700 truncate">{inv.invoiceNo}</p>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${s.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{inv.customerName || "Walk-in"} · {formatDate(inv.date)}</p>
                  {status === "partial" && (
                    <p className="text-[10px] text-amber-500 mt-0.5">Bal: {formatCurrency(inv.balance || 0, settings.currency)}</p>
                  )}
                </div>
                <span className="text-sm font-bold text-slate-800 shrink-0">{formatCurrency(total, settings.currency)}</span>
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
  const [search, setSearch]     = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [preview, setPreview]   = useState(null);
  const [paying, setPaying]     = useState(null);
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

  // counts
  const allCount     = invoices.length;
  const paidCount    = invoices.filter(i => i.status === "paid").length;
  const partialCount = invoices.filter(i => i.status === "partial").length;
  const unpaidCount  = invoices.filter(i => i.status === "unpaid").length;

  // totals
  const calcTotal = inv => {
    const sub = inv.items.reduce((a, i) => a + i.qty * i.price, 0);
    return sub + sub * (settings.vatRate / 100) - (inv.discount || 0);
  };
  const unpaidTotal  = invoices.filter(i => i.status === "unpaid").reduce((s, inv) => s + calcTotal(inv), 0);
  const partialTotal = invoices.filter(i => i.status === "partial").reduce((s, inv) => s + (inv.balance || 0), 0);
  const paidTotal    = invoices.filter(i => i.status === "paid").reduce((s, inv) => s + calcTotal(inv), 0);

  const TABS = [
    { id: "all",     label: "All",         count: allCount,     amount: null,         dot: "bg-slate-400",   ring: "border-slate-400",   active: "bg-slate-800 text-white",   inactive: "bg-slate-100 text-slate-600" },
    { id: "unpaid",  label: "Unpaid",      count: unpaidCount,  amount: unpaidTotal,  dot: "bg-red-400",     ring: "border-red-400",     active: "bg-red-500 text-white",     inactive: "bg-red-50 text-red-500" },
    { id: "partial", label: "Part Paid",   count: partialCount, amount: partialTotal, dot: "bg-amber-400",   ring: "border-amber-400",   active: "bg-amber-500 text-white",   inactive: "bg-amber-50 text-amber-600" },
    { id: "paid",    label: "Fully Paid",  count: paidCount,    amount: paidTotal,    dot: "bg-emerald-500", ring: "border-emerald-400", active: "bg-emerald-500 text-white", inactive: "bg-emerald-50 text-emerald-600" },
  ];

  const filtered = invoices
    .filter(inv => activeTab === "all" || inv.status === activeTab)
    .filter(inv =>
      inv.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
      (inv.customerName || "").toLowerCase().includes(search.toLowerCase())
    )
    .slice().reverse();

  const cur = settings.currency;

  const renderInvoiceCard = (inv) => {
    const total = calcTotal(inv);
    const status = inv.status || "unpaid";
    const statusConfig = {
      paid:    { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-600 border-emerald-100", label: "Fully Paid" },
      partial: { dot: "bg-amber-400",   badge: "bg-amber-50 text-amber-600 border-amber-100",       label: "Part Paid" },
      unpaid:  { dot: "bg-red-400",     badge: "bg-red-50 text-red-500 border-red-100",             label: "Unpaid" },
    };
    const sc = statusConfig[status] || statusConfig.unpaid;
    return (
      <div key={inv.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex justify-between items-start mb-1.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-cyan-600 text-sm">{inv.invoiceNo}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${sc.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
            </span>
          </div>
          <span className="font-bold text-slate-800 text-sm">{formatCurrency(total, cur)}</span>
        </div>
        <p className="text-sm font-medium text-slate-700">{inv.customerName || <span className="text-slate-400 italic">Walk-in</span>}</p>
        <div className="flex justify-between items-center mt-2">
          <div>
            <p className="text-xs text-slate-400">{formatDate(inv.date)} · {inv.paymentMethod || "Cash"}</p>
            {status === "partial" && <p className="text-xs text-amber-500 font-medium mt-0.5">Balance: {formatCurrency(inv.balance || 0, cur)}</p>}
            {status === "unpaid"  && <p className="text-xs text-red-400 font-medium mt-0.5">Owing: {formatCurrency(total, cur)}</p>}
            {status === "paid"    && <p className="text-xs text-emerald-500 font-medium mt-0.5">Collected: {formatCurrency(inv.amountPaid || 0, cur)}</p>}
          </div>
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
  };

  const activeTabCfg = TABS.find(t => t.id === activeTab);

  return (
    <div className={`p-4 ${isMobile ? "pb-24" : "p-6"} space-y-4`}>

      {/* Header */}
      {!isMobile && (
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Invoice History</h1>
            <p className="text-slate-500 text-sm">{allCount} total invoices</p>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..."
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 w-56" />
          </div>
        </div>
      )}

      {/* Mobile search */}
      {isMobile && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..."
            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 w-full" />
        </div>
      )}

      {/* Summary cards (non-mobile) */}
      {!isMobile && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Unpaid",    amount: unpaidTotal,  count: unpaidCount,  bg: "bg-red-50",     border: "border-red-100",     text: "text-red-500",     badge: "bg-red-100 text-red-600" },
            { label: "Outstanding Balance (Part Paid)", amount: partialTotal, count: partialCount, bg: "bg-amber-50",   border: "border-amber-100",   text: "text-amber-600",   badge: "bg-amber-100 text-amber-700" },
            { label: "Total Collected (Fully Paid)", amount: paidTotal,   count: paidCount,   bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
          ].map((c, i) => (
            <div key={i} className={`rounded-2xl p-4 border ${c.bg} ${c.border}`}>
              <p className="text-xs font-semibold text-slate-500 mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.text}`}>{formatCurrency(c.amount, cur)}</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${c.badge} mt-1 inline-block`}>{c.count} invoice{c.count !== 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === tab.id ? tab.active + " shadow-sm" : tab.inactive}`}>
            <span className={`w-2 h-2 rounded-full ${activeTab === tab.id ? "bg-white/70" : tab.dot}`} />
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === tab.id ? "bg-white/20" : "bg-black/5"}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Active tab amount summary */}
      {activeTab !== "all" && activeTabCfg?.amount !== null && (
        <div className={`rounded-xl px-4 py-2.5 flex justify-between items-center text-sm font-semibold
          ${activeTab === "unpaid"  ? "bg-red-50 text-red-600 border border-red-100" : ""}
          ${activeTab === "partial" ? "bg-amber-50 text-amber-600 border border-amber-100" : ""}
          ${activeTab === "paid"    ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : ""}`}>
          <span>{activeTab === "partial" ? "Total outstanding balance" : activeTab === "unpaid" ? "Total amount owed" : "Total collected"}</span>
          <span className="font-bold">{formatCurrency(activeTabCfg.amount, cur)}</span>
        </div>
      )}

      {/* Invoice list — mobile cards */}
      {isMobile ? (
        <div className="space-y-2.5">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400"><FileText size={32} className="mx-auto mb-2 opacity-20" /><p className="text-sm">No invoices found</p></div>
          ) : filtered.map(inv => renderInvoiceCard(inv))}
        </div>
      ) : (
        /* Desktop table */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{["Invoice No.","Date","Customer","Payment","Status","Total","Paid","Balance","Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400 text-sm">No invoices found</td></tr>
              ) : filtered.map(inv => {
                const total  = calcTotal(inv);
                const status = inv.status || "unpaid";
                const statusConfig = {
                  paid:    { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-600 border-emerald-100", label: "Fully Paid" },
                  partial: { dot: "bg-amber-400",   badge: "bg-amber-50 text-amber-600 border-amber-100",       label: "Part Paid" },
                  unpaid:  { dot: "bg-red-400",     badge: "bg-red-50 text-red-500 border-red-100",             label: "Unpaid" },
                };
                const sc = statusConfig[status] || statusConfig.unpaid;
                return (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5"><span className="font-semibold text-cyan-600">{inv.invoiceNo}</span></td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">{formatDate(inv.date)}</td>
                    <td className="px-4 py-3.5 font-medium text-slate-700">{inv.customerName || <span className="text-slate-400 italic">Walk-in</span>}</td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">{inv.paymentMethod || "Cash"}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-lg border ${sc.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-800">{formatCurrency(total, cur)}</td>
                    <td className="px-4 py-3.5 text-emerald-600 font-medium text-xs">{formatCurrency(inv.amountPaid || 0, cur)}</td>
                    <td className={`px-4 py-3.5 font-medium text-xs ${(inv.balance || 0) > 0 ? "text-red-500" : "text-slate-400"}`}>{formatCurrency(inv.balance || 0, cur)}</td>
                    <td className="px-4 py-3.5">
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
              <div className="flex justify-between text-xs font-bold text-slate-800"><span>Total</span><span>{formatCurrency(paying._total, cur)}</span></div>
              <div className="flex justify-between text-xs text-slate-500"><span>Previously Paid</span><span>{formatCurrency(paying.amountPaid || 0, cur)}</span></div>
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

// ─── PIN Modal ────────────────────────────────────────────────────────────────

function PinModal({ onSuccess, onCancel, title = "Enter Manager PIN" }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const storedPin = ls.get(MANAGER_PIN_KEY, DEFAULT_MANAGER_PIN);

  const handleDigit = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      if (next === storedPin) {
        setTimeout(() => onSuccess(), 200);
      } else {
        setShake(true);
        setError(true);
        setTimeout(() => { setPin(""); setShake(false); }, 700);
      }
    }
  };

  const handleDel = () => { setPin(p => p.slice(0, -1)); setError(false); };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center px-4">
      <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-xs p-7 flex flex-col items-center ${shake ? "animate-[wiggle_0.4s_ease-in-out]" : ""}`}
        style={shake ? { animation: "wiggle 0.4s ease-in-out" } : {}}>
        <style>{`@keyframes wiggle { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }`}</style>
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <h2 className="font-bold text-slate-800 text-base mb-1">{title}</h2>
        <p className="text-xs text-slate-400 mb-5">Manager access required</p>

        {/* PIN dots */}
        <div className="flex gap-3 mb-6">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${
              pin.length > i
                ? error ? "bg-red-500 border-red-500" : "bg-violet-500 border-violet-500"
                : "border-slate-300 bg-transparent"
            }`} />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2.5 w-full mb-4">
          {[1,2,3,4,5,6,7,8,9].map(d => (
            <button key={d} onClick={() => handleDigit(String(d))}
              className="h-13 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-semibold text-lg transition-all">
              {d}
            </button>
          ))}
          <div />
          <button onClick={() => handleDigit("0")}
            className="py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-semibold text-lg transition-all">0</button>
          <button onClick={handleDel}
            className="py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 transition-all flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
          </button>
        </div>

        {error && <p className="text-xs text-red-500 mb-2 font-medium">Incorrect PIN — try again</p>}

        <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600 mt-1">Cancel</button>
      </div>
    </div>
  );
}

// ─── Manager Dashboard ────────────────────────────────────────────────────────

function ManagerDashboard({ invoices, products, settings, onSaveProduct, onDeleteProduct, onExit, bp }) {
  const isMobile = bp === "mobile";
  const [tab, setTab] = useState("overview"); // overview | stock | pin
  const [period, setPeriod] = useState("today"); // today | month | custom
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ ...BLANK_PRODUCT });
  const [changingPin, setChangingPin] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMsg, setPinMsg] = useState(null);

  // ── Period filtering ──
  const getFilteredInvoices = () => {
    const now = new Date();
    return invoices.filter(inv => {
      const d = new Date(inv.date);
      if (period === "today") return d.toDateString() === now.toDateString();
      if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (period === "custom") {
        const from = new Date(customFrom); from.setHours(0,0,0,0);
        const to   = new Date(customTo);   to.setHours(23,59,59,999);
        return d >= from && d <= to;
      }
      return true;
    });
  };

  const filtered = getFilteredInvoices();

  const calcTotal = (inv) => {
    const sub = inv.items.reduce((a, i) => a + i.qty * i.price, 0);
    return sub + sub * (settings.vatRate / 100) - (inv.discount || 0);
  };

  const totalRevenue    = filtered.reduce((s, inv) => s + calcTotal(inv), 0);
  const totalPaid       = filtered.reduce((s, inv) => s + (inv.amountPaid || 0), 0);
  const totalBalance    = filtered.reduce((s, inv) => s + (inv.balance || 0), 0);
  const invoiceCount    = filtered.length;
  const paidCount       = filtered.filter(i => i.status === "paid").length;
  const unpaidCount     = filtered.filter(i => i.status === "unpaid").length;
  const partialCount    = filtered.filter(i => i.status === "partial").length;

  // Top products in period
  const productSalesMap = {};
  const productRevenueMap = {};
  filtered.forEach(inv => inv.items.forEach(item => {
    productSalesMap[item.name]    = (productSalesMap[item.name]    || 0) + item.qty;
    productRevenueMap[item.name]  = (productRevenueMap[item.name]  || 0) + item.qty * item.price;
  }));
  const topProducts = Object.entries(productSalesMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Daily breakdown for custom/month
  const dailyMap = {};
  filtered.forEach(inv => {
    const key = new Date(inv.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dailyMap[key] = (dailyMap[key] || 0) + calcTotal(inv);
  });
  const dailyData = Object.entries(dailyMap).sort((a, b) => new Date(a[0]) - new Date(b[0]));
  const maxDay = Math.max(...dailyData.map(d => d[1]), 1);

  // Low stock
  const lowStock = products.filter(p => (p.stock ?? 0) <= 3).sort((a, b) => a.stock - b.stock);

  const periodLabel = period === "today" ? "Today" : period === "month" ? "This Month" : `${customFrom} → ${customTo}`;

  const startEditProduct = (p) => { setProductForm({ ...p }); setEditingProduct(p); };
  const startNewProduct  = () => { setProductForm({ ...BLANK_PRODUCT, id: genId() }); setEditingProduct("new"); };
  const handleSaveProduct = () => { onSaveProduct(productForm); setEditingProduct(null); };

  const handleChangePin = () => {
    const stored = ls.get(MANAGER_PIN_KEY, DEFAULT_MANAGER_PIN);
    if (oldPin !== stored) { setPinMsg({ type: "error", text: "Current PIN is incorrect" }); return; }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { setPinMsg({ type: "error", text: "New PIN must be exactly 4 digits" }); return; }
    if (newPin !== confirmPin) { setPinMsg({ type: "error", text: "PINs do not match" }); return; }
    ls.set(MANAGER_PIN_KEY, newPin);
    setPinMsg({ type: "success", text: "PIN changed successfully!" });
    setOldPin(""); setNewPin(""); setConfirmPin("");
    setTimeout(() => setPinMsg(null), 3000);
  };

  const cur = settings.currency;

  const TABS = [
    { id: "overview", label: "Overview",  icon: <TrendingUp size={15} /> },
    { id: "stock",    label: "Stock",     icon: <Package size={15} /> },
    { id: "pin",      label: "PIN",       icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-purple-900 to-slate-900" style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');`}</style>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/30 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Manager View</p>
            <p className="text-violet-300 text-[10px] mt-0.5 leading-none">{settings.companyName}</p>
          </div>
        </div>
        <button onClick={onExit}
          className="flex items-center gap-1.5 text-xs text-violet-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-all">
          <X size={12} /> Exit
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 pt-4">
        <div className="flex gap-1.5 bg-black/20 backdrop-blur-sm rounded-2xl p-1.5 w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${tab === t.id ? "bg-white text-violet-700 shadow" : "text-violet-200 hover:text-white hover:bg-white/10"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`px-4 sm:px-6 py-4 ${isMobile ? "pb-8" : "pb-8"}`}>

        {/* ── Overview Tab ── */}
        {tab === "overview" && (
          <div className="space-y-4">
            {/* Period selector */}
            <div className="flex flex-wrap gap-2 items-center">
              {["today","month","custom"].map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize ${period === p ? "bg-violet-500 text-white shadow" : "bg-white/10 text-violet-200 hover:bg-white/20"}`}>
                  {p === "today" ? "Today" : p === "month" ? "This Month" : "Custom Range"}
                </button>
              ))}
              {period === "custom" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    className="text-xs py-1.5 px-2 rounded-xl bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-violet-400/50" />
                  <span className="text-violet-300 text-xs">to</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    className="text-xs py-1.5 px-2 rounded-xl bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-violet-400/50" />
                </div>
              )}
            </div>

            {/* KPI cards */}
            <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
              {[
                { label: "Total Revenue",  value: formatCurrency(totalRevenue, cur),  sub: periodLabel, color: "from-violet-500 to-purple-600" },
                { label: "Amount Collected",value: formatCurrency(totalPaid, cur),     sub: `${paidCount} paid invoices`, color: "from-emerald-500 to-teal-600" },
                { label: "Outstanding",    value: formatCurrency(totalBalance, cur),   sub: `${unpaidCount + partialCount} unpaid`, color: "from-amber-500 to-orange-500" },
                { label: "Invoices",       value: invoiceCount,                        sub: periodLabel, color: "from-blue-500 to-cyan-500" },
              ].map((card, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <div className={`inline-block text-xs font-bold text-white bg-gradient-to-r ${card.color} px-2 py-0.5 rounded-lg mb-2`}>
                    {card.label}
                  </div>
                  <p className={`font-bold text-white ${isMobile ? "text-xl" : "text-2xl"} leading-none`}>{card.value}</p>
                  <p className="text-violet-300 text-xs mt-1">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Payment status breakdown */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <h3 className="text-white font-semibold text-sm mb-3">Payment Status Breakdown</h3>
              <div className="flex gap-4 flex-wrap">
                {[
                  { label: "Paid",    count: paidCount,    pct: invoiceCount ? Math.round(paidCount/invoiceCount*100) : 0,    color: "bg-emerald-500" },
                  { label: "Partial", count: partialCount, pct: invoiceCount ? Math.round(partialCount/invoiceCount*100) : 0, color: "bg-amber-500" },
                  { label: "Unpaid",  count: unpaidCount,  pct: invoiceCount ? Math.round(unpaidCount/invoiceCount*100) : 0,  color: "bg-red-500" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                    <span className="text-violet-200 text-xs">{s.label}</span>
                    <span className="text-white text-xs font-bold">{s.count}</span>
                    <span className="text-violet-400 text-xs">({s.pct}%)</span>
                  </div>
                ))}
              </div>
              {invoiceCount > 0 && (
                <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 h-full transition-all" style={{ width: `${paidCount/invoiceCount*100}%` }} />
                  <div className="bg-amber-500 h-full transition-all" style={{ width: `${partialCount/invoiceCount*100}%` }} />
                  <div className="bg-red-500 h-full transition-all" style={{ width: `${unpaidCount/invoiceCount*100}%` }} />
                </div>
              )}
            </div>

            {/* Daily chart — shown for month/custom */}
            {(period === "month" || period === "custom") && dailyData.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                <h3 className="text-white font-semibold text-sm mb-4">Daily Revenue</h3>
                <div className="flex items-end gap-1.5 h-28 overflow-x-auto pb-1">
                  {dailyData.map(([date, amt], i) => (
                    <div key={i} className="flex flex-col items-center gap-1 shrink-0" style={{ minWidth: dailyData.length > 15 ? "28px" : "auto", flex: dailyData.length <= 15 ? "1" : "none" }}>
                      <div className="relative group w-full flex justify-center">
                        <div className="bg-gradient-to-t from-violet-500 to-purple-400 rounded-t-lg w-full transition-all hover:from-violet-400 hover:to-purple-300"
                          style={{ height: `${Math.max((amt / maxDay) * 88, 4)}px` }} />
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {formatCurrency(amt, cur)}
                        </div>
                      </div>
                      <span className="text-[9px] text-violet-300 whitespace-nowrap">{date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top products */}
            {topProducts.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                <h3 className="text-white font-semibold text-sm mb-3">Top Products — {periodLabel}</h3>
                <div className="space-y-2.5">
                  {topProducts.map(([name, qty], i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-violet-400 w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-white font-medium truncate mr-2">{name}</span>
                          <span className="text-violet-300 shrink-0">{qty} units · {formatCurrency(productRevenueMap[name] || 0, cur)}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-violet-400 to-purple-400 rounded-full"
                            style={{ width: `${(qty / topProducts[0][1]) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invoiceCount === 0 && (
              <div className="text-center py-16">
                <TrendingUp size={40} className="mx-auto mb-3 text-violet-400 opacity-40" />
                <p className="text-violet-300 text-sm">No invoices for {periodLabel.toLowerCase()}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Stock Tab ── */}
        {tab === "stock" && (
          <div className="space-y-4">
            {/* Low stock alert */}
            {lowStock.length > 0 && (
              <div className="bg-amber-500/20 border border-amber-400/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={15} className="text-amber-400" />
                  <h3 className="text-amber-300 font-semibold text-sm">{lowStock.length} item{lowStock.length !== 1 ? "s" : ""} low on stock</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lowStock.map(p => (
                    <span key={p.id} className={`text-xs px-2.5 py-1 rounded-xl font-medium ${p.stock === 0 ? "bg-red-500/30 text-red-300 border border-red-400/30" : "bg-amber-500/20 text-amber-300 border border-amber-400/20"}`}>
                      {p.name} ({p.code}) — {p.stock ?? 0} left
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <p className="text-violet-200 text-sm font-medium">{products.length} products</p>
              <button onClick={startNewProduct}
                className="flex items-center gap-1.5 bg-violet-500 hover:bg-violet-400 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                <Plus size={13} /> Add Product
              </button>
            </div>

            {/* Products list */}
            <div className={`grid gap-2.5 ${isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"}`}>
              {products.map(p => (
                <div key={p.id} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/15 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[10px] font-semibold bg-violet-500/30 text-violet-300 px-1.5 py-0.5 rounded-md">{p.category}</span>
                      <p className="font-semibold text-white text-sm mt-1 leading-tight">{p.name}</p>
                      <p className="text-[10px] text-violet-400 font-mono mt-0.5">{p.code} · {p.unit}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEditProduct(p)} className="p-1.5 text-violet-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"><Edit2 size={13} /></button>
                      <button onClick={() => onDeleteProduct(p.id)} className="p-1.5 text-violet-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${(p.stock ?? 0) === 0 ? "bg-red-500/30 text-red-300" : (p.stock ?? 0) <= 3 ? "bg-amber-500/30 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                      {p.stock ?? 0} in stock
                    </span>
                    <span className="text-white font-bold text-sm">{formatCurrency(p.price, cur)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Add/Edit Product Modal */}
            {editingProduct && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
                <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:w-[440px] p-6 max-h-[90vh] overflow-y-auto">
                  <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-white">{editingProduct === "new" ? "Add Product" : "Edit Product"}</h2>
                    <button onClick={() => setEditingProduct(null)}><X size={18} className="text-violet-400" /></button>
                  </div>
                  <div className="space-y-3">
                    {[["name","Product Name","text"],["code","Product Code","text"],["unit","Unit","text"],["price","Price","number"],["stock","Stock on Hand","number"],["category","Category","text"],["description","Purity Level","text"]].map(([k,ph,t]) => (
                      <div key={k}>
                        <label className="text-xs font-semibold text-violet-400 uppercase tracking-wider">{ph}</label>
                        <input type={t} value={productForm[k]}
                          onChange={e => setProductForm(p => ({ ...p, [k]: t === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
                          placeholder={ph}
                          className="mt-1 w-full text-sm py-2 px-3 bg-white/10 border border-white/10 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50 placeholder-violet-500" />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-5">
                    <button onClick={() => setEditingProduct(null)} className="flex-1 py-3 border border-white/10 rounded-xl text-sm text-violet-300">Cancel</button>
                    <button onClick={handleSaveProduct} className="flex-1 py-3 bg-violet-500 hover:bg-violet-400 rounded-xl text-sm text-white font-semibold transition-colors">Save Product</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PIN Tab ── */}
        {tab === "pin" && (
          <div className="max-w-sm">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
              <h3 className="text-white font-semibold text-sm mb-4">Change Manager PIN</h3>
              <div className="space-y-3">
                {[
                  ["Current PIN", oldPin,    setOldPin],
                  ["New PIN (4 digits)", newPin, setNewPin],
                  ["Confirm New PIN", confirmPin, setConfirmPin],
                ].map(([label, val, setter], i) => (
                  <div key={i}>
                    <label className="text-xs font-semibold text-violet-400 uppercase tracking-wider">{label}</label>
                    <input type="password" maxLength={4} value={val} onChange={e => setter(e.target.value.replace(/\D/g,""))}
                      placeholder="••••"
                      className="mt-1 w-full text-sm py-2.5 px-3 bg-white/10 border border-white/10 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50 placeholder-violet-600 tracking-widest" />
                  </div>
                ))}
              </div>
              {pinMsg && (
                <div className={`mt-3 text-xs px-3 py-2 rounded-xl font-medium ${pinMsg.type === "error" ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                  {pinMsg.text}
                </div>
              )}
              <button onClick={handleChangePin}
                className="mt-4 w-full py-3 bg-violet-500 hover:bg-violet-400 rounded-xl text-sm text-white font-semibold transition-colors">
                Update PIN
              </button>
              <p className="text-violet-400 text-xs mt-3 text-center">Default PIN is <span className="font-mono font-bold">1234</span> — change it after first login.</p>
            </div>
          </div>
        )}

      </div>
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
  const [managerMode, setManagerMode] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
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

  // ── Manager mode ──
  if (managerMode) {
    return (
      <ManagerDashboard
        invoices={invoices}
        products={products}
        settings={settings}
        onSaveProduct={saveProduct}
        onDeleteProduct={deleteProduct}
        onExit={() => setManagerMode(false)}
        bp={bp}
      />
    );
  }

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

        :root {
          --bg-page: #f8fafc; --bg-card: #ffffff; --bg-input: #f8fafc;
          --bg-sidebar: #0f172a; --bg-hover: #f1f5f9; --border: #e2e8f0;
          --text-primary: #1e293b; --text-secondary: #64748b; --text-muted: #94a3b8;
          --topbar-bg: rgba(255,255,255,0.9);
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg-page: #0f172a; --bg-card: #1e293b; --bg-input: #0f172a;
            --bg-sidebar: #020617; --bg-hover: #293548; --border: #334155;
            --text-primary: #f1f5f9; --text-secondary: #94a3b8; --text-muted: #64748b;
            --topbar-bg: rgba(15,23,42,0.9);
          }
        }
        body { background: var(--bg-page); }
        .bg-white { background-color: var(--bg-card) !important; }
        .bg-slate-50 { background-color: var(--bg-page) !important; }
        .bg-slate-100 { background-color: var(--bg-hover) !important; }
        .border-slate-100, .border-slate-200 { border-color: var(--border) !important; }
        .text-slate-800, .text-slate-700 { color: var(--text-primary) !important; }
        .text-slate-600, .text-slate-500 { color: var(--text-secondary) !important; }
        .text-slate-400 { color: var(--text-muted) !important; }
        input, select, textarea {
          background-color: var(--bg-input) !important;
          border-color: var(--border) !important;
          color: var(--text-primary) !important;
        }
        input::placeholder, textarea::placeholder { color: var(--text-muted) !important; }
        .bg-slate-900 { background-color: var(--bg-sidebar) !important; }
        .border-slate-800 { border-color: #1e293b !important; }
        .hover\\:bg-slate-50\\/50:hover, .hover\\:bg-slate-100:hover, .hover\\:bg-slate-200:hover { background-color: var(--bg-hover) !important; }
        @media (prefers-color-scheme: dark) {
          .bg-slate-800 { background-color: #1e293b !important; }
          .bg-slate-700 { background-color: #293548 !important; }
          .hover\\:bg-slate-700:hover { background-color: #334155 !important; }
          .bg-amber-50 { background-color: #2d2005 !important; }
          .border-amber-100 { border-color: #78350f !important; }
          .bg-cyan-50 { background-color: #0a2540 !important; }
          .border-cyan-200 { border-color: #0e4d7a !important; }
          .bg-red-50 { background-color: #2d0a0a !important; }
          .bg-emerald-50 { background-color: #052d1e !important; }
          .bg-blue-50 { background-color: #0a1f3d !important; }
          .bg-purple-50 { background-color: #1a0a2d !important; }
          .text-slate-900 { color: #f1f5f9 !important; }
          .shadow-sm { box-shadow: 0 1px 3px rgba(0,0,0,0.4) !important; }
          .shadow-xl, .shadow-2xl { box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important; }
          .bg-white\\/90 { background-color: rgba(15,23,42,0.9) !important; }
          .bg-black\\/60 { background-color: rgba(0,0,0,0.75) !important; }
          .bg-black\\/40 { background-color: rgba(0,0,0,0.6) !important; }
          select option { background-color: #1e293b; color: #f1f5f9; }
          thead.bg-slate-50 { background-color: #162032 !important; }
          .border-slate-50 { border-color: #1e293b !important; }
          .border-b-2.border-slate-200 { border-color: #334155 !important; }
          .border-t-2.border-slate-200 { border-color: #334155 !important; }
          .border-t.border-slate-100 { border-color: #334155 !important; }
          .border-b.border-slate-100 { border-color: #1e293b !important; }
          .rounded-t-3xl { background-color: var(--bg-card) !important; }
        }

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
              <button onClick={() => setShowPinModal(true)} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors font-semibold">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Manager
              </button>
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
          <MobileHeader view={view} settings={settings} onSync={handleSync} syncStatus={syncStatus} onPull={handlePull} onManagerClick={() => setShowPinModal(true)} />
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

      {/* PIN modal */}
      {showPinModal && (
        <PinModal
          onSuccess={() => { setShowPinModal(false); setManagerMode(true); }}
          onCancel={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}
