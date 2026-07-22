import type { CompanyEquityState } from '../../../types';

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export type PrivateRaiseFundingMetrics = {
  openInterestAmount: number;
  signedPackageAmount: number;
  recordedCashSharesAmount: number;
};

export function calculatePrivateRaiseFundingMetrics(
  state: Pick<CompanyEquityState, 'reservations' | 'issuances'>
): PrivateRaiseFundingMetrics {
  const openInterestAmount = state.reservations
    .filter(record => ['interested', 'reserved', 'confirmed'].includes(record.status))
    .reduce((sum, record) => sum + toNumber(record.desiredAmount), 0);

  const signedPackageAmount = state.reservations
    .filter(record => record.packageStatus === 'signed')
    .reduce((sum, record) => sum + toNumber(record.desiredAmount), 0);

  const recordedCashSharesAmount = state.issuances
    .filter(record => record.status === 'issued' && record.considerationType === 'cash')
    .reduce(
      (sum, record) => sum + toNumber(record.shares) * toNumber(record.pricePerShare),
      0
    );

  return {
    openInterestAmount,
    signedPackageAmount,
    recordedCashSharesAmount,
  };
}
