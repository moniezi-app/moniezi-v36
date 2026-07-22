import * as assert from 'node:assert/strict';
import { calculatePrivateRaiseFundingMetrics } from '../../src/features/equity/fundingMetrics';

export function runFundingMetricsTests() {
  const metrics = calculatePrivateRaiseFundingMetrics({
    reservations: [
      { status: 'interested', packageStatus: 'draft', desiredAmount: 1000 },
      { status: 'confirmed', packageStatus: 'sent', desiredAmount: 2000 },
      { status: 'reserved', packageStatus: 'signed', desiredAmount: 3000 },
      { status: 'declined', packageStatus: 'signed', desiredAmount: 4000 },
    ],
    issuances: [
      { status: 'issued', considerationType: 'cash', shares: 100, pricePerShare: 2 },
      { status: 'draft', considerationType: 'cash', shares: 100, pricePerShare: 5 },
      { status: 'issued', considerationType: 'services', shares: 100, pricePerShare: 7 },
    ],
  } as any);

  assert.equal(metrics.openInterestAmount, 6000, 'interest includes interested, reserved, and confirmed records');
  assert.equal(metrics.signedPackageAmount, 7000, 'signed total includes only explicitly signed packages');
  assert.equal(metrics.recordedCashSharesAmount, 200, 'funded shares include only issued cash consideration');
}
