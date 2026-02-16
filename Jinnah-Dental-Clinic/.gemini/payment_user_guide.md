# Payment Collection Feature - User Guide

## How to Receive Payments from Patients

### Step 1: Access Patient Details
1. Navigate to the **Patient Details** tab
2. Find the patient you want to receive payment from
3. Click the **"View Details"** button on their patient card

### Step 2: Open Payment Form
1. In the Patient Details modal, look at the **Financial Overview** section
2. Click the **"Receive Payment / Add Credit"** button
3. The payment form will appear

### Step 3: Enter Payment Information
Fill in the payment form:
- **Amount (Rs)**: Enter the amount being paid
  - For due payments: Enter the amount received
  - For adding credit: Enter the credit amount
- **Payment Method**: Select from dropdown
  - Cash
  - Online Transfer
  - Card
  - Other
- **Notes** (Optional): Add any relevant notes
  - Example: "Partial payment for previous treatment"
  - Example: "Advance payment for future visits"

### Step 4: Confirm Payment
1. Review the entered information
2. Click **"Confirm Payment"** button
3. Wait for the success message

### Step 5: Verify Changes
After successful payment:
- ✅ Pending Balance updates immediately
- ✅ Total Paid amount increases
- ✅ New bill appears in the "Bills" tab
- ✅ Financial records update automatically

## Understanding Balance Types

### Due Balance (Red)
- Patient owes money to the clinic
- Displayed as positive number
- Example: Rs. 1,000 (Due)

### Credit Balance (Blue)
- Patient has advance payment/credit
- Displayed as negative number
- Example: Rs. 500 (Credit)

### Settled Balance (Gray)
- No pending amount
- Displayed as Rs. 0

## Payment Scenarios

### Scenario 1: Partial Payment on Due Amount
```
Current Balance: Rs. 2,000 (Due)
Payment Received: Rs. 1,000
New Balance: Rs. 1,000 (Due)
```

### Scenario 2: Full Payment on Due Amount
```
Current Balance: Rs. 1,500 (Due)
Payment Received: Rs. 1,500
New Balance: Rs. 0 (Settled)
```

### Scenario 3: Overpayment Creates Credit
```
Current Balance: Rs. 800 (Due)
Payment Received: Rs. 1,200
New Balance: Rs. 400 (Credit)
```

### Scenario 4: Adding to Existing Credit
```
Current Balance: Rs. 300 (Credit)
Payment Received: Rs. 500
New Balance: Rs. 800 (Credit)
```

## Financial Impact

All payments are automatically included in:
- 📊 **Total Revenue** on Admin Dashboard
- 💰 **Treatment Revenue** in Financial Reports
- 📈 **Net Profit** calculations
- 📋 **Revenue vs Expenses** charts
- 🧾 **Bill History** for the patient

## Tips

1. **Always verify the amount** before confirming
2. **Add notes** for clarity on payment purpose
3. **Check the Bills tab** to see the payment record
4. **Use appropriate payment method** for accurate tracking
5. **Credit can be used** for future treatments automatically

## Troubleshooting

### Payment button not visible?
- Ensure you have proper permissions (Operator or Admin role)

### Balance not updating?
- Wait a moment for the update to process
- Check your internet connection for Firebase sync

### Need to cancel a payment?
- Contact admin to void the bill record
- Do not enter negative amounts

## Access Permissions
- ✅ **Admin**: Full access
- ✅ **Operator**: Full access
- ❌ **Receptionist**: View only (no payment collection)
