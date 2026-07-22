import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import html2pdf from 'html2pdf.js';
import { installMonieziFonts, waitForMonieziFonts } from './src/monieziFonts';
import { generateTaxSummaryPdfBytes, generateProfitLossPdfBytes, type TaxSummaryPdfData, type ProfitLossPdfData } from './src/reportPdfEngine';
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Settings, 
  Plus, 
  X, 
  Trash2, 
  Download, 
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  BrainCircuit, 
  Sparkles, 
  Receipt, 
  Wallet, 
  BarChart3, 
  Sun, 
  Moon, 
  LayoutGrid, 
  CheckCircle, 
  AlertTriangle, 
  Calendar, 
  Clock3,
  User, 
  Info, 
  History, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Briefcase, 
  ShoppingBag, 
  Share2, 
  Landmark, 
  RotateCcw, 
  Megaphone, 
  Monitor, 
  Building, 
  Zap, 
  Package, 
  Smartphone, 
  Plane, 
  Utensils, 
  Shield, 
  Users, 
  UserCheck, 
  Hammer, 
  Truck, 
  Car,
  CreditCard, 
  Code, 
  PenTool, 
  Wrench, 
  Key, 
  Flag, 
  GraduationCap, 
  AlertCircle, 
  Repeat, 
  Calculator, 
  BookOpen,
  Ban,
  HelpCircle,
  Percent,
  PlusCircle,
  MinusCircle,
  Search,
  Tag,
  Upload,
  Image as ImageIcon,
  Palette,
  AlignLeft,
  AlignCenter,
  Edit3,
  Loader2,
  Camera,
  Eye,
  ToggleLeft,
  ToggleRight,
  Copy,
  ClipboardList
} from 'lucide-react';
import { Page, Transaction, Invoice, Estimate, Client, ClientStatus, UserSettings, Notification, FilterPeriod, RecurrenceFrequency, FilingStatus, TaxPayment, TaxEstimationMethod, InvoiceItem, EstimateItem, CustomCategories, Receipt as ReceiptType, MileageTrip, CompanyEquityState } from './types';
import { CATS_IN, CATS_OUT, CATS_BILLING, DEFAULT_PAY_PREFS, DB_KEY, TAX_CONSTANTS, TAX_PLANNER_2026, getFreshDemoData } from './constants';
import InsightsDashboard from './InsightsDashboard';
import { getInsightCount } from './services/insightsEngine';
import { putReceiptBlob, getReceiptBlob, deleteReceiptBlob, dataUrlToBlob, blobToDataUrl, clearAllReceipts } from './services/receiptStore';
import { DEMO_RECEIPT_ASSETS } from './services/demoReceipts';
import { loadAppState, saveAppState, clearAppState } from './services/appStore';
import { MobileFormShell } from './src/components/mobile/MobileFormShell';
import { AppDrawer } from './src/components/mobile/AppDrawer';
import { TransactionEditorShell } from './src/features/transactions/TransactionEditorShell';
import { useKeyboardEditingState } from './src/hooks/useKeyboardEditingState';
import { useKeyboardSafeScroll } from './src/hooks/useKeyboardSafeScroll';
import { buildHash, normalizePage, pageToHashPath, parseHashLocation } from './src/navigation/hashRouting';
import { createEmptyMileageDraft, normalizeMileageDraftMiles, toMileageTripPayload } from './src/features/mileage/draft';
import { CompanyEquityModule } from './src/features/equity/CompanyEquityModule';
import { createDefaultCompanyEquityState, normalizeCompanyEquityState } from './src/features/equity/equityCore';
// --- Utility: UUID Generator ---
const generateId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// --- Utility: Invoice/Estimate Number Generator ---
const generateDocNumber = (prefix: 'INV' | 'EST', existingDocs: { number?: string }[]): string => {
  const now = new Date();
  const yearMonth = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  
  // Find highest existing number for this prefix and year-month
  let maxSeq = 0;
  const pattern = new RegExp(`^${prefix}-${yearMonth}-(\\d+)$`);
  
  existingDocs.forEach(doc => {
    if (doc.number) {
      const match = doc.number.match(pattern);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }
  });
  
  const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
  return `${prefix}-${yearMonth}-${nextSeq}`;
};


// --- Clients Helpers ---
// Demo receipt lookup (used as a fallback if IndexedDB blobs are unavailable)
const DEMO_ASSET_BY_ID = new Map(DEMO_RECEIPT_ASSETS.map(a => [a.id, a]));

const fetchDemoReceiptBlob = async (asset: { assetUrl: string; mimeType: string }) => {
  const response = await fetch(asset.assetUrl, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Failed to load demo receipt asset: ${asset.assetUrl}`);
  const blob = await response.blob();
  return { blob, mimeType: blob.type || asset.mimeType };
};


const formatDateForExport = (value: string) => {
  if (!value) return '';

  const isoMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${month}/${day}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

const formatDecimalForExport = (value: number | string, digits = 2) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(digits);
};

const normalize = (s: string) => (s || '').trim().toLowerCase();

const exportButtonPrimaryClass = "px-4 py-3 rounded-lg bg-blue-600 text-white font-extrabold uppercase tracking-widest text-xs hover:bg-blue-700 active:scale-95 transition-all border border-blue-600 shadow-sm hover:shadow-md";
const exportButtonSecondaryClass = "px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-extrabold uppercase tracking-widest text-xs hover:bg-slate-50 dark:hover:bg-slate-900 active:scale-95 transition-all shadow-sm";
const exportButtonTonalClass = "px-4 py-3 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/35 text-blue-700 dark:text-blue-200 font-extrabold uppercase tracking-widest text-xs hover:bg-blue-100 dark:hover:bg-blue-950/55 active:scale-95 transition-all shadow-sm";
const exportButtonUtilityClass = "px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-extrabold uppercase tracking-widest text-xs hover:bg-slate-50 dark:hover:bg-slate-900/60 active:scale-95 transition-all shadow-sm";

// --- Utility: Image Compressor ---
// Returns BOTH a preview DataURL (for UI) and a Blob (for safe IndexedDB storage)
const compressReceiptImage = (file: File): Promise<{ dataUrl: string; blob: Blob; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // Limit width to 800px
        const scaleSize = MAX_WIDTH / img.width;

        // Only scale down if image is larger than max width
        const width = img.width > MAX_WIDTH ? MAX_WIDTH : img.width;
        const height = img.width > MAX_WIDTH ? img.height * scaleSize : img.height;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const mimeType = 'image/jpeg';
        const quality = 0.6;

        // Preview for UI
        const dataUrl = canvas.toDataURL(mimeType, quality);

        // Blob for IndexedDB storage
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Failed to create image blob'));
          resolve({ dataUrl, blob, mimeType });
        }, mimeType, quality);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};


// --- Utility: Download Receipt ---
const downloadReceiptToDevice = (dataUrl: string) => {
    try {
        const link = document.createElement('a');
        link.href = dataUrl;
        const now = new Date();
        // Format: Receipt_YYYY-MM-DD_HHMMSS
        const timestamp = now.toISOString().replace(/-/g, '').replace(/:/g, '').replace('T', '').replace(/\./g, '').slice(0, 14); 
        const dateStr = now.toISOString().split('T')[0];
        
        // Attempt to place in BizReceipts folder (Browser support varies, might fallback to filename prefix)
        link.download = `Receipt_${dateStr}_${timestamp}.jpg`; 
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    } catch (e) {
        console.error("Download failed", e);
        return false;
    }
};

// --- Utility: Download Blob ---
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const savePdfBlobToDevice = async (blob: Blob, filename: string, shareText: string) => {
  const navAny = (typeof navigator !== 'undefined' ? navigator : null) as any;

  try {
    if (typeof File !== 'undefined' && navAny?.share) {
      const file = new File([blob], filename, { type: blob.type || 'application/pdf' });
      const canShareFiles = !navAny.canShare || navAny.canShare({ files: [file] });

      if (canShareFiles) {
        await navAny.share({
          files: [file],
          title: filename,
          text: shareText,
        });
        return 'shared' as const;
      }
    }
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      return 'cancelled' as const;
    }
    console.warn('PDF share failed, falling back to download.', error);
  }

  downloadBlob(blob, filename);
  return 'downloaded' as const;
};

const escapeCsv = (value: any) => {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const makeCsvBlob = (rows: any[][]) => {
  const lines = rows.map(r => r.map(escapeCsv).join(',')).join('\n');
  return new Blob(['\ufeff', lines], { type: 'text/csv;charset=utf-8' });
};

const makeSpreadsheetBlob = (buffer: ArrayBuffer) => {
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

// --- Utility: Minimal ZIP (stored / no compression) ---
// Creates a valid ZIP without external dependencies (bigger files, but works offline).
const crc32 = (() => {
  const table = new Uint32Array(256).map((_, i) => {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    return c >>> 0;
  });
  return (data: Uint8Array) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
})();

const toDosTimeDate = (d: Date) => {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = Math.floor(d.getSeconds() / 2);
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
};

const u16 = (n: number) => [n & 0xFF, (n >>> 8) & 0xFF];
const u32 = (n: number) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

const utf8 = (s: string) => new TextEncoder().encode(s);

const createZipBlobUncompressed = (files: { name: string; data: Uint8Array; mtime?: Date }[]) => {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const push = (arr: number[] | Uint8Array) => {
    const u = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
    parts.push(u);
    offset += u.length;
  };

  for (const f of files) {
    const nameBytes = utf8(f.name);
    const mtime = f.mtime || new Date();
    const { dosTime, dosDate } = toDosTimeDate(mtime);
    const crc = crc32(f.data);
    const size = f.data.length;

    const localHeader = new Uint8Array([
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0x0800), // UTF-8
      ...u16(0), // store
      ...u16(dosTime),
      ...u16(dosDate),
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      ...u16(0),
    ]);

    const localOffset = offset;
    push(localHeader);
    push(nameBytes);
    push(f.data);

    const centralHeader = new Uint8Array([
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0x0800),
      ...u16(0),
      ...u16(dosTime),
      ...u16(dosDate),
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(localOffset),
    ]);

    central.push(centralHeader, nameBytes);
  }

  const centralStart = offset;
  for (const c of central) {
    parts.push(c);
    offset += c.length;
  }
  const centralSize = offset - centralStart;
  const fileCount = files.length;

  const end = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(fileCount),
    ...u16(fileCount),
    ...u32(centralSize),
    ...u32(centralStart),
    ...u16(0),
  ]);

  parts.push(end);

  return new Blob(parts, { type: 'application/zip' });
};


const escapeXml = (value: string) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const getExcelColumnName = (index: number) => {
  let n = index;
  let result = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
};

const sanitizeSheetName = (value: string) => {
  const cleaned = String(value || 'Sheet1').replace(/[\\/*?:\[\]]/g, ' ').trim();
  return (cleaned || 'Sheet1').slice(0, 31);
};

const makeXmlFile = (body: string) => utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`);


// --- Utility: Date Helpers ---
const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(d.setDate(diff));
};

const getEndOfWeek = (date: Date) => {
  const d = getStartOfWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
};

const formatDateRange = (start: Date, end: Date) => {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`;
};

const getDaysOverdue = (dueDate: string) => {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const today = new Date();
  due.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays;
};

const calculateNextDate = (currentDate: string, freq: RecurrenceFrequency): string => {
  const d = new Date(currentDate);
  if (freq === 'weekly') d.setDate(d.getDate() + 7);
  if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  if (freq === 'quarterly') d.setMonth(d.getMonth() + 3);
  if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
};

const getNextEstimatedTaxDeadline = () => {
  const now = new Date();
  const year = now.getFullYear();
  const deadlines = [
    new Date(year, 3, 15), 
    new Date(year, 5, 15), 
    new Date(year, 8, 15), 
    new Date(year + 1, 0, 15)
  ];
  
  const next = deadlines.find(d => {
    d.setHours(23, 59, 59, 999); 
    return d >= now;
  }) || deadlines[0];

  const diffTime = next.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return { 
    date: next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
    days: diffDays 
  };
};

// --- Helper: Category Icons ---
const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Sales / Services": return <Briefcase size={16} />;
    case "Consulting / Freelance": return <User size={16} />;
    case "Product Sales": return <ShoppingBag size={16} />;
    case "Affiliate / Referral": return <Share2 size={16} />;
    case "Interest / Bank": return <Landmark size={16} />;
    case "Refunds": return <RotateCcw size={16} />;
    case "Advertising / Marketing": return <Megaphone size={16} />;
    case "Software / SaaS": return <Monitor size={16} />;
    case "Rent / Workspace": return <Building size={16} />;
    case "Utilities": return <Zap size={16} />;
    case "Office Supplies": return <Package size={16} />;
    case "Phone / Internet": return <Smartphone size={16} />;
    case "Travel": return <Plane size={16} />;
    case "Meals (Business)": return <Utensils size={16} />;
    case "Professional Services": return <Briefcase size={16} />;
    case "Insurance": return <Shield size={16} />;
    case "Contractors": return <Users size={16} />;
    case "Payroll": return <UserCheck size={16} />;
    case "Taxes & Licenses": return <FileText size={16} />;
    case "Equipment": return <Hammer size={16} />;
    case "Shipping / Delivery": return <Truck size={16} />;
    case "Bank Fees": return <CreditCard size={16} />;
    case "Web Development": return <Code size={16} />;
    case "Graphic Design": return <PenTool size={16} />;
    case "Strategy Consulting": return <Briefcase size={16} />;
    case "Content Writing": return <FileText size={16} />;
    case "Digital Marketing": return <Megaphone size={16} />;
    case "Maintenance Retainer": return <Wrench size={16} />;
    case "Software Licensing": return <Key size={16} />;
    case "Project Milestone": return <Flag size={16} />;
    case "Training / Workshop": return <GraduationCap size={16} />;
    default: return <Tag size={16} />;
  }
};

// --- Components ---

const Logo: React.FC<{ size?: 'sm' | 'lg', onClick?: () => void, forceDarkText?: boolean, onDarkSurface?: boolean }> = ({ size = 'sm', onClick, forceDarkText = false, onDarkSurface = false }) => {
  const isLarge = size === 'lg';
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-2 sm:gap-3 cursor-pointer group select-none transition-transform active:scale-95 flex-shrink-0`}
    >
      <div 
        className={`${isLarge ? 'w-12 h-12 rounded-2xl' : 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl'} bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all duration-500 flex-shrink-0`}
      >
        <div className="relative w-full h-full flex items-center justify-center">
            <div className="w-1/2 h-1/2 border-l-[3px] border-r-[3px] border-t-[3px] border-white opacity-90 rounded-t-sm" />
            <div className="absolute w-1.5 h-1.5 bg-white rounded-full bottom-2.5 left-1/2 -translate-x-1/2 shadow-sm" />
        </div>
      </div>
      <div className="flex flex-col leading-none min-w-0">
        <div className={`font-brand uppercase tracking-[0.18em] sm:tracking-[0.22em] ${isLarge ? 'text-2xl' : 'text-base sm:text-lg'} ${onDarkSurface ? 'text-white' : forceDarkText ? 'text-slate-950' : 'text-slate-950 dark:text-white'}`} style={{ whiteSpace: 'nowrap' }}>
          <span className="font-bold">Moni</span>
          <span className={`font-bold ${onDarkSurface ? 'bg-gradient-to-r bg-clip-text text-transparent from-blue-400 to-indigo-300' : forceDarkText ? 'text-blue-700' : 'bg-gradient-to-r bg-clip-text text-transparent from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400'}`}>ezi</span>
        </div>
        <div className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] sm:tracking-[0.22em] ${onDarkSurface ? '' : 'text-slate-600 dark:text-slate-300'} mt-0.5 sm:mt-1 pl-0.5`} style={{ whiteSpace: 'nowrap', color: onDarkSurface ? '#cbd5e1' : undefined }}>
          Pro Finance
        </div>
       
            </div>
    </div>
  );
};

const ToastContainer: React.FC<{ notifications: Notification[]; remove: (id: string) => void }> = ({ notifications, remove }) => {
  return (
    <div className="fixed top-24 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {notifications.map(n => (
        <div 
          key={n.id} 
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border animate-in slide-in-from-right-10 fade-in duration-300 max-w-sm ${
            n.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
            n.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}
          onClick={() => remove(n.id)}
        >
           {n.type === 'success' ? <CheckCircle size={18} /> : n.type === 'error' ? <AlertTriangle size={18} /> : <Info size={18} />}
           <span className="text-sm font-bold">{n.message}</span>
        </div>
      ))}
    </div>
  );
};

const EmptyState: React.FC<{ icon: React.ReactNode, title: string, subtitle: string, action?: () => void, actionLabel?: string }> = ({ icon, title, subtitle, action, actionLabel }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
    <div className="mb-4 text-slate-600 dark:text-slate-300 p-4 bg-white dark:bg-slate-950 rounded-full shadow-sm border border-slate-200 dark:border-slate-800">
      {icon}
    </div>
    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 font-brand">{title}</h3>
    <p className="text-slate-600 dark:text-slate-300 text-sm max-w-[250px] mx-auto mb-6">{subtitle}</p>
    {action && (
      <button onClick={action} className="min-w-[180px] bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 text-white dark:text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]">
        {actionLabel}
      </button>
    )}
  </div>
);

const StatCard: React.FC<{ 
  label: string; 
  value: string; 
  colorClass?: string; 
  subText?: string; 
  subTextClass?: string;
  onClick?: () => void; 
  icon?: React.ReactNode 
}> = ({ 
  label, value, colorClass = "text-slate-950 dark:text-white", subText, subTextClass, onClick, icon 
}) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md transition-all duration-300 group overflow-hidden ${onClick ? 'cursor-pointer active:scale-95 hover:border-blue-500/50 hover:shadow-lg' : ''}`}
  >
    <div className="flex justify-between items-start mb-4">
        <div className="bg-slate-100 dark:bg-slate-950 p-3 rounded-lg text-slate-600 dark:text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
            {icon}
        </div>
        {onClick && <ArrowRight size={16} className="text-slate-400 dark:text-slate-300 -rotate-45 group-hover:rotate-0 group-hover:text-blue-500 transition-all duration-300" />}
    </div>
    <div className={`text-2xl font-bold tracking-tight mb-1 break-words ${colorClass}`}>{value}</div>
    <div className="flex justify-between items-end min-w-0">
        <label className="text-base font-semibold text-slate-600 dark:text-slate-300 truncate">{label}</label>
    </div>
    {subText && <div className={`text-xs mt-2 font-bold inline-block px-3 py-1 rounded-md ${subTextClass || 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300'}`}>{subText}</div>}
  </div>
);

const DateInput = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => (
  <div className="group">
    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 block pl-1 group-focus-within:text-blue-600 dark:group-focus-within:text-white transition-colors">
      {label}
    </label>
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 pointer-events-none">
        <Calendar size={18} />
      </div>
      <input 
        type="date" 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className="w-full bg-transparent border border-slate-300 dark:border-slate-700 rounded-lg pl-12 pr-5 py-4 font-medium text-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
      />
    </div>
  </div>
);

// --- Period Selector Component ---
const PeriodSelector: React.FC<{ 
  period: FilterPeriod, 
  setPeriod: (p: FilterPeriod) => void,
  refDate: Date,
  setRefDate: (d: Date) => void 
}> = ({ period, setPeriod, refDate, setRefDate }) => {

  const navigateDate = (dir: number) => {
    const newDate = new Date(refDate);
    if (period === 'daily') newDate.setDate(newDate.getDate() + dir);
    else if (period === 'weekly') newDate.setDate(newDate.getDate() + (dir * 7));
    else if (period === 'monthly') newDate.setMonth(newDate.getMonth() + dir);
    else if (period === 'yearly') newDate.setFullYear(newDate.getFullYear() + dir);
    setRefDate(newDate);
  };

  const getLabel = () => {
    if (period === 'all') return 'All Time';
    if (period === 'daily') {
       return refDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    if (period === 'weekly') {
       const start = getStartOfWeek(refDate);
       const end = getEndOfWeek(refDate);
       return formatDateRange(start, end);
    }
    if (period === 'monthly') {
       return refDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (period === 'yearly') {
       return refDate.getFullYear().toString();
    }
    return '';
  };

  return (
    <div className="mb-6 space-y-4 min-w-0 max-w-full">
       <div className="grid grid-cols-5 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 min-w-0 max-w-full">
          {(['all', 'daily', 'weekly', 'monthly', 'yearly'] as FilterPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`min-w-0 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                period === p 
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {p === 'daily' ? 'Day' : p === 'weekly' ? 'Week' : p === 'monthly' ? 'Month' : p === 'yearly' ? 'Year' : 'All'}
            </button>
          ))}
       </div>

       {period !== 'all' && (
         <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm min-w-0 max-w-full">
            <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-200 transition-colors">
               <ChevronLeft size={20} />
            </button>
            <div className="flex items-center justify-center gap-2 min-w-0 flex-1 text-center font-brand font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide">
               <Calendar size={16} className="text-blue-500 mb-0.5" />
               {getLabel()}
            </div>
            <button onClick={() => navigateDate(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-200 transition-colors">
               <ChevronRight size={20} />
            </button>
         </div>
       )}
    </div>
  );
};

// --- App Root ---

// --- Safety net: prevent “blank screen” by catching render errors in any page.
class PageErrorBoundary extends React.Component<
  { onReset?: () => void; children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: String(err?.message || err) };
  }
  componentDidCatch(err: any) {
    // eslint-disable-next-line no-console
    console.error('[Moniezi] Page render error:', err);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm">
          <div className="text-sm font-semibold">Something broke on this screen.</div>
          <div className="mt-2 text-xs opacity-80">{this.state.message}</div>
          <button
            onClick={() => {
              this.setState({ hasError: false, message: undefined });
              this.props.onReset?.();
            }}
            className="mt-3 w-full rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Go back to Home
          </button>
        </div>
      </div>
    );
  }
}

const CUSTOMER_VERSION = "36.0.0"; // v36.0.0: continued paid-release baseline
const LICENSE_STORAGE_KEY = "moniezi_license_v1";
const DEVICE_ID_STORAGE_KEY = "moniezi_device_id_v1";
const LICENSE_TOKEN_SALT = "moniezi_v35_offline_binding";
// Keep the original v35.0.3 binding version so an existing validated license
// remains usable during the normal v36 code update, including offline grace.
const LICENSE_BINDING_VERSION = "35.0.3";
const CUSTOMER_LICENSE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{7,127}$/;

type StoredLicense = {
  key: string;
  email?: string;
  purchaseDate?: string;
  validated?: boolean;
  activatedAt?: string;
  lastValidatedAt?: string;
  validUntil?: string;
  licenseType?: 'owner' | 'customer';
  deviceId?: string;
  token?: string;
};

function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = `mzd_${generateId('dev')}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return `mzd_fallback_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function createLicenseToken(key: string, deviceId: string): string {
  const material = `${key}|${deviceId}|${LICENSE_BINDING_VERSION}|${LICENSE_TOKEN_SALT}`;
  return `mzn_${simpleHash(material)}_${simpleHash(material.split('').reverse().join(''))}`;
}

function isAcceptedCustomerLicenseFormat(key: string): boolean {
  return CUSTOMER_LICENSE_KEY_PATTERN.test(key.trim());
}

function parseStoredLicense(raw: string | null): StoredLicense | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredLicense;
  } catch {
    return null;
  }
}

function isStoredLicenseWithinGrace(candidate: StoredLicense | null): boolean {
  if (!candidate?.validUntil) return false;
  const validUntilMs = new Date(candidate.validUntil).getTime();
  return Number.isFinite(validUntilMs) && validUntilMs > Date.now();
}

export default function App() {
  useEffect(() => {
    installMonieziFonts();
  }, []);

  const [dataLoaded, setDataLoaded] = useState(false);

  // --- In-app navigation (cross-platform back button support) ---
  const [hashParams, setHashParams] = useState<{ receiptId?: string; modal?: string }>({});
  const [currentPage, _setCurrentPage] = useState<Page>(() => {
    const { path } = parseHashLocation();
    return normalizePage(path);
  });

  const syncHashToState = useCallback(() => {
    // If no hash exists, set a default hash (replace, no extra history entry)
    const base = window.location.href.split('#')[0];
    const raw = window.location.hash || '';
    if (!raw || raw === '#') {
      window.history.replaceState(null, '', base + buildHash('home', {}));
    }

    const { path, params } = parseHashLocation();
    const page = normalizePage(path);

    _setCurrentPage(prev => (prev === page ? prev : page));
    setHashParams({
      receiptId: params.receipt || undefined,
      modal: params.modal || undefined,
    });
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', syncHashToState);
    syncHashToState();
    return () => window.removeEventListener('hashchange', syncHashToState);
  }, [syncHashToState]);


  const updateHashParams = useCallback(
    (updates: Record<string, string | null | undefined>, opts?: { replace?: boolean; keepPath?: boolean }) => {
      const base = window.location.href.split('#')[0];
      const { path, params } = parseHashLocation();
      const next: Record<string, string | null | undefined> = { ...params };

      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined || String(v).length === 0) delete next[k];
        else next[k] = String(v);
      }

      const nextHash = buildHash(opts?.keepPath ? path : path, next);
      if (opts?.replace) {
        window.history.replaceState(null, '', base + nextHash);
        syncHashToState();
      } else {
        window.location.hash = nextHash.replace('#', '');
      }
    },
    [syncHashToState]
  );

  const forceResetMainViewport = useCallback(() => {
    const el = mainScrollRef.current;

    const reset = () => {
      try {
        if (el) {
          el.scrollTop = 0;
          // iOS Safari can sometimes keep the old virtual scroll position until the next paint.
          // Briefly toggling momentum scrolling forces a clean reflow for the new page.
          // @ts-ignore
          el.style.webkitOverflowScrolling = 'auto';
          el.getBoundingClientRect();
          // @ts-ignore
          el.style.webkitOverflowScrolling = 'touch';
          // @ts-ignore
          if (typeof (el as any).scrollTo === 'function') (el as any).scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      } catch {
        // ignore platform-specific scroll quirks
      }
    };

    reset();
    requestAnimationFrame(reset);
    setTimeout(reset, 0);
    setTimeout(reset, 80);
    setTimeout(reset, 220);
  }, []);

  const setCurrentPage = useCallback(
    (p: any, opts?: { replace?: boolean }) => {
      const nextPage = normalizePage(p);
      const nextPath = pageToHashPath(nextPage);

      // Clear modal params when switching main pages (keep navigation clean)
      const nextHash = buildHash(nextPath, {});
      const base = window.location.href.split('#')[0];

      try {
        (document.activeElement as HTMLElement | null)?.blur?.();
      } catch {
        // ignore
      }

      forceResetMainViewport();

      if (opts?.replace) {
        window.history.replaceState(null, '', base + nextHash);
        syncHashToState();
      } else {
        window.location.hash = nextHash.replace('#', '');
      }

      _setCurrentPage(nextPage);
      forceResetMainViewport();
    },
    [forceResetMainViewport, syncHashToState]
  );
  const [invoiceQuickFilter, setInvoiceQuickFilter] = useState<'all' | 'unpaid' | 'overdue'>('all');
  const [estimateQuickFilter, setEstimateQuickFilter] = useState<'all' | 'draft' | 'sent' | 'accepted' | 'declined'>('all');

  const HOME_KPI_PERIOD_KEY = 'moniezi_home_kpi_period';
  type HomeKpiPeriod = 'ytd' | 'mtd' | '30d' | 'all';
  const [homeKpiPeriod, setHomeKpiPeriod] = useState<HomeKpiPeriod>(() => {
    try {
      const v = localStorage.getItem(HOME_KPI_PERIOD_KEY);
      if (v === 'ytd' || v === 'mtd' || v === '30d' || v === 'all') return v;
    } catch {
      // ignore
    }
    return 'ytd';
  });

  useEffect(() => {
    try {
      localStorage.setItem(HOME_KPI_PERIOD_KEY, homeKpiPeriod);
    } catch {
      // ignore
    }
  }, [homeKpiPeriod]);


  // The app scrolls inside an internal container (<main className="overflow-y-auto">),
  // not the browser window. Without resetting this container, switching pages via the
  // bottom nav keeps the previous scroll position.
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [isKeyboardEditing, setIsKeyboardEditing] = useState(false);

  useKeyboardEditingState({ onEditingChange: setIsKeyboardEditing });
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [showDeferredInstallCta, setShowDeferredInstallCta] = useState(false);
  const [showIosInstallCta, setShowIosInstallCta] = useState(false);
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false);
  const [isRunningStandalone, setIsRunningStandalone] = useState(false);

  const getIosInstallContext = useCallback(() => {
    try {
      const nav = navigator as Navigator & { standalone?: boolean; maxTouchPoints?: number };
      const ua = nav.userAgent || '';
      const platform = nav.platform || '';
      const touchPoints = Number(nav.maxTouchPoints || 0);
      const isIosDevice = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
      const isSafariLike = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//i.test(ua);
      return { isIosDevice, isSafariLike };
    } catch {
      return { isIosDevice: false, isSafariLike: false };
    }
  }, []);

  const evaluateStandaloneMode = useCallback(() => {
    try {
      const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || (navigator as any).standalone === true;
      setIsRunningStandalone(!!standalone);
      return !!standalone;
    } catch {
      setIsRunningStandalone(false);
      return false;
    }
  }, []);

  const triggerDeferredInstallPrompt = useCallback(async () => {
    if (!deferredInstallPrompt) return;
    try {
      await deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
    } catch {
      // ignore user dismissal / browser differences
    } finally {
      setShowDeferredInstallCta(false);
      setDeferredInstallPrompt(null);
    }
  }, [deferredInstallPrompt]);

  const openIosInstallHelp = useCallback(() => {
    setShowIosInstallHelp(true);
  }, []);

  // Always reset scroll position when switching bottom tabs.
  // Some mobile browsers "remember" the scrollTop of the same scrolling container.
  // We enforce it (and re-enforce on the next tick) so each tab starts at the top.
  useLayoutEffect(() => {
    forceResetMainViewport();
  }, [currentPage, forceResetMainViewport]);

  // Scroll-to-top button visibility
  // Listen on BOTH the internal scroll container AND window (belt-and-suspenders).
  useEffect(() => {
    const el = mainScrollRef.current;

    const check = () => {
      // Check the internal scroll container first
      if (el) {
        const scrollTop = el.scrollTop;
        if (scrollTop > 300) {
          setShowScrollToTop(true);
          return;
        }
      }
      // Also check window scroll (fallback for any layout)
      if ((window.scrollY || window.pageYOffset || 0) > 300) {
        setShowScrollToTop(true);
        return;
      }
      setShowScrollToTop(false);
    };

    if (el) el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('scroll', check, { passive: true });
    check();

    return () => {
      if (el) el.removeEventListener('scroll', check);
      window.removeEventListener('scroll', check);
    };
  }, [currentPage, dataLoaded]); // Re-attach when page changes or data loads (ref becomes available)

  const scrollToTop = () => {
    const el = mainScrollRef.current;
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // License / Activation State
    const LICENSING_ENABLED = true;
  const [isLicenseValid, setIsLicenseValid] = useState<boolean | null>(LICENSING_ENABLED ? null : true); // null = checking, false = invalid, true = valid
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseError, setLicenseError] = useState('');
  const [isValidatingLicense, setIsValidatingLicense] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<{ email?: string; purchaseDate?: string; } | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    businessName: "My Business",
    ownerName: "Owner",
    payPrefs: DEFAULT_PAY_PREFS,
    taxRate: 22,
    stateTaxRate: 0,
    taxEstimationMethod: 'custom',
    filingStatus: 'single',
    currencySymbol: '$',
    showLogoOnInvoice: true,
    logoAlignment: 'left',
    brandColor: '#2563eb'
  });
  const [customCategories, setCustomCategories] = useState<CustomCategories>({ income: [], expense: [], billing: [] });
  const [taxPayments, setTaxPayments] = useState<TaxPayment[]>([]);
  const [receipts, setReceipts] = useState<ReceiptType[]>([]);
  const [isDemoData, setIsDemoData] = useState<boolean>(false);
  const [mileageTrips, setMileageTrips] = useState<MileageTrip[]>([]);
  const [companyEquity, setCompanyEquity] = useState<CompanyEquityState>(() => createDefaultCompanyEquityState());
  // Receipt image URLs (runtime-only). Stored images live in IndexedDB.
  const [receiptPreviewUrls, setReceiptPreviewUrls] = useState<Record<string, string>>({});

  // Prefetch receipt URLs whenever receipts change
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const updates: Record<string, string> = {};
      for (const r of receipts) {
        if (receiptPreviewUrls[r.id]) continue;
        const rec = await getReceiptBlob(r.imageKey || r.id);
        if (rec?.blob) {
          const url = URL.createObjectURL(rec.blob);
          updates[r.id] = url;
        } else {
          // Fallback for demo mode (or any case where the blob isn't in IndexedDB yet)
          const demo = DEMO_ASSET_BY_ID.get(r.id);
          if (demo?.assetUrl) {
            updates[r.id] = demo.assetUrl;
          }
        }
      }
      if (cancelled) {
        Object.values(updates).forEach(u => URL.revokeObjectURL(u));
        return;
      }
      if (Object.keys(updates).length > 0) {
        setReceiptPreviewUrls(prev => ({ ...prev, ...updates }));
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts]);

  const handleDownloadReceipt = useCallback(async (receiptId: string) => {
    try {
      const rec = await getReceiptBlob(receiptId);
      if (!rec) {
        const demo = DEMO_ASSET_BY_ID.get(receiptId);
        if (demo?.assetUrl) {
          downloadReceiptToDevice(demo.assetUrl);
          showToast("Downloaded to device", "success");
          return;
        }
        showToast("Receipt image is missing.", "error");
        return;
      }
      const dataUrl = await blobToDataUrl(rec.blob);
      downloadReceiptToDevice(dataUrl);
      showToast("Downloaded to device", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to download receipt.", "error");
    }
  }, []);


  // Clients / Leads (Lightweight CRM)
  const [clientSearch, setClientSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<'all' | ClientStatus>('all');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client>>({ status: 'lead' });

  // UI State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit_tx' | 'edit_inv' | 'tax_payments' | 'create_cat' | 'mileage'>('add');
  const [activeTab, setActiveTab] = useState<'income' | 'expense' | 'billing'>('income');
  const [showQuickAddMenu, setShowQuickAddMenu] = useState(false);
  const [billingDocType, setBillingDocType] = useState<'invoice' | 'estimate'>('invoice');
  const [activeItem, setActiveItem] = useState<Record<string, any>>({});
  const [activeTaxPayment, setActiveTaxPayment] = useState<Partial<TaxPayment>>({ type: 'Estimated', date: new Date().toISOString().split('T')[0] });
  
  const [categorySearch, setCategorySearch] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const previousDrawerMode = useRef<'add' | 'edit_tx' | 'edit_inv' | 'tax_payments' | 'mileage'>('add');

  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'income' | 'expense' | 'invoice'>('all');
  const [lastYearCalc, setLastYearCalc] = useState({ profit: '', tax: '' });
  const [selectedInvoiceForDoc, setSelectedInvoiceForDoc] = useState<Invoice | null>(null);
  const [selectedEstimateForDoc, setSelectedEstimateForDoc] = useState<Estimate | null>(null);
  const [isEstimatePdfPreviewOpen, setIsEstimatePdfPreviewOpen] = useState(false);
  const [isGeneratingEstimatePdf, setIsGeneratingEstimatePdf] = useState(false);
  const [showPLPreview, setShowPLPreview] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [plExportRequested, setPlExportRequested] = useState(false);
  const [isGeneratingPLPdf, setIsGeneratingPLPdf] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Pro P&L State
  const [plPeriodType, setPlPeriodType] = useState<'month' | 'quarter' | 'year' | 'ytd' | 'lastYear' | 'trailing12' | 'custom'>('ytd');
  const [plCustomStart, setPlCustomStart] = useState<string>(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [plCustomEnd, setPlCustomEnd] = useState<string>(new Date().toISOString().split('T')[0]);
  const [plShowComparison, setPlShowComparison] = useState(false);
  const [plAccountingBasis, setPlAccountingBasis] = useState<'cash' | 'accrual'>('cash');
  const [plShowPreparedBy, setPlShowPreparedBy] = useState(true);
  const [plShowAddress, setPlShowAddress] = useState(true);
  const [showProPLPreview, setShowProPLPreview] = useState(false);
  const [isGeneratingProPLPdf, setIsGeneratingProPLPdf] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showInsights, setShowInsights] = useState(false);
  const [duplicationCount, setDuplicationCount] = useState<Record<string, number>>({});
  const [showTemplateSuggestion, setShowTemplateSuggestion] = useState(false);
  const [templateSuggestionData, setTemplateSuggestionData] = useState<{name: string, category: string, type: string} | null>(null);
  
  // Phase 3: Advanced Duplicate Features
  const [showBatchDuplicateModal, setShowBatchDuplicateModal] = useState(false);
  const [batchDuplicateData, setBatchDuplicateData] = useState<Transaction | Invoice | null>(null);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringData, setRecurringData] = useState<Transaction | Invoice | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<Array<{id: string, name: string, data: Partial<Transaction | Invoice>, type: string}>>([]);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [duplicationHistory, setDuplicationHistory] = useState<Record<string, {originalId: string, originalDate: string}>>({});
  
  // Settings Tab State
  const [settingsTab, setSettingsTab] = useState<'backup' | 'update' | 'branding' | 'tax' | 'data' | 'license' | 'offline'>('backup');
  const [expenseReceiptFilter, setExpenseReceiptFilter] = useState<'all' | 'with_receipts' | 'without_receipts'>('all');
  const [expenseReviewFilter, setExpenseReviewFilter] = useState<'all' | 'new' | 'reviewed'>('all');

  const insightsBadgeCount = useMemo(() => {
    return getInsightCount({ transactions, invoices, taxPayments, settings });
  }, [transactions, invoices, taxPayments, settings]);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [scrollToTaxSnapshot, setScrollToTaxSnapshot] = useState(false);
  const [taxPrepYear, setTaxPrepYear] = useState<number>(new Date().getFullYear());
  const [auditMissingReceipts, setAuditMissingReceipts] = useState<number | null>(null);
  const [auditMissingDelta, setAuditMissingDelta] = useState<number>(0);
  const [auditMissingPulse, setAuditMissingPulse] = useState<boolean>(false);
  const [newTrip, setNewTrip] = useState(() => createEmptyMileageDraft());
  const [editingMileageTripId, setEditingMileageTripId] = useState<string | null>(null);
  const taxSnapshotRef = useRef<HTMLDivElement>(null);

  // Reports screen menu (Settings-style tiles)
  const [reportsMenuSection, setReportsMenuSection] = useState<'pl'|'taxsnapshot'|'taxprep'|'mileage'|'planner'>('pl');
  const isMileageKeyboardEditing = isKeyboardEditing && currentPage === Page.Mileage;
  const scrollToReportSection = (id: string, section: typeof reportsMenuSection) => {
    setReportsMenuSection(section);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Keep Tax Prep record counters reactive
  useEffect(() => {
    if (!dataLoaded) return;
    const year = taxPrepYear;
    const txForYear = transactions.filter(t => new Date(t.date).getFullYear() === year && t.type === 'expense');
    const missing = txForYear.filter(t => !(t as any).receiptId).length;
    setAuditMissingReceipts(prev => {
      if (prev === null) return missing;
      if (prev !== missing) {
        const delta = missing - prev;
        setAuditMissingDelta(delta);
        setAuditMissingPulse(true);
        window.setTimeout(() => setAuditMissingPulse(false), 1200);
      }
      return missing;
    });
  }, [transactions, taxPrepYear, dataLoaded]);

  // Backup & Restore State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appStateSaveTimerRef = useRef<number | null>(null);
  const recurringInvoicesProcessedRef = useRef(false);

  // Scan Receipt State
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanPreviewBlob, setScanPreviewBlob] = useState<Blob | null>(null);
  const [scanMode, setScanMode] = useState<'receiptOnly' | 'expenseWithReceipt'>('receiptOnly');
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptType | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // --- Receipt viewer + Report preview: URL-backed so OS back button stays inside the app ---
  const openReceipt = useCallback(
    (r: any) => {
      if (!r) return;
      setViewingReceipt(r);
      updateHashParams({ receipt: String(r.id) }, { keepPath: true });
    },
    [updateHashParams]
  );

  const closeReceipt = useCallback(() => {
    setViewingReceipt(null);
    // Remove "receipt" without adding a new history entry
    updateHashParams({ receipt: null }, { replace: true, keepPath: true });
  }, [updateHashParams]);

  useEffect(() => {
    const id = hashParams.receiptId;
    if (!id) {
      if (viewingReceipt) setViewingReceipt(null);
      return;
    }
    if (viewingReceipt && String((viewingReceipt as any).id) === String(id)) return;
    const found = (receipts as any[]).find(r => String(r.id) === String(id));
    if (found) setViewingReceipt(found as any);
  }, [hashParams.receiptId, receipts]);

  const openPLPreview = useCallback(() => {
    setShowPLPreview(true);
    updateHashParams({ modal: 'pl' }, { keepPath: true });
  }, [updateHashParams]);

  const closePLPreview = useCallback(() => {
    setShowPLPreview(false);
    updateHashParams({ modal: null }, { replace: true, keepPath: true });
  }, [updateHashParams]);

  useEffect(() => {
    const should = hashParams.modal === 'pl';
    if (should !== showPLPreview) setShowPLPreview(should);
  }, [hashParams.modal, showPLPreview]);

  const openHelp = useCallback(() => {
    setShowHelpModal(true);
    updateHashParams({ modal: 'help' }, { keepPath: true });
  }, [updateHashParams]);

  const closeHelp = useCallback(() => {
    setShowHelpModal(false);
    updateHashParams({ modal: null }, { replace: true, keepPath: true });
  }, [updateHashParams]);

  useEffect(() => {
    const should = hashParams.modal === 'help';
    if (should !== showHelpModal) setShowHelpModal(should);
  }, [hashParams.modal, showHelpModal]);

  // Tax Planner State
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [plannerTab, setPlannerTab] = useState<'basic' | 'advanced'>('basic');
  const [advSection, setAdvSection] = useState<string | null>(null);
  const [plannerData, setPlannerData] = useState({
      income: 0,
      expenses: 0,
      filingStatus: 'single' as 'single' | 'joint' | 'head' | 'separate',
      taxRate: 15,
      useCustomRate: false,
      useSE: true,
      useStdDed: true,
      retirement: 0,
      credits: 0,
      // Advanced fields
      otherIncomeInterest: 0,
      otherIncomeDividends: 0,
      otherIncomeCapital: 0,
      otherIncomeOther: 0,
      deductionMode: 'standard' as 'standard' | 'itemized',
      itemizedDeduction: 0,
      adjustmentHSA: 0,
      adjustmentHealth: 0,
      // Section E: QBI
      applyQBI: false,
      qbiOverride: 0,
      // Section F: Payments
      paymentsYTD: 0,
      withholdingYTD: 0,
      lastYearTaxRef: 0
  });

  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('monthly');
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());

  const formatCurrency = useMemo(() => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: settings.currencySymbol === '€' ? 'EUR' : settings.currencySymbol === '£' ? 'GBP' : 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }, [settings.currencySymbol]);

  // --- Money helpers (cents-safe math to avoid 0.01 rounding issues) ---
  const toCents = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) : 0;
  };
  const centsToNumber = (c: number) => c / 100;

  const calcDocTotals = (
    items: Array<{ quantity: number; rate: number }> | undefined,
    discount?: number,
    taxRate?: number,
    shipping?: number
  ) => {
    let subtotalC = 0;
    if (items && items.length) {
      for (const it of items) {
        const qty = Number(it.quantity) || 0;
        const rate = Number(it.rate) || 0;
        subtotalC += toCents(qty * rate); // round each line to cents first
      }
    }
    const discountC = toCents(discount || 0);
    const shippingC = toCents(shipping || 0);
    const taxableC = Math.max(0, subtotalC - discountC);
    const pct = Number(taxRate) || 0;
    const taxC = pct ? Math.round((taxableC * pct) / 100) : 0; // taxableC is already cents
    const totalC = Math.max(0, taxableC + taxC + shippingC);
    return {
      subtotal: centsToNumber(subtotalC),
      discount: centsToNumber(discountC),
      taxable: centsToNumber(taxableC),
      tax: centsToNumber(taxC),
      shipping: centsToNumber(shippingC),
      total: centsToNumber(totalC),
    };
  };



  const estimateDocTotals = useMemo(() => {
    if (!selectedEstimateForDoc) return null;
    return calcDocTotals(
      (selectedEstimateForDoc.items as any) || [],
      selectedEstimateForDoc.discount || 0,
      selectedEstimateForDoc.taxRate || 0,
      selectedEstimateForDoc.shipping || 0
    );
  }, [selectedEstimateForDoc]);

  const invoiceDocTotals = useMemo(() => {
    if (!selectedInvoiceForDoc) return null;
    return calcDocTotals(
      (selectedInvoiceForDoc.items as any) || [],
      selectedInvoiceForDoc.discount || 0,
      selectedInvoiceForDoc.taxRate || 0,
      0
    );
  }, [selectedInvoiceForDoc]);



  // Tax Planner Calculations (2026)
  const plannerResults = useMemo(() => {
      const income = Number(plannerData.income) || 0;
      const expenses = Number(plannerData.expenses) || 0;
      const profit = Math.max(0, income - expenses);
      const rate = Number(plannerData.taxRate) / 100;
      const credits = Number(plannerData.credits) || 0;
      
      const seTax = plannerData.useSE ? Math.max(0, profit) * TAX_PLANNER_2026.SE_TAX_RATE : 0;
      
      if (plannerTab === 'basic') {
          let stdDed = 0;
          if (plannerData.useStdDed) {
              if (plannerData.filingStatus === 'joint') stdDed = TAX_PLANNER_2026.STD_DEDUCTION_JOINT;
              else if (plannerData.filingStatus === 'head') stdDed = TAX_PLANNER_2026.STD_DEDUCTION_HEAD;
              else stdDed = TAX_PLANNER_2026.STD_DEDUCTION_SINGLE;
          }

          const retirement = Number(plannerData.retirement) || 0;
          const taxableIncome = Math.max(0, profit - stdDed - retirement);
          
          const incomeTax = taxableIncome * rate;
          const totalTax = Math.max(0, incomeTax + seTax - credits);
          
          return {
              profit,
              otherIncome: 0,
              adjustments: retirement,
              deduction: stdDed,
              qbiDeduction: 0,
              taxableIncome,
              incomeTax,
              seTax,
              totalTax,
              paidSoFar: 0,
              taxRemaining: totalTax,
              taxAhead: 0,
              monthly: totalTax / 12,
              quarterly: totalTax / 4,
              quarterlySuggestion: totalTax / 4
          };
      } else {
          // Advanced Logic
          const otherInc = (Number(plannerData.otherIncomeInterest)||0) + (Number(plannerData.otherIncomeDividends)||0) + (Number(plannerData.otherIncomeCapital)||0) + (Number(plannerData.otherIncomeOther)||0);
          const adjustments = (Number(plannerData.retirement)||0) + (Number(plannerData.adjustmentHSA)||0) + (Number(plannerData.adjustmentHealth)||0);
          
          let deduction = 0;
          if (plannerData.deductionMode === 'itemized') {
              deduction = Number(plannerData.itemizedDeduction) || 0;
          } else {
              if (plannerData.filingStatus === 'joint') deduction = TAX_PLANNER_2026.STD_DEDUCTION_JOINT;
              else if (plannerData.filingStatus === 'head') deduction = TAX_PLANNER_2026.STD_DEDUCTION_HEAD;
              else deduction = TAX_PLANNER_2026.STD_DEDUCTION_SINGLE;
          }

          // QBI Logic
          const userQbiBase = Number(plannerData.qbiOverride);
          const qbiBase = userQbiBase > 0 ? userQbiBase : Math.max(0, profit);
          const qbiDeduction = plannerData.applyQBI ? qbiBase * 0.2 : 0;

          const baseIncome = profit + otherInc;
          const taxableIncome = Math.max(0, baseIncome - adjustments - deduction - qbiDeduction);
          const incomeTax = taxableIncome * rate;
          const totalTax = Math.max(0, incomeTax + seTax - credits);

          // Payments Logic
          const paidSoFar = (Number(plannerData.paymentsYTD)||0) + (Number(plannerData.withholdingYTD)||0);
          const taxRemaining = Math.max(0, totalTax - paidSoFar);
          const taxAhead = Math.max(0, paidSoFar - totalTax);

          return {
              profit,
              otherIncome: otherInc,
              adjustments,
              deduction,
              qbiDeduction,
              taxableIncome,
              incomeTax,
              seTax,
              totalTax,
              paidSoFar,
              taxRemaining,
              taxAhead,
              monthly: totalTax / 12,
              quarterly: totalTax / 4,
              quarterlySuggestion: taxRemaining > 0 ? taxRemaining / 4 : 0
          };
      }
  }, [plannerData, plannerTab]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('moniezi_theme') as 'light' | 'dark' | null;
    if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
        document.documentElement.classList.toggle('theme-light', savedTheme === 'light');
    } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('theme-light');
    }
  }, []);

  useEffect(() => {
    if (isLicenseValid === true && deferredInstallPrompt && !isRunningStandalone) {
      const timer = window.setTimeout(() => setShowDeferredInstallCta(true), 600);
      return () => window.clearTimeout(timer);
    }
    setShowDeferredInstallCta(false);
  }, [isLicenseValid, deferredInstallPrompt, isRunningStandalone]);

  useEffect(() => {
    const { isIosDevice } = getIosInstallContext();
    if (isLicenseValid === true && isIosDevice && !isRunningStandalone) {
      const timer = window.setTimeout(() => setShowIosInstallCta(true), 700);
      return () => window.clearTimeout(timer);
    }
    setShowIosInstallCta(false);
    setShowIosInstallHelp(false);
  }, [getIosInstallContext, isLicenseValid, isRunningStandalone]);

  // License validation on app load
  useEffect(() => {
    if (!LICENSING_ENABLED) {
      setIsLicenseValid(true);
      return;
    }
    const checkStoredLicense = async () => {
      const stored = localStorage.getItem(LICENSE_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Verify the stored license is still valid
          const isValid = await validateLicenseWithServer(parsed.key);
          if (isValid) {
            setIsLicenseValid(true);
            setLicenseInfo({ email: parsed.email, purchaseDate: parsed.purchaseDate });
          } else {
            // License no longer valid, clear it
            localStorage.removeItem(LICENSE_STORAGE_KEY);
            setIsLicenseValid(false);
          }
        } catch {
          setIsLicenseValid(false);
        }
      } else {
        setIsLicenseValid(false);
      }
    };
    checkStoredLicense();
  }, []);

  // Production licensing configuration. The app never accepts an unverified customer key.
  const LICENSE_API_BASE = String((import.meta as any).env?.VITE_LICENSE_API_BASE || "").trim();
  const PURCHASE_URL = String((import.meta as any).env?.VITE_PURCHASE_URL || "").trim();
  const TERMS_URL = String((import.meta as any).env?.VITE_TERMS_URL || "").trim();
  const PRIVACY_URL = String((import.meta as any).env?.VITE_PRIVACY_URL || "").trim();
  const SUPPORT_EMAIL = String((import.meta as any).env?.VITE_SUPPORT_EMAIL || "").trim();
  const LICENSE_GRACE_DAYS = 30;

  // Validate online, with a limited offline grace period only after a successful server validation
  const validateLicenseWithServer = async (key: string): Promise<boolean> => {
    if (!LICENSING_ENABLED) return true;

    const normalizedKey = key.trim();
    const deviceId = getOrCreateDeviceId();
    const stored = parseStoredLicense(localStorage.getItem(LICENSE_STORAGE_KEY));

    const hasValidStoredBinding = (candidate: StoredLicense | null) => {
      if (!candidate) return false;
      if (candidate.key !== normalizedKey) return false;
      if (candidate.deviceId !== deviceId) return false;
      return candidate.token === createLicenseToken(candidate.key, deviceId);
    };

    if (stored && !hasValidStoredBinding(stored)) {
      localStorage.removeItem(LICENSE_STORAGE_KEY);
    }

    if (!isAcceptedCustomerLicenseFormat(normalizedKey)) {
      return false;
    }

    if (!LICENSE_API_BASE) {
      console.error('MONIEZI license service is not configured.');
      return false;
    }

    try {
      const url = LICENSE_API_BASE.replace(/\/$/, "") + "/validate";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: normalizedKey, device_id: deviceId }),
      });

      if (!response.ok) {
        return hasValidStoredBinding(stored) && isStoredLicenseWithinGrace(stored);
      }

      const data = await response.json();
      const ok = data.valid === true;

      if (ok) {
        const updated: StoredLicense = {
          key: normalizedKey,
          email: data.email || stored?.email || '',
          purchaseDate: data.purchaseDate || stored?.purchaseDate || new Date().toISOString(),
          validated: true,
          activatedAt: stored?.activatedAt || new Date().toISOString(),
          lastValidatedAt: new Date().toISOString(),
          validUntil: new Date(Date.now() + LICENSE_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          licenseType: 'customer',
          deviceId,
          token: createLicenseToken(normalizedKey, deviceId),
        };
        localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(updated));
      }

      return ok;
    } catch (error) {
      console.error("License validation error:", error);
      return hasValidStoredBinding(stored) && isStoredLicenseWithinGrace(stored);
    }
  };


  // Handle license activation
  const handleActivateLicense = async () => {
    if (!LICENSING_ENABLED) {
      setIsLicenseValid(true);
      setLicenseError("");
      showToast("Licensing is disabled in this build", "success");
      return;
    }
    if (!licenseKey.trim()) {
      setLicenseError('Please enter a license key');
      return;
    }
    if (!LICENSE_API_BASE) {
      setLicenseError('License activation is not configured for this release.');
      return;
    }

    setIsValidatingLicense(true);
    setLicenseError('');

    try {
      const ok = await validateLicenseWithServer(licenseKey.trim());
      if (ok) {
        const stored = parseStoredLicense(localStorage.getItem(LICENSE_STORAGE_KEY));
        setLicenseInfo({ email: stored?.email, purchaseDate: stored?.purchaseDate });
        (document.activeElement as HTMLElement | null)?.blur?.();
        window.scrollTo({ top: 0, left: 0 });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        setCurrentPage(Page.Dashboard);
        setIsLicenseValid(true);
        setShowLicenseModal(false);
        setTimeout(() => window.scrollTo({ top: 0, left: 0 }), 60);
        const standalone = evaluateStandaloneMode();
        if (!standalone) {
          if (deferredInstallPrompt) {
            setShowDeferredInstallCta(true);
          } else if (getIosInstallContext().isIosDevice) {
            setShowIosInstallCta(true);
          }
        }
        showToast('License activated', 'success');
      } else {
        setLicenseError('Invalid license key. Please check and try again.');
      }
    } catch (error) {
      setLicenseError('Unable to validate license. Please check your internet connection and try again.');
    } finally {
      setIsValidatingLicense(false);
    }
  };

  // Deactivate license (for settings)
  const handleDeactivateLicense = () => {
    if (confirm('Are you sure you want to deactivate your license? You will need to re-enter your license key to use the app.')) {
      localStorage.removeItem(LICENSE_STORAGE_KEY);
      setIsLicenseValid(false);
      setLicenseKey('');
      setLicenseInfo(null);
    }
  };

  useEffect(() => {
    if (currentPage === Page.Reports && scrollToTaxSnapshot && taxSnapshotRef.current) {
        setTimeout(() => {
            taxSnapshotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setScrollToTaxSnapshot(false);
        }, 100);
    }
  }, [currentPage, scrollToTaxSnapshot]);

  const toggleTheme = () => {
      const newTheme = theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      document.documentElement.classList.toggle('theme-light', newTheme === 'light');
      localStorage.setItem('moniezi_theme', newTheme);
  };

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    evaluateStandaloneMode();

    const onBeforeInstallPrompt = (event: any) => {
      try { event.preventDefault?.(); } catch {}
      setDeferredInstallPrompt(event);
      setShowDeferredInstallCta(false);
    };

    const onAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setShowDeferredInstallCta(false);
      setIsRunningStandalone(true);
      showToast('Installed. Open MONIEZI from your Home Screen.', 'success');
    };

    const onVisibility = () => evaluateStandaloneMode();
    const onResize = () => evaluateStandaloneMode();

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', onAppInstalled as EventListener);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', onAppInstalled as EventListener);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
    };
  }, [evaluateStandaloneMode, showToast]);

  const removeToast = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));

  // --- iOS body scroll lock: prevents background scroll & horizontal drift when modals are open ---
  const scrollLockCountRef = useRef(0);

  const lockBodyScroll = useCallback(() => {
    scrollLockCountRef.current += 1;
    if (scrollLockCountRef.current === 1) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      // Reset any phantom horizontal scroll before locking
      window.scrollTo({ left: 0, top: scrollY, behavior: 'instant' as ScrollBehavior });
      document.body.style.setProperty('--scroll-top', `-${scrollY}px`);
      document.body.classList.add('modal-open');
    }
  }, []);

  const unlockBodyScroll = useCallback(() => {
    scrollLockCountRef.current = Math.max(0, scrollLockCountRef.current - 1);
    if (scrollLockCountRef.current === 0) {
      const scrollY = Math.abs(parseInt(document.body.style.getPropertyValue('--scroll-top') || '0', 10));
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('--scroll-top');
      window.scrollTo(0, scrollY);
    }
  }, []);


  // Lock body scroll when Drawer / Receipt View / PDF preview modals are open
  useEffect(() => {
    if (isDrawerOpen) { lockBodyScroll(); return () => { unlockBodyScroll(); }; }
  }, [isDrawerOpen, lockBodyScroll, unlockBodyScroll]);

  useEffect(() => {
    if (viewingReceipt) { lockBodyScroll(); return () => { unlockBodyScroll(); }; }
  }, [viewingReceipt, lockBodyScroll, unlockBodyScroll]);

  useEffect(() => {
    if (isPdfPreviewOpen) { lockBodyScroll(); return () => { unlockBodyScroll(); }; }
  }, [isPdfPreviewOpen, lockBodyScroll, unlockBodyScroll]);

  useEffect(() => {
    if (isEstimatePdfPreviewOpen) { lockBodyScroll(); return () => { unlockBodyScroll(); }; }
  }, [isEstimatePdfPreviewOpen, lockBodyScroll, unlockBodyScroll]);

  useEffect(() => {
    // Keep the standard P&L preview body-locked, but do not body-lock the Pro P&L portal overlay.
    // On iPhone/iOS, body position:fixed + portal-to-body can shift the overlay upward and hide its header.
    if (showPLPreview) { lockBodyScroll(); return () => { unlockBodyScroll(); }; }
  }, [showPLPreview, lockBodyScroll, unlockBodyScroll]);

  useEffect(() => {
    if (showHelpModal) { lockBodyScroll(); return () => { unlockBodyScroll(); }; }
  }, [showHelpModal, lockBodyScroll, unlockBodyScroll]);

  useEffect(() => {
    if (scanPreview) { lockBodyScroll(); return () => { unlockBodyScroll(); }; }
  }, [scanPreview, lockBodyScroll, unlockBodyScroll]);

  useEffect(() => {
    if (isClientModalOpen) { lockBodyScroll(); return () => { unlockBodyScroll(); }; }
  }, [isClientModalOpen, lockBodyScroll, unlockBodyScroll]);

  useEffect(() => {
    if (showInsights) { lockBodyScroll(); return () => { unlockBodyScroll(); }; }
  }, [showInsights, lockBodyScroll, unlockBodyScroll]);

  useKeyboardSafeScroll({ containerRef: mainScrollRef, enabled: true });

  const findMatchingClientId = useCallback((data: Partial<Invoice> & Partial<Estimate>) => {
    const email = normalize((data as any).clientEmail || '');
    const name = normalize((data as any).client || '');
    const company = normalize((data as any).clientCompany || '');

    if (data.clientId && clients.some(c => c.id === data.clientId)) return data.clientId;

    if (email) {
      const byEmail = clients.find(c => normalize(c.email || '') === email);
      if (byEmail) return byEmail.id;
    }
    if (name) {
      const byName = clients.find(c => normalize(c.name) === name && normalize(c.company || '') === company);
      if (byName) return byName.id;
      const byNameOnly = clients.find(c => normalize(c.name) === name);
      if (byNameOnly) return byNameOnly.id;
    }
    return undefined;
  }, [clients]);

  const upsertClientFromDoc = useCallback((data: Partial<Invoice> & Partial<Estimate>, statusHint: ClientStatus) => {
    const clientName = (data as any).client?.trim();
    if (!clientName) return undefined;

    const now = new Date().toISOString();
    const existingId = findMatchingClientId(data);

    if (existingId) {
      setClients(prev => prev.map(c => {
        if (c.id !== existingId) return c;
        return {
          ...c,
          name: clientName,
          company: (data as any).clientCompany || c.company,
          email: (data as any).clientEmail || c.email,
          address: (data as any).clientAddress || c.address,
          status: c.status === 'inactive' ? c.status : statusHint,
          updatedAt: now,
        };
      }));
      return existingId;
    }

    const newClient: Client = {
      id: generateId('cli'),
      name: clientName,
      company: (data as any).clientCompany || '',
      email: (data as any).clientEmail || '',
      phone: '',
      address: (data as any).clientAddress || '',
      notes: '',
      status: statusHint,
      createdAt: now,
      updatedAt: now,
    };
    setClients(prev => [newClient, ...prev]);
    return newClient.id;
  }, [findMatchingClientId]);

  const fillDocFromClient = useCallback((clientId: string) => {
    const c = clients.find(x => x.id === clientId);
    if (!c) return;
    setActiveItem(prev => ({
      ...prev,
      clientId: c.id,
      client: c.name,
      clientCompany: c.company || '',
      clientEmail: c.email || '',
      clientAddress: c.address || '',
    }));
  }, [clients]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const applyDefaults = (parsedSettings: any) => {
        const defaultMethod: TaxEstimationMethod = parsedSettings?.taxEstimationMethod || 'custom';
        setSettings({
          businessName: "My Business",
          ownerName: "Owner",
          payPrefs: DEFAULT_PAY_PREFS,
          taxRate: 22,
          stateTaxRate: 0,
          taxEstimationMethod: defaultMethod,
          filingStatus: 'single',
          currencySymbol: '$',
          showLogoOnInvoice: true,
          logoAlignment: 'left',
          brandColor: '#2563eb',
          requireReceiptOverThreshold: false,
          receiptThreshold: 0,
          receiptReminderEnabled: true,
          mileageRateCents: 72.5,
          ...parsedSettings,
        });
      };

      let parsed: any = null;
      let source: 'idb' | 'localStorage' | null = null;

      // 1) Prefer IndexedDB app-state (large-capacity, mobile-friendly)
      try {
        parsed = await loadAppState();
        if (parsed) source = 'idb';
      } catch (e) {
        console.error("IndexedDB load failed, falling back to localStorage", e);
      }

      // 2) Fallback: legacy localStorage payload (older versions)
      if (!parsed) {
        const saved = localStorage.getItem(DB_KEY);
        if (saved) {
          try {
            parsed = JSON.parse(saved);
            source = 'localStorage';
          } catch (e) {
            console.error("Error parsing legacy localStorage payload", e);
            parsed = null;
            source = null;
          }
        }
      }

      if (parsed) {
        try {
          setTransactions(parsed.transactions || []);
          setInvoices(parsed.invoices || []);
          setEstimates(parsed.estimates || []);
          setClients(parsed.clients || []);
          applyDefaults(parsed.settings);

          setCustomCategories({
            income: parsed.customCategories?.income || [],
            expense: parsed.customCategories?.expense || [],
            billing: parsed.customCategories?.billing || [],
          });

          setTaxPayments(parsed.taxPayments || []);
          if (!cancelled) setMileageTrips(parsed.mileageTrips || []);
          if (!cancelled) setCompanyEquity(normalizeCompanyEquityState(parsed.companyEquity, parsed.settings?.businessName || settings.businessName));
          if (!cancelled) setSavedTemplates(Array.isArray(parsed.savedTemplates) ? parsed.savedTemplates : []);
          if (!cancelled) setDuplicationHistory(parsed.duplicationHistory || {});
          if (!cancelled && parsed.plannerData) setPlannerData(parsed.plannerData);
          if (!cancelled) setIsDemoData(!!parsed.isDemoData);

          // Receipts: migrate any embedded imageData -> IndexedDB receipt blobs, store metadata only in app-state
          const loadedReceipts: any[] = Array.isArray(parsed.receipts) ? parsed.receipts : [];
          const migrated: ReceiptType[] = [];
          let migratedAny = false;

          for (const r of loadedReceipts) {
            if (!r?.id) continue;

            if (r.imageData) {
              migratedAny = true;
              const { blob, mimeType } = await dataUrlToBlob(r.imageData);
              await putReceiptBlob(r.id, blob, mimeType);
              migrated.push({
                id: r.id,
                date: r.date || new Date().toISOString().split('T')[0],
                imageKey: r.id,
                mimeType,
                note: r.note,
              } as ReceiptType);
            } else if (r.imageKey) {
              migrated.push(r as ReceiptType);
            }
          }

          if (!cancelled) setReceipts(migrated);

          // If we loaded from localStorage OR we had any legacy receipt imageData, migrate to IndexedDB app-state
          if (source === 'localStorage' || migratedAny) {
            try {
              const receiptsMeta = migrated.map(r => ({ id: r.id, date: r.date, imageKey: r.imageKey, mimeType: r.mimeType, note: r.note }));
              const cleaned = {
                transactions: parsed.transactions || [],
                invoices: parsed.invoices || [],
                estimates: parsed.estimates || [],
                clients: parsed.clients || [],
                settings: parsed.settings || {},
                taxPayments: parsed.taxPayments || [],
                customCategories: parsed.customCategories || { income: [], expense: [], billing: [] },
                receipts: receiptsMeta,
                mileageTrips: parsed.mileageTrips || [],
                companyEquity: normalizeCompanyEquityState(parsed.companyEquity, parsed.settings?.businessName || settings.businessName),
                savedTemplates: Array.isArray(parsed.savedTemplates) ? parsed.savedTemplates : [],
                duplicationHistory: parsed.duplicationHistory || {},
                plannerData: parsed.plannerData,
                isDemoData: !!parsed.isDemoData,
              };
              await saveAppState(cleaned);

              // Keep the legacy key only as a migration source; remove to avoid quota issues.
              try { localStorage.removeItem(DB_KEY); } catch { /* ignore */ }

              showToast("Upgraded storage to IndexedDB for better capacity & reliability.", "success");
            } catch (e) {
              console.error("Failed to migrate app-state to IndexedDB", e);
            }
          }
        } catch (e) {
          console.error("Error loading data", e);
          showToast("Failed to load saved data.", "error");
          applyDefaults(null);
        }
      } else {
        // First run: start empty (no auto-demo seeding)
        setTransactions([]);
        setInvoices([]);
        setEstimates([]);
        setClients([]);
        setTaxPayments([]);
        setCustomCategories({ income: [], expense: [], billing: [] });
        setReceipts([]);
        applyDefaults(null);
        setMileageTrips([]);
        setCompanyEquity(createDefaultCompanyEquityState());
        setSavedTemplates([]);
        setDuplicationHistory({});
        setIsDemoData(false);
      }

      if (!cancelled) setDataLoaded(true);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dataLoaded) return;

    // Debounced IndexedDB write to avoid excessive transactions while typing.
    if (appStateSaveTimerRef.current) {
      window.clearTimeout(appStateSaveTimerRef.current);
    }

    const receiptsMeta = receipts.map(r => ({ id: r.id, date: r.date, imageKey: r.imageKey, mimeType: r.mimeType, note: r.note }));
    const payload = {
      transactions,
      invoices,
      estimates,
      clients,
      settings,
      taxPayments,
      customCategories,
      receipts: receiptsMeta,
      mileageTrips,
      companyEquity,
      savedTemplates,
      duplicationHistory,
      plannerData,
      isDemoData,
    };

    appStateSaveTimerRef.current = window.setTimeout(() => {
      (async () => {
        try {
          await saveAppState(payload);
        } catch (e) {
          console.error("Save failed (IndexedDB?)", e);
          showToast("Warning: Could not save data (storage). Export a backup now.", "error");
        }
      })();
    }, 350);

    return () => {
      if (appStateSaveTimerRef.current) {
        window.clearTimeout(appStateSaveTimerRef.current);
      }
    };
  }, [transactions, invoices, estimates, clients, settings, taxPayments, customCategories, receipts, mileageTrips, companyEquity, savedTemplates, duplicationHistory, plannerData, isDemoData, dataLoaded]);

  useEffect(() => {
    if (!dataLoaded) return;
    if (recurringInvoicesProcessedRef.current) return; // Only process once per session
    const todayStr = new Date().toISOString().split('T')[0];
    const activeRecurring = invoices.filter(inv => inv.recurrence && inv.recurrence.active && inv.recurrence.nextDate <= todayStr && inv.status !== 'void');
    
    if (activeRecurring.length > 0) {
      recurringInvoicesProcessedRef.current = true;
      const generatedInvoices: Invoice[] = [];
      const updatedParentInvoices = [...invoices];
      activeRecurring.forEach(parent => {
        if (!parent.recurrence) return;
        let currentNextDate = parent.recurrence.nextDate;
        while (currentNextDate <= todayStr) {
           const newDate = currentNextDate;
           const parentDateObj = new Date(parent.date);
           const parentDueObj = new Date(parent.due);
           const termDays = Math.ceil((parentDueObj.getTime() - parentDateObj.getTime()) / (1000 * 3600 * 24));
           const newDueObj = new Date(newDate);
           newDueObj.setDate(newDueObj.getDate() + termDays);
           generatedInvoices.push({
             ...parent,
             id: generateId('inv_auto'),
             date: newDate,
             due: newDueObj.toISOString().split('T')[0],
             status: 'unpaid',
             recurrence: undefined, 
             linkedTransactionId: undefined, 
             notes: `Generated from recurring invoice #${parent.id.substring(parent.id.length - 6).toUpperCase()}`
           });
           currentNextDate = calculateNextDate(currentNextDate, parent.recurrence.frequency);
        }
        const parentIndex = updatedParentInvoices.findIndex(p => p.id === parent.id);
        if (parentIndex >= 0) {
          updatedParentInvoices[parentIndex] = {
            ...parent,
            recurrence: {
              ...parent.recurrence,
              nextDate: currentNextDate
            }
          };
        }
      });
      if (generatedInvoices.length > 0) {
        setInvoices([...generatedInvoices, ...updatedParentInvoices]);
        showToast(`${generatedInvoices.length} recurring invoice(s) generated.`, 'success');
      }
    }
  }, [dataLoaded, invoices]); 

  const totals = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const profit = income - expense;
    const allUnpaid = invoices.filter(i => i.status === 'unpaid');
    const overdueAmount = allUnpaid.filter(i => getDaysOverdue(i.due) > 0).reduce((sum, i) => sum + i.amount, 0);
    const pendingAmount = allUnpaid.reduce((sum, i) => sum + i.amount, 0);
    const totalTaxRate = (settings.taxRate / 100) + (settings.stateTaxRate / 100) + TAX_CONSTANTS.SE_TAX_RATE;
    const estimatedTax = profit > 0 ? profit * totalTaxRate : 0;
    const pendingCount = allUnpaid.length;
    const overdueCount = allUnpaid.filter(i => getDaysOverdue(i.due) > 0).length;
    return { income, expense, profit, pendingAmount, overdueAmount, pendingCount, overdueCount, estimatedTax };
  }, [transactions, invoices, settings.taxRate, settings.stateTaxRate]);

  const homeTotals = useMemo(() => {
    const parse = (dateStr: string) => {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    };

    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const rangeFor = (p: HomeKpiPeriod): { start: Date | null; end: Date } => {
      if (p === 'all') return { start: null, end: endDate };
      if (p === 'ytd') return { start: new Date(now.getFullYear(), 0, 1), end: endDate };
      if (p === 'mtd') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endDate };
      // '30d'
      const start = new Date(endDate);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { start, end: endDate };
    };

    const { start, end } = rangeFor(homeKpiPeriod);
    const inRange = (t: Transaction) => {
      const d = parse(t.date);
      if (!d) return false;
      if (start && d < start) return false;
      return d <= end;
    };

    const scoped = transactions.filter(inRange);
    const income = scoped.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = scoped.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const profit = income - expense;

    const label = homeKpiPeriod === 'ytd' ? 'This Year' : homeKpiPeriod === 'mtd' ? 'This Month' : homeKpiPeriod === '30d' ? '30 Days' : 'All Time';

    const fmtShort = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const rangeText = start ? `${fmtShort(start)} — ${fmtShort(end)}` : `All Time`;

    return { income, expense, profit, label, rangeText };
  }, [transactions, homeKpiPeriod]);

  // Sales Pipeline Stats
  const pipelineStats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Filter estimates from last 30 days for "active" pipeline
    const recentEstimates = estimates.filter(est => {
      const estDate = new Date(est.date);
      return estDate >= thirtyDaysAgo;
    });

    // All-time stats
    const allDraft = estimates.filter(e => e.status === 'draft');
    const allSent = estimates.filter(e => e.status === 'sent');
    const allAccepted = estimates.filter(e => e.status === 'accepted');
    const allDeclined = estimates.filter(e => e.status === 'declined');

    // Recent (30 days) stats
    const recentDraft = recentEstimates.filter(e => e.status === 'draft');
    const recentSent = recentEstimates.filter(e => e.status === 'sent');
    const recentAccepted = recentEstimates.filter(e => e.status === 'accepted');
    const recentDeclined = recentEstimates.filter(e => e.status === 'declined');

    // Calculate amounts
    const draftAmount = allDraft.reduce((sum, e) => sum + e.amount, 0);
    const sentAmount = allSent.reduce((sum, e) => sum + e.amount, 0);
    const acceptedAmount = allAccepted.reduce((sum, e) => sum + e.amount, 0);
    const declinedAmount = allDeclined.reduce((sum, e) => sum + e.amount, 0);

    // Pipeline value = draft + sent (potential revenue)
    const pipelineValue = draftAmount + sentAmount;

    // Conversion rate (accepted / (accepted + declined)) - only if there are completed estimates
    const completedCount = allAccepted.length + allDeclined.length;
    const conversionRate = completedCount > 0 ? (allAccepted.length / completedCount) * 100 : 0;

    // Recent conversion (last 30 days)
    const recentCompletedCount = recentAccepted.length + recentDeclined.length;
    const recentConversionRate = recentCompletedCount > 0 ? (recentAccepted.length / recentCompletedCount) * 100 : 0;

    // Awaiting response = sent estimates
    const awaitingResponse = allSent.length;
    const awaitingAmount = sentAmount;

    // Follow-up tracking - estimates with follow-up dates that are due or overdue
    const overdueFollowUps = allSent.filter(est => {
      if (est.followUpDate) {
        return est.followUpDate <= today;
      }
      // Legacy: if no followUpDate but sent more than 7 days ago
      if (est.sentAt) {
        const sentDate = new Date(est.sentAt);
        const sevenDaysLater = new Date(sentDate);
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
        return sevenDaysLater <= now;
      }
      // Fallback: use estimate date
      const estDate = new Date(est.date);
      const sevenDaysLater = new Date(estDate);
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
      return sevenDaysLater <= now;
    });

    // Upcoming follow-ups (in next 3 days)
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysISO = threeDaysFromNow.toISOString().split('T')[0];
    
    const upcomingFollowUps = allSent.filter(est => {
      if (est.followUpDate) {
        return est.followUpDate > today && est.followUpDate <= threeDaysISO;
      }
      return false;
    });

    // Sort overdue by urgency (oldest first)
    const sortedOverdue = [...overdueFollowUps].sort((a, b) => {
      const dateA = a.followUpDate || a.sentAt || a.date;
      const dateB = b.followUpDate || b.sentAt || b.date;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    return {
      draft: { count: allDraft.length, amount: draftAmount },
      sent: { count: allSent.length, amount: sentAmount },
      accepted: { count: allAccepted.length, amount: acceptedAmount },
      declined: { count: allDeclined.length, amount: declinedAmount },
      pipelineValue,
      conversionRate,
      recentConversionRate,
      awaitingResponse,
      awaitingAmount,
      needsFollowUp: overdueFollowUps.length,
      overdueFollowUps: sortedOverdue,
      upcomingFollowUps,
      totalEstimates: estimates.length,
      recentAccepted: recentAccepted.length,
      recentDeclined: recentDeclined.length,
    };
  }, [estimates]);


  const reportData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Helper to safely get amount as number
    const getAmt = (t: any) => Number(t.amount) || 0;
    // Helper to safe parse date
    const getYear = (dateStr: string) => {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 0 : d.getFullYear();
    };
    const getMonth = (dateStr: string) => {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? -1 : d.getMonth();
    };

    // 1. YTD Calculations (Calendar Year)
    const ytdTx = transactions.filter(t => getYear(t.date) === currentYear);
    
    const ytdIncome = ytdTx
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + getAmt(t), 0);
        
    const ytdExpense = ytdTx
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + getAmt(t), 0);

    // Allow negative for display
    const ytdNetProfit = ytdIncome - ytdExpense; 

    // 2. Tax Calculations
    // Tax is calculated on positive profit only
    const taxableProfit = Math.max(0, ytdNetProfit);

    const seTaxLiability = taxableProfit * TAX_CONSTANTS.SE_TAXABLE_PORTION * TAX_CONSTANTS.SE_TAX_RATE;
    
    const totalIncomeTaxRate = (settings.taxRate || 0) + (settings.stateTaxRate || 0);
    const incomeTaxLiability = taxableProfit * (totalIncomeTaxRate / 100);
    
    const totalEstimatedTax = seTaxLiability + incomeTaxLiability;
    
    // 3. Tax Payments (YTD)
    const taxPaymentsYTD = taxPayments.filter(p => getYear(p.date) === currentYear);
    const totalTaxPaidYTD = taxPaymentsYTD.reduce((sum, p) => sum + getAmt(p), 0);
    
    // 4. Current Period (Month) for P&L Card
    const currentMonthTx = transactions.filter(t => {
        return getMonth(t.date) === currentMonth && getYear(t.date) === currentYear;
    });
    
    const monthIncome = currentMonthTx
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + getAmt(t), 0);
        
    const monthExpense = currentMonthTx
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + getAmt(t), 0);

    const monthNetProfit = monthIncome - monthExpense;

    // 5. Extras
    const taxShield = ytdExpense * (TAX_CONSTANTS.SE_TAX_RATE + (totalIncomeTaxRate / 100));
    
    const stdDeduction = settings.filingStatus === 'joint' ? TAX_CONSTANTS.STD_DEDUCTION_JOINT : settings.filingStatus === 'head' ? TAX_CONSTANTS.STD_DEDUCTION_HEAD : TAX_CONSTANTS.STD_DEDUCTION_SINGLE;

    return { 
        income: monthIncome,
        expense: monthExpense,
        netProfit: monthNetProfit,
        ytdNetProfit, 
        seTaxLiability,
        incomeTaxLiability,
        totalEstimatedTax,
        stdDeduction,
        taxShield,
        totalTaxPaidYTD,
        taxRemaining: Math.max(0, totalEstimatedTax - totalTaxPaidYTD),
        taxAhead: Math.max(0, totalTaxPaidYTD - totalEstimatedTax),
        taxPaymentsYTD, 
        totalIncomeTaxRate
    };
  }, [transactions, settings, taxPayments]);

  // Pro P&L Data Calculation
  const proPLData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Calculate date range based on period type
    let startDate: Date;
    let endDate: Date;
    let priorStartDate: Date;
    let priorEndDate: Date;
    
    switch (plPeriodType) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        priorStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        priorEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
        endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
        priorStartDate = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
        priorEndDate = new Date(now.getFullYear(), currentQuarter * 3, 0);
        break;
      case 'year':
        startDate = new Date(currentYear, 0, 1);
        endDate = new Date(currentYear, 11, 31);
        priorStartDate = new Date(currentYear - 1, 0, 1);
        priorEndDate = new Date(currentYear - 1, 11, 31);
        break;
      case 'ytd':
        startDate = new Date(currentYear, 0, 1);
        endDate = now;
        priorStartDate = new Date(currentYear - 1, 0, 1);
        priorEndDate = new Date(currentYear - 1, now.getMonth(), now.getDate());
        break;
      case 'lastYear':
        startDate = new Date(currentYear - 1, 0, 1);
        endDate = new Date(currentYear - 1, 11, 31);
        priorStartDate = new Date(currentYear - 2, 0, 1);
        priorEndDate = new Date(currentYear - 2, 11, 31);
        break;
      case 'trailing12':
        endDate = now;
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1);
        priorEndDate = new Date(startDate.getTime() - 1);
        priorStartDate = new Date(priorEndDate.getFullYear() - 1, priorEndDate.getMonth(), priorEndDate.getDate() + 1);
        break;
      case 'custom':
        startDate = new Date(plCustomStart);
        endDate = new Date(plCustomEnd);
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        priorEndDate = new Date(startDate.getTime() - 1);
        priorStartDate = new Date(priorEndDate.getTime() - daysDiff * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(currentYear, 0, 1);
        endDate = now;
        priorStartDate = new Date(currentYear - 1, 0, 1);
        priorEndDate = new Date(currentYear - 1, now.getMonth(), now.getDate());
    }
    
    // Filter transactions by period
    const periodTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d >= startDate && d <= endDate;
    });
    
    const priorPeriodTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d >= priorStartDate && d <= priorEndDate;
    });
    
    // Categorize income with refunds as contra-revenue
    // Sales/Services = all income EXCEPT Refunds and Interest categories
    const salesServices = periodTx.filter(t => t.type === 'income' && 
      t.category !== 'Refunds' && 
      t.category !== 'Interest / Bank' && 
      t.category !== 'Interest'
    ).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
    // Income by category (for detailed breakdown)
    const incomeByCategory: Record<string, number> = {};
    periodTx.filter(t => t.type === 'income' && 
      t.category !== 'Refunds' && 
      t.category !== 'Interest / Bank' && 
      t.category !== 'Interest'
    ).forEach(t => {
      const cat = t.category || 'Other Income';
      incomeByCategory[cat] = (incomeByCategory[cat] || 0) + (Number(t.amount) || 0);
    });
    
    const priorIncomeByCategory: Record<string, number> = {};
    priorPeriodTx.filter(t => t.type === 'income' && 
      t.category !== 'Refunds' && 
      t.category !== 'Interest / Bank' && 
      t.category !== 'Interest'
    ).forEach(t => {
      const cat = t.category || 'Other Income';
      priorIncomeByCategory[cat] = (priorIncomeByCategory[cat] || 0) + (Number(t.amount) || 0);
    });
    
    // Refunds should be tracked from EXPENSE type with 'Refunds' category, OR income marked as refund
    // Check if refunds are logged as expenses (more common) or as negative income
    const refundsAsExpense = periodTx.filter(t => t.type === 'expense' && t.category === 'Refunds').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const refundsAsIncome = periodTx.filter(t => t.type === 'income' && t.category === 'Refunds').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const refunds = refundsAsExpense + refundsAsIncome;
    
    // Interest income (Other Income section)
    const interestIncome = periodTx.filter(t => t.type === 'income' && (t.category === 'Interest / Bank' || t.category === 'Interest')).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
    // Prior period income (same logic)
    const priorSalesServices = priorPeriodTx.filter(t => t.type === 'income' && 
      t.category !== 'Refunds' && 
      t.category !== 'Interest / Bank' && 
      t.category !== 'Interest'
    ).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const priorRefundsAsExpense = priorPeriodTx.filter(t => t.type === 'expense' && t.category === 'Refunds').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const priorRefundsAsIncome = priorPeriodTx.filter(t => t.type === 'income' && t.category === 'Refunds').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const priorRefunds = priorRefundsAsExpense + priorRefundsAsIncome;
    
    // Net Revenue
    const netRevenue = salesServices - refunds;
    const priorNetRevenue = priorSalesServices - priorRefunds;
    
    // COGS / Direct Costs (categories that are direct costs)
    const cogsCategories = ['Materials', 'Subcontractors', 'Shipping', 'Payment Processing', 'Direct Costs'];
    const cogs = periodTx.filter(t => t.type === 'expense' && cogsCategories.some(c => t.category.toLowerCase().includes(c.toLowerCase()))).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const priorCogs = priorPeriodTx.filter(t => t.type === 'expense' && cogsCategories.some(c => t.category.toLowerCase().includes(c.toLowerCase()))).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
    // COGS by category (for detailed breakdown)
    const cogsByCategory: Record<string, number> = {};
    periodTx.filter(t => t.type === 'expense' && cogsCategories.some(c => t.category.toLowerCase().includes(c.toLowerCase()))).forEach(t => {
      const cat = t.category || 'Direct Costs';
      cogsByCategory[cat] = (cogsByCategory[cat] || 0) + (Number(t.amount) || 0);
    });
    
    const priorCogsByCategory: Record<string, number> = {};
    priorPeriodTx.filter(t => t.type === 'expense' && cogsCategories.some(c => t.category.toLowerCase().includes(c.toLowerCase()))).forEach(t => {
      const cat = t.category || 'Direct Costs';
      priorCogsByCategory[cat] = (priorCogsByCategory[cat] || 0) + (Number(t.amount) || 0);
    });
    
    // Gross Profit
    const grossProfit = netRevenue - cogs;
    const priorGrossProfit = priorNetRevenue - priorCogs;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
    
    // Operating Expenses by category
    const opexCategories = [
      'Advertising & Marketing', 'Marketing', 'Advertising',
      'Bank Charges / Merchant Fees', 'Bank Charges', 'Merchant Fees',
      'Insurance',
      'Office Supplies', 'Office',
      'Phone/Internet', 'Phone', 'Internet', 'Communications',
      'Professional Fees', 'Legal', 'Accounting',
      'Rent / Lease', 'Rent', 'Lease',
      'Repairs & Maintenance', 'Repairs', 'Maintenance',
      'Software & Subscriptions', 'Software', 'Subscriptions', 'Software / SaaS',
      'Travel',
      'Meals', 'Meals & Entertainment',
      'Utilities',
      'Payroll', 'Wages', 'Salaries',
      'Payroll Taxes',
      'Taxes & Licenses', 'Taxes', 'Licenses',
      'Vehicle', 'Auto',
      'Depreciation', 'Amortization'
    ];
    
    // Get all expenses grouped by category (exclude COGS and Refunds)
    const expensesByCategory: Record<string, number> = {};
    const priorExpensesByCategory: Record<string, number> = {};
    
    periodTx.filter(t => t.type === 'expense' && 
      t.category !== 'Refunds' &&
      !cogsCategories.some(c => t.category.toLowerCase().includes(c.toLowerCase()))
    ).forEach(t => {
      const cat = t.category || 'Other';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (Number(t.amount) || 0);
    });
    
    priorPeriodTx.filter(t => t.type === 'expense' && 
      t.category !== 'Refunds' &&
      !cogsCategories.some(c => t.category.toLowerCase().includes(c.toLowerCase()))
    ).forEach(t => {
      const cat = t.category || 'Other';
      priorExpensesByCategory[cat] = (priorExpensesByCategory[cat] || 0) + (Number(t.amount) || 0);
    });
    
    // Group expenses into P&L sections
    const occupancyCategories = ['Rent', 'Rent / Workspace', 'Utilities', 'Equipment', 'Lease'];
    const marketingCategories = ['Marketing', 'Advertising', 'Advertising / Marketing', 'Advertising & Marketing', 'Promotions'];
    const payrollCategories = ['Payroll', 'Wages', 'Salaries', 'Contractors', 'Payroll Taxes', 'Subcontractors'];
    const gaCategories = ['Software / SaaS', 'Software & Subscriptions', 'Software', 'Subscriptions', 'Phone', 'Internet', 'Phone/Internet', 'Communications', 'Office Supplies', 'Office', 'Insurance', 'Professional Fees', 'Legal', 'Accounting', 'Bank Charges', 'Merchant Fees', 'Bank Charges / Merchant Fees', 'Taxes & Licenses', 'Taxes', 'Licenses', 'Travel', 'Meals', 'Meals & Entertainment', 'Meals (Business)'];
    
    const getGroupTotal = (categories: string[], data: Record<string, number>) => {
      return Object.entries(data)
        .filter(([cat]) => categories.some(c => cat.toLowerCase().includes(c.toLowerCase())))
        .reduce((sum, [, amt]) => sum + amt, 0);
    };
    
    const getGroupItems = (categories: string[], data: Record<string, number>) => {
      return Object.entries(data)
        .filter(([cat]) => categories.some(c => cat.toLowerCase().includes(c.toLowerCase())))
        .sort(([,a], [,b]) => b - a);
    };
    
    // Grouped totals
    const occupancyTotal = getGroupTotal(occupancyCategories, expensesByCategory);
    const priorOccupancyTotal = getGroupTotal(occupancyCategories, priorExpensesByCategory);
    const marketingTotal = getGroupTotal(marketingCategories, expensesByCategory);
    const priorMarketingTotal = getGroupTotal(marketingCategories, priorExpensesByCategory);
    const payrollTotal = getGroupTotal(payrollCategories, expensesByCategory);
    const priorPayrollTotal = getGroupTotal(payrollCategories, priorExpensesByCategory);
    const gaTotal = getGroupTotal(gaCategories, expensesByCategory);
    const priorGaTotal = getGroupTotal(gaCategories, priorExpensesByCategory);
    
    // Other expenses (not in any group)
    const allGroupedCategories = [...occupancyCategories, ...marketingCategories, ...payrollCategories, ...gaCategories];
    const otherExpenses = Object.entries(expensesByCategory)
      .filter(([cat]) => !allGroupedCategories.some(c => cat.toLowerCase().includes(c.toLowerCase())))
      .reduce((sum, [, amt]) => sum + amt, 0);
    const priorOtherExpenses = Object.entries(priorExpensesByCategory)
      .filter(([cat]) => !allGroupedCategories.some(c => cat.toLowerCase().includes(c.toLowerCase())))
      .reduce((sum, [, amt]) => sum + amt, 0);
    
    const totalOpex = Object.values(expensesByCategory).reduce((sum, amt) => sum + amt, 0);
    const priorTotalOpex = Object.values(priorExpensesByCategory).reduce((sum, amt) => sum + amt, 0);
    
    // Operating Income
    const operatingIncome = grossProfit - totalOpex;
    const priorOperatingIncome = priorGrossProfit - priorTotalOpex;
    const opexChange = priorTotalOpex > 0 ? ((totalOpex - priorTotalOpex) / priorTotalOpex) * 100 : 0;
    const operatingIncomeChange = priorOperatingIncome !== 0 ? ((operatingIncome - priorOperatingIncome) / Math.abs(priorOperatingIncome)) * 100 : 0;
    
    // Other Income/Expense
    const otherIncomeTotal = interestIncome;
    const interestExpense = periodTx.filter(t => t.type === 'expense' && (t.category === 'Interest Expense' || t.category === 'Interest')).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const netOtherIncome = otherIncomeTotal - interestExpense;
    
    // Prior period other income
    const priorInterestIncome = priorPeriodTx.filter(t => t.type === 'income' && (t.category === 'Interest / Bank' || t.category === 'Interest')).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const priorInterestExpense = priorPeriodTx.filter(t => t.type === 'expense' && (t.category === 'Interest Expense' || t.category === 'Interest')).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const priorNetOtherIncome = priorInterestIncome - priorInterestExpense;
    
    // Net Income
    const netIncome = operatingIncome + netOtherIncome;
    const priorNetIncome = priorOperatingIncome + priorNetOtherIncome;
    
    // Prior period sales (for comparison column)
    const priorSalesServicesGross = priorSalesServices + priorRefunds;
    
    // Data integrity checks
    const uncategorizedTx = periodTx.filter(t => !t.category || t.category === 'Uncategorized' || t.category === 'Other');
    const uncategorizedCount = uncategorizedTx.length;
    const uncategorizedAmount = uncategorizedTx.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
    // YoY change calculations
    const revenueChange = priorNetRevenue > 0 ? ((netRevenue - priorNetRevenue) / priorNetRevenue) * 100 : (netRevenue > 0 ? 100 : 0);
    const grossProfitChange = priorGrossProfit !== 0 ? ((grossProfit - priorGrossProfit) / Math.abs(priorGrossProfit)) * 100 : (grossProfit > 0 ? 100 : 0);
    const netIncomeChange = priorNetIncome !== 0 ? ((netIncome - priorNetIncome) / Math.abs(priorNetIncome)) * 100 : (netIncome > 0 ? 100 : 0);
    
    return {
      // Period info
      startDate,
      endDate,
      priorStartDate,
      priorEndDate,
      periodLabel: plPeriodType === 'custom' 
        ? `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : plPeriodType === 'ytd' ? `Year to Date (${currentYear})`
        : plPeriodType === 'lastYear' ? `Full Year ${currentYear - 1}`
        : plPeriodType === 'trailing12' ? 'Trailing 12 Months'
        : plPeriodType === 'month' ? now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : plPeriodType === 'quarter' ? `Q${Math.floor(now.getMonth() / 3) + 1} ${currentYear}`
        : `${currentYear}`,
      
      // Revenue
      salesServices,
      priorSalesServicesGross,
      incomeByCategory,
      priorIncomeByCategory,
      refunds,
      priorRefunds,
      netRevenue,
      priorNetRevenue,
      revenueChange,
      
      // COGS
      cogs,
      priorCogs,
      cogsByCategory,
      priorCogsByCategory,
      grossProfit,
      priorGrossProfit,
      grossMargin,
      grossProfitChange,
      
      // Operating Expenses - raw
      expensesByCategory,
      priorExpensesByCategory,
      totalOpex,
      priorTotalOpex,
      opexChange,
      
      // Grouped expenses
      occupancyTotal,
      priorOccupancyTotal,
      occupancyItems: getGroupItems(occupancyCategories, expensesByCategory),
      priorOccupancyItems: getGroupItems(occupancyCategories, priorExpensesByCategory),
      marketingTotal,
      priorMarketingTotal,
      marketingItems: getGroupItems(marketingCategories, expensesByCategory),
      priorMarketingItems: getGroupItems(marketingCategories, priorExpensesByCategory),
      payrollTotal,
      priorPayrollTotal,
      payrollItems: getGroupItems(payrollCategories, expensesByCategory),
      priorPayrollItems: getGroupItems(payrollCategories, priorExpensesByCategory),
      gaTotal,
      priorGaTotal,
      gaItems: getGroupItems(gaCategories, expensesByCategory),
      priorGaItems: getGroupItems(gaCategories, priorExpensesByCategory),
      otherExpenses,
      priorOtherExpenses,
      
      // Operating Income
      operatingIncome,
      priorOperatingIncome,
      operatingIncomeChange,
      operatingMargin: netRevenue > 0 ? (operatingIncome / netRevenue) * 100 : 0,
      
      // Other Income/Expense
      interestIncome,
      priorInterestIncome,
      interestExpense,
      priorInterestExpense,
      netOtherIncome,
      priorNetOtherIncome,
      
      // Net Income
      netIncome,
      priorNetIncome,
      netIncomeChange,
      netMargin: netRevenue > 0 ? (netIncome / netRevenue) * 100 : 0,
      
      // Data integrity
      uncategorizedCount,
      uncategorizedAmount,
      hasDataIssues: uncategorizedCount > 0,
      
      // Transaction count
      transactionCount: periodTx.length,
      priorTransactionCount: priorPeriodTx.length
    };
  }, [transactions, plPeriodType, plCustomStart, plCustomEnd]);

  const getFilteredTransactions = useCallback(() => {
     if (filterPeriod === 'all') return transactions;
     return transactions.filter(t => {
       const tDate = new Date(t.date);
       const checkDate = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());
       const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
       if (filterPeriod === 'daily') return checkDate.getTime() === ref.getTime();
       if (filterPeriod === 'weekly') {
          const start = getStartOfWeek(ref);
          const end = getEndOfWeek(ref);
          return checkDate >= start && checkDate <= end;
       }
       if (filterPeriod === 'monthly') return tDate.getMonth() === ref.getMonth() && tDate.getFullYear() === ref.getFullYear();
       return tDate.getFullYear() === ref.getFullYear();
     });
  }, [transactions, filterPeriod, referenceDate]);

  const filteredTransactions = useMemo(() => getFilteredTransactions(), [getFilteredTransactions]);

  const applyExpenseMetaFilters = useCallback((items: any[]) => {
    return items.filter((item: any) => {
      if (item?.dataType === 'invoice' || item?.type !== 'expense') return true;
      const hasReceipt = Boolean(item.receiptId);
      const reviewed = Boolean(item.reviewedAt);
      if (expenseReceiptFilter === 'with_receipts' && !hasReceipt) return false;
      if (expenseReceiptFilter === 'without_receipts' && hasReceipt) return false;
      if (expenseReviewFilter === 'reviewed' && !reviewed) return false;
      if (expenseReviewFilter === 'new' && reviewed) return false;
      return true;
    });
  }, [expenseReceiptFilter, expenseReviewFilter]);

  const filteredExpenseItems = useMemo(() => applyExpenseMetaFilters(
    filteredTransactions.filter(t => t.type === 'expense').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) as any
  ), [filteredTransactions, applyExpenseMetaFilters]);
  
  const ledgerItems = useMemo(() => {
    const txItems = transactions.map(t => ({ ...t, dataType: 'transaction', listId: t.id, original: t, sortDate: new Date(t.date).getTime() }));
    const invItems = invoices.map(i => ({ ...i, name: i.client, dataType: 'invoice', type: 'invoice', listId: i.id, original: i, sortDate: new Date(i.date).getTime() }));
    let merged = [...txItems, ...invItems];
    if (filterPeriod !== 'all') {
      merged = merged.filter(item => {
        const itemDate = new Date(item.date);
        const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
        if (filterPeriod === 'monthly') return itemDate.getMonth() === ref.getMonth() && itemDate.getFullYear() === ref.getFullYear();
        if (filterPeriod === 'yearly') return itemDate.getFullYear() === ref.getFullYear();
        return true; 
      });
    }
    if (ledgerFilter !== 'all') {
      merged = merged.filter(item => ledgerFilter === 'invoice' ? item.dataType === 'invoice' : item.type === ledgerFilter);
    }
    return merged.sort((a, b) => b.sortDate - a.sortDate);
  }, [transactions, invoices, filterPeriod, referenceDate, ledgerFilter]);

  const filteredLedgerItems = useMemo(() => applyExpenseMetaFilters(ledgerItems as any), [ledgerItems, applyExpenseMetaFilters]);

  const periodTotals = useMemo(() => {
    const inc = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { inc, exp, net: inc - exp };
  }, [filteredTransactions]);

  const getFilteredInvoices = useCallback(() => {
    if (filterPeriod === 'all') return invoices;
    return invoices.filter(i => {
      const iDate = new Date(i.date);
      const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
      if (filterPeriod === 'monthly') return iDate.getMonth() === ref.getMonth() && iDate.getFullYear() === ref.getFullYear();
      if (filterPeriod === 'yearly') return iDate.getFullYear() === ref.getFullYear();
      return true;
    });
 }, [invoices, filterPeriod, referenceDate]);

 const filteredInvoices = useMemo(() => getFilteredInvoices(), [getFilteredInvoices]);

  const displayedInvoices = useMemo(() => {
    if (invoiceQuickFilter === 'all') return filteredInvoices;
    if (invoiceQuickFilter === 'unpaid') return filteredInvoices.filter(i => i.status === 'unpaid');
    return filteredInvoices.filter(i => i.status === 'unpaid' && getDaysOverdue(i.due) > 0);
  }, [filteredInvoices, invoiceQuickFilter]);

  const invoiceQuickCounts = useMemo(() => {
    const validInvoices = filteredInvoices.filter(i => i.status !== 'void');
    const all = validInvoices.length;
    const unpaid = validInvoices.filter(i => i.status === 'unpaid').length;
    const overdue = validInvoices.filter(i => i.status === 'unpaid' && getDaysOverdue(i.due) > 0).length;
    return { all, unpaid, overdue };
  }, [filteredInvoices]);

 const invoicePeriodTotals = useMemo(() => {
   const validInvoices = filteredInvoices.filter(i => i.status !== 'void');
   const total = validInvoices.reduce((sum, i) => sum + i.amount, 0);
   const paid = validInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
   const unpaidAll = validInvoices.filter(i => i.status === 'unpaid');
   const unpaid = unpaidAll.reduce((sum, i) => sum + i.amount, 0);
   const overdue = unpaidAll.filter(i => getDaysOverdue(i.due) > 0).reduce((sum, i) => sum + i.amount, 0);
   return { total, paid, unpaid, overdue };
 }, [filteredInvoices]);

  // Estimates (Quotes)
  const getFilteredEstimates = useCallback(() => {
    if (filterPeriod === 'all') return estimates;
    return estimates.filter(e => {
      const eDate = new Date(e.date);
      const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
      if (filterPeriod === 'monthly') return eDate.getMonth() === ref.getMonth() && eDate.getFullYear() === ref.getFullYear();
      if (filterPeriod === 'yearly') return eDate.getFullYear() === ref.getFullYear();
      return true;
    });
  }, [estimates, filterPeriod, referenceDate]);

  const filteredEstimates = useMemo(() => getFilteredEstimates(), [getFilteredEstimates]);

  const displayedEstimates = useMemo(() => {
    if (estimateQuickFilter === 'all') return filteredEstimates;
    return filteredEstimates.filter(e => e.status === estimateQuickFilter);
  }, [filteredEstimates, estimateQuickFilter]);

  const estimateQuickCounts = useMemo(() => {
    const valid = filteredEstimates.filter(e => e.status !== 'void');
    const all = valid.length;
    const draft = valid.filter(e => e.status === 'draft').length;
    const sent = valid.filter(e => e.status === 'sent').length;
    const accepted = valid.filter(e => e.status === 'accepted').length;
    const declined = valid.filter(e => e.status === 'declined').length;
    return { all, draft, sent, accepted, declined };
  }, [filteredEstimates]);

 const recentCategories = useMemo(() => {
    if (!dataLoaded) return [];
    const sourceData = activeTab === 'billing' ? invoices.map(i => i.category) : transactions.filter(t => t.type === activeTab).map(t => t.category);
    const counts: Record<string, number> = {};
    sourceData.forEach(cat => { counts[cat] = (counts[cat] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat]) => cat);
 }, [transactions, invoices, activeTab, dataLoaded]);

  const resetActiveItem = (type: 'income' | 'expense' | 'billing') => {
    const today = new Date().toISOString().split('T')[0];
    if (type === 'billing') {
      if (billingDocType === 'estimate') {
        setActiveItem({
          client: '', amount: 0, category: CATS_BILLING[0], description: '', date: today, validUntil: today, status: 'draft',
          items: [{ id: generateId('est_item'), description: '', quantity: 1, rate: 0 }],
          subtotal: 0, discount: 0, taxRate: 0, shipping: 0,
          notes: settings.defaultInvoiceNotes || '', terms: settings.defaultInvoiceTerms || ''
        });
      } else {
        setActiveItem({ 
          client: '', amount: 0, category: CATS_BILLING[0], description: '', date: today, due: today, status: 'unpaid',
          items: [{ id: generateId('item'), description: '', quantity: 1, rate: 0 }],
          subtotal: 0, discount: 0, taxRate: 0, shipping: 0,
          notes: settings.defaultInvoiceNotes || '', terms: settings.defaultInvoiceTerms || ''
        });
      }
    } else {
      setActiveItem({ type, date: today, name: '', amount: 0, category: type === 'income' ? CATS_IN[0] : CATS_OUT[0] });
    }
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    if (drawerMode === 'mileage') {
      setEditingMileageTripId(null);
      setNewTrip(createEmptyMileageDraft());
    }
  };

  const openMileageAddDrawer = () => {
    setEditingMileageTripId(null);
    setNewTrip(createEmptyMileageDraft());
    setDrawerMode('mileage');
    setIsDrawerOpen(true);
  };

  const openMileageEditDrawer = (trip: MileageTrip) => {
    setEditingMileageTripId(trip.id);
    setNewTrip({
      date: trip.date,
      miles: String(trip.miles ?? ''),
      purpose: trip.purpose || '',
      client: trip.client || '',
      notes: trip.notes || '',
    });
    setDrawerMode('mileage');
    setIsDrawerOpen(true);
  };

  const handleOpenFAB = (
    type: 'income' | 'expense' | 'billing' = 'income',
    billingType?: 'invoice' | 'estimate'
  ) => {
    setDrawerMode('add');
    setActiveTab(type);

    // When creating a billing document, make sure the drawer opens in the
    // correct mode (Invoice vs Estimate).
    if (type === 'billing' && billingType) {
      setBillingDocType(billingType);
    }

    resetActiveItem(type);
    setCategorySearch('');
    setIsDrawerOpen(true);
  };

  const getHeaderFabType = (): 'income' | 'expense' | 'billing' => {
    if (currentPage === Page.Income) return 'income';
    if (currentPage === Page.Expenses) return 'expense';
    if (currentPage === Page.Invoices) return 'billing';
    if (currentPage === Page.AllTransactions || currentPage === Page.Ledger) {
      if (ledgerFilter === 'income') return 'income';
      if (ledgerFilter === 'invoice') return 'billing';
      if (ledgerFilter === 'expense') return 'expense';
      return 'income'; // 'all'
    }
    return 'expense';
  };

  const handleOpenQuickAdd = () => {
    setShowQuickAddMenu(true);
  };

  const handleLedgerAddAction = () => {
    // Ledger is a mixed workspace, so the add button should never guess between
    // invoice vs estimate based on prior billing-page state. Always show the same
    // quick-add chooser used on Home.
    handleOpenQuickAdd();
  };

  const handleContextualHeaderAdd = () => {
    if (currentPage === Page.AllTransactions || currentPage === Page.Ledger) {
      handleLedgerAddAction();
      return;
    }

    if (currentPage === Page.Mileage) {
      openMileageAddDrawer();
      return;
    }

    const fabType = getHeaderFabType();
    handleOpenFAB(fabType, fabType === 'billing' ? 'invoice' : undefined);
  };

  const handleQuickAddSelection = (action: 'income' | 'expense' | 'invoice' | 'estimate' | 'mileage' | 'client') => {
    setShowQuickAddMenu(false);

    if (action === 'income') {
      handleOpenFAB('income');
      return;
    }

    if (action === 'expense') {
      handleOpenFAB('expense');
      return;
    }

    if (action === 'invoice') {
      setBillingDocType('invoice');
      setCurrentPage(Page.Invoices);
      handleOpenFAB('billing', 'invoice');
      return;
    }

    if (action === 'estimate') {
      setBillingDocType('estimate');
      setCurrentPage(Page.Invoices);
      handleOpenFAB('billing', 'estimate');
      return;
    }

    if (action === 'mileage') {
      openMileageAddDrawer();
      return;
    }

    setEditingClient({ status: 'lead' });
    setIsClientModalOpen(true);
  };
  
  const handleEditItem = (item: any) => {
      setCategorySearch('');
      
      // Determine if the item is an invoice or a transaction.
      // It handles both "Ledger" items (which have a .original property) and raw items (from Recent Activity).
      const rawData = item.original || item;
      
      // Check for billing doc types (invoice vs estimate)
      const isEstimate = item.dataType === 'estimate' || rawData.validUntil !== undefined;
      const isInvoice = item.dataType === 'invoice' || rawData.due !== undefined;

      if (isInvoice || isEstimate) {
          setBillingDocType(isEstimate ? 'estimate' : 'invoice');
          setActiveItem(rawData); 
          setActiveTab('billing'); 
          setDrawerMode('edit_inv');
      } else {
          setActiveItem(rawData); 
          // Correctly set tab based on the transaction type (income vs expense)
          const txType = rawData.type || 'income';
          setActiveTab(txType === 'income' ? 'income' : 'expense'); 
          setDrawerMode('edit_tx');
      }
      setIsDrawerOpen(true);
  };

  const handleOpenTaxDrawer = () => {
    setDrawerMode('tax_payments'); setActiveTaxPayment({ type: 'Estimated', date: new Date().toISOString().split('T')[0], amount: 0, note: '' }); setIsDrawerOpen(true);
  };

  const saveTaxPayment = () => {
    if (!activeTaxPayment.amount || Number(activeTaxPayment.amount) <= 0) return showToast("Please enter a valid amount", "error");
    setTaxPayments(prev => [{ id: generateId('tax'), date: activeTaxPayment.date!, amount: Number(activeTaxPayment.amount), type: activeTaxPayment.type || 'Estimated', note: activeTaxPayment.note }, ...prev]);
    showToast("Tax payment recorded", "success"); setActiveTaxPayment(prev => ({ ...prev, amount: 0, note: '' }));
  };

  const deleteTaxPayment = (id: string) => {
    if(confirm("Delete this tax payment?")) { setTaxPayments(prev => prev.filter(p => p.id !== id)); showToast("Payment deleted", "info"); }
  };

  const handleSeedDemoData = async () => {
    const demo = getFreshDemoData();
    setIsDemoData(true);
    // --- Demo Clients + Estimates (V7) ---
    const toISO = (d: Date) => d.toISOString().split('T')[0];
    const today = new Date();
    const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);
    const daysFromNow = (n: number) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

    const demoClients: Client[] = [
      {
        id: 'cli_demo_1',
        name: 'Kenny Barria',
        company: 'KB Landscaping',
        email: 'kenny@kblandscaping.com',
        phone: '(305) 555-0198',
        address: '12 Palm St, Miami, FL 33101',
        status: 'lead',
        createdAt: toISO(daysAgo(45)),
        updatedAt: toISO(daysAgo(2)),
      },
      {
        id: 'cli_demo_2',
        name: 'Sophia Stanley',
        company: 'Stanley Studio',
        email: 'sophia@stanleystudio.co',
        phone: '(512) 555-0234',
        address: '88 Market Ave, Suite 200, Austin, TX 78701',
        status: 'lead',
        createdAt: toISO(daysAgo(30)),
        updatedAt: toISO(daysAgo(3)),
      },
      {
        id: 'cli_demo_3',
        name: 'Jimmy Wilson',
        company: 'Wilson Renovations',
        email: 'jimmy@wilsonreno.com',
        phone: '(619) 555-0142',
        address: '5 Harbor Rd, San Diego, CA 92101',
        status: 'client',
        createdAt: toISO(daysAgo(120)),
        updatedAt: toISO(daysAgo(1)),
      },
      {
        id: 'cli_demo_4',
        name: 'Rich Richards',
        company: 'Richards Consulting',
        email: 'rich@richardsconsulting.com',
        phone: '(212) 555-0187',
        address: '101 King St, Floor 15, New York, NY 10005',
        status: 'inactive',
        createdAt: toISO(daysAgo(300)),
        updatedAt: toISO(daysAgo(45)),
      },
      {
        id: 'cli_demo_5',
        name: 'Maria Chen',
        company: 'Chen Tech Solutions',
        email: 'maria@chentech.io',
        phone: '(415) 555-0321',
        address: '500 Tech Blvd, San Francisco, CA 94107',
        status: 'lead',
        createdAt: toISO(daysAgo(5)),
        updatedAt: toISO(daysAgo(1)),
        notes: 'Referred by Jimmy Wilson. Interested in e-commerce site.',
      },
    ];

    const demoEstimates: Estimate[] = [
      {
        id: 'est_demo_1',
        number: 'EST-2501-0001',
        clientId: 'cli_demo_3',
        client: 'Jimmy Wilson',
        clientCompany: 'Wilson Renovations',
        clientEmail: 'jimmy@wilsonreno.com',
        clientPhone: '(619) 555-0142',
        clientAddress: '5 Harbor Rd, San Diego, CA 92101',
        projectTitle: 'Master Bathroom Complete Renovation',
        scopeOfWork: `PROJECT OVERVIEW
Full renovation of the master bathroom (approx. 85 sq ft) including all fixtures, plumbing, and finishes.

DEMOLITION & PREP
• Remove and dispose of existing vanity, toilet, and all fixtures
• Disconnect and cap existing plumbing lines
• Protect adjacent flooring and walls during work

PLUMBING WORK
• Install new water supply lines for vanity and toilet
• Relocate drain for new vanity position
• Install new shut-off valves and pressure test

FIXTURE INSTALLATION
• 36" floating vanity with undermount sink
• Kohler Highline comfort height toilet
• Single-handle widespread faucet in brushed nickel

FINISHING
• Caulk all fixtures with mildew-resistant silicone
• Install new toilet paper holder and towel bar
• Final walkthrough and 1-year workmanship warranty`,
        timeline: '5-7 business days',
        exclusions: `• Tile work / flooring
• Electrical modifications
• Drywall repair beyond fixture areas
• Permit fees
• Painting or wall finishing`,
        acceptanceTerms: 'Reply "APPROVED" to this email or sign and return.',
        category: 'Service',
        description: 'Bathroom repair + fixture replacement',
        date: toISO(daysAgo(12)),
        validUntil: toISO(daysFromNow(2)),
        status: 'accepted',
        sentAt: toISO(daysAgo(10)),
        followUpDate: toISO(daysAgo(3)),
        followUpCount: 1,
        lastFollowUp: toISO(daysAgo(5)),
        items: [
          { id: 'e1_i1', description: 'Labor - Demolition (4 hrs @ $95/hr)', quantity: 4, rate: 95 },
          { id: 'e1_i2', description: 'Labor - Plumbing rough-in (6 hrs)', quantity: 6, rate: 95 },
          { id: 'e1_i3', description: 'Labor - Fixture installation (4 hrs)', quantity: 4, rate: 95 },
          { id: 'e1_i4', description: '36" Floating Vanity w/ Undermount Sink', quantity: 1, rate: 680 },
          { id: 'e1_i5', description: 'Kohler Highline Comfort Height Toilet', quantity: 1, rate: 320 },
          { id: 'e1_i6', description: 'Widespread Faucet (Brushed Nickel)', quantity: 1, rate: 185 },
          { id: 'e1_i7', description: 'Supply lines, valves, hardware kit', quantity: 1, rate: 95 },
        ],
        subtotal: 2610,
        discount: 150,
        taxRate: 8,
        shipping: 0,
        amount: Math.round((2460 + 2460 * 0.08) * 100) / 100,
        notes: 'Thank you for choosing Wilson Renovations! All materials include manufacturer warranty.',
        terms: `PAYMENT: 50% deposit to schedule, 50% upon completion.
CHANGES: Work outside scope quoted separately.`,
        poNumber: 'WR-2025-1027',
      },
      {
        id: 'est_demo_2',
        number: 'EST-2501-0002',
        clientId: 'cli_demo_1',
        client: 'Kenny Barria',
        clientCompany: 'KB Landscaping',
        clientEmail: 'kenny@kblandscaping.com',
        clientPhone: '(305) 555-0198',
        clientAddress: '12 Palm St, Miami, FL 33101',
        projectTitle: 'Premium Monthly Lawn Care Package',
        scopeOfWork: `WEEKLY SERVICES (Every Thursday)
• Complete lawn mowing with professional equipment
• Precise edging along walkways and driveways
• String trimming around trees and fences
• Blowing of all clippings from hard surfaces

MONTHLY SERVICES
• Hedge and shrub trimming (up to 6ft)
• Bed edging and definition
• Weed control treatment

INCLUDED WITH EVERY VISIT
• Green waste removal and disposal
• Visual inspection for pest/disease
• Photo documentation via app`,
        timeline: 'Ongoing service - Monthly billing',
        exclusions: `• Tree trimming above 6ft
• Major landscaping changes
• Pest control treatments
• Fertilization (add-on available)
• Irrigation repairs`,
        acceptanceTerms: 'Sign below to begin service within 5 business days.',
        category: 'Service',
        description: 'Monthly lawn maintenance (4 visits)',
        date: toISO(daysAgo(8)),
        validUntil: toISO(daysFromNow(6)),
        status: 'sent',
        sentAt: toISO(daysAgo(7)),
        followUpDate: toISO(daysAgo(0)),
        followUpCount: 0,
        items: [
          { id: 'e2_i1', description: 'Weekly mowing, edging & blowing (4 visits)', quantity: 4, rate: 85 },
          { id: 'e2_i2', description: 'Monthly hedge & shrub trimming', quantity: 1, rate: 120 },
          { id: 'e2_i3', description: 'Weed control treatment', quantity: 1, rate: 65 },
          { id: 'e2_i4', description: 'Irrigation inspection', quantity: 1, rate: 45 },
        ],
        subtotal: 570,
        discount: 70,
        taxRate: 0,
        shipping: 0,
        amount: 500,
        notes: 'FIRST MONTH BONUS: Complimentary irrigation audit ($75 value). Service day: Thursdays.',
        terms: `BILLING: Monthly on the 1st, due within 7 days.
CANCEL: Anytime with 7 days notice.`,
      },
      {
        id: 'est_demo_3',
        number: 'EST-2501-0003',
        clientId: 'cli_demo_2',
        client: 'Sophia Stanley',
        clientCompany: 'Stanley Studio',
        clientEmail: 'sophia@stanleystudio.co',
        clientPhone: '(512) 555-0234',
        clientAddress: '88 Market Ave, Suite 200\nAustin, TX 78701',
        projectTitle: 'Complete Brand Identity System',
        scopeOfWork: `PHASE 1: DISCOVERY (Week 1)
• 90-minute brand discovery session
• Competitor analysis (5 competitors)
• Target audience and persona development
• Creative brief documentation

PHASE 2: VISUAL DIRECTION (Week 1-2)
• 2 distinct moodboards
• Feedback session and direction selection

PHASE 3: LOGO DESIGN (Week 2-3)
• 3 unique logo concepts
• 2 rounds of revisions
• Final logo in all variations

PHASE 4: BRAND SYSTEM (Week 3)
• Color palette with hex/RGB/CMYK
• Typography system (2 fonts)
• Brand guidelines PDF (20+ pages)
• All final files (AI, EPS, SVG, PNG)`,
        timeline: '3 weeks from deposit to delivery',
        exclusions: `• Website design
• Business cards / stationery
• Social media templates
• Photography / video
• Copywriting`,
        acceptanceTerms: 'Reply "APPROVED" then pay 50% deposit to begin.',
        category: 'Design',
        description: 'Brand kit design (logo, colors, typography)',
        date: toISO(daysAgo(3)),
        validUntil: toISO(daysFromNow(11)),
        status: 'draft',
        items: [
          { id: 'e3_i1', description: 'Brand Discovery & Strategy', quantity: 1, rate: 450 },
          { id: 'e3_i2', description: 'Visual Direction & Moodboards', quantity: 1, rate: 350 },
          { id: 'e3_i3', description: 'Logo Design (3 concepts)', quantity: 1, rate: 1200 },
          { id: 'e3_i4', description: 'Revision Rounds (2 included)', quantity: 2, rate: 150 },
          { id: 'e3_i5', description: 'Brand System & Guidelines', quantity: 1, rate: 600 },
        ],
        subtotal: 2900,
        discount: 0,
        taxRate: 0,
        shipping: 0,
        amount: 2900,
        notes: 'Excited to work on Stanley Studio\'s brand! Jimmy Wilson referral discount applied.',
        terms: `PAYMENT: 50% deposit, 50% before delivery.
REVISIONS: 2 rounds included, additional at $75/hr.`,
      },
      {
        id: 'est_demo_4',
        number: 'EST-2501-0004',
        clientId: 'cli_demo_4',
        client: 'Rich Richards',
        clientCompany: 'Richards Consulting',
        clientEmail: 'rich@richardsconsulting.com',
        clientPhone: '(212) 555-0187',
        clientAddress: '101 King St, Floor 15\nNew York, NY 10005',
        projectTitle: 'Executive Leadership Strategy Workshop',
        scopeOfWork: `PRE-WORKSHOP (2 weeks before)
• Stakeholder interviews (3 x 45-min)
• Review strategic documents
• Custom workshop materials
• Pre-workshop survey

WORKSHOP DAY (8 hours)
Morning: Vision & SWOT analysis
Afternoon: Competitive positioning & 90-day planning

DELIVERABLES (Within 2 weeks)
• Executive Summary Report (10-15 pages)
• Strategic Roadmap (1-page visual)
• Prioritized initiatives with metrics
• 60-minute follow-up call`,
        timeline: '1-day workshop + 2 weeks deliverables',
        exclusions: `• Implementation consulting
• Ongoing advisory
• Travel outside NYC metro
• Catering / venue`,
        acceptanceTerms: 'Confirm date and pay deposit to book.',
        category: 'Consulting',
        description: 'Quarterly strategy workshop (1 day)',
        date: toISO(daysAgo(45)),
        validUntil: toISO(daysAgo(15)),
        status: 'declined',
        sentAt: toISO(daysAgo(44)),
        followUpDate: toISO(daysAgo(37)),
        followUpCount: 2,
        lastFollowUp: toISO(daysAgo(30)),
        items: [
          { id: 'e4_i1', description: 'Stakeholder Interviews (3)', quantity: 3, rate: 350 },
          { id: 'e4_i2', description: 'Workshop Prep & Materials', quantity: 1, rate: 800 },
          { id: 'e4_i3', description: 'Full-Day Facilitation (8 hrs)', quantity: 8, rate: 400 },
          { id: 'e4_i4', description: 'Report & Roadmap', quantity: 1, rate: 1500 },
          { id: 'e4_i5', description: 'Follow-Up Session', quantity: 1, rate: 450 },
        ],
        subtotal: 7000,
        discount: 500,
        taxRate: 0,
        shipping: 0,
        amount: 6500,
        notes: 'Client declined - budget reallocated. Will follow up Q2.',
        terms: `PAYMENT: 40% deposit, 60% before workshop.
CANCEL: 14+ days = full refund minus $500.`,
      },
      {
        id: 'est_demo_5',
        number: 'EST-2501-0005',
        clientId: 'cli_demo_5',
        client: 'Maria Chen',
        clientCompany: 'Chen Tech Solutions',
        clientEmail: 'maria@chentech.io',
        clientPhone: '(415) 555-0321',
        clientAddress: '500 Tech Blvd\nSan Francisco, CA 94107',
        projectTitle: 'Custom E-Commerce Platform',
        scopeOfWork: `PHASE 1: DISCOVERY (Week 1-2)
• Requirements gathering & kickoff
• User journey mapping
• Technical architecture planning

PHASE 2: DESIGN (Week 3-5)
• Mobile-first wireframes
• High-fidelity mockups (Figma)
• Interactive prototype
• 2 rounds of revisions

PHASE 3: DEVELOPMENT (Week 6-10)
• Custom Shopify Plus theme
• Product catalog (100 SKUs)
• Payment integration (Stripe + PayPal)
• Shipping calculator
• Analytics setup (GA4 + Meta)

PHASE 4: LAUNCH (Week 11-12)
• QA testing (cross-browser + mobile)
• Performance optimization
• Admin training (2 hrs, recorded)
• 30-day post-launch support`,
        timeline: '10-12 weeks from kickoff',
        exclusions: `• Product photography
• Copywriting
• Custom app development
• Ongoing maintenance (after 30 days)
• Marketing / ads setup`,
        acceptanceTerms: 'Sign contract and pay 30% deposit to begin.',
        category: 'Development',
        description: 'E-commerce website (Shopify Plus)',
        date: toISO(daysAgo(2)),
        validUntil: toISO(daysFromNow(12)),
        status: 'sent',
        sentAt: toISO(daysAgo(1)),
        followUpDate: toISO(daysFromNow(6)),
        followUpCount: 0,
        items: [
          { id: 'e5_i1', description: 'Discovery & Planning', quantity: 1, rate: 2000 },
          { id: 'e5_i2', description: 'UI/UX Design', quantity: 1, rate: 4500 },
          { id: 'e5_i3', description: 'Shopify Development', quantity: 1, rate: 6500 },
          { id: 'e5_i4', description: 'Integrations (Payment, Shipping, Analytics)', quantity: 1, rate: 2500 },
          { id: 'e5_i5', description: 'QA & Performance', quantity: 1, rate: 1500 },
          { id: 'e5_i6', description: 'Launch, Training & Support', quantity: 1, rate: 2000 },
        ],
        subtotal: 19000,
        discount: 1500,
        taxRate: 8.625,
        shipping: 0,
        amount: Math.round((17500 + 17500 * 0.08625) * 100) / 100,
        notes: 'Jimmy Wilson referral - $1,500 discount applied. Excited to build this!',
        terms: `PAYMENT: 30% start, 40% at design approval, 30% before launch.
TIMELINE: Assumes 48-72hr feedback turnaround.`,
      },
    ];

    // Keep original demo data, but add our V7 demo entities
    
    // --- Demo receipts + mileage + audit readiness examples ---
    const currentYear = new Date().getFullYear();
    const taxYearStr = String(currentYear);
    const DEMO_RECEIPT_THRESHOLD = 100;

    // Copy demo transactions so we can safely modify them.
    const baseTx = ([...demo.transactions] as any[]).map(t => ({ ...t }));

    // We seed 5 realistic receipt images and link them to 5 matching expenses (same date + same name),
    // so new users can instantly understand "receipt ↔ expense" without confusion.
    const currentYearExpenses = baseTx.filter(
      (t: any) => t.type === "expense" && String(t.date || "").startsWith(taxYearStr)
    );

    const receiptTargets = currentYearExpenses.slice(0, 5);

    // Create 5 demo receipts (stored in IndexedDB so preview/download works).
    // The receipt metadata (date + note) is aligned to the linked expense.
    const demoReceipts: ReceiptType[] = DEMO_RECEIPT_ASSETS.slice(0, 5).map((asset, i) => {
      const tx = receiptTargets[i];
      // Force a clean, easy-to-follow date spread in demo mode.
      const forcedDate = toISO(daysAgo(9 + i * 4));
      if (tx) {
        tx.date = forcedDate;
        tx.name = asset.note;
        // Map the receipt type to an intuitive tax category
        if (asset.note.toLowerCase().includes("fuel") || asset.note.toLowerCase().includes("shell")) tx.category = "Travel";
        else if (asset.note.toLowerCase().includes("meal") || asset.note.toLowerCase().includes("restaurant")) tx.category = "Meals (Business)";
        else if (asset.note.toLowerCase().includes("advert")) tx.category = "Advertising / Marketing";
        else if (asset.note.toLowerCase().includes("materials") || asset.note.toLowerCase().includes("hardware")) tx.category = "Equipment";
        else tx.category = "Office Supplies";

        tx.receiptId = asset.id;

        // Ensure these linked examples clearly meet the "receipt required" threshold
        if (Number(tx.amount || 0) < DEMO_RECEIPT_THRESHOLD) {
          tx.amount = DEMO_RECEIPT_THRESHOLD + (i * 17) + 12;
        }
      }

      return {
        id: asset.id,
        date: tx?.date || forcedDate,
        imageKey: asset.id,
        mimeType: asset.mimeType,
        note: asset.note,
      };
    });

    // Any other current-year expenses should NOT have a receipt linked by default in demo mode.
    // Also keep them under the receipt threshold to avoid creating extra "missing receipts" beyond our controlled example count.
    currentYearExpenses.forEach((t: any) => {
      const isTarget = receiptTargets.some(x => x?.id === t.id);
      if (!isTarget) {
        delete t.receiptId;
        if (Number(t.amount || 0) >= DEMO_RECEIPT_THRESHOLD) {
          t.amount = 45 + (Math.abs(String(t.id).split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 35);
        }
      }
    });

    // Ensure receipts are available in the dropdown + Home thumbnails.
    setReceipts(demoReceipts);

    // Save demo receipt blobs into the receipt DB so thumbnails/preview/download work.
    try {
      for (const asset of DEMO_RECEIPT_ASSETS.slice(0, 5)) {
        const { blob, mimeType } = await fetchDemoReceiptBlob(asset);
        await putReceiptBlob(asset.id, blob, mimeType || asset.mimeType);
      }
    } catch (e) {
      console.warn("Failed to seed demo receipt blobs", e);
    }

    // Add 38 missing-receipt examples in the current tax year (so users see "Missing receipts: 38" in Tax Prep).
    const missingCount = 38;
    const missingReceiptTx: any[] = Array.from({ length: missingCount }).map((_, i) => {
      const day = (i % 28) + 1;
      const date = `${taxYearStr}-01-${String(day).padStart(2, "0")}`;
      const cat = i % 3 === 0 ? "Travel" : i % 3 === 1 ? "Meals (Business)" : "Office Supplies";
      return {
        id: `tx_demo_missing_rcpt_${i + 1}`,
        name: `Demo expense (receipt missing) #${i + 1}`,
        amount: DEMO_RECEIPT_THRESHOLD + (i % 9) * 13,
        category: cat,
        date,
        type: "expense" as const,
        notes: "Demo: receipt not linked yet",
      };
    });

    // Seed mileage trips so new users can try Mileage + exports immediately.
const demoMileageTrips: MileageTrip[] = [
      { id: "mi_demo_1", date: `${taxYearStr}-01-06`, miles: 12.4, purpose: "Client meeting", client: "Chen Tech Solutions", notes: "Downtown consult" },
      { id: "mi_demo_2", date: `${taxYearStr}-01-12`, miles: 28.1, purpose: "Equipment pickup", client: "", notes: "Office supplies run" },
      { id: "mi_demo_3", date: `${taxYearStr}-01-18`, miles: 7.6, purpose: "Bank / post office", client: "", notes: "" },
      { id: "mi_demo_4", date: `${taxYearStr}-01-23`, miles: 41.3, purpose: "Client site visit", client: "Wilson Renovations", notes: "Scope walk-through" },
      { id: "mi_demo_5", date: `${taxYearStr}-02-03`, miles: 16.2, purpose: "Networking event", client: "", notes: "" },
      { id: "mi_demo_6", date: `${taxYearStr}-02-10`, miles: 33.8, purpose: "Vendor meeting", client: "", notes: "Printer / signage" },
      { id: "mi_demo_7", date: `${taxYearStr}-02-15`, miles: 9.9, purpose: "Client follow-up", client: "Blue Harbor Realty", notes: "" },
      { id: "mi_demo_8", date: `${taxYearStr}-02-19`, miles: 22.0, purpose: "Business errands", client: "", notes: "" },
    ];
    setMileageTrips(demoMileageTrips);

        setTransactions([...(baseTx as Transaction[]), ...(missingReceiptTx as Transaction[])]);


    // Fix demo invoices so line-item rates look realistic (avoid single huge rate == total).
    const demoInvoicesFixed = (demo.invoices || []).map((inv: any) => {
      const baseTotalRaw = (inv.subtotal ?? inv.amount ?? inv.total ?? 0);
      const baseTotal = Number(baseTotalRaw);
      const items = Array.isArray(inv.items) ? inv.items : [];
      const hasSingleItem = items.length === 1;
      const single = hasSingleItem ? items[0] : null;
      const singleRate = single ? Number(single.rate || 0) : 0;
      const looksUnrealistic = hasSingleItem && (singleRate >= 1000 || Math.abs(singleRate - baseTotal) < 0.01);

      if (!Number.isFinite(baseTotal) || baseTotal <= 0 || !looksUnrealistic) return inv;

      // Build a more realistic mix of service hours + admin + misc.
      const serviceRate = 175;
      const adminRate = 125;

      let serviceHours = Math.max(2, Math.round((baseTotal * 0.65) / serviceRate));
      let adminHours = Math.max(1, Math.round((baseTotal * 0.20) / adminRate));
      let used = serviceHours * serviceRate + adminHours * adminRate;

      let remaining = Math.max(0, +(baseTotal - used).toFixed(2));

      // If rounding made remaining negative/too small, adjust service hours down.
      while (remaining < 0 && serviceHours > 2) {
        serviceHours -= 1;
        used = serviceHours * serviceRate + adminHours * adminRate;
        remaining = +(baseTotal - used).toFixed(2);
      }

      // Spread remaining across multiple units so rate ≠ amount.
      const miscQty = remaining > 0 ? (remaining >= 500 ? 5 : remaining >= 200 ? 3 : 2) : 0;
      const miscRate = miscQty > 0 ? +(remaining / miscQty).toFixed(2) : 0;

      const newItems = [
        { id: `${inv.id}_svc`, description: 'Professional services rendered (hours)', quantity: serviceHours, rate: serviceRate },
        { id: `${inv.id}_adm`, description: 'Admin / coordination (hours)', quantity: adminHours, rate: adminRate },
        ...(miscQty > 0 ? [{ id: `${inv.id}_misc`, description: 'Materials / misc', quantity: miscQty, rate: miscRate }] : []),
      ];

      return {
        ...inv,
        items: newItems,
        subtotal: baseTotal,
        amount: inv.amount ?? baseTotal,
      };
    });

    setInvoices(demoInvoicesFixed as Invoice[]);

    setClients(demoClients);
    setEstimates(demoEstimates.map(e => {
      const t = calcDocTotals(e.items as any, e.discount || 0, e.taxRate || 0, e.shipping || 0);
      return { ...e, subtotal: t.subtotal, amount: t.total } as Estimate;
    }));
    setSettings({ ...demo.settings, requireReceiptOverThreshold: false, receiptThreshold: 0, receiptReminderEnabled: true, mileageRateCents: 72.5 });
    setTaxPayments([...(demo.taxPayments || [])] as TaxPayment[]);
    setSeedSuccess(true); showToast("Demo data loaded successfully!", "success"); setCurrentPage(Page.Dashboard); setTimeout(() => setSeedSuccess(false), 2000);
  };

  const handleClearData = () => setShowResetConfirm(true);
  
  const performReset = () => {
    // Clear legacy localStorage payload (if present)
    try { localStorage.removeItem(DB_KEY); } catch { /* ignore */ }

    // Clear IndexedDB app-state (large-capacity storage)
    clearAppState().catch((e) => console.error("Failed to clear IndexedDB app-state", e));

    // Clear receipt blobs as well to free space
    clearAllReceipts().catch((e) => console.error("Failed to clear receipt blobs", e));

    // Reset in-memory state
    setTransactions([]);
    setInvoices([]);
    setEstimates([]);
    setClients([]);
    setTaxPayments([]);
    setReceipts([]);
    setMileageTrips([]);
    setSavedTemplates([]);
    setDuplicationHistory({});
    setCustomCategories({ income: [], expense: [], billing: [] });

    setSettings({
      businessName: "My Business",
      ownerName: "Owner",
      payPrefs: DEFAULT_PAY_PREFS,
      taxRate: 22,
      stateTaxRate: 0,
      taxEstimationMethod: 'custom',
      filingStatus: 'single',
      currencySymbol: '$',
      showLogoOnInvoice: true,
      logoAlignment: 'left',
      brandColor: '#2563eb',
      requireReceiptOverThreshold: false,
      receiptThreshold: 0,
      receiptReminderEnabled: true,
      mileageRateCents: 72.5,
    });

    setSeedSuccess(false);
    setShowResetConfirm(false);
    showToast("All data has been wiped.", "success");
    setCurrentPage(Page.Dashboard);
  };

  const handleCheckForAppUpdate = async () => {
    try {
      if (!("serviceWorker" in navigator)) {
        showToast("App update check is not available in this browser.", "error");
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        showToast("No installed app service worker was found yet. Open the app once from the browser, then try again.", "error");
        return;
      }

      await registration.update();
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      showToast("Update check complete. Use Reload App if the screen still shows the old build.", "success");
    } catch (error) {
      console.error("Update check failed", error);
      showToast("Update check failed. Try reloading from Chrome.", "error");
    }
  };

  const handleReloadApp = () => {
    window.location.reload();
  };

  const handleResetDemoDataOnly = async () => {
    await handleSeedDemoData();
    showToast("Demo data reset for this MONIEZI Pro Finance build.", "success");
  };

  const confirmDeleteInvoice = () => {
    if (!invoiceToDelete) return;
    const inv = invoices.find(i => i.id === invoiceToDelete);
    setInvoices(prev => prev.filter(i => i.id !== invoiceToDelete));
    if (inv && inv.linkedTransactionId) {
        setTransactions(prev => prev.filter(t => t.id !== inv.linkedTransactionId));
    }
    setInvoiceToDelete(null);
    setIsDrawerOpen(false);
    showToast("Invoice deleted", "info");
  };

  const saveTransaction = (data: Partial<Transaction>) => {
    if (!data.name?.trim()) return showToast("Please enter a description", "error");
    if (!data.amount || Number(data.amount) <= 0) return showToast("Please enter a valid amount", "error");
    const isExpense = ((data.type as any) || activeTab) === 'expense';
    const shouldRemindReceipt = settings.receiptReminderEnabled ?? true;
    const newTx: Transaction = { id: generateId('tx'), name: data.name, amount: Number(data.amount), category: data.category || "General", date: data.date || new Date().toISOString().split('T')[0], type: (data.type as any) || 'income', notes: data.notes, receiptId: data.receiptId, reviewedAt: (data as any).reviewedAt };
    if (drawerMode === 'edit_tx' && activeItem.id) {
      setTransactions(prev => prev.map(t => t.id === activeItem.id ? { ...t, ...newTx, id: t.id } as Transaction : t));
      showToast("Transaction updated", "success");
    } else {
      setTransactions(prev => [newTx, ...prev]);
      showToast("Transaction saved", "success");
    }
    if (isExpense && shouldRemindReceipt && !data.receiptId) {
      showToast('Tip: attach a receipt if you have one. You can add it later.', 'info');
    }
    setIsDrawerOpen(false);
  };

  // --- Mileage Trips ---
  const saveMileageTripFromDrawer = () => {
    const draft = { ...newTrip, miles: normalizeMileageDraftMiles(newTrip.miles) };
    const miles = Number(draft.miles);

    if (!draft.date) return showToast('Please select a date', 'error');
    if (!draft.purpose.trim()) return showToast('Please enter a purpose', 'error');
    if (!Number.isFinite(miles) || miles <= 0) return showToast('Please enter valid miles', 'error');

    const payload = toMileageTripPayload({
      ...draft,
      purpose: draft.purpose.trim(),
      client: draft.client.trim(),
      notes: draft.notes.trim(),
    });
    const normalizedPayload: Omit<MileageTrip, 'id'> = {
      ...payload,
      miles,
      client: payload.client?.trim() || undefined,
      notes: payload.notes?.trim() || undefined,
    };

    if (editingMileageTripId) {
      setMileageTrips(prev => prev.map(t => t.id === editingMileageTripId ? ({ ...t, ...normalizedPayload } as MileageTrip) : t));
      showToast('Mileage trip updated', 'success');
    } else {
      const newTripEntry: MileageTrip = { id: generateId('mi'), ...normalizedPayload };
      setMileageTrips(prev => [newTripEntry, ...prev]);
      showToast('Mileage trip saved', 'success');
    }

    setNewTrip(createEmptyMileageDraft());
    setEditingMileageTripId(null);
    setIsDrawerOpen(false);
  };

  const deleteActiveMileageTrip = () => {
    if (!editingMileageTripId) return;
    if (!confirm('Delete this mileage trip?')) return;
    setMileageTrips(prev => prev.filter(t => t.id !== editingMileageTripId));
    setNewTrip(createEmptyMileageDraft());
    setEditingMileageTripId(null);
    setIsDrawerOpen(false);
    showToast('Mileage trip deleted', 'info');
  };

  const toggleTransactionReviewed = (id: string) => {
    let becameReviewed = false;
    setTransactions(prev => prev.map(t => {
      if (t.id !== id) return t;
      becameReviewed = !(t as any).reviewedAt;
      return { ...t, reviewedAt: (t as any).reviewedAt ? undefined : new Date().toISOString() } as Transaction;
    }));
    showToast(becameReviewed ? 'Marked as reviewed' : 'Marked as new', 'success');
  };

  const duplicateTransaction = (original: Transaction) => {
    const duplicated = {
      ...original,
      id: undefined, // Will be generated on save
      date: new Date().toISOString().split('T')[0], // Set to today
      receiptId: undefined, // Don't copy receipt
      notes: original.notes || '' // Keep notes but don't add "duplicated" marker
    };
    
    setActiveItem(duplicated);
    setActiveTab(original.type); // Set correct tab (income/expense)
    setDrawerMode('add'); // Open in add mode
    setIsDrawerOpen(true);
    showToast("Transaction duplicated - review and save", "success");
    
    // Track duplication for smart suggestions
    const trackingKey = `${original.name}_${original.category}_${original.type}`;
    const currentCount = duplicationCount[trackingKey] || 0;
    const newCount = currentCount + 1;
    
    setDuplicationCount(prev => ({
      ...prev,
      [trackingKey]: newCount
    }));
    
    // After 3 duplications, suggest saving as template
    if (newCount === 3) {
      setTimeout(() => {
        setTemplateSuggestionData({
          name: original.name,
          category: original.category,
          type: original.type
        });
        setShowTemplateSuggestion(true);
      }, 1000);
    }
  };

  const saveInvoice = (data: Partial<Invoice>) => {
    if (!data.client?.trim()) return showToast("Please enter a client name", "error");
    // Auto-create/update client record and tie document to clientId
    const clientId = upsertClientFromDoc(data as any, 'client');
    data = { ...data, clientId };
    let totalAmount = 0, subtotal = 0;
    if (data.items && data.items.length > 0) {
        subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        totalAmount = Math.max(0, subtotal - (data.discount || 0) + ((subtotal - (data.discount || 0)) * ((data.taxRate || 0) / 100)) + (data.shipping || 0));
    } else {
        totalAmount = Number(data.amount) || 0; subtotal = totalAmount;
    }
    if (totalAmount <= 0) return showToast("Please add items or enter a valid amount", "error");
    const description = data.description || (data.items && data.items.length > 0 ? data.items[0].description : "Services Rendered");
    
    if (drawerMode === 'edit_inv' && activeItem.id) {
      setInvoices(prev => prev.map(i => {
        if (i.id === activeItem.id) {
           const updatedInvoice = { ...i, ...data, amount: totalAmount, subtotal, description } as Invoice;
           if (updatedInvoice.status !== 'void' && updatedInvoice.linkedTransactionId) {
             setTransactions(txs => txs.map(t => t.id === updatedInvoice.linkedTransactionId ? { ...t, amount: updatedInvoice.amount, name: `Pmt: ${updatedInvoice.client}`, date: updatedInvoice.date } : t));
           }
           return updatedInvoice;
        }
        return i;
      }));
      showToast("Invoice updated", "success");
    } else {
      const invNumber = generateDocNumber('INV', invoices);
      const newInv: Invoice = {
        id: generateId('inv'), number: invNumber, clientId: data.clientId, client: data.client, clientAddress: data.clientAddress, clientEmail: data.clientEmail, clientCompany: data.clientCompany,
        amount: totalAmount, category: data.category || "Service", description, date: data.date || new Date().toISOString().split('T')[0],
        due: data.due || new Date().toISOString().split('T')[0], status: 'unpaid', notes: data.notes || settings.defaultInvoiceNotes,
        terms: data.terms || settings.defaultInvoiceTerms, payMethod: data.payMethod, recurrence: data.recurrence, items: data.items,
        subtotal, discount: data.discount, shipping: data.shipping, taxRate: data.taxRate, poNumber: data.poNumber
      };
      setInvoices(prev => [newInv, ...prev]); showToast(`Invoice ${invNumber} created`, "success");
    }
    setIsDrawerOpen(false);
  };

  // Estimates (Quotes)
  const saveEstimate = (data: Partial<Estimate>) => {
    if (!data.client?.trim()) return showToast('Please enter a client name', 'error');
    const statusHint: ClientStatus = (data.status === 'accepted') ? 'client' : 'lead';
    const clientId = upsertClientFromDoc(data as any, statusHint);
    data = { ...data, clientId };
    let totalAmount = 0;
    let subtotal = 0;
    if (data.items && data.items.length > 0) {
        const t = calcDocTotals(data.items as any, data.discount || 0, data.taxRate || 0, data.shipping || 0);
        subtotal = t.subtotal;
        totalAmount = t.total;
    } else {
        totalAmount = Number(data.amount) || 0;
        subtotal = totalAmount;
    }
    if (totalAmount <= 0) return showToast('Please add items or enter a valid amount', 'error');
    const description = data.description || (data.items && data.items.length > 0 ? data.items[0].description : 'Services / Work');

    if (drawerMode === 'edit_inv' && activeItem.id) {
      setEstimates(prev => prev.map(e => e.id === activeItem.id ? ({ ...e, ...data, amount: totalAmount, subtotal, description } as Estimate) : e));
      showToast('Estimate updated', 'success');
    } else {
      const estNumber = generateDocNumber('EST', estimates);
      const newEst: Estimate = {
        id: generateId('est'),
        number: estNumber,
        clientId: data.clientId,
        client: data.client!,
        clientCompany: data.clientCompany,
        clientAddress: data.clientAddress,
        clientEmail: data.clientEmail,
        amount: totalAmount,
        category: data.category || 'Service',
        description,
        date: data.date || new Date().toISOString().split('T')[0],
        validUntil: data.validUntil || data.date || new Date().toISOString().split('T')[0],
        status: (data.status as any) || 'draft',
        notes: data.notes || settings.defaultInvoiceNotes,
        terms: data.terms || settings.defaultInvoiceTerms,
        items: data.items,
        subtotal,
        discount: data.discount,
        shipping: data.shipping,
        taxRate: data.taxRate,
        poNumber: data.poNumber
      };
      setEstimates(prev => [newEst, ...prev]);
      showToast(`Estimate ${estNumber} created`, 'success');
    }
    setIsDrawerOpen(false);
  };

  // Quick status update for estimates with automatic client promotion and follow-up tracking
  const updateEstimateStatus = (est: Estimate, newStatus: 'draft' | 'sent' | 'accepted' | 'declined') => {
    if (!est?.id) return;
    
    const now = new Date();
    const nowISO = now.toISOString();
    
    // Calculate follow-up date (7 days from now when marking as sent)
    const followUpDate = new Date(now);
    followUpDate.setDate(followUpDate.getDate() + 7);
    const followUpDateISO = followUpDate.toISOString().split('T')[0];
    
    setEstimates(prev => prev.map(e => {
      if (e.id !== est.id) return e;
      
      const updates: Partial<Estimate> = { status: newStatus };
      
      if (newStatus === 'sent' && e.status !== 'sent') {
        // First time marking as sent - set sentAt and initial follow-up
        updates.sentAt = nowISO;
        updates.followUpDate = followUpDateISO;
        updates.followUpCount = 0;
      }
      
      return { ...e, ...updates };
    }));
    
    // Auto-promote client from "lead" to "client" when estimate is accepted
    if (newStatus === 'accepted' && est.clientId) {
      const client = clients.find(c => c.id === est.clientId);
      if (client && client.status === 'lead') {
        setClients(prev => prev.map(c => 
          c.id === est.clientId 
            ? { ...c, status: 'client', updatedAt: nowISO } 
            : c
        ));
        showToast(`🎉 ${est.client} is now a customer!`, 'success');
      } else {
        showToast(`Estimate marked as accepted`, 'success');
      }
    } else if (newStatus === 'declined') {
      showToast('Estimate marked as declined', 'info');
    } else if (newStatus === 'sent') {
      showToast(`Estimate sent! Follow-up reminder set for ${followUpDateISO}`, 'success');
    } else {
      showToast(`Estimate status updated`, 'success');
    }
  };

  // Record a follow-up on an estimate
  const recordFollowUp = (est: Estimate, nextFollowUpDays: number = 7) => {
    if (!est?.id) return;
    
    const now = new Date();
    const nextFollowUp = new Date(now);
    nextFollowUp.setDate(nextFollowUp.getDate() + nextFollowUpDays);
    
    setEstimates(prev => prev.map(e => {
      if (e.id !== est.id) return e;
      return {
        ...e,
        lastFollowUp: now.toISOString(),
        followUpDate: nextFollowUp.toISOString().split('T')[0],
        followUpCount: (e.followUpCount || 0) + 1
      };
    }));
    
    showToast(`Follow-up recorded! Next reminder: ${nextFollowUp.toLocaleDateString()}`, 'success');
  };

  // Snooze follow-up reminder
  const snoozeFollowUp = (est: Estimate, days: number) => {
    if (!est?.id) return;
    
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    
    setEstimates(prev => prev.map(e => {
      if (e.id !== est.id) return e;
      return { ...e, followUpDate: newDate.toISOString().split('T')[0] };
    }));
    
    showToast(`Follow-up snoozed for ${days} days`, 'info');
  };

  const deleteEstimate = (est: Partial<Estimate>) => {
    if (!est.id) return;
    if (confirm('Delete this estimate?')) {
      setEstimates(prev => prev.filter(e => e.id !== est.id));
      setIsDrawerOpen(false);
      showToast('Estimate deleted', 'info');
    }
  };

  const duplicateEstimate = (original: Estimate) => {
    const today = new Date().toISOString().split('T')[0];
    const daysValid = original.validUntil && original.date ? Math.max(0, Math.round((new Date(original.validUntil).getTime() - new Date(original.date).getTime()) / (1000 * 60 * 60 * 24))) : 30;
    const valid = new Date();
    valid.setDate(valid.getDate() + daysValid);

    const duplicated: Partial<Estimate> = {
      ...original,
      id: undefined,
      date: today,
      validUntil: valid.toISOString().split('T')[0],
      status: 'draft',
    };

    setBillingDocType('estimate');
    setActiveItem(duplicated);
    setActiveTab('billing');
    setDrawerMode('add');
    setIsDrawerOpen(true);
    showToast('Estimate duplicated - review and save', 'success');
  };

  // Convert Estimate -> Invoice (Wave-style)
  const convertEstimateToInvoice = (est: Estimate) => {
    if (!est?.id) return;
    if (est.status === 'void') return showToast('Cannot convert a void estimate', 'error');
    if (est.status === 'declined') {
      const ok = confirm('This estimate is Declined. Convert to an invoice anyway?');
      if (!ok) return;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Default due date: today + 14 days (if user didn't set something else later)
    const due = new Date(today);
    due.setDate(due.getDate() + 14);
    const dueStr = due.toISOString().split('T')[0];

    // Generate invoice number
    const invNumber = generateDocNumber('INV', invoices);

    // Build invoice from estimate
    const newInv: Invoice = {
      id: generateId('inv'),
      number: invNumber,
      clientId: est.clientId,
      client: est.client,
      clientCompany: est.clientCompany,
      clientAddress: est.clientAddress,
      clientEmail: est.clientEmail,
      amount: est.amount,
      category: est.category || 'Service',
      description: est.description || (est.items && est.items[0]?.description) || 'Services Rendered',
      date: todayStr,
      due: dueStr,
      status: 'unpaid',
      notes: (est.notes ? `${est.notes}\n\n` : '') + `Converted from estimate ${est.number || est.id}`,
      terms: est.terms || settings.defaultInvoiceTerms,
      items: (est.items || []).map(it => ({ ...it, id: generateId('item') })),
      subtotal: est.subtotal,
      discount: est.discount,
      shipping: est.shipping,
      taxRate: est.taxRate,
      poNumber: est.poNumber,
    };

    // 1) Add invoice
    setInvoices(prev => [newInv, ...prev]);

    // 2) Mark estimate as accepted (so it reflects a closed deal)
    setEstimates(prev => prev.map(e => e.id === est.id ? ({ ...e, status: 'accepted' } as Estimate) : e));

    // 3) Ensure client is promoted to "client" status and show celebration
    let clientPromoted = false;
    if (newInv.clientId) {
      const client = clients.find(c => c.id === newInv.clientId);
      if (client && client.status === 'lead') {
        setClients(prev => prev.map(c => 
          c.id === newInv.clientId 
            ? { ...c, status: 'client', updatedAt: new Date().toISOString() } 
            : c
        ));
        clientPromoted = true;
      }
    } else if (newInv.client?.trim()) {
      upsertClientFromDoc(newInv as any, 'client');
    }

    // 4) Jump user into the new invoice for review/edit
    setBillingDocType('invoice');
    setCurrentPage(Page.Invoices);
    setActiveTab('billing');
    setActiveItem(newInv);
    setDrawerMode('edit_inv');
    setIsDrawerOpen(true);
    
    if (clientPromoted) {
      showToast(`🎉 Deal won! ${invNumber} created & ${est.client} is now a customer!`, 'success');
    } else {
      showToast(`Invoice ${invNumber} created from estimate`, 'success');
    }
  };

  const handlePrintEstimate = (est: Partial<Estimate>) => {
    const estimateToPrint = { ...est } as Estimate;
    if (!estimateToPrint.items || estimateToPrint.items.length === 0) {
        estimateToPrint.items = [{ id: 'generated_1', description: est.description || 'Services', quantity: 1, rate: est.amount || 0 }];
        estimateToPrint.subtotal = est.amount;
    }
    setSelectedEstimateForDoc(estimateToPrint);
    setIsEstimatePdfPreviewOpen(true);
  };

  const handleDirectExportEstimatePDF = () => {
    if (!activeItem.id) return;
    const updatedEstimate = { ...activeItem } as Estimate;
    if (!updatedEstimate.items || updatedEstimate.items.length === 0) {
        updatedEstimate.items = [{ id: 'generated_1', description: updatedEstimate.description || 'Services', quantity: 1, rate: updatedEstimate.amount || 0 }];
        updatedEstimate.subtotal = updatedEstimate.amount;
    }
    setEstimates(prev => prev.map(e => e.id === updatedEstimate.id ? updatedEstimate : e));
    setSelectedEstimateForDoc(updatedEstimate);
    setIsEstimatePdfPreviewOpen(true);
  };

  const duplicateInvoice = (original: Invoice) => {
    const today = new Date().toISOString().split('T')[0];
    const paymentTermsDays = original.due && original.date ? 
      Math.round((new Date(original.due).getTime() - new Date(original.date).getTime()) / (1000 * 60 * 60 * 24)) : 30;
    
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);
    
    const duplicated = {
      ...original,
      id: undefined, // Will be generated on save
      date: today,
      due: dueDate.toISOString().split('T')[0],
      status: 'unpaid' as const, // Always unpaid
      linkedTransactionId: undefined, // Don't link to old payment
      // Keep all the important stuff: client info, items, rates, terms, notes
    };
    
    setActiveItem(duplicated);
    setActiveTab('billing');
    setDrawerMode('add');
    setIsDrawerOpen(true);
    showToast("Invoice duplicated - review and save", "success");
  };
  
  // Phase 3: Batch Duplicate Function
  const openBatchDuplicate = (original: Transaction | Invoice) => {
    setBatchDuplicateData(original);
    setShowBatchDuplicateModal(true);
  };
  
  const executeBatchDuplicate = (dates: string[]) => {
    if (!batchDuplicateData) return;
    
    const isInvoice = 'client' in batchDuplicateData;
    
    dates.forEach(date => {
      if (isInvoice) {
        const original = batchDuplicateData as Invoice;
        const paymentTermsDays = original.due && original.date ? 
          Math.round((new Date(original.due).getTime() - new Date(original.date).getTime()) / (1000 * 60 * 60 * 24)) : 30;
        
        const dueDate = new Date(date);
        dueDate.setDate(dueDate.getDate() + paymentTermsDays);
        
        const newInv: Invoice = {
          ...original,
          id: generateId('inv'),
          date,
          due: dueDate.toISOString().split('T')[0],
          status: 'unpaid',
          linkedTransactionId: undefined
        };
        setInvoices(prev => [newInv, ...prev]);
      } else {
        const original = batchDuplicateData as Transaction;
        const newTx: Transaction = {
          ...original,
          id: generateId('tx'),
          date,
          receiptId: undefined
        };
        setTransactions(prev => [newTx, ...prev]);
        
        // Track duplication history
        setDuplicationHistory(prev => ({
          ...prev,
          [newTx.id]: { originalId: original.id!, originalDate: original.date }
        }));
      }
    });
    
    showToast(`Created ${dates.length} entries`, "success");
    setShowBatchDuplicateModal(false);
    setBatchDuplicateData(null);
  };
  
  // Phase 3: Recurring Transaction Setup
  const openRecurringSetup = (original: Transaction | Invoice) => {
    setRecurringData(original);
    setShowRecurringModal(true);
  };
  
  const setupRecurringTransaction = (frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly', occurrences: number) => {
    if (!recurringData) return;
    
    const dates: string[] = [];
    const startDate = new Date();
    
    for (let i = 0; i < occurrences; i++) {
      const date = new Date(startDate);
      
      switch (frequency) {
        case 'weekly':
          date.setDate(date.getDate() + (i * 7));
          break;
        case 'biweekly':
          date.setDate(date.getDate() + (i * 14));
          break;
        case 'monthly':
          date.setMonth(date.getMonth() + i);
          break;
        case 'quarterly':
          date.setMonth(date.getMonth() + (i * 3));
          break;
      }
      
      dates.push(date.toISOString().split('T')[0]);
    }
    
    executeBatchDuplicate(dates);
    setShowRecurringModal(false);
    setRecurringData(null);
  };
  
  // Phase 3: Template Management
  const saveAsTemplate = (data: Partial<Transaction | Invoice>, type: string, name: string) => {
    const template = {
      id: generateId('template'),
      name,
      data,
      type
    };
    setSavedTemplates(prev => [...prev, template]);
    showToast("Template saved", "success");
  };
  
  const loadTemplate = (template: typeof savedTemplates[0]) => {
    setActiveItem(template.data);
    setActiveTab(template.type as any);
    setDrawerMode('add');
    setIsDrawerOpen(true);
    showToast(`Template "${template.name}" loaded`, "success");
  };
  
  const deleteTemplate = (id: string) => {
    setSavedTemplates(prev => prev.filter(t => t.id !== id));
    showToast("Template deleted", "info");
  };

  const saveNewCategory = () => {
      if (!newCategoryName || newCategoryName.length < 2) return showToast("Category name too short", "error");
      setCustomCategories(prev => {
          const list = activeTab === 'income' ? 'income' : activeTab === 'expense' ? 'expense' : 'billing';
          return { ...prev, [list]: [...(prev[list] || []), newCategoryName] };
      });
      setActiveItem(prev => ({ ...prev, category: newCategoryName })); setNewCategoryName(''); setDrawerMode(previousDrawerMode.current); showToast("Category added", "success");
  };

  const deleteTransaction = (id?: string) => {
    if (!id) return;
    if(confirm("Delete this transaction?")) { setTransactions(prev => prev.filter(t => t.id !== id)); setIsDrawerOpen(false); showToast("Transaction deleted", "info"); }
  };

  const deleteInvoice = (inv: Partial<Invoice>) => {
    if (!inv.id) return;
    if(confirm("Delete this invoice?")) {
        setInvoices(prev => prev.filter(i => i.id !== inv.id));
        if (inv.linkedTransactionId) setTransactions(prev => prev.filter(t => t.id !== inv.linkedTransactionId));
        setIsDrawerOpen(false); showToast("Invoice deleted", "info");
    }
  };

  const toggleInvoicePaidStatus = (inv: Partial<Invoice>) => {
    if (!inv.id || inv.status === 'void') return;
    if (inv.status === 'paid') {
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'unpaid', linkedTransactionId: undefined } : i));
      if (inv.linkedTransactionId) setTransactions(prev => prev.filter(t => t.id !== inv.linkedTransactionId));
      setActiveItem(prev => ({ ...prev, status: 'unpaid' })); showToast("Invoice marked as Unpaid", "info");
    } else {
      const txId = generateId('tx_pay');
      const newTx: Transaction = { id: txId, name: `Pmt: ${inv.client}`, amount: inv.amount || 0, category: inv.category || 'Sales / Services', date: new Date().toISOString().split('T')[0], type: 'income', notes: `Linked to invoice #${inv.id.substring(0,6)}` };
      setTransactions(prev => [newTx, ...prev]);
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid', linkedTransactionId: txId } : i));
      setActiveItem(prev => ({ ...prev, status: 'paid' })); showToast("Invoice marked as Paid", "success");
    }
  };

  const markInvoicePaid = (inv: Invoice) => toggleInvoicePaidStatus(inv);

  const handlePrintInvoice = (inv: Partial<Invoice>) => {
    const invoiceToPrint = { ...inv } as Invoice;
    if (!invoiceToPrint.items || invoiceToPrint.items.length === 0) {
        invoiceToPrint.items = [{ id: 'generated_1', description: inv.description || "Services", quantity: 1, rate: inv.amount || 0 }];
        invoiceToPrint.subtotal = inv.amount;
    }
    setSelectedInvoiceForDoc(invoiceToPrint); setIsPdfPreviewOpen(true);
  };

  const handleDirectExportPDF = () => {
     if (!activeItem.id) return;
     const updatedInvoice = { ...activeItem } as Invoice;
     if (!updatedInvoice.items || updatedInvoice.items.length === 0) {
        updatedInvoice.items = [{ id: 'generated_1', description: updatedInvoice.description || "Services", quantity: 1, rate: updatedInvoice.amount || 0 }];
        updatedInvoice.subtotal = updatedInvoice.amount;
     }
     setInvoices(prev => prev.map(i => i.id === updatedInvoice.id ? updatedInvoice : i));
     setSelectedInvoiceForDoc(updatedInvoice); setIsPdfPreviewOpen(true);
  };
  const handleExportPLPDF = () => {
    setPlExportRequested(true);
    openPLPreview();
  };

  // --- Tax Prep Exports ---
  const txForTaxYear = useMemo(() => {
    return transactions.filter(t => {
      const y = new Date(t.date).getFullYear();
      return y === taxPrepYear;
    });
  }, [transactions, taxPrepYear]);

  const mileageForTaxYear = useMemo(() => {
    return mileageTrips.filter(t => new Date(t.date).getFullYear() === taxPrepYear);
  }, [mileageTrips, taxPrepYear]);

  const mileageTotalMilesForTaxYear = useMemo(() => {
    return mileageForTaxYear.reduce((sum, trip) => sum + Number(trip.miles || 0), 0);
  }, [mileageForTaxYear]);

  const mileageDeductionForTaxYear = useMemo(() => {
    const rateUsd = Number(settings.mileageRateCents ?? 72.5) / 100;
    return mileageTotalMilesForTaxYear * rateUsd;
  }, [mileageTotalMilesForTaxYear, settings.mileageRateCents]);

  const getTaxLedgerExportRows = () => {
    return txForTaxYear
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(t => [
        formatDateForExport(t.date),
        t.type,
        t.name,
        t.category,
        Number(t.amount || 0),
        t.notes || '',
        (t as any).receiptId || '',
      ]);
  };

  const getMileageExportRows = () => {
    const rateUsd = Number(settings.mileageRateCents ?? 72.5) / 100;
    return mileageForTaxYear
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(t => {
        const miles = Number(t.miles || 0);
        const deduction = miles * rateUsd;
        return [
          formatDateForExport(t.date),
          miles,
          rateUsd,
          deduction,
          t.purpose,
          t.client || '',
          t.notes || '',
        ];
      });
  };

  const estimateSpreadsheetRowHeight = (
    rowValues: any[],
    columns: { header: string; key: string; width: number }[],
    wrappedColumns: string[]
  ) => {
    const baseHeight = 24;
    const extraLineHeight = 13;
    let maxLines = 1;

    rowValues.forEach((rawValue, index) => {
      const column = columns[index];
      if (!column || !wrappedColumns.includes(column.key)) return;
      const text = String(rawValue ?? '').trim();
      if (!text) return;
      const estimatedCharsPerLine = Math.max(10, Math.floor(column.width * 1.12));
      const estimatedLines = text
        .split(/\r?\n/)
        .reduce((maxForCell, line) => Math.max(maxForCell, Math.max(1, Math.ceil(line.length / estimatedCharsPerLine))), 1);
      maxLines = Math.max(maxLines, estimatedLines);
    });

    return Math.min(88, baseHeight + (maxLines - 1) * extraLineHeight);
  };

  const buildStyledSpreadsheetBuffer = async ({
    sheetName,
    title,
    fileLabel,
    columns,
    rows,
    currencyColumns = [],
    decimalColumns = [],
    wrappedColumns = [],
  }: {
    sheetName: string;
    title: string;
    fileLabel: string;
    columns: { header: string; key: string; width: number }[];
    rows: any[][];
    currencyColumns?: string[];
    decimalColumns?: string[];
    wrappedColumns?: string[];
  }) => {
    const safeSheetName = sanitizeSheetName(sheetName);
    const endColumnLetter = getExcelColumnName(columns.length);
    const now = new Date();
    const generatedLabel = `Generated ${now.toLocaleString()}`;
    const exportBusinessName = (settings.businessName || 'Business').trim() || 'Business';
    const headerRowNumber = 5;
    const generatedRowNumber = 4;
    const dataStartRowNumber = headerRowNumber + 1;
    const dataEndRowNumber = Math.max(headerRowNumber, headerRowNumber + rows.length);
    const lastRowNumber = Math.max(dataEndRowNumber, generatedRowNumber);
    const dimensionRef = `A1:${endColumnLetter}${lastRowNumber}`;
    const mergeRefs = [
      `A1:${endColumnLetter}1`,
      `A3:B3`,
      `C3:${endColumnLetter}3`,
      `A4:${endColumnLetter}4`,
    ];

    const makeCellXml = ({
      ref,
      style,
      value,
      type,
    }: {
      ref: string;
      style: number;
      value: string | number;
      type: 'inlineStr' | 'n';
    }) => {
      if (type === 'n') {
        return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
      }
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value ?? ''))}</t></is></c>`;
    };

    const makeRowXml = (rowNumber: number, cells: string[], height?: number) => {
      const attrs = [`r="${rowNumber}"`];
      if (height) attrs.push(`ht="${height}"`, 'customHeight="1"');
      return `<row ${attrs.join(' ')}>${cells.join('')}</row>`;
    };

    const rowXml: string[] = [];
    rowXml.push(makeRowXml(1, [makeCellXml({ ref: 'A1', style: 1, value: title, type: 'inlineStr' })], 38));
    rowXml.push('<row r="2"/>');
    rowXml.push(makeRowXml(3, [
      makeCellXml({ ref: 'A3', style: 3, value: exportBusinessName, type: 'inlineStr' }),
      makeCellXml({ ref: 'C3', style: 4, value: `Tax Year ${taxPrepYear}`, type: 'inlineStr' }),
    ], 36));
    rowXml.push(makeRowXml(generatedRowNumber, [
      makeCellXml({ ref: 'A4', style: 5, value: generatedLabel, type: 'inlineStr' }),
    ], 22));
    rowXml.push(makeRowXml(headerRowNumber, columns.map((column, index) => makeCellXml({
      ref: `${getExcelColumnName(index + 1)}${headerRowNumber}`,
      style: 6,
      value: column.header,
      type: 'inlineStr',
    })), 26));

    rows.forEach((rowValues, rowIndex) => {
      const excelRowNumber = dataStartRowNumber + rowIndex;
      const isAlt = rowIndex % 2 === 1;
      const cells = rowValues.map((rawValue, columnIndex) => {
        const ref = `${getExcelColumnName(columnIndex + 1)}${excelRowNumber}`;
        const columnKey = columns[columnIndex]?.key;
        const numericValue = Number(rawValue);
        if (currencyColumns.includes(columnKey) && Number.isFinite(numericValue)) {
          return makeCellXml({ ref, style: isAlt ? 10 : 9, value: numericValue, type: 'n' });
        }
        if (decimalColumns.includes(columnKey) && Number.isFinite(numericValue)) {
          return makeCellXml({ ref, style: isAlt ? 12 : 11, value: numericValue, type: 'n' });
        }
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
          return makeCellXml({ ref, style: isAlt ? 8 : 7, value: rawValue, type: 'n' });
        }
        return makeCellXml({ ref, style: isAlt ? 8 : 7, value: String(rawValue ?? ''), type: 'inlineStr' });
      });
      const estimatedRowHeight = estimateSpreadsheetRowHeight(rowValues, columns, wrappedColumns);
      rowXml.push(makeRowXml(excelRowNumber, cells, estimatedRowHeight));
    });

    const colsXml = columns
      .map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`)
      .join('');

    const sheetXml = makeXmlFile(
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<dimension ref="${dimensionRef}"/>` +
        `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRowNumber}" topLeftCell="A${dataStartRowNumber}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${dataStartRowNumber}" sqref="A${dataStartRowNumber}"/></sheetView></sheetViews>` +
        `<sheetFormatPr defaultRowHeight="20"/>` +
        `<cols>${colsXml}</cols>` +
        `<sheetData>${rowXml.join('')}</sheetData>` +
        `<autoFilter ref="A${headerRowNumber}:${endColumnLetter}${dataEndRowNumber}"/>` +
        `<mergeCells count="${mergeRefs.length}">${mergeRefs.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>` +
      `</worksheet>`
    );

    const stylesXml = makeXmlFile(
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        `<numFmts count="2"><numFmt numFmtId="164" formatCode="$#,##0.00"/><numFmt numFmtId="165" formatCode="0.0"/></numFmts>` +
        `<fonts count="9">` +
          `<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>` +
          `<font><b/><sz val="18"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>` +
          `<font><sz val="11"/><color rgb="FF475569"/><name val="Calibri"/><family val="2"/></font>` +
          `<font><b/><sz val="15"/><color rgb="FF2563EB"/><name val="Calibri"/><family val="2"/></font>` +
          `<font><b/><sz val="15"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>` +
          `<font><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/><family val="2"/></font>` +
          `<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>` +
          `<font><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>` +
          `<font><i/><sz val="9"/><color rgb="FF64748B"/><name val="Calibri"/><family val="2"/></font>` +
        `</fonts>` +
        `<fills count="5">` +
          `<fill><patternFill patternType="none"/></fill>` +
          `<fill><patternFill patternType="gray125"/></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>` +
        `</fills>` +
        `<borders count="4">` +
          `<border><left/><right/><top/><bottom/><diagonal/></border>` +
          `<border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border>` +
          `<border><left/><right/><top style="thin"><color rgb="FF2563EB"/></top><bottom style="thin"><color rgb="FF2563EB"/></bottom><diagonal/></border>` +
          `<border><left/><right/><top/><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border>` +
        `</borders>` +
        `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
        `<cellXfs count="14">` +
          `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
          `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>` +
          `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1"/></xf>` +
          `<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>` +
          `<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>` +
          `<xf numFmtId="0" fontId="5" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` +
          `<xf numFmtId="0" fontId="6" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>` +
          `<xf numFmtId="0" fontId="7" fillId="0" borderId="3" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>` +
          `<xf numFmtId="0" fontId="7" fillId="4" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>` +
          `<xf numFmtId="164" fontId="7" fillId="0" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` +
          `<xf numFmtId="164" fontId="7" fillId="4" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` +
          `<xf numFmtId="165" fontId="7" fillId="0" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` +
          `<xf numFmtId="165" fontId="7" fillId="4" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` +
          `<xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
        `</cellXfs>` +
        `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `</styleSheet>`
    );

    const workbookXml = makeXmlFile(
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>` +
        `<sheets><sheet name="${escapeXml(safeSheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
      `</workbook>`
    );

    const workbookRelsXml = makeXmlFile(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`
    );

    const rootRelsXml = makeXmlFile(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
        `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
      `</Relationships>`
    );

    const contentTypesXml = makeXmlFile(
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
        `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
      `</Types>`
    );

    const coreXml = makeXmlFile(
      `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
        `<dc:creator>MONIEZI</dc:creator>` +
        `<cp:lastModifiedBy>MONIEZI</cp:lastModifiedBy>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${now.toISOString()}</dcterms:created>` +
        `<dcterms:modified xsi:type="dcterms:W3CDTF">${now.toISOString()}</dcterms:modified>` +
        `<dc:title>${escapeXml(title)}</dc:title>` +
        `<dc:subject>${escapeXml(fileLabel)}</dc:subject>` +
      `</cp:coreProperties>`
    );

    const appXml = makeXmlFile(
      `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
        `<Application>MONIEZI</Application>` +
        `<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs>` +
        `<TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${escapeXml(safeSheetName)}</vt:lpstr></vt:vector></TitlesOfParts>` +
      `</Properties>`
    );

    const xlsxBlob = createZipBlobUncompressed([
      { name: '[Content_Types].xml', data: contentTypesXml, mtime: now },
      { name: '_rels/.rels', data: rootRelsXml, mtime: now },
      { name: 'docProps/app.xml', data: appXml, mtime: now },
      { name: 'docProps/core.xml', data: coreXml, mtime: now },
      { name: 'xl/workbook.xml', data: workbookXml, mtime: now },
      { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml, mtime: now },
      { name: 'xl/styles.xml', data: stylesXml, mtime: now },
      { name: 'xl/worksheets/sheet1.xml', data: sheetXml, mtime: now },
    ]);

    return await xlsxBlob.arrayBuffer();
  };

  const handleExportTaxLedgerCSV = () => {
    const rows: any[][] = [
      ['date', 'entry_type', 'description', 'category', 'amount_usd', 'notes', 'receipt_id'],
      ...getTaxLedgerExportRows().map(row => [
        row[0],
        row[1],
        row[2],
        row[3],
        formatDecimalForExport(row[4]),
        row[5],
        row[6],
      ]),
    ];
    downloadBlob(makeCsvBlob(rows), `MONIEZI_TaxTransactions_${taxPrepYear}.csv`);
    showToast(`Exported Tax Transactions CSV for ${taxPrepYear}`, 'success');
  };

  const handleExportTaxLedgerSpreadsheet = async () => {
    try {
      const rows = getTaxLedgerExportRows();
      const buffer = await buildStyledSpreadsheetBuffer({
        sheetName: 'Tax Transactions',
        title: 'Tax Transactions',
        fileLabel: `${(settings.businessName || 'Business').trim() || 'Business'} Tax Transactions ${taxPrepYear}`,
        columns: [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Entry Type', key: 'entry_type', width: 16 },
          { header: 'Description', key: 'description', width: 44 },
          { header: 'Category', key: 'category', width: 28 },
          { header: 'Amount (USD)', key: 'amount_usd', width: 16 },
          { header: 'Notes', key: 'notes', width: 42 },
          { header: 'Receipt ID', key: 'receipt_id', width: 20 },
        ],
        rows,
        currencyColumns: ['amount_usd'],
        wrappedColumns: ['description', 'category', 'notes'],
      });
      downloadBlob(makeSpreadsheetBlob(buffer), `MONIEZI_TaxTransactions_${taxPrepYear}.xlsx`);
      showToast(`Exported Tax Transactions spreadsheet for ${taxPrepYear}`, 'success');
    } catch (error) {
      console.error('Tax Transactions spreadsheet export failed', error);
      showToast('Tax Transactions spreadsheet export failed', 'error');
    }
  };

  const handleExportMileageCSV = () => {
    const rows: any[][] = [
      ['date', 'miles', 'rate_usd', 'deduction_usd', 'purpose', 'client', 'notes'],
      ...getMileageExportRows().map(row => [
        row[0],
        formatDecimalForExport(row[1], 1),
        formatDecimalForExport(row[2]),
        formatDecimalForExport(row[3]),
        row[4],
        row[5],
        row[6],
      ]),
    ];
    downloadBlob(makeCsvBlob(rows), `MONIEZI_Mileage_${taxPrepYear}.csv`);
    showToast(`Exported Mileage CSV for ${taxPrepYear}`, 'success');
  };

  const handleExportMileageSpreadsheet = async () => {
    try {
      const rows = getMileageExportRows();
      const buffer = await buildStyledSpreadsheetBuffer({
        sheetName: 'Business Mileage Log',
        title: 'Business Mileage Log',
        fileLabel: `${(settings.businessName || 'Business').trim() || 'Business'} Business Mileage Log ${taxPrepYear}`,
        columns: [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Miles', key: 'miles', width: 11 },
          { header: 'Rate (USD)', key: 'rate_usd', width: 14 },
          { header: 'Deduction (USD)', key: 'deduction_usd', width: 18 },
          { header: 'Purpose', key: 'purpose', width: 40 },
          { header: 'Client', key: 'client', width: 28 },
          { header: 'Notes', key: 'notes', width: 40 },
        ],
        rows,
        currencyColumns: ['rate_usd', 'deduction_usd'],
        decimalColumns: ['miles'],
        wrappedColumns: ['purpose', 'client', 'notes'],
      });
      downloadBlob(makeSpreadsheetBlob(buffer), `MONIEZI_Mileage_${taxPrepYear}.xlsx`);
      showToast(`Exported Mileage spreadsheet for ${taxPrepYear}`, 'success');
    } catch (error) {
      console.error('Mileage spreadsheet export failed', error);
      showToast('Mileage spreadsheet export failed', 'error');
    }
  };

  const handleExportReceiptsZip = async () => {
    const receiptIds = Array.from(new Set(txForTaxYear.filter(t => t.type === 'expense' && (t as any).receiptId).map(t => (t as any).receiptId as string)));
    if (receiptIds.length === 0) return showToast('No linked receipts found for this tax year.', 'info');

    const files: { name: string; data: Uint8Array; mtime?: Date }[] = [];
    const manifest: any[] = [];

    for (const id of receiptIds) {
      const meta = receipts.find(r => r.id === id);
      const rec = await getReceiptBlob(meta?.imageKey || id);
      if (!rec?.blob) continue;

      const ab = await rec.blob.arrayBuffer();
      const data = new Uint8Array(ab);
      const mime = meta?.mimeType || rec.mimeType || rec.blob.type || 'image/jpeg';
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const filename = `receipts/${id}.${ext}`;
      files.push({ name: filename, data, mtime: meta?.date ? new Date(meta.date) : new Date() });
      manifest.push({ id, date: meta?.date, note: meta?.note, filename, mimeType: mime });
    }

    // Add manifest.json for easy mapping
    files.unshift({ name: 'manifest.json', data: utf8(JSON.stringify({ taxYear: taxPrepYear, generatedAt: new Date().toISOString(), receipts: manifest }, null, 2)) });

    const zipBlob = createZipBlobUncompressed(files);
    downloadBlob(zipBlob, `MONIEZI_Receipts_${taxPrepYear}.zip`);
    showToast(`Exported ${files.length - 1} receipt(s) ZIP for ${taxPrepYear}`, 'success');
  };

  const buildTaxSummaryPdfBlob = async () => {
    const incomeTx = txForTaxYear.filter(t => t.type === 'income');
    const expenseTx = txForTaxYear.filter(t => t.type === 'expense');
    const totalIncome = incomeTx.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalExpenses = expenseTx.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const netProfit = totalIncome - totalExpenses;

    const rateCents = Number(settings.mileageRateCents ?? 72.5);
    const mileageRate = rateCents / 100;
    const totalMiles = mileageForTaxYear.reduce((sum, t) => sum + Number(t.miles || 0), 0);
    const mileageDeduction = totalMiles * mileageRate;

    const linkedReceiptExpenses = expenseTx.filter(t => !!(t as any).receiptId);
    const missingReceiptCount = Math.max(expenseTx.length - linkedReceiptExpenses.length, 0);
    const reviewedExpenseCount = expenseTx.filter(t => !!(t as any).reviewedAt).length;
    const pendingReviewCount = Math.max(expenseTx.length - reviewedExpenseCount, 0);
    const uncategorizedCount = txForTaxYear.filter(t => !String(t.category || '').trim()).length;
    const incompleteMileageCount = mileageForTaxYear.filter(t => !String(t.purpose || '').trim() || Number(t.miles || 0) <= 0).length;
    const completeMileageCount = Math.max(mileageForTaxYear.length - incompleteMileageCount, 0);

    const receiptCoveragePct = expenseTx.length > 0 ? (linkedReceiptExpenses.length / expenseTx.length) * 100 : 100;
    const reviewCoveragePct = expenseTx.length > 0 ? (reviewedExpenseCount / expenseTx.length) * 100 : 100;
    const mileageCompletionPct = mileageForTaxYear.length > 0 ? (completeMileageCount / mileageForTaxYear.length) * 100 : 100;

    const uniqueExpenseCategories = Array.from(new Set(
      expenseTx
        .map(t => String(t.category || '').trim())
        .filter(Boolean)
    ));

    const datePool = [
      ...txForTaxYear.map(t => String(t.date || '')).filter(Boolean),
      ...mileageForTaxYear.map(t => String(t.date || '')).filter(Boolean)
    ].sort();
    const reportingStart = datePool[0] || `${taxPrepYear}-01-01`;
    const reportingEnd = datePool[datePool.length - 1] || `${taxPrepYear}-12-31`;

    const expenseCategoryMap = new Map<string, { amount: number; count: number; linked: number }>();
    expenseTx.forEach(t => {
      const rawCategory = String(t.category || '').trim();
      const category = rawCategory || 'Uncategorized';
      const current = expenseCategoryMap.get(category) || { amount: 0, count: 0, linked: 0 };
      current.amount += Number(t.amount || 0);
      current.count += 1;
      if ((t as any).receiptId) current.linked += 1;
      expenseCategoryMap.set(category, current);
    });

    const expenseCategories = Array.from(expenseCategoryMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.amount - a.amount);

    const maxExpenseRows = 6;
    const topExpenseRows = expenseCategories.slice(0, maxExpenseRows);
    if (expenseCategories.length > maxExpenseRows) {
      const remainder = expenseCategories.slice(maxExpenseRows).reduce((acc, item) => {
        acc.amount += item.amount;
        acc.count += item.count;
        acc.linked += item.linked;
        return acc;
      }, { amount: 0, count: 0, linked: 0 });
      if (remainder.count > 0) {
        topExpenseRows.push({ name: 'Other recorded categories', ...remainder });
      }
    }

    const quarterlyMileage = Array.from({ length: 4 }, (_, i) => ({
      quarter: `Q${i + 1}`,
      trips: 0,
      miles: 0,
      deduction: 0,
    }));
    mileageForTaxYear.forEach(t => {
      const date = new Date(t.date);
      const month = Number.isNaN(date.getTime()) ? 0 : date.getMonth();
      const quarterIndex = Math.min(3, Math.max(0, Math.floor(month / 3)));
      const miles = Number(t.miles || 0);
      quarterlyMileage[quarterIndex].trips += 1;
      quarterlyMileage[quarterIndex].miles += miles;
      quarterlyMileage[quarterIndex].deduction += miles * mileageRate;
    });

    const topExpenseCategory = expenseCategories[0];
    const attentionItems: string[] = [];
    if (missingReceiptCount > 0) attentionItems.push(`Attach receipts to ${missingReceiptCount} expense ${missingReceiptCount === 1 ? 'item' : 'items'} to strengthen documentation coverage.`);
    if (pendingReviewCount > 0) attentionItems.push(`Review ${pendingReviewCount} expense ${pendingReviewCount === 1 ? 'item' : 'items'} before handing records to your tax preparer.`);
    if (uncategorizedCount > 0) attentionItems.push(`Assign categories to ${uncategorizedCount} uncategorized ${uncategorizedCount === 1 ? 'entry' : 'entries'} so deductions land in the right buckets.`);
    if (incompleteMileageCount > 0) attentionItems.push(`Complete purpose or mileage details on ${incompleteMileageCount} mileage ${incompleteMileageCount === 1 ? 'trip' : 'trips'}.`);
    if (!attentionItems.length) attentionItems.push('No major data gaps were detected in this tax-prep package.');

    const filename = `MONIEZI_Tax_Prep_Package_${taxPrepYear}.pdf`;
    const generatedAtLabel = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).replace(', ', ' at ').replace(/(AM|PM)$/i, ' $1');
    const reportingPeriodLabel = `${new Date(reportingStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(reportingEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const pdfData: TaxSummaryPdfData = {
      taxYear: String(taxPrepYear),
      businessName: settings.businessName || 'Business',
      ownerName: settings.ownerName || 'Owner',
      generatedAtLabel,
      reportingPeriodLabel,
      totalIncome,
      totalExpenses,
      netProfit,
      totalMiles,
      mileageDeduction,
      mileageRate,
      expenseItemsCount: expenseTx.length,
      ledgerTransactions: txForTaxYear.length,
      linkedReceipts: linkedReceiptExpenses.length,
      expenseCategoriesCount: uniqueExpenseCategories.length,
      topExpenseCategoryName: topExpenseCategory?.name || '—',
      topExpenseCategoryAmount: topExpenseCategory?.amount || 0,
      topExpenseCategorySharePct: totalExpenses > 0 && topExpenseCategory ? (topExpenseCategory.amount / totalExpenses) * 100 : 0,
      receiptCoveragePct,
      reviewCoveragePct,
      mileageCompletionPct,
      reviewedExpenseCount,
      pendingReviewCount,
      completeMileageCount,
      itemsRequiringAttention: missingReceiptCount + pendingReviewCount + uncategorizedCount + incompleteMileageCount,
      expenseRows: topExpenseRows.map(item => ({
        name: item.name,
        amount: item.amount,
        sharePct: totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0,
        linked: item.linked,
        count: item.count,
      })),
      quarterlyMileage,
      hasMileageRows: mileageForTaxYear.length > 0,
      attentionItems,
      currencySymbol: settings.currencySymbol || '$',
    };

    const pdfBytes = await generateTaxSummaryPdfBytes(pdfData);
    return {
      blob: new Blob([pdfBytes], { type: 'application/pdf' }),
      filename,
    };
  };

  const handleDownloadTaxSummaryPDF = async () => {
    try {
      const { blob, filename } = await buildTaxSummaryPdfBlob();
      downloadBlob(blob, filename);
      showToast(`Downloaded Tax Summary PDF for ${taxPrepYear}`, 'success');
    } catch (e) {
      console.error('Tax summary PDF download failed:', {
        name: (e as any)?.name,
        message: (e as any)?.message,
        stack: (e as any)?.stack,
        error: e,
      });
      showToast('Failed to download Tax Summary PDF.', 'error');
    }
  };

  const handleShareTaxSummaryPDF = async () => {
    try {
      const { blob, filename } = await buildTaxSummaryPdfBlob();
      const result = await savePdfBlobToDevice(blob, filename, `Tax Summary PDF for ${taxPrepYear}`);
      if (result === 'shared') {
        showToast('Share opened', 'success');
      } else if (result === 'downloaded') {
        showToast('Sharing not available on this device. PDF downloaded instead.', 'success');
      } else {
        showToast('Share canceled', 'info');
      }
    } catch (e) {
      console.error('Tax summary PDF share failed:', {
        name: (e as any)?.name,
        message: (e as any)?.message,
        stack: (e as any)?.stack,
        error: e,
      });
      showToast('Failed to share Tax Summary PDF.', 'error');
    }
  };



  const prepareProfitLossPdfClone = (source: HTMLElement) => {
    const clone = source.cloneNode(true) as HTMLElement;
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.minHeight = '0';
    clone.style.overflow = 'visible';
    clone.style.fontFamily = 'var(--moniezi-report-font), MonieziReport, MonieziApp, Inter, Arial, sans-serif';
    clone.style.letterSpacing = '0';
    clone.style.color = '#111827';
    clone.style.background = '#ffffff';
    clone.style.boxShadow = 'none';

    const style = document.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box !important;
      }
      .truncate {
        white-space: normal !important;
        overflow: visible !important;
        text-overflow: clip !important;
      }
      .tabular-nums {
        font-variant-numeric: tabular-nums !important;
      }
      .overflow-hidden,
      .overflow-x-hidden,
      .overflow-y-hidden {
        overflow: visible !important;
      }
      .shadow-lg,
      .shadow-xl,
      .shadow-2xl {
        box-shadow: none !important;
      }
    `;
    clone.prepend(style);

    clone.querySelectorAll<HTMLElement>('*').forEach((el) => {
      el.style.textRendering = 'geometricPrecision';
      el.style.setProperty('-webkit-font-smoothing', 'antialiased');
      const className = typeof el.className === 'string' ? el.className : '';
      if (className.includes('truncate')) {
        el.style.whiteSpace = 'normal';
        el.style.overflow = 'visible';
        el.style.textOverflow = 'clip';
      }
      if (className.includes('tabular-nums')) {
        el.style.fontVariantNumeric = 'tabular-nums';
      }
    });

    return clone;
  };


  // Share PDF for Profit & Loss (uses Web Share API when available; falls back to download)
  const sharePLPDF = async () => {
    if (isGeneratingPLPdf) return;
    setIsGeneratingPLPdf(true);
    try {
      // Ensure preview is visible (PDF is captured from the preview DOM)
      if (!showPLPreview) setShowPLPreview(true);

      // Let the modal render fully
      await new Promise(resolve => setTimeout(resolve, 350));

      const element = document.getElementById('pl-pdf-preview-content');
      if (!element) throw new Error("P&L preview element not found");

      // Wait for any images (logo) to finish loading
      const images = Array.from(element.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        const anyImg = img as HTMLImageElement;
        if (anyImg.complete) return Promise.resolve(true);
        return new Promise(resolve => {
          anyImg.onload = () => resolve(true);
          anyImg.onerror = () => resolve(true);
          setTimeout(() => resolve(true), 2000);
        });
      }));

      const periodLabel =
        plPeriodType === 'month'
          ? referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : plPeriodType === 'quarter'
            ? `Q${Math.floor(referenceDate.getMonth() / 3) + 1}_${referenceDate.getFullYear()}`
            : plPeriodType === 'year'
              ? referenceDate.getFullYear().toString()
              : 'All_Time';

      const safeLabel = String(periodLabel).replace(/[^a-z0-9]/gi, '_');
      const filename = `Profit_Loss_${safeLabel}.pdf`;

      // Clone into off-screen wrapper to avoid iOS/Safari clipping (keep ONE long page)
      let cloneWrapper: HTMLDivElement | null = null;

      try {
        const source = element as HTMLElement;

        cloneWrapper = document.createElement('div');
        cloneWrapper.style.position = 'fixed';
        cloneWrapper.style.left = '-100000px';
        cloneWrapper.style.top = '0';
        cloneWrapper.style.width = `${source.scrollWidth}px`;
        cloneWrapper.style.background = '#ffffff';
        cloneWrapper.style.padding = '0';
        cloneWrapper.style.margin = '0';
        cloneWrapper.style.zIndex = '-1';

        const clone = source.cloneNode(true) as HTMLElement;
        clone.style.height = 'auto';
        clone.style.maxHeight = 'none';
        clone.style.overflow = 'visible';

        cloneWrapper.appendChild(clone);
        document.body.appendChild(cloneWrapper);

        await new Promise(resolve => requestAnimationFrame(() => resolve(true)));

        const contentWidth = clone.scrollWidth;
        const contentHeight = clone.scrollHeight;

        const pxToMm = 0.264583; // 96 DPI px -> mm
        const pageWidthMm = 210; // A4 width
        const marginMm = 10;
        const contentWidthMm = pageWidthMm - (marginMm * 2);

        const scaleFactor = contentWidthMm / (contentWidth * pxToMm);
        const pageHeightMm = Math.ceil((contentHeight * pxToMm * scaleFactor) + (marginMm * 2) + 2);

        const opt = {
          margin: [marginMm, marginMm, marginMm, marginMm],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            backgroundColor: '#ffffff',
            scrollY: 0,
            scrollX: 0,
            windowWidth: contentWidth,
            windowHeight: contentHeight
          },
          jsPDF: {
            unit: 'mm',
            format: [pageWidthMm, Math.max(297, pageHeightMm)],
            orientation: 'portrait',
            compress: true
          },
          pagebreak: { mode: 'avoid-all' }
        };

        const worker = html2pdf().set(opt).from(clone);

        // Try to get a Blob without forcing a download
        let blob: Blob | null = null;
        try {
          if (typeof worker.outputPdf === 'function') {
            blob = await worker.outputPdf('blob');
          }
        } catch {}

        if (!blob) {
          await worker.toPdf();
          const pdf = await worker.get('pdf');
          blob = pdf.output('blob');
        }

        const file = new File([blob!], filename, { type: 'application/pdf' });
        const navAny = navigator as any;
        const canShareFiles = !!navAny.share && (!navAny.canShare || navAny.canShare({ files: [file] }));

        if (canShareFiles) {
          await navAny.share({
            files: [file],
            title: filename,
            text: 'Profit & Loss Statement'
          });
          showToast("Share opened", "success");
        } else {
          // Fallback: download
          await worker.save();
          showToast("P&L PDF Downloaded", "success");
        }
      } finally {
        if (cloneWrapper && cloneWrapper.parentNode) cloneWrapper.parentNode.removeChild(cloneWrapper);
      }
    } catch (error) {
      console.error("P&L share failed:", error);
      showToast("Share/Export failed", "error");
    } finally {
      setIsGeneratingPLPdf(false);
    }
  };


  // Manual PDF generation for Invoice - only triggers when user clicks Download
  const generateInvoicePDF = async () => {
    if (!selectedInvoiceForDoc || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const element = document.getElementById('visible-pdf-preview-content');
      if (!element) throw new Error("Preview element not found");
      const images = Array.from(element.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 2000); });
      }));
      const opt = { margin: [10, 10, 10, 10], filename: `Invoice_${selectedInvoiceForDoc.client.replace(/[^a-z0-9]/gi, '_')}_${selectedInvoiceForDoc.date}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollY: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
      await html2pdf().set(opt).from(element).save();
      showToast("PDF Downloaded", "success");
    } catch (error) { 
      console.error("PDF failed:", error); 
      showToast("Export failed", "error"); 
    } finally { 
      setIsGeneratingPdf(false); 
    }
  };



  // Share PDF for Invoice (uses Web Share API when available; falls back to download)
  const shareInvoicePDF = async () => {
    if (!selectedInvoiceForDoc || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const element = document.getElementById('visible-pdf-preview-content');
      if (!element) throw new Error("Preview element not found");

      const images = Array.from(element.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        if ((img as HTMLImageElement).complete) return Promise.resolve();
        return new Promise(resolve => { (img as HTMLImageElement).onload = resolve as any; (img as HTMLImageElement).onerror = resolve as any; setTimeout(resolve, 2000); });
      }));

      const filename = `Invoice_${selectedInvoiceForDoc.client.replace(/[^a-z0-9]/gi, '_')}_${selectedInvoiceForDoc.date}.pdf`;
      const opt = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const worker = html2pdf().set(opt).from(element);

      // Try to get a Blob without forcing a download
      let blob: Blob | null = null;
      try {
        if (typeof worker.outputPdf === 'function') {
          blob = await worker.outputPdf('blob');
        }
      } catch {}

      if (!blob) {
        // Fallback path supported by html2pdf.js
        await worker.toPdf();
        const pdf = await worker.get('pdf');
        blob = pdf.output('blob');
      }

      const file = new File([blob!], filename, { type: 'application/pdf' });
      const navAny = navigator as any;
      const canShareFiles = !!navAny.share && (!navAny.canShare || navAny.canShare({ files: [file] }));

      if (canShareFiles) {
        await navAny.share({
          files: [file],
          title: filename,
          text: 'Invoice PDF'
        });
        showToast("Share opened", "success");
      } else {
        // Fallback: download
        await html2pdf().set(opt).from(element).save();
        showToast("PDF Downloaded", "success");
      }
    } catch (error) {
      console.error("Share failed:", error);
      showToast("Share/Export failed", "error");
    } finally {
      setIsGeneratingPdf(false);
    }
  };
  // Manual PDF generation for Estimate - only triggers when user clicks Download
  const generateEstimatePDF = async () => {
    if (!selectedEstimateForDoc || isGeneratingEstimatePdf) return;
    setIsGeneratingEstimatePdf(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const element = document.getElementById('visible-estimate-pdf-preview-content');
      if (!element) throw new Error('Preview element not found');
      const images = Array.from(element.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        // @ts-ignore
        if ((img as any).complete) return Promise.resolve();
        return new Promise(resolve => {
          // @ts-ignore
          img.onload = resolve;
          // @ts-ignore
          img.onerror = resolve;
          setTimeout(resolve, 2000);
        });
      }));
      
      const contentWidth = element.scrollWidth;
      const contentHeight = element.scrollHeight;
      const pxToMm = 0.264583;
      const pageWidthMm = 210;
      const marginMm = 10;
      const contentWidthMm = pageWidthMm - (marginMm * 2);
      const scaleFactor = contentWidthMm / (contentWidth * pxToMm);
      const pageHeightMm = Math.ceil((contentHeight * pxToMm * scaleFactor) + (marginMm * 2) + 10);
      
      const opt = { 
        margin: [marginMm, marginMm, marginMm, marginMm], 
        filename: `Estimate_${selectedEstimateForDoc.client.replace(/[^a-z0-9]/gi, '_')}_${selectedEstimateForDoc.date}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          backgroundColor: '#ffffff', 
          scrollY: 0,
          scrollX: 0,
          windowWidth: contentWidth,
          windowHeight: contentHeight
        }, 
        jsPDF: { 
          unit: 'mm', 
          format: [pageWidthMm, Math.max(297, pageHeightMm)],
          orientation: 'portrait',
          compress: true
        },
        pagebreak: { mode: 'avoid-all', avoid: ['tr', 'td', '.page-break-avoid'] }
      };
      await html2pdf().set(opt).from(element).save();
      showToast('PDF Downloaded', 'success');
    } catch (error) { 
      console.error('Estimate PDF failed:', error); 
      showToast('Export failed', 'error'); 
    } finally { 
      setIsGeneratingEstimatePdf(false); 
    }
  };

  // Share PDF for Estimate (uses Web Share API when available; falls back to download)
  const shareEstimatePDF = async () => {
    if (!selectedEstimateForDoc || isGeneratingEstimatePdf) return;
    setIsGeneratingEstimatePdf(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const element = document.getElementById('visible-estimate-pdf-preview-content');
      if (!element) throw new Error("Preview element not found");

      const images = Array.from(element.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        if ((img as HTMLImageElement).complete) return Promise.resolve();
        return new Promise(resolve => { (img as HTMLImageElement).onload = resolve as any; (img as HTMLImageElement).onerror = resolve as any; setTimeout(resolve, 2000); });
      }));

      const filename = `Estimate_${selectedEstimateForDoc.client.replace(/[^a-z0-9]/gi, '_')}_${selectedEstimateForDoc.date}.pdf`;
      const opt = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const worker = html2pdf().set(opt).from(element);

      let blob: Blob | null = null;
      try {
        if (typeof worker.outputPdf === 'function') {
          blob = await worker.outputPdf('blob');
        }
      } catch {}

      if (!blob) {
        await worker.toPdf();
        const pdf = await worker.get('pdf');
        blob = pdf.output('blob');
      }

      const file = new File([blob!], filename, { type: 'application/pdf' });
      const navAny = navigator as any;
      const canShareFiles = !!navAny.share && (!navAny.canShare || navAny.canShare({ files: [file] }));

      if (canShareFiles) {
        await navAny.share({
          files: [file],
          title: filename,
          text: 'Estimate PDF'
        });
        showToast("Share opened", "success");
      } else {
        await html2pdf().set(opt).from(element).save();
        showToast("PDF Downloaded", "success");
      }
    } catch (error) {
      console.error("Share failed:", error);
      showToast("Share/Export failed", "error");
    } finally {
      setIsGeneratingEstimatePdf(false);
    }
  };


  const buildProPLPdfData = useCallback((): ProfitLossPdfData => {
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const collapseCategoryRows = (input: Record<string, number>, denominator: number, limit: number, otherLabel = 'Other recorded categories') => {
      const entries = Object.entries(input || {})
        .filter(([, amount]) => Math.abs(Number(amount) || 0) > 0.0001)
        .sort(([, a], [, b]) => (Number(b) || 0) - (Number(a) || 0));

      if (entries.length <= limit) {
        return entries.map(([name, amount]) => ({
          name,
          amount: Number(amount) || 0,
          sharePct: denominator > 0 ? ((Number(amount) || 0) / denominator) * 100 : 0,
        }));
      }

      const primary = entries.slice(0, limit - 1).map(([name, amount]) => ({
        name,
        amount: Number(amount) || 0,
        sharePct: denominator > 0 ? ((Number(amount) || 0) / denominator) * 100 : 0,
      }));
      const otherTotal = entries.slice(limit - 1).reduce((sum, [, amount]) => sum + (Number(amount) || 0), 0);
      return [
        ...primary,
        {
          name: otherLabel,
          amount: otherTotal,
          sharePct: denominator > 0 ? (otherTotal / denominator) * 100 : 0,
        },
      ];
    };

    const revenueRows = collapseCategoryRows(proPLData.incomeByCategory || {}, proPLData.netRevenue, 6);
    const cogsRows = Object.entries(proPLData.cogsByCategory || {})
      .filter(([, amount]) => Math.abs(Number(amount) || 0) > 0.0001)
      .sort(([, a], [, b]) => (Number(b) || 0) - (Number(a) || 0))
      .slice(0, 4)
      .map(([name, amount]) => ({
        name,
        amount: Number(amount) || 0,
        sharePct: proPLData.netRevenue > 0 ? ((Number(amount) || 0) / proPLData.netRevenue) * 100 : 0,
      }));

    const expenseRows = collapseCategoryRows(proPLData.expensesByCategory || {}, proPLData.totalOpex, 7);
    const sortedExpenseRows = [...expenseRows].sort((a, b) => b.amount - a.amount);
    const topExpense = sortedExpenseRows[0] || { name: 'No operating expenses recorded', amount: 0, sharePct: 0 };

    const otherIncomeRows: Array<{ name: string; amount: number }> = [];
    if (Math.abs(proPLData.interestIncome || 0) > 0.0001) {
      otherIncomeRows.push({ name: 'Interest Income', amount: Number(proPLData.interestIncome) || 0 });
    }
    if (Math.abs(proPLData.interestExpense || 0) > 0.0001) {
      otherIncomeRows.push({ name: 'Interest Expense', amount: -Math.abs(Number(proPLData.interestExpense) || 0) });
    }
    if (otherIncomeRows.length === 0) {
      otherIncomeRows.push({ name: 'No other income / expense recorded', amount: 0 });
    }

    const statementChecks: string[] = [];
    if (proPLData.uncategorizedCount > 0) {
      statementChecks.push(`Review ${proPLData.uncategorizedCount} uncategorized entr${proPLData.uncategorizedCount === 1 ? 'y' : 'ies'} totaling ${formatCurrency.format(proPLData.uncategorizedAmount)} before final filing.`);
    } else {
      statementChecks.push('No uncategorized entries were detected in this reporting period.');
    }
    if (Math.abs(proPLData.refunds) > 0.0001) {
      statementChecks.push(`Returns and refunds of ${formatCurrency.format(proPLData.refunds)} have been netted against gross sales in this statement.`);
    } else {
      statementChecks.push('No returns or refunds were recorded in this reporting period.');
    }
    statementChecks.push(`${plAccountingBasis === 'cash' ? 'Cash Basis' : 'Accrual Basis'} is applied throughout this P&L statement.`);

    const ownerName = (settings.ownerName || '').trim();
    const preparedBy = !ownerName || ownerName.toLowerCase() === 'owner' ? 'Prepared privately' : ownerName;

    return {
      businessName: settings.businessName || 'Business',
      ownerName: preparedBy,
      generatedAtLabel: new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
      reportingPeriodLabel: `${formatDate(proPLData.startDate)} - ${formatDate(proPLData.endDate)}`,
      periodLabel: proPLData.periodLabel,
      accountingBasisLabel: plAccountingBasis === 'cash' ? 'Cash Basis' : 'Accrual Basis',
      grossSales: Number(proPLData.salesServices || 0) + Number(proPLData.refunds || 0),
      refunds: Number(proPLData.refunds) || 0,
      netRevenue: Number(proPLData.netRevenue) || 0,
      cogs: Number(proPLData.cogs) || 0,
      grossProfit: Number(proPLData.grossProfit) || 0,
      totalOpex: Number(proPLData.totalOpex) || 0,
      operatingIncome: Number(proPLData.operatingIncome) || 0,
      otherIncome: Number(proPLData.interestIncome) || 0,
      otherExpenses: Number(proPLData.interestExpense) || 0,
      netOtherIncome: Number(proPLData.netOtherIncome) || 0,
      netIncome: Number(proPLData.netIncome) || 0,
      grossMarginPct: Number(proPLData.grossMargin) || 0,
      operatingExpenseRatioPct: proPLData.netRevenue > 0 ? ((Number(proPLData.totalOpex) || 0) / Number(proPLData.netRevenue)) * 100 : 0,
      operatingMarginPct: Number(proPLData.operatingMargin) || 0,
      netMarginPct: Number(proPLData.netMargin) || 0,
      transactionCount: Number(proPLData.transactionCount) || 0,
      expenseCategoryCount: Object.keys(proPLData.expensesByCategory || {}).length,
      topExpenseCategoryName: topExpense.name,
      topExpenseCategoryAmount: topExpense.amount,
      topExpenseCategorySharePct: topExpense.sharePct,
      revenueRows,
      cogsRows,
      expenseRows,
      otherIncomeRows,
      statementChecks,
      currencySymbol: '$',
    };
  }, [plAccountingBasis, proPLData, settings.businessName, settings.ownerName]);


  const buildProPLPdfBlob = async (): Promise<{ blob: Blob; filename: string }> => {
    const pdfData = buildProPLPdfData();
    const safeBusiness = (pdfData.businessName || 'Business').replace(/[^a-z0-9]/gi, '_');
    const safeEndDate = proPLData.endDate.toISOString().split('T')[0];
    const filename = `PL_${safeBusiness}_${safeEndDate}.pdf`;
    const pdfBytes = await generateProfitLossPdfBytes(pdfData);
    return {
      blob: new Blob([pdfBytes], { type: 'application/pdf' }),
      filename,
    };
  };

  const downloadBlobFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const saveProPLPDF = async () => {
    if (isGeneratingProPLPdf) return;
    setIsGeneratingProPLPdf(true);

    try {
      const { blob, filename } = await buildProPLPdfBlob();
      downloadBlobFile(blob, filename);
      showToast('PDF downloaded', 'success');
    } catch (error) {
      console.error('P&L download error:', error);
      showToast('Download failed', 'error');
    } finally {
      setIsGeneratingProPLPdf(false);
    }
  };

  // Share the true generated Profit & Loss PDF using the native OS share sheet when available.
  // Falls back to a normal download only on browsers that cannot share files.
  const shareProPLPDF = async () => {
    if (isGeneratingProPLPdf) return;
    setIsGeneratingProPLPdf(true);

    try {
      const { blob, filename } = await buildProPLPdfBlob();
      const file = new File([blob], filename, { type: 'application/pdf' });
      const navAny = navigator as any;
      const canShareFiles = !!navAny.share && (!navAny.canShare || navAny.canShare({ files: [file] }));

      if (canShareFiles) {
        await navAny.share({
          files: [file],
          title: filename,
          text: 'Profit & Loss Statement'
        });
        showToast('Share opened', 'success');
      } else {
        downloadBlobFile(blob, filename);
        showToast('Sharing not available on this device. PDF downloaded instead.', 'success');
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        showToast('Share canceled', 'info');
      } else {
        console.error('P&L Share error:', error);
        showToast('Share failed', 'error');
      }
    } finally {
      setIsGeneratingProPLPdf(false);
    }
  };




  useEffect(() => {
    let isMounted = true;
    const generatePLPdf = async () => {
      if (!showPLPreview || !plExportRequested || isGeneratingPLPdf) return;

      setIsGeneratingPLPdf(true);
      // Let the modal render fully
      await new Promise(resolve => setTimeout(resolve, 350));

      try {
        const element = document.getElementById('pl-pdf-preview-content');
        if (!element) throw new Error("P&L preview element not found");

        // Wait for any images (logo) to finish loading
        const images = Array.from(element.querySelectorAll('img'));
        await Promise.all(images.map(img => {
          const anyImg = img as HTMLImageElement;
          if (anyImg.complete) return Promise.resolve(true);
          return new Promise(resolve => {
            anyImg.onload = () => resolve(true);
            anyImg.onerror = () => resolve(true);
            setTimeout(() => resolve(true), 2000);
          });
        }));

        const periodLabel =
          plPeriodType === 'month'
            ? referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : plPeriodType === 'quarter'
              ? `Q${Math.floor(referenceDate.getMonth() / 3) + 1}_${referenceDate.getFullYear()}`
              : plPeriodType === 'year'
                ? referenceDate.getFullYear().toString()
                : 'All_Time';

        const safeLabel = String(periodLabel).replace(/[^a-z0-9]/gi, '_');

        // IMPORTANT: html2canvas/html2pdf can clip content inside scrollable containers.
        // We clone the preview content into an off-screen wrapper with no height/overflow limits,
        // then size the PDF page to the full content height so the export is ONE long page.
        let cloneWrapper: HTMLDivElement | null = null;

        try {
          const source = element as HTMLElement;

          cloneWrapper = document.createElement('div');
          cloneWrapper.style.position = 'fixed';
          cloneWrapper.style.left = '-100000px';
          cloneWrapper.style.top = '0';
          cloneWrapper.style.width = `${source.scrollWidth}px`;
          cloneWrapper.style.background = '#ffffff';
          cloneWrapper.style.padding = '0';
          cloneWrapper.style.margin = '0';
          cloneWrapper.style.zIndex = '-1';

          const clone = source.cloneNode(true) as HTMLElement;
          // Remove any potential clipping on the clone
          clone.style.height = 'auto';
          clone.style.maxHeight = 'none';
          clone.style.overflow = 'visible';

          cloneWrapper.appendChild(clone);
          document.body.appendChild(cloneWrapper);

          // Let the browser layout the clone before measuring/capturing
          await new Promise(resolve => requestAnimationFrame(() => resolve(true)));

          const contentWidth = clone.scrollWidth;
          const contentHeight = clone.scrollHeight;

          const pxToMm = 0.264583; // 96 DPI px -> mm
          const pageWidthMm = 210; // A4 width
          const marginMm = 10;
          const contentWidthMm = pageWidthMm - (marginMm * 2);

          // Scale so the content fits the A4 width, then compute the required page height
          const scaleFactor = contentWidthMm / (contentWidth * pxToMm);
          const pageHeightMm = Math.ceil((contentHeight * pxToMm * scaleFactor) + (marginMm * 2) + 2);

          const opt = {
            margin: [marginMm, marginMm, marginMm, marginMm],
            filename: `Profit_Loss_${safeLabel}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              letterRendering: true,
              backgroundColor: '#ffffff',
              scrollY: 0,
              scrollX: 0,
              windowWidth: contentWidth,
              windowHeight: contentHeight
            },
            jsPDF: {
              unit: 'mm',
              format: [pageWidthMm, Math.max(297, pageHeightMm)],
              orientation: 'portrait',
              compress: true
            },
            pagebreak: { mode: 'avoid-all' }
          };

          await html2pdf().set(opt).from(clone).save();
        } finally {
          if (cloneWrapper && cloneWrapper.parentNode) cloneWrapper.parentNode.removeChild(cloneWrapper);
        }

        if (isMounted) {
          showToast("P&L PDF Downloaded", "success");
          setPlExportRequested(false);
          setTimeout(() => closePLPreview(), 1000);
        }
      } catch (error) {
        console.error("P&L PDF failed:", error);
        if (isMounted) {
          showToast("P&L PDF export failed", "error");
          setPlExportRequested(false);
        }
      } finally {
        if (isMounted) setIsGeneratingPLPdf(false);
      }
    };

    if (showPLPreview && plExportRequested) generatePLPdf();

    return () => { isMounted = false; };
  }, [showPLPreview, plExportRequested, filterPeriod, referenceDate]);



  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          if (file.size > 2 * 1024 * 1024) return showToast("File size too large (max 2MB)", "error");
          const reader = new FileReader();
          reader.onload = (e) => { setSettings(s => ({ ...s, businessLogo: e.target?.result as string })); showToast("Logo uploaded", "success"); };
          reader.readAsDataURL(file);
      }
  };

  // --- Scan Receipt Functions ---
  const handleScanReceipt = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        compressReceiptImage(file).then(({ dataUrl, blob }) => {
            setScanPreview(dataUrl);
            setScanPreviewBlob(blob);
        }).catch(err => {
            console.error("Compression error:", err);
            showToast("Failed to process image", "error");
        });
        // Reset input so same file can be selected again if needed
        event.target.value = '';
    }
  };

  const saveReceipt = async () => {
      if (scanPreview && scanPreviewBlob) {
          const id = generateId('receipt');
          const date = new Date().toISOString().split('T')[0];
          try {
              await putReceiptBlob(id, scanPreviewBlob, scanPreviewBlob.type || 'image/jpeg');

              const newReceipt: ReceiptType = {
                  id,
                  date,
                  imageKey: id,
                  mimeType: scanPreviewBlob.type || 'image/jpeg',
              };

              setReceipts(prev => [newReceipt, ...prev]);

              // Create a preview URL immediately for a smooth UI
              const url = URL.createObjectURL(scanPreviewBlob);
              setReceiptPreviewUrls(prev => ({ ...prev, [id]: url }));

              setScanPreview(null);
              // If an expense is being edited/added, auto-link the new receipt
              if (isDrawerOpen && (drawerMode === 'add' || drawerMode === 'edit_tx') && activeTab === 'expense') {
                  setActiveItem(prev => ({ ...prev, receiptId: id }));
              }

              // If the user tapped "Expense" from Home, open a new expense with this receipt attached.
              if (!isDrawerOpen && scanMode === 'expenseWithReceipt') {
                  setCurrentPage(Page.Expenses);
                  handleOpenFAB('expense');
                  setTimeout(() => {
                      setActiveItem(prev => ({ ...prev, receiptId: id, name: prev.name || newReceipt.note || '', date }));
                  }, 0);
              }

              setScanMode('receiptOnly');
              setScanPreviewBlob(null);
              showToast("Receipt saved", "success");
          } catch (e) {
              console.error(e);
              showToast("Failed to save receipt (storage error).", "error");
          }
      }
  };

  const deleteReceipt = async (id: string) => {
      if (confirm("Delete this receipt?")) {
          try {
              await deleteReceiptBlob(id);
          } catch (e) {
              console.error(e);
          }

          setReceiptPreviewUrls(prev => {
              const copy = { ...prev };
              if (copy[id]) URL.revokeObjectURL(copy[id]);
              delete copy[id];
              return copy;
          });

          setReceipts(prev => prev.filter(r => r.id !== id));
          closeReceipt();
          showToast("Receipt deleted", "info");
      }
  };

  // --- Backup Functions ---
  const handleExportBackup = async () => {
    try {
      // Include receipt images from IndexedDB as DataURLs so the backup is self-contained.
      const receiptsForBackup: any[] = [];
      for (const r of receipts) {
        const rec = await getReceiptBlob(r.imageKey || r.id);
        const imageData = rec?.blob ? await blobToDataUrl(rec.blob) : null;
        receiptsForBackup.push({
          id: r.id,
          date: r.date,
          note: r.note,
          imageData: imageData || undefined,
        });
      }

      const backup = {
        metadata: {
          appName: "MONIEZI",
          version: CUSTOMER_VERSION,
          schemaVersion: 1,
          timestamp: new Date().toISOString(),
        },
        data: {
          transactions,
          invoices,
          estimates,
          clients,
          settings,
          taxPayments,
          customCategories,
          receipts: receiptsForBackup,
          mileageTrips,
          companyEquity,
          savedTemplates,
          duplicationHistory,
          plannerData,
        },
      };

      const dataStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `moniezi_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Backup file downloaded", "success");
    } catch (e) {
      console.error(e);
      showToast("Backup export failed.", "error");
    }
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const parsed = JSON.parse(content);
            
            // Simple validation
            if (!parsed.metadata || !parsed.data) {
                throw new Error("Invalid backup format");
            }
            
            setPendingBackupData(parsed.data);
            setShowRestoreModal(true);
        } catch (err) {
            console.error(err);
            showToast("Invalid backup file", "error");
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const performRestore = async () => {
    if (!pendingBackupData) return;

    try {
      const newData = pendingBackupData;

      // 1. Prepare safe data objects with defaults to prevent crashes
      const tx = Array.isArray(newData.transactions) ? newData.transactions : [];
      const inv = Array.isArray(newData.invoices) ? newData.invoices : [];
      const est = Array.isArray(newData.estimates) ? newData.estimates : [];
      const cls = Array.isArray(newData.clients) ? newData.clients : [];
      const tax = Array.isArray(newData.taxPayments) ? newData.taxPayments : [];
      const rec = Array.isArray(newData.receipts) ? newData.receipts : [];
      const set = { ...settings, ...(newData.settings || {}) };

      const cats = {
        income: Array.isArray(newData.customCategories?.income) ? newData.customCategories.income : [],
        expense: Array.isArray(newData.customCategories?.expense) ? newData.customCategories.expense : [],
        billing: Array.isArray(newData.customCategories?.billing) ? newData.customCategories.billing : [],
      };

      const trips = Array.isArray(newData.mileageTrips) ? newData.mileageTrips : [];
      const templates = Array.isArray(newData.savedTemplates) ? newData.savedTemplates : [];
      const dupeHist = newData.duplicationHistory || {};
      const planner = newData.plannerData || null;
      const equityState = normalizeCompanyEquityState(newData.companyEquity, set.businessName || settings.businessName);

      // 2. Restore receipts into IndexedDB (backup carries imageData DataURLs)
      const restoredReceipts: ReceiptType[] = [];
      for (const r of rec) {
        if (!r?.id) continue;

        if (r.imageData) {
          const { blob, mimeType } = await dataUrlToBlob(r.imageData);
          await putReceiptBlob(r.id, blob, mimeType);
          restoredReceipts.push({
            id: r.id,
            date: r.date || new Date().toISOString().split('T')[0],
            imageKey: r.id,
            mimeType,
            note: r.note,
          } as ReceiptType);
        } else if (r.imageKey) {
          // Metadata-only receipt (image may be missing)
          restoredReceipts.push(r as ReceiptType);
        }
      }

      // 3. Update State directly (triggers useEffect to save to LS)
      setTransactions(tx);
      setInvoices(inv);
      setEstimates(est);
      setClients(cls);
      setTaxPayments(tax);
      setReceipts(restoredReceipts);
      setSettings(set);
      setCustomCategories(cats);

      setMileageTrips(trips);
      setCompanyEquity(equityState);
      setSavedTemplates(templates);
      setDuplicationHistory(dupeHist);
      if (planner) setPlannerData(planner);

      // 4. UI Feedback & Cleanup
      setShowRestoreModal(false);
      setPendingBackupData(null);
      showToast("Backup restored successfully!", "success");

      // 5. Navigate to Dashboard to show data immediately
      setCurrentPage(Page.Dashboard);
    } catch (e) {
      console.error("Restore error", e);
      showToast("Failed to restore: Invalid data", "error");
    }
  };

  const renderCategoryChips = (current: string | undefined, onSelect: (cat: string) => void) => {
    const baseList = activeTab === 'income' ? CATS_IN : activeTab === 'expense' ? CATS_OUT : CATS_BILLING;
    const customList = activeTab === 'income' ? customCategories.income : activeTab === 'expense' ? customCategories.expense : customCategories.billing;
    const allCategories = [...customList, ...baseList.filter(c => !c.startsWith('Other'))];
    let displayList = allCategories;
    if (categorySearch) displayList = allCategories.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()));

    return (
      <div className="mt-3 space-y-3">
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400" size={16} />
            <input type="text" placeholder="Search or add category..." value={categorySearch} onChange={e => setCategorySearch(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white" />
         </div>
         <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
            {!categorySearch && recentCategories.length > 0 && (
                <div className="mb-4">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-2 block">Recent</label>
                    <div className="flex flex-wrap gap-2">
                        {recentCategories.map(cat => (
                            <button key={`recent-${cat}`} type="button" onClick={() => onSelect(cat)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border ${current === cat ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{getCategoryIcon(cat)}{cat}</button>
                        ))}
                    </div>
                </div>
            )}
            <div>
               <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-2 block">{categorySearch ? 'Results' : 'All Categories'}</label>
               <div className="flex flex-wrap gap-2">
                  {displayList.map(cat => (
                    <button key={cat} type="button" onClick={() => onSelect(cat)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${current === cat ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-800 border border-slate-300/50 dark:border-0'}`}>{getCategoryIcon(cat)}{cat}</button>
                  ))}
                  <button type="button" onClick={() => { if (drawerMode !== 'create_cat') previousDrawerMode.current = drawerMode as any; setNewCategoryName(categorySearch); setDrawerMode('create_cat'); }} className="px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-2 border-dashed border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-900/30"><Plus size={14} />{categorySearch ? `Create "${categorySearch}"` : "Custom Category..."}</button>
               </div>
            </div>
         </div>
      </div>
    );
  };

  const renderMileageTripList = (emptyLabel = `No mileage trips for ${taxPrepYear}.`) => {
    const sortedTrips = mileageForTaxYear.slice().sort((a, b) => b.date.localeCompare(a.date));

    if (sortedTrips.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-6 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
          {emptyLabel}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {sortedTrips.map(trip => {
          const displayDate = trip.date ? new Date(`${trip.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date';
          return (
            <button
              key={trip.id}
              type="button"
              onClick={() => openMileageEditDrawer(trip)}
              className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 active:scale-[0.99] transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{trip.purpose || 'Mileage trip'}</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{displayDate}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-base font-black text-slate-900 dark:text-white">{Number(trip.miles || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Miles</div>
                </div>
              </div>
              {(trip.client || trip.notes) && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {trip.client ? <div className="truncate"><span className="font-extrabold text-slate-700 dark:text-slate-200">Client:</span> {trip.client}</div> : null}
                  {trip.notes ? <div className="truncate"><span className="font-extrabold text-slate-700 dark:text-slate-200">Notes:</span> {trip.notes}</div> : null}
                </div>
              )}
              <div className="mt-3 text-[10px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400">Tap to edit</div>
            </button>
          );
        })}
      </div>
    );
  };

  const addInvoiceItem = () => setActiveItem(prev => ({ ...prev, items: [...(prev.items || []), { id: generateId('item'), description: '', quantity: 1, rate: 0 }] }));
  const removeInvoiceItem = (itemId: string) => setActiveItem(prev => ({ ...prev, items: prev.items?.filter(item => item.id !== itemId) }));
  const updateInvoiceItem = (itemId: string, field: keyof InvoiceItem, value: any) => setActiveItem(prev => ({ ...prev, items: prev.items?.map(item => item.id === itemId ? { ...item, [field]: value } : item) }));

  const activeInvoiceTotals = useMemo(() => {
      if (!activeItem.items) return { subtotal: 0, total: 0, tax: 0 };
      const subtotal = activeItem.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
      const discount = activeItem.discount || 0;
      const taxRate = activeItem.taxRate || 0;
      const taxAmount = (subtotal - discount) * (taxRate / 100);
      const total = Math.max(0, subtotal - discount + taxAmount + (activeItem.shipping || 0));
      return { subtotal, total, tax: taxAmount };
  }, [activeItem]);

  // Show loading state while checking license
  if (LICENSING_ENABLED && isLicenseValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div 
                        className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 transform-gpu cursor-pointer select-none"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="40" 
              height="40" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-white pointer-events-none"
              style={{ shapeRendering: 'geometricPrecision' }}
            >
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>
            </svg>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Loader2 size={20} className="animate-spin text-blue-500" />
            <span className="text-slate-400 font-medium">Loading Moniezi...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show license activation screen if not valid
  if (LICENSING_ENABLED && isLicenseValid === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>
        
        <div className="relative w-full max-w-md">
          {/* Logo and Welcome */}
          <div className="text-center mb-8">
            <div className="w-28 h-28 mx-auto mb-6 rounded-[28px] bg-gradient-to-br from-blue-500 to-indigo-600 p-[10px] shadow-2xl shadow-blue-500/30 ring-1 ring-white/10 transform-gpu hover:scale-105 transition-transform cursor-pointer select-none">
              <img
                src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
                alt="MONIEZI icon"
                className="w-full h-full rounded-[22px] object-cover pointer-events-none"
                draggable={false}
              />
            </div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Welcome to MONIEZI</h1>
            <p className="text-slate-400">One-time purchase • No subscription • Works offline</p>
          </div>

          {/* License Card */}
          <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Key size={20} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Activate Your License</h2>
                <p className="text-sm text-slate-500">Enter your license key to unlock MONIEZI</p>
              </div>
            </div>

            {/* License Key Input */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  License Key
                </label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => { setLicenseKey(e.target.value); setLicenseError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleActivateLicense()}
                  placeholder="Enter your license key"
                  className="w-full px-4 py-4 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-base placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  disabled={isValidatingLicense}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                />
              </div>

              {/* Error Message */}
              {licenseError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-400">{licenseError}</p>
                </div>
              )}

              {/* Activate Button */}
              <button
                onClick={handleActivateLicense}
                disabled={isValidatingLicense || !licenseKey.trim()}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isValidatingLicense ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Activate License
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-xs text-slate-600 uppercase tracking-wider">Need a license?</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* Purchase Action */}
            {PURCHASE_URL ? (
              <a
                href={PURCHASE_URL}
                target="_blank"
                rel="noreferrer"
                className="w-full min-h-[60px] px-5 py-4 bg-blue-600 hover:bg-blue-500 !text-white font-bold rounded-xl text-center flex items-center justify-center transition-colors"
              >
                Buy MONIEZI Pro Finance
              </a>
            ) : (
              <div className="w-full min-h-[72px] px-5 py-4 bg-slate-800 text-slate-300 font-semibold rounded-xl text-center flex items-center justify-center">
                <span className="max-w-[17rem] leading-snug text-[15px] sm:text-base whitespace-normal">
                  Use the license key from your purchase confirmation
                </span>
              </div>
            )}
          </div>

          {/* Features Preview */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { icon: <TrendingUp size={18} />, label: 'Track Income' },
              { icon: <Receipt size={18} />, label: 'Manage Expenses' },
              { icon: <FileText size={18} />, label: 'Create Invoices' },
            ].map((feature, i) => (
              <div key={i} className="text-center p-4 bg-slate-900/50 rounded-xl border border-slate-800/50">
                <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                  {feature.icon}
                </div>
                <span className="text-xs text-slate-500 font-medium">{feature.label}</span>
              </div>
            ))}
          </div>

          {/* Customer links */}
          <div className="mt-8 text-center text-slate-500 text-xs leading-6">
            {(TERMS_URL || PRIVACY_URL) && (
              <p>
                By activating, you agree to the{' '}
                {TERMS_URL ? (
                  <a href={TERMS_URL} target="_blank" rel="noreferrer" className="text-slate-300 underline underline-offset-2">Terms</a>
                ) : (
                  'Terms'
                )}
                {PRIVACY_URL ? (
                  <> and <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="text-slate-300 underline underline-offset-2">Privacy Policy</a></>
                ) : null}
                .
              </p>
            )}
            {SUPPORT_EMAIL ? (
              <p>
                Need help?{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-slate-300 underline underline-offset-2">{SUPPORT_EMAIL}</a>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const useDarkChrome = theme !== 'dark';
  const navInactiveColor = theme === 'dark' ? 'var(--nav-inactive)' : '#e2e8f0';
  const headerActionButtonStyle: React.CSSProperties = useDarkChrome
    ? {
        color: '#e2e8f0',
        backgroundColor: '#162445',
        borderColor: 'rgba(148, 163, 184, 0.30)',
        boxShadow: '0 10px 24px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.10)'
      }
    : {
        color: '#e2e8f0',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(148, 163, 184, 0.22)',
        boxShadow: '0 10px 24px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
      };
  const darkChromeNavInactiveStyle = useDarkChrome ? { color: '#e2e8f0' } : { color: navInactiveColor };
  const darkChromeNavActiveStyle = useDarkChrome ? { color: '#ffffff' } : undefined;

  return (
    <>
      <style>{`
/* ================================
   Light mode visual pass
   White canvas + stronger text
   ================================ */
html:not(.dark) .bg-slatebg { background: #ffffff !important; }
html:not(.dark) .text-slate-200 { color: rgb(100 116 139) !important; }
html:not(.dark) .text-slate-300 { color: rgb(71 85 105) !important; }
html:not(.dark) .text-slate-400 { color: rgb(51 65 85) !important; }
html:not(.dark) .text-slate-500 { color: rgb(30 41 59) !important; }
html:not(.dark) .text-slate-600 { color: rgb(15 23 42) !important; }
html:not(.dark) .text-slate-700,
html:not(.dark) .text-slate-800,
html:not(.dark) .text-slate-900 { color: rgb(2 6 23) !important; }

html:not(.dark) .font-normal { font-weight: 500 !important; }
html:not(.dark) .font-medium { font-weight: 600 !important; }
html:not(.dark) .font-semibold { font-weight: 700 !important; }
html:not(.dark) .font-bold { font-weight: 800 !important; }

/* Quick Add typography lock: keep dark mode text metrics identical to light mode */
.quick-add-typography-lock,
.quick-add-typography-lock * {
  font-family: var(--moniezi-app-font) !important;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-kerning: normal;
  font-feature-settings: 'liga' 1, 'calt' 1;
}
.quick-add-typography-lock .qa-heading {
  font-size: 2rem;
  line-height: 1;
  font-weight: 900;
  letter-spacing: -0.025em;
}
.quick-add-typography-lock .qa-subheading {
  font-size: 0.95rem;
  line-height: 1.25rem;
  font-weight: 900;
  letter-spacing: 0;
}
.quick-add-typography-lock .qa-tile-copy {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.quick-add-typography-lock .qa-tile-title {
  margin: 0;
  font-size: 1.02rem;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0.025em;
  text-transform: uppercase;
}
.quick-add-typography-lock .qa-tile-desc {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.25rem;
  font-weight: 500;
  letter-spacing: 0;
}
@media (min-width: 640px) {
  .quick-add-typography-lock .qa-heading {
    font-size: 2.05rem;
  }
  .quick-add-typography-lock .qa-subheading {
    font-size: 1rem;
  }
}

/* Slightly crisper borders in light mode */
html:not(.dark) .border-slate-100 { border-color: rgb(232 238 245) !important; }
html:not(.dark) .border-slate-200 { border-color: rgb(216 224 234) !important; }
html:not(.dark) .border-slate-300 { border-color: rgb(194 205 218) !important; }

/* Subtle “inkier” shadows in light mode */
html:not(.dark) .shadow-sm { box-shadow: 0 1px 2px rgba(2, 6, 23, 0.10) !important; }
html:not(.dark) .shadow { box-shadow: 0 1px 3px rgba(2, 6, 23, 0.14), 0 1px 2px rgba(2, 6, 23, 0.10) !important; }
html:not(.dark) .shadow-md { box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04) !important; }

/* Slightly stronger separators */
html:not(.dark) .divide-slate-200 > :not([hidden]) ~ :not([hidden]) { border-color: rgb(216 224 234) !important; }

/* Preserve exact dark-mode chrome when reused in light mode */
html.theme-light .dark-chrome button { color: inherit; }
html.theme-light .dark-chrome .chrome-btn,
html.theme-light .dark-chrome .chrome-btn svg { color: #e2e8f0 !important; stroke: currentColor; }
html.theme-light .dark-chrome .chrome-btn:hover,
html.theme-light .dark-chrome .chrome-btn:hover svg { color: #ffffff !important; }
html.theme-light .dark-chrome .dark-chrome-nav-item { color: #e2e8f0 !important; }
html.theme-light .dark-chrome .dark-chrome-nav-item.active { color: #ffffff !important; }


/* iPhone transaction drawer containment pass */
html, body, #root {
  max-width: 100%;
  overflow-x: clip;
  overscroll-behavior-x: none;
}
.moniezi-app-shell {
  width: 100%;
  max-width: 42rem;
  margin-left: auto;
  margin-right: auto;
  overflow-x: clip;
}
.main-scroll-lock,
.main-scroll-lock > div {
  min-width: 0;
  max-width: 100%;
}
.drawer-shell,
.drawer-scroll-area,
.drawer-scroll-area > div {
  min-width: 0;
  max-width: 100%;
}
.drawer-scroll-area {
  overflow-y: auto;
  overflow-x: clip;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.drawer-scroll-area,
.drawer-scroll-area * {
  box-sizing: border-box;
}
.drawer-scroll-area .flex,
.drawer-scroll-area .grid {
  min-width: 0;
}
.drawer-scroll-area .flex > *,
.drawer-scroll-area .grid > * {
  min-width: 0;
}
.drawer-scroll-area input,
.drawer-scroll-area select,
.drawer-scroll-area textarea,
.drawer-scroll-area button {
  max-width: 100%;
}
/* clip is used directly — no @supports fallback needed */
@media (max-width: 430px) {
  .moniezi-app-shell {
    width: 100%;
    max-width: 100%;
  }
  .drawer-shell {
    width: 100%;
    max-width: 100%;
    min-height: calc(var(--moniezi-app-vh, 1vh) * 100);
  }
  .drawer-header {
    padding-left: 1rem;
    padding-right: 1rem;
  }
  .drawer-scroll-area {
    padding-left: 1rem !important;
    padding-right: 1rem !important;
  }
  /* Prevent iOS Safari auto-zoom on input focus (triggers at <16px) */
  input, select, textarea {
    font-size: 16px !important;
  }
  .mobile-billing-line-item {
    flex-direction: column;
    gap: 0.75rem;
  }
  .mobile-billing-line-item-fields {
    width: 100%;
  }
  .mobile-billing-line-item-meta {
    flex-direction: column;
  }
  .mobile-billing-line-item-qty,
  .mobile-billing-line-item-rate,
  .mobile-billing-summary-row .mobile-billing-summary-input {
    width: 100% !important;
  }
  .mobile-billing-line-item-remove {
    align-self: flex-end;
    padding-top: 0;
  }
  .mobile-billing-summary-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
}
`}</style>
      <div
        className="moniezi-app-shell flex flex-col w-full max-w-2xl mx-auto relative bg-slatebg dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-300"
        style={{
          height: 'calc(var(--moniezi-app-vh, 1vh) * 100)',
          minHeight: 'calc(var(--moniezi-app-vh, 1vh) * 100)',
          maxHeight: 'calc(var(--moniezi-app-vh, 1vh) * 100)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
      {((showDeferredInstallCta && deferredInstallPrompt) || showIosInstallCta) && !isRunningStandalone && (() => {
        const iosInstallContext = getIosInstallContext();
        const isIosInstallBanner = showIosInstallCta && iosInstallContext.isIosDevice && !deferredInstallPrompt;
        const bannerCopy = isIosInstallBanner
          ? (iosInstallContext.isSafariLike
              ? 'Add MONIEZI to your iPhone home screen for faster access using Share and Add to Home Screen.'
              : 'Open MONIEZI in Safari to add it to your iPhone home screen, then tap Share and Add to Home Screen.')
          : 'You can install the app now for faster access from your phone home screen.';

        return (
          <div className="absolute left-3 right-3 top-[max(76px,calc(env(safe-area-inset-top,0px)+72px))] z-[70] animate-in slide-in-from-top-2 duration-200">
            <div className={`rounded-[26px] border backdrop-blur-xl overflow-hidden ${theme === 'dark' ? 'border-sky-300/35 bg-gradient-to-br from-slate-800/98 via-slate-800/96 to-blue-950/92 shadow-[0_18px_48px_rgba(2,6,23,0.52)] ring-1 ring-white/8' : 'border-sky-300/65 bg-gradient-to-br from-slate-50/98 via-white/98 to-sky-50/96 shadow-[0_18px_48px_rgba(15,23,42,0.16)] ring-1 ring-sky-200/70'}`}>
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.20),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(125,211,252,0.10),transparent_32%)]" />
              <div className="relative px-4 py-4">
                <div className="flex items-start gap-3.5">
                  <div className={`w-11 h-11 shrink-0 rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] flex items-center justify-center ${theme === 'dark' ? 'bg-gradient-to-br from-sky-500/20 to-blue-600/10 border-sky-300/25' : 'bg-gradient-to-br from-sky-100 to-blue-50 border-sky-200/90 shadow-[0_8px_20px_rgba(59,130,246,0.12)]'}`}>
                    {isIosInstallBanner ? <Share2 size={19} className={theme === 'dark' ? 'text-sky-200' : 'text-sky-500'} /> : <Download size={19} className={theme === 'dark' ? 'text-sky-200' : 'text-sky-500'} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[15px] font-bold leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Install MONIEZI</div>
                    <p className={`text-[13px] leading-6 mt-1 max-w-[38ch] ${theme === 'dark' ? 'text-slate-200/90' : 'text-slate-800'}`}>{bannerCopy}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button onClick={isIosInstallBanner ? openIosInstallHelp : triggerDeferredInstallPrompt} className="min-w-[196px] px-5 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-[15px] font-bold shadow-lg shadow-amber-950/30 transition-colors text-center">Install MONIEZI</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showIosInstallHelp && !isRunningStandalone && (() => {
        const isLight = theme !== 'dark';
        return (
          <div className={`fixed inset-0 z-[110] flex items-end justify-center p-3 sm:p-4 animate-in fade-in duration-200 modal-overlay ${isLight ? 'bg-slate-900/28 backdrop-blur-[3px]' : 'bg-slate-950/92'}`}>
            <div className={`w-full max-w-md rounded-[26px] overflow-hidden ${isLight ? 'border border-sky-300/65 bg-gradient-to-br from-slate-50/98 via-white/98 to-sky-50/96 text-slate-900 shadow-[0_24px_64px_rgba(15,23,42,0.20)] ring-1 ring-sky-200/70' : 'border border-sky-300/18 bg-slate-900 text-white shadow-[0_24px_64px_rgba(2,6,23,0.72)] ring-1 ring-white/6'}`}>
              <div className={`px-4 py-4 border-b flex items-center justify-between gap-3 ${isLight ? 'border-slate-200 bg-transparent' : 'border-white/10 bg-slate-900'}`}>
                <div>
                  <div className={`text-[16px] font-bold leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Install MONIEZI on iPhone</div>
                </div>
                <button onClick={() => setShowIosInstallHelp(false)} className={`p-2 rounded-full transition-colors ${isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-white'}`} aria-label="Close install steps">
                  <X size={18} />
                </button>
              </div>
              <div className={`px-4 py-4 space-y-3 ${isLight ? 'bg-transparent' : 'bg-slate-900'}`}>
                <div className={`rounded-2xl px-3 py-3 ${isLight ? 'border border-slate-200 bg-white/92 shadow-sm' : 'border border-slate-700 bg-slate-800'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${isLight ? 'bg-sky-100 text-sky-700' : 'bg-sky-500/20 text-sky-100'}`}>1</div>
                    <p className={`text-[14px] leading-6 ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>In <span className={`font-semibold ${isLight ? 'text-slate-950' : 'text-white'}`}>Safari</span>, tap the <span className={`font-semibold ${isLight ? 'text-slate-950' : 'text-white'}`}>Share</span> button.</p>
                  </div>
                </div>
                <div className={`rounded-2xl px-3 py-3 ${isLight ? 'border border-slate-200 bg-white/92 shadow-sm' : 'border border-slate-700 bg-slate-800'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${isLight ? 'bg-sky-100 text-sky-700' : 'bg-sky-500/20 text-sky-100'}`}>2</div>
                    <p className={`text-[14px] leading-6 ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>Tap <span className={`font-semibold ${isLight ? 'text-slate-950' : 'text-white'}`}>View More</span> or scroll down to <span className={`font-semibold ${isLight ? 'text-slate-950' : 'text-white'}`}>Add to Home Screen</span>.</p>
                  </div>
                </div>
                <div className={`rounded-2xl px-3 py-3 ${isLight ? 'border border-slate-200 bg-white/92 shadow-sm' : 'border border-slate-700 bg-slate-800'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${isLight ? 'bg-sky-100 text-sky-700' : 'bg-sky-500/20 text-sky-100'}`}>3</div>
                    <p className={`text-[14px] leading-6 ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>Tap <span className={`font-semibold ${isLight ? 'text-slate-950' : 'text-white'}`}>Add to Home Screen</span>, then tap <span className={`font-semibold ${isLight ? 'text-slate-950' : 'text-white'}`}>Add</span>. MONIEZI will appear on your home screen like an app.</p>
                  </div>
                </div>
              </div>
              <div className={`px-4 pt-1 pb-3 ${isLight ? 'bg-transparent' : 'bg-slate-900'}`}>
                <div className={`mb-3 rounded-2xl px-3 py-3 text-[13px] leading-6 ${isLight ? 'border border-amber-300/60 bg-amber-50 text-slate-800' : 'border border-amber-400/20 bg-amber-500/10 text-slate-100'}`}>
                  <span className={`font-semibold ${isLight ? 'text-slate-950' : 'text-white'}`}>Next:</span> After MONIEZI is added to Home Screen, close Safari and open MONIEZI from your Home Screen icon.
                </div>
                <button onClick={() => setShowIosInstallHelp(false)} className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3 text-[15px] font-bold text-white transition-colors">Got it</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Scan Receipt Confirm Modal */}
      {scanPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200 modal-overlay">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-xl p-4 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Receipt size={20} />Save Receipt?</h3>
                    <button onClick={() => setScanPreview(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-hidden rounded-lg bg-black border border-slate-800 relative mb-4">
                    <img src={scanPreview} alt="Receipt Preview" className="w-full h-full object-contain" />
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setScanPreview(null)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Discard</button>
                    <button onClick={saveReceipt} className="flex-1 py-3 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20 transition-colors">Save</button>
                </div>
            </div>
        </div>
      )}

      {/* View Receipt Full Screen Modal */}
      {viewingReceipt && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm px-4 pb-4 animate-in fade-in duration-200 safe-area-top safe-area-bottom modal-overlay"
          style={{
            paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          }}
        >
            <div className="w-full max-w-lg h-full flex flex-col">
                <div className="flex items-center justify-between mb-4 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><Calendar size={18} /></div>
                        <div>
                            <div className="font-bold text-lg">Receipt View</div>
                            <div className="text-xs text-slate-400 flex items-center gap-2">{viewingReceipt.date} <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px]">Exports to Downloads</span></div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => { handleDownloadReceipt(viewingReceipt.id); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><Download size={24} /></button>
                        <button onClick={closeReceipt} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X size={24} /></button>
                    </div>
                </div>
                <div className="flex-1 bg-black rounded-xl overflow-hidden relative border border-white/10 shadow-2xl mb-4 flex items-center justify-center">
                    <img src={receiptPreviewUrls[viewingReceipt.id] || DEMO_ASSET_BY_ID.get(viewingReceipt.id)?.assetUrl || ''} alt="Receipt" className="max-w-full max-h-full object-contain" />
                </div>
                <button onClick={() => deleteReceipt(viewingReceipt.id)} className="w-full py-4 bg-red-600/90 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                    <Trash2 size={20} /> Delete Receipt
                </button>
            </div>
        </div>
      )}

      {isPdfPreviewOpen && selectedInvoiceForDoc && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 modal-overlay">
            <div className="relative w-full max-w-[800px] bg-white text-slate-900 shadow-2xl overflow-y-auto max-h-[90vh] rounded-lg">
                {/* Preview Header with Actions */}
                <div className="sticky top-0 left-0 right-0 bg-white border-b border-gray-200 px-3 sm:px-4 pb-3 sm:pb-4 pt-[calc(0.75rem+env(safe-area-inset-top))] flex justify-between items-center z-50">
                    <button 
                      onClick={() => setIsPdfPreviewOpen(false)} 
                      className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      <ChevronLeft size={18} />
                      <span className="hidden sm:inline">Back to Edit</span>
                    </button>
                    <span className="font-bold text-sm text-gray-900 uppercase tracking-wider">Invoice Preview</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={shareInvoicePDF}
                        disabled={isGeneratingPdf}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-all ${isGeneratingPdf ? 'opacity-70 cursor-wait' : ''}`}
                      >
                        {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                        <span className="hidden sm:inline">{isGeneratingPdf ? 'Preparing...' : 'Share'}</span>
                      </button>

                      <button 
                        onClick={generateInvoicePDF}
                        disabled={isGeneratingPdf}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all ${isGeneratingPdf ? 'opacity-70 cursor-wait' : ''}`}
                      >
                        {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        <span className="hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
                      </button>
                      <button onClick={() => setIsPdfPreviewOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={20} /></button>
                    </div>
                </div>
                {/* PDF Preview Content - Fixed text colors for readability */}
                <div id="visible-pdf-preview-content" className="p-4 sm:p-6 md:p-12 bg-white min-h-[1000px]">
                    {selectedInvoiceForDoc.status === 'void' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"><div className="transform -rotate-45 text-red-100 text-[150px] font-extrabold opacity-50 border-8 border-red-100 p-10 rounded-3xl">VOID</div></div>}
                    <div className={`flex ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'flex-col items-center text-center' : 'flex-col sm:flex-row sm:justify-between items-start'} border-b border-gray-200 pb-8 mb-8 gap-6 z-10 relative`}>
                        <div className={`flex-1 ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'w-full' : ''}`}>
                            {settings.showLogoOnInvoice && settings.businessLogo && <img src={settings.businessLogo} alt="Logo" className={`h-20 w-auto object-contain mb-4 ${settings.logoAlignment === 'center' ? 'mx-auto' : ''}`} />}
                            <h1 className="text-3xl font-extrabold uppercase tracking-tight text-gray-900 mb-2 font-brand">{settings.businessName}</h1>
                            <div className="text-sm text-gray-700 font-medium space-y-1">
                                <p>{settings.ownerName}</p>
                                {(settings.businessEmail || settings.businessPhone) && <p className={`flex flex-wrap gap-3 ${settings.logoAlignment === 'center' ? 'justify-center' : ''}`}>{settings.businessEmail && <span>{settings.businessEmail}</span>}{settings.businessPhone && <span>• {settings.businessPhone}</span>}</p>}
                                {settings.businessAddress && <p className="leading-tight pt-1">{settings.businessAddress}</p>}
                                {settings.businessWebsite && <p className="text-blue-600 pt-1" style={{ color: settings.brandColor }}>{settings.businessWebsite}</p>}
                            </div>
                        </div>
                        <div className={`text-left ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'w-full mt-6 flex flex-col items-center' : 'w-full sm:w-auto text-left sm:text-right flex-1 mt-6 sm:mt-0'}`}>
                            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tighter mb-4 font-brand break-words" style={{ color: settings.brandColor || '#e2e8f0' }}>INVOICE</h2>
                            <div className={`space-y-2 ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'w-full max-w-sm' : ''}`}>
                                <div className="flex justify-between md:justify-end gap-8"><span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Invoice #</span><span className="text-sm font-bold text-gray-900">{selectedInvoiceForDoc.number || selectedInvoiceForDoc.id.substring(selectedInvoiceForDoc.id.length - 6).toUpperCase()}</span></div>
                                <div className="flex justify-between md:justify-end gap-8"><span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Date</span><span className="text-sm font-bold text-gray-900">{selectedInvoiceForDoc.date}</span></div>
                                <div className="flex justify-between md:justify-end gap-8"><span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Due</span><span className="text-sm font-bold text-gray-900">{selectedInvoiceForDoc.due}</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 mb-12 z-10 relative">
                        <div className="flex-1">
                            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Bill To</h3>
                            <div className="text-lg font-bold text-gray-900">{selectedInvoiceForDoc.client}</div>
                            {selectedInvoiceForDoc.clientCompany && selectedInvoiceForDoc.clientCompany !== selectedInvoiceForDoc.client && <div className="text-base font-semibold text-gray-800 mt-0.5">{selectedInvoiceForDoc.clientCompany}</div>}
                            <div className="text-sm text-gray-700 mt-1 space-y-0.5">{selectedInvoiceForDoc.clientEmail && <div>{selectedInvoiceForDoc.clientEmail}</div>}{selectedInvoiceForDoc.clientAddress && <div className="whitespace-pre-line">{selectedInvoiceForDoc.clientAddress}</div>}</div>
                        </div>
                        {(selectedInvoiceForDoc.poNumber || settings.businessTaxId) && (
                            <div className="flex-1 text-right">
                                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Details</h3>
                                {selectedInvoiceForDoc.poNumber && <div className="mb-2"><span className="text-xs font-bold text-gray-600 block">PO Number</span><span className="text-sm font-bold text-gray-900">{selectedInvoiceForDoc.poNumber}</span></div>}
                                {settings.businessTaxId && <div><span className="text-xs font-bold text-gray-600 block">Tax ID / VAT</span><span className="text-sm font-bold text-gray-900">{settings.businessTaxId}</span></div>}
                            </div>
                        )}
                    </div>
                    <div className="mb-8 z-10 relative">
                        {/* Desktop table header */}
                        <div className="hidden sm:grid grid-cols-12 gap-4 border-b-2 pb-3 mb-4" style={{ borderColor: settings.brandColor || '#0f172a' }}>
                            <div className="col-span-6 text-xs font-bold text-gray-900 uppercase tracking-wider">Description</div>
                            <div className="col-span-2 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">Qty</div>
                            <div className="col-span-2 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">Rate</div>
                            <div className="col-span-2 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">Amount</div>
                        </div>

                        <div className="space-y-4">
                            {(selectedInvoiceForDoc.items || []).map((item, idx) => {
                                const qty = Number(item.quantity || 0);
                                const rate = Number(item.rate || 0);
                                const amount = qty * rate;
                                return (
                                  <div key={item.id || idx} className="border-b border-gray-200 pb-3">
                                      {/* Desktop row */}
                                      <div className="hidden sm:grid grid-cols-12 gap-4 items-start">
                                          <div className="col-span-6 min-w-0">
                                              <span className="font-bold text-gray-800 text-sm block break-words">{item.description}</span>
                                          </div>
                                          <div className="col-span-2 text-right text-sm font-semibold text-gray-700 tabular-nums whitespace-nowrap">{qty}</div>
                                          <div className="col-span-2 text-right text-sm font-semibold text-gray-700 tabular-nums whitespace-nowrap">{formatCurrency.format(rate)}</div>
                                          <div className="col-span-2 text-right text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap">{formatCurrency.format(amount)}</div>
                                      </div>

                                      {/* Mobile stacked row (prevents overlap on portrait screens) */}
                                      <div className="sm:hidden">
                                          <div className="font-bold text-gray-800 text-sm break-words">{item.description}</div>
                                          <div className="mt-2 space-y-1">
                                              <div className="flex justify-between text-xs">
                                                  <span className="font-bold text-gray-500 uppercase tracking-wider">Qty</span>
                                                  <span className="font-semibold text-gray-800 tabular-nums whitespace-nowrap">{qty}</span>
                                              </div>
                                              <div className="flex justify-between text-xs">
                                                  <span className="font-bold text-gray-500 uppercase tracking-wider">Rate</span>
                                                  <span className="font-semibold text-gray-800 tabular-nums whitespace-nowrap">{formatCurrency.format(rate)}</span>
                                              </div>
                                              <div className="flex justify-between text-xs">
                                                  <span className="font-bold text-gray-500 uppercase tracking-wider">Amount</span>
                                                  <span className="font-bold text-gray-900 tabular-nums whitespace-nowrap">{formatCurrency.format(amount)}</span>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                                );
                            })}
                        </div>
                    </div>
<div className="flex justify-end mt-4 mb-12 z-10 relative">
                        <div className="w-full sm:w-5/12 space-y-3">
                            <div className="flex justify-between text-sm"><span className="font-bold text-gray-700">Subtotal</span><span className="font-bold text-gray-900">{formatCurrency.format(selectedInvoiceForDoc.subtotal || selectedInvoiceForDoc.amount)}</span></div>
                            {selectedInvoiceForDoc.discount ? (<div className="flex justify-between text-sm text-emerald-600"><span className="font-bold">Discount</span><span className="font-bold">-{formatCurrency.format(selectedInvoiceForDoc.discount)}</span></div>) : null}
                            {selectedInvoiceForDoc.taxRate ? (<div className="flex justify-between text-sm"><span className="font-bold text-gray-700">Tax ({selectedInvoiceForDoc.taxRate}%)</span><span className="font-bold text-gray-900">{formatCurrency.format(((selectedInvoiceForDoc.subtotal || 0) - (selectedInvoiceForDoc.discount || 0)) * (selectedInvoiceForDoc.taxRate / 100))}</span></div>) : null}
                            {selectedInvoiceForDoc.shipping ? (<div className="flex justify-between text-sm"><span className="font-bold text-gray-700">Shipping</span><span className="font-bold text-gray-900">{formatCurrency.format(selectedInvoiceForDoc.shipping)}</span></div>) : null}
                            <div className="h-px bg-gray-900 my-2"></div>
                            <div className="flex justify-between items-end"><span className="font-extrabold text-base text-gray-900 uppercase tracking-wider">Total</span><span className="font-extrabold text-xl text-gray-900">{formatCurrency.format(selectedInvoiceForDoc.amount)}</span></div>
                            {selectedInvoiceForDoc.status === 'paid' && <div className="flex justify-between items-center text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded mt-2"><span className="font-bold text-sm uppercase">Amount Paid</span><span className="font-bold">{formatCurrency.format(selectedInvoiceForDoc.amount)}</span></div>}
                        </div>
                    </div>
                    <div className="mt-auto z-10 relative">
                        <div className="grid grid-cols-2 gap-8 border-t border-gray-200 pt-8">
                            <div>{selectedInvoiceForDoc.notes && (<><h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Notes</h4><p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedInvoiceForDoc.notes}</p></>)}</div>
                            <div>{(selectedInvoiceForDoc.terms || settings.payPrefs.length > 0) && (<><h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Terms & Payment</h4>{selectedInvoiceForDoc.terms && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">{selectedInvoiceForDoc.terms}</p>}{settings.payPrefs.length > 0 && (<div className="text-xs font-bold text-gray-700 bg-gray-100 p-3 rounded inline-block w-full">Accepted Methods: {settings.payPrefs.join(', ')}</div>)}</>)}</div>
                        </div>
                        <div className="mt-12 text-center text-xs text-gray-500 font-bold uppercase tracking-widest">Thank you for your business</div>
                    </div>
                </div>
            </div>
        </div>

      )}

      {isEstimatePdfPreviewOpen && selectedEstimateForDoc && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 modal-overlay">
            <div className="relative w-full max-w-[800px] bg-white text-slate-900 shadow-2xl overflow-y-auto max-h-[90vh] rounded-lg">
                {/* Preview Header with Actions */}
                <div className="sticky top-0 left-0 right-0 bg-white border-b border-gray-200 px-3 sm:px-4 pb-3 sm:pb-4 pt-[calc(0.75rem+env(safe-area-inset-top))] flex justify-between items-center z-50">
                    <button 
                      onClick={() => setIsEstimatePdfPreviewOpen(false)} 
                      className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      <ChevronLeft size={18} />
                      <span className="hidden sm:inline">Back to Edit</span>
                    </button>
                    <span className="font-bold text-sm text-gray-900 uppercase tracking-wider">Estimate Preview</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={shareEstimatePDF}
                        disabled={isGeneratingEstimatePdf}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-all ${isGeneratingEstimatePdf ? 'opacity-70 cursor-wait' : ''}`}
                      >
                        {isGeneratingEstimatePdf ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                        <span className="hidden sm:inline">{isGeneratingEstimatePdf ? 'Preparing...' : 'Share'}</span>
                      </button>

                      <button 
                        onClick={generateEstimatePDF}
                        disabled={isGeneratingEstimatePdf}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all ${isGeneratingEstimatePdf ? 'opacity-70 cursor-wait' : ''}`}
                      >
                        {isGeneratingEstimatePdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        <span className="hidden sm:inline">{isGeneratingEstimatePdf ? 'Generating...' : 'Download PDF'}</span>
                      </button>
                      <button onClick={() => setIsEstimatePdfPreviewOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={20} /></button>
                    </div>
                </div>
                {/* PDF Preview Content - Fixed text colors for readability */}
                <div id="visible-estimate-pdf-preview-content" className="p-4 sm:p-6 md:p-12 bg-white min-h-[1000px]">
                    {selectedEstimateForDoc.status === 'void' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"><div className="transform -rotate-45 text-red-100 text-[150px] font-extrabold opacity-50 border-8 border-red-100 p-10 rounded-3xl">VOID</div></div>}
                    
                    {/* Header with Business Info */}
                    <div className={`flex ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'flex-col items-center text-center' : 'flex-col sm:flex-row sm:justify-between items-start'} border-b border-gray-200 pb-8 mb-8 gap-6 z-10 relative`}>
                        <div className={`flex-1 ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'w-full' : ''}`}>
                            {settings.showLogoOnInvoice && settings.businessLogo && <img src={settings.businessLogo} alt="Logo" className={`h-20 w-auto object-contain mb-4 ${settings.logoAlignment === 'center' ? 'mx-auto' : ''}`} />}
                            <h1 className="text-3xl font-extrabold uppercase tracking-tight text-gray-900 mb-2 font-brand">{settings.businessName}</h1>
                            <div className="text-sm text-gray-700 font-medium space-y-1">
                                <p>{settings.ownerName}</p>
                                {(settings.businessEmail || settings.businessPhone) && <p className={`flex flex-wrap gap-3 ${settings.logoAlignment === 'center' ? 'justify-center' : ''}`}>{settings.businessEmail && <span>{settings.businessEmail}</span>}{settings.businessPhone && <span>• {settings.businessPhone}</span>}</p>}
                                {settings.businessAddress && <p className="leading-tight pt-1">{settings.businessAddress}</p>}
                                {settings.businessWebsite && <p className="text-blue-600 pt-1" style={{ color: settings.brandColor }}>{settings.businessWebsite}</p>}
                            </div>
                        </div>
                        <div className={`text-left ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'w-full mt-6 flex flex-col items-center' : 'w-full sm:w-auto text-left sm:text-right flex-1 mt-6 sm:mt-0'}`}>
                            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tighter mb-4 font-brand break-words" style={{ color: settings.brandColor || '#e2e8f0' }}>ESTIMATE</h2>
                            <div className={`space-y-2 ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'w-full max-w-sm' : ''}`}>
                                <div className="flex justify-between md:justify-end gap-8"><span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Estimate #</span><span className="text-sm font-bold text-gray-900">{selectedEstimateForDoc.number || selectedEstimateForDoc.id.substring(selectedEstimateForDoc.id.length - 6).toUpperCase()}</span></div>
                                <div className="flex justify-between md:justify-end gap-8"><span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Date</span><span className="text-sm font-bold text-gray-900">{selectedEstimateForDoc.date}</span></div>
                                <div className="flex justify-between md:justify-end gap-8"><span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Valid Until</span><span className="text-sm font-bold text-gray-900">{selectedEstimateForDoc.validUntil || ''}</span></div>
                                {(selectedEstimateForDoc as any).timeline && <div className="flex justify-between md:justify-end gap-8"><span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Timeline</span><span className="text-sm font-bold text-gray-900">{(selectedEstimateForDoc as any).timeline}</span></div>}
                            </div>
                        </div>
                    </div>

                    {/* Project Title */}
                    {(selectedEstimateForDoc as any).projectTitle && (
                      <div className="mb-8 z-10 relative">
                        <div className="bg-gray-50 rounded-lg p-6 border-l-4" style={{ borderColor: settings.brandColor || '#3b82f6' }}>
                          <h3 className="text-2xl font-bold text-gray-900 mb-1">{(selectedEstimateForDoc as any).projectTitle}</h3>
                          {selectedEstimateForDoc.description && <p className="text-gray-700">{selectedEstimateForDoc.description}</p>}
                        </div>
                      </div>
                    )}

                    {/* Client Info */}
                    <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 mb-8 z-10 relative">
                        <div className="flex-1">
                            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Prepared For</h3>
                            <div className="text-lg font-bold text-gray-900">{selectedEstimateForDoc.client}</div>
                            {selectedEstimateForDoc.clientCompany && selectedEstimateForDoc.clientCompany !== selectedEstimateForDoc.client && <div className="text-base font-semibold text-gray-800 mt-0.5">{selectedEstimateForDoc.clientCompany}</div>}
                            <div className="text-sm text-gray-700 mt-1 space-y-0.5">
                              {selectedEstimateForDoc.clientEmail && <div>{selectedEstimateForDoc.clientEmail}</div>}
                              {(selectedEstimateForDoc as any).clientPhone && <div>{(selectedEstimateForDoc as any).clientPhone}</div>}
                              {selectedEstimateForDoc.clientAddress && <div className="whitespace-pre-line">{selectedEstimateForDoc.clientAddress}</div>}
                            </div>
                        </div>
                        {(selectedEstimateForDoc.poNumber || settings.businessTaxId) && (
                            <div className="flex-1 text-right">
                                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Reference</h3>
                                {selectedEstimateForDoc.poNumber && <div className="mb-2"><span className="text-xs font-bold text-gray-600 block">Client Ref / PO</span><span className="text-sm font-bold text-gray-900">{selectedEstimateForDoc.poNumber}</span></div>}
                                {settings.businessTaxId && <div><span className="text-xs font-bold text-gray-600 block">Tax ID / VAT</span><span className="text-sm font-bold text-gray-900">{settings.businessTaxId}</span></div>}
                            </div>
                        )}
                    </div>

                    {/* Scope of Work */}
                    {(selectedEstimateForDoc as any).scopeOfWork && (
                      <div className="mb-8 z-10 relative">
                        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Scope of Work</h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{(selectedEstimateForDoc as any).scopeOfWork}</p>
                        </div>
                      </div>
                    )}

                    {/* Line Items Table */}
                    <div className="mb-8 z-10 relative">
                        {/* Desktop table header */}
                        <div className="hidden sm:grid grid-cols-12 gap-4 border-b-2 pb-3 mb-4" style={{ borderColor: settings.brandColor || '#0f172a' }}>
                            <div className="col-span-6 text-xs font-bold text-gray-900 uppercase tracking-wider">Description</div>
                            <div className="col-span-2 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">Qty</div>
                            <div className="col-span-2 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">Rate</div>
                            <div className="col-span-2 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">Amount</div>
                        </div>

                        <div className="space-y-4">
                            {(selectedEstimateForDoc.items || []).map((item, idx) => {
                                const qty = Number(item.quantity || 0);
                                const rate = Number(item.rate || 0);
                                const amount = qty * rate;
                                return (
                                  <div key={item.id || idx} className="border-b border-gray-200 pb-3">
                                      {/* Desktop row */}
                                      <div className="hidden sm:grid grid-cols-12 gap-4 items-start">
                                          <div className="col-span-6 min-w-0">
                                              <span className="font-bold text-gray-800 text-sm block break-words">{item.description}</span>
                                          </div>
                                          <div className="col-span-2 text-right text-sm font-semibold text-gray-700 tabular-nums whitespace-nowrap">{qty}</div>
                                          <div className="col-span-2 text-right text-sm font-semibold text-gray-700 tabular-nums whitespace-nowrap">{formatCurrency.format(rate)}</div>
                                          <div className="col-span-2 text-right text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap">{formatCurrency.format(amount)}</div>
                                      </div>

                                      {/* Mobile stacked row */}
                                      <div className="sm:hidden">
                                          <div className="font-bold text-gray-800 text-sm break-words">{item.description}</div>
                                          <div className="mt-2 space-y-1">
                                              <div className="flex justify-between text-xs">
                                                  <span className="font-bold text-gray-500 uppercase tracking-wider">Qty</span>
                                                  <span className="font-semibold text-gray-800 tabular-nums whitespace-nowrap">{qty}</span>
                                              </div>
                                              <div className="flex justify-between text-xs">
                                                  <span className="font-bold text-gray-500 uppercase tracking-wider">Rate</span>
                                                  <span className="font-semibold text-gray-800 tabular-nums whitespace-nowrap">{formatCurrency.format(rate)}</span>
                                              </div>
                                              <div className="flex justify-between text-xs">
                                                  <span className="font-bold text-gray-500 uppercase tracking-wider">Amount</span>
                                                  <span className="font-bold text-gray-900 tabular-nums whitespace-nowrap">{formatCurrency.format(amount)}</span>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                                );
                            })}
                        </div>
                    </div>
<div className="flex justify-end mt-4 mb-8 z-10 relative">
                        <div className="w-full sm:w-5/12 space-y-3">
                            <div className="flex justify-between text-sm"><span className="font-bold text-gray-700">Subtotal</span><span className="font-bold text-gray-900">{formatCurrency.format(((estimateDocTotals?.subtotal ?? selectedEstimateForDoc.subtotal ?? selectedEstimateForDoc.amount) || 0))}</span></div>
                            {selectedEstimateForDoc.discount ? (<div className="flex justify-between text-sm text-emerald-600"><span className="font-bold">Discount</span><span className="font-bold">-{formatCurrency.format(selectedEstimateForDoc.discount)}</span></div>) : null}
                            {selectedEstimateForDoc.taxRate ? (<div className="flex justify-between text-sm"><span className="font-bold text-gray-700">Tax ({selectedEstimateForDoc.taxRate}%)</span><span className="font-bold text-gray-900">{formatCurrency.format(((estimateDocTotals?.tax ?? 0)))}</span></div>) : null}
                            <div className="h-px bg-gray-900 my-2"></div>
                            <div className="flex justify-between items-end"><span className="font-extrabold text-base text-gray-900 uppercase tracking-wider">Estimated Total</span><span className="font-extrabold text-xl text-gray-900">{formatCurrency.format(((estimateDocTotals?.total ?? selectedEstimateForDoc.amount) || 0))}</span></div>
                        </div>
                    </div>

                    {/* Exclusions */}
                    {(selectedEstimateForDoc as any).exclusions && (
                      <div className="mb-8 z-10 relative" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Not Included in This Estimate</h4>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">{(selectedEstimateForDoc as any).exclusions}</p>
                        </div>
                      </div>
                    )}

                    {/* Notes, Terms, and Acceptance */}
                    <div className="mt-auto z-10 relative" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-200 pt-8">
                            <div>
                              {selectedEstimateForDoc.notes && (
                                <>
                                  <h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Notes</h4>
                                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedEstimateForDoc.notes}</p>
                                </>
                              )}
                            </div>
                            <div>
                              {selectedEstimateForDoc.terms && (
                                <>
                                  <h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Terms & Conditions</h4>
                                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">{selectedEstimateForDoc.terms}</p>
                                </>
                              )}
                            </div>
                        </div>

                        {/* How to Accept */}
                        {(selectedEstimateForDoc as any).acceptanceTerms && (
                          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6 text-center" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider mb-2">How to Accept This Estimate</h4>
                            <p className="text-blue-800">{(selectedEstimateForDoc as any).acceptanceTerms}</p>
                          </div>
                        )}

                        {/* Signature Line (optional for printed versions) */}
                        <div className="mt-12 pt-8 border-t border-gray-300" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          <div className="grid grid-cols-2 gap-12">
                            <div>
                              <div className="border-b border-gray-400 pb-8 mb-2"></div>
                              <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">Client Signature</p>
                            </div>
                            <div>
                              <div className="border-b border-gray-400 pb-8 mb-2"></div>
                              <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">Date</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-12 text-center text-xs text-gray-500 font-bold uppercase tracking-widest">Thank you for considering our services</div>
                    </div>
                </div>
            </div>
        </div>
      )}

      <ToastContainer notifications={notifications} remove={removeToast} />


      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 modal-overlay">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-xl p-6 shadow-2xl border border-red-500/20">
                <div className="flex items-center gap-4 mb-4 text-red-600 dark:text-red-500">
                   <div className="bg-red-100 dark:bg-red-500/10 p-3 rounded-full"><AlertTriangle size={24} strokeWidth={2} /></div>
                   <h3 className="text-lg sm:text-xl font-bold">System Reset</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">Are you sure you want to delete <span className="text-slate-900 dark:text-white font-bold">all transactions and invoices</span>? This action cannot be undone.</p>
                <div className="flex gap-3">
                   <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                   <button onClick={performReset} className="flex-1 py-3 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-lg shadow-red-500/20 transition-colors">Yes, Delete All</button>
                </div>
            </div>
        </div>
      )}

      {/* NEW: Delete Invoice Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 modal-overlay">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4 text-slate-900 dark:text-white">
                    <div className="bg-red-100 dark:bg-red-500/10 p-3 rounded-full text-red-600 dark:text-red-500">
                        <Trash2 size={20} strokeWidth={2} />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold">Delete invoice?</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">This will permanently delete this invoice and cannot be undone.</p>
                <div className="flex gap-3">
                   <button onClick={() => setInvoiceToDelete(null)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                   <button onClick={confirmDeleteInvoice} className="flex-1 py-3 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-lg shadow-red-500/20 transition-colors">Delete</button>
                </div>
            </div>
        </div>
      )}

      {/* NEW: Restore Backup Confirmation Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 modal-overlay">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-xl p-6 shadow-2xl border border-blue-500/20">
                <div className="flex items-center gap-4 mb-4 text-blue-600 dark:text-blue-400">
                    <div className="bg-blue-100 dark:bg-blue-500/10 p-3 rounded-full"><RotateCcw size={24} strokeWidth={2} /></div>
                    <h3 className="text-lg sm:text-xl font-bold">Restore Backup?</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">
                    This will <span className="text-slate-900 dark:text-white font-bold">replace all current data</span> with the backup from <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{pendingBackupData?.metadata?.timestamp?.split('T')[0] || 'Unknown Date'}</span>.
                </p>
                <div className="flex gap-3">
                    <button onClick={() => { setShowRestoreModal(false); setPendingBackupData(null); }} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                    <button onClick={performRestore} className="flex-1 py-3 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20 transition-colors">Restore Data</button>
                </div>
            </div>
        </div>
      )}

      <header 
        className={`dark-chrome no-print flex items-center justify-between px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 sticky top-0 backdrop-blur-xl z-50 transition-colors duration-300 ${isKeyboardEditing ? 'opacity-0 pointer-events-none' : 'opacity-100'} ${useDarkChrome ? 'bg-slate-950 border-b border-slate-800' : 'bg-slatebg/90 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800'}`}
        style={{ paddingTop: 'max(1rem, calc(env(safe-area-inset-top, 0px) + var(--moniezi-ios-top-pad, 0px)))' }}
      >
        <Logo onClick={() => setCurrentPage(Page.Dashboard)} onDarkSurface={useDarkChrome} />
        <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
           <button onClick={toggleTheme} className="chrome-btn w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition-all border text-slate-200 hover:text-white" style={headerActionButtonStyle}>{theme === 'dark' ? <Sun size={18} className="sm:w-5 sm:h-5" strokeWidth={1.2} /> : <Moon size={18} className="sm:w-5 sm:h-5" strokeWidth={1.2} />}</button>
           <button
             onClick={() => setShowInsights(true)}
             className="chrome-btn relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition-all border text-slate-200 hover:text-white"
             style={headerActionButtonStyle}
             title="Insights"
           >
             <BrainCircuit size={18} className="sm:w-5 sm:h-5" strokeWidth={1.2} />
             {insightsBadgeCount > 0 && (
               <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-purple-600 text-white text-[10px] sm:text-xs font-bold rounded-full flex items-center justify-center">
                 {Math.min(9, insightsBadgeCount)}
               </span>
             )}
           </button>
           <button onClick={() => setCurrentPage(Page.Settings)} className="chrome-btn w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition-all border text-slate-200 hover:text-white" style={headerActionButtonStyle}><Settings size={18} className="sm:w-5 sm:h-5" strokeWidth={1.2} /></button>
        </div>
      </header>

      <div key={`main-scroll-${currentPage}`} ref={mainScrollRef} className="main-scroll-lock flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 md:px-8 pt-5 sm:pt-6 md:pt-7 no-print custom-scrollbar" style={{ paddingBottom: isKeyboardEditing ? 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' : 'calc(11rem + env(safe-area-inset-bottom, 0px))' }} role="main">

      <PageErrorBoundary key={currentPage} onReset={() => setCurrentPage(Page.Dashboard)}>

        {(currentPage === Page.Dashboard) && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between pl-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-2 sm:p-2.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 flex-shrink-0">
                  <LayoutGrid size={20} className="sm:w-6 sm:h-6" strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white font-brand">Overview</h2>
              </div>
              <button onClick={handleOpenQuickAdd} className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-500 transition-all flex-shrink-0" aria-label="Add new record"><Plus size={20} className="sm:w-6 sm:h-6" strokeWidth={2.5} /></button>
            </div>

            <div className="bg-white dark:bg-gradient-to-br dark:from-blue-800 dark:to-indigo-950 p-6 sm:p-8 rounded-xl shadow-xl dark:shadow-none border border-slate-200 dark:border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-80 h-80 bg-slate-100/50 dark:bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-slate-200/50 transition-colors duration-700 pointer-events-none" />

              <div className="flex flex-col gap-4 mb-4">
                {/* Header - Larger Typography */}
                <div className="relative z-10">
                  <h2 className="text-base sm:text-lg font-extrabold tracking-wide uppercase font-brand mb-1" style={{ color: 'var(--text-primary)' }}>
                    Net Profit <span className="text-blue-600 dark:text-blue-300">({homeTotals.label})</span>
                  </h2>
                  <p className="text-sm sm:text-base font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>{homeTotals.rangeText}</p>
                </div>

                {/* Redesigned Period Selector - User Friendly */}
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 bg-slate-100/80 dark:bg-white/10 p-1.5 sm:p-2 rounded-2xl border border-slate-200/70 dark:border-white/10 shadow-sm">
                  {(['ytd', 'mtd', '30d', 'all'] as HomeKpiPeriod[]).map(p => {
                    const isActive = homeKpiPeriod === p;
                    const labels: Record<HomeKpiPeriod, { short: string; full: string }> = {
                      'ytd': { short: 'Year', full: 'This Year' },
                      'mtd': { short: 'Month', full: 'This Month' },
                      '30d': { short: '30 Days', full: '30 Days' },
                      'all': { short: 'All', full: 'All Time' }
                    };
                    return (
                      <button
                        key={p}
                        onClick={() => setHomeKpiPeriod(p)}
                        className={`relative flex flex-col items-center justify-center min-h-[48px] sm:min-h-[52px] px-2 py-2 rounded-xl transition-all duration-200 ${
                          isActive 
                            ? 'bg-white dark:bg-slate-900/90 shadow-lg shadow-blue-500/10 dark:shadow-black/30 ring-1 ring-blue-500/20 dark:ring-white/20' 
                            : 'hover:bg-white/50 dark:hover:bg-white/5 active:scale-95'
                        }`}
                      >
                        <span 
                          className={`text-[13px] sm:text-sm font-bold leading-tight text-center transition-colors ${
                            isActive 
                              ? 'text-blue-600 dark:text-white' 
                              : ''
                          }`}
                          style={{ 
                            fontVariantNumeric: 'tabular-nums',
                            color: isActive ? undefined : 'var(--tab-inactive)'
                          }}
                        >
                          {labels[p].short}
                        </span>
                        {isActive && (
                          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-1 bg-blue-500 dark:bg-blue-400 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-4xl font-extrabold tracking-tighter mb-6 text-slate-950 dark:text-white font-brand">{formatCurrency.format(homeTotals.profit)}</div>

              <div className="grid grid-cols-1 gap-2">
                <div className="bg-slate-50 dark:bg-white/10 backdrop-blur-md px-4 py-3 rounded-lg border border-slate-200 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300"><TrendingUp size={18} strokeWidth={2.5} /><span className="text-sm font-bold uppercase tracking-wide">In</span></div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency.format(homeTotals.income)}</div>
                </div>
                <div className="bg-slate-50 dark:bg-white/10 backdrop-blur-md px-4 py-3 rounded-lg border border-slate-200 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-300"><TrendingDown size={18} strokeWidth={2.5} /><span className="text-sm font-bold uppercase tracking-wide">Out</span></div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency.format(homeTotals.expense)}</div>
                </div>
              </div>
            </div>

            <div
                className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-lg rounded-3xl p-6 relative overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all"
                onClick={() => {
                  const mode = totals.overdueCount > 0 ? 'overdue' : totals.pendingCount > 0 ? 'unpaid' : 'all';
                  setInvoiceQuickFilter(mode);
                  setCurrentPage(Page.Invoices);
                }}
              >
                <div className="text-center">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                      totals.overdueCount > 0
                        ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300'
                        : totals.pendingCount > 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    }`}
                  >
                    {totals.overdueCount > 0 ? <AlertTriangle size={24} /> : totals.pendingCount > 0 ? <Clock3 size={24} /> : <CheckCircle size={24} />}
                  </div>

                  <div
                    className={`text-4xl font-extrabold tracking-tight mb-2 ${
                      totals.overdueCount > 0
                        ? 'text-red-600 dark:text-red-300'
                        : totals.pendingCount > 0
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {formatCurrency.format(totals.overdueCount > 0 ? totals.overdueAmount : totals.pendingAmount)}
                  </div>

                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {totals.overdueCount > 0 ? 'Overdue Invoices' : totals.pendingCount > 0 ? 'Unpaid Invoices' : 'All invoices paid'}
                  </div>

                  <div
                    className={`inline-flex mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      totals.overdueCount > 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                        : totals.pendingCount > 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    }`}
                  >
                    {totals.overdueCount > 0 ? `${totals.overdueCount} overdue` : totals.pendingCount > 0 ? `${totals.pendingCount} unpaid` : 'Great job'}
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-3">Tap to open invoices</div>
                </div>
              </div>

            {/* Sales Pipeline Widget */}
            {(pipelineStats.totalEstimates > 0 || pipelineStats.pipelineValue > 0) && (
              <div
                className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-lg rounded-3xl p-6 relative overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all"
                onClick={() => {
                  setBillingDocType('estimate');
                  setCurrentPage(Page.Invoices);
                }}
              >
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 dark:bg-purple-400/10 rounded-full blur-2xl pointer-events-none" />
                
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Briefcase size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Sales Pipeline</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300">Estimates & Proposals</p>
                    </div>
                  </div>
                  {pipelineStats.conversionRate > 0 && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{pipelineStats.conversionRate.toFixed(0)}%</div>
                      <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Win Rate</div>
                    </div>
                  )}
                </div>

                {/* Pipeline Value */}
                {pipelineStats.pipelineValue > 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 mb-5 border border-purple-100 dark:border-purple-800/30">
                    <div className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">Pipeline Value</div>
                    <div className="text-3xl font-extrabold text-slate-900 dark:text-white">{formatCurrency.format(pipelineStats.pipelineValue)}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {pipelineStats.draft.count} draft{pipelineStats.draft.count !== 1 ? 's' : ''} + {pipelineStats.sent.count} awaiting response
                    </div>
                  </div>
                )}

                {/* Stage Breakdown */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-lg font-bold text-slate-600 dark:text-slate-300">{pipelineStats.draft.count}</div>
                    <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Draft</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{pipelineStats.sent.count}</div>
                    <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Sent</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{pipelineStats.accepted.count}</div>
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Won</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <div className="text-lg font-bold text-red-500 dark:text-red-400">{pipelineStats.declined.count}</div>
                    <div className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wider">Lost</div>
                  </div>
                </div>

                {/* Follow-up Alerts - Detailed */}
                {pipelineStats.needsFollowUp > 0 && (
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider">
                      <Clock3 size={14} />
                      Follow-ups Due ({pipelineStats.needsFollowUp})
                    </div>
                    {pipelineStats.overdueFollowUps.slice(0, 3).map((est: Estimate) => (
                      <div 
                        key={est.id} 
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBillingDocType('estimate');
                          setCurrentPage(Page.Invoices);
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-orange-900 dark:text-orange-200">{est.client}</div>
                          <div className="text-xs text-orange-700 dark:text-orange-400 leading-relaxed">
                            <span>{formatCurrency.format(est.amount)}</span>
                            <span> • Due</span>
                            <br />
                            <span>{est.followUpDate || 'now'}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); recordFollowUp(est, 7); }}
                            className="px-3 py-2 rounded-md text-xs font-bold bg-white dark:bg-slate-800 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-slate-700 transition-all border border-orange-200/50 dark:border-orange-800/50"
                            title="Record follow-up, set next in 7 days"
                          >
                            Done
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); snoozeFollowUp(est, 3); }}
                            className="px-3 py-2 rounded-md text-xs font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-200/50 dark:border-slate-700/50"
                            title="Snooze 3 days"
                          >
                            +3d
                          </button>
                        </div>
                      </div>
                    ))}
                    {pipelineStats.needsFollowUp > 3 && (
                      <div className="text-xs text-center text-orange-600 dark:text-orange-400 font-medium">
                        +{pipelineStats.needsFollowUp - 3} more needing attention
                      </div>
                    )}
                  </div>
                )}

                {/* Upcoming Follow-ups */}
                {pipelineStats.upcomingFollowUps.length > 0 && pipelineStats.needsFollowUp === 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 mb-4">
                    <Calendar size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-blue-800 dark:text-blue-300">
                        {pipelineStats.upcomingFollowUps.length} follow-up{pipelineStats.upcomingFollowUps.length !== 1 ? 's' : ''} coming up
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">In the next 3 days</div>
                    </div>
                  </div>
                )}

                {/* Won Revenue */}
                {pipelineStats.accepted.amount > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Revenue Won (All Time)</div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency.format(pipelineStats.accepted.amount)}</div>
                  </div>
                )}

                <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-4 text-center">Tap to view estimates</div>
              </div>
            )}
            
            <div>
              <div className="flex items-center justify-between mb-4 pl-2">
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest font-brand">Recent Activity</h3>
                <button onClick={() => setCurrentPage(Page.AllTransactions)} className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors uppercase">See all</button>
              </div>
              <div className="space-y-3">
                {transactions.length === 0 ? <EmptyState icon={<Sparkles size={24} />} title="No activity yet" subtitle="Your latest transactions will appear here once you start recording." action={handleOpenQuickAdd} actionLabel="Add Transaction" /> :
                  transactions.slice().sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map(t => (
                    <div key={t.id} className="group flex items-center justify-between p-5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 hover:shadow-lg transition-all cursor-pointer shadow-sm relative z-10" onClick={() => handleEditItem(t)}>
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>{t.type === 'income' ? <ArrowRight size={18} className="-rotate-45" strokeWidth={2.5} /> : <ArrowRight size={18} className="rotate-45" strokeWidth={2.5} />}</div>
                        <div className="min-w-0 pr-2">
                          <div className="text-base font-bold text-slate-900 dark:text-white truncate">{t.name}</div>
                          <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5 truncate">{t.category}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                         <div className={`text-base font-bold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : ''}{formatCurrency.format(t.amount)}</div>
                         <div className="text-left md:text-right mt-1"><div className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.date}</div></div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

            <div onClick={() => { setScrollToTaxSnapshot(true); setCurrentPage(Page.Reports); }} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 cursor-pointer active:scale-95 transition-all hover:shadow-lg hover:border-emerald-500/30 group">
               <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400"><Calculator size={20} /><span className="text-xs font-bold uppercase tracking-widest font-brand">Tax Snapshot</span></div>
                  <ArrowRight size={18} className="text-slate-300 dark:text-slate-300 -rotate-45 group-hover:rotate-0 group-hover:text-emerald-500 transition-all duration-300"/>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <div><div className="text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold mb-1">Estimated Tax (YTD)</div><div className="text-2xl font-extrabold font-brand text-slate-900 dark:text-white">{formatCurrency.format(reportData.totalEstimatedTax)}</div></div>
                  <div><div className="text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold mb-1">YTD Net Profit</div><div className="text-2xl font-bold text-slate-600 dark:text-slate-200">{formatCurrency.format(reportData.ytdNetProfit)}</div></div>
               </div>
               <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">Next Deadline: <span className="text-emerald-600 dark:text-emerald-400">{getNextEstimatedTaxDeadline().date}</span> — {getNextEstimatedTaxDeadline().days} days left</div>
                  <div onClick={(e) => { e.stopPropagation(); setCurrentPage(Page.Reports); setTimeout(() => { setScrollToTaxSnapshot(true); handleOpenTaxDrawer(); }, 100); }} className="text-xs font-bold text-blue-500 hover:underline uppercase tracking-wider cursor-pointer">Log Payment</div>
               </div>
            </div>

            {/* Scan Receipt Section */}
            <div>
              <div className="flex items-center justify-between mb-4 pl-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-200 uppercase tracking-[0.10em] font-brand">Receipts</h3>
              </div>
              <div className="flex overflow-x-auto gap-3 pb-4 pt-1 px-1 -mx-1 custom-scrollbar snap-x">
                <button onClick={() => { setScanMode('receiptOnly'); scanInputRef.current?.click(); }} className="flex-shrink-0 w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors border border-dashed border-slate-400 dark:border-slate-600 active:scale-95 snap-start">
                   <div className="bg-white dark:bg-slate-900 p-2.5 rounded-full shadow-sm text-slate-900 dark:text-white">
                     <Camera size={20} />
                   </div>
                   <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Scan</span>
                </button>
                {/*
                  EXPENSE shortcut:
                  Previously this launched the camera/receipt scan flow ("expenseWithReceipt").
                  Per UX request, tapping Expense should open the Add Expense form first,
                  where the user can optionally link/scan a receipt from within the form.
                */}
                <button onClick={() => { handleOpenFAB('expense'); }} className="flex-shrink-0 w-24 h-24 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 transition-colors border border-emerald-200 dark:border-emerald-700/40 active:scale-95 snap-start">
                   <div className="bg-white dark:bg-slate-900 p-2.5 rounded-full shadow-sm text-emerald-700 dark:text-emerald-300">
                     <PlusCircle size={20} />
                   </div>
                   <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Expense</span>
                </button>
                {receipts.map(r => (
                   <div key={r.id} onClick={() => {
                      const linkedTx = (transactions as any[]).find(t => t && t.type === "expense" && t.receiptId === r.id);
                      if (linkedTx) { handleEditItem(linkedTx); return; }
                      openReceipt(r);
                    }} className="flex-shrink-0 w-24 h-24 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative cursor-pointer shadow-sm group active:scale-95 transition-transform snap-start">
                      <img src={receiptPreviewUrls[r.id] || DEMO_ASSET_BY_ID.get(r.id)?.assetUrl || ''} className="w-full h-full object-cover" />
                      {r.note ? (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                          <div className="text-[9px] font-extrabold uppercase tracking-widest text-white truncate">{r.note}</div>
                        </div>
                      ) : null}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="text-white drop-shadow-md" size={20} />
                      </div>
                   </div>
                ))}
              </div>
              <div className="text-[10px] text-slate-400 font-medium text-center mt-2 uppercase tracking-wide">Exports to Downloads</div>
            </div>
          </div>
        )}

        {(currentPage === Page.Income || currentPage === Page.Expenses || (currentPage === Page.AllTransactions || currentPage === Page.Ledger)) && (
           <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
             <div className="flex items-center justify-between mb-2 pl-2">
                 <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                     <div className="flex items-center gap-2 sm:gap-3">
                       <div className={`p-2 sm:p-2.5 rounded-lg flex-shrink-0 ${currentPage === Page.Income ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : currentPage === Page.Expenses ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-500' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'}`}>{currentPage === Page.Income ? <TrendingUp size={20} className="sm:w-6 sm:h-6" strokeWidth={1.5}/> : currentPage === Page.Expenses ? <TrendingDown size={20} className="sm:w-6 sm:h-6" strokeWidth={1.5}/> : <History size={20} className="sm:w-6 sm:h-6" strokeWidth={1.5} />}</div>
                       <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white font-brand">{currentPage === Page.Income ? 'Income' : currentPage === Page.Expenses ? 'Expenses' : 'Transactions'}</h2>
                     </div>
                 </div>
                 {(currentPage === Page.Income || currentPage === Page.Expenses || (currentPage === Page.AllTransactions || currentPage === Page.Ledger)) && (
                    <button onClick={handleContextualHeaderAdd} className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-500 transition-all flex-shrink-0"><Plus size={20} className="sm:w-6 sm:h-6" strokeWidth={2.5} /></button>
                 )}
             </div>

             <PeriodSelector period={filterPeriod} setPeriod={setFilterPeriod} refDate={referenceDate} setRefDate={setReferenceDate} />

             {(currentPage === Page.Expenses || currentPage === Page.AllTransactions || currentPage === Page.Ledger) && (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div className="flex flex-wrap gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                   <div className="w-full text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Receipts</div>
                   <button onClick={() => setExpenseReceiptFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${expenseReceiptFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>All</button>
                   <button onClick={() => setExpenseReceiptFilter('with_receipts')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${expenseReceiptFilter === 'with_receipts' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>With receipts</button>
                   <button onClick={() => setExpenseReceiptFilter('without_receipts')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${expenseReceiptFilter === 'without_receipts' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>Without receipts</button>
                 </div>
                 <div className="flex flex-wrap gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                   <div className="w-full text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Review status</div>
                   <button onClick={() => setExpenseReviewFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${expenseReviewFilter === 'all' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>All</button>
                   <button onClick={() => setExpenseReviewFilter('new')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${expenseReviewFilter === 'new' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>New</button>
                   <button onClick={() => setExpenseReviewFilter('reviewed')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${expenseReviewFilter === 'reviewed' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>Reviewed</button>
                 </div>
               </div>
             )}

        {(currentPage === Page.AllTransactions || currentPage === Page.Ledger) && (
               <div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-lg mb-4">
                  {(['all', 'income', 'expense', 'invoice'] as const).map(f => (
                    <button key={f} onClick={() => setLedgerFilter(f)} className={`flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${ledgerFilter === f ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200'}`}>{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
                  ))}
               </div>
             )}

             {filterPeriod !== 'all' && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-6 flex items-center justify-between shadow-sm">
                   <div className="text-center flex-1 border-r border-slate-200 dark:border-slate-800"><div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Cash In</div><div className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency.format(periodTotals.inc)}</div></div>
                   <div className="text-center flex-1"><div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Cash Out</div><div className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency.format(periodTotals.exp)}</div></div>
                </div>
             )}

             <div className="space-y-4">
               {((currentPage === Page.AllTransactions || currentPage === Page.Ledger) ? filteredLedgerItems : currentPage === Page.Income ? filteredTransactions.filter(t => t.type === 'income') : filteredExpenseItems).length === 0 ? (
                  <EmptyState icon={currentPage === Page.Income ? <Wallet size={32} /> : currentPage === Page.Expenses ? <Receipt size={32} /> : <History size={32} />} title="No Items Found" subtitle="No activity found for the selected period." action={handleContextualHeaderAdd} actionLabel="Add Transaction" />
               ) : (
                ((currentPage === Page.AllTransactions || currentPage === Page.Ledger) ? filteredLedgerItems : currentPage === Page.Income ? filteredTransactions.filter(t => t.type === 'income') : filteredExpenseItems).map((item: any) => {
                  const isInvoice = item.dataType === 'invoice';
                  const isIncome = item.type === 'income';
                  const amountColor = isInvoice ? 'text-blue-600 dark:text-blue-400' : isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
                  const iconBg = isInvoice ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : isIncome ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400';
                  const Icon = isInvoice ? FileText : isIncome ? Wallet : Receipt;
                  
                  // Invoice status calculations
                  let invoiceStatusBadge = null;
                  if (isInvoice) {
                    const inv = item as Invoice;
                    const isVoid = inv.status === 'void';
                    const overdueDays = inv.status === 'unpaid' ? getDaysOverdue(inv.due) : 0;
                    const isOverdue = overdueDays > 0;
                    
                    let badgeClass = '';
                    let badgeText = '';
                    
                    if (isVoid) {
                      badgeClass = 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                      badgeText = 'VOID';
                    } else if (inv.status === 'paid') {
                      badgeClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
                      badgeText = 'PAID';
                    } else if (isOverdue) {
                      badgeClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
                      badgeText = 'OVERDUE';
                    } else {
                      badgeClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
                      badgeText = 'UNPAID';
                    }
                    
                    invoiceStatusBadge = (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase flex-shrink-0 ${badgeClass}`}>
                        {badgeText}
                      </span>
                    );
                  }
                  
                  // If it's an invoice, use the detailed invoice card layout
                  if (isInvoice) {
                    const inv = item as Invoice;
                    const isVoid = inv.status === 'void';
                    const overdueDays = inv.status === 'unpaid' ? getDaysOverdue(inv.due) : 0;
                    const isOverdue = overdueDays > 0;
                    const isRecurring = inv.recurrence && inv.recurrence.active;
                    
                    return (
                      <div key={item.listId || item.id} className={`bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 hover:shadow-lg transition-all shadow-md cursor-pointer ${isOverdue && !isVoid ? 'border-l-4 border-l-red-500' : ''} ${isVoid ? 'opacity-75 grayscale-[0.5] border-l-4 border-l-slate-400' : ''}`} onClick={() => handleEditItem(item)}>
                        {/* Top Section: Icon, Name, Description */}
                        <div className="flex items-start gap-4 mb-4">
                          <div className={`w-12 h-12 bg-slate-100 dark:bg-blue-500/10 text-slate-600 dark:text-blue-400 rounded-md flex items-center justify-center flex-shrink-0 ${isVoid ? 'bg-slate-200 dark:bg-slate-800 text-slate-400' : ''}`}>{isVoid ? <Ban size={20} strokeWidth={1.5} /> : isRecurring ? <Repeat size={20} strokeWidth={1.5} className="text-blue-500" /> : <FileText size={20} strokeWidth={1.5} />}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`font-bold text-slate-900 dark:text-white text-lg ${isVoid ? 'line-through text-slate-400' : ''}`}>{inv.client}</div>
                              {isRecurring && <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Recurring</span>}
                            </div>
                            <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{inv.description}</div>
                            <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">{inv.date}</div>
                          </div>
                        </div>
                        
                        {/* Bottom Section: Amount, Status, Actions */}
                        <div className="flex items-end justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                          <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 uppercase tracking-wide">Total</label>
                              <div className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white mb-2">{formatCurrency.format(inv.amount)}</div>
                              <div className="flex flex-col gap-1">
                                <div className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 w-fit ${isVoid ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : inv.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                                  {isOverdue && !isVoid && <AlertTriangle size={12} />}
                                  {isVoid ? 'Void' : inv.status === 'paid' ? 'Paid' : isOverdue ? `Overdue (${overdueDays}d)` : 'Unpaid'}
                                </div>
                                <div className={`text-xs font-medium ${isOverdue && !isVoid ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                  {isOverdue && !isVoid ? `Due was ${inv.due}` : `Due ${inv.due}`}
                                  {isRecurring && inv.recurrence && <span className="block text-blue-500 mt-0.5">Next: {inv.recurrence.nextDate}</span>}
                                </div>
                              </div>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={(e) => { e.stopPropagation(); handlePrintInvoice(inv); }} title="Export PDF" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all active:scale-95"><Download size={20} strokeWidth={1.5} /></button>
                              <button onClick={(e) => { e.stopPropagation(); markInvoicePaid(inv); }} title={inv.status === 'paid' ? "Mark Unpaid" : "Mark Paid"} disabled={isVoid} className={`p-2.5 rounded-lg transition-all active:scale-95 ${isVoid ? 'bg-slate-50 dark:bg-slate-900 text-slate-300 cursor-not-allowed' : inv.status === 'paid' ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-600 hover:text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-green-600 hover:text-white'}`}><CheckCircle size={20} strokeWidth={1.5} /></button>
                              {!isVoid && <button onClick={(e) => { e.stopPropagation(); setActiveItem(inv); setDrawerMode('edit_inv'); setIsDrawerOpen(true); }} title="Edit Invoice" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-900 hover:text-white dark:hover:bg-slate-700 transition-all active:scale-95"><Edit3 size={20} strokeWidth={1.5} /></button>}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // Otherwise use the standard transaction layout
                  return (
                   <div key={item.listId || item.id} className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 hover:shadow-lg transition-all shadow-md" onClick={() => handleEditItem(item)}>
                      {/* Top Row: Icon, Name/Client, Amount */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}><Icon size={22} strokeWidth={1.5} /></div>
                              <div className="min-w-0 flex-1 pt-1">
                                  <div className="flex items-center gap-2 mb-1">
                                      <div className="font-bold text-slate-900 dark:text-white text-base leading-tight">{item.name || item.client}</div>
                                      {invoiceStatusBadge}
                                  </div>
                                  <div className="text-xs font-medium text-slate-600 dark:text-slate-300">{item.date} · {item.category}</div>
                                  {!isIncome && !isInvoice && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-1 rounded-full ${item.receiptId ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{item.receiptId ? 'Receipt attached' : 'No receipt'}</span>
                                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-1 rounded-full ${(item as any).reviewedAt ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'}`}>{(item as any).reviewedAt ? 'Reviewed' : 'New'}</span>
                                    </div>
                                  )}
                              </div>
                          </div>
                          <div className={`text-xl font-bold whitespace-nowrap flex-shrink-0 pt-1 ${amountColor}`}>{isIncome ? '+' : ''}{formatCurrency.format(item.amount)}</div>
                      </div>
                      
                      {/* Bottom Row: Action Buttons */}
                      <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                           {!isIncome && !isInvoice && <button onClick={(e) => { e.stopPropagation(); toggleTransactionReviewed(item.id); }} className={`p-2 rounded-lg transition-all active:scale-95 ${(item as any).reviewedAt ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300' : 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300'}`} title={(item as any).reviewedAt ? 'Mark as new' : 'Mark as reviewed'}><CheckCircle size={18}/></button>}
                           <button onClick={(e) => { e.stopPropagation(); if (isInvoice) duplicateInvoice(item as Invoice); else duplicateTransaction(item as Transaction); }} className="p-2 rounded-lg text-slate-400 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95" title="Duplicate"><Copy size={18}/></button>
                           <button onClick={(e) => { e.stopPropagation(); handleEditItem(item); }} className="p-2 rounded-lg text-slate-400 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95" title="Edit"><Edit3 size={18}/></button>
                           <button onClick={(e) => { e.stopPropagation(); if (isInvoice) deleteInvoice(item); else deleteTransaction(item.id); }} className="p-2 rounded-lg text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95" title="Delete"><Trash2 size={18}/></button>
                      </div>
                   </div>
                  );
                }))}
             </div>
           </div>
        )}

        {(currentPage === Page.Invoices) && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 min-w-0 max-w-full">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-2 sm:p-2.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 flex-shrink-0">
                  <FileText size={20} className="sm:w-6 sm:h-6" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-2 sm:gap-3 min-w-0 w-full sm:w-auto">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white font-brand">{billingDocType === 'estimate' ? 'Estimates' : 'Invoices'}</h2>
                  {/* Redesigned Invoices/Estimates Segmented Tabs */}
                  <div className="grid grid-cols-2 w-full sm:w-fit bg-slate-200/80 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-300/50 dark:border-slate-700/50 shadow-sm">
                    <button 
                      onClick={() => { setBillingDocType('invoice'); setInvoiceQuickFilter('all'); }} 
                      className={`w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-bold uppercase tracking-wide transition-all ${
                        billingDocType === 'invoice' 
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-black/5 dark:ring-white/10' 
                          : 'hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                      style={{ color: billingDocType === 'invoice' ? undefined : 'var(--tab-inactive)' }}
                    >
                      Invoices
                    </button>
                    <button 
                      onClick={() => { setBillingDocType('estimate'); setEstimateQuickFilter('all'); }} 
                      className={`w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-bold uppercase tracking-wide transition-all ${
                        billingDocType === 'estimate' 
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-black/5 dark:ring-white/10' 
                          : 'hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                      style={{ color: billingDocType === 'estimate' ? undefined : 'var(--tab-inactive)' }}
                    >
                      Estimates
                    </button>
                  </div>
                </div>
              </div>
              <button onClick={() => handleOpenFAB('billing', billingDocType === 'estimate' ? 'estimate' : 'invoice')} className="self-end sm:self-auto w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-500 transition-all flex-shrink-0"><Plus size={20} className="sm:w-6 sm:h-6" strokeWidth={2.5} /></button>
            </div>
            <PeriodSelector period={filterPeriod} setPeriod={setFilterPeriod} refDate={referenceDate} setRefDate={setReferenceDate} />

            {billingDocType === 'invoice' && (<>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setInvoiceQuickFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${invoiceQuickFilter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}
              >
                All ({invoiceQuickCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setInvoiceQuickFilter('unpaid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${invoiceQuickFilter === 'unpaid' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}
              >
                Unpaid ({invoiceQuickCounts.unpaid})
              </button>
              <button
                type="button"
                onClick={() => setInvoiceQuickFilter('overdue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${invoiceQuickFilter === 'overdue' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}
              >
                Overdue ({invoiceQuickCounts.overdue})
              </button>
            </div>

             {filterPeriod !== 'all' && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-6 shadow-sm">
                   <div className="grid grid-cols-3 gap-2">
                     <div className="text-center py-2">
                       <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Paid</div>
                       <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">{formatCurrency.format(invoicePeriodTotals.paid)}</div>
                     </div>
                     <div className="text-center py-2 border-x border-slate-200 dark:border-slate-700">
                       <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Due Soon</div>
                       <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">{formatCurrency.format(invoicePeriodTotals.unpaid - invoicePeriodTotals.overdue)}</div>
                     </div>
                     <div className="text-center py-2">
                       <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Overdue</div>
                       <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">{formatCurrency.format(invoicePeriodTotals.overdue)}</div>
                     </div>
                   </div>
                </div>
             )}
            <div className="space-y-4">
              {displayedInvoices.length === 0 ? <EmptyState icon={<FileText size={32} />} title="No Invoices Found" subtitle={filterPeriod === 'all' ? "Create professional invoices and track payments effortlessly." : "No invoices found for the selected period."} action={() => handleOpenFAB('billing', 'invoice')} actionLabel="Create Invoice" /> :
                displayedInvoices.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(inv => {
                  const overdueDays = inv.status === 'unpaid' ? getDaysOverdue(inv.due) : 0;
                  const isOverdue = overdueDays > 0;
                  const isRecurring = inv.recurrence && inv.recurrence.active;
                  const isVoid = inv.status === 'void';
                  return (
                  <div key={inv.id} className={`bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 group hover:border-blue-500/30 hover:shadow-lg transition-all shadow-md cursor-pointer ${isOverdue && !isVoid ? 'border-l-4 border-l-red-500' : ''} ${isVoid ? 'opacity-75 grayscale-[0.5] border-l-4 border-l-slate-400' : ''}`} onClick={() => handleEditItem({ dataType: 'invoice', original: inv })}>
                    {/* Top Section: Icon, Name, Description */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-12 h-12 bg-slate-100 dark:bg-blue-500/10 text-slate-600 dark:text-blue-400 rounded-md flex items-center justify-center flex-shrink-0 ${isVoid ? 'bg-slate-200 dark:bg-slate-800 text-slate-400' : ''}`}>{isVoid ? <Ban size={20} strokeWidth={1.5} /> : isRecurring ? <Repeat size={20} strokeWidth={1.5} className="text-blue-500" /> : <FileText size={20} strokeWidth={1.5} />}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <div className={`font-bold text-slate-900 dark:text-white text-lg ${isVoid ? 'line-through text-slate-400' : ''}`}>{inv.client}</div>
                          {inv.number && <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono font-bold">{inv.number}</span>}
                          {isRecurring && <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Recurring</span>}
                        </div>
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{inv.description}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">{inv.date}</div>
                      </div>
                    </div>
                    
                    {/* Bottom Section: Amount, Status, Actions */}
                    <div className="flex items-end justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div>
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 uppercase tracking-wide">Total</label>
                          <div className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white mb-2">{formatCurrency.format(inv.amount)}</div>
                          <div className="flex flex-col gap-1">
                            <div className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 w-fit ${isVoid ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : inv.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                              {isOverdue && !isVoid && <AlertTriangle size={12} />}
                              {isVoid ? 'Void' : inv.status === 'paid' ? 'Paid' : isOverdue ? `Overdue (${overdueDays}d)` : 'Unpaid'}
                            </div>
                            <div className={`text-xs font-medium ${isOverdue && !isVoid ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                              {isOverdue && !isVoid ? `Due was ${inv.due}` : `Due ${inv.due}`}
                              {isRecurring && inv.recurrence && <span className="block text-blue-500 mt-0.5">Next: {inv.recurrence.nextDate}</span>}
                            </div>
                          </div>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); handlePrintInvoice(inv); }} title="Export PDF" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all active:scale-95"><Download size={20} strokeWidth={1.5} /></button>
                          <button onClick={(e) => { e.stopPropagation(); markInvoicePaid(inv); }} title={inv.status === 'paid' ? "Mark Unpaid" : "Mark Paid"} disabled={isVoid} className={`p-2.5 rounded-lg transition-all active:scale-95 ${isVoid ? 'bg-slate-50 dark:bg-slate-900 text-slate-300 cursor-not-allowed' : inv.status === 'paid' ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-600 hover:text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-green-600 hover:text-white'}`}><CheckCircle size={20} strokeWidth={1.5} /></button>
                          {!isVoid && <button onClick={(e) => { e.stopPropagation(); setActiveItem(inv); setDrawerMode('edit_inv'); setIsDrawerOpen(true); }} title="Edit Invoice" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-900 hover:text-white dark:hover:bg-slate-700 transition-all active:scale-95"><Edit3 size={20} strokeWidth={1.5} /></button>}
                      </div>
                    </div>
                  </div>
                )})
              }

            </div>
            </>
            )}

            {billingDocType === 'estimate' && (
              <>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={() => setEstimateQuickFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${estimateQuickFilter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}>All ({estimateQuickCounts.all})</button>
                  <button type="button" onClick={() => setEstimateQuickFilter('draft')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${estimateQuickFilter === 'draft' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}>Draft ({estimateQuickCounts.draft})</button>
                  <button type="button" onClick={() => setEstimateQuickFilter('sent')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${estimateQuickFilter === 'sent' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}>Sent ({estimateQuickCounts.sent})</button>
                  <button type="button" onClick={() => setEstimateQuickFilter('accepted')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${estimateQuickFilter === 'accepted' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}>Accepted ({estimateQuickCounts.accepted})</button>
                  <button type="button" onClick={() => setEstimateQuickFilter('declined')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${estimateQuickFilter === 'declined' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}>Declined ({estimateQuickCounts.declined})</button>
                </div>

                <div className="space-y-4">
                  {displayedEstimates.length === 0 ? (
                    <EmptyState icon={<FileText size={32} />} title="No Estimates Found" subtitle={filterPeriod === 'all' ? "Create professional estimates (quotes) and export to PDF." : "No estimates found for the selected period."} action={() => handleOpenFAB('billing', 'estimate')} actionLabel="Create Estimate" />
                  ) : (
                    displayedEstimates
                      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(est => {
                        const isExpired = est.validUntil ? new Date(est.validUntil) < new Date() : false;
                        const statusLabel = est.status === 'accepted' ? 'Accepted' : est.status === 'declined' ? 'Declined' : est.status === 'sent' ? 'Sent' : est.status === 'void' ? 'Void' : 'Draft';
                        const statusClass = est.status === 'accepted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : est.status === 'declined' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : est.status === 'sent' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : est.status === 'void' ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                        const isVoid = est.status === 'void';
                        
                        // Follow-up status calculation
                        const today = new Date().toISOString().split('T')[0];
                        const isFollowUpOverdue = est.status === 'sent' && est.followUpDate && est.followUpDate <= today;
                        const isFollowUpSoon = est.status === 'sent' && est.followUpDate && !isFollowUpOverdue && (() => {
                          const followUp = new Date(est.followUpDate);
                          const threeDays = new Date();
                          threeDays.setDate(threeDays.getDate() + 3);
                          return followUp <= threeDays;
                        })();
                        const daysSinceSent = est.sentAt ? Math.floor((new Date().getTime() - new Date(est.sentAt).getTime()) / (1000 * 60 * 60 * 24)) : null;
                        
                        return (
                          <div key={est.id} className={`bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 group hover:border-blue-500/30 hover:shadow-lg transition-all shadow-md cursor-pointer ${isExpired && est.status !== 'accepted' && !isVoid ? 'border-l-4 border-l-amber-500' : ''} ${est.status === 'accepted' ? 'border-l-4 border-l-emerald-500' : ''} ${isFollowUpOverdue ? 'border-l-4 border-l-orange-500' : ''} ${isVoid ? 'opacity-60' : ''}`} onClick={() => handleEditItem({ dataType: 'estimate', original: est })}>
                            <div className="flex items-start gap-4 mb-4">
                              <div className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${est.status === 'accepted' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : est.status === 'sent' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                                {est.status === 'accepted' ? <CheckCircle size={20} strokeWidth={1.5} /> : <FileText size={20} strokeWidth={1.5} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <div className="font-bold text-slate-900 dark:text-white text-lg">{est.client}</div>
                                  {est.number && <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono font-bold">{est.number}</span>}
                                  {isFollowUpOverdue && <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded font-bold flex items-center gap-1"><Clock3 size={12} /> Follow-up due</span>}
                                </div>
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{est.description}</div>
                                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                  {est.date}{est.validUntil ? ` • Valid until ${est.validUntil}` : ''}
                                  {est.status === 'sent' && daysSinceSent !== null && <span className="ml-2 text-blue-600 dark:text-blue-400">• Sent {daysSinceSent}d ago</span>}
                                  {est.followUpCount !== undefined && est.followUpCount > 0 && <span className="ml-2 text-purple-600 dark:text-purple-400">• {est.followUpCount} follow-up{est.followUpCount > 1 ? 's' : ''}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Follow-up Alert Banner for Sent Estimates */}
                            {est.status === 'sent' && (isFollowUpOverdue || isFollowUpSoon) && (
                              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 rounded-lg mb-4 ${isFollowUpOverdue ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30' : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30'}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <Clock3 size={16} className={`flex-shrink-0 ${isFollowUpOverdue ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`} />
                                  <span className={`text-sm font-bold ${isFollowUpOverdue ? 'text-orange-800 dark:text-orange-300' : 'text-blue-800 dark:text-blue-300'}`}>
                                    {isFollowUpOverdue ? `Follow-up was due ${est.followUpDate}` : `Follow-up: ${est.followUpDate}`}
                                  </span>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); recordFollowUp(est, 7); }}
                                    className="px-3 py-1.5 rounded text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                                  >
                                    Done +7d
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); snoozeFollowUp(est, 3); }}
                                    className="px-3 py-1.5 rounded text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                                  >
                                    +3d
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Quick Status Actions - Context-Sensitive */}
                            {!isVoid && (
                              <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                                {est.status === 'draft' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateEstimateStatus(est, 'sent'); }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-blue-600 text-white hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-1.5"
                                  >
                                    <Share2 size={14} /> Mark Sent
                                  </button>
                                )}
                                {est.status === 'sent' && (
                                  <>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); updateEstimateStatus(est, 'accepted'); }}
                                      className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-1.5"
                                    >
                                      <CheckCircle size={14} /> Won / Accepted
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); updateEstimateStatus(est, 'declined'); }}
                                      className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700 hover:bg-red-600 hover:text-white dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white transition-all active:scale-95 flex items-center gap-1.5"
                                    >
                                      <X size={14} /> Lost / Declined
                                    </button>
                                    {!isFollowUpOverdue && !isFollowUpSoon && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); recordFollowUp(est, 7); }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-600 dark:hover:text-white transition-all active:scale-95 flex items-center gap-1.5"
                                      >
                                        <Clock3 size={14} /> Log Follow-up
                                      </button>
                                    )}
                                  </>
                                )}
                                {est.status === 'accepted' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); convertEstimateToInvoice(est); }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-blue-600 text-white hover:from-emerald-700 hover:to-blue-700 transition-all active:scale-95 flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                                  >
                                    <ArrowRight size={14} /> Create Invoice
                                  </button>
                                )}
                                {est.status === 'declined' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); duplicateEstimate(est); }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-1.5"
                                  >
                                    <Copy size={14} /> Revise & Resend
                                  </button>
                                )}
                              </div>
                            )}

                            <div className="flex items-end justify-between">
                              <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 uppercase tracking-wide">Total</label>
                                <div className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white mb-2">{formatCurrency.format(est.amount)}</div>
                                <div className="flex flex-col gap-1">
                                  <div className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 w-fit ${statusClass}`}>{statusLabel}</div>
                                  {isExpired && est.status !== 'accepted' && !isVoid && <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Expired</div>}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={(e) => { e.stopPropagation(); handlePrintEstimate(est); }} title="Export PDF" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all active:scale-95"><Download size={20} strokeWidth={1.5} /></button>
                                <button onClick={(e) => { e.stopPropagation(); setBillingDocType('estimate'); setActiveItem(est); setDrawerMode('edit_inv'); setIsDrawerOpen(true); }} title="Edit Estimate" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-900 hover:text-white dark:hover:bg-slate-700 transition-all active:scale-95"><Edit3 size={20} strokeWidth={1.5} /></button>
                                <button onClick={(e) => { e.stopPropagation(); deleteEstimate(est); }} title="Delete Estimate" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-600 hover:text-white transition-all active:scale-95"><Trash2 size={20} strokeWidth={1.5} /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {currentPage === Page.Mileage && (
          <div className="min-h-full flex flex-col space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300 flex-shrink-0">
                <Car size={20} className="sm:w-6 sm:h-6" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white font-brand">Mileage</h2>
            </div>

            {!isMileageKeyboardEditing && (
              <p className="text-slate-600 dark:text-slate-300 font-semibold mb-3">
                Log trips daily and export IRS-ready mileage for tax time.
              </p>
            )}

            <MobileFormShell
              isEditing={false}
              title="Mileage"
              description="Track deductible trips and export clean CSV or spreadsheet files for your accountant."
              toolbar={(
                <div className="w-full lg:w-auto flex flex-col gap-2">
                  <div className="w-full sm:w-[140px]">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1 block">Tax Year</label>
                    <select value={taxPrepYear} onChange={e => setTaxPrepYear(Number(e.target.value))} className="w-full px-3 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold">
                      {[2026, 2025, 2024, 2023].map(y => (<option key={y} value={y}>{y}</option>))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button type="button" onClick={openMileageAddDrawer} className="w-full text-center px-4 py-3 rounded-lg bg-emerald-600 text-white font-extrabold uppercase tracking-widest text-xs hover:bg-emerald-700 active:scale-95 transition-all">Add Trip</button>
                    <button onClick={handleExportMileageSpreadsheet} className={`${exportButtonTonalClass} w-full text-center`}>Export Mileage Spreadsheet</button>
                    <button onClick={handleExportMileageCSV} className={`${exportButtonUtilityClass} w-full text-center`}>Export Mileage CSV</button>
                  </div>
                </div>
              )}
              form={(
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Trips</div>
                    <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{mileageForTaxYear.length}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Miles</div>
                    <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{mileageTotalMilesForTaxYear.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Estimated Deduction</div>
                    <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatCurrency.format(mileageDeductionForTaxYear)}</div>
                  </div>
                </div>
              )}
              secondaryContent={renderMileageTripList()}
            />
          </div>
        )}

        {currentPage === Page.Reports && (
           <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 flex-shrink-0">
                  <BarChart3 size={20} className="sm:w-6 sm:h-6" strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white font-brand">Reports</h2>
              </div>
              
              
              <p className="text-slate-600 dark:text-slate-300 font-semibold mb-3">
                Choose a report section below.
              </p>

              {/* Reports Menu (like Settings) */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm mb-4">
                <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                  <button
                    type="button"
                    onClick={() => scrollToReportSection('report-pl', 'pl')}
                    className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                      reportsMenuSection === 'pl'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <BarChart3 size={18} />
                    <span className="text-[10px] md:text-sm mt-0.5 md:mt-0 text-center leading-tight">Profit &amp; Loss</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollToReportSection('report-taxsnapshot', 'taxsnapshot')}
                    className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                      reportsMenuSection === 'taxsnapshot'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Calculator size={18} />
                    <span className="text-[10px] md:text-sm mt-0.5 md:mt-0 text-center leading-tight">Tax Snapshot</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollToReportSection('report-taxprep', 'taxprep')}
                    className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                      reportsMenuSection === 'taxprep'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Download size={18} />
                    <span className="text-[10px] md:text-sm mt-0.5 md:mt-0 text-center leading-tight">Tax Prep</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollToReportSection('report-mileage', 'mileage')}
                    className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                      reportsMenuSection === 'mileage'
                        ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Truck size={18} />
                    <span className="text-[10px] md:text-sm mt-0.5 md:mt-0 text-center leading-tight">Mileage</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollToReportSection('report-planner', 'planner')}
                    className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                      reportsMenuSection === 'planner'
                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/30'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <ClipboardList size={18} />
                    <span className="text-[10px] md:text-sm mt-0.5 md:mt-0 text-center leading-tight">Tax Planner</span>
                  </button>
                </div>
              </div>
{/* Pro-Grade U.S. P&L Statement */}
              <div id="report-pl" className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl">
                {/* Controls Header - NOT part of PDF */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <BarChart3 size={24} strokeWidth={2} className="text-blue-600 dark:text-blue-400" />
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                        Profit & Loss
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {proPLData.periodLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={shareProPLPDF}
                      disabled={isGeneratingProPLPdf}
                      className="px-4 py-2 rounded-lg border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center gap-2 transition-colors shadow-sm hover:shadow-md disabled:opacity-50"
                    >
                      {isGeneratingProPLPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                      <span>{isGeneratingProPLPdf ? 'Preparing...' : 'Share PDF'}</span>
                    </button>
                    <button
                      onClick={saveProPLPDF}
                      disabled={isGeneratingProPLPdf}
                      className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-900 dark:text-white font-semibold text-sm flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isGeneratingProPLPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span>{isGeneratingProPLPdf ? 'Preparing...' : 'Download PDF'}</span>
                    </button>
                  </div>
                </div>

                {/* Period Selector */}
                <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[
                      { value: 'month', label: 'This Month' },
                      { value: 'ytd', label: 'YTD' },
                      { value: 'lastYear', label: 'Last Year' },
                      { value: 'trailing12', label: '12 Mo' },
                      { value: 'custom', label: 'Custom' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setPlPeriodType(opt.value as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          plPeriodType === opt.value 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  
                  {plPeriodType === 'custom' && (
                    <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">From:</label>
                        <input type="date" value={plCustomStart} onChange={(e) => setPlCustomStart(e.target.value)} className="px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">To:</label>
                        <input type="date" value={plCustomEnd} onChange={(e) => setPlCustomEnd(e.target.value)} className="px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setPlShowComparison(!plShowComparison)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        plShowComparison ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      {plShowComparison ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      Prior Period
                    </button>
                    <select
                      value={plAccountingBasis}
                      onChange={(e) => setPlAccountingBasis(e.target.value as 'cash' | 'accrual')}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-bold"
                    >
                      <option value="cash">Cash Basis</option>
                      <option value="accrual">Accrual Basis</option>
                    </select>
                  </div>
                </div>

                {/* Data Integrity Warning */}
                {proPLData.hasDataIssues && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {proPLData.uncategorizedCount} uncategorized transaction{proPLData.uncategorizedCount !== 1 ? 's' : ''} ({formatCurrency.format(proPLData.uncategorizedAmount)})
                    </p>
                  </div>
                )}


                <div className="mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Revenue</div>
                      <div className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-white mt-1">{formatCurrency.format(proPLData.netRevenue)}</div>
                    </div>

                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Expenses</div>
                      <div className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-white mt-1">{formatCurrency.format(proPLData.totalOpex)}</div>
                    </div>

                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Other Income</div>
                      <div className={`text-lg font-extrabold tabular-nums mt-1 ${proPLData.netOtherIncome >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency.format(proPLData.netOtherIncome)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Net Income</div>
                      <div className={`text-lg font-extrabold tabular-nums mt-1 ${proPLData.netIncome >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency.format(proPLData.netIncome)}
                      </div>
                    </div>
                  </div>

                  {Math.abs(proPLData.netOtherIncome) > 0 && (
                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      Net Income includes <span className="font-semibold">Other Income / Expense</span> from the full statement preview.
                    </div>
                  )}
                </div>
              </div>

              <div id="report-taxsnapshot" ref={taxSnapshotRef} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-5 sm:p-8 rounded-lg shadow-xl relative overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-50 dark:bg-blue-600/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8 relative z-10">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Calculator size={20} strokeWidth={2} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div>
                      <h3 style={{ fontSize: '16px' }} className="font-bold uppercase tracking-tight font-brand">Tax Snapshot</h3>
                      <p style={{ fontSize: '11px' }} className="text-slate-600 dark:text-slate-300 font-bold mt-0.5">Based on Net Profit: {formatCurrency.format(reportData.ytdNetProfit)}</p>
                    </div>
                  </div>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenTaxDrawer(); }} style={{ fontSize: '10px' }} className="relative z-30 cursor-pointer font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors uppercase tracking-wider active:scale-95 self-start sm:self-auto">Manage Payments</button>
                </div>
                <div className="space-y-4 sm:space-y-6 relative z-10">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div style={{ fontSize: '13px' }} className="font-bold text-slate-700 dark:text-slate-300">Self-Employment Tax</div>
                      <div style={{ fontSize: '10px' }} className="text-slate-600 dark:text-slate-300 uppercase tracking-wider">Social Security & Medicare (~15.3%)</div>
                    </div>
                    <div style={{ fontSize: '18px' }} className="font-bold flex-shrink-0">{formatCurrency.format(reportData.seTaxLiability)}</div>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div style={{ fontSize: '13px' }} className="font-bold text-slate-700 dark:text-slate-300">Income Tax Estimate</div>
                      <div style={{ fontSize: '10px' }} className="text-slate-600 dark:text-slate-300 uppercase tracking-wider">Based on {reportData.totalIncomeTaxRate}% Combined Rate</div>
                    </div>
                    <div style={{ fontSize: '18px' }} className="font-bold flex-shrink-0">{formatCurrency.format(reportData.incomeTaxLiability)}</div>
                  </div>
                  <div className="flex justify-between items-start gap-2 py-2 bg-slate-50 dark:bg-slate-900/50 -mx-4 sm:-mx-4 px-4 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div style={{ fontSize: '13px' }} className="font-bold text-slate-700 dark:text-slate-300">Less: Payments (YTD)</div>
                    </div>
                    <div style={{ fontSize: '18px' }} className="font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">-{formatCurrency.format(reportData.totalTaxPaidYTD)}</div>
                  </div>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-3 sm:my-4" />
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-1">
                    <span style={{ fontSize: '12px' }} className="font-bold uppercase tracking-widest font-brand text-slate-600 dark:text-slate-300">{reportData.taxAhead > 0 ? 'Overpaid (Refund Est.)' : 'Net Remaining To Pay'}</span>
                    <span style={{ fontSize: '28px' }} className={`font-extrabold font-brand ${reportData.taxAhead > 0 ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>{formatCurrency.format(reportData.taxAhead > 0 ? reportData.taxAhead : reportData.taxRemaining)}</span>
                  </div>
                </div>

                {/* --- Tax Planner (2026) Accordion --- */}
              </div>
                

                {/* Tax Prep Package (Exports) */}
                <div id="report-taxprep" className="bg-white dark:bg-slate-950 p-5 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                        <Download size={20} strokeWidth={2} />
                      </div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Tax Prep Package</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Export tax transactions, mileage, receipts, and a summary for a single tax year.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Tax Year</span>
                      <select value={taxPrepYear} onChange={e => setTaxPrepYear(Number(e.target.value))} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm font-extrabold">
                        {Array.from({ length: 6 }).map((_, i) => {
                          const y = new Date().getFullYear() - i;
                          return <option key={y} value={y}>{y}</option>;
                        })}
                      </select>
                    </div>
                  </div>

                  

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button onClick={handleShareTaxSummaryPDF} className={exportButtonPrimaryClass}>Share Tax Summary PDF</button>
                    <button onClick={handleDownloadTaxSummaryPDF} className={exportButtonSecondaryClass}>Download Tax Summary PDF</button>
                    <button onClick={handleExportTaxLedgerSpreadsheet} className={exportButtonTonalClass}>Export Tax Transactions Spreadsheet</button>
                    <button onClick={handleExportMileageSpreadsheet} className={exportButtonTonalClass}>Export Mileage Spreadsheet</button>
                    <button onClick={handleExportTaxLedgerCSV} className={exportButtonUtilityClass}>Export Tax Transactions CSV</button>
                    <button onClick={handleExportMileageCSV} className={exportButtonUtilityClass}>Export Mileage CSV</button>
                    <button onClick={handleExportReceiptsZip} className={`${exportButtonUtilityClass} md:col-span-2`}>Export Linked Receipts ZIP</button>
                  </div>

                  <div className="mt-6 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Audit Readiness (Quick Checks)</div>
                    {(() => {
                      const missing = txForTaxYear.filter(t => t.type === 'expense' && !(t as any).receiptId).length;
                      const missingCategory = txForTaxYear.filter(t => !t.category?.trim()).length;
                      const badMileage = mileageForTaxYear.filter(m => !m.purpose?.trim() || Number(m.miles || 0) <= 0).length;
                      const linkedReceipts = txForTaxYear.filter(t => t.type === 'expense' && (t as any).receiptId).length;
                      const reviewedCount = txForTaxYear.filter(t => t.type === 'expense' && !!(t as any).reviewedAt).length;
                      const pendingReviewCount = txForTaxYear.filter(t => t.type === 'expense' && !(t as any).reviewedAt).length;
                      const totalExpenses = txForTaxYear.filter(t => t.type === 'expense').length;

                      const Row = ({ ok, label, detail }: any) => (
                        <div className="flex items-start justify-between gap-3 py-2 border-b last:border-b-0 border-slate-200/60 dark:border-slate-800/60">
                          <div className="flex items-start gap-2">
                            {ok ? <CheckCircle size={16} className="text-emerald-600 mt-0.5" /> : <AlertTriangle size={16} className="text-amber-600 mt-0.5" />}
                            <div>
                              <div className="text-sm font-extrabold text-slate-900 dark:text-white">{label}</div>
                              {detail ? <div className="text-xs text-slate-600 dark:text-slate-300">{detail}</div> : null}
                            </div>
                          </div>
                        </div>
                      );

                      return (
                        <div className="space-y-0">
                          <Row ok={missing === 0} label="Receipts attached to expenses" detail={missing === 0 ? `Linked: ${linkedReceipts}/${totalExpenses} expense(s)` : (
                            <span className="flex items-center gap-2">
                              <span className={`${auditMissingPulse ? "animate-pulse " : ""}font-extrabold text-amber-700 dark:text-amber-400`}>Expenses without receipts: {missing}</span>
                              {auditMissingPulse && auditMissingDelta !== 0 ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${auditMissingDelta < 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"}`}>{auditMissingDelta > 0 ? `+${auditMissingDelta}` : `${auditMissingDelta}`}</span>
                              ) : null}
                            </span>
                          )} />
                          <Row ok={missingCategory === 0} label="Categories assigned" detail={missingCategory === 0 ? 'OK' : `Missing category: ${missingCategory}`} />
                          <Row ok={badMileage === 0} label="Mileage entries complete" detail={badMileage === 0 ? `Trips: ${mileageForTaxYear.length}` : `Incomplete trips: ${badMileage}`} />
                          <Row ok={pendingReviewCount === 0} label="Expenses reviewed" detail={`Reviewed: ${reviewedCount} · Pending: ${pendingReviewCount}`} />
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Mileage Tracker */}
                <div id="report-mileage" className="bg-white dark:bg-slate-950 p-5 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <Truck size={20} strokeWidth={2} />
                      </div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">Mileage</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Track business miles and export for tax prep.</p>
                      </div>
                    </div>
                    <button type="button" onClick={openMileageAddDrawer} className="px-5 py-3 rounded-lg bg-emerald-600 text-white font-extrabold uppercase tracking-widest text-xs hover:bg-emerald-700 active:scale-95 transition-all whitespace-nowrap">Add Trip</button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Trips</div>
                      <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{mileageForTaxYear.length}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Miles</div>
                      <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{mileageTotalMilesForTaxYear.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Estimated Deduction</div>
                      <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatCurrency.format(mileageDeductionForTaxYear)}</div>
                    </div>
                  </div>

                  {renderMileageTripList()}
                </div>

<div id="report-planner" className="bg-white dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800 shadow-lg rounded-3xl p-6 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-blue-500/10 dark:bg-blue-400/10 opacity-0 dark:opacity-100 blur-2xl pointer-events-none" />
                  <button
                    onClick={() => setIsPlannerOpen(!isPlannerOpen)}
                    className="w-full flex items-center justify-between gap-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <BrainCircuit size={22} className="text-blue-600 dark:text-blue-400" />
                      <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight font-brand text-slate-900 dark:text-white">
                        Tax Planner <span className="text-slate-600 dark:text-slate-300">(2026)</span>
                      </h3>
                    </div>
                    <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                      {isPlannerOpen ? <ChevronUp size={18} className="text-slate-600 dark:text-slate-300" /> : <ChevronDown size={18} className="text-slate-600 dark:text-slate-300" />}
                    </span>
                  </button>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 pl-9">
                    Estimate and plan your 2026 taxes in one place.
                  </p>

                  {isPlannerOpen && (
                    <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200 space-y-6">
                            
                            {/* Tab Switcher */}
                            <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg mb-4">
                                <button onClick={() => setPlannerTab('basic')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${plannerTab === 'basic' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>Basic</button>
                                <button onClick={() => setPlannerTab('advanced')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${plannerTab === 'advanced' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>Advanced</button>
                            </div>

                            {plannerTab === 'basic' ? (
                                // Basic Mode
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Projected Annual Income</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold">$</span>
                                                <input 
                                                    type="number" 
                                                    value={plannerData.income || ''} 
                                                    onChange={e => setPlannerData(p => ({...p, income: Number(e.target.value)}))}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Projected Annual Expenses</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold">$</span>
                                                <input 
                                                    type="number" 
                                                    value={plannerData.expenses || ''} 
                                                    onChange={e => setPlannerData(p => ({...p, expenses: Number(e.target.value)}))}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1 text-right">
                                                Proj. Profit: {formatCurrency.format(plannerResults.profit)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Filing Status</label>
                                            <select 
                                                value={plannerData.filingStatus} 
                                                onChange={e => setPlannerData(p => ({...p, filingStatus: e.target.value as any}))}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                            >
                                                <option value="single">Single</option>
                                                <option value="joint">Married Filing Jointly</option>
                                                <option value="head">Head of Household</option>
                                                <option value="separate">Married Filing Separately</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Est. Income Tax Rate</label>
                                            <div className="flex gap-2 mb-2">
                                                {[10, 15, 20].map(rate => (
                                                    <button 
                                                        key={rate}
                                                        onClick={() => setPlannerData(p => ({...p, taxRate: rate, useCustomRate: false}))}
                                                        className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${!plannerData.useCustomRate && plannerData.taxRate === rate ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                                    >
                                                        {rate}%
                                                    </button>
                                                ))}
                                                <button 
                                                    onClick={() => setPlannerData(p => ({...p, useCustomRate: true}))}
                                                    className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${plannerData.useCustomRate ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                                >
                                                    Custom
                                                </button>
                                            </div>
                                            {plannerData.useCustomRate && (
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        value={plannerData.taxRate} 
                                                        onChange={e => setPlannerData(p => ({...p, taxRate: Number(e.target.value)}))}
                                                        className="w-full pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm font-bold text-slate-900 dark:text-white outline-none"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold text-xs">%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800/50">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Apply SE Tax (~15.3%)</label>
                                            <button 
                                                onClick={() => setPlannerData(p => ({...p, useSE: !p.useSE}))}
                                                className={`w-10 h-5 rounded-full relative transition-colors ${plannerData.useSE ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 bottom-1 w-3 bg-white rounded-full transition-all ${plannerData.useSE ? 'left-6' : 'left-1'}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Standard Deduction (2026)</label>
                                            <button 
                                                onClick={() => setPlannerData(p => ({...p, useStdDed: !p.useStdDed}))}
                                                className={`w-10 h-5 rounded-full relative transition-colors ${plannerData.useStdDed ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 bottom-1 w-3 bg-white rounded-full transition-all ${plannerData.useStdDed ? 'left-6' : 'left-1'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Annual Retirement Contrib.</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold">$</span>
                                                <input 
                                                    type="number" 
                                                    value={plannerData.retirement || ''} 
                                                    onChange={e => setPlannerData(p => ({...p, retirement: Number(e.target.value)}))}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Expected Annual Credits</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold">$</span>
                                                <input 
                                                    type="number" 
                                                    value={plannerData.credits || ''} 
                                                    onChange={e => setPlannerData(p => ({...p, credits: Number(e.target.value)}))}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Advanced Mode
                                <div className="space-y-6">
                                    {/* Reused Core Inputs */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Projected Annual Income</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold">$</span>
                                                <input 
                                                    type="number" 
                                                    value={plannerData.income || ''} 
                                                    onChange={e => setPlannerData(p => ({...p, income: Number(e.target.value)}))}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Projected Annual Expenses</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold">$</span>
                                                <input 
                                                    type="number" 
                                                    value={plannerData.expenses || ''} 
                                                    onChange={e => setPlannerData(p => ({...p, expenses: Number(e.target.value)}))}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1 text-right">
                                                Proj. Profit: {formatCurrency.format(plannerResults.profit)}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Filing Status</label>
                                            <select 
                                                value={plannerData.filingStatus} 
                                                onChange={e => setPlannerData(p => ({...p, filingStatus: e.target.value as any}))}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                            >
                                                <option value="single">Single</option>
                                                <option value="joint">Married Filing Jointly</option>
                                                <option value="head">Head of Household</option>
                                                <option value="separate">Married Filing Separately</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Est. Income Tax Rate</label>
                                            <div className="flex gap-2 mb-2">
                                                {[10, 15, 20].map(rate => (
                                                    <button 
                                                        key={rate}
                                                        onClick={() => setPlannerData(p => ({...p, taxRate: rate, useCustomRate: false}))}
                                                        className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${!plannerData.useCustomRate && plannerData.taxRate === rate ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                                    >
                                                        {rate}%
                                                    </button>
                                                ))}
                                                <button 
                                                    onClick={() => setPlannerData(p => ({...p, useCustomRate: true}))}
                                                    className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${plannerData.useCustomRate ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                                >
                                                    Custom
                                                </button>
                                            </div>
                                            {plannerData.useCustomRate && (
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        value={plannerData.taxRate} 
                                                        onChange={e => setPlannerData(p => ({...p, taxRate: Number(e.target.value)}))}
                                                        className="w-full pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm font-bold text-slate-900 dark:text-white outline-none"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold text-xs">%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Advanced Sections */}
                                    <div className="space-y-4">
                                        {/* Section A: Other Income */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                            <button onClick={() => setAdvSection(advSection === 'income' ? null : 'income')} className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center"><Wallet size={16}/></div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">A. Other Income</div>
                                                        <div className="text-xs text-slate-600 dark:text-slate-300">Interest, Dividends, Capital Gains</div>
                                                    </div>
                                                </div>
                                                {advSection === 'income' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                            </button>
                                            {advSection === 'income' && (
                                                <div className="p-4 bg-white dark:bg-slate-950 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                                                    <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Interest</label><input type="number" value={plannerData.otherIncomeInterest || ''} onChange={e => setPlannerData(p => ({...p, otherIncomeInterest: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none" placeholder="0"/></div>
                                                    <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Dividends</label><input type="number" value={plannerData.otherIncomeDividends || ''} onChange={e => setPlannerData(p => ({...p, otherIncomeDividends: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none" placeholder="0"/></div>
                                                    <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Capital Gains</label><input type="number" value={plannerData.otherIncomeCapital || ''} onChange={e => setPlannerData(p => ({...p, otherIncomeCapital: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none" placeholder="0"/></div>
                                                    <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Other</label><input type="number" value={plannerData.otherIncomeOther || ''} onChange={e => setPlannerData(p => ({...p, otherIncomeOther: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none" placeholder="0"/></div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Section B: Deductions */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                            <button onClick={() => setAdvSection(advSection === 'deductions' ? null : 'deductions')} className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><FileText size={16}/></div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">B. Deductions</div>
                                                        <div className="text-xs text-slate-600 dark:text-slate-300">Standard vs. Itemized</div>
                                                    </div>
                                                </div>
                                                {advSection === 'deductions' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                            </button>
                                            {advSection === 'deductions' && (
                                                <div className="p-4 bg-white dark:bg-slate-950 animate-in slide-in-from-top-2">
                                                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg mb-4">
                                                        <button onClick={() => setPlannerData(p => ({...p, deductionMode: 'standard'}))} className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${plannerData.deductionMode === 'standard' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}>Standard</button>
                                                        <button onClick={() => setPlannerData(p => ({...p, deductionMode: 'itemized'}))} className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${plannerData.deductionMode === 'itemized' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}>Itemized</button>
                                                    </div>
                                                    {plannerData.deductionMode === 'itemized' ? (
                                                        <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Total Itemized Deductions</label><input type="number" value={plannerData.itemizedDeduction || ''} onChange={e => setPlannerData(p => ({...p, itemizedDeduction: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="0"/></div>
                                                    ) : (
                                                        <div className="text-sm text-slate-600 dark:text-slate-300">Using 2026 Standard Deduction for <b>{plannerData.filingStatus}</b>: {formatCurrency.format(plannerResults.deduction)}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Section C: Adjustments */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                            <button onClick={() => setAdvSection(advSection === 'adjustments' ? null : 'adjustments')} className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"><Shield size={16}/></div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">C. Adjustments</div>
                                                        <div className="text-xs text-slate-600 dark:text-slate-300">Retirement, HSA, Health Ins</div>
                                                    </div>
                                                </div>
                                                {advSection === 'adjustments' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                            </button>
                                            {advSection === 'adjustments' && (
                                                <div className="p-4 bg-white dark:bg-slate-950 grid grid-cols-1 gap-4 animate-in slide-in-from-top-2">
                                                    <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Retirement Contributions</label><input type="number" value={plannerData.retirement || ''} onChange={e => setPlannerData(p => ({...p, retirement: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="0"/></div>
                                                    <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">HSA Contributions</label><input type="number" value={plannerData.adjustmentHSA || ''} onChange={e => setPlannerData(p => ({...p, adjustmentHSA: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="0"/></div>
                                                    <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">SE Health Insurance</label><input type="number" value={plannerData.adjustmentHealth || ''} onChange={e => setPlannerData(p => ({...p, adjustmentHealth: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="0"/></div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Section D: Credits & SE Tax */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                            <button onClick={() => setAdvSection(advSection === 'credits' ? null : 'credits')} className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center"><CreditCard size={16}/></div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">D. Credits & Taxes</div>
                                                        <div className="text-xs text-slate-600 dark:text-slate-300">Credits, SE Tax Toggle</div>
                                                    </div>
                                                </div>
                                                {advSection === 'credits' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                            </button>
                                            {advSection === 'credits' && (
                                                <div className="p-4 bg-white dark:bg-slate-950 animate-in slide-in-from-top-2 space-y-4">
                                                    <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Expected Credits ($)</label><input type="number" value={plannerData.credits || ''} onChange={e => setPlannerData(p => ({...p, credits: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="0"/></div>
                                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-900">
                                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Apply SE Tax (~15.3%)</label>
                                                        <button 
                                                            onClick={() => setPlannerData(p => ({...p, useSE: !p.useSE}))}
                                                            className={`w-10 h-5 rounded-full relative transition-colors ${plannerData.useSE ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                        >
                                                            <div className={`absolute top-1 bottom-1 w-3 bg-white rounded-full transition-all ${plannerData.useSE ? 'left-6' : 'left-1'}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Section E: QBI Deduction (Optional) */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                            <button onClick={() => setAdvSection(advSection === 'qbi' ? null : 'qbi')} className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center"><Briefcase size={16}/></div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">E. QBI Deduction (Optional)</div>
                                                        <div className="text-xs text-slate-600 dark:text-slate-300">Section 199A Estimate</div>
                                                    </div>
                                                </div>
                                                {advSection === 'qbi' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                            </button>
                                            {advSection === 'qbi' && (
                                                <div className="p-4 bg-white dark:bg-slate-950 animate-in slide-in-from-top-2 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Apply QBI Deduction</label>
                                                        <button 
                                                            onClick={() => setPlannerData(p => ({...p, applyQBI: !p.applyQBI}))}
                                                            className={`w-10 h-5 rounded-full relative transition-colors ${plannerData.applyQBI ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                        >
                                                            <div className={`absolute top-1 bottom-1 w-3 bg-white rounded-full transition-all ${plannerData.applyQBI ? 'left-6' : 'left-1'}`} />
                                                        </button>
                                                    </div>
                                                    {plannerData.applyQBI && (
                                                        <>
                                                            <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">QBI Amount Override ($)</label><input type="number" value={plannerData.qbiOverride || ''} onChange={e => setPlannerData(p => ({...p, qbiOverride: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="Default: Profit"/></div>
                                                            <div className="text-xs text-slate-600 dark:text-slate-300 italic">Eligibility limits vary. Estimate is 20% of QBI base.</div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Section F: Payments & On-Track */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                            <button onClick={() => setAdvSection(advSection === 'payments' ? null : 'payments')} className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center"><CheckCircle size={16}/></div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">F. Payments & On-Track</div>
                                                        <div className="text-xs text-slate-600 dark:text-slate-300">YTD Status & Suggestions</div>
                                                    </div>
                                                </div>
                                                {advSection === 'payments' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                            </button>
                                            {advSection === 'payments' && (
                                                <div className="p-4 bg-white dark:bg-slate-950 animate-in slide-in-from-top-2 space-y-4">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Est. Payments YTD</label><input type="number" value={plannerData.paymentsYTD || ''} onChange={e => setPlannerData(p => ({...p, paymentsYTD: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none" placeholder="0"/></div>
                                                        <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Withholding YTD</label><input type="number" value={plannerData.withholdingYTD || ''} onChange={e => setPlannerData(p => ({...p, withholdingYTD: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none" placeholder="0"/></div>
                                                    </div>
                                                    <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Last Year Total Tax (Reference)</label><input type="number" value={plannerData.lastYearTaxRef || ''} onChange={e => setPlannerData(p => ({...p, lastYearTaxRef: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="Optional"/></div>
                                                    
                                                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-900">
                                                        <div className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400 mb-1">Quarterly Suggestion</div>
                                                        <div className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency.format(plannerResults.quarterlySuggestion)} <span className="text-xs font-normal text-slate-500">x 4 payments</span></div>
                                                        <div className="text-[10px] text-slate-600 dark:text-slate-300 mt-2">
                                                            Next Due Dates: Apr 15, Jun 15, Sep 15, Jan 15.
                                                            <br/>Dates may shift for weekends/holidays.
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-5 space-y-3 border border-slate-200 dark:border-slate-800">
                                {plannerTab === 'advanced' && (
                                    <>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Other Income</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency.format(plannerResults.otherIncome)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Total Adjustments</span>
                                            <span className="font-bold text-slate-900 dark:text-white">-{formatCurrency.format(plannerResults.adjustments)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Deduction Used ({plannerData.deductionMode === 'itemized' ? 'Itemized' : 'Standard'})</span>
                                            <span className="font-bold text-slate-900 dark:text-white">-{formatCurrency.format(plannerResults.deduction)}</span>
                                        </div>
                                        {plannerResults.qbiDeduction > 0 && (
                                           <div className="flex justify-between items-center text-sm">
                                               <span className="text-slate-600 dark:text-slate-300 font-medium">QBI Deduction (Est.)</span>
                                               <span className="font-bold text-emerald-600 dark:text-emerald-400">-{formatCurrency.format(plannerResults.qbiDeduction)}</span>
                                           </div>
                                        )}
                                    </>
                                )}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600 dark:text-slate-300 font-medium">Projected Taxable Income</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency.format(plannerResults.taxableIncome)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600 dark:text-slate-300 font-medium">Income Tax (Annual)</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency.format(plannerResults.incomeTax)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600 dark:text-slate-300 font-medium">SE Tax (Annual)</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency.format(plannerResults.seTax)}</span>
                                </div>
                                <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-extrabold uppercase text-slate-700 dark:text-slate-200">Total Est. Annual Tax</span>
                                    <span className="text-xl font-extrabold text-slate-900 dark:text-white">{formatCurrency.format(plannerResults.totalTax)}</span>
                                </div>
                                {plannerTab === 'advanced' ? (
                                    <>
                                        <div className="flex justify-between items-center text-sm mt-1">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Less: Paid YTD</span>
                                            <span className="font-bold text-slate-900 dark:text-white">-{formatCurrency.format(plannerResults.paidSoFar)}</span>
                                        </div>
                                        <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
                                        <div className="flex justify-between items-center">
                                             <div className="flex items-center gap-2">
                                                <span className="text-sm font-extrabold uppercase text-slate-700 dark:text-slate-200">{plannerResults.taxAhead > 0 ? 'Ahead by' : 'Remaining Due'}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${plannerResults.taxAhead > 0 ? 'bg-emerald-100 text-emerald-700' : plannerResults.taxRemaining > 0 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {plannerResults.taxAhead > 0 ? 'Ahead' : plannerResults.taxRemaining > 0 ? 'Behind' : 'On Track'}
                                                </span>
                                             </div>
                                             <span className={`text-xl font-extrabold ${plannerResults.taxAhead > 0 ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>{formatCurrency.format(plannerResults.taxAhead > 0 ? plannerResults.taxAhead : plannerResults.taxRemaining)}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 text-center">
                                            <div className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">Monthly Set-Aside</div>
                                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency.format(plannerResults.monthly)}</div>
                                        </div>
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 text-center">
                                            <div className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">Quarterly Payment</div>
                                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency.format(plannerResults.quarterly)}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

              {/* P&L Preview Modal */}
              {showPLPreview && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-stretch justify-stretch p-0 modal-overlay">
                  <div className="bg-white dark:bg-slate-900 rounded-none w-full h-full overflow-hidden flex flex-col">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        {isGeneratingPLPdf ? (
                          <Loader2 className="animate-spin text-blue-600" size={18} />
                        ) : plExportRequested ? (
                          <Download className="text-emerald-600" size={18} />
                        ) : (
                          <Eye className="text-blue-600" size={18} />
                        )}
                        <span className="font-bold text-sm uppercase tracking-wider text-slate-700 dark:text-slate-200">
                          {isGeneratingPLPdf ? 'Generating PDF...' : plExportRequested ? 'Exporting PDF...' : 'Previewing P&L'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isGeneratingPLPdf && !plExportRequested && (
                          <>
                            <button
                              onClick={sharePLPDF}
                              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors"
                            >
                              <Share2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Share</span>
                            </button>

                            <button
                              onClick={() => setPlExportRequested(true)}
                              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              <span className="hidden sm:inline">Download PDF</span>
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => { setPlExportRequested(false); closePLPreview(); }}
                          className="w-11 h-11 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* PDF Preview Content */}
                    <div className="flex-1 overflow-y-auto p-0 bg-white">
                      <div id="pl-pdf-preview-content" className="moniezi-report-font w-full min-h-full bg-white text-gray-900 p-6 sm:p-10" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
                        {/* Header */}
                        <div className="mb-8 pb-6 border-b-2 border-gray-400">
                          <div className="flex items-start gap-4">
                            <Building size={32} className="mt-1 text-blue-600" />
                            <div className="flex-1 min-w-0">
                              <h1 className="text-2xl font-bold text-gray-900 mb-1 text-left">{settings.businessName}</h1>
                              {settings.businessAddress && (
                                <p className="text-sm text-gray-700 whitespace-pre-line text-left">{settings.businessAddress}</p>
                              )}
                              <div className="mt-4 text-left">
                                <h2 className="text-xl font-bold text-gray-900 uppercase">Profit &amp; Loss Statement</h2>
                                <p className="text-sm text-gray-700 mt-1">
                                  Period: {plPeriodType === 'month' ? referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) :
                                      plPeriodType === 'quarter' ? `Q${Math.floor(referenceDate.getMonth() / 3) + 1} ${referenceDate.getFullYear()}` :
                                      plPeriodType === 'year' ? referenceDate.getFullYear().toString() : 'All Time'}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Generated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Revenue Section */}
                        <div className="mb-8">
                          <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                            <h3 className="text-lg font-bold text-gray-900 uppercase">Revenue</h3>
                          </div>
                          <div className="space-y-2 ml-7">
                            {(() => {
                              const incomeByCategory = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => {
                                acc[t.category] = (acc[t.category] || 0) + t.amount;
                                return acc;
                              }, {} as Record<string, number>);
                              return Object.entries(incomeByCategory).map(([category, amount]) => (
                                <div key={category} className="flex items-start justify-between gap-4 py-2">
                                  <span className="text-sm text-gray-800 flex-1 min-w-0 break-words">{category}</span>
                                  <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">{formatCurrency.format(amount)}</span>
                                </div>
                              ));
                            })()}
                          </div>
                          <div className="flex justify-between items-center py-3 mt-2 border-t border-gray-400">
                            <span className="font-bold text-gray-900">Total Revenue</span>
                            <span className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency.format(reportData.income)}</span>
                          </div>
                        </div>

                        {/* Expenses Section */}
                        <div className="mb-8">
                          <div className="flex items-center gap-2 mb-4">
                            <TrendingDown className="w-5 h-5 text-red-600" />
                            <h3 className="text-lg font-bold text-gray-900 uppercase">Operating Expenses</h3>
                          </div>
                          <div className="space-y-2 ml-7">
                            {(() => {
                              const expensesByCategory = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => {
                                acc[t.category] = (acc[t.category] || 0) + t.amount;
                                return acc;
                              }, {} as Record<string, number>);
                              return Object.entries(expensesByCategory).map(([category, amount]) => (
                                <div key={category} className="flex items-start justify-between gap-4 py-2">
                                  <span className="text-sm text-gray-800 flex-1 min-w-0 break-words">{category}</span>
                                  <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">{formatCurrency.format(amount)}</span>
                                </div>
                              ));
                            })()}
                          </div>
                          <div className="flex justify-between items-center py-3 mt-2 border-t border-gray-400">
                            <span className="font-bold text-gray-900">Total Expenses</span>
                            <span className="text-lg font-bold text-red-600 tabular-nums">{formatCurrency.format(reportData.expense)}</span>
                          </div>
                        </div>

                        {/* Net Profit Section */}
                        <div className="pt-6 border-t-2 border-gray-900">
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-xl font-bold text-gray-900 uppercase">Net Profit</span>
                            <span className={`text-3xl font-bold tabular-nums ${reportData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatCurrency.format(reportData.netProfit)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 bg-gray-100 px-4 rounded">
                            <span className="text-sm font-semibold text-gray-800">Profit Margin</span>
                            <span className={`text-lg font-bold tabular-nums ${reportData.income > 0 && reportData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {reportData.income > 0 ? `${((reportData.netProfit / reportData.income) * 100).toFixed(1)}%` : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Summary Statistics */}
                        <div className="mt-8 pt-6 border-t border-gray-300">
                          <h4 className="text-sm font-bold text-gray-700 uppercase mb-3">Transaction Summary</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-gray-100 p-3 rounded">
                              <div className="text-xs text-gray-700 mb-1">Income Transactions</div>
                              <div className="text-xl font-bold text-gray-900">
                                {filteredTransactions.filter(t => t.type === 'income').length}
                              </div>
                            </div>
                            <div className="bg-gray-100 p-3 rounded">
                              <div className="text-xs text-gray-700 mb-1">Expense Transactions</div>
                              <div className="text-xl font-bold text-gray-900">
                                {filteredTransactions.filter(t => t.type === 'expense').length}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-8 pt-6 border-t border-gray-300 text-center">
                          <p className="text-xs text-gray-600">
                            This statement has been prepared from the books of {settings.businessName}.
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            For period ending {plPeriodType === 'month' ? referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) :
                                              plPeriodType === 'quarter' ? `Q${Math.floor(referenceDate.getMonth() / 3) + 1} ${referenceDate.getFullYear()}` :
                                              plPeriodType === 'year' ? referenceDate.getFullYear().toString() : 'All Time'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
                      <button
                        onClick={closePLPreview}
                        className="px-6 py-3 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Close
                      </button>
                      <button
                        onClick={async () => {
                          setIsGeneratingPDF(true);
                          try {
                            await waitForMonieziFonts();
                            const element = document.getElementById('pl-pdf-preview-content');
                            if (!element) throw new Error('Preview content not found');
                            
                            const periodLabel = plPeriodType === 'month' 
                              ? referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                              : plPeriodType === 'quarter' 
                                ? `Q${Math.floor(referenceDate.getMonth() / 3) + 1} ${referenceDate.getFullYear()}`
                                : plPeriodType === 'year'
                                  ? referenceDate.getFullYear().toString()
                                  : 'All-Time';
                            
                            // IMPORTANT (iPhone/Safari): getBoundingClientRect() can under-report height for
                            // long, scrollable content, which causes the bottom of the PDF (notes/footer) to be cut off.
                            // Solution: clone to an off-screen wrapper (no scroll clipping) and size the PDF
                            // to the full scrollHeight so the export is ONE long page (no page breaks).
                            let cloneWrapper: HTMLDivElement | null = null;
                            try {
                              const source = element as HTMLElement;

                              cloneWrapper = document.createElement('div');
                              cloneWrapper.style.position = 'fixed';
                              cloneWrapper.style.left = '-100000px';
                              cloneWrapper.style.top = '0';
                              cloneWrapper.style.width = `${source.scrollWidth}px`;
                              cloneWrapper.style.background = '#ffffff';
                              cloneWrapper.style.padding = '0';
                              cloneWrapper.style.margin = '0';
                              cloneWrapper.style.zIndex = '-1';

                              const clone = prepareProfitLossPdfClone(source);

                              cloneWrapper.appendChild(clone);
                              document.body.appendChild(cloneWrapper);

                              await new Promise(resolve => requestAnimationFrame(() => resolve(true)));

                              const contentWidth = clone.scrollWidth;
                              const contentHeight = clone.scrollHeight;

                              const pxToMm = 0.264583; // 96 DPI px -> mm
                              const pageWidthMm = 210;
                              const marginMm = 8;
                              const contentWidthMm = pageWidthMm - (marginMm * 2);

                              const scaleFactor = contentWidthMm / (contentWidth * pxToMm);
                              const pageHeightMm = Math.ceil((contentHeight * pxToMm * scaleFactor) + (marginMm * 2) + 2);

                              const opt = {
                                margin: [marginMm, marginMm, marginMm, marginMm],
                                filename: `PL-Statement-${periodLabel.replace(/\s+/g, '-')}.pdf`,
                                image: { type: 'jpeg', quality: 0.95 },
                                html2canvas: {
                                  scale: 2,
                                  useCORS: true,
                                  backgroundColor: '#ffffff',
                                  logging: false,
                                  scrollY: 0,
                                  scrollX: 0,
                                  windowWidth: contentWidth,
                                  windowHeight: contentHeight
                                },
                                jsPDF: {
                                  unit: 'mm',
                                  format: [pageWidthMm, Math.max(297, pageHeightMm)],
                                  orientation: 'portrait'
                                },
                                pagebreak: { mode: 'avoid-all' }
                              };

                              await html2pdf().set(opt).from(clone).save();
                            } finally {
                              if (cloneWrapper && cloneWrapper.parentNode) cloneWrapper.parentNode.removeChild(cloneWrapper);
                            }
                            showToast('PDF exported successfully!', 'success');
                            setTimeout(() => closePLPreview(), 1000);
                          } catch (error) {
                            console.error('PDF generation error:', error);
                            showToast('Failed to generate PDF. Please try again.', 'error');
                          }
                          setIsGeneratingPDF(false);
                        }}
                        disabled={isGeneratingPDF}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        {isGeneratingPDF ? 'Generating...' : 'Export PDF'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md"><div className="flex items-center gap-2 mb-4 text-emerald-600"><Shield size={20} /><span className="font-bold uppercase tracking-widest text-xs">Tax Shield</span></div><div className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">{formatCurrency.format(reportData.taxShield)}</div><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">Your expenses have lowered your estimated tax bill by this amount. Every valid business expense saves you money at tax time.</p></div>
                 
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md">
                   <div className="flex items-center gap-2 mb-4 text-blue-600">
                     <BookOpen size={20} />
                     <span className="font-bold uppercase tracking-widest text-xs">2026 Standard Deduction</span>
                   </div>
                   
                   {/* Filing Status Dropdown */}
                   <div className="mb-4">
                     <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block uppercase tracking-wide">Filing Status</label>
                     <select
                       value={settings.filingStatus}
                       onChange={(e) => {
                         const newStatus = e.target.value as FilingStatus;
                         setSettings(prev => ({ ...prev, filingStatus: newStatus }));
                       }}
                       className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                     >
                       <option value="single">Single</option>
                       <option value="joint">Married Filing Jointly</option>
                       <option value="separate">Married Filing Separately</option>
                       <option value="head">Head of Household</option>
                     </select>
                   </div>
                   
                   {/* Deduction Amount */}
                   <div className="mb-3">
                     <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                       {(() => {
                         if (settings.filingStatus === 'joint') return formatCurrency.format(TAX_PLANNER_2026.STD_DEDUCTION_JOINT);
                         if (settings.filingStatus === 'head') return formatCurrency.format(TAX_PLANNER_2026.STD_DEDUCTION_HEAD);
                         return formatCurrency.format(TAX_PLANNER_2026.STD_DEDUCTION_SINGLE);
                       })()}
                     </div>
                   </div>
                   
                   <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                     Compare your personal itemized deductions against this standard amount. This affects your personal income tax, not SE tax.
                   </p>
                 </div>
              </div>
           </div>
        )}

        {/* Pro P&L Preview Modal - OUTSIDE Reports conditional for proper rendering */}
        {showProPLPreview && typeof document !== 'undefined' && document.body && createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-stretch justify-stretch p-0 modal-overlay" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="bg-gray-100 w-full h-full overflow-hidden flex flex-col overscroll-contain">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-3 pb-3 pt-3 sm:p-4 border-b border-gray-300 bg-white flex-shrink-0" style={{ minHeight: 'calc(60px + env(safe-area-inset-top, 0px))' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => setShowProPLPreview(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <span className="font-bold text-sm text-gray-900">P&L Preview</span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={shareProPLPDF}
                    disabled={isGeneratingProPLPdf}
                    className="px-3 sm:px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isGeneratingProPLPdf ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                    <span>{isGeneratingProPLPdf ? 'Preparing...' : 'SHARE'}</span>
                  </button>
                  <button
                    onClick={saveProPLPDF}
                    disabled={isGeneratingProPLPdf}
                    className="px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isGeneratingProPLPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    <span>{isGeneratingProPLPdf ? 'Preparing...' : 'Download PDF'}</span>
                  </button>
                </div>
              </div>

              {/* PDF Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div id="pro-pl-pdf-content" className="moniezi-report-font bg-slate-50 text-slate-900 rounded-[24px] shadow-lg mx-auto overflow-hidden border border-slate-200" style={{ fontFamily: 'var(--moniezi-report-font)', width: '760px', maxWidth: '100%' }}>
                  <div className="bg-slate-950 text-white px-6 sm:px-8 pt-7 pb-6">
                    <div className="flex items-start justify-between gap-6">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-200">MONIEZI PROFIT &amp; LOSS</div>
                        <h1 className="mt-3 text-[28px] leading-tight font-extrabold tracking-tight">Premium Business Statement</h1>
                        <p className="mt-2 max-w-[480px] text-sm leading-6 text-slate-300">
                          A clean operating statement summarizing revenue, direct costs, operating expenses, and net income from your local MONIEZI records.
                        </p>
                      </div>
                      {settings.businessLogo && (
                        <img
                          src={settings.businessLogo}
                          alt="Logo"
                          className="h-12 sm:h-14 w-auto max-w-[170px] object-contain rounded-xl bg-white/95 p-2"
                          crossOrigin="anonymous"
                        />
                      )}
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200">Business</div>
                        <div className="mt-2 text-base font-bold text-white">{settings.businessName}</div>
                        <div className="mt-1 text-xs text-slate-300">Prepared privately from your local MONIEZI records.</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200">Reporting Period</div>
                        <div className="mt-2 text-sm font-semibold text-white">
                          {proPLData.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {proPLData.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="mt-1 text-xs text-slate-300">{proPLData.periodLabel}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200">Accounting Basis</div>
                        <div className="mt-2 text-base font-bold text-white">{plAccountingBasis === 'cash' ? 'Cash Basis' : 'Accrual Basis'}</div>
                        <div className="mt-1 text-xs text-slate-300">USD statement format with expense grouping and margin analysis.</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200">Generated</div>
                        <div className="mt-2 text-sm font-semibold text-white">
                          {new Date().toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="mt-1 text-xs text-slate-300">Export timestamp for this statement package.</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 px-6 sm:px-8 py-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Net Revenue</div>
                        <div className="mt-2 text-[24px] font-extrabold text-slate-950 tabular-nums">{formatCurrency.format(proPLData.netRevenue)}</div>
                        <div className={`mt-2 text-xs font-semibold ${proPLData.revenueChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {proPLData.revenueChange >= 0 ? 'Up' : 'Down'} {Math.abs(proPLData.revenueChange).toFixed(1)}% vs prior period
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Gross Profit</div>
                        <div className="mt-2 text-[24px] font-extrabold text-slate-950 tabular-nums">{formatCurrency.format(proPLData.grossProfit)}</div>
                        <div className="mt-2 text-xs font-semibold text-slate-600">Gross margin {proPLData.grossMargin.toFixed(1)}%</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Operating Expenses</div>
                        <div className="mt-2 text-[24px] font-extrabold text-slate-950 tabular-nums">{formatCurrency.format(proPLData.totalOpex)}</div>
                        <div className={`mt-2 text-xs font-semibold ${proPLData.opexChange <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {proPLData.opexChange <= 0 ? 'Down' : 'Up'} {Math.abs(proPLData.opexChange).toFixed(1)}% vs prior period
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Net Income</div>
                        <div className={`mt-2 text-[24px] font-extrabold tabular-nums ${proPLData.netIncome >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {proPLData.netIncome < 0 ? `(${formatCurrency.format(Math.abs(proPLData.netIncome))})` : formatCurrency.format(proPLData.netIncome)}
                        </div>
                        <div className={`mt-2 text-xs font-semibold ${proPLData.netIncomeChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {proPLData.netIncomeChange >= 0 ? 'Up' : 'Down'} {Math.abs(proPLData.netIncomeChange).toFixed(1)}% vs prior period
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Transactions Included</div>
                        <div className="mt-2 text-lg font-bold text-slate-950 tabular-nums">{proPLData.transactionCount}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Operating Margin</div>
                        <div className="mt-2 text-lg font-bold text-slate-950 tabular-nums">{proPLData.operatingMargin.toFixed(1)}%</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Net Margin</div>
                        <div className="mt-2 text-lg font-bold text-slate-950 tabular-nums">{proPLData.netMargin.toFixed(1)}%</div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-5" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                      <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-700">Section 1</div>
                        <div className="mt-1 text-lg font-bold text-slate-950">Revenue &amp; Sales</div>
                        <div className="mt-1 text-xs text-slate-500">Gross sales categories, refunds, and net revenue for the selected reporting period.</div>
                      </div>
                      <div className="px-5 py-4">
                        <div className="flex items-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 border-b border-slate-200 pb-2 mb-2">
                          <div className="flex-1 min-w-0">Account</div>
                          <div className="w-28 text-right flex-shrink-0">Amount</div>
                          <div className="w-16 text-right flex-shrink-0">% Rev</div>
                        </div>
                        {Object.entries(proPLData.incomeByCategory)
                          .sort(([, a], [, b]) => b - a)
                          .map(([category, amount]) => (
                            <div key={category} className="flex items-center py-2 border-b border-slate-100 last:border-b-0">
                              <div className="flex-1 pr-4 text-slate-700">{category}</div>
                              <div className="w-28 text-right font-semibold tabular-nums text-slate-950">{formatCurrency.format(amount)}</div>
                              <div className="w-16 text-right text-xs text-slate-500">{proPLData.netRevenue > 0 ? `${((amount / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                            </div>
                          ))}
                        {Object.keys(proPLData.incomeByCategory).length > 1 && (
                          <div className="flex items-center py-2 mt-2 font-bold border-t border-slate-200 text-slate-900">
                            <div className="flex-1">Total Gross Sales</div>
                            <div className="w-28 text-right tabular-nums">{formatCurrency.format(proPLData.salesServices)}</div>
                            <div className="w-16 text-right text-xs text-slate-500">{proPLData.netRevenue > 0 ? `${((proPLData.salesServices / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                          </div>
                        )}
                        {proPLData.refunds > 0 && (
                          <div className="flex items-center py-2 mt-1 rounded-2xl bg-red-50 px-3 text-red-700">
                            <div className="flex-1 italic">Less: Returns &amp; Refunds</div>
                            <div className="w-28 text-right font-semibold tabular-nums">({formatCurrency.format(proPLData.refunds)})</div>
                            <div className="w-16 text-right text-xs"> </div>
                          </div>
                        )}
                        <div className="flex items-center py-3 mt-3 rounded-2xl bg-emerald-50 px-4 font-bold text-emerald-900">
                          <div className="flex-1 uppercase tracking-[0.12em] text-sm">Net Revenue</div>
                          <div className="w-28 text-right tabular-nums text-lg">{formatCurrency.format(proPLData.netRevenue)}</div>
                          <div className="w-16 text-right text-xs">100.0%</div>
                        </div>
                      </div>
                    </div>

                    {proPLData.cogs > 0 && (
                      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-5" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-700">Section 2</div>
                          <div className="mt-1 text-lg font-bold text-slate-950">Direct Costs &amp; Gross Profit</div>
                          <div className="mt-1 text-xs text-slate-500">Direct costs recorded as cost of goods sold and the resulting gross profit position.</div>
                        </div>
                        <div className="px-5 py-4">
                          <div className="flex items-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 border-b border-slate-200 pb-2 mb-2">
                            <div className="flex-1 min-w-0">Account</div>
                            <div className="w-28 text-right flex-shrink-0">Amount</div>
                            <div className="w-16 text-right flex-shrink-0">% Rev</div>
                          </div>
                          {Object.entries(proPLData.cogsByCategory)
                            .sort(([, a], [, b]) => b - a)
                            .map(([category, amount]) => (
                              <div key={category} className="flex items-center py-2 border-b border-slate-100 last:border-b-0">
                                <div className="flex-1 pr-4 text-slate-700">{category}</div>
                                <div className="w-28 text-right font-semibold tabular-nums text-slate-950">{formatCurrency.format(amount)}</div>
                                <div className="w-16 text-right text-xs text-slate-500">{proPLData.netRevenue > 0 ? `${((amount / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                              </div>
                            ))}
                          <div className="flex items-center py-2 mt-2 font-bold border-t border-slate-200 text-slate-900">
                            <div className="flex-1">Total COGS</div>
                            <div className="w-28 text-right tabular-nums">{formatCurrency.format(proPLData.cogs)}</div>
                            <div className="w-16 text-right text-xs text-slate-500">{proPLData.netRevenue > 0 ? `${((proPLData.cogs / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                          </div>
                          <div className="flex items-center py-3 mt-3 rounded-2xl bg-blue-50 px-4 font-bold text-slate-900">
                            <div className="flex-1 uppercase tracking-[0.12em] text-sm">Gross Profit</div>
                            <div className="w-28 text-right tabular-nums text-lg">{formatCurrency.format(proPLData.grossProfit)}</div>
                            <div className="w-16 text-right text-xs">{proPLData.grossMargin.toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-5" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                      <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-700">Section {proPLData.cogs > 0 ? '3' : '2'}</div>
                        <div className="mt-1 text-lg font-bold text-slate-950">Operating Expense Structure</div>
                        <div className="mt-1 text-xs text-slate-500">Grouped operating expenses organized into accountant-friendly buckets.</div>
                      </div>
                      <div className="px-5 py-4">
                        <div className="flex items-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 border-b border-slate-200 pb-2 mb-2">
                          <div className="flex-1 min-w-0">Account</div>
                          <div className="w-28 text-right flex-shrink-0">Amount</div>
                          <div className="w-16 text-right flex-shrink-0">% Rev</div>
                        </div>

                        {proPLData.payrollTotal > 0 && (
                          <>
                            <div className="flex items-center py-2 font-bold rounded-2xl bg-slate-50 px-4 mt-2">
                              <div className="flex-1 text-slate-900">Payroll &amp; Labor</div>
                              <div className="w-28 text-right tabular-nums text-slate-900">{formatCurrency.format(proPLData.payrollTotal)}</div>
                              <div className="w-16 text-right text-xs text-slate-500">{proPLData.netRevenue > 0 ? `${((proPLData.payrollTotal / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                            </div>
                            {proPLData.payrollItems.map(([cat, amt]) => (
                              <div key={cat} className="flex items-center py-1.5 border-b border-slate-100 last:border-b-0">
                                <div className="flex-1 pl-4 pr-4 text-slate-600">{cat}</div>
                                <div className="w-28 text-right tabular-nums text-slate-700">{formatCurrency.format(amt)}</div>
                                <div className="w-16 text-right text-xs text-slate-400">{proPLData.netRevenue > 0 ? `${((amt / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                              </div>
                            ))}
                          </>
                        )}

                        {proPLData.occupancyTotal > 0 && (
                          <>
                            <div className="flex items-center py-2 font-bold rounded-2xl bg-slate-50 px-4 mt-3">
                              <div className="flex-1 text-slate-900">Occupancy &amp; Facilities</div>
                              <div className="w-28 text-right tabular-nums text-slate-900">{formatCurrency.format(proPLData.occupancyTotal)}</div>
                              <div className="w-16 text-right text-xs text-slate-500">{proPLData.netRevenue > 0 ? `${((proPLData.occupancyTotal / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                            </div>
                            {proPLData.occupancyItems.map(([cat, amt]) => (
                              <div key={cat} className="flex items-center py-1.5 border-b border-slate-100 last:border-b-0">
                                <div className="flex-1 pl-4 pr-4 text-slate-600">{cat}</div>
                                <div className="w-28 text-right tabular-nums text-slate-700">{formatCurrency.format(amt)}</div>
                                <div className="w-16 text-right text-xs text-slate-400">{proPLData.netRevenue > 0 ? `${((amt / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                              </div>
                            ))}
                          </>
                        )}

                        {proPLData.marketingTotal > 0 && (
                          <>
                            <div className="flex items-center py-2 font-bold rounded-2xl bg-slate-50 px-4 mt-3">
                              <div className="flex-1 text-slate-900">Marketing &amp; Advertising</div>
                              <div className="w-28 text-right tabular-nums text-slate-900">{formatCurrency.format(proPLData.marketingTotal)}</div>
                              <div className="w-16 text-right text-xs text-slate-500">{proPLData.netRevenue > 0 ? `${((proPLData.marketingTotal / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                            </div>
                            {proPLData.marketingItems.map(([cat, amt]) => (
                              <div key={cat} className="flex items-center py-1.5 border-b border-slate-100 last:border-b-0">
                                <div className="flex-1 pl-4 pr-4 text-slate-600">{cat}</div>
                                <div className="w-28 text-right tabular-nums text-slate-700">{formatCurrency.format(amt)}</div>
                                <div className="w-16 text-right text-xs text-slate-400">{proPLData.netRevenue > 0 ? `${((amt / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                              </div>
                            ))}
                          </>
                        )}

                        {proPLData.gaTotal > 0 && (
                          <>
                            <div className="flex items-center py-2 font-bold rounded-2xl bg-slate-50 px-4 mt-3">
                              <div className="flex-1 text-slate-900">General &amp; Administrative</div>
                              <div className="w-28 text-right tabular-nums text-slate-900">{formatCurrency.format(proPLData.gaTotal)}</div>
                              <div className="w-16 text-right text-xs text-slate-500">{proPLData.netRevenue > 0 ? `${((proPLData.gaTotal / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                            </div>
                            {proPLData.gaItems.map(([cat, amt]) => (
                              <div key={cat} className="flex items-center py-1.5 border-b border-slate-100 last:border-b-0">
                                <div className="flex-1 pl-4 pr-4 text-slate-600">{cat}</div>
                                <div className="w-28 text-right tabular-nums text-slate-700">{formatCurrency.format(amt)}</div>
                                <div className="w-16 text-right text-xs text-slate-400">{proPLData.netRevenue > 0 ? `${((amt / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                              </div>
                            ))}
                          </>
                        )}

                        {proPLData.otherExpenses > 0 && (
                          <div className="flex items-center py-2 font-bold rounded-2xl bg-slate-50 px-4 mt-3">
                            <div className="flex-1 text-slate-900">Other Expenses</div>
                            <div className="w-28 text-right tabular-nums text-slate-900">{formatCurrency.format(proPLData.otherExpenses)}</div>
                            <div className="w-16 text-right text-xs text-slate-500">{proPLData.netRevenue > 0 ? `${((proPLData.otherExpenses / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                          </div>
                        )}

                        <div className="flex items-center py-3 mt-4 rounded-2xl bg-red-50 px-4 font-bold text-red-800">
                          <div className="flex-1 uppercase tracking-[0.12em] text-sm">Total Operating Expenses</div>
                          <div className="w-28 text-right tabular-nums text-lg">{formatCurrency.format(proPLData.totalOpex)}</div>
                          <div className="w-16 text-right text-xs">{proPLData.netRevenue > 0 ? `${((proPLData.totalOpex / proPLData.netRevenue) * 100).toFixed(1)}%` : '—'}</div>
                        </div>

                        <div className="flex items-center py-3 mt-3 rounded-2xl bg-slate-100 px-4 font-bold text-slate-900">
                          <div className="flex-1 uppercase tracking-[0.12em] text-sm">Operating Income</div>
                          <div className={`w-28 text-right tabular-nums text-lg ${proPLData.operatingIncome >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {proPLData.operatingIncome < 0 ? `(${formatCurrency.format(Math.abs(proPLData.operatingIncome))})` : formatCurrency.format(proPLData.operatingIncome)}
                          </div>
                          <div className="w-16 text-right text-xs">{proPLData.operatingMargin.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>

                    {(proPLData.interestIncome > 0 || proPLData.interestExpense > 0) && (
                      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-5" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-700">Section {proPLData.cogs > 0 ? '4' : '3'}</div>
                          <div className="mt-1 text-lg font-bold text-slate-950">Other Income / Expense</div>
                          <div className="mt-1 text-xs text-slate-500">Below-the-line income and expense items that sit outside core operating activity.</div>
                        </div>
                        <div className="px-5 py-4">
                          <div className="flex items-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 border-b border-slate-200 pb-2 mb-2">
                            <div className="flex-1 min-w-0">Account</div>
                            <div className="w-28 text-right flex-shrink-0">Amount</div>
                            <div className="w-16 text-right flex-shrink-0"> </div>
                          </div>
                          {proPLData.interestIncome > 0 && (
                            <div className="flex items-center py-2 border-b border-slate-100">
                              <div className="flex-1 pr-4 text-slate-700">Interest Income</div>
                              <div className="w-28 text-right font-semibold tabular-nums text-emerald-700">{formatCurrency.format(proPLData.interestIncome)}</div>
                              <div className="w-16 text-right text-xs text-slate-400"> </div>
                            </div>
                          )}
                          {proPLData.interestExpense > 0 && (
                            <div className="flex items-center py-2 border-b border-slate-100">
                              <div className="flex-1 pr-4 text-slate-700">Interest Expense</div>
                              <div className="w-28 text-right font-semibold tabular-nums text-red-700">({formatCurrency.format(proPLData.interestExpense)})</div>
                              <div className="w-16 text-right text-xs text-slate-400"> </div>
                            </div>
                          )}
                          <div className="flex items-center py-3 mt-3 rounded-2xl bg-emerald-50 px-4 font-bold text-slate-900">
                            <div className="flex-1 uppercase tracking-[0.12em] text-sm">Net Other Income</div>
                            <div className={`w-28 text-right tabular-nums text-lg ${proPLData.netOtherIncome >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              {proPLData.netOtherIncome < 0 ? `(${formatCurrency.format(Math.abs(proPLData.netOtherIncome))})` : formatCurrency.format(proPLData.netOtherIncome)}
                            </div>
                            <div className="w-16 text-right text-xs"> </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-3xl bg-slate-950 text-white px-5 py-5 mb-5" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-200">Final Result</div>
                      <div className="mt-2 flex items-end justify-between gap-4">
                        <div>
                          <div className="text-2xl font-extrabold uppercase tracking-tight">Net Income</div>
                          <div className="mt-1 text-sm text-slate-300">After direct costs, operating expenses, and other income or expense.</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-[30px] font-extrabold tabular-nums ${proPLData.netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {proPLData.netIncome < 0 ? `(${formatCurrency.format(Math.abs(proPLData.netIncome))})` : formatCurrency.format(proPLData.netIncome)}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-300">Net Margin {proPLData.netMargin.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                      <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-700">Statement Notes</div>
                        <div className="mt-1 text-lg font-bold text-slate-950">Readiness &amp; Accounting Notes</div>
                        <div className="mt-1 text-xs text-slate-500">Supporting notes to accompany this statement when sharing with an accountant or internal reviewer.</div>
                      </div>
                      <div className="px-5 py-4 text-sm text-slate-600 leading-6">
                        <p>- {plAccountingBasis === 'cash' ? 'Cash' : 'Accrual'} basis applied to this statement.</p>
                        <p>- {proPLData.transactionCount} transactions included in the selected reporting window.</p>
                        {proPLData.uncategorizedCount > 0 ? (
                          <p className="text-amber-700">- {proPLData.uncategorizedCount} uncategorized entries totaling {formatCurrency.format(proPLData.uncategorizedAmount)} should be reviewed.</p>
                        ) : (
                          <p>- No uncategorized entries were detected in this reporting period.</p>
                        )}
                        <p>- Owner draws excluded. Management-use report prepared from local MONIEZI records.</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border-t border-slate-200 px-6 sm:px-8 py-4 text-xs text-slate-500 flex items-center justify-between gap-4">
                    <div>MONIEZI Pro Finance | Generated privately from your local business records.</div>
                    <div>{settings.businessName} | P&amp;L | {proPLData.periodLabel}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ==================== CLIENTS PAGE ==================== */}
        {currentPage === Page.Clients && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-2 sm:p-2.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 flex-shrink-0">
                  <Users size={20} className="sm:w-6 sm:h-6" strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white font-brand">Clients</h2>
              </div>
              <button 
                onClick={() => { 
                  setEditingClient({ status: 'lead' }); 
                  setIsClientModalOpen(true); 
                }} 
                className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-500 transition-all active:scale-95 flex-shrink-0"
              >
                <Plus size={20} className="sm:w-6 sm:h-6" strokeWidth={2.5} />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto custom-scrollbar">
              {(['all', 'lead', 'client', 'inactive'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setClientFilter(f)}
                  className={`flex-1 min-w-[80px] py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                    clientFilter === f 
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {f === 'all' ? `All (${clients.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${clients.filter(c => c.status === f).length})`}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search clients by name, company, or email..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-4 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
              />
            </div>

            {/* Clients List */}
            <div className="space-y-3">
              {(() => {
                const filtered = clients
                  .filter(c => clientFilter === 'all' || c.status === clientFilter)
                  .filter(c => {
                    if (!clientSearch.trim()) return true;
                    const search = clientSearch.toLowerCase();
                    return (
                      c.name.toLowerCase().includes(search) ||
                      (c.company || '').toLowerCase().includes(search) ||
                      (c.email || '').toLowerCase().includes(search)
                    );
                  })
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

                if (filtered.length === 0) {
                  return (
                    <EmptyState
                      icon={<Users size={32} />}
                      title="No Clients Found"
                      subtitle={clientFilter === 'all' 
                        ? "Start by adding your first lead or client." 
                        : `No ${clientFilter}s found. Try adjusting your filters.`}
                      action={() => { 
                        setEditingClient({ status: 'lead' }); 
                        setIsClientModalOpen(true); 
                      }}
                      actionLabel="Add Client"
                    />
                  );
                }

                return filtered.map(client => {
                  const statusColors: Record<ClientStatus, string> = {
                    lead: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                    client: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                    inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  };

                  // Calculate client lifetime value
                  const clientRevenue = invoices
                    .filter(inv => inv.clientId === client.id && inv.status === 'paid')
                    .reduce((sum, inv) => sum + inv.amount, 0);

                  const clientInvoiceCount = invoices.filter(inv => inv.clientId === client.id).length;
                  const clientEstimateCount = estimates.filter(est => est.clientId === client.id).length;

                  return (
                    <div
                      key={client.id}
                      onClick={() => {
                        setEditingClient(client);
                        setIsClientModalOpen(true);
                      }}
                      className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 hover:shadow-lg transition-all cursor-pointer shadow-sm"
                    >
                      {/* Top Row: Icon + Name + Status Badge */}
                      <div className="flex items-start gap-4 mb-3">
                        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                          <User size={20} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                              {client.name}
                            </h3>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${statusColors[client.status]}`}>
                              {client.status}
                            </span>
                          </div>
                          {client.company && (
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                              {client.company}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Contact Info */}
                      {(client.email || client.phone) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300 mb-3">
                          {client.email && (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">✉</span>
                              <span className="truncate">{client.email}</span>
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">☎</span>
                              {client.phone}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes Preview */}
                      {client.notes && (
                        <div className="text-sm text-slate-600 dark:text-slate-300 italic line-clamp-2 mb-3">
                          {client.notes}
                        </div>
                      )}

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800">
                        {clientRevenue > 0 && (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            LTV: {formatCurrency.format(clientRevenue)}
                          </span>
                        )}
                        {clientInvoiceCount > 0 && (
                          <span>{clientInvoiceCount} invoice{clientInvoiceCount !== 1 ? 's' : ''}</span>
                        )}
                        {clientEstimateCount > 0 && (
                          <span>{clientEstimateCount} estimate{clientEstimateCount !== 1 ? 's' : ''}</span>
                        )}
                        <span className="ml-auto">Updated: {new Date(client.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}


        {/* ==================== COMPANY EQUITY PAGE ==================== */}
        {currentPage === Page.CompanyEquity && (
          <CompanyEquityModule
            equity={companyEquity}
            onChange={setCompanyEquity}
            currencySymbol={settings.currencySymbol || '$'}
            defaultBusinessName={settings.businessName || ''}
            showToast={showToast}
          />
        )}

        {currentPage === Page.Settings && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 pb-24">
            {/* Settings Header */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 flex-shrink-0">
                <Settings size={20} className="sm:w-6 sm:h-6" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white font-brand">Settings</h2>
              <div className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">MONIEZI v{CUSTOMER_VERSION}</div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm">
              <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                <button
                  onClick={() => setSettingsTab('backup')}
                  className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                    settingsTab === 'backup'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Shield size={18} />
                  <span className="text-[10px] md:text-sm mt-0.5 md:mt-0">Backup</span>
                </button>

                <button
                  onClick={() => setSettingsTab('update')}
                  className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                    settingsTab === 'update'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <RotateCcw size={18} />
                  <span className="text-[10px] md:text-sm mt-0.5 md:mt-0">Update</span>
                </button>
                
                <button
                  onClick={() => setSettingsTab('branding')}
                  className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                    settingsTab === 'branding'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Palette size={18} />
                  <span className="text-[10px] md:text-sm mt-0.5 md:mt-0">Branding</span>
                </button>
                
                <button
                  onClick={() => setSettingsTab('tax')}
                  className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                    settingsTab === 'tax'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Calculator size={18} />
                  <span className="text-[10px] md:text-sm mt-0.5 md:mt-0">Tax</span>
                </button>
                
                <button
                  onClick={() => setSettingsTab('data')}
                  className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                    settingsTab === 'data'
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Trash2 size={18} />
                  <span className="text-[10px] md:text-sm mt-0.5 md:mt-0">Data</span>
                </button>
                {LICENSING_ENABLED && (
                <button
                  onClick={() => setSettingsTab('license')}
                  className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                    settingsTab === 'license'
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Key size={18} />
                  <span className="text-[10px] md:text-sm mt-0.5 md:mt-0">License</span>
                </button>
                )}
                <button
                  onClick={() => setSettingsTab('offline')}
                  className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                    settingsTab === 'offline'
                      ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <HelpCircle size={18} />
                  <span className="text-[10px] md:text-sm mt-0.5 md:mt-0">Offline</span>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              
              {/* App Update / Refresh Build Tab */}
              {settingsTab === 'update' && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <RotateCcw size={20} strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">App Update / Refresh Build</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Use this before clearing Chrome site data. It checks the installed build, reloads the app, and protects your local records with backup controls.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <button
                      onClick={handleCheckForAppUpdate}
                      className="flex items-center justify-center gap-3 py-5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all font-bold text-sm uppercase tracking-wider active:scale-95"
                    >
                      <RotateCcw size={20} /> Check for Update
                    </button>
                    <button
                      onClick={handleReloadApp}
                      className="flex items-center justify-center gap-3 py-5 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-950 dark:hover:border-white transition-all font-bold text-sm uppercase tracking-wider active:scale-95"
                    >
                      <Repeat size={20} /> Reload App
                    </button>
                    <button
                      onClick={handleResetDemoDataOnly}
                      className="flex items-center justify-center gap-3 py-5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all font-bold text-sm uppercase tracking-wider active:scale-95"
                    >
                      <Sparkles size={20} /> Reset Demo Data Only
                    </button>
                    <button
                      onClick={handleExportBackup}
                      className="flex items-center justify-center gap-3 py-5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all font-bold text-sm uppercase tracking-wider active:scale-95"
                    >
                      <Download size={20} /> Export Backup
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-3 py-5 rounded-lg bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-100 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all font-bold text-sm uppercase tracking-wider active:scale-95 sm:col-span-2"
                    >
                      <Upload size={20} /> Import Backup
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImportBackup}
                      className="hidden"
                      accept=".json"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/10 p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300 mb-1">Current Build</div>
                      <div className="text-lg font-black text-slate-950 dark:text-white">MONIEZI Pro Finance</div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">App version {CUSTOMER_VERSION}</div>
                    </div>
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-1">Important</div>
                      <p className="text-sm leading-6 text-amber-900 dark:text-amber-100">Export a backup before clearing Chrome site data. Browser site-data resets can remove local MONIEZI records on this device.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Offline Setup Tab */}
              {settingsTab === 'offline' && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <HelpCircle size={20} strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Offline Setup</h3>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
                    <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">Use this section anytime you want to review how MONIEZI is installed for offline use on iPhone or Android.</p>
                    <button
                      onClick={openHelp}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-900/20 transition-colors"
                    >
                      <HelpCircle size={18} />
                      Open Offline Setup
                    </button>
                  </div>
                </div>
              )}

              {/* Backup & Restore Tab */}
              {settingsTab === 'backup' && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Shield size={20} strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Backup & Restore</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <button 
                          onClick={handleExportBackup} 
                          className="flex items-center justify-center gap-3 py-5 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all font-bold text-sm uppercase tracking-wider active:scale-95"
                      >
                          <Download size={20} /> Export Backup
                      </button>
                      <button 
                          onClick={() => fileInputRef.current?.click()} 
                          className="flex items-center justify-center gap-3 py-5 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all font-bold text-sm uppercase tracking-wider active:scale-95"
                      >
                          <Upload size={20} /> Import Backup
                      </button>
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleImportBackup} 
                          className="hidden" 
                          accept=".json" 
                      />
                  </div>
                  
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-900 dark:text-amber-100">
                        <p className="font-semibold mb-1">Important Information</p>
                        <p>Save a complete copy of your data to your device. You can restore it later if needed.</p>
                        <p className="mt-2 text-amber-700 dark:text-amber-300 font-bold">⚠️ Warning: Importing a backup will overwrite all current data.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Branding & Customization Tab */}
              {settingsTab === 'branding' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Palette size={20} strokeWidth={2} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Branding & Customization</h3>
                    </div>
                    
                    <div className="mb-8">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-3 block">Business Logo</label>
                        <div className="flex items-start gap-6">
                            <div className="w-24 h-24 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center overflow-hidden relative group">
                                {settings.businessLogo ? (<><img src={settings.businessLogo} alt="Logo" className="w-full h-full object-contain p-2" /><div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity"><button onClick={() => setSettings(s => ({ ...s, businessLogo: undefined }))} className="text-white bg-red-500 p-1.5 rounded-full hover:bg-red-600"><Trash2 size={14} /></button></div></>) : <ImageIcon className="text-slate-300 dark:text-slate-600" size={32} />}
                            </div>
                            <div className="flex-1"><input type="file" ref={logoInputRef} className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={handleLogoUpload} /><button onClick={() => logoInputRef.current?.click()} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors mb-2"><Upload size={14} /> Upload Logo</button><p className="text-xs text-slate-600 dark:text-slate-300">Recommended: PNG with transparent background. Max 2MB.</p></div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-700 dark:text-slate-300">Show Logo on Invoice</span><button onClick={() => setSettings(s => ({ ...s, showLogoOnInvoice: !s.showLogoOnInvoice }))} className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.showLogoOnInvoice ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings.showLogoOnInvoice ? 'translate-x-6' : 'translate-x-0'}`} /></button></div>
                            <div><label className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-2 block">Logo Alignment</label><div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-lg"><button onClick={() => setSettings(s => ({ ...s, logoAlignment: 'left' }))} className={`flex-1 py-1.5 flex items-center justify-center gap-2 rounded-md transition-all ${settings.logoAlignment === 'left' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}><AlignLeft size={16} /> <span className="text-[10px] font-bold uppercase">Left</span></button><button onClick={() => setSettings(s => ({ ...s, logoAlignment: 'center' }))} className={`flex-1 py-1.5 flex items-center justify-center gap-2 rounded-md transition-all ${settings.logoAlignment === 'center' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}><AlignCenter size={16} /> <span className="text-[10px] font-bold uppercase">Center</span></button></div></div>
                        </div>
                        <div><label className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-3 block">Brand Accent Color</label><div className="flex flex-wrap gap-3">{['#2563eb', '#4f46e5', '#9333ea', '#059669', '#dc2626', '#0f172a'].map(color => (<button key={color} onClick={() => setSettings(s => ({ ...s, brandColor: color }))} className={`w-10 h-10 rounded-lg shadow-sm transition-transform hover:scale-110 flex items-center justify-center ${settings.brandColor === color ? 'ring-2 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900 ring-slate-400' : ''}`} style={{ backgroundColor: color }}>{settings.brandColor === color && <CheckCircle size={16} className="text-white" strokeWidth={3} />}</button>))}</div><p className="text-xs text-slate-600 dark:text-slate-300 mt-2">Used for invoice headings and highlights.</p></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div><label className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-3 block">Business Name</label><input type="text" value={settings.businessName} onChange={e => setSettings(s => ({ ...s, businessName: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-5 py-4 font-bold text-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20 transition-all" /></div>
                        <div><label className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-3 block">Owner Name</label><input type="text" value={settings.ownerName} onChange={e => setSettings(s => ({ ...s, ownerName: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-5 py-4 font-bold text-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20 transition-all" /></div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-6 bg-slate-50/50 dark:bg-slate-900/50">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">Invoice Contact Details</h4>
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Address</label><input type="text" value={settings.businessAddress || ''} onChange={e => setSettings(s => ({ ...s, businessAddress: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-purple-500" placeholder="123 Main St, City, State, Zip" /></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Email</label><input type="email" value={settings.businessEmail || ''} onChange={e => setSettings(s => ({ ...s, businessEmail: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-purple-500" placeholder="contact@business.com" /></div>
                                <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Phone</label><input type="tel" value={settings.businessPhone || ''} onChange={e => setSettings(s => ({ ...s, businessPhone: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-purple-500" placeholder="(555) 123-4567" /></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Website</label><input type="text" value={settings.businessWebsite || ''} onChange={e => setSettings(s => ({ ...s, businessWebsite: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-purple-500" placeholder="www.yourbusiness.com" /></div>
                                <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Tax ID / VAT (Optional)</label><input type="text" value={settings.businessTaxId || ''} onChange={e => setSettings(s => ({ ...s, businessTaxId: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-purple-500" placeholder="XX-XXXXXXX" /></div>
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Tax Configuration Tab */}
              {settingsTab === 'tax' && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Calculator size={20} strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Tax Configuration</h3>
                  </div>
                  
                 <label className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-3 block">How do you want to estimate your income tax?</label>
                 <div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-lg mb-6">
                    {(['preset', 'lastYear', 'custom'] as TaxEstimationMethod[]).map(method => (
                      <button key={method} onClick={() => setSettings(s => ({ ...s, taxEstimationMethod: method }))} className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${settings.taxEstimationMethod === method ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200'}`}>{method === 'preset' ? 'Quick Preset' : method === 'lastYear' ? 'Use Last Year' : 'Custom %'}</button>
                    ))}
                 </div>
                 
                 <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-6 mb-6">
                    {settings.taxEstimationMethod === 'preset' && (
                       <div className="space-y-4 animate-in fade-in zoom-in-95">
                          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Select a rough estimate based on typical self-employed brackets. This is for planning only.</p>
                          <div className="grid grid-cols-3 gap-3">
                             {[10, 15, 20].map(rate => (
                               <button key={rate} onClick={() => setSettings(s => ({ ...s, taxRate: rate }))} className={`py-6 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${settings.taxRate === rate ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 shadow-lg' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'}`}><span className="text-3xl font-extrabold">{rate}%</span><span className="text-xs mt-1 font-medium">Federal</span></button>
                             ))}
                          </div>
                       </div>
                    )}
                    {settings.taxEstimationMethod === 'lastYear' && (
                       <div className="space-y-4 animate-in fade-in zoom-in-95">
                          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Enter values from last year's tax return to calculate your effective rate.</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div><label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Net Profit (Last Year)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold">$</span><input type="number" placeholder="0.00" value={lastYearCalc.profit} onChange={e => setLastYearCalc(p => ({...p, profit: e.target.value}))} className="w-full pl-8 pr-3 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"/></div></div>
                             <div><label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Fed. Income Tax Paid</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold">$</span><input type="number" placeholder="0.00" value={lastYearCalc.tax} onChange={e => setLastYearCalc(p => ({...p, tax: e.target.value}))} className="w-full pl-8 pr-3 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"/></div></div>
                          </div>
                          <button onClick={() => { const profit = Number(lastYearCalc.profit); const tax = Number(lastYearCalc.tax); if (profit > 0 && tax >= 0) { const rate = Math.min(40, Math.max(0, (tax / profit) * 100)); setSettings(s => ({ ...s, taxRate: Number(rate.toFixed(1)) })); showToast(`Rate set to ${rate.toFixed(1)}%`, 'success'); } else { showToast("Please enter valid profit amount", "error"); } }} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm uppercase tracking-widest rounded-lg transition-all active:scale-95">Calculate & Apply Rate</button>
                       </div>
                    )}
                    {settings.taxEstimationMethod === 'custom' && (
                       <div className="space-y-4 animate-in fade-in zoom-in-95">
                          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Manually enter your estimated effective federal income tax rate.</p>
                          <div><label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Federal Effective Rate</label><div className="relative"><input type="number" value={settings.taxRate} onChange={e => setSettings(s => ({ ...s, taxRate: Math.min(100, Math.max(0, Number(e.target.value))) }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 pr-12 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold"><Percent size={18} /></span></div></div>
                       </div>
                    )}
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div><label className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-2 block">State Tax (Optional)</label><div className="relative"><input type="number" value={settings.stateTaxRate} onChange={e => setSettings(s => ({ ...s, stateTaxRate: Math.min(100, Math.max(0, Number(e.target.value))) }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 pr-10 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold">%</span></div></div>
                    <div><label className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-2 block">Filing Status</label><select value={settings.filingStatus} onChange={e => setSettings(s => ({ ...s, filingStatus: e.target.value as FilingStatus }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none"><option value="single">Single</option><option value="joint">Married Filing Jointly</option><option value="separate">Married Filing Separately</option><option value="head">Head of Household</option></select></div>
                 </div>
                 
                 <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-6">
                    <h5 className="text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-4 uppercase tracking-wider">Current Estimate Summary</h5>
                    <div className="flex flex-col gap-3 text-sm">
                       <div className="flex justify-between items-center"><span className="text-emerald-700 dark:text-emerald-300">Federal Income Tax (Effective)</span><span className="font-bold text-emerald-900 dark:text-emerald-100 text-lg">{settings.taxRate}%</span></div>
                       <div className="flex justify-between items-center"><span className="text-emerald-700 dark:text-emerald-300">State Tax (Optional)</span><span className="font-bold text-emerald-900 dark:text-emerald-100 text-lg">{settings.stateTaxRate}%</span></div>
                       <div className="flex justify-between items-center"><span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1">Self-Employment Tax <span title="Social Security (12.4%) + Medicare (2.9%)"><HelpCircle size={14} className="cursor-help inline-block" /></span></span><span className="font-bold text-emerald-900 dark:text-emerald-100 text-lg">~15.3%</span></div>
                       <div className="h-px bg-emerald-200 dark:bg-emerald-800 my-1" />
                      <div className="flex justify-between items-center bg-emerald-100 dark:bg-emerald-900/20 -mx-2 px-2 py-2 rounded">
                        <span className="font-bold uppercase text-xs tracking-wider text-emerald-900 dark:text-emerald-100">Combined Planning Rate</span>
                        <span className="font-extrabold text-2xl text-emerald-900 dark:text-emerald-100">{(settings.taxRate + settings.stateTaxRate + 15.3).toFixed(1)}%</span>
                      </div>
                    </div>
                 </div>

                 <div className="mt-6 -mx-4 sm:-mx-6 rounded-none sm:rounded-xl border-y sm:border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-5 py-5 sm:px-6 sm:py-6">
                   <div className="mb-6 text-left">
                     <h4 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Tax prep and record organization</h4>
                     <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Set your mileage rate and choose whether MONIEZI reminds you to save receipts with business expenses.</p>
                   </div>

                   <div className="space-y-6">
                     <div className="w-full text-left">
                       <div className="text-lg font-bold text-slate-900 dark:text-white">Mileage rate</div>
                       <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Cents per mile</div>
                       <div className="mt-3 w-full">
                         <div className="relative">
                           <input
                             type="number"
                             step="0.1"
                             value={Number(settings.mileageRateCents ?? 72.5)}
                             onChange={e => setSettings(s => ({ ...s, mileageRateCents: Number(e.target.value) }))}
                             className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3.5 pr-24 text-left text-2xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                           />
                           <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">cents</span>
                         </div>
                       </div>
                       <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Used to estimate business mileage in reports, tax planning summaries, and year-end recordkeeping.</p>
                     </div>

                     <div className="h-px bg-slate-200 dark:bg-slate-800" />

                     <div className="w-full text-left">
                       <div className="flex items-start justify-between gap-4">
                         <div className="min-w-0 flex-1">
                           <div className="text-lg font-bold text-slate-900 dark:text-white leading-snug">Receipt reminder</div>
                         </div>
                         <button
                           type="button"
                           aria-pressed={settings.receiptReminderEnabled ?? true}
                           onClick={() => setSettings(s => ({ ...s, receiptReminderEnabled: !(s.receiptReminderEnabled ?? true) }))}
                           className={`mt-0.5 shrink-0 relative inline-flex h-12 w-36 items-center rounded-full border transition-all ${ (settings.receiptReminderEnabled ?? true)
                             ? 'bg-emerald-500 border-emerald-400 shadow-[0_10px_30px_rgba(16,185,129,0.22)]'
                             : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700' }`}
                         >
                           <span className={`absolute left-1.5 h-9 w-9 rounded-full bg-white shadow-md transition-transform ${ (settings.receiptReminderEnabled ?? true) ? 'translate-x-[5.3rem]' : 'translate-x-0' }`} />
                           <span className={`w-full px-4 text-xs font-bold uppercase tracking-[0.18em] ${ (settings.receiptReminderEnabled ?? true) ? 'text-white text-left' : 'text-slate-700 dark:text-slate-200 text-right' }`}>
                             {(settings.receiptReminderEnabled ?? true) ? 'On' : 'Off'}
                           </span>
                         </button>
                       </div>
                       <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Helps you remember to save receipts when recording business expenses.</p>
                       <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Keeps receipts organized for bookkeeping, reimbursements, and tax records.</p>
                     </div>
                   </div>
                 </div>
                </div>
              )}

              {/* Data Management Tab */}
              {settingsTab === 'data' && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
                      <Trash2 size={20} strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Data Management</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <button onClick={handleSeedDemoData} className="py-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 border-2 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 rounded-lg text-sm font-bold uppercase tracking-widest shadow-lg transition-all flex flex-col items-center justify-center gap-3 active:scale-95">
                        {seedSuccess ? <CheckCircle size={24} /> : <Sparkles size={24} />}
                        <span>{seedSuccess ? 'Demo Data Loaded' : 'Load Demo Data'}</span>
                      </button>
                      <button onClick={handleClearData} className="py-6 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 hover:from-red-100 hover:to-orange-100 dark:hover:from-red-900/30 dark:hover:to-orange-900/30 border-2 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100 rounded-lg text-sm font-bold uppercase tracking-widest shadow-lg transition-all flex flex-col items-center justify-center gap-3 active:scale-95">
                        <AlertTriangle size={24} />
                        <span>Reset & Clear All</span>
                      </button>
                  </div>
                  
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-red-900 dark:text-red-100">
                        <p className="font-semibold mb-1">⚠️ Warning: Destructive Actions</p>
                        <p className="mb-2"><strong>Load Demo Data:</strong> Adds sample transactions, invoices, and tax payments to help you explore the app's features.</p>
                        <p><strong>Reset & Clear All:</strong> Permanently deletes ALL your data including transactions, invoices, tax payments, and custom categories. This action cannot be undone!</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* License Tab */}
              {LICENSING_ENABLED && settingsTab === 'license' && (

                <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Key size={20} strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">License</h3>
                  </div>
                  
                  {/* License Status Card */}
                  <div className={`p-6 rounded-xl border-2 mb-6 ${
                    isLicenseValid 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' 
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                        isLicenseValid
                          ? 'bg-emerald-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}>
                        {isLicenseValid ? <CheckCircle size={28} /> : <AlertCircle size={28} />}
                      </div>
                      <div>
                        <h4 className={`text-lg font-bold ${
                          isLicenseValid
                            ? 'text-emerald-900 dark:text-emerald-100'
                            : 'text-red-900 dark:text-red-100'
                        }`}>
                          {isLicenseValid ? 'License Active' : 'No License'}
                        </h4>
                        <p className={`text-sm ${
                          isLicenseValid
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-red-700 dark:text-red-300'
                        }`}>
                          {isLicenseValid 
                            ? 'Your Moniezi license is valid and active'
                            : 'Please activate your license to use Moniezi'
                          }
                        </p>
                      </div>
                    </div>

                    {/* License Details */}
                    {isLicenseValid && licenseInfo && (
                      <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800 space-y-3">
                        {licenseInfo.email ? (
                          <div>
                            <label className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Email</label>
                            <p className="text-sm text-emerald-900 dark:text-emerald-100 font-medium break-all">{licenseInfo.email}</p>
                          </div>
                        ) : null}
                        {licenseInfo.purchaseDate ? (
                          <div>
                            <label className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Purchased</label>
                            <p className="text-sm text-emerald-900 dark:text-emerald-100 font-medium">{new Date(licenseInfo.purchaseDate).toLocaleDateString()}</p>
                          </div>
                        ) : null}
                      </div>
                    )}
                    {isLicenseValid && (
                      <button
                        type="button"
                        onClick={handleDeactivateLicense}
                        className="mt-5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        Deactivate this device
                      </button>
                    )}
                  </div>

                </div>
              )}
            </div>
          </div>
        )}
        {/* Safety net: never allow navigation to render a blank screen */}
        {!([
          Page.Dashboard,
          Page.Invoices,
          Page.Invoice,
          Page.AllTransactions,
          Page.Ledger,
          Page.Income,
          Page.Expenses,
          Page.Clients,
          Page.Mileage,
          Page.Reports,
          Page.CompanyEquity,
          Page.Settings,
          Page.InvoiceDoc,
        ] as const).includes(currentPage) && (
          <div className="px-4 sm:px-6 pt-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Navigation error</div>
              <div className="mt-1 text-sm text-slate-600">
                We couldn&apos;t load this screen. Tap a tab below to continue.
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setCurrentPage(Page.Dashboard)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Home
                </button>
                <button
                  onClick={() => setCurrentPage(Page.Invoices)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
                >
                  Invoices
                </button>
                <button
                  onClick={() => setCurrentPage(Page.AllTransactions)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
                >
                  Activity
                </button>
                <button
                  onClick={() => setCurrentPage(Page.Clients)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
                >
                  Clients
                </button>
                <button
                  onClick={() => setCurrentPage(Page.Mileage)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
                >
                  Mileage
                </button>
                <button
                  onClick={() => setCurrentPage(Page.Reports)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
                >
                  Reports
                </button>
                <button
                  onClick={() => setCurrentPage(Page.CompanyEquity)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
                >Equity</button>
              </div>
            </div>
          </div>
        )}

      </PageErrorBoundary>

      </div>

      {/* Scroll to Top Button - rendered via Portal to escape overflow-hidden container */}
      {showScrollToTop && !isKeyboardEditing && createPortal(
        <button
          onClick={scrollToTop}
          className="no-print w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-900/10 dark:shadow-black/30 hover:shadow-xl hover:scale-105"
          style={{
            position: 'fixed',
            right: '16px',
            bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px) + 20px)',
            zIndex: 99998,
            pointerEvents: 'auto',
          }}
          aria-label="Scroll to top"
        >
          <ArrowUp size={22} strokeWidth={2.5} className="text-slate-600 dark:text-slate-300" />
        </button>,
        document.body
      )}


      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-stretch justify-stretch p-0 modal-overlay">
          <div className="bg-white dark:bg-slate-900 rounded-none w-full h-full overflow-hidden flex flex-col" style={{ paddingTop: "max(14px, env(safe-area-inset-top, 14px))" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <HelpCircle className="text-blue-600" size={18} />
                <span className="font-bold text-sm uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Help
                </span>
                <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">v{CUSTOMER_VERSION}</span>
              </div>
              <button
                onClick={closeHelp}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="Close help"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="text-slate-700 dark:text-slate-200" size={18} />
                    <div className="font-extrabold text-sky-600 dark:text-sky-400 text-base">iPhone / iPad (iOS)</div>
                  </div>
                  <div className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed space-y-2">
                    <div className="font-semibold">One-time setup for offline use:</div>
                    <ol className="list-decimal ml-5 space-y-6">
                      <li>
                        While connected to the internet (<span className="font-semibold">Wi‑Fi</span> or <span className="font-semibold">cellular</span>): open MONIEZI in <span className="font-semibold">Safari</span>.
                      </li>
                      <li>
                        Tap <span className="font-semibold">Share</span> → <span className="font-semibold">Add to Home Screen</span>.
                      </li>
                      <li>
                        Still connected: open MONIEZI from the <span className="font-semibold">Home Screen icon</span> a second time (this finishes saving the app to your device).
                      </li>
                      <li>
                        Done! MONIEZI will now work without an internet connection (<span className="font-semibold">offline</span>).
                      </li>
                    </ol>
                    <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                      Note: iOS may show a system message when going offline. Tap <span className="font-semibold">OK</span> — MONIEZI will still work as long as setup above is complete.
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="text-slate-700 dark:text-slate-200" size={18} />
                    <div className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">Android (Chrome)</div>
                  </div>
                  <div className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed space-y-2">
                    <div className="font-semibold">One-time setup for offline use:</div>
                    <ol className="list-decimal ml-5 space-y-6">
                      <li>
                        While connected to the internet (<span className="font-semibold">Wi‑Fi</span> or <span className="font-semibold">cellular</span>): open MONIEZI in <span className="font-semibold">Chrome</span>.
                      </li>
                      <li>
                        A banner will appear at the top of the screen saying <span className="font-semibold">&quot;Install MONIEZI&quot;</span> — tap <span className="font-semibold">Install</span>.
                        <span className="block mt-1">
                          (If you don&apos;t see the banner, tap the browser menu → <span className="font-semibold">Add to Home Screen</span>.)
                        </span>
                      </li>
                      <li>
                        Open the installed MONIEZI app once more while still connected (this finishes saving the app to your device).
                      </li>
                      <li>
                        Done! MONIEZI will now work without an internet connection (<span className="font-semibold">offline</span>).
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Tip: MONIEZI is offline-first. Your data stays on your device. Online access is only needed for first-time caching and any future online-only features.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`dark-chrome no-print fixed bottom-0 left-0 right-0 z-[55] pb-safe transition-opacity duration-150 ${isKeyboardEditing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className={`${useDarkChrome ? 'bg-slate-950 border-t border-slate-800/50' : 'bg-white/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-slate-800/50'} ${useDarkChrome ? '' : 'backdrop-blur-xl'} px-1 pt-2 pb-3`}>
          <div className="max-w-xl mx-auto flex justify-between items-end relative">
            {/* Home */}
            <button 
              onClick={() => setCurrentPage(Page.Dashboard)} 
              className={`dark-chrome-nav-item ${currentPage === Page.Dashboard ? 'active' : ''} flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${currentPage === Page.Dashboard ? (useDarkChrome ? 'text-white' : 'text-blue-600 dark:text-white') : ''}`}
              style={currentPage === Page.Dashboard ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}
            >
              <div className={`p-1.5 rounded-lg ${currentPage === Page.Dashboard ? (useDarkChrome ? 'bg-slate-800' : 'bg-blue-100 dark:bg-slate-800') : ''}`}>
                <LayoutGrid size={20} strokeWidth={currentPage === Page.Dashboard ? 2 : 1.5} />
              </div>
              <span className={`text-[11px] mt-0.5 ${currentPage === Page.Dashboard ? (useDarkChrome ? 'font-bold text-white' : 'font-bold text-blue-600 dark:text-white') : 'font-semibold'}`} style={currentPage === Page.Dashboard ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}>Home</span>
            </button>

            {/* Invoice */}
            <button 
              onClick={() => { setBillingDocType('invoice'); setCurrentPage(Page.Invoices); }} 
              className={`dark-chrome-nav-item ${currentPage === Page.Invoices && billingDocType === 'invoice' ? 'active' : ''} flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${currentPage === Page.Invoices && billingDocType === 'invoice' ? (useDarkChrome ? 'text-white' : 'text-blue-600 dark:text-white') : ''}`}
              style={currentPage === Page.Invoices && billingDocType === 'invoice' ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}
            >
              <div className={`p-1.5 rounded-lg ${currentPage === Page.Invoices && billingDocType === 'invoice' ? (useDarkChrome ? 'bg-slate-800' : 'bg-blue-100 dark:bg-slate-800') : ''}`}>
                <FileText size={20} strokeWidth={currentPage === Page.Invoices && billingDocType === 'invoice' ? 2 : 1.5} />
              </div>
              <span className={`text-[11px] mt-0.5 ${currentPage === Page.Invoices && billingDocType === 'invoice' ? (useDarkChrome ? 'font-bold text-white' : 'font-bold text-blue-600 dark:text-white') : 'font-semibold'}`} style={currentPage === Page.Invoices && billingDocType === 'invoice' ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}>Invoice</span>
            </button>

            {/* Estimate */}
            <button 
              onClick={() => { setBillingDocType('estimate'); setCurrentPage(Page.Invoices); }} 
              className={`dark-chrome-nav-item ${currentPage === Page.Invoices && billingDocType === 'estimate' ? 'active' : ''} flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${currentPage === Page.Invoices && billingDocType === 'estimate' ? (useDarkChrome ? 'text-white' : 'text-blue-600 dark:text-white') : ''}`}
              style={currentPage === Page.Invoices && billingDocType === 'estimate' ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}
            >
              <div className={`p-1.5 rounded-lg ${currentPage === Page.Invoices && billingDocType === 'estimate' ? (useDarkChrome ? 'bg-slate-800' : 'bg-blue-100 dark:bg-slate-800') : ''}`}>
                <ClipboardList size={20} strokeWidth={currentPage === Page.Invoices && billingDocType === 'estimate' ? 2 : 1.5} />
              </div>
              <span className={`text-[11px] mt-0.5 ${currentPage === Page.Invoices && billingDocType === 'estimate' ? (useDarkChrome ? 'font-bold text-white' : 'font-bold text-blue-600 dark:text-white') : 'font-semibold'}`} style={currentPage === Page.Invoices && billingDocType === 'estimate' ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}>Estimate</span>
            </button>

            {/* Center Nav - Activity */}
            <button 
              onClick={() => setCurrentPage(Page.AllTransactions)} 
              className={`dark-chrome-nav-item ${(currentPage === Page.AllTransactions || currentPage === Page.Ledger) ? 'active' : ''} flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${(currentPage === Page.AllTransactions || currentPage === Page.Ledger) ? (useDarkChrome ? 'text-white' : 'text-blue-600 dark:text-white') : ''}`}
              style={(currentPage === Page.AllTransactions || currentPage === Page.Ledger) ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}
            >
              <div className={`p-1.5 rounded-lg ${(currentPage === Page.AllTransactions || currentPage === Page.Ledger) ? (useDarkChrome ? 'bg-slate-800' : 'bg-blue-100 dark:bg-slate-800') : ''}`}>
                <History size={20} strokeWidth={(currentPage === Page.AllTransactions || currentPage === Page.Ledger) ? 2 : 1.5} />
              </div>
              <span className={`text-[11px] mt-0.5 ${(currentPage === Page.AllTransactions || currentPage === Page.Ledger) ? (useDarkChrome ? 'font-bold text-white' : 'font-bold text-blue-600 dark:text-white') : 'font-semibold'}`} style={(currentPage === Page.AllTransactions || currentPage === Page.Ledger) ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}>Activity</span>
            </button>

            {/* Mileage */}
            <button 
              onClick={() => setCurrentPage(Page.Mileage)} 
              className={`dark-chrome-nav-item ${currentPage === Page.Mileage ? 'active' : ''} flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${currentPage === Page.Mileage ? (useDarkChrome ? 'text-white' : 'text-blue-600 dark:text-white') : ''}`}
              style={currentPage === Page.Mileage ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}
            >
              <div className={`p-1.5 rounded-lg ${currentPage === Page.Mileage ? (useDarkChrome ? 'bg-slate-800' : 'bg-blue-100 dark:bg-slate-800') : ''}`}>
                <Car size={20} strokeWidth={currentPage === Page.Mileage ? 2 : 1.5} />
              </div>
              <span className={`text-[11px] mt-0.5 ${currentPage === Page.Mileage ? (useDarkChrome ? 'font-bold text-white' : 'font-bold text-blue-600 dark:text-white') : 'font-semibold'}`} style={currentPage === Page.Mileage ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}>Mileage</span>
            </button>

            {/* Clients */}
            <button 
              onClick={() => setCurrentPage(Page.Clients)} 
              className={`dark-chrome-nav-item ${currentPage === Page.Clients ? 'active' : ''} flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${currentPage === Page.Clients ? (useDarkChrome ? 'text-white' : 'text-blue-600 dark:text-white') : ''}`}
              style={currentPage === Page.Clients ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}
            >
              <div className={`p-1.5 rounded-lg ${currentPage === Page.Clients ? (useDarkChrome ? 'bg-slate-800' : 'bg-blue-100 dark:bg-slate-800') : ''}`}>
                <Users size={20} strokeWidth={currentPage === Page.Clients ? 2 : 1.5} />
              </div>
              <span className={`text-[11px] mt-0.5 ${currentPage === Page.Clients ? (useDarkChrome ? 'font-bold text-white' : 'font-bold text-blue-600 dark:text-white') : 'font-semibold'}`} style={currentPage === Page.Clients ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}>Clients</span>
            </button>

            {/* Equity */}
            <button 
              onClick={() => setCurrentPage(Page.CompanyEquity)} 
              className={`dark-chrome-nav-item ${currentPage === Page.CompanyEquity ? 'active' : ''} flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${currentPage === Page.CompanyEquity ? (useDarkChrome ? 'text-white' : 'text-blue-600 dark:text-white') : ''}`}
              style={currentPage === Page.CompanyEquity ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}
            >
              <div className={`p-1.5 rounded-lg ${currentPage === Page.CompanyEquity ? (useDarkChrome ? 'bg-slate-800' : 'bg-blue-100 dark:bg-slate-800') : ''}`}>
                <Landmark size={20} strokeWidth={currentPage === Page.CompanyEquity ? 2 : 1.5} />
              </div>
              <span className={`text-[11px] mt-0.5 ${currentPage === Page.CompanyEquity ? (useDarkChrome ? 'font-bold text-white' : 'font-bold text-blue-600 dark:text-white') : 'font-semibold'}`} style={currentPage === Page.CompanyEquity ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}>Equity</span>
            </button>

            {/* Reports */}
            <button 
              onClick={() => setCurrentPage(Page.Reports)} 
              className={`dark-chrome-nav-item ${currentPage === Page.Reports ? 'active' : ''} flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${currentPage === Page.Reports ? (useDarkChrome ? 'text-white' : 'text-blue-600 dark:text-white') : ''}`}
              style={currentPage === Page.Reports ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}
            >
              <div className={`p-1.5 rounded-lg ${currentPage === Page.Reports ? (useDarkChrome ? 'bg-slate-800' : 'bg-blue-100 dark:bg-slate-800') : ''}`}>
                <BarChart3 size={20} strokeWidth={currentPage === Page.Reports ? 2 : 1.5} />
              </div>
              <span className={`text-[11px] mt-0.5 ${currentPage === Page.Reports ? (useDarkChrome ? 'font-bold text-white' : 'font-bold text-blue-600 dark:text-white') : 'font-semibold'}`} style={currentPage === Page.Reports ? darkChromeNavActiveStyle : darkChromeNavInactiveStyle}>Reports</span>
            </button>
          </div>
        </div>
      </div>
      

      {/* Insights Modal */}
      {showInsights && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200 modal-overlay">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <InsightsDashboard
              transactions={transactions}
              invoices={invoices}
              taxPayments={taxPayments}
              settings={settings}
              onClose={() => setShowInsights(false)}
            />
          </div>
        </div>
      )}

      <AppDrawer
         isOpen={isDrawerOpen}
         onClose={closeDrawer}
         title={
            drawerMode === 'tax_payments' ? 'Tax Payments' :
            drawerMode === 'create_cat' ? 'New Category' :
            drawerMode === 'mileage' ? (editingMileageTripId ? 'Edit Mileage Trip' : 'Add Mileage Trip') :
            drawerMode === 'add' ? (activeTab === 'billing' ? (billingDocType === 'estimate' ? 'New Estimate' : 'New Invoice') : activeTab === 'income' ? 'Add Income' : 'Add Expense') : 
            drawerMode === 'edit_tx' ? 'Edit Transaction' : 
            drawerMode === 'edit_inv' ? (billingDocType === 'estimate' ? 'Edit Estimate' : 'Edit Invoice') :
            'Edit Invoice'
         }
      >
         {drawerMode === 'tax_payments' ? (
             <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Log New Payment</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <DateInput label="Date" value={activeTaxPayment.date || ''} onChange={v => setActiveTaxPayment(p => ({...p, date: v}))} />
                        <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block pl-1 uppercase tracking-wider">Amount</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold">{settings.currencySymbol}</span><input type="number" value={activeTaxPayment.amount || ''} onChange={e => setActiveTaxPayment(p => ({...p, amount: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-0 rounded-lg pl-10 pr-4 py-4 font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="0.00" /></div></div>
                    </div>
                    <div className="mb-4"><label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block pl-1 uppercase tracking-wider">Payment Type</label><div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-lg">{['Estimated', 'Annual', 'Other'].map(type => (<button key={type} onClick={() => setActiveTaxPayment(p => ({...p, type: type as any}))} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${activeTaxPayment.type === type ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>{type}</button>))}</div></div>
                    <button onClick={saveTaxPayment} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 uppercase tracking-widest transition-all active:scale-95">Record Payment</button>
                </div>
                <div><h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3 pl-1">Payment History</h4>{taxPayments.length === 0 ? (<div className="text-center py-8 text-slate-400 italic text-sm">No payments recorded yet.</div>) : (<div className="space-y-3">{taxPayments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(p => (<div key={p.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><CheckCircle size={18} /></div><div><div className="font-bold text-slate-900 dark:text-white">{p.type} Tax</div><div className="text-xs text-slate-500">{p.date}</div></div></div><div className="text-right"><div className="font-bold text-slate-900 dark:text-white">{formatCurrency.format(p.amount)}</div><button onClick={() => deleteTaxPayment(p.id)} className="text-xs text-red-500 hover:text-red-600 mt-1 font-bold">DELETE</button></div></div>))}</div>)}</div>
             </div>
         ) : drawerMode === 'mileage' ? (
             <div className="space-y-5">
                <DateInput label="Date" value={newTrip.date} onChange={v => setNewTrip(p => ({ ...p, date: v }))} />
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 block pl-1">Miles</label>
                  <input type="number" inputMode="decimal" enterKeyHint="done" step="0.1" value={newTrip.miles} onChange={e => setNewTrip(p => ({ ...p, miles: e.target.value }))} onBlur={e => setNewTrip(p => ({ ...p, miles: normalizeMileageDraftMiles(e.target.value) }))} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-4 font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 block pl-1">Purpose</label>
                  <input type="text" value={newTrip.purpose} onChange={e => setNewTrip(p => ({ ...p, purpose: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-4 font-bold text-base outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white" placeholder="Client meeting, supply run, airport, etc." />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 block pl-1">Client</label>
                  <input type="text" value={newTrip.client} onChange={e => setNewTrip(p => ({ ...p, client: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-4 font-bold text-base outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white" placeholder="Optional" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 block pl-1">Notes</label>
                  <textarea value={newTrip.notes} onChange={e => setNewTrip(p => ({ ...p, notes: e.target.value }))} className="w-full min-h-[96px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-4 font-bold text-base outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white" placeholder="Optional" />
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {editingMileageTripId ? (
                    <button type="button" onClick={deleteActiveMileageTrip} className="sm:w-40 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg shadow-red-500/20 uppercase tracking-widest transition-all active:scale-95">Delete</button>
                  ) : null}
                  <button type="button" onClick={saveMileageTripFromDrawer} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg shadow-emerald-500/20 uppercase tracking-widest transition-all active:scale-95">Save Trip</button>
                </div>
             </div>
         ) : drawerMode === 'create_cat' ? (
             <div className="space-y-6">
                 <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-lg border border-slate-100 dark:border-slate-800">
                     <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Create {activeTab === 'billing' ? 'Invoice' : activeTab === 'income' ? 'Income' : 'Expense'} Category</h4>
                     <div className="mb-6"><label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block pl-1 uppercase tracking-wider">Category Name</label><input type="text" autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-4 font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700" placeholder="e.g. Project Supplies" /><p className="text-xs text-slate-400 mt-2 pl-1">This will be available for future {activeTab} entries.</p></div>
                     <div className="flex gap-3"><button onClick={() => setDrawerMode(previousDrawerMode.current)} className="flex-1 py-4 font-bold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button><button onClick={saveNewCategory} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 uppercase tracking-widest transition-all active:scale-95">Save Category</button></div>
                 </div>
             </div>
         ) : (
            <TransactionEditorShell
              isKeyboardEditing={isKeyboardEditing}
              mode={drawerMode === 'add' ? 'add' : 'edit'}
              activeTab={activeTab}
              billingDocType={billingDocType}
              tabSelector={drawerMode === 'add' ? (
                    <div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-lg mb-4">
                        <button onClick={() => { setActiveTab('income'); resetActiveItem('income'); setCategorySearch(''); }} className={`flex-1 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'income' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>Income</button>
                        <button onClick={() => { setActiveTab('expense'); resetActiveItem('expense'); setCategorySearch(''); }} className={`flex-1 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'expense' ? 'bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>Expense</button>
                        <button onClick={() => { setActiveTab('billing'); resetActiveItem('billing'); setCategorySearch(''); }} className={`flex-1 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'billing' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>{billingDocType === 'estimate' ? 'Estimate' : 'Invoice'}</button>
                    </div>
              ) : undefined}
              utilityPanel={drawerMode === 'edit_inv' && activeItem.id ? (
                    <div className="bg-slate-100 dark:bg-slate-800/50 p-2 rounded-lg mb-4 border border-slate-200 dark:border-slate-700">
                        <div className="grid grid-cols-3 gap-2 mb-2">
                            <button type="button" onClick={billingDocType === 'estimate' ? handleDirectExportEstimatePDF : handleDirectExportPDF} disabled={billingDocType === 'estimate' ? isGeneratingEstimatePdf : isGeneratingPdf} className={`py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all ${(billingDocType === 'estimate' ? isGeneratingEstimatePdf : isGeneratingPdf) ? 'opacity-70 cursor-wait' : ''}`}>{(billingDocType === 'estimate' ? isGeneratingEstimatePdf : isGeneratingPdf) ? <Loader2 size={18} className="animate-spin text-blue-600" /> : <Download size={18} />}<span className="text-[10px] font-bold uppercase tracking-wider">{(billingDocType === 'estimate' ? isGeneratingEstimatePdf : isGeneratingPdf) ? 'Generating...' : 'Export PDF'}</span></button>
                            <button type="button" onClick={() => (billingDocType === 'estimate' ? duplicateEstimate(activeItem as any) : duplicateInvoice(activeItem as Invoice))} className="py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 shadow-sm transition-all"><Copy size={18} /><span className="text-[10px] font-bold uppercase tracking-wider">Duplicate</span></button>
                            <button type="button" onClick={() => (billingDocType === 'estimate' ? null : openBatchDuplicate(activeItem as Invoice))} disabled={billingDocType === 'estimate'} className={`py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 shadow-sm transition-all ${billingDocType === 'estimate' ? 'opacity-50 cursor-not-allowed' : ''}`}><Repeat size={18} /><span className="text-[10px] font-bold uppercase tracking-wider">Batch</span></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {billingDocType !== 'estimate' ? (
                              <button type="button" onClick={() => toggleInvoicePaidStatus(activeItem)} disabled={activeItem.status === 'void'} className={`py-2.5 flex flex-col items-center justify-center gap-1 rounded-md border shadow-sm transition-all ${activeItem.status === 'void' ? 'opacity-50 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-500' : activeItem.status === 'paid' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 hover:bg-orange-100' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'}`}>{activeItem.status === 'paid' ? <X size={18} /> : <CheckCircle size={18} />}<span className="text-[10px] font-bold uppercase tracking-wider">{activeItem.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}</span></button>
                            ) : (
                              <div className="py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-500">
                                <span className="text-[10px] font-bold uppercase tracking-wider">No payment status</span>
                              </div>
                            )}
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); billingDocType === 'estimate' ? deleteEstimate(activeItem as any) : setInvoiceToDelete(activeItem.id!); }} className="py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm transition-all"><Trash2 size={18} /><span className="text-[10px] font-bold uppercase tracking-wider">Delete</span></button>
                        </div>
                    </div>
              ) : undefined}
              formContent={activeTab === 'billing' ? (
                   <div className="space-y-4">
                      <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                          <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3">Client Details</h4>
                          <div className="space-y-3">
                              <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">Select Client</label>
                                <select value={(activeItem as any).clientId || ''} onChange={e => { const id = e.target.value; setActiveItem(p => ({ ...p, clientId: id || undefined })); if (id) fillDocFromClient(id); }} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-3 font-bold text-sm outline-none focus:ring-1 focus:ring-blue-500">
                                  <option value="">New / Not selected</option>
                                  {clients.map(c => (<option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}{c.status === 'lead' ? ' (Lead)' : ''}</option>))}
                                </select>
                              </div>
                              <input type="text" value={activeItem.client || ''} onChange={e => setActiveItem(prev => ({ ...prev, client: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-3 font-bold text-base outline-none focus:ring-1 focus:ring-blue-500" placeholder="Client Name (Required)" />
                              <input type="text" value={activeItem.clientCompany || ''} onChange={e => setActiveItem(prev => ({ ...prev, clientCompany: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="Company Name (Optional)" />
                              <input type="email" value={activeItem.clientEmail || ''} onChange={e => setActiveItem(prev => ({ ...prev, clientEmail: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="Client Email (Optional)" />
                              <input type="text" value={activeItem.clientAddress || ''} onChange={e => setActiveItem(prev => ({ ...prev, clientAddress: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="Client Address (Optional)" />
                          </div>
                      </div>

                      {/* ESTIMATE-SPECIFIC FIELDS */}
                      {billingDocType === 'estimate' && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800/30">
                          <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <FileText size={14} /> Proposal Details
                          </h4>
                          <div className="space-y-3">
                            <div>
                              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">Project Title</label>
                              <input 
                                type="text" 
                                value={(activeItem as any).projectTitle || ''} 
                                onChange={e => setActiveItem(prev => ({ ...prev, projectTitle: e.target.value }))} 
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-3 font-bold text-base outline-none focus:ring-1 focus:ring-purple-500" 
                                placeholder="e.g., Website Redesign, Marketing Campaign" 
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">Scope of Work</label>
                              <textarea 
                                value={(activeItem as any).scopeOfWork || ''} 
                                onChange={e => setActiveItem(prev => ({ ...prev, scopeOfWork: e.target.value }))} 
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-purple-500 min-h-[80px]" 
                                placeholder="Describe what's included in this proposal..." 
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">Timeline</label>
                                <input 
                                  type="text" 
                                  value={(activeItem as any).timeline || ''} 
                                  onChange={e => setActiveItem(prev => ({ ...prev, timeline: e.target.value }))} 
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-purple-500" 
                                  placeholder="e.g., 2-3 weeks" 
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">Reference #</label>
                                <input 
                                  type="text" 
                                  value={(activeItem as any).poNumber || ''} 
                                  onChange={e => setActiveItem(prev => ({ ...prev, poNumber: e.target.value }))} 
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-purple-500" 
                                  placeholder="Client ref / PO #" 
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><DateInput label="Date" value={activeItem.date || ''} onChange={v => setActiveItem(prev => ({ ...prev, date: v }))} /><DateInput label={billingDocType === 'estimate' ? "Valid Until" : "Due Date"} value={(billingDocType === 'estimate' ? (activeItem.validUntil as any) : activeItem.due) || ''} onChange={v => setActiveItem(prev => billingDocType === 'estimate' ? ({ ...prev, validUntil: v }) : ({ ...prev, due: v }))} /></div>
                      <div className="bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800"><h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Line Items</h4><button onClick={addInvoiceItem} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"><PlusCircle size={14}/> Add Item</button></div>
                          <div className="p-2 space-y-2">{(activeItem.items || []).map((item, idx) => (<div key={item.id} className="mobile-billing-line-item flex gap-2 items-start animate-in fade-in slide-in-from-left-2"><div className="mobile-billing-line-item-fields min-w-0 flex-1 space-y-2"><input type="text" value={item.description} onChange={(e) => updateInvoiceItem(item.id, 'description', e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="Description" /><div className="mobile-billing-line-item-meta flex gap-2"><div className="mobile-billing-line-item-qty relative w-20"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 text-xs">Qty</span><input type="number" value={item.quantity || ''} onChange={(e) => updateInvoiceItem(item.id, 'quantity', Number(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded pl-8 pr-2 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 text-center" placeholder="0"/></div><div className="mobile-billing-line-item-rate relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 text-xs">$</span><input type="number" value={item.rate || ''} onChange={(e) => updateInvoiceItem(item.id, 'rate', Number(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded pl-6 pr-2 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="0.00" /></div></div></div><div className="mobile-billing-line-item-remove pt-2"><button onClick={() => removeInvoiceItem(item.id)} className="text-slate-400 hover:text-red-500 p-1"><MinusCircle size={18} /></button></div></div>))}{(activeItem.items || []).length === 0 && <div className="text-center py-4 text-xs text-slate-400 italic">No items added. Add at least one item.</div>}</div>
                          <div className="p-3 bg-slate-100 dark:bg-slate-900/50 rounded-b-lg space-y-2">
                              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300"><span>Subtotal</span><span>{formatCurrency.format(activeInvoiceTotals.subtotal)}</span></div>
                              <div className="mobile-billing-summary-row flex items-center justify-between gap-4"><label className="text-xs text-slate-600 dark:text-slate-300">Discount</label><div className="mobile-billing-summary-input relative w-24 shrink-0"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 text-xs">$</span><input type="number" value={activeItem.discount || ''} onChange={e => setActiveItem(p => ({...p, discount: Number(e.target.value)}))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-1 pl-5 pr-1 text-xs text-right outline-none" placeholder="0" /></div></div>
                              <div className="mobile-billing-summary-row flex items-center justify-between gap-4"><label className="text-xs text-slate-600 dark:text-slate-300">Tax Rate</label><div className="mobile-billing-summary-input relative w-24 shrink-0"><input type="number" value={activeItem.taxRate || ''} onChange={e => setActiveItem(p => ({...p, taxRate: Number(e.target.value)}))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-1 pl-1 pr-5 text-xs text-right outline-none" placeholder="0" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 text-xs">%</span></div></div>
                              {billingDocType !== 'estimate' && <div className="mobile-billing-summary-row flex items-center justify-between gap-4"><label className="text-xs text-slate-600 dark:text-slate-300">Shipping</label><div className="mobile-billing-summary-input relative w-24 shrink-0"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 text-xs">$</span><input type="number" value={activeItem.shipping || ''} onChange={e => setActiveItem(p => ({...p, shipping: Number(e.target.value)}))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-1 pl-5 pr-1 text-xs text-right outline-none" placeholder="0" /></div></div>}
                              <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"><span>{billingDocType === 'estimate' ? 'Estimated Total' : 'Total Due'}</span><span>{formatCurrency.format(activeInvoiceTotals.total)}</span></div>
                          </div>
                      </div>

                      {/* ESTIMATE-SPECIFIC: Exclusions */}
                      {billingDocType === 'estimate' && (
                        <div>
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">Exclusions (Not Included)</label>
                          <textarea 
                            value={(activeItem as any).exclusions || ''} 
                            onChange={e => setActiveItem(prev => ({ ...prev, exclusions: e.target.value }))} 
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]" 
                            placeholder="List items NOT included in this estimate (e.g., hosting, stock photos, third-party fees)..." 
                          />
                        </div>
                      )}

                      <div className="space-y-4">
                          <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">Internal Category</label>{renderCategoryChips(activeItem.category, (cat) => setActiveItem(prev => ({ ...prev, category: cat })))}</div>
                          <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">{billingDocType === 'estimate' ? 'Notes to Client' : 'Notes / Memo'}</label><textarea value={activeItem.notes || ''} onChange={e => setActiveItem(prev => ({ ...prev, notes: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-50 min-h-[60px]" placeholder={billingDocType === 'estimate' ? "Additional information for your client..." : "Thank you for your business..."} /></div>
                          <div><label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">{billingDocType === 'estimate' ? 'Terms & Conditions' : 'Payment Terms'}</label><textarea value={activeItem.terms || ''} onChange={e => setActiveItem(prev => ({ ...prev, terms: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]" placeholder={billingDocType === 'estimate' ? "This estimate is valid for 30 days. 50% deposit required to begin work..." : "Net 30. Late fees apply..."} /></div>
                          
                          {/* ESTIMATE-SPECIFIC: Acceptance Terms */}
                          {billingDocType === 'estimate' && (
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">How to Accept</label>
                              <input 
                                type="text" 
                                value={(activeItem as any).acceptanceTerms || ''} 
                                onChange={e => setActiveItem(prev => ({ ...prev, acceptanceTerms: e.target.value }))} 
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" 
                                placeholder="e.g., Reply 'Approved' to this email, Sign below, etc." 
                              />
                            </div>
                          )}
                      </div>

                      {/* Preview & Save Buttons */}
                      <div className="flex gap-3">
                        <button onClick={() => (billingDocType === 'estimate' ? saveEstimate(activeItem) : saveInvoice(activeItem))} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 uppercase tracking-widest transition-all active:scale-95">Save {billingDocType === 'estimate' ? 'Estimate' : 'Invoice'}</button>
                      </div>
                   </div>
                ) : (
                   <div className="space-y-4">
                      {drawerMode === 'edit_tx' && activeItem.id && (
                        <div className="bg-slate-100 dark:bg-slate-800/50 p-2 rounded-lg mb-2 border border-slate-200 dark:border-slate-700">
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <button type="button" onClick={() => duplicateTransaction(activeItem as Transaction)} className="py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 shadow-sm transition-all">
                              <Copy size={18} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Duplicate</span>
                            </button>
                            <button type="button" onClick={() => openBatchDuplicate(activeItem as Transaction)} className={`py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 shadow-sm transition-all ${billingDocType === 'estimate' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              <Repeat size={18} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Batch</span>
                            </button>
                            <button type="button" onClick={() => openRecurringSetup(activeItem as Transaction)} className="py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 shadow-sm transition-all">
                              <Calendar size={18} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Recurring</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <button type="button" onClick={() => deleteTransaction(activeItem.id)} className="py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm transition-all">
                              <Trash2 size={18} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
                            </button>
                          </div>
                        </div>
                      )}
                      <div><label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block pl-1">Description</label><input type="text" value={activeItem.name || ''} onChange={e => setActiveItem(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-transparent border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-4 font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500/20" placeholder={activeTab === 'income' ? "Client or Source" : "Vendor or Purchase"} /></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><DateInput label="Date" value={activeItem.date || ''} onChange={v => setActiveItem(prev => ({ ...prev, date: v }))} /><div><label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block pl-1">Amount</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 font-bold">{settings.currencySymbol}</span><input type="number" inputMode="decimal" enterKeyHint="done" step="0.01" value={activeItem.amount || ''} onChange={e => setActiveItem(prev => ({ ...prev, amount: Number(e.target.value) }))} className="w-full bg-transparent border border-slate-300 dark:border-slate-700 rounded-lg pl-10 pr-4 py-4 font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="0.00" /></div></div></div>
                      <div><label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block pl-1">Category</label>{renderCategoryChips(activeItem.category, (cat) => setActiveItem(prev => ({ ...prev, category: cat })))}</div>
                      {activeTab === 'expense' && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-extrabold text-slate-900 dark:text-white">Review Status</div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">Mark this expense as reviewed after checking category, amount, and receipt.</div>
                            </div>
                            <button type="button" onClick={() => setActiveItem((prev: any) => ({ ...prev, reviewedAt: prev.reviewedAt ? undefined : new Date().toISOString() }))} className={`px-4 py-2 rounded-lg font-extrabold uppercase tracking-widest text-xs ${(activeItem as any).reviewedAt ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'}`}>
                              {(activeItem as any).reviewedAt ? 'Reviewed' : 'New'}
                            </button>
                          </div>
                        </div>
                      )}
                      {activeTab === 'expense' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block pl-1">Receipt</label>
                            <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-1 rounded-full ${(activeItem as any).receiptId ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                              {(activeItem as any).receiptId ? "Linked" : "Optional"}
                            </span>
                          </div>

                          {/* Linked receipt preview (thumbnail) */}
                          {(activeItem as any).receiptId ? (
                            <div className="flex gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                              <button
                                type="button"
                                onClick={() => {
                                  const r = receipts.find(x => x.id === (activeItem as any).receiptId);
                                  if (r) openReceipt(r);
                                }}
                                className="w-20 h-28 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-center"
                                title="Tap to view"
                              >
                                {receiptPreviewUrls[(activeItem as any).receiptId] ? (
                                  <img src={receiptPreviewUrls[(activeItem as any).receiptId] || DEMO_ASSET_BY_ID.get((activeItem as any).receiptId)?.assetUrl || ''} alt="Receipt thumbnail" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="text-[10px] font-bold text-slate-500">No preview</div>
                                )}
                              </button>

                              <div className="flex-1 min-w-0">
                                {(() => {
                                  const r = receipts.find(x => x.id === (activeItem as any).receiptId);
                                  return (
                                    <>
                                      <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{r?.note || "Linked receipt"}</div>
                                      <div className="text-xs text-slate-600 dark:text-slate-300">{r?.date || ""}</div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <button type="button" onClick={() => { const rr = receipts.find(x => x.id === (activeItem as any).receiptId); if (rr) openReceipt(rr); }} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-extrabold uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all">View</button>
                                        <button type="button" onClick={() => handleDownloadReceipt((activeItem as any).receiptId)} className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-extrabold uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 active:scale-95 transition-all">Download</button>
                                        <button type="button" onClick={() => setActiveItem(prev => ({ ...prev, receiptId: undefined }))} className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300 text-[11px] font-extrabold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">Unlink</button>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          ) : null}

                          {(activeItem as any).receiptId ? (
                            <div className="space-y-1">
                              <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1 block pl-1">Receipt name</label>
                              <input
                                value={(receipts.find(x => x.id === (activeItem as any).receiptId)?.note) || ''}
                                onChange={e => {
                                  const rid = (activeItem as any).receiptId as string;
                                  const val = e.target.value;
                                  setReceipts(prev => prev.map(r => r.id === rid ? ({ ...r, note: val }) : r));
                                }}
                                placeholder="Example: Office supplies"
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-0 rounded-lg px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                              />
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest pl-1">Shown on receipts list and exports</div>
                            </div>
                          ) : null}

                          {/* Attach / Scan controls */}
                          <div className="flex gap-2">
                            <select value={(activeItem as any).receiptId || ''} onChange={e => {
                              const rid = e.target.value || undefined;
                              setActiveItem(prev => ({ ...prev, receiptId: rid }));
                              if (rid) {
                                const r = receipts.find(x => x.id === rid);
                                const expName = String((activeItem as any).name || '').trim();
                                if (expName && (!r?.note || !String(r.note).trim())) {
                                  setReceipts(prev => prev.map(rr => rr.id === rid ? ({ ...rr, note: expName }) : rr));
                                }
                              }
                            }} className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-0 rounded-lg px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                              <option value="">No receipt linked</option>
                              {receipts.map(r => (
                                <option key={r.id} value={r.id}>{`${r.date}${r.note ? ' — ' + r.note : ''} (${r.id.slice(-6)})`}</option>
                              ))}
                            </select>
                            <button type="button" onClick={() => scanInputRef.current?.click()} className="px-4 py-3 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-sm uppercase tracking-wider hover:bg-slate-300 dark:hover:bg-slate-700 active:scale-95 transition-all">Scan</button>
                          </div>

                          {!(activeItem as any).receiptId && (
                            <div className="flex items-start gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                              <Info size={16} className="mt-0.5" />
                              <div>
                                Attach a receipt if you have one. You can save now and link it later.
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <button onClick={() => saveTransaction(activeItem)} className={`w-full py-4 font-bold rounded-lg shadow-lg uppercase tracking-widest transition-all active:scale-95 text-white ${activeTab === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}`}>Save {activeTab}</button>
                   </div>
                )}
            />
         )}
      </AppDrawer>

      {/* GLOBAL RECEIPT SCAN INPUT */}
      <input type="file" ref={scanInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleScanReceipt} />

      
      

      {/* Client Modal */}
      {showQuickAddMenu && (
        <div className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 modal-overlay" onClick={() => setShowQuickAddMenu(false)}>
          <div className="quick-add-typography-lock w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className={theme === 'dark' ? 'qa-heading text-white' : 'qa-heading text-slate-950'}>Quick Add</div>
                <div className={theme === 'dark' ? 'qa-subheading text-white' : 'qa-subheading text-slate-950'}>Choose what you want to create.</div>
              </div>
              <button onClick={() => setShowQuickAddMenu(false)} className="p-2 rounded-full text-slate-950 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Close quick add"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <button onClick={() => handleQuickAddSelection('income')} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-left transition-all active:scale-[0.98] hover:bg-emerald-100 shadow-sm dark:border-emerald-400/50 dark:bg-emerald-950/60 dark:hover:bg-emerald-950/80">
                <div className="qa-tile-copy">
                  <div className={theme === 'dark' ? 'qa-tile-title text-emerald-50' : 'qa-tile-title text-emerald-950'}>Add Income</div>
                  <div className={theme === 'dark' ? 'qa-tile-desc text-emerald-100' : 'qa-tile-desc text-emerald-900'}>Record a payment or deposit.</div>
                </div>
              </button>
              <button onClick={() => handleQuickAddSelection('expense')} className="rounded-xl border border-red-300 bg-red-50 px-4 py-4 text-left transition-all active:scale-[0.98] hover:bg-red-100 shadow-sm dark:border-red-400/50 dark:bg-red-950/60 dark:hover:bg-red-950/80">
                <div className="qa-tile-copy">
                  <div className={theme === 'dark' ? 'qa-tile-title text-red-50' : 'qa-tile-title text-red-950'}>Add Expense</div>
                  <div className={theme === 'dark' ? 'qa-tile-desc text-red-100' : 'qa-tile-desc text-red-900'}>Log a purchase or bill.</div>
                </div>
              </button>
              <button onClick={() => handleQuickAddSelection('invoice')} className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-4 text-left transition-all active:scale-[0.98] hover:bg-blue-100 shadow-sm dark:border-blue-400/50 dark:bg-blue-950/60 dark:hover:bg-blue-950/80">
                <div className="qa-tile-copy">
                  <div className={theme === 'dark' ? 'qa-tile-title text-blue-50' : 'qa-tile-title text-blue-950'}>New Invoice</div>
                  <div className={theme === 'dark' ? 'qa-tile-desc text-blue-100' : 'qa-tile-desc text-blue-900'}>Create a bill to send.</div>
                </div>
              </button>
              <button onClick={() => handleQuickAddSelection('estimate')} className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-4 text-left transition-all active:scale-[0.98] hover:bg-indigo-100 shadow-sm dark:border-indigo-400/50 dark:bg-indigo-950/60 dark:hover:bg-indigo-950/80">
                <div className="qa-tile-copy">
                  <div className={theme === 'dark' ? 'qa-tile-title text-indigo-50' : 'qa-tile-title text-indigo-950'}>New Estimate</div>
                  <div className={theme === 'dark' ? 'qa-tile-desc text-indigo-100' : 'qa-tile-desc text-indigo-900'}>Draft a proposal or quote.</div>
                </div>
              </button>
              <button onClick={() => handleQuickAddSelection('mileage')} className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-4 text-left transition-all active:scale-[0.98] hover:bg-slate-100 shadow-sm dark:border-slate-600 dark:bg-slate-800/95 dark:hover:bg-slate-800">
                <div className="qa-tile-copy">
                  <div className={theme === 'dark' ? 'qa-tile-title text-white' : 'qa-tile-title text-slate-950'}>Mileage</div>
                  <div className={theme === 'dark' ? 'qa-tile-desc text-slate-50' : 'qa-tile-desc text-slate-900'}>Log a business trip.</div>
                </div>
              </button>
              <button onClick={() => handleQuickAddSelection('client')} className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-4 text-left transition-all active:scale-[0.98] hover:bg-slate-100 shadow-sm dark:border-slate-600 dark:bg-slate-800/95 dark:hover:bg-slate-800">
                <div className="qa-tile-copy">
                  <div className={theme === 'dark' ? 'qa-tile-title text-white' : 'qa-tile-title text-slate-950'}>Add Client</div>
                  <div className={theme === 'dark' ? 'qa-tile-desc text-slate-50' : 'qa-tile-desc text-slate-900'}>Create a new client profile.</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {isClientModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 modal-overlay">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white">{editingClient.id ? 'Edit Client' : 'New Client'}</div>
                <div className="text-xs text-slate-500">Leads and customers are tied to invoices/estimates.</div>
              </div>
              <button onClick={() => { setIsClientModalOpen(false); setEditingClient({ status: 'lead' }); }} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={editingClient.name || ''} onChange={e => setEditingClient(p => ({...p, name: e.target.value}))} placeholder="Client name" className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold" />
                <select value={(editingClient.status as any) || 'lead'} onChange={e => setEditingClient(p => ({...p, status: e.target.value as any}))} className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold">
                  <option value="lead">Lead</option>
                  <option value="client">Client</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <input value={editingClient.company || ''} onChange={e => setEditingClient(p => ({...p, company: e.target.value}))} placeholder="Company (optional)" className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={editingClient.email || ''} onChange={e => setEditingClient(p => ({...p, email: e.target.value}))} placeholder="Email (optional)" className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold" />
                <input value={editingClient.phone || ''} onChange={e => setEditingClient(p => ({...p, phone: e.target.value}))} placeholder="Phone (optional)" className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold" />
              </div>
              <input value={editingClient.address || ''} onChange={e => setEditingClient(p => ({...p, address: e.target.value}))} placeholder="Address (optional)" className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold" />
              <textarea value={editingClient.notes || ''} onChange={e => setEditingClient(p => ({...p, notes: e.target.value}))} placeholder="Notes (optional)" className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm min-h-[80px]" />
            </div>

            <div className="flex gap-3 mt-5">
              {editingClient.id && (
                <button
                  onClick={() => {
                    const clientInvoices = invoices.filter(inv => inv.clientId === editingClient.id);
                    const clientEstimates = estimates.filter(est => est.clientId === editingClient.id);
                    
                    // Build warning message if there are linked documents
                    let confirmMsg = 'Delete this client?';
                    if (clientInvoices.length > 0 || clientEstimates.length > 0) {
                      const parts = [];
                      if (clientInvoices.length > 0) parts.push(`${clientInvoices.length} invoice${clientInvoices.length !== 1 ? 's' : ''}`);
                      if (clientEstimates.length > 0) parts.push(`${clientEstimates.length} estimate${clientEstimates.length !== 1 ? 's' : ''}`);
                      confirmMsg = `This client has ${parts.join(' and ')}. Deleting will unlink these documents (they won't be deleted). Continue?`;
                    }
                    
                    if (!confirm(confirmMsg)) return;
                    
                    // Unlink invoices from this client
                    if (clientInvoices.length > 0) {
                      setInvoices(prev => prev.map(inv => 
                        inv.clientId === editingClient.id 
                          ? { ...inv, clientId: undefined } 
                          : inv
                      ));
                    }
                    
                    // Unlink estimates from this client
                    if (clientEstimates.length > 0) {
                      setEstimates(prev => prev.map(est => 
                        est.clientId === editingClient.id 
                          ? { ...est, clientId: undefined } 
                          : est
                      ));
                    }
                    
                    setClients(prev => prev.filter(c => c.id !== editingClient.id));
                    setIsClientModalOpen(false);
                    setEditingClient({ status: 'lead' });
                    showToast('Client deleted', 'info');
                  }}
                  className="px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-2">
                  <Trash2 size={18}/> Delete
                </button>
              )}
              <button
                onClick={() => {
                  const name = (editingClient.name || '').trim();
                  if (!name) return showToast('Client name is required', 'error');
                  const now = new Date().toISOString();
                  if (editingClient.id) {
                    setClients(prev => prev.map(c => c.id === editingClient.id ? ({
                      ...c,
                      name,
                      company: editingClient.company || '',
                      email: editingClient.email || '',
                      phone: editingClient.phone || '',
                      address: editingClient.address || '',
                      notes: editingClient.notes || '',
                      status: (editingClient.status as any) || 'lead',
                      updatedAt: now,
                    }) : c));
                    showToast('Client updated', 'success');
                  } else {
                    const newClient: Client = {
                      id: generateId('cli'),
                      name,
                      company: editingClient.company || '',
                      email: editingClient.email || '',
                      phone: editingClient.phone || '',
                      address: editingClient.address || '',
                      notes: editingClient.notes || '',
                      status: (editingClient.status as any) || 'lead',
                      createdAt: now,
                      updatedAt: now,
                    };
                    setClients(prev => [newClient, ...prev]);
                    showToast('Client created', 'success');
                  }
                  setIsClientModalOpen(false);
                  setEditingClient({ status: 'lead' });
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20">
                Save Client
              </button>
            </div>
          </div>
        </div>
      )}

{/* Template Suggestion Modal */}
      {showTemplateSuggestion && templateSuggestionData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 modal-overlay">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl p-6 shadow-2xl border border-blue-500/20">
            <div className="flex items-center gap-4 mb-4 text-blue-600 dark:text-blue-400">
              <div className="bg-blue-100 dark:bg-blue-500/10 p-3 rounded-full">
                <Sparkles size={24} strokeWidth={2} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold">Save as Template?</h3>
            </div>
            
            <p className="text-slate-600 dark:text-slate-300 mb-4 font-medium leading-relaxed">
              You've duplicated <span className="font-bold text-slate-900 dark:text-white">"{templateSuggestionData.name}"</span> multiple times.
            </p>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-semibold mb-1">Pro tip for future:</p>
                  <p>For truly recurring transactions, try using the <strong>"Batch"</strong> or <strong>"Recurring"</strong> buttons to create multiple entries at once!</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowTemplateSuggestion(false)} 
                className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Not Now
              </button>
              <button 
                onClick={() => {
                  setShowTemplateSuggestion(false);
                  showToast("Tip noted! Check out Batch & Recurring buttons", "success");
                }} 
                className="flex-1 py-3 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20 transition-colors"
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Phase 3: Batch Duplicate Modal */}
      {showBatchDuplicateModal && batchDuplicateData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto modal-overlay">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-6 shadow-2xl border border-purple-500/20 my-auto">
            <div className="flex items-center gap-4 mb-4 text-purple-600 dark:text-purple-400">
              <div className="bg-purple-100 dark:bg-purple-500/10 p-3 rounded-full">
                <Repeat size={24} strokeWidth={2} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold">Batch Duplicate</h3>
            </div>
            
            <p className="text-slate-600 dark:text-slate-300 mb-4 font-medium">
              Creating multiple copies of: <span className="font-bold text-slate-900 dark:text-white">{('name' in batchDuplicateData ? batchDuplicateData.name : null) || (batchDuplicateData as Invoice).client}</span>
            </p>
            
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block uppercase">Quick Presets</label>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => {
                    const dates: string[] = [];
                    for (let i = 1; i <= 3; i++) {
                      const d = new Date();
                      d.setMonth(d.getMonth() + i);
                      dates.push(d.toISOString().split('T')[0]);
                    }
                    executeBatchDuplicate(dates);
                  }} className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
                    3 Months
                  </button>
                  <button onClick={() => {
                    const dates: string[] = [];
                    for (let i = 1; i <= 6; i++) {
                      const d = new Date();
                      d.setMonth(d.getMonth() + i);
                      dates.push(d.toISOString().split('T')[0]);
                    }
                    executeBatchDuplicate(dates);
                  }} className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
                    6 Months
                  </button>
                  <button onClick={() => {
                    const dates: string[] = [];
                    for (let i = 1; i <= 12; i++) {
                      const d = new Date();
                      d.setMonth(d.getMonth() + i);
                      dates.push(d.toISOString().split('T')[0]);
                    }
                    executeBatchDuplicate(dates);
                  }} className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
                    12 Months
                  </button>
                </div>
              </div>
              
              <div className="text-xs text-slate-600 dark:text-slate-300 italic">
                💡 Each copy will be created for the first day of each month starting next month
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowBatchDuplicateModal(false);
                  setBatchDuplicateData(null);
                }} 
                className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Phase 3: Recurring Transaction Modal */}
      {showRecurringModal && recurringData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto modal-overlay">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-6 shadow-2xl border border-emerald-500/20 my-auto">
            <div className="flex items-center gap-4 mb-4 text-emerald-600 dark:text-emerald-400">
              <div className="bg-emerald-100 dark:bg-emerald-500/10 p-3 rounded-full">
                <Calendar size={24} strokeWidth={2} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold">Setup Recurring</h3>
            </div>
            
            <p className="text-slate-600 dark:text-slate-300 mb-4 font-medium">
              Schedule: <span className="font-bold text-slate-900 dark:text-white">{'name' in recurringData ? recurringData.name : (recurringData as Invoice).client}</span>
            </p>
            
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block uppercase">Frequency</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button onClick={() => setupRecurringTransaction('weekly', 12)} className="py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                    <div className="text-sm">Weekly</div>
                    <div className="text-xs text-slate-500 mt-1">Next 12 weeks</div>
                  </button>
                  <button onClick={() => setupRecurringTransaction('biweekly', 12)} className="py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                    <div className="text-sm">Bi-weekly</div>
                    <div className="text-xs text-slate-500 mt-1">Next 24 weeks</div>
                  </button>
                  <button onClick={() => setupRecurringTransaction('monthly', 12)} className="py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                    <div className="text-sm">Monthly</div>
                    <div className="text-xs text-slate-500 mt-1">Next 12 months</div>
                  </button>
                  <button onClick={() => setupRecurringTransaction('quarterly', 8)} className="py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                    <div className="text-sm">Quarterly</div>
                    <div className="text-xs text-slate-500 mt-1">Next 2 years</div>
                  </button>
                </div>
              </div>
              
              <div className="text-xs text-slate-600 dark:text-slate-300 italic">
                💡 All entries will be created immediately. Review them in your transactions.
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowRecurringModal(false);
                  setRecurringData(null);
                }} 
                className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
