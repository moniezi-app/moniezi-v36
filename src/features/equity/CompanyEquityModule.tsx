import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  Landmark,
  Link2,
  Mail,
  PenLine,
  Plus,
  Send,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  CompanyEquityState,
  EquityConsiderationType,
  EquityInvestmentReservation,
  EquityInvestorPackageStatus,
  EquityIssuance,
  EquityIssuanceStatus,
  EquityReservationInstrument,
  EquityReservationStatus,
  EquitySafeInstrument,
  EquitySafeStatus,
  EquityShareClass,
  EquityStakeholder,
  EquityStakeholderType,
} from '../../../types';
import {
  buildCapTableRows,
  calculateEquityTotals,
  createDemoEquityState,
  formatShares,
  normalizeCompanyEquityState,
  todayIso,
  toCsv,
} from './equityCore';
import { calculatePrivateRaiseFundingMetrics } from './fundingMetrics';

type ToastType = 'success' | 'error' | 'info';
type EquitySection = 'guide' | 'funding' | 'settings' | 'stakeholders' | 'issuance' | 'captable' | 'packages' | 'reservations' | 'safes';

type Props = {
  equity: CompanyEquityState;
  onChange: React.Dispatch<React.SetStateAction<CompanyEquityState>>;
  currencySymbol: string;
  defaultBusinessName: string;
  showToast: (message: string, type: ToastType) => void;
};

const newId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const money = (value: unknown, symbol: string) =>
  `${symbol}${toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const percent = (value: unknown) => `${toNumber(value).toFixed(4)}%`;

const fieldClass = 'w-full px-3 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-950 dark:!text-white font-semibold outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-slate-400';
const labelClass = 'text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 block';
const cardClass = 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm';
const subTextClass = 'text-sm font-medium text-slate-600 dark:text-slate-300';

const emptyStakeholder = (): Partial<EquityStakeholder> => ({
  type: 'investor',
  name: '',
  email: '',
  address: '',
  notes: '',
});

const emptyShareClass = (): Partial<EquityShareClass> => ({
  name: '',
  authorizedShares: 0,
  parValue: 0.0001,
  description: '',
});

const emptyIssuance = (shareClassId = ''): Partial<EquityIssuance> => ({
  issueDate: todayIso(),
  stakeholderId: '',
  shareClassId,
  shares: 0,
  pricePerShare: 0,
  considerationType: 'cash',
  considerationDescription: '',
  boardApprovalDate: '',
  certificateNumber: '',
  vestingTerms: '',
  restrictionLegend: '',
  status: 'issued',
  notes: '',
});

const emptySafe = (): Partial<EquitySafeInstrument> => ({
  investorId: '',
  investorName: '',
  date: todayIso(),
  amount: 0,
  valuationCap: undefined,
  discountRate: undefined,
  mfn: false,
  type: 'unknown',
  status: 'active',
  notes: '',
});

const emptyReservation = (): Partial<EquityInvestmentReservation> => ({
  date: todayIso(),
  investorName: '',
  email: '',
  phone: '',
  entityName: '',
  desiredAmount: 0,
  instrumentType: 'undecided',
  status: 'interested',
  followUpDate: '',
  signatureName: '',
  source: 'manual',
  notes: '',
});

const downloadText = (filename: string, content: string, mimeType = 'text/csv;charset=utf-8') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const statusPillClass = (tone: 'blue' | 'green' | 'amber' | 'red' | 'slate') => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return `inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${tones[tone]}`;
};

const reservationTone = (status: EquityReservationStatus): 'blue' | 'green' | 'amber' | 'red' | 'slate' => {
  if (status === 'converted') return 'green';
  if (status === 'confirmed' || status === 'reserved') return 'blue';
  if (status === 'declined') return 'red';
  if (status === 'interested') return 'amber';
  return 'slate';
};

const issuanceTone = (status: EquityIssuanceStatus): 'blue' | 'green' | 'amber' | 'red' | 'slate' => {
  if (status === 'issued') return 'green';
  if (status === 'cancelled') return 'red';
  if (status === 'repurchased' || status === 'transferred') return 'amber';
  return 'slate';
};

const formatInstrument = (value: EquityReservationInstrument | undefined) => {
  if (value === 'common_stock') return 'Common stock';
  if (value === 'safe') return 'SAFE';
  if (value === 'convertible_note') return 'Convertible note';
  return 'Undecided';
};

const packageStatusTone = (status: EquityInvestorPackageStatus | undefined): 'blue' | 'green' | 'amber' | 'red' | 'slate' => {
  if (status === 'signed') return 'green';
  if (status === 'sent' || status === 'opened' || status === 'ready_to_send') return 'blue';
  if (status === 'expired' || status === 'voided') return 'red';
  if (status === 'draft') return 'amber';
  return 'slate';
};

const packageStatusLabel = (status: EquityInvestorPackageStatus | undefined) => {
  if (status === 'ready_to_send') return 'ready to send';
  return status || 'draft';
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const paragraphize = (value: unknown) => String(value || '')
  .split(/\n+/)
  .map(line => line.trim())
  .filter(Boolean);

const createPackageToken = () => newId('pkg').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);

const defaultOfferingSummary = (companyName: string, instrument: EquityReservationInstrument | undefined) => {
  const instrumentLabel = formatInstrument(instrument).toLowerCase();
  return `${companyName || 'The company'} is preparing a private indication-of-interest package for a potential ${instrumentLabel} investment. This page is intended for invited family, friends, and known private contacts only.`;
};

const defaultMajorTerms = (symbol: string, instrument: EquityReservationInstrument | undefined, amount: unknown, price: unknown) => {
  const desired = toNumber(amount);
  const pricePerShare = toNumber(price);
  const estimatedShares = instrument === 'common_stock' && pricePerShare > 0 ? Math.floor(desired / pricePerShare) : 0;
  const priceLine = instrument === 'common_stock' && pricePerShare > 0
    ? `Indicative price per share: ${money(pricePerShare, symbol)}. Estimated shares at the reserved amount: ${estimatedShares.toLocaleString()}.`
    : 'Final share amount, conversion terms, or instrument terms will be confirmed in final company documents.';
  return `Indication amount: ${money(desired, symbol)}.\nInstrument: ${formatInstrument(instrument)}.\n${priceLine}\nThis is not final acceptance by the company and does not itself issue shares.`;
};

const defaultRiskText = () => 'Private-company investments are speculative and involve risk, including possible loss of the full investment. This reservation is subject to company acceptance, final documentation, payment instructions, corporate approval, and applicable securities-law compliance.';

const emptyInvestorPackage = (companyName = ''): Partial<EquityInvestmentReservation> => ({
  date: todayIso(),
  investorName: '',
  email: '',
  phone: '',
  entityName: '',
  desiredAmount: 0,
  instrumentType: 'common_stock',
  status: 'interested',
  followUpDate: '',
  signatureName: '',
  source: 'manual',
  packageStatus: 'draft',
  packageToken: '',
  packageTitle: 'Private Investment Reservation',
  packagePreparedFor: '',
  packageExpirationDate: '',
  packagePrivateMessage: '',
  packageOfferingSummary: defaultOfferingSummary(companyName || 'The company', 'common_stock'),
  packageMajorTerms: defaultMajorTerms('$', 'common_stock', 0, 0.25),
  packageRiskText: defaultRiskText(),
  packageMinimumInvestment: 5000,
  packagePricePerShare: 0.25,
  packageEstimatedShares: 0,
  packageLinkPlaceholder: '',
  consentElectronicRecords: false,
  acknowledgmentIndicationOnly: false,
  acknowledgmentRisk: false,
  notes: '',
});

const buildPackageLink = (token?: string) => {
  const cleanToken = token || 'preview-token';
  if (typeof window === 'undefined') return `https://your-domain.com/investor-reservation/${cleanToken}`;
  return `${window.location.origin}${window.location.pathname}#/investor-reservation/${cleanToken}`;
};

const packageEstimatedShares = (record: Partial<EquityInvestmentReservation>) => {
  if (record.instrumentType !== 'common_stock') return 0;
  const price = toNumber(record.packagePricePerShare);
  if (price <= 0) return 0;
  return Math.floor(toNumber(record.desiredAmount) / price);
};

const buildPackageHtml = (record: Partial<EquityInvestmentReservation>, companyName: string, symbol: string) => {
  const estimatedShares = packageEstimatedShares(record);
  const terms = paragraphize(record.packageMajorTerms || defaultMajorTerms(symbol, record.instrumentType, record.desiredAmount, record.packagePricePerShare));
  const risk = paragraphize(record.packageRiskText || defaultRiskText());
  const summary = paragraphize(record.packageOfferingSummary || defaultOfferingSummary(companyName, record.instrumentType));
  const htmlParagraphs = (lines: string[]) => lines.map(line => `<p>${escapeHtml(line)}</p>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(record.packageTitle || 'Private Investment Reservation')}</title>
<style>body{margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,Helvetica,sans-serif}.wrap{max-width:860px;margin:0 auto;padding:24px}.card{background:white;border:1px solid #dbe3ef;border-radius:24px;box-shadow:0 20px 60px rgba(15,23,42,.08);padding:28px;margin:18px 0}.top{background:#0f172a;color:white;border-radius:24px;padding:28px}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.16em;font-weight:800;color:#38bdf8}.title{font-size:32px;line-height:1.05;margin:10px 0;font-weight:900}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.box{border:1px solid #dbe3ef;border-radius:16px;padding:14px;background:#f8fafc}.label{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#64748b;font-weight:900}.value{font-weight:900;margin-top:5px}.notice{border-left:5px solid #f59e0b;background:#fffbeb;border-radius:14px;padding:14px;margin-top:14px}.sig{height:76px;border-bottom:2px solid #0f172a;display:flex;align-items:flex-end;font-size:24px;font-family:Georgia,serif;padding-bottom:8px}.button{display:block;text-align:center;background:#2563eb;color:white;border-radius:16px;padding:16px;font-weight:900;text-decoration:none;margin-top:18px}@media(max-width:720px){.grid{grid-template-columns:1fr}.title{font-size:26px}.wrap{padding:14px}.card,.top{padding:20px}}</style>
</head>
<body>
<div class="wrap">
  <div class="top"><div class="eyebrow">${escapeHtml(companyName)}</div><div class="title">${escapeHtml(record.packageTitle || 'Private Investment Reservation')}</div><div>Prepared for ${escapeHtml(record.investorName || record.packagePreparedFor || 'Investor')} ${record.packageExpirationDate ? `• expires ${escapeHtml(record.packageExpirationDate)}` : ''}</div></div>
  <div class="card"><div class="label">Private message</div>${htmlParagraphs(paragraphize(record.packagePrivateMessage || 'Please review the terms below. This is an indication-of-interest package, not final investment acceptance.'))}</div>
  <div class="card"><div class="label">Reservation summary</div><div class="grid"><div class="box"><div class="label">Investor</div><div class="value">${escapeHtml(record.investorName || 'Not entered')}</div></div><div class="box"><div class="label">Entity</div><div class="value">${escapeHtml(record.entityName || 'Individual / not entered')}</div></div><div class="box"><div class="label">Instrument</div><div class="value">${escapeHtml(formatInstrument(record.instrumentType))}</div></div><div class="box"><div class="label">Desired amount</div><div class="value">${escapeHtml(money(record.desiredAmount, symbol))}</div></div>${record.instrumentType === 'common_stock' ? `<div class="box"><div class="label">Indicative price/share</div><div class="value">${escapeHtml(money(record.packagePricePerShare, symbol))}</div></div><div class="box"><div class="label">Estimated shares</div><div class="value">${escapeHtml(estimatedShares.toLocaleString())}</div></div>` : ''}</div></div>
  <div class="card"><div class="label">Offering summary</div>${htmlParagraphs(summary)}</div>
  <div class="card"><div class="label">Major terms</div>${htmlParagraphs(terms)}</div>
  <div class="card"><div class="label">Acknowledgments</div><div class="notice">I understand this is an indication of interest only, not final company acceptance, not a completed investment, and not issued shares.</div><div class="notice">I consent to receive and sign records electronically for this package.</div><div class="notice">${htmlParagraphs(risk)}</div></div>
  <div class="card"><div class="label">Typed signature preview</div><div class="sig">${escapeHtml(record.signatureName || record.investorName || '')}</div><p>Date/time will be captured when the future Cloudflare investor portal is connected.</p><a class="button" href="#">Submit reservation — preview only</a></div>
</div>
</body>
</html>`;
};

function SigningPackagePreview({ record, companyName, currencySymbol }: { record: Partial<EquityInvestmentReservation>; companyName: string; currencySymbol: string }) {
  const estimatedShares = packageEstimatedShares(record);
  const summary = paragraphize(record.packageOfferingSummary || defaultOfferingSummary(companyName, record.instrumentType));
  const terms = paragraphize(record.packageMajorTerms || defaultMajorTerms(currencySymbol, record.instrumentType, record.desiredAmount, record.packagePricePerShare));
  const risk = paragraphize(record.packageRiskText || defaultRiskText());
  const displayName = record.investorName || record.packagePreparedFor || 'Investor';
  return (
    <div className="rounded-[28px] border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 p-3 sm:p-5">
      <div className="rounded-[24px] bg-white dark:bg-slate-950 shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="bg-slate-950 !text-white p-6 sm:p-8">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-300">{companyName || 'Company'}</div>
          <h3 className="mt-2 text-3xl font-black leading-tight">{record.packageTitle || 'Private Investment Reservation'}</h3>
          <div className="mt-3 text-sm font-semibold text-slate-300">Prepared for {displayName}{record.packageExpirationDate ? ` • expires ${record.packageExpirationDate}` : ''}</div>
        </div>
        <div className="p-5 sm:p-8 space-y-5">
          <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 p-4">
            <div className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">Private message</div>
            {paragraphize(record.packagePrivateMessage || 'Please review the terms below. This is an indication-of-interest package, not final investment acceptance.').map((line, idx) => <p key={idx} className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{line}</p>)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4"><div className={labelClass}>Investor</div><div className="font-black text-slate-950 dark:!text-white">{displayName}</div></div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4"><div className={labelClass}>Entity</div><div className="font-black text-slate-950 dark:!text-white">{record.entityName || 'Individual / not entered'}</div></div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4"><div className={labelClass}>Instrument</div><div className="font-black text-slate-950 dark:!text-white">{formatInstrument(record.instrumentType)}</div></div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4"><div className={labelClass}>Desired amount</div><div className="font-black text-slate-950 dark:!text-white">{money(record.desiredAmount, currencySymbol)}</div></div>
            {record.instrumentType === 'common_stock' && <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4"><div className={labelClass}>Indicative price/share</div><div className="font-black text-slate-950 dark:!text-white">{money(record.packagePricePerShare, currencySymbol)}</div></div>}
            {record.instrumentType === 'common_stock' && <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4"><div className={labelClass}>Estimated shares</div><div className="font-black text-slate-950 dark:!text-white">{estimatedShares.toLocaleString()}</div></div>}
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4"><div className={labelClass}>Offering summary</div>{summary.map((line, idx) => <p key={idx} className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{line}</p>)}</div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4"><div className={labelClass}>Major terms</div>{terms.map((line, idx) => <p key={idx} className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{line}</p>)}</div>
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
            <div className={labelClass}>Acknowledgments shown to investor</div>
            <label className="flex gap-3 text-sm font-bold text-slate-700 dark:text-slate-200"><input type="checkbox" checked readOnly /> I consent to receive and sign records electronically.</label>
            <label className="flex gap-3 text-sm font-bold text-slate-700 dark:text-slate-200"><input type="checkbox" checked readOnly /> I understand this is an indication of interest only and not issued shares.</label>
            <label className="flex gap-3 text-sm font-bold text-slate-700 dark:text-slate-200"><input type="checkbox" checked readOnly /> I understand private-company investments involve risk.</label>
            {risk.map((line, idx) => <p key={idx} className="text-sm font-semibold text-amber-900 dark:text-amber-100">{line}</p>)}
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <div className={labelClass}>Typed signature preview</div>
            <div className="h-20 border-b-2 border-slate-900 dark:border-slate-200 flex items-end pb-2 font-serif text-2xl text-slate-950 dark:!text-white">{record.signatureName || displayName}</div>
            <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Future online portal will capture submit timestamp and audit details. This owner-side preview does not replace a securities portal.</div>
          </div>
          <button type="button" className="w-full rounded-2xl bg-blue-600 !text-white font-black px-5 py-4 flex items-center justify-center gap-2"><PenLine size={18}/> Submit reservation — preview only</button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
          <div className="mt-1 text-2xl font-black text-slate-950 dark:!text-white">{value}</div>
        </div>
        <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 p-2 text-blue-600 dark:text-blue-300">{icon}</div>
      </div>
      <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{note}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function CompanyEquityModule({ equity, onChange, currencySymbol, defaultBusinessName, showToast }: Props) {
  const state = useMemo(() => normalizeCompanyEquityState(equity, defaultBusinessName), [equity, defaultBusinessName]);
  const totals = useMemo(() => calculateEquityTotals(state), [state]);
  const capRows = useMemo(() => buildCapTableRows(state), [state]);

  const [activeSection, setActiveSection] = useState<EquitySection>('reservations');
  const [pendingScrollSection, setPendingScrollSection] = useState<EquitySection | null>(null);
  const [stakeholderDraft, setStakeholderDraft] = useState<Partial<EquityStakeholder>>(emptyStakeholder());
  const [editingStakeholderId, setEditingStakeholderId] = useState<string | null>(null);
  const [shareClassDraft, setShareClassDraft] = useState<Partial<EquityShareClass>>(emptyShareClass());
  const [editingShareClassId, setEditingShareClassId] = useState<string | null>(null);
  const [issuanceDraft, setIssuanceDraft] = useState<Partial<EquityIssuance>>(emptyIssuance(state.shareClasses[0]?.id));
  const [editingIssuanceId, setEditingIssuanceId] = useState<string | null>(null);
  const [safeDraft, setSafeDraft] = useState<Partial<EquitySafeInstrument>>(emptySafe());
  const [editingSafeId, setEditingSafeId] = useState<string | null>(null);
  const [reservationDraft, setReservationDraft] = useState<Partial<EquityInvestmentReservation>>(emptyReservation());
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const companyName = state.profile.legalName || defaultBusinessName || 'Company';
  const [packageDraft, setPackageDraft] = useState<Partial<EquityInvestmentReservation>>(() => emptyInvestorPackage(defaultBusinessName || 'Company'));
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [previewPackage, setPreviewPackage] = useState<Partial<EquityInvestmentReservation> | null>(null);
  const investorPackages = useMemo(() => state.reservations.filter(r => !!(r.packageStatus || r.packageToken || r.packageTitle || r.packageLinkPlaceholder)), [state.reservations]);

  const selectedHolder = state.stakeholders.find(s => s.id === issuanceDraft.stakeholderId);
  const selectedShareClass = state.shareClasses.find(c => c.id === issuanceDraft.shareClassId);
  const issuancePaidAmount = toNumber(issuanceDraft.shares) * toNumber(issuanceDraft.pricePerShare);
  const { openInterestAmount, signedPackageAmount, recordedCashSharesAmount } = useMemo(
    () => calculatePrivateRaiseFundingMetrics(state),
    [state]
  );

  useEffect(() => {
    if (!pendingScrollSection || activeSection !== pendingScrollSection) return;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        document
          .getElementById(`moniezi-equity-section-${pendingScrollSection}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setPendingScrollSection(null);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [activeSection, pendingScrollSection]);

  const openSection = (section: EquitySection) => {
    setPendingScrollSection(section);
    setActiveSection(section);
  };

  const updateProfile = (patch: Partial<CompanyEquityState['profile']>) => {
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return { ...normalized, profile: { ...normalized.profile, ...patch } };
    });
  };

  const loadDemoData = () => {
    if (state.stakeholders.length || state.issuances.length || state.safes.length || state.reservations.length) {
      if (!confirm('Load demo private-raise data? This replaces the current Private Raise Tracker records only.')) return;
    }
    onChange(createDemoEquityState(defaultBusinessName || 'MONIEZI Demo Studio, Inc.'));
    setActiveSection('reservations');
    setStakeholderDraft(emptyStakeholder());
    setShareClassDraft(emptyShareClass());
    setIssuanceDraft(emptyIssuance('eq_cls_common'));
    setSafeDraft(emptySafe());
    setReservationDraft(emptyReservation());
    setPackageDraft(emptyInvestorPackage(defaultBusinessName || 'Company'));
    setEditingPackageId(null);
    setPreviewPackage(null);
    showToast('Demo private-raise data loaded.', 'success');
  };

  const saveStakeholder = () => {
    const name = String(stakeholderDraft.name || '').trim();
    if (!name) return showToast('Stakeholder name is required.', 'error');
    const now = new Date().toISOString();
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      if (editingStakeholderId) {
        return {
          ...normalized,
          stakeholders: normalized.stakeholders.map(s => s.id === editingStakeholderId ? {
            ...s,
            name,
            email: stakeholderDraft.email || '',
            address: stakeholderDraft.address || '',
            type: (stakeholderDraft.type || 'other') as EquityStakeholderType,
            notes: stakeholderDraft.notes || '',
            updatedAt: now,
          } : s),
        };
      }
      const created: EquityStakeholder = {
        id: newId('eq_holder'),
        name,
        email: stakeholderDraft.email || '',
        address: stakeholderDraft.address || '',
        type: (stakeholderDraft.type || 'other') as EquityStakeholderType,
        notes: stakeholderDraft.notes || '',
        createdAt: now,
        updatedAt: now,
      };
      return { ...normalized, stakeholders: [created, ...normalized.stakeholders] };
    });
    setStakeholderDraft(emptyStakeholder());
    setEditingStakeholderId(null);
    showToast(editingStakeholderId ? 'Stakeholder updated.' : 'Stakeholder added.', 'success');
  };

  const editStakeholder = (stakeholder: EquityStakeholder) => {
    setEditingStakeholderId(stakeholder.id);
    setStakeholderDraft(stakeholder);
    setActiveSection('stakeholders');
  };

  const deleteStakeholder = (id: string) => {
    const isUsed = state.issuances.some(i => i.stakeholderId === id) || state.safes.some(s => s.investorId === id);
    if (isUsed) return showToast('This stakeholder is linked to equity records. Delete or reassign those records first.', 'error');
    if (!confirm('Delete this stakeholder?')) return;
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return { ...normalized, stakeholders: normalized.stakeholders.filter(s => s.id !== id) };
    });
    showToast('Stakeholder deleted.', 'info');
  };

  const saveShareClass = () => {
    const name = String(shareClassDraft.name || '').trim();
    if (!name) return showToast('Share class name is required.', 'error');
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      if (editingShareClassId) {
        return {
          ...normalized,
          shareClasses: normalized.shareClasses.map(c => c.id === editingShareClassId ? {
            ...c,
            name,
            authorizedShares: toNumber(shareClassDraft.authorizedShares),
            parValue: toNumber(shareClassDraft.parValue),
            description: shareClassDraft.description || '',
          } : c),
        };
      }
      const created: EquityShareClass = {
        id: newId('eq_cls'),
        name,
        authorizedShares: toNumber(shareClassDraft.authorizedShares),
        parValue: toNumber(shareClassDraft.parValue),
        description: shareClassDraft.description || '',
      };
      return { ...normalized, shareClasses: [...normalized.shareClasses, created] };
    });
    setShareClassDraft(emptyShareClass());
    setEditingShareClassId(null);
    showToast(editingShareClassId ? 'Share class updated.' : 'Share class added.', 'success');
  };

  const editShareClass = (shareClass: EquityShareClass) => {
    setEditingShareClassId(shareClass.id);
    setShareClassDraft(shareClass);
    setActiveSection('settings');
  };

  const deleteShareClass = (id: string) => {
    if (state.shareClasses.length <= 1) return showToast('At least one share class is required.', 'error');
    if (state.issuances.some(i => i.shareClassId === id)) return showToast('This share class has issuances. Delete or reassign those records first.', 'error');
    if (!confirm('Delete this share class?')) return;
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return { ...normalized, shareClasses: normalized.shareClasses.filter(c => c.id !== id) };
    });
    showToast('Share class deleted.', 'info');
  };

  const saveIssuance = () => {
    if (!issuanceDraft.stakeholderId) return showToast('Select who receives the shares.', 'error');
    if (!issuanceDraft.shareClassId) return showToast('Select a share class.', 'error');
    if (toNumber(issuanceDraft.shares) <= 0) return showToast('Shares issued must be greater than zero.', 'error');
    const now = new Date().toISOString();
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      const payload: Omit<EquityIssuance, 'id' | 'createdAt' | 'updatedAt'> = {
        issueDate: issuanceDraft.issueDate || todayIso(),
        stakeholderId: issuanceDraft.stakeholderId || '',
        shareClassId: issuanceDraft.shareClassId || normalized.shareClasses[0]?.id || '',
        shares: toNumber(issuanceDraft.shares),
        pricePerShare: toNumber(issuanceDraft.pricePerShare),
        considerationType: (issuanceDraft.considerationType || 'cash') as EquityConsiderationType,
        considerationDescription: issuanceDraft.considerationDescription || '',
        boardApprovalDate: issuanceDraft.boardApprovalDate || '',
        certificateNumber: issuanceDraft.certificateNumber || '',
        vestingTerms: issuanceDraft.vestingTerms || '',
        restrictionLegend: issuanceDraft.restrictionLegend || '',
        status: (issuanceDraft.status || 'issued') as EquityIssuanceStatus,
        notes: issuanceDraft.notes || '',
      };
      if (editingIssuanceId) {
        return {
          ...normalized,
          issuances: normalized.issuances.map(i => i.id === editingIssuanceId ? { ...i, ...payload, updatedAt: now } : i),
        };
      }
      return {
        ...normalized,
        issuances: [{ id: newId('eq_issue'), ...payload, createdAt: now, updatedAt: now }, ...normalized.issuances],
      };
    });
    setIssuanceDraft(emptyIssuance(state.shareClasses[0]?.id));
    setEditingIssuanceId(null);
    showToast(editingIssuanceId ? 'Share issuance updated.' : 'Share issuance recorded.', 'success');
  };

  const editIssuance = (issuance: EquityIssuance) => {
    setEditingIssuanceId(issuance.id);
    setIssuanceDraft(issuance);
    setActiveSection('issuance');
  };

  const deleteIssuance = (id: string) => {
    if (!confirm('Delete this issuance record?')) return;
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return { ...normalized, issuances: normalized.issuances.filter(i => i.id !== id) };
    });
    showToast('Issuance deleted.', 'info');
  };

  const saveSafe = () => {
    const investorName = String(safeDraft.investorName || '').trim();
    const linkedInvestor = state.stakeholders.find(s => s.id === safeDraft.investorId);
    if (!investorName && !linkedInvestor) return showToast('Investor name is required for SAFE tracking.', 'error');
    if (toNumber(safeDraft.amount) <= 0) return showToast('SAFE amount must be greater than zero.', 'error');
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      const linked = normalized.stakeholders.find(s => s.id === safeDraft.investorId);
      const payload: Omit<EquitySafeInstrument, 'id'> = {
        investorId: safeDraft.investorId || '',
        investorName: investorName || linked?.name || '',
        date: safeDraft.date || todayIso(),
        amount: toNumber(safeDraft.amount),
        valuationCap: safeDraft.valuationCap === undefined || safeDraft.valuationCap === null ? undefined : toNumber(safeDraft.valuationCap),
        discountRate: safeDraft.discountRate === undefined || safeDraft.discountRate === null ? undefined : toNumber(safeDraft.discountRate),
        mfn: !!safeDraft.mfn,
        type: safeDraft.type || 'unknown',
        status: (safeDraft.status || 'active') as EquitySafeStatus,
        notes: safeDraft.notes || '',
      };
      if (editingSafeId) {
        return { ...normalized, safes: normalized.safes.map(s => s.id === editingSafeId ? { id: s.id, ...payload } : s) };
      }
      return { ...normalized, safes: [{ id: newId('eq_safe'), ...payload }, ...normalized.safes] };
    });
    setSafeDraft(emptySafe());
    setEditingSafeId(null);
    showToast(editingSafeId ? 'SAFE record updated.' : 'SAFE record added.', 'success');
  };

  const deleteSafe = (id: string) => {
    if (!confirm('Delete this SAFE record?')) return;
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return { ...normalized, safes: normalized.safes.filter(s => s.id !== id) };
    });
    showToast('SAFE record deleted.', 'info');
  };

  const saveReservation = () => {
    const investorName = String(reservationDraft.investorName || '').trim();
    if (!investorName) return showToast('Investor/reservation name is required.', 'error');
    if (toNumber(reservationDraft.desiredAmount) <= 0) return showToast('Reservation amount must be greater than zero.', 'error');
    const now = new Date().toISOString();
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      const payload: Omit<EquityInvestmentReservation, 'id' | 'createdAt' | 'updatedAt'> = {
        date: reservationDraft.date || todayIso(),
        investorName,
        email: reservationDraft.email || '',
        phone: reservationDraft.phone || '',
        entityName: reservationDraft.entityName || '',
        desiredAmount: toNumber(reservationDraft.desiredAmount),
        instrumentType: (reservationDraft.instrumentType || 'undecided') as EquityReservationInstrument,
        status: (reservationDraft.status || 'interested') as EquityReservationStatus,
        followUpDate: reservationDraft.followUpDate || '',
        signatureName: reservationDraft.signatureName || '',
        source: reservationDraft.source || 'manual',
        notes: reservationDraft.notes || '',
      };
      if (editingReservationId) {
        return {
          ...normalized,
          reservations: normalized.reservations.map(r => r.id === editingReservationId ? { ...r, ...payload, updatedAt: now } : r),
        };
      }
      return {
        ...normalized,
        reservations: [{ id: newId('eq_reservation'), ...payload, createdAt: now, updatedAt: now }, ...normalized.reservations],
      };
    });
    setReservationDraft(emptyReservation());
    setEditingReservationId(null);
    showToast(editingReservationId ? 'Reservation updated.' : 'Reservation recorded.', 'success');
  };

  const editReservation = (reservation: EquityInvestmentReservation) => {
    setEditingReservationId(reservation.id);
    setReservationDraft(reservation);
    setActiveSection('reservations');
  };

  const deleteReservation = (id: string) => {
    if (!confirm('Delete this reservation record?')) return;
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return { ...normalized, reservations: normalized.reservations.filter(r => r.id !== id) };
    });
    showToast('Reservation deleted.', 'info');
  };

  const packageLinkFor = (record: Partial<EquityInvestmentReservation>) => record.packageLinkPlaceholder || buildPackageLink(record.packageToken || 'preview-token');

  const buildPackageRecord = (draft: Partial<EquityInvestmentReservation>): Omit<EquityInvestmentReservation, 'id' | 'createdAt' | 'updatedAt'> => {
    const investorName = String(draft.investorName || '').trim();
    const token = draft.packageToken || createPackageToken();
    const instrumentType = (draft.instrumentType || 'common_stock') as EquityReservationInstrument;
    const estimatedShares = instrumentType === 'common_stock' ? packageEstimatedShares(draft) : 0;
    return {
      date: draft.date || todayIso(),
      investorName,
      email: draft.email || '',
      phone: draft.phone || '',
      entityName: draft.entityName || '',
      desiredAmount: toNumber(draft.desiredAmount),
      instrumentType,
      status: (draft.status || 'interested') as EquityReservationStatus,
      followUpDate: draft.followUpDate || '',
      signatureName: draft.signatureName || '',
      source: 'manual',
      packageStatus: (draft.packageStatus || 'draft') as EquityInvestorPackageStatus,
      packageToken: token,
      packageTitle: draft.packageTitle || 'Private Investment Reservation',
      packagePreparedFor: draft.packagePreparedFor || investorName,
      packageExpirationDate: draft.packageExpirationDate || '',
      packagePrivateMessage: draft.packagePrivateMessage || '',
      packageOfferingSummary: draft.packageOfferingSummary || defaultOfferingSummary(companyName, instrumentType),
      packageMajorTerms: draft.packageMajorTerms || defaultMajorTerms(currencySymbol, instrumentType, draft.desiredAmount, draft.packagePricePerShare),
      packageRiskText: draft.packageRiskText || defaultRiskText(),
      packageMinimumInvestment: draft.packageMinimumInvestment === undefined || draft.packageMinimumInvestment === null ? undefined : toNumber(draft.packageMinimumInvestment),
      packagePricePerShare: draft.packagePricePerShare === undefined || draft.packagePricePerShare === null ? undefined : toNumber(draft.packagePricePerShare),
      packageEstimatedShares: estimatedShares,
      packageLinkPlaceholder: draft.packageLinkPlaceholder || buildPackageLink(token),
      packageLastPreviewedAt: draft.packageLastPreviewedAt || '',
      packageSentAt: draft.packageSentAt || '',
      packageOpenedAt: draft.packageOpenedAt || '',
      packageSignedAt: draft.packageSignedAt || '',
      consentElectronicRecords: !!draft.consentElectronicRecords,
      acknowledgmentIndicationOnly: !!draft.acknowledgmentIndicationOnly,
      acknowledgmentRisk: !!draft.acknowledgmentRisk,
      notes: draft.notes || '',
    };
  };

  const saveInvestorPackage = () => {
    const investorName = String(packageDraft.investorName || '').trim();
    if (!investorName) return showToast('Investor name is required for the signing package.', 'error');
    if (toNumber(packageDraft.desiredAmount) <= 0) return showToast('Desired investment amount must be greater than zero.', 'error');
    const now = new Date().toISOString();
    const payload = buildPackageRecord(packageDraft);
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      if (editingPackageId) {
        return {
          ...normalized,
          reservations: normalized.reservations.map(r => r.id === editingPackageId ? { ...r, ...payload, updatedAt: now } : r),
        };
      }
      return {
        ...normalized,
        reservations: [{ id: newId('eq_reservation'), ...payload, createdAt: now, updatedAt: now }, ...normalized.reservations],
      };
    });
    setPackageDraft(emptyInvestorPackage(companyName));
    setEditingPackageId(null);
    showToast(editingPackageId ? 'Investor signing package updated.' : 'Investor signing package drafted.', 'success');
  };

  const editInvestorPackage = (record: EquityInvestmentReservation) => {
    setEditingPackageId(record.id);
    setPackageDraft({
      ...record,
      packageMajorTerms: record.packageMajorTerms || defaultMajorTerms(currencySymbol, record.instrumentType, record.desiredAmount, record.packagePricePerShare),
      packageOfferingSummary: record.packageOfferingSummary || defaultOfferingSummary(companyName, record.instrumentType),
      packageRiskText: record.packageRiskText || defaultRiskText(),
    });
    setPreviewPackage(record);
    setActiveSection('packages');
  };

  const previewInvestorPackage = (record?: Partial<EquityInvestmentReservation>) => {
    const payload = buildPackageRecord(record || packageDraft);
    const preview = { id: editingPackageId || 'preview', ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as EquityInvestmentReservation;
    setPreviewPackage(preview);
    if (editingPackageId) {
      onChange(prev => {
        const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
        return { ...normalized, reservations: normalized.reservations.map(r => r.id === editingPackageId ? { ...r, packageLastPreviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : r) };
      });
    }
  };

  const packageInvitationText = (record: Partial<EquityInvestmentReservation>) => {
    const link = packageLinkFor(record);
    return `Hi ${record.investorName || 'there'},\n\n${companyName} prepared a private investment reservation / indication-of-interest package for your review.\n\nReview link: ${link}\n\nThis is only a reservation / indication of interest. It is not final company acceptance, not payment instructions, and not an issued-share record. Final investment documents and company approval remain required.`;
  };

  const copyInvitation = async (record: Partial<EquityInvestmentReservation>) => {
    const text = packageInvitationText(record);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Invitation text copied.', 'success');
    } catch {
      downloadText(`moniezi_investor_invitation_${todayIso()}.txt`, text, 'text/plain;charset=utf-8');
      showToast('Clipboard unavailable. Invitation text downloaded instead.', 'info');
    }
  };

  const downloadPackageHtml = (record: Partial<EquityInvestmentReservation>) => {
    const html = buildPackageHtml(record, companyName, currencySymbol);
    const safeName = String(record.investorName || 'investor').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'investor';
    downloadText(`moniezi_${safeName}_signing_package_preview_${todayIso()}.html`, html, 'text/html;charset=utf-8');
  };

  const updatePackageStatus = (id: string, status: EquityInvestorPackageStatus) => {
    const now = new Date().toISOString();
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return {
        ...normalized,
        reservations: normalized.reservations.map(r => {
          if (r.id !== id) return r;
          return {
            ...r,
            packageStatus: status,
            status: status === 'signed' ? 'confirmed' : r.status,
            packageSentAt: status === 'sent' ? now : r.packageSentAt,
            packageOpenedAt: status === 'opened' ? now : r.packageOpenedAt,
            packageSignedAt: status === 'signed' ? now : r.packageSignedAt,
            updatedAt: now,
          };
        }),
      };
    });
    showToast(`Package marked ${packageStatusLabel(status)}.`, 'success');
  };

  const draftPreviewRecord = () => {
    const payload = buildPackageRecord(packageDraft);
    return { id: editingPackageId || 'preview', ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as EquityInvestmentReservation;
  };


  const exportCapTableCsv = () => {
    const rows = [
      ['Stakeholder', 'Type', 'Share Class', 'Shares', 'Ownership %', 'Cash Paid'],
      ...capRows.map(r => [r.stakeholderName, r.stakeholderType, r.shareClassName, r.shares, r.ownershipPct.toFixed(6), r.cashPaid]),
    ];
    downloadText(`moniezi_cap_table_${todayIso()}.csv`, toCsv(rows));
  };

  const exportLedgerCsv = () => {
    const rows = [
      ['Date', 'Stakeholder', 'Share Class', 'Shares', 'Price Per Share', 'Amount Paid', 'Consideration', 'Board Approval Date', 'Certificate', 'Status', 'Vesting', 'Restrictions', 'Notes'],
      ...state.issuances.map(i => {
        const holder = state.stakeholders.find(s => s.id === i.stakeholderId);
        const shareClass = state.shareClasses.find(c => c.id === i.shareClassId);
        return [i.issueDate, holder?.name || '', shareClass?.name || '', i.shares, i.pricePerShare, i.shares * i.pricePerShare, i.considerationType, i.boardApprovalDate || '', i.certificateNumber || '', i.status, i.vestingTerms || '', i.restrictionLegend || '', i.notes || ''];
      }),
    ];
    downloadText(`moniezi_stock_ledger_${todayIso()}.csv`, toCsv(rows));
  };

  const exportSafesCsv = () => {
    const rows = [
      ['Date', 'Investor', 'Amount', 'Valuation Cap', 'Discount %', 'MFN', 'Type', 'Status', 'Notes'],
      ...state.safes.map(s => [s.date, s.investorName, s.amount, s.valuationCap ?? '', s.discountRate ?? '', s.mfn ? 'Yes' : 'No', s.type || '', s.status, s.notes || '']),
    ];
    downloadText(`moniezi_safe_tracker_${todayIso()}.csv`, toCsv(rows));
  };

  const exportReservationsCsv = () => {
    const rows = [
      ['Date', 'Investor', 'Email', 'Phone', 'Entity', 'Proposed Pledge Amount', 'Instrument', 'Status', 'Package Status', 'Package Link', 'Expires', 'Estimated Shares', 'Follow-up Date', 'Typed Signature', 'Source', 'Notes'],
      ...state.reservations.map(r => [r.date, r.investorName, r.email || '', r.phone || '', r.entityName || '', r.desiredAmount, formatInstrument(r.instrumentType), r.status, r.packageStatus || '', r.packageLinkPlaceholder || '', r.packageExpirationDate || '', r.packageEstimatedShares || '', r.followUpDate || '', r.signatureName || '', r.source || 'manual', r.notes || '']),
    ];
    downloadText(`moniezi_investment_reservations_${todayIso()}.csv`, toCsv(rows));
  };

  const primaryNavItems: Array<{ id: EquitySection; label: string }> = [
    { id: 'reservations', label: 'Interest' },
    { id: 'packages', label: 'Packages' },
    { id: 'funding', label: 'Funding' },
  ];

  const secondaryNavItems: Array<{ id: EquitySection; label: string }> = [
    { id: 'guide', label: 'Overview' },
    { id: 'safes', label: 'SAFEs / Agreements' },
    { id: 'issuance', label: 'Issued Ownership' },
    { id: 'captable', label: 'Ownership Summary' },
    { id: 'stakeholders', label: 'People & Entities' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300 flex-shrink-0">
            <Landmark size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:!text-white font-brand">Private Raise Tracker</h1>
            <div className="mt-2 space-y-1.5 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
              <p>Simple owner-side workflow for friends, family, and early private investors.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Track investor interest, proposed pledges, packages, signatures, and funding status.</li>
                <li>Keep SAFEs, issued ownership records, and ownership summaries organized for review.</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openSection('settings')} className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-3 text-sm font-black text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center gap-2">
            <Shield size={16} /> Raise Settings
          </button>
          <button onClick={loadDemoData} className="rounded-xl bg-blue-600 hover:bg-blue-700 !text-white px-4 py-3 text-sm font-black flex items-center gap-2 shadow-lg shadow-blue-600/20">
            <FileText size={16} /> Load Demo Raise
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <SummaryCard label="Issued Ownership" value={formatShares(totals.issuedShares)} note={`${formatShares(totals.unissuedShares)} unissued shares remain`} icon={<CheckCircle size={20} />} />
        <SummaryCard label="People" value={String(totals.stakeholderCount)} note="Investors, founders, advisors, entities" icon={<Users size={20} />} />
        <SummaryCard label="Active Agreements" value={money(totals.activeSafeAmount, currencySymbol)} note={`${totals.activeSafeCount} SAFE/agreement records`} icon={<FileText size={20} />} />
        <SummaryCard label="Pledged Interest" value={money(totals.reservationAmount, currencySymbol)} note={`${totals.reservationCount} open interests / pledges`} icon={<Building2 size={20} />} />
        <SummaryCard label="Authorized Shares" value={formatShares(totals.authorizedShares)} note="Configured in Raise Settings" icon={<Landmark size={20} />} />
      </div>

      <details className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 p-4">
        <summary className="flex cursor-pointer list-none items-start gap-3 text-sm font-black text-amber-900 dark:text-amber-100">
          <AlertTriangle className="text-amber-600 dark:text-amber-300 mt-0.5 flex-shrink-0" size={20} />
          <span>Internal records only — final documents, payments, and approvals should be handled separately.</span>
        </summary>
        <p className="mt-3 pl-8 text-sm font-semibold leading-6 text-amber-900 dark:text-amber-100">
          Use this tracker to organize investor interest, proposed pledges, package status, SAFEs, and issued ownership records. It does not replace board approvals, securities-law review, investor onboarding, payment processing, or lawyer-approved issuance documents.
        </p>
      </details>

      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 shadow-sm">
          <div className="grid grid-cols-3 gap-1">
            {primaryNavItems.map(item => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openSection(item.id)}
                  aria-pressed={active}
                  className={`moniezi-equity-primary-tab ${active ? 'is-active' : 'is-inactive'} min-h-[3.25rem] rounded-xl px-2 text-center text-[13px] sm:text-sm font-black leading-tight transition-all ${
                    active
                      ? '!bg-slate-950 !text-white dark:!bg-white dark:!text-slate-950 shadow-md shadow-slate-950/10 dark:shadow-black/30'
                      : '!bg-transparent !text-slate-950 dark:!text-slate-100 hover:!bg-slate-100 dark:hover:!bg-slate-900'
                  }`}
                >
                  <span className="moniezi-equity-primary-tab-label block whitespace-normal">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Additional equity sections">
          {secondaryNavItems.map(item => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openSection(item.id)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-2 text-xs font-black transition-all ${
                  active
                    ? '!border-blue-600 !bg-blue-600 !text-white dark:!border-blue-400 dark:!bg-blue-400 dark:!text-slate-950 shadow-sm'
                    : '!border-slate-300 dark:!border-slate-700 !bg-white dark:!bg-slate-950 !text-slate-800 dark:!text-slate-200 hover:!bg-slate-50 dark:hover:!bg-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeSection === 'guide' && (
        <section id="moniezi-equity-section-guide" className={`${cardClass} p-5 space-y-5`}>
          <div>
            <h2 className="text-xl font-black text-slate-950 dark:!text-white">Private Raise Overview</h2>
            <p className={subTextClass}>Use this screen as the owner's back-office tracker while MONIEZI Raise handles the investor-facing signup page.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            {[
              ['1', 'Track interest', 'Record who may invest, their proposed pledge amount, relationship, and next follow-up.'],
              ['2', 'Send package', 'Track whether the investor package was drafted, sent, opened, signed, or voided.'],
              ['3', 'Record funding', 'Compare interested, signed, SAFE/agreement, and funded ownership records.'],
              ['4', 'Keep agreements', 'Store SAFE or agreement records separately until they are funded or converted.'],
              ['5', 'Record ownership', 'Only use issued ownership after the company has approved and recorded actual shares.'],
            ].map(([num, title, body]) => (
              <div key={num} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                <div className="h-8 w-8 rounded-full bg-blue-600 !text-white flex items-center justify-center font-black">{num}</div>
                <div className="mt-3 text-base font-black text-slate-950 dark:!text-white">{title}</div>
                <p className="mt-1 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{body}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <h3 className="font-black text-slate-950 dark:!text-white">What is a pledge here?</h3>
              <p className={subTextClass}>A proposed pledge is a tracking record for interest. It is not counted as ownership until you record a SAFE/agreement or issued shares.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <h3 className="font-black text-slate-950 dark:!text-white">What is the owner supposed to do?</h3>
              <p className={subTextClass}>Follow the money trail: interested → package sent → signed → funded → SAFE or issued ownership record.</p>
            </div>
          </div>
        </section>
      )}

      {activeSection === 'funding' && (
        <section id="moniezi-equity-section-funding" className={`${cardClass} p-5 space-y-5`}>
          <div>
            <h2 className="text-xl font-black text-slate-950 dark:!text-white">Funding Status</h2>
            <p className={subTextClass}>Plain-English snapshot of the private raise pipeline: interest, signed packages, active agreements, and recorded funded ownership.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard label="Interested / Pledged" value={money(openInterestAmount, currencySymbol)} note="Open interest, reserved, or confirmed" icon={<Building2 size={20} />} />
            <SummaryCard label="Signed Packages" value={money(signedPackageAmount, currencySymbol)} note="Packages explicitly marked signed" icon={<PenLine size={20} />} />
            <SummaryCard label="Active Agreements" value={money(totals.activeSafeAmount, currencySymbol)} note={`${totals.activeSafeCount} SAFE/agreement records`} icon={<FileText size={20} />} />
            <SummaryCard label="Recorded Funded Shares" value={money(recordedCashSharesAmount, currencySymbol)} note="Cash share issuances already recorded" icon={<CheckCircle size={20} />} />
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
            <h3 className="font-black text-slate-950 dark:!text-white">Recommended owner workflow</h3>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {['Interested', 'Package sent', 'Signed', 'Funded', 'Recorded'].map((step, index) => (
                <div key={step} className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
                  <div className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-300">Step {index + 1}</div>
                  <div className="mt-1 font-black text-slate-950 dark:!text-white">{step}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeSection === 'settings' && (
        <section id="moniezi-equity-section-settings" className={`${cardClass} p-5 space-y-6`}>
          <div>
            <h2 className="text-xl font-black text-slate-950 dark:!text-white">Private Raise Settings</h2>
            <p className={subTextClass}>Company profile and ownership setup for the owner-side raise tracker.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Legal company name"><input className={fieldClass} value={state.profile.legalName || ''} onChange={e => updateProfile({ legalName: e.target.value })} placeholder="Company legal name" /></Field>
            <Field label="State of incorporation"><input className={fieldClass} value={state.profile.stateOfIncorporation || ''} onChange={e => updateProfile({ stateOfIncorporation: e.target.value })} placeholder="Wyoming" /></Field>
            <Field label="Authorized shares"><input className={fieldClass} type="number" inputMode="numeric" value={state.profile.authorizedShares || ''} onChange={e => updateProfile({ authorizedShares: toNumber(e.target.value) })} /></Field>
            <Field label="Par value"><input className={fieldClass} type="number" inputMode="decimal" step="0.0001" value={state.profile.parValue || ''} onChange={e => updateProfile({ parValue: toNumber(e.target.value) })} /></Field>
            <div className="md:col-span-2 lg:col-span-4"><Field label="Company equity notes"><textarea className={fieldClass} rows={3} value={state.profile.notes || ''} onChange={e => updateProfile({ notes: e.target.value })} placeholder="Internal notes about the equity setup." /></Field></div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:!text-white">Ownership Classes</h3>
                <p className={subTextClass}>Start with common stock. Add preferred stock only if your company actually uses it.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <Field label="Class name"><input className={fieldClass} value={shareClassDraft.name || ''} onChange={e => setShareClassDraft(p => ({ ...p, name: e.target.value }))} placeholder="Common Stock" /></Field>
              <Field label="Authorized shares"><input className={fieldClass} type="number" inputMode="numeric" value={shareClassDraft.authorizedShares || ''} onChange={e => setShareClassDraft(p => ({ ...p, authorizedShares: toNumber(e.target.value) }))} /></Field>
              <Field label="Par value"><input className={fieldClass} type="number" inputMode="decimal" step="0.0001" value={shareClassDraft.parValue || ''} onChange={e => setShareClassDraft(p => ({ ...p, parValue: toNumber(e.target.value) }))} /></Field>
              <div className="flex items-end"><button onClick={saveShareClass} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 !text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingShareClassId ? 'Update Class' : 'Add Class'}</button></div>
              <div className="md:col-span-4"><Field label="Description"><input className={fieldClass} value={shareClassDraft.description || ''} onChange={e => setShareClassDraft(p => ({ ...p, description: e.target.value }))} placeholder="Founder/common shares, preferred investor class, etc." /></Field></div>
            </div>
            <div className="space-y-2">
              {state.shareClasses.map(c => (
                <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-950 dark:!text-white">{c.name}</div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{formatShares(c.authorizedShares)} authorized • par {money(c.parValue, currencySymbol)}</div>
                    {c.description && <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">{c.description}</div>}
                  </div>
                  <div className="flex gap-1"><button onClick={() => editShareClass(c)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => deleteShareClass(c.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeSection === 'stakeholders' && (
        <section id="moniezi-equity-section-stakeholders" className={`${cardClass} p-5 space-y-5`}>
          <div>
            <h2 className="text-xl font-black text-slate-950 dark:!text-white">People & Entities</h2>
            <p className={subTextClass}>A stakeholder is a person/entity record. They become a shareholder only after you record an issued-share transaction.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Field label="Name"><input className={fieldClass} value={stakeholderDraft.name || ''} onChange={e => setStakeholderDraft(p => ({ ...p, name: e.target.value }))} placeholder="Investor or founder name" /></Field>
            <Field label="Type"><select className={fieldClass} value={stakeholderDraft.type || 'investor'} onChange={e => setStakeholderDraft(p => ({ ...p, type: e.target.value as EquityStakeholderType }))}><option value="founder">Founder</option><option value="investor">Investor</option><option value="advisor">Advisor</option><option value="employee">Employee/Contractor</option><option value="entity">Entity/LLC</option><option value="other">Other</option></select></Field>
            <Field label="Email"><input className={fieldClass} value={stakeholderDraft.email || ''} onChange={e => setStakeholderDraft(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" /></Field>
            <Field label="Address"><input className={fieldClass} value={stakeholderDraft.address || ''} onChange={e => setStakeholderDraft(p => ({ ...p, address: e.target.value }))} placeholder="Optional" /></Field>
            <div className="flex items-end"><button onClick={saveStakeholder} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 !text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingStakeholderId ? 'Update' : 'Add'}</button></div>
            <div className="md:col-span-5"><Field label="Notes"><input className={fieldClass} value={stakeholderDraft.notes || ''} onChange={e => setStakeholderDraft(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes about this stakeholder" /></Field></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {state.stakeholders.length === 0 ? <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">No stakeholders yet. Add at least one stakeholder before recording shares.</div> : state.stakeholders.map(s => (
              <div key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="font-black text-slate-950 dark:!text-white">{s.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2"><span className={statusPillClass('slate')}>{s.type}</span>{s.email && <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{s.email}</span>}</div>
                  {s.notes && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{s.notes}</p>}
                </div>
                <div className="flex gap-1"><button onClick={() => editStakeholder(s)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => deleteStakeholder(s.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeSection === 'issuance' && (
        <section id="moniezi-equity-section-issuance" className={`${cardClass} p-5 space-y-5`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950 dark:!text-white">Issued Ownership Records</h2>
              <p className={subTextClass}>Use this only after ownership/shares are actually approved and recorded. Enter who received shares, how many, and what they paid.</p>
            </div>
            <button onClick={exportLedgerCsv} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-extrabold flex items-center gap-2"><Download size={16}/> Stock Ledger CSV</button>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Selected recipient</div><div className="mt-1 font-black text-slate-950 dark:!text-white">{selectedHolder?.name || 'Not selected'}</div></div>
            <div><div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Share class</div><div className="mt-1 font-black text-slate-950 dark:!text-white">{selectedShareClass?.name || 'Not selected'}</div></div>
            <div><div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Amount paid calculation</div><div className="mt-1 font-black text-slate-950 dark:!text-white">{money(issuancePaidAmount, currencySymbol)}</div><div className="text-xs font-semibold text-slate-500 dark:text-slate-400">shares × price/share</div></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Issue date"><input className={fieldClass} type="date" value={issuanceDraft.issueDate || todayIso()} onChange={e => setIssuanceDraft(p => ({ ...p, issueDate: e.target.value }))} /></Field>
            <Field label="Who receives shares?"><select className={fieldClass} value={issuanceDraft.stakeholderId || ''} onChange={e => setIssuanceDraft(p => ({ ...p, stakeholderId: e.target.value }))}><option value="">Select stakeholder</option>{state.stakeholders.map(s => <option key={s.id} value={s.id}>{s.name} — {s.type}</option>)}</select></Field>
            <Field label="Share class"><select className={fieldClass} value={issuanceDraft.shareClassId || state.shareClasses[0]?.id || ''} onChange={e => setIssuanceDraft(p => ({ ...p, shareClassId: e.target.value }))}>{state.shareClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Status"><select className={fieldClass} value={issuanceDraft.status || 'issued'} onChange={e => setIssuanceDraft(p => ({ ...p, status: e.target.value as EquityIssuanceStatus }))}><option value="issued">Issued</option><option value="cancelled">Cancelled</option><option value="transferred">Transferred</option><option value="repurchased">Repurchased</option></select></Field>
            <Field label="Shares issued"><input className={fieldClass} type="number" inputMode="decimal" value={issuanceDraft.shares || ''} onChange={e => setIssuanceDraft(p => ({ ...p, shares: toNumber(e.target.value) }))} placeholder="200000" /></Field>
            <Field label="Price per share"><input className={fieldClass} type="number" inputMode="decimal" step="0.0001" value={issuanceDraft.pricePerShare || ''} onChange={e => setIssuanceDraft(p => ({ ...p, pricePerShare: toNumber(e.target.value) }))} placeholder="0.25" /></Field>
            <Field label="Amount paid"><input className={fieldClass} readOnly value={money(issuancePaidAmount, currencySymbol)} /></Field>
            <Field label="Consideration"><select className={fieldClass} value={issuanceDraft.considerationType || 'cash'} onChange={e => setIssuanceDraft(p => ({ ...p, considerationType: e.target.value as EquityConsiderationType }))}><option value="cash">Cash</option><option value="services">Services</option><option value="ip">IP / property</option><option value="note_conversion">Note conversion</option><option value="safe_conversion">SAFE conversion</option><option value="other">Other</option></select></Field>
            <Field label="Board approval date"><input className={fieldClass} type="date" value={issuanceDraft.boardApprovalDate || ''} onChange={e => setIssuanceDraft(p => ({ ...p, boardApprovalDate: e.target.value }))} /></Field>
            <Field label="Certificate number"><input className={fieldClass} value={issuanceDraft.certificateNumber || ''} onChange={e => setIssuanceDraft(p => ({ ...p, certificateNumber: e.target.value }))} placeholder="CS-001" /></Field>
            <div className="md:col-span-2"><Field label="Consideration description"><input className={fieldClass} value={issuanceDraft.considerationDescription || ''} onChange={e => setIssuanceDraft(p => ({ ...p, considerationDescription: e.target.value }))} placeholder="Cash investment: $50,000 at $0.25/share" /></Field></div>
            <div className="md:col-span-2"><Field label="Vesting terms"><input className={fieldClass} value={issuanceDraft.vestingTerms || ''} onChange={e => setIssuanceDraft(p => ({ ...p, vestingTerms: e.target.value }))} placeholder="No vesting, or four-year vesting placeholder" /></Field></div>
            <div className="md:col-span-2"><Field label="Restriction legend"><input className={fieldClass} value={issuanceDraft.restrictionLegend || ''} onChange={e => setIssuanceDraft(p => ({ ...p, restrictionLegend: e.target.value }))} placeholder="Restricted securities legend placeholder" /></Field></div>
            <div className="md:col-span-3"><Field label="Notes"><input className={fieldClass} value={issuanceDraft.notes || ''} onChange={e => setIssuanceDraft(p => ({ ...p, notes: e.target.value }))} placeholder="Internal record note" /></Field></div>
            <div className="flex items-end"><button onClick={saveIssuance} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 !text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingIssuanceId ? 'Update Issuance' : 'Record Issuance'}</button></div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900"><tr>{['Date','Holder','Class','Shares','Price','Amount Paid','Certificate','Status',''].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {state.issuances.length === 0 ? <tr><td colSpan={9} className="px-3 py-6 text-center font-semibold text-slate-500">No issuances recorded yet.</td></tr> : state.issuances.map(i => {
                  const holder = state.stakeholders.find(s => s.id === i.stakeholderId);
                  const cls = state.shareClasses.find(c => c.id === i.shareClassId);
                  return <tr key={i.id}><td className="px-3 py-3 font-semibold">{i.issueDate}</td><td className="px-3 py-3 font-bold text-slate-950 dark:!text-white">{holder?.name || 'Unassigned'}</td><td className="px-3 py-3">{cls?.name || 'Unassigned'}</td><td className="px-3 py-3">{formatShares(i.shares)}</td><td className="px-3 py-3">{money(i.pricePerShare, currencySymbol)}</td><td className="px-3 py-3 font-bold">{money(i.shares * i.pricePerShare, currencySymbol)}</td><td className="px-3 py-3">{i.certificateNumber || '—'}</td><td className="px-3 py-3"><span className={statusPillClass(issuanceTone(i.status))}>{i.status}</span></td><td className="px-3 py-3 text-right"><button onClick={() => editIssuance(i)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => deleteIssuance(i.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection === 'captable' && (
        <section id="moniezi-equity-section-captable" className={`${cardClass} p-5 space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div><h2 className="text-xl font-black text-slate-950 dark:!text-white">Ownership Summary</h2><p className={subTextClass}>Calculated from active issued share records. SAFE records and reservations are not counted until converted into shares.</p></div>
            <button onClick={exportCapTableCsv} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-extrabold flex items-center gap-2"><Download size={16}/> Ownership CSV</button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 dark:bg-slate-900"><tr>{['Stakeholder','Type','Class','Shares','Ownership','Cash Paid'].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{capRows.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center font-semibold text-slate-500">No outstanding issued shares yet.</td></tr> : capRows.map(row => <tr key={`${row.stakeholderId}-${row.shareClassId}`}><td className="px-3 py-3 font-black text-slate-950 dark:!text-white">{row.stakeholderName}</td><td className="px-3 py-3 capitalize">{row.stakeholderType}</td><td className="px-3 py-3">{row.shareClassName}</td><td className="px-3 py-3">{formatShares(row.shares)}</td><td className="px-3 py-3 font-bold">{percent(row.ownershipPct)}</td><td className="px-3 py-3">{money(row.cashPaid, currencySymbol)}</td></tr>)}</tbody></table></div>
        </section>
      )}

      {activeSection === 'packages' && (
        <section id="moniezi-equity-section-packages" className={`${cardClass} p-5 space-y-6`}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950 dark:!text-white">Investor Packages</h2>
              <p className={subTextClass}>Draft and track the package you send to friends, family, or early private investors. MONIEZI Raise can handle the public-facing signup later.</p>
            </div>
            <button onClick={() => setPackageDraft(emptyInvestorPackage(companyName))} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-extrabold flex items-center gap-2"><Plus size={16}/> New Package</button>
          </div>

          <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 p-4 flex gap-3">
            <Link2 size={20} className="text-blue-700 dark:text-blue-300 mt-0.5 flex-shrink-0" />
            <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              <b>Current scope:</b> this is a private-link drafting and preview workflow. The generated link is a placeholder for the future Cloudflare investor portal. Investors do not see your private cap table, shareholders, certificates, or internal notes.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-950 dark:!text-white">Package details</h3>
                  <p className={subTextClass}>{editingPackageId ? 'Editing saved package.' : 'Create a new invitation/reservation package.'}</p>
                </div>
                {editingPackageId && <span className={statusPillClass(packageStatusTone(packageDraft.packageStatus as EquityInvestorPackageStatus | undefined))}>{packageStatusLabel(packageDraft.packageStatus as EquityInvestorPackageStatus | undefined)}</span>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Package date"><input className={fieldClass} type="date" value={packageDraft.date || todayIso()} onChange={e => setPackageDraft(p => ({ ...p, date: e.target.value }))} /></Field>
                <Field label="Package status"><select className={fieldClass} value={packageDraft.packageStatus || 'draft'} onChange={e => setPackageDraft(p => ({ ...p, packageStatus: e.target.value as EquityInvestorPackageStatus }))}><option value="draft">Draft</option><option value="ready_to_send">Ready to send</option><option value="sent">Sent</option><option value="opened">Opened</option><option value="signed">Signed</option><option value="expired">Expired</option><option value="voided">Voided</option></select></Field>
                <Field label="Investor name"><input className={fieldClass} value={packageDraft.investorName || ''} onChange={e => setPackageDraft(p => ({ ...p, investorName: e.target.value, packagePreparedFor: e.target.value, signatureName: e.target.value }))} placeholder="John Smith" /></Field>
                <Field label="Email"><input className={fieldClass} value={packageDraft.email || ''} onChange={e => setPackageDraft(p => ({ ...p, email: e.target.value }))} placeholder="investor@example.com" /></Field>
                <Field label="Phone"><input className={fieldClass} value={packageDraft.phone || ''} onChange={e => setPackageDraft(p => ({ ...p, phone: e.target.value }))} placeholder="Optional" /></Field>
                <Field label="Entity / LLC"><input className={fieldClass} value={packageDraft.entityName || ''} onChange={e => setPackageDraft(p => ({ ...p, entityName: e.target.value }))} placeholder="Optional investing entity" /></Field>
                <Field label="Desired investment amount"><input className={fieldClass} type="number" inputMode="decimal" value={packageDraft.desiredAmount || ''} onChange={e => setPackageDraft(p => ({ ...p, desiredAmount: toNumber(e.target.value), packageEstimatedShares: packageEstimatedShares({ ...p, desiredAmount: toNumber(e.target.value) }) }))} placeholder="25000" /></Field>
                <Field label="Instrument"><select className={fieldClass} value={packageDraft.instrumentType || 'common_stock'} onChange={e => setPackageDraft(p => ({ ...p, instrumentType: e.target.value as EquityReservationInstrument }))}><option value="common_stock">Common stock</option><option value="safe">SAFE</option><option value="convertible_note">Convertible note</option><option value="undecided">Undecided</option></select></Field>
                <Field label="Minimum investment"><input className={fieldClass} type="number" inputMode="decimal" value={packageDraft.packageMinimumInvestment ?? ''} onChange={e => setPackageDraft(p => ({ ...p, packageMinimumInvestment: e.target.value === '' ? undefined : toNumber(e.target.value) }))} placeholder="5000" /></Field>
                <Field label="Price/share if stock"><input className={fieldClass} type="number" inputMode="decimal" step="0.0001" value={packageDraft.packagePricePerShare ?? ''} onChange={e => setPackageDraft(p => ({ ...p, packagePricePerShare: e.target.value === '' ? undefined : toNumber(e.target.value), packageEstimatedShares: packageEstimatedShares({ ...p, packagePricePerShare: e.target.value === '' ? undefined : toNumber(e.target.value) }) }))} placeholder="0.25" /></Field>
                <Field label="Expiration date"><input className={fieldClass} type="date" value={packageDraft.packageExpirationDate || ''} onChange={e => setPackageDraft(p => ({ ...p, packageExpirationDate: e.target.value }))} /></Field>
                <Field label="Typed signature preview"><input className={fieldClass} value={packageDraft.signatureName || ''} onChange={e => setPackageDraft(p => ({ ...p, signatureName: e.target.value }))} placeholder="Investor typed name" /></Field>
                <div className="md:col-span-2"><Field label="Package title"><input className={fieldClass} value={packageDraft.packageTitle || ''} onChange={e => setPackageDraft(p => ({ ...p, packageTitle: e.target.value }))} placeholder="Private Investment Reservation" /></Field></div>
                <div className="md:col-span-2"><Field label="Private message"><textarea className={fieldClass} rows={3} value={packageDraft.packagePrivateMessage || ''} onChange={e => setPackageDraft(p => ({ ...p, packagePrivateMessage: e.target.value }))} placeholder="Personal note shown at the top of the signing page." /></Field></div>
                <div className="md:col-span-2"><Field label="Offering summary"><textarea className={fieldClass} rows={4} value={packageDraft.packageOfferingSummary || ''} onChange={e => setPackageDraft(p => ({ ...p, packageOfferingSummary: e.target.value }))} /></Field></div>
                <div className="md:col-span-2"><Field label="Major terms"><textarea className={fieldClass} rows={5} value={packageDraft.packageMajorTerms || ''} onChange={e => setPackageDraft(p => ({ ...p, packageMajorTerms: e.target.value }))} /></Field></div>
                <div className="md:col-span-2"><Field label="Risk / acknowledgment text"><textarea className={fieldClass} rows={4} value={packageDraft.packageRiskText || ''} onChange={e => setPackageDraft(p => ({ ...p, packageRiskText: e.target.value }))} /></Field></div>
                <div className="md:col-span-2"><Field label="Internal notes"><textarea className={fieldClass} rows={2} value={packageDraft.notes || ''} onChange={e => setPackageDraft(p => ({ ...p, notes: e.target.value }))} placeholder="Private notes; not shown to investor unless copied into message/terms." /></Field></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button onClick={saveInvestorPackage} className="rounded-xl bg-blue-600 hover:bg-blue-700 !text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><FileText size={16}/>{editingPackageId ? 'Update Package' : 'Save Draft Package'}</button>
                <button onClick={() => previewInvestorPackage()} className="rounded-xl border border-slate-300 dark:border-slate-700 font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Eye size={16}/> Preview Page</button>
                <button onClick={() => copyInvitation(draftPreviewRecord())} className="rounded-xl border border-slate-300 dark:border-slate-700 font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Copy size={16}/> Copy Invite Text</button>
                <button onClick={() => downloadPackageHtml(draftPreviewRecord())} className="rounded-xl border border-slate-300 dark:border-slate-700 font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Download size={16}/> Download HTML Preview</button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <div className={labelClass}>Placeholder link</div>
                <div className="mt-1 break-all text-sm font-bold text-slate-700 dark:text-slate-200">{packageDraft.packageLinkPlaceholder || buildPackageLink(packageDraft.packageToken || 'preview-token')}</div>
                <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">This link becomes real only after the future Cloudflare portal is connected. For now, use preview/download to review the investor-facing page.</p>
              </div>
              <SigningPackagePreview record={previewPackage || draftPreviewRecord()} companyName={companyName} currencySymbol={currencySymbol} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-950 dark:!text-white">Saved Investor Packages</h3>
                <p className={subTextClass}>These records are also part of the Reservations tracker, but this view focuses on invitation/link/signing workflow status.</p>
              </div>
            </div>
            {investorPackages.length === 0 ? (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">No investor packages yet.</div>
            ) : investorPackages.map(r => (
              <div key={r.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-950 dark:!text-white">{r.investorName} • {money(r.desiredAmount, currencySymbol)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2"><span className={statusPillClass(packageStatusTone(r.packageStatus))}>{packageStatusLabel(r.packageStatus)}</span><span className={statusPillClass('slate')}>{formatInstrument(r.instrumentType)}</span>{r.email && <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{r.email}</span>}</div>
                    <div className="mt-2 break-all text-xs font-semibold text-slate-500 dark:text-slate-400">{packageLinkFor(r)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => editInvestorPackage(r)} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black flex items-center gap-1"><Edit3 size={14}/> Edit</button>
                    <button onClick={() => setPreviewPackage(r)} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black flex items-center gap-1"><Eye size={14}/> Preview</button>
                    <button onClick={() => copyInvitation(r)} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black flex items-center gap-1"><Mail size={14}/> Invite</button>
                    <button onClick={() => downloadPackageHtml(r)} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black flex items-center gap-1"><Download size={14}/> HTML</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => updatePackageStatus(r.id, 'sent')} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 text-xs font-black flex items-center gap-1"><Send size={14}/> Mark sent</button>
                  <button onClick={() => updatePackageStatus(r.id, 'opened')} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 text-xs font-black">Mark opened</button>
                  <button onClick={() => updatePackageStatus(r.id, 'signed')} className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 text-xs font-black">Mark signed</button>
                  <button onClick={() => updatePackageStatus(r.id, 'voided')} className="px-3 py-2 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 text-xs font-black">Void</button>
                </div>
                {(r.packageSentAt || r.packageOpenedAt || r.packageSignedAt) && <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{r.packageSentAt ? `Sent ${r.packageSentAt}` : ''}{r.packageOpenedAt ? ` • Opened ${r.packageOpenedAt}` : ''}{r.packageSignedAt ? ` • Signed ${r.packageSignedAt}` : ''}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {activeSection === 'reservations' && (
        <section id="moniezi-equity-section-reservations" className={`${cardClass} p-5 space-y-5`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div><h2 className="text-xl font-black text-slate-950 dark:!text-white">Investor Interest & Pledges</h2><p className={subTextClass}>Start here: track who may invest, how much they may pledge, status, notes, and follow-up.</p></div>
            <button onClick={exportReservationsCsv} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-extrabold flex items-center gap-2"><Download size={16}/> Interest CSV</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Reservation date"><input className={fieldClass} type="date" value={reservationDraft.date || todayIso()} onChange={e => setReservationDraft(p => ({ ...p, date: e.target.value }))} /></Field>
            <Field label="Investor name"><input className={fieldClass} value={reservationDraft.investorName || ''} onChange={e => setReservationDraft(p => ({ ...p, investorName: e.target.value }))} placeholder="Investor name" /></Field>
            <Field label="Email"><input className={fieldClass} value={reservationDraft.email || ''} onChange={e => setReservationDraft(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" /></Field>
            <Field label="Phone"><input className={fieldClass} value={reservationDraft.phone || ''} onChange={e => setReservationDraft(p => ({ ...p, phone: e.target.value }))} placeholder="Optional" /></Field>
            <Field label="Entity/LLC"><input className={fieldClass} value={reservationDraft.entityName || ''} onChange={e => setReservationDraft(p => ({ ...p, entityName: e.target.value }))} placeholder="Optional entity name" /></Field>
            <Field label="Proposed pledge amount"><input className={fieldClass} type="number" inputMode="decimal" value={reservationDraft.desiredAmount || ''} onChange={e => setReservationDraft(p => ({ ...p, desiredAmount: toNumber(e.target.value) }))} placeholder="25000" /></Field>
            <Field label="Instrument"><select className={fieldClass} value={reservationDraft.instrumentType || 'undecided'} onChange={e => setReservationDraft(p => ({ ...p, instrumentType: e.target.value as EquityReservationInstrument }))}><option value="undecided">Undecided</option><option value="common_stock">Common stock</option><option value="safe">SAFE</option><option value="convertible_note">Convertible note</option></select></Field>
            <Field label="Status"><select className={fieldClass} value={reservationDraft.status || 'interested'} onChange={e => setReservationDraft(p => ({ ...p, status: e.target.value as EquityReservationStatus }))}><option value="interested">Interested</option><option value="reserved">Reserved</option><option value="confirmed">Confirmed</option><option value="declined">Declined</option><option value="converted">Converted</option></select></Field>
            <Field label="Follow-up date"><input className={fieldClass} type="date" value={reservationDraft.followUpDate || ''} onChange={e => setReservationDraft(p => ({ ...p, followUpDate: e.target.value }))} /></Field>
            <Field label="Typed signature/name"><input className={fieldClass} value={reservationDraft.signatureName || ''} onChange={e => setReservationDraft(p => ({ ...p, signatureName: e.target.value }))} placeholder="Optional" /></Field>
            <div className="md:col-span-2"><Field label="Notes"><input className={fieldClass} value={reservationDraft.notes || ''} onChange={e => setReservationDraft(p => ({ ...p, notes: e.target.value }))} placeholder="Relationship, pledge discussion, package status, or next follow-up." /></Field></div>
            <div className="md:col-span-4"><button onClick={saveReservation} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 !text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingReservationId ? 'Update Interest' : 'Record Interest'}</button></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {state.reservations.length === 0 ? <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">No reservations yet.</div> : state.reservations.map(r => (
              <div key={r.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="font-black text-slate-950 dark:!text-white">{r.investorName} • {money(r.desiredAmount, currencySymbol)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2"><span className={statusPillClass(reservationTone(r.status))}>{r.status}</span><span className={statusPillClass('slate')}>{formatInstrument(r.instrumentType)}</span>{r.email && <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{r.email}</span>}</div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-2">{r.date}{r.followUpDate ? ` • follow up ${r.followUpDate}` : ''}{r.entityName ? ` • ${r.entityName}` : ''}</div>
                  {r.notes && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{r.notes}</p>}
                </div>
                <div className="flex gap-1"><button onClick={() => editReservation(r)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => deleteReservation(r.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeSection === 'safes' && (
        <section id="moniezi-equity-section-safes" className={`${cardClass} p-5 space-y-5`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950 dark:!text-white">SAFEs / Agreements</h2><p className={subTextClass}>SAFEs are investments that do not become issued shares until conversion. Keep them separate from the stock ledger.</p></div><button onClick={exportSafesCsv} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-extrabold flex items-center gap-2"><Download size={16}/> SAFE CSV</button></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Date"><input className={fieldClass} type="date" value={safeDraft.date || todayIso()} onChange={e => setSafeDraft(p => ({ ...p, date: e.target.value }))} /></Field>
            <Field label="Linked stakeholder"><select className={fieldClass} value={safeDraft.investorId || ''} onChange={e => { const investor = state.stakeholders.find(s => s.id === e.target.value); setSafeDraft(p => ({ ...p, investorId: e.target.value, investorName: investor?.name || p.investorName || '' })); }}><option value="">No linked stakeholder</option>{state.stakeholders.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Investor name"><input className={fieldClass} value={safeDraft.investorName || ''} onChange={e => setSafeDraft(p => ({ ...p, investorName: e.target.value }))} placeholder="Investor name" /></Field>
            <Field label="Amount"><input className={fieldClass} type="number" inputMode="decimal" value={safeDraft.amount || ''} onChange={e => setSafeDraft(p => ({ ...p, amount: toNumber(e.target.value) }))} placeholder="25000" /></Field>
            <Field label="Valuation cap"><input className={fieldClass} type="number" inputMode="decimal" value={safeDraft.valuationCap ?? ''} onChange={e => setSafeDraft(p => ({ ...p, valuationCap: e.target.value === '' ? undefined : toNumber(e.target.value) }))} placeholder="5000000" /></Field>
            <Field label="Discount %"><input className={fieldClass} type="number" inputMode="decimal" value={safeDraft.discountRate ?? ''} onChange={e => setSafeDraft(p => ({ ...p, discountRate: e.target.value === '' ? undefined : toNumber(e.target.value) }))} placeholder="20" /></Field>
            <Field label="Type"><select className={fieldClass} value={safeDraft.type || 'unknown'} onChange={e => setSafeDraft(p => ({ ...p, type: e.target.value as EquitySafeInstrument['type'] }))}><option value="unknown">Type unknown</option><option value="post-money">Post-money SAFE</option><option value="pre-money">Pre-money SAFE</option></select></Field>
            <Field label="Status"><select className={fieldClass} value={safeDraft.status || 'active'} onChange={e => setSafeDraft(p => ({ ...p, status: e.target.value as EquitySafeStatus }))}><option value="active">Active</option><option value="converted">Converted</option><option value="cancelled">Cancelled</option></select></Field>
            <label className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-3 flex items-center gap-2 font-bold"><input type="checkbox" checked={!!safeDraft.mfn} onChange={e => setSafeDraft(p => ({ ...p, mfn: e.target.checked }))}/> MFN</label>
            <div className="md:col-span-2"><Field label="Notes"><input className={fieldClass} value={safeDraft.notes || ''} onChange={e => setSafeDraft(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes" /></Field></div>
            <div className="flex items-end"><button onClick={saveSafe} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 !text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingSafeId ? 'Update SAFE' : 'Add SAFE'}</button></div>
          </div>
          <div className="space-y-2">{state.safes.length === 0 ? <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">No SAFE records yet.</div> : state.safes.map(s => <div key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3"><div><div className="font-black text-slate-950 dark:!text-white">{s.investorName} • {money(s.amount, currencySymbol)}</div><div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{s.date} • {s.type || 'unknown'} • {s.status}{s.valuationCap ? ` • Cap ${money(s.valuationCap, currencySymbol)}` : ''}</div>{s.notes && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{s.notes}</p>}</div><div className="flex gap-1"><button onClick={() => { setEditingSafeId(s.id); setSafeDraft(s); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => deleteSafe(s.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></div></div>)}</div>
        </section>
      )}
    </div>
  );
}
