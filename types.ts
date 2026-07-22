

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string;
  name: string;
  category: string;
  amount: number;
  type: TransactionType;
  notes?: string;
  receiptId?: string; // linked receipt id (IndexedDB)
  reviewedAt?: string;
}


export type InvoiceStatus = 'unpaid' | 'paid' | 'void';

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

// --- Clients / Leads (Lightweight CRM) ---
export type ClientStatus = 'lead' | 'client' | 'inactive';

export interface Client {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  status: ClientStatus;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

export interface Invoice {
  id: string;
  number?: string;

  // Link to Client (preferred)
  clientId?: string;

  // Display fields (kept for backward compatibility + PDF rendering)
  client: string;
  clientCompany?: string;
  clientAddress?: string;
  clientEmail?: string;

  amount: number; // Total Amount Due (calculated)
  category: string;
  description: string; // Used as summary or fallback
  date: string;
  due: string;
  notes?: string;
  terms?: string; // Payment terms
  status: InvoiceStatus;
  payMethod?: string;
  linkedTransactionId?: string;
  recurrence?: {
    active: boolean;
    frequency: RecurrenceFrequency;
    nextDate: string;
  };

  // New Fields
  items?: InvoiceItem[];
  subtotal?: number;
  discount?: number; // Fixed amount
  taxRate?: number; // Percent
  shipping?: number; // Fixed amount
  poNumber?: string;
}

// Estimates (Quotes/Proposals)
export type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'void';

export type EstimateItem = InvoiceItem;

export interface Estimate {
  id: string;
  number?: string;

  // Link to Client (preferred)
  clientId?: string;

  // Client display fields
  client: string;
  clientCompany?: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;

  // Proposal details
  projectTitle?: string;        // "Website Redesign" - main title for the proposal
  scopeOfWork?: string;         // Detailed description of what's included
  timeline?: string;            // "2-3 weeks", "Q1 2025", etc.
  exclusions?: string;          // What's NOT included in this estimate

  // Financial
  amount: number;               // Total (calculated)
  category: string;
  description: string;          // Brief description / summary
  
  // Dates
  date: string;                 // Created/issued date
  validUntil: string;           // Expiry date
  
  // Terms & Notes
  notes?: string;               // Additional notes to client
  terms?: string;               // Acceptance terms / conditions
  acceptanceTerms?: string;     // How to accept (e.g., "Sign and return", "Reply to confirm")
  
  status: EstimateStatus;

  // Follow-up tracking
  sentAt?: string;
  followUpDate?: string;
  followUpCount?: number;
  lastFollowUp?: string;

  // Line items
  items?: EstimateItem[];
  subtotal?: number;
  discount?: number;
  taxRate?: number;
  shipping?: number;
  poNumber?: string;            // Reference/PO number from client
}

export type FilingStatus = 'single' | 'joint' | 'head';

export type TaxEstimationMethod = 'preset' | 'lastYear' | 'custom';

export interface UserSettings {
  businessName: string;
  ownerName: string;
  // New Business Details
  businessAddress?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessWebsite?: string;
  businessTaxId?: string;

  // Branding
  businessLogo?: string; // Base64 Data URL
  showLogoOnInvoice?: boolean;
  logoAlignment?: 'left' | 'center';
  brandColor?: string; // Hex code

  payPrefs: string[];
  taxRate: number; // Estimated Federal Income Tax Rate
  stateTaxRate: number; // Estimated State Tax Rate
  taxEstimationMethod: TaxEstimationMethod;
  filingStatus: FilingStatus;
  currencySymbol: string;


  // --- Tax Prep / Record Organization ---
  requireReceiptOverThreshold?: boolean;
  receiptThreshold?: number; // legacy setting kept for backward compatibility
  receiptReminderEnabled?: boolean;
  mileageRateCents?: number; // cents per mile (can be decimal, e.g. 72.5)

  // Invoice Defaults
  defaultInvoiceTerms?: string;
  defaultInvoiceNotes?: string;
}

export interface CustomCategories {
  income: string[];
  expense: string[];
  billing: string[];
}

export interface TaxPayment {
  id: string;
  date: string;
  amount: number;
  type: 'Estimated' | 'Annual' | 'Other';
  note?: string;
}

export interface MileageTrip {
  id: string;
  date: string; // YYYY-MM-DD
  miles: number;
  purpose: string;
  client?: string;
  notes?: string;
}

export interface Receipt {
  id: string;
  date: string;
  imageKey: string; // Key in IndexedDB
  mimeType?: string;
  note?: string;
}

// --- Company Equity Register (internal founder/business module) ---
export type EquityStakeholderType = 'founder' | 'investor' | 'advisor' | 'employee' | 'entity' | 'other';

export interface EquityCompanyProfile {
  legalName: string;
  stateOfIncorporation?: string;
  authorizedShares: number;
  parValue: number;
  fiscalYearEnd?: string;
  notes?: string;
}

export interface EquityShareClass {
  id: string;
  name: string;
  authorizedShares: number;
  parValue: number;
  description?: string;
}

export interface EquityStakeholder {
  id: string;
  name: string;
  email?: string;
  address?: string;
  type: EquityStakeholderType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type EquityConsiderationType = 'cash' | 'services' | 'ip' | 'note_conversion' | 'safe_conversion' | 'other';
export type EquityIssuanceStatus = 'issued' | 'cancelled' | 'transferred' | 'repurchased';

export interface EquityIssuance {
  id: string;
  issueDate: string;
  stakeholderId: string;
  shareClassId: string;
  shares: number;
  pricePerShare: number;
  considerationType: EquityConsiderationType;
  considerationDescription?: string;
  boardApprovalDate?: string;
  certificateNumber?: string;
  vestingTerms?: string;
  restrictionLegend?: string;
  status: EquityIssuanceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type EquitySafeType = 'post-money' | 'pre-money' | 'unknown';
export type EquitySafeStatus = 'active' | 'converted' | 'cancelled';

export interface EquitySafeInstrument {
  id: string;
  investorId?: string;
  investorName: string;
  date: string;
  amount: number;
  valuationCap?: number;
  discountRate?: number;
  mfn?: boolean;
  type?: EquitySafeType;
  status: EquitySafeStatus;
  notes?: string;
}


export type EquityReservationStatus = 'interested' | 'reserved' | 'confirmed' | 'declined' | 'converted';
export type EquityReservationInstrument = 'common_stock' | 'safe' | 'convertible_note' | 'undecided';
export type EquityInvestorPackageStatus = 'draft' | 'ready_to_send' | 'sent' | 'opened' | 'signed' | 'expired' | 'voided';

export interface EquityInvestmentReservation {
  id: string;
  date: string;
  investorName: string;
  email?: string;
  phone?: string;
  entityName?: string;
  desiredAmount: number;
  instrumentType: EquityReservationInstrument;
  status: EquityReservationStatus;
  followUpDate?: string;
  signatureName?: string;
  source?: 'manual' | 'investor_form';
  packageStatus?: EquityInvestorPackageStatus;
  packageToken?: string;
  packageTitle?: string;
  packagePreparedFor?: string;
  packageExpirationDate?: string;
  packagePrivateMessage?: string;
  packageOfferingSummary?: string;
  packageMajorTerms?: string;
  packageRiskText?: string;
  packageMinimumInvestment?: number;
  packagePricePerShare?: number;
  packageEstimatedShares?: number;
  packageLinkPlaceholder?: string;
  packageLastPreviewedAt?: string;
  packageSentAt?: string;
  packageOpenedAt?: string;
  packageSignedAt?: string;
  consentElectronicRecords?: boolean;
  acknowledgmentIndicationOnly?: boolean;
  acknowledgmentRisk?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EquityCapTableRow {
  stakeholderId: string;
  stakeholderName: string;
  stakeholderType: EquityStakeholderType;
  shareClassId: string;
  shareClassName: string;
  shares: number;
  ownershipPct: number;
  cashPaid: number;
}

export interface CompanyEquityState {
  profile: EquityCompanyProfile;
  shareClasses: EquityShareClass[];
  stakeholders: EquityStakeholder[];
  issuances: EquityIssuance[];
  safes: EquitySafeInstrument[];
  reservations: EquityInvestmentReservation[];
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type FilterPeriod = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export enum Page {
  Dashboard = 'dashboard',
  /** Back-compat: some older UI elements refer to the Ledger page by name. */
  Ledger = 'ledger',
  AllTransactions = 'all_transactions',
  Income = 'income',
  Expenses = 'expenses',
  /** Back-compat: singular invoice page name used in older builds. */
  Invoice = 'invoice',
  Invoices = 'invoices',
  Clients = 'clients',
  Mileage = 'mileage',
  Reports = 'reports',
  CompanyEquity = 'company_equity',
  Settings = 'settings',
  InvoiceDoc = 'invoice_doc'
}
