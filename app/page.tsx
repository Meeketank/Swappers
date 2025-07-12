"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';

// Predefined positions and sizes for the bubbles to avoid hydration mismatch
const BUBBLES = [
  { size: 120, top: 10, left: 15, duration: 15 },
  { size: 80, top: 20, left: 70, duration: 18 },
  { size: 150, top: 5, left: 45, duration: 12 },
  { size: 90, top: 30, left: 85, duration: 20 },
  { size: 110, top: 15, left: 25, duration: 16 },
  // Add more bubbles as needed
];

export default function SplashScreen() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
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

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
        <h1 className="text-4xl font-bold text-white">Welcome to Swappers</h1>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 overflow-hidden">
      {/* Animated background elements - now using predefined values */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
        {BUBBLES.map((bubble, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/10"
            style={{
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              top: `${bubble.top}%`,
              left: `${bubble.left}%`,
              animation: `float ${bubble.duration}s linear infinite`,
              animationDelay: `${i * 0.5}s`
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center px-6 py-12">
        <div className="mb-8 animate-bounce">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-24 w-24 mx-auto text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            />
          </svg>
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold mb-6 text-white tracking-tight">
          Welcome to <span className="text-yellow-300">Swappers</span>
        </h1>

        <p className="text-xl md:text-2xl text-blue-100 mb-10 max-w-2xl mx-auto">
          Connect, share skills, and grow together in our community of learners and teachers
        </p>

        <div className="flex justify-center space-x-4">
          <div className="h-3 w-3 bg-white rounded-full animate-pulse"></div>
          <div className="h-3 w-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="h-3 w-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center text-blue-100 text-sm">
        <p>Loading your experience...</p>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes float {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(-1000px) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}