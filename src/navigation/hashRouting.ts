import { Page } from '../../types';

export type HashNavState = { path: string; params: Record<string, string> };

export function normalizePage(p: unknown): Page {
  const v = String(p ?? '');
  const map: Record<string, Page> = {
    home: Page.Dashboard,
    dashboard: Page.Dashboard,
    invoices: Page.Invoices,
    invoice: Page.Invoices,
    ledger: Page.Ledger,
    transactions: Page.AllTransactions,
    all_transactions: Page.AllTransactions,
    reports: Page.Reports,
    equity: Page.CompanyEquity,
    company_equity: Page.CompanyEquity,
    company: Page.CompanyEquity,
    clients: Page.Clients,
    mileage: Page.Mileage,
    settings: Page.Settings,
    expenses: Page.Expenses,
    income: Page.Income,
  };
  return map[v] ?? (Object.values(Page).includes(v as Page) ? (v as Page) : Page.Dashboard);
}

export function parseHashLocation(): HashNavState {
  const raw = (typeof window !== 'undefined' ? window.location.hash : '') || '';
  const h = raw.startsWith('#') ? raw.slice(1) : raw;
  const cleaned = h.startsWith('/') ? h.slice(1) : h;
  const [pathPart, queryPart] = cleaned.split('?', 2);
  const path = (pathPart || 'home').trim() || 'home';

  const params: Record<string, string> = {};
  if (queryPart) {
    for (const pair of queryPart.split('&')) {
      const [k, v] = pair.split('=', 2);
      if (!k) continue;
      try {
        params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
      } catch {
        params[k] = v ?? '';
      }
    }
  }

  return { path, params };
}

export function buildHash(path: string, params: Record<string, string | null | undefined>): string {
  const p = (path || 'home').replace(/^\/+/, '');
  const entries = Object.entries(params).filter(([, v]) => v !== null && v !== undefined && String(v).length > 0) as Array<[string, string]>;
  if (!entries.length) return `#/${p}`;
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `#/${p}?${qs}`;
}

export function pageToHashPath(page: Page): string {
  switch (page) {
    case Page.Dashboard:
      return 'home';
    case Page.Invoices:
      return 'invoices';
    case Page.Ledger:
      return 'ledger';
    case Page.Mileage:
      return 'mileage';
    case Page.Clients:
      return 'clients';
    case Page.Reports:
      return 'reports';
    case Page.CompanyEquity:
      return 'equity';
    case Page.Settings:
      return 'settings';
    case Page.AllTransactions:
      return 'transactions';
    case Page.Income:
      return 'income';
    case Page.Expenses:
      return 'expenses';
    default:
      return 'home';
  }
}
