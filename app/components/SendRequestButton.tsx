// components/SendRequestButton.tsx
"use client";

import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function SendRequestButton({ toUserId }: { toUserId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendRequest = async () => {
    if (!auth.currentUser) return;
    
    setLoading(true);
    try {
      const requestRef = doc(db, 'requests', `${auth.currentUser.uid}_${toUserId}`);
      await setDoc(requestRef, {
        fromUserId: auth.currentUser.uid,
        toUserId,
        status: 'pending',
        timestamp: serverTimestamp()
      });
    } catch (err) {
      setError('Failed to send request');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={sendRequest}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {loading ? 'Sending...' : 'Send Request'}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}