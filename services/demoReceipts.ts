import officeReceiptUrl from '../src/assets/demo/receipts/office.png';
import gasReceiptUrl from '../src/assets/demo/receipts/gas.png';
import restaurantReceiptUrl from '../src/assets/demo/receipts/restaurant.png';
import hardwareReceiptUrl from '../src/assets/demo/receipts/hardware.png';
import groceryReceiptUrl from '../src/assets/demo/receipts/grocery.png';

// Demo receipt metadata for offline/local seeding.
// Asset URLs are imported through Vite so they remain correct on GitHub Pages and other subpath deployments.
export const DEMO_RECEIPT_ASSETS: Array<{ id: string; note: string; mimeType: string; assetUrl: string }> = [
  { id: 'rcpt_demo_1', note: 'Office supplies — Office Depot', mimeType: 'image/png', assetUrl: officeReceiptUrl },
  { id: 'rcpt_demo_2', note: 'Fuel — Shell', mimeType: 'image/png', assetUrl: gasReceiptUrl },
  { id: 'rcpt_demo_3', note: 'Business meal — Corner Restaurant', mimeType: 'image/png', assetUrl: restaurantReceiptUrl },
  { id: 'rcpt_demo_4', note: 'Hardware materials — Ace Hardware', mimeType: 'image/png', assetUrl: hardwareReceiptUrl },
  { id: 'rcpt_demo_5', note: 'Groceries / client refreshments — Market Fresh', mimeType: 'image/png', assetUrl: groceryReceiptUrl },
];
