// src/types/electron.d.ts
export {};

declare global {
  interface Window {
    electron?: {
      isElectron: boolean;
      print: (htmlContent: string) => Promise<{ success: boolean; error?: string }>;
      windowPrint: () => Promise<{ success: boolean }>;
      onPrintError: (callback: (error: string) => void) => void;
    };
    process?: {
      type?: string;
      versions?: {
        electron?: string;
        chrome?: string;
        node?: string;
      };
    };
  }
}