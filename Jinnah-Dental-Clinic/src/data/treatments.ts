import { Treatment } from "@/types";

export const treatments: Treatment[] = [
  { id: '1', name: 'General Checkup', fee: 50, category: 'consultation', duration: 15 },
  { id: '2', name: 'Teeth Cleaning', fee: 80, category: 'cleaning', duration: 30 },
  { id: '3', name: 'Filling', fee: 120, category: 'restoration', duration: 45 },
  { id: '4', name: 'Root Canal', fee: 500, category: 'endodontics', duration: 90 },
  { id: '5', name: 'X-Ray', fee: 40, category: 'diagnostic', duration: 10 },
  { id: '6', name: 'Consultation', fee: 30, category: 'consultation', duration: 20 },
  { id: '7', name: 'Teeth Whitening', fee: 300, category: 'cosmetic', duration: 60 },
  { id: '8', name: 'Extraction', fee: 150, category: 'surgery', duration: 30 },
  { id: '9', name: 'Crown Fitting', fee: 400, category: 'prosthodontics', duration: 60 },
  { id: '10', name: 'Dental Implant', fee: 1500, category: 'surgery', duration: 120 },
  { id: '11', name: 'Braces Consultation', fee: 100, category: 'orthodontics', duration: 30 },
  { id: '12', name: 'Gum Treatment', fee: 200, category: 'periodontics', duration: 45 },
];

export const doctors = ['Dr. Smith', 'Dr. Johnson', 'Dr. Wilson', 'Dr. Brown', 'Dr. Taylor'];