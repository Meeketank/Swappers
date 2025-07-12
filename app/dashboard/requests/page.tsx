"use client";

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import DashboardHeader from '@/app/components/DashboardHeader';
import Link from 'next/link';

interface Request {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserEmail: string;
  fromUserPhoto: string;
  status: string;
  toUserId?: string;
  skillsOffered: string[];
  skillsWanted?: string[];
  createdAt?: any;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    const q = query(
      collection(db, 'requests'),
      where('toUserId', '==', auth.currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const requestsData: Request[] = [];
      
      for (const docSnap of snapshot.docs) {
        const requestData = docSnap.data();
        const userDoc = await getDoc(doc(db, 'users', requestData.fromUserId));
        if (userDoc.exists()) {
          requestsData.push({
            id: docSnap.id,
            fromUserId: requestData.fromUserId,
            fromUserName: `${userDoc.data().firstName} ${userDoc.data().lastName}`,
            fromUserEmail: userDoc.data().email,
            fromUserPhoto: userDoc.data().profilePic || '',
            status: requestData.status,
            skillsOffered: requestData.skillsOffered || [],
            ...(requestData.skillsWanted && { skillsWanted: requestData.skillsWanted }),
            ...(requestData.createdAt && { createdAt: requestData.createdAt })
          });
        }
      }

      setRequests(requestsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleResponse = async (requestId: string, accept: boolean) => {
    try {
      const requestRef = doc(db, 'requests', requestId);
      await updateDoc(requestRef, {
        status: accept ? 'accepted' : 'declined',
        respondedAt: serverTimestamp()
      });

      if (accept) {
        const request = requests.find(r => r.id === requestId);
        if (request) {
          const connectionRef = doc(collection(db, 'connections'));
          await setDoc(connectionRef, {
            user1Id: auth.currentUser?.uid,
            user2Id: request.fromUserId,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error("Error responding to request:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Loading your requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <DashboardHeader profilePic={''} />
    
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Connection Requests</h1>
            <p className="text-gray-600 mt-2">
              {requests.length} pending {requests.length === 1 ? 'request' : 'requests'}
            </p>
          </div>
        </div>
        
        {requests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-xl font-medium text-gray-800 mb-2">No pending requests</h3>
            <p className="text-gray-500">When someone sends you a connection request, it will appear here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {requests.map((request) => (
              <div key={request.id} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 overflow-hidden flex items-center justify-center">
                      {request.fromUserPhoto ? (
                        <img 
                          src={request.fromUserPhoto} 
                          alt={request.fromUserName} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="flex-grow">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-800">{request.fromUserName}</h3>
                        <p className="text-gray-600">{request.fromUserEmail}</p>
                      </div>
                      <div className="text-sm text-gray-500">
                        {request.createdAt?.toDate().toLocaleDateString()}
                      </div>
                    </div>

                    {request.skillsOffered.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Skills Offered:</h4>
                        <div className="flex flex-wrap gap-2">
                          {request.skillsOffered.map((skill) => (
                            <span key={skill} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {request.skillsWanted && request.skillsWanted.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Skills Wanted:</h4>
                        <div className="flex flex-wrap gap-2">
                          {request.skillsWanted.map((skill) => (
                            <span key={skill} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleResponse(request.id, false)}
                    className="px-6 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleResponse(request.id, true)}
                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-md"
                  >
                    Accept Request
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}