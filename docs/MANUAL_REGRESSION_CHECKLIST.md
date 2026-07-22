# MONIEZI manual regression checklist

Run these after each mobile-input or layout change.

## Transactions
- Overview -> plus -> Income -> Amount field opens without dead gap
- Overview -> plus -> Expense -> Amount field opens without dead gap
- Backspace an entered amount and confirm field behavior is predictable
- Save a new transaction and verify the saved record is correct

## Mileage
- Overview -> plus -> Mileage starts with a fresh draft
- Miles field is blank for a new trip, not reused from the last record
- Mileage with no demo data does not show a dark filler block above the keyboard
- Mileage with demo data loaded behaves the same during entry
- Saving a trip resets the draft for the next entry

## Installed iPhone app shell
- Bottom navigation does not compete with the keyboard while editing
- Floating controls hide while editing if they overlap inputs
- Screen does not flicker during repeated focus changes

## PWA basics
- Installed app opens offline after the shell is cached
- Data persists after app restart
- Reports and exports still open from the same flows as before


## Release gate for v30.4.1 and later

Before shipping a new GitHub version, run:

- `npm run check`
- `npm run build`

Then manually verify on iPhone:

- Overview → `+` → Income → Amount field opens without dark gap or footer conflict
- Overview → `+` → Expense → Amount field opens without dark gap or footer conflict
- Overview → `+` → Mileage opens with a fresh blank Miles field, not the last saved value
- Mileage with no demo data loaded behaves the same as Mileage with demo data loaded during keyboard entry
- Save a mileage record, then start another one from Overview `+`; old miles should not be carried forward
- Bottom nav and floating controls do not compete with the keyboard while editing
