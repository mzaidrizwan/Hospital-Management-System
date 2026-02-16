# Payment Modal - Button Layout Guide

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                      PAYMENT MODAL                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Payment form fields...]                                        │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│  │  Cancel  │  │ Process Payment │  │ 🖨️  Process & Print │  │
│  │ (Outline)│  │     (Blue)      │  │      (Green)         │  │
│  └──────────┘  └─────────────────┘  └──────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Button Details

### 1. Cancel Button (Left)
- **Style**: Outline (white background, border)
- **Width**: Flexible (flex-1)
- **Action**: Closes modal without saving
- **Enabled**: Always (except when processing)

### 2. Process Payment Button (Middle) ⭐ NEW
- **Style**: Solid Blue (`bg-blue-600`)
- **Width**: Flexible (flex-1)
- **Icon**: None
- **Text**: "Process Payment"
- **Action**: 
  - ✅ Saves payment data
  - ✅ Creates bill record
  - ✅ Updates patient balance
  - ❌ Does NOT print
- **Success Message**: "Payment processed!"

### 3. Process & Print Button (Right)
- **Style**: Solid Green (`bg-green-600`)
- **Width**: Flexible (flex-1)
- **Icon**: 🖨️ Printer icon
- **Text**: "Process & Print"
- **Action**: 
  - ✅ Saves payment data
  - ✅ Creates bill record
  - ✅ Updates patient balance
  - ✅ Opens print dialog
- **Success Message**: "Payment processed & bill printed!"

## Button States

### Normal State
```
┌──────────┐  ┌─────────────────┐  ┌──────────────────────┐
│  Cancel  │  │ Process Payment │  │ 🖨️  Process & Print │
└──────────┘  └─────────────────┘  └──────────────────────┘
```

### Processing State (Both payment buttons show spinner)
```
┌──────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  Cancel  │  │ ⏳ Processing...   │  │ ⏳ Processing...   │
│(Disabled)│  │    (Disabled)       │  │    (Disabled)       │
└──────────┘  └─────────────────────┘  └─────────────────────┘
```

### Disabled State (License expired or no amount to pay)
```
┌──────────┐  ┌─────────────────┐  ┌──────────────────────┐
│  Cancel  │  │ Process Payment │  │ 🖨️  Process & Print │
│          │  │   (Disabled)    │  │     (Disabled)       │
└──────────┘  └─────────────────┘  └──────────────────────┘
```

## Responsive Behavior

### Desktop (Wide Screen)
All three buttons displayed side-by-side with equal width

### Mobile (Narrow Screen)
Buttons stack vertically or wrap based on available space
- Cancel button maintains outline style
- Payment buttons maintain their colors

## Color Coding

| Button | Color | Purpose |
|--------|-------|---------|
| Cancel | Gray Outline | Neutral action - no changes |
| Process Payment | Blue | Primary action - save only |
| Process & Print | Green | Complete action - save + print |

## User Decision Flow

```
                    ┌─────────────────┐
                    │ Fill Payment    │
                    │ Details         │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Need printed    │
                    │ receipt?        │
                    └────┬──────┬─────┘
                         │      │
                    NO ◄─┘      └─► YES
                         │           │
                ┌────────▼─────┐ ┌──▼──────────────┐
                │ Process      │ │ Process & Print │
                │ Payment      │ │                 │
                │ (Blue)       │ │ (Green)         │
                └──────────────┘ └─────────────────┘
                         │           │
                         │           ├─► Print Dialog Opens
                         │           │
                    ┌────▼───────────▼────┐
                    │ Payment Saved       │
                    │ Modal Closes        │
                    │ Success Message     │
                    └─────────────────────┘
```

## Quick Reference

| Scenario | Click This Button |
|----------|------------------|
| Just record payment | **Process Payment** (Blue) |
| Need receipt now | **Process & Print** (Green) |
| Changed mind | **Cancel** (Outline) |
| Printer broken | **Process Payment** (Blue) |
| Cash payment | **Process & Print** (Green) |
| Online payment | **Process Payment** (Blue) |
| Patient wants receipt | **Process & Print** (Green) |
| Internal record only | **Process Payment** (Blue) |

## Accessibility

- All buttons have clear, descriptive labels
- Printer icon provides visual cue for print action
- Color coding helps distinguish actions
- Disabled state clearly indicated
- Loading state shows processing feedback
- Success messages confirm action completion
