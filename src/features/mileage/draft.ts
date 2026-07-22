import { MileageTrip } from '../../../types';

export type MileageDraft = {
  date: string;
  miles: string;
  purpose: string;
  client: string;
  notes: string;
};

export function createEmptyMileageDraft(today = new Date()): MileageDraft {
  return {
    date: today.toISOString().split('T')[0],
    miles: '',
    purpose: '',
    client: '',
    notes: '',
  };
}

export function normalizeMileageDraftMiles(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (trimmed === '') return '';
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? String(parsed) : rawValue;
}

export function toMileageTripPayload(draft: MileageDraft): Omit<MileageTrip, 'id'> {
  return {
    date: draft.date,
    miles: Number(draft.miles),
    purpose: draft.purpose,
    client: draft.client,
    notes: draft.notes,
  };
}
