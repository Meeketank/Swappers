// components/FirestoreErrorBoundary.tsx
"use client";

import { useEffect } from 'react';

export default function FirestoreErrorBoundary({ children, onError }: { 
  children: React.ReactNode,
  onError: (error: Error) => void 
}) {
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      if (args[0]?.includes?.('@firebase/firestore')) {
        onError(new Error(args.join(' ')));
      }
      originalConsoleError.apply(console, args);
    };
    
    return () => {
      console.error = originalConsoleError;
    };
  }, [onError]);

  return <>{children}</>;
}