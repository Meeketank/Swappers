"use client";

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import DashboardHeader from '@/app/components/DashboardHeader';

interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: any;
}

export default function ChatPage() {
  const { connectionId } = useParams();
  const router = useRouter();
  const [connection, setConnection] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.currentUser || !connectionId) {
      router.push('/dashboard');
      return;
    }

    const fetchConnection = async () => {
      const connectionDoc = await getDoc(doc(db, 'connections', connectionId as string));
      if (!connectionDoc.exists()) {
        router.push('/dashboard/connections');
        return;
      }

      const connectionData = connectionDoc.data();
      const otherUserId = connectionData.user1Id === auth.currentUser?.uid 
        ? connectionData.user2Id 
        : connectionData.user1Id;

      const userDoc = await getDoc(doc(db, 'users', otherUserId));
      setConnection({
        id: connectionDoc.id,
        otherUserId,
        otherUserName: userDoc.exists() 
          ? `${userDoc.data().firstName} ${userDoc.data().lastName}`
          : 'Unknown User',
        otherUserPhoto: userDoc.exists() ? userDoc.data().profilePic : '',
        otherUserSkills: userDoc.exists() ? userDoc.data().skillsOffered?.slice(0, 3) : []
      });
    };

    fetchConnection();

    const messagesQuery = query(
      collection(db, 'connections', connectionId as string, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(messagesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [connectionId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser || !connectionId) return;

    try {
      await addDoc(collection(db, 'connections', connectionId as string, 'messages'), {
        content: newMessage,
        senderId: auth.currentUser.uid,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center">
          <svg className="h-16 w-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Connection not found</h2>
          <p className="text-gray-600 mb-6">The chat you're trying to access doesn't exist or was deleted</p>
          <button
            onClick={() => router.push('/dashboard/connections')}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Connections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex flex-col">
      <DashboardHeader profilePic={''} />
      
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col p-4">
        {/* Chat Header */}
        <div className="bg-white rounded-t-xl p-4 shadow-md flex items-center space-x-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 overflow-hidden flex items-center justify-center">
              {connection.otherUserPhoto ? (
                <img 
                  src={connection.otherUserPhoto} 
                  alt={connection.otherUserName} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{connection.otherUserName}</h2>
            {connection.otherUserSkills && connection.otherUserSkills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {connection.otherUserSkills.map((skill: string) => (
                  <span key={skill} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 bg-white p-4 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation with {connection.otherUserName.split(' ')[0]}</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.senderId === auth.currentUser?.uid ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs md:max-w-md rounded-xl p-4 ${message.senderId === auth.currentUser?.uid 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-none' 
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}
                >
                  <p className="break-words">{message.content}</p>
                  <p className={`text-xs mt-1 ${message.senderId === auth.currentUser?.uid ? 'text-blue-100' : 'text-gray-500'}`}>
                    {message.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form onSubmit={sendMessage} className="bg-white rounded-b-xl p-4 shadow-md">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message ${connection.otherUserName.split(' ')[0]}...`}
              className="flex-1 border border-gray-300 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white flex items-center justify-center hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}