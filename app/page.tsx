"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
          router.push('/dashboard');
        } else {
          router.push('/login');
        }
      });

      return () => unsubscribe();
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen bg-blue-500 text-white">
      <h1 className="text-4xl font-bold">Welcome to Swappers</h1>
    </div>
  );
}