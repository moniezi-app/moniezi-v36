import type {
  CompanyEquityState,
  EquityCapTableRow,
  EquityInvestmentReservation,
  EquityIssuance,
  EquitySafeInstrument,
  EquityShareClass,
  EquityStakeholder,
} from '../../../types';

export const todayIso = () => new Date().toISOString().split('T')[0];

const safeNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const isoForMonthDay = (month: number, day: number) => {
  const year = new Date().getFullYear();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const defaultShareClass = (): EquityShareClass => ({
  id: 'eq_cls_common',
  name: 'Common Stock',
  authorizedShares: 10000000,
  parValue: 0.0001,
  description: 'Default common share class for founder, employee, advisor, and investor issuances.',
});

export const createDefaultCompanyEquityState = (businessName = ''): CompanyEquityState => ({
  profile: {
    legalName: businessName || '',
    stateOfIncorporation: '',
    authorizedShares: 10000000,
    parValue: 0.0001,
    fiscalYearEnd: '12-31',
    notes: '',
  },
  shareClasses: [defaultShareClass()],
  stakeholders: [],
  issuances: [],
  safes: [],
  reservations: [],
});

export const normalizeCompanyEquityState = (raw: unknown, businessName = ''): CompanyEquityState => {
  const base = createDefaultCompanyEquityState(businessName);
  const obj = (raw && typeof raw === 'object') ? (raw as Partial<CompanyEquityState>) : {};
  const shareClasses = Array.isArray(obj.shareClasses) && obj.shareClasses.length
    ? obj.shareClasses.map((c, index) => ({
        id: String(c.id || `eq_cls_${index + 1}`),
        name: String(c.name || (index === 0 ? 'Common Stock' : `Share Class ${index + 1}`)),
        authorizedShares: safeNumber(c.authorizedShares, index === 0 ? base.profile.authorizedShares : 0),
        parValue: safeNumber(c.parValue, base.profile.parValue),
        description: c.description || '',
      }))
    : base.shareClasses;

  return {
    profile: {
      ...base.profile,
      ...(obj.profile || {}),
      legalName: String(obj.profile?.legalName || businessName || base.profile.legalName || ''),
      authorizedShares: safeNumber(obj.profile?.authorizedShares, base.profile.authorizedShares),
      parValue: safeNumber(obj.profile?.parValue, base.profile.parValue),
    },
    shareClasses,
    stakeholders: Array.isArray(obj.stakeholders) ? obj.stakeholders.map((s, index) => ({
      id: String(s.id || `eq_holder_${index + 1}`),
      name: String(s.name || 'Unnamed stakeholder'),
      email: s.email || '',
      address: s.address || '',
      type: s.type || 'founder',
      notes: s.notes || '',
      createdAt: s.createdAt || new Date().toISOString(),
      updatedAt: s.updatedAt || s.createdAt || new Date().toISOString(),
    })) : [],
    issuances: Array.isArray(obj.issuances) ? obj.issuances.map((i, index) => ({
      id: String(i.id || `eq_issue_${index + 1}`),
      issueDate: i.issueDate || todayIso(),
      stakeholderId: i.stakeholderId || '',
      shareClassId: i.shareClassId || shareClasses[0]?.id || 'eq_cls_common',
      shares: safeNumber(i.shares, 0),
      pricePerShare: safeNumber(i.pricePerShare, 0),
      considerationType: i.considerationType || 'cash',
      considerationDescription: i.considerationDescription || '',
      boardApprovalDate: i.boardApprovalDate || '',
      certificateNumber: i.certificateNumber || '',
      vestingTerms: i.vestingTerms || '',
      restrictionLegend: i.restrictionLegend || '',
      status: i.status || 'issued',
      notes: i.notes || '',
      createdAt: i.createdAt || new Date().toISOString(),
      updatedAt: i.updatedAt || i.createdAt || new Date().toISOString(),
    })) : [],
    safes: Array.isArray(obj.safes) ? obj.safes.map((s, index) => ({
      id: String(s.id || `eq_safe_${index + 1}`),
      investorId: s.investorId || '',
      investorName: s.investorName || '',
      date: s.date || todayIso(),
      amount: safeNumber(s.amount, 0),
      valuationCap: s.valuationCap === undefined || s.valuationCap === null ? undefined : safeNumber(s.valuationCap, 0),
      discountRate: s.discountRate === undefined || s.discountRate === null ? undefined : safeNumber(s.discountRate, 0),
      mfn: !!s.mfn,
      type: s.type || 'unknown',
      status: s.status || 'active',
      notes: s.notes || '',
    })) : [],
    reservations: Array.isArray(obj.reservations) ? obj.reservations.map((r, index) => ({
      id: String(r.id || `eq_reservation_${index + 1}`),
      date: r.date || todayIso(),
      investorName: String(r.investorName || 'Unnamed investor'),
      email: r.email || '',
      phone: r.phone || '',
      entityName: r.entityName || '',
      desiredAmount: safeNumber(r.desiredAmount, 0),
      instrumentType: r.instrumentType || 'undecided',
      status: r.status || 'interested',
      followUpDate: r.followUpDate || '',
      signatureName: r.signatureName || '',
      source: r.source || 'manual',
      packageStatus: r.packageStatus || undefined,
      packageToken: r.packageToken || '',
      packageTitle: r.packageTitle || '',
      packagePreparedFor: r.packagePreparedFor || '',
      packageExpirationDate: r.packageExpirationDate || '',
      packagePrivateMessage: r.packagePrivateMessage || '',
      packageOfferingSummary: r.packageOfferingSummary || '',
      packageMajorTerms: r.packageMajorTerms || '',
      packageRiskText: r.packageRiskText || '',
      packageMinimumInvestment: r.packageMinimumInvestment === undefined || r.packageMinimumInvestment === null ? undefined : safeNumber(r.packageMinimumInvestment, 0),
      packagePricePerShare: r.packagePricePerShare === undefined || r.packagePricePerShare === null ? undefined : safeNumber(r.packagePricePerShare, 0),
      packageEstimatedShares: r.packageEstimatedShares === undefined || r.packageEstimatedShares === null ? undefined : safeNumber(r.packageEstimatedShares, 0),
      packageLinkPlaceholder: r.packageLinkPlaceholder || '',
      packageLastPreviewedAt: r.packageLastPreviewedAt || '',
      packageSentAt: r.packageSentAt || '',
      packageOpenedAt: r.packageOpenedAt || '',
      packageSignedAt: r.packageSignedAt || '',
      consentElectronicRecords: !!r.consentElectronicRecords,
      acknowledgmentIndicationOnly: !!r.acknowledgmentIndicationOnly,
      acknowledgmentRisk: !!r.acknowledgmentRisk,
      notes: r.notes || '',
      createdAt: r.createdAt || new Date().toISOString(),
      updatedAt: r.updatedAt || r.createdAt || new Date().toISOString(),
    })) : [],
  };
};

export const getOutstandingIssuances = (issuances: EquityIssuance[]) =>
  issuances.filter(i => i.status === 'issued' && safeNumber(i.shares) > 0);

export const calculateEquityTotals = (state: CompanyEquityState) => {
  const outstandingIssuances = getOutstandingIssuances(state.issuances);
  const issuedShares = outstandingIssuances.reduce((sum, i) => sum + safeNumber(i.shares), 0);
  const authorizedByClasses = state.shareClasses.reduce((sum, c) => sum + safeNumber(c.authorizedShares), 0);
  const authorizedShares = safeNumber(state.profile.authorizedShares, authorizedByClasses || 0) || authorizedByClasses;
  const activeSafeAmount = state.safes
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + safeNumber(s.amount), 0);
  const reservationAmount = state.reservations
    .filter(r => ['interested', 'reserved', 'confirmed'].includes(r.status))
    .reduce((sum, r) => sum + safeNumber(r.desiredAmount), 0);
  return {
    authorizedShares,
    issuedShares,
    unissuedShares: Math.max(authorizedShares - issuedShares, 0),
    stakeholderCount: state.stakeholders.length,
    issuanceCount: state.issuances.length,
    activeSafeAmount,
    activeSafeCount: state.safes.filter(s => s.status === 'active').length,
    reservationAmount,
    reservationCount: state.reservations.filter(r => ['interested', 'reserved', 'confirmed'].includes(r.status)).length,
  };
};

export const buildCapTableRows = (state: CompanyEquityState): EquityCapTableRow[] => {
  const outstanding = getOutstandingIssuances(state.issuances);
  const totalOutstanding = outstanding.reduce((sum, i) => sum + safeNumber(i.shares), 0);
  const rows = new Map<string, EquityCapTableRow>();

  for (const issuance of outstanding) {
    const stakeholder = state.stakeholders.find(s => s.id === issuance.stakeholderId);
    const shareClass = state.shareClasses.find(c => c.id === issuance.shareClassId);
    const key = `${issuance.stakeholderId || 'unknown'}::${issuance.shareClassId || 'unknown'}`;
    const existing = rows.get(key) || {
      stakeholderId: issuance.stakeholderId,
      stakeholderName: stakeholder?.name || 'Unassigned holder',
      stakeholderType: stakeholder?.type || 'other',
      shareClassId: issuance.shareClassId,
      shareClassName: shareClass?.name || 'Unassigned class',
      shares: 0,
      ownershipPct: 0,
      cashPaid: 0,
    };
    existing.shares += safeNumber(issuance.shares);
    existing.cashPaid += safeNumber(issuance.shares) * safeNumber(issuance.pricePerShare);
    rows.set(key, existing);
  }

  return Array.from(rows.values())
    .map(row => ({ ...row, ownershipPct: totalOutstanding > 0 ? (row.shares / totalOutstanding) * 100 : 0 }))
    .sort((a, b) => b.shares - a.shares || a.stakeholderName.localeCompare(b.stakeholderName));
};

export const formatShares = (value: unknown) => safeNumber(value).toLocaleString(undefined, { maximumFractionDigits: 4 });

export const csvEscape = (value: unknown) => {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export const toCsv = (rows: unknown[][]) => rows.map(row => row.map(csvEscape).join(',')).join('\n');

export const createDemoEquityState = (businessName = 'MONIEZI Demo Studio'): CompanyEquityState => {
  const now = new Date().toISOString();
  const state = createDefaultCompanyEquityState(businessName);
  const commonClass = state.shareClasses[0];

  const stakeholders: EquityStakeholder[] = [
    {
      id: 'eq_holder_demo_founder',
      name: 'Eli Founder',
      email: 'eli.founder@example.com',
      address: 'Demo founder address',
      type: 'founder',
      notes: 'Founder record. Demo only.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_holder_demo_cofounder',
      name: 'Maya Cofounder',
      email: 'maya.cofounder@example.com',
      address: 'Demo cofounder address',
      type: 'founder',
      notes: 'Cofounder record. Demo only.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_holder_demo_advisor',
      name: 'Daniel Advisor',
      email: 'daniel.advisor@example.com',
      address: '',
      type: 'advisor',
      notes: 'Advisor equity for services example.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_holder_demo_employee',
      name: 'Lina Contractor',
      email: 'lina.contractor@example.com',
      address: '',
      type: 'employee',
      notes: 'Small contractor/employee grant example.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_holder_demo_investor_a',
      name: 'Robert Seed Investor',
      email: 'robert.investor@example.com',
      address: '',
      type: 'investor',
      notes: 'Cash investor example.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_holder_demo_investor_b',
      name: 'Sophia Growth Investor',
      email: 'sophia.investor@example.com',
      address: '',
      type: 'investor',
      notes: 'Larger cash investor example.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_holder_demo_entity',
      name: 'North Bridge Ventures LLC',
      email: 'legal+northbridge@example.com',
      address: '',
      type: 'entity',
      notes: 'Entity investor / LLC example.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_holder_demo_safe_only',
      name: 'Arben SAFE Investor',
      email: 'arben.safe@example.com',
      address: '',
      type: 'investor',
      notes: 'SAFE investor: not a shareholder until converted.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_holder_demo_reservation_only',
      name: 'Nora Reservation Only',
      email: 'nora.reservation@example.com',
      address: '',
      type: 'investor',
      notes: 'Reservation example: no issued shares yet.',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const issuances: EquityIssuance[] = [
    {
      id: 'eq_issue_demo_founder',
      issueDate: isoForMonthDay(1, 5),
      stakeholderId: 'eq_holder_demo_founder',
      shareClassId: commonClass.id,
      shares: 6000000,
      pricePerShare: 0.0001,
      considerationType: 'services',
      considerationDescription: 'Founder services, startup work product, and business formation work.',
      boardApprovalDate: isoForMonthDay(1, 5),
      certificateNumber: 'CS-001',
      vestingTerms: 'Founder vesting placeholder — confirm final terms with counsel.',
      restrictionLegend: 'Restricted securities legend placeholder.',
      status: 'issued',
      notes: 'Demo founder issuance. This is where founder shares are recorded.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_issue_demo_cofounder',
      issueDate: isoForMonthDay(1, 5),
      stakeholderId: 'eq_holder_demo_cofounder',
      shareClassId: commonClass.id,
      shares: 1500000,
      pricePerShare: 0.0001,
      considerationType: 'services',
      considerationDescription: 'Cofounder services and product development contribution.',
      boardApprovalDate: isoForMonthDay(1, 5),
      certificateNumber: 'CS-002',
      vestingTerms: 'Four-year vesting placeholder with one-year cliff.',
      restrictionLegend: 'Restricted securities legend placeholder.',
      status: 'issued',
      notes: 'Demo cofounder issuance.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_issue_demo_advisor',
      issueDate: isoForMonthDay(2, 1),
      stakeholderId: 'eq_holder_demo_advisor',
      shareClassId: commonClass.id,
      shares: 200000,
      pricePerShare: 0.0001,
      considerationType: 'services',
      considerationDescription: 'Advisory services and strategic introductions.',
      boardApprovalDate: isoForMonthDay(2, 1),
      certificateNumber: 'CS-003',
      vestingTerms: 'Monthly vesting placeholder over 24 months.',
      restrictionLegend: 'Restricted securities legend placeholder.',
      status: 'issued',
      notes: 'Demo advisor equity.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_issue_demo_employee',
      issueDate: isoForMonthDay(2, 15),
      stakeholderId: 'eq_holder_demo_employee',
      shareClassId: commonClass.id,
      shares: 100000,
      pricePerShare: 0.0001,
      considerationType: 'services',
      considerationDescription: 'Design and technical support services.',
      boardApprovalDate: isoForMonthDay(2, 15),
      certificateNumber: 'CS-004',
      vestingTerms: 'Milestone vesting placeholder.',
      restrictionLegend: 'Restricted securities legend placeholder.',
      status: 'issued',
      notes: 'Demo employee/contractor grant.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_issue_demo_investor_a',
      issueDate: isoForMonthDay(3, 10),
      stakeholderId: 'eq_holder_demo_investor_a',
      shareClassId: commonClass.id,
      shares: 200000,
      pricePerShare: 0.25,
      considerationType: 'cash',
      considerationDescription: 'Cash investment: $50,000 at $0.25/share.',
      boardApprovalDate: isoForMonthDay(3, 9),
      certificateNumber: 'CS-005',
      vestingTerms: 'No vesting — investor shares issued for cash.',
      restrictionLegend: 'Restricted securities legend placeholder.',
      status: 'issued',
      notes: 'Demo cash issuance: shares x price/share = amount paid.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_issue_demo_investor_b',
      issueDate: isoForMonthDay(3, 20),
      stakeholderId: 'eq_holder_demo_investor_b',
      shareClassId: commonClass.id,
      shares: 400000,
      pricePerShare: 0.25,
      considerationType: 'cash',
      considerationDescription: 'Cash investment: $100,000 at $0.25/share.',
      boardApprovalDate: isoForMonthDay(3, 19),
      certificateNumber: 'CS-006',
      vestingTerms: 'No vesting — investor shares issued for cash.',
      restrictionLegend: 'Restricted securities legend placeholder.',
      status: 'issued',
      notes: 'Demo larger investor: twice Investor A amount = twice Investor A shares.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_issue_demo_entity',
      issueDate: isoForMonthDay(4, 5),
      stakeholderId: 'eq_holder_demo_entity',
      shareClassId: commonClass.id,
      shares: 300000,
      pricePerShare: 0.25,
      considerationType: 'cash',
      considerationDescription: 'Entity investor cash purchase: $75,000 at $0.25/share.',
      boardApprovalDate: isoForMonthDay(4, 4),
      certificateNumber: 'CS-007',
      vestingTerms: 'No vesting — investor shares issued for cash.',
      restrictionLegend: 'Restricted securities legend placeholder.',
      status: 'issued',
      notes: 'Demo entity investor / LLC issuance.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_issue_demo_cancelled',
      issueDate: isoForMonthDay(4, 18),
      stakeholderId: 'eq_holder_demo_employee',
      shareClassId: commonClass.id,
      shares: 25000,
      pricePerShare: 0.0001,
      considerationType: 'services',
      considerationDescription: 'Cancelled demo record; not counted in outstanding shares.',
      boardApprovalDate: isoForMonthDay(4, 18),
      certificateNumber: 'CS-008-CANCELLED',
      vestingTerms: 'Cancelled before vesting.',
      restrictionLegend: 'Restricted securities legend placeholder.',
      status: 'cancelled',
      notes: 'Cancelled records remain visible in the ledger but do not count in the cap table.',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const safes: EquitySafeInstrument[] = [
    {
      id: 'eq_safe_demo_1',
      investorId: 'eq_holder_demo_safe_only',
      investorName: 'Arben SAFE Investor',
      date: isoForMonthDay(4, 12),
      amount: 25000,
      valuationCap: 5000000,
      discountRate: 20,
      mfn: false,
      type: 'post-money',
      status: 'active',
      notes: 'Demo SAFE only. This is not counted as issued shares until conversion.',
    },
    {
      id: 'eq_safe_demo_2',
      investorName: 'Helena Angel',
      date: isoForMonthDay(4, 20),
      amount: 50000,
      valuationCap: 7500000,
      discountRate: 15,
      mfn: true,
      type: 'pre-money',
      status: 'active',
      notes: 'Second SAFE example with MFN checked.',
    },
  ];

  const reservations: EquityInvestmentReservation[] = [
    {
      id: 'eq_reservation_demo_1',
      date: isoForMonthDay(5, 1),
      investorName: 'Nora Reservation Only',
      email: 'nora.reservation@example.com',
      phone: '+1 555 0101',
      entityName: '',
      desiredAmount: 10000,
      instrumentType: 'undecided',
      status: 'interested',
      followUpDate: isoForMonthDay(5, 8),
      signatureName: 'Nora Reservation Only',
      source: 'manual',
      packageStatus: 'draft',
      packageToken: 'pkgNoraDemo0001',
      packageTitle: 'Private Investment Reservation',
      packagePreparedFor: 'Nora Reservation Only',
      packageExpirationDate: isoForMonthDay(5, 20),
      packagePrivateMessage: 'Nora, this demo shows how a family/friends investor package could look before a real Cloudflare link is connected.',
      packageOfferingSummary: 'Demo-only private indication-of-interest package for a potential common stock reservation.',
      packageMajorTerms: 'Indication amount: $10,000.\nInstrument: Common stock.\nIndicative price per share: $0.25. Estimated shares: 40,000.\nThis is not final acceptance and does not itself issue shares.',
      packageRiskText: 'Demo risk language: private company investments are speculative and can result in loss of the full investment.',
      packageMinimumInvestment: 5000,
      packagePricePerShare: 0.25,
      packageEstimatedShares: 40000,
      packageLinkPlaceholder: 'https://your-domain.com/investor-reservation/pkgNoraDemo0001',
      notes: 'Interested only. No shares issued yet.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_reservation_demo_2',
      date: isoForMonthDay(5, 2),
      investorName: 'Michael Reserved',
      email: 'michael.reserved@example.com',
      phone: '+1 555 0102',
      entityName: 'Michael Family Office LLC',
      desiredAmount: 50000,
      instrumentType: 'safe',
      status: 'reserved',
      followUpDate: isoForMonthDay(5, 10),
      signatureName: 'Michael Reserved',
      source: 'manual',
      packageStatus: 'sent',
      packageToken: 'pkgMichaelDemo002',
      packageTitle: 'Private SAFE Reservation',
      packagePreparedFor: 'Michael Reserved',
      packageExpirationDate: isoForMonthDay(5, 25),
      packagePrivateMessage: 'Michael, this package previews a potential SAFE reservation and the acknowledgments the investor would see.',
      packageOfferingSummary: 'Demo-only indication of interest for a potential SAFE investment. Final SAFE terms would be handled in separate documents.',
      packageMajorTerms: 'Indication amount: $50,000.\nInstrument: SAFE.\nFinal valuation cap, discount, and other SAFE terms require final documentation.',
      packageRiskText: 'Demo risk language: this is not final company acceptance, payment instruction, or issued equity.',
      packageMinimumInvestment: 10000,
      packageLinkPlaceholder: 'https://your-domain.com/investor-reservation/pkgMichaelDemo002',
      packageSentAt: new Date().toISOString(),
      notes: 'Reservation for potential SAFE investment. Not a completed investment.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_reservation_demo_3',
      date: isoForMonthDay(5, 3),
      investorName: 'Sophia Growth Investor',
      email: 'sophia.investor@example.com',
      phone: '+1 555 0103',
      entityName: '',
      desiredAmount: 100000,
      instrumentType: 'common_stock',
      status: 'converted',
      followUpDate: '',
      signatureName: 'Sophia Growth Investor',
      source: 'manual',
      packageStatus: 'signed',
      packageToken: 'pkgSophiaDemo003',
      packageTitle: 'Private Investment Reservation - Signed Example',
      packagePreparedFor: 'Sophia Growth Investor',
      packageExpirationDate: isoForMonthDay(5, 18),
      packagePrivateMessage: 'Sophia, this signed demo package was later converted into a real share issuance record.',
      packageOfferingSummary: 'Demo signed indication of interest that has been converted into a share issuance entry.',
      packageMajorTerms: 'Indication amount: $100,000.\nInstrument: Common stock.\nIndicative price per share: $0.25. Estimated shares: 400,000.',
      packageRiskText: 'Demo risk language: signed reservation still required final company acceptance and issuance records.',
      packageMinimumInvestment: 10000,
      packagePricePerShare: 0.25,
      packageEstimatedShares: 400000,
      packageLinkPlaceholder: 'https://your-domain.com/investor-reservation/pkgSophiaDemo003',
      packageSignedAt: new Date().toISOString(),
      consentElectronicRecords: true,
      acknowledgmentIndicationOnly: true,
      acknowledgmentRisk: true,
      notes: 'Converted example: actual shares are recorded separately in Share Issuance Ledger.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'eq_reservation_demo_4',
      date: isoForMonthDay(5, 4),
      investorName: 'Victor Declined',
      email: 'victor.declined@example.com',
      phone: '',
      entityName: '',
      desiredAmount: 15000,
      instrumentType: 'common_stock',
      status: 'declined',
      followUpDate: '',
      signatureName: 'Victor Declined',
      source: 'manual',
      notes: 'Declined example. Kept for internal history only.',
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    ...state,
    profile: {
      ...state.profile,
      legalName: businessName || 'MONIEZI Demo Studio, Inc.',
      stateOfIncorporation: 'Wyoming',
      authorizedShares: 10000000,
      parValue: 0.0001,
      fiscalYearEnd: '12-31',
      notes: 'Demo data only. Use this module as an internal stock ledger / reservation tracker; final legal documents should be reviewed separately.',
    },
    stakeholders,
    issuances,
    safes,
    reservations,
  };
};
