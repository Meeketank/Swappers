"use client";

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import Link from 'next/link';
import DashboardHeader from '@/app/components/DashboardHeader';

interface Connection {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserPhoto: string;
  otherUserSkills?: string[];
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'connections'),
      where('user1Id', '==', auth.currentUser.uid)
    );

    const q2 = query(
      collection(db, 'connections'),
      where('user2Id', '==', auth.currentUser.uid)
    );

    const unsubscribe1 = onSnapshot(q, async (snapshot) => {
      const connectionsData = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const connectionData = docSnap.data();
          const userDoc = await getDoc(doc(db, 'users', connectionData.user2Id));
          return {
            id: docSnap.id,
            otherUserId: connectionData.user2Id,
            otherUserName: userDoc.exists() 
              ? `${userDoc.data().firstName} ${userDoc.data().lastName}`
              : 'Unknown User',
            otherUserPhoto: userDoc.exists() ? userDoc.data().profilePic : '',
            otherUserSkills: userDoc.exists() ? userDoc.data().skillsOffered?.slice(0, 3) : []
          };
        })
      );
      setConnections(prev => [...prev.filter(c => !snapshot.docs.some(d => d.id === c.id)), ...connectionsData]);
      setLoading(false);
    });

    const unsubscribe2 = onSnapshot(q2, async (snapshot) => {
      const connectionsData = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const connectionData = docSnap.data();
          const userDoc = await getDoc(doc(db, 'users', connectionData.user1Id));
          return {
            id: docSnap.id,
            otherUserId: connectionData.user1Id,
            otherUserName: userDoc.exists() 
              ? `${userDoc.data().firstName} ${userDoc.data().lastName}`
              : 'Unknown User',
            otherUserPhoto: userDoc.exists() ? userDoc.data().profilePic : '',
            otherUserSkills: userDoc.exists() ? userDoc.data().skillsOffered?.slice(0, 3) : []
          };
        })
      );
      setConnections(prev => [...prev.filter(c => !snapshot.docs.some(d => d.id === c.id)), ...connectionsData]);
      setLoading(false);
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Loading your connections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <DashboardHeader profilePic={''} />
    
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Your Connections</h1>
            <p className="text-gray-600 mt-2">
              {connections.length} {connections.length === 1 ? 'connection' : 'connections'}
            </p>
          </div>
        </div>
        
        {connections.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3 className="text-xl font-medium text-gray-800 mb-2">No connections yet</h3>
            <p className="text-gray-500 mb-4">When you connect with someone, they'll appear here</p>
            <Link 
              href="/dashboard" 
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors inline-block"
            >
              Find people to connect
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {connections.map((connection) => (
              <Link 
                key={connection.id} 
                href={`/dashboard/connections/${connection.id}`}
                className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 overflow-hidden flex-shrink-0">
                      {connection.otherUserPhoto ? (
                        <img 
                          src={connection.otherUserPhoto} 
                          alt={connection.otherUserName} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg className="h-full w-full text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-800">{connection.otherUserName}</h3>
                      <p className="text-blue-500 mt-1">View profile →</p>
                    </div>
                  </div>

                  {connection.otherUserSkills && connection.otherUserSkills.length > 0 && (
                    <div className="mt-auto pt-4 border-t border-gray-100">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Skills they offer:</h4>
                      <div className="flex flex-wrap gap-2">
                        {connection.otherUserSkills.map((skill) => (
                          <span key={skill} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}