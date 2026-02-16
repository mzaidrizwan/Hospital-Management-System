# Payment Modal - Separate Print Option

## Overview
Added a separate "Process Payment" button to the Payment Modal that allows users to process payments without automatically printing the bill. The existing functionality to print the bill is now available through a separate "Process & Print" button.

## Changes Made

### File Modified
`src/components/modals/PaymentModal.tsx`

### New Functions

#### `handleSubmitWithoutPrint(e: React.FormEvent, shouldPrint: boolean = true)`
- **Purpose**: Core payment processing function with optional printing
- **Parameters**:
  - `e`: Form event
  - `shouldPrint`: Boolean flag to control whether to print the bill
- **Functionality**:
  - Validates payment amount and discount
  - Checks license status
  - Saves payment data to IndexedDB
  - Creates bill record
  - Optionally triggers printing based on `shouldPrint` flag
  - Closes modal and shows success message
  - Syncs data to Firebase in background

#### `handleSubmit(e: React.FormEvent)`
- **Purpose**: Wrapper for payment processing WITH printing
- **Calls**: `handleSubmitWithoutPrint(e, true)`

#### `handleSubmitOnly(e: React.FormEvent)`
- **Purpose**: Wrapper for payment processing WITHOUT printing
- **Calls**: `handleSubmitWithoutPrint(e, false)`

### UI Changes

#### Button Layout (3 buttons total)
1. **Cancel** (Outline, Left)
   - Closes modal without processing payment
   - Always enabled unless submitting

2. **Process Payment** (Blue, Middle) - NEW
   - Processes payment WITHOUT printing
   - Saves all data locally and to cloud
   - Shows success message: "Payment processed!"
   - Disabled when:
     - Payment is being processed
     - Max payable is 0 or less
     - License has expired

3. **Process & Print** (Green, Right) - UPDATED
   - Processes payment AND prints bill
   - Includes printer icon
   - Shows success message: "Payment processed & bill printed!"
   - Disabled when:
     - Payment is being processed
     - Max payable is 0 or less
     - License has expired

## User Experience

### Scenario 1: Process Payment Only
1. User fills in payment details
2. Clicks **"Process Payment"** (blue button)
3. Payment is processed and saved
4. Success toast: "Payment processed!"
5. Modal closes
6. **No print dialog appears**

### Scenario 2: Process Payment & Print
1. User fills in payment details
2. Clicks **"Process & Print"** (green button with printer icon)
3. Payment is processed and saved
4. Print dialog opens automatically
5. Success toast: "Payment processed & bill printed!"
6. Modal closes

## Benefits

1. **Flexibility**: Users can choose whether to print immediately
2. **Efficiency**: Skip printing when not needed (e.g., online payments, follow-up visits)
3. **Convenience**: Still have quick access to print option when needed
4. **User Choice**: Empowers users to control their workflow
5. **Reduced Paper Waste**: Print only when necessary

## Use Cases

### When to use "Process Payment" (No Print)
- ✅ Online/digital payments where physical receipt isn't needed
- ✅ Follow-up visits where patient already has documentation
- ✅ Partial payments that will be consolidated later
- ✅ When printer is unavailable or out of paper
- ✅ Environmental preference to reduce paper usage

### When to use "Process & Print"
- ✅ Cash payments requiring immediate receipt
- ✅ First-time patients needing documentation
- ✅ Full payment completion
- ✅ Insurance claim documentation
- ✅ Patient specifically requests printed receipt

## Technical Details

### Code Flow

```
User clicks button
    ↓
handleSubmitOnly() or handleSubmit()
    ↓
handleSubmitWithoutPrint(e, shouldPrint)
    ↓
Validate payment data
    ↓
Save to IndexedDB
    ↓
if (shouldPrint) → handlePrint()
    ↓
Close modal
    ↓
Show success message
    ↓
Sync to Firebase (background)
```

### Success Messages
- **With Print**: "Payment processed & bill printed!"
- **Without Print**: "Payment processed!"

### Button States
Both payment buttons share the same disabled conditions:
- `isSubmitting`: Payment is being processed
- `maxPayable <= 0`: No amount to pay
- `licenseDaysLeft <= 0`: License expired

### Visual Distinction
- **Process Payment**: Blue background (`bg-blue-600`)
- **Process & Print**: Green background with printer icon (`bg-green-600`)

## Backward Compatibility
- ✅ All existing payment processing logic preserved
- ✅ Print functionality unchanged
- ✅ Data saving and syncing unchanged
- ✅ Only UI and user choice added

## Testing Checklist
- [ ] Process payment without printing
- [ ] Process payment with printing
- [ ] Verify both buttons are disabled during processing
- [ ] Verify correct success messages appear
- [ ] Verify payment data is saved correctly in both cases
- [ ] Verify bill record is created in both cases
- [ ] Verify print dialog only appears when "Process & Print" is clicked
- [ ] Test with expired license (both buttons should be disabled)
- [ ] Test with zero payable amount (both buttons should be disabled)
