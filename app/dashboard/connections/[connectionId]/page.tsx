"use client";

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import DashboardHeader from '@/app/components/DashboardHeader';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: any;
}

interface Connection {
  id: string;
  user1Id: string;
  user2Id: string;
}

interface Rating {
  userId: string;
  rating: number;
}

export default function ChatPage() {
  const { connectionId } = useParams();
  const router = useRouter();
  const [connection, setConnection] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [existingRating, setExistingRating] = useState<Rating | null>(null);
  const [isRemovingConnection, setIsRemovingConnection] = useState(false);
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
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const ratings = userData.ratings || [];
        const userRating = ratings.find((r: Rating) => r.userId === auth.currentUser?.uid);
        
        setConnection({
          id: connectionDoc.id,
          otherUserId,
          otherUserName: `${userData.firstName} ${userData.lastName}`,
          otherUserPhoto: userData.profilePic || '',
          otherUserSkills: userData.skillsOffered?.slice(0, 3) || [],
          otherUserRating: userData.rating || 0,
          ratings
        });

        if (userRating) {
          setExistingRating(userRating);
          setUserRating(userRating.rating);
        }
      }
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
      toast.error('Failed to send message');
    }
  };

  const handleRatingSubmit = async (rating: number) => {
    if (!auth.currentUser || !connection) return;

    try {
      const userRef = doc(db, 'users', connection.otherUserId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        toast.error('User not found');
        return;
      }

      const existingRatings = userDoc.data().ratings || [];
      let updatedRatings = [...existingRatings];
      
      // Check if user already rated
      const existingRatingIndex = updatedRatings.findIndex(
        (r) => r.userId === auth.currentUser?.uid
      );

      if (existingRatingIndex >= 0) {
        // Update existing rating
        updatedRatings[existingRatingIndex] = {
          userId: auth.currentUser.uid,
          rating
        };
      } else {
        // Add new rating
        updatedRatings.push({
          userId: auth.currentUser.uid,
          rating
        });
      }

      // Calculate new average
      const total = updatedRatings.reduce((sum, r) => sum + r.rating, 0);
      const average = total / updatedRatings.length;

      // Update user document
      await updateDoc(userRef, {
        ratings: updatedRatings,
        rating: average
      });

      // Update local state
      setExistingRating({
        userId: auth.currentUser.uid,
        rating
      });
      setUserRating(rating);
      setShowRating(false);
      
      // Update connection data
      setConnection({
        ...connection,
        otherUserRating: average,
        ratings: updatedRatings
      });

      toast.success('Rating submitted successfully!');
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast.error('Failed to submit rating');
    }
  };

  const removeConnection = async () => {
    if (!connectionId || !auth.currentUser || !connection) return;
    
    setIsRemovingConnection(true);
    try {
      // Delete the connection document
      await deleteDoc(doc(db, 'connections', connectionId as string));
      
      // Remove connection from both users' connections array
      const currentUserRef = doc(db, 'users', auth.currentUser.uid);
      const otherUserRef = doc(db, 'users', connection.otherUserId);
      
      await updateDoc(currentUserRef, {
        connections: arrayRemove(connectionId)
      });
      
      await updateDoc(otherUserRef, {
        connections: arrayRemove(connectionId)
      });
      
      toast.info('Connection removed successfully', {
        position: "top-center",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
        style: {
          backgroundColor: '#FEF3C7',
          color: '#92400E',
        },
        icon: (
          <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
      });
      router.push('/dashboard/connections');
    } catch (error) {
      console.error("Error removing connection:", error);
      toast.error('Failed to remove connection');
    } finally {
      setIsRemovingConnection(false);
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
        <div className="bg-white rounded-t-xl p-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
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
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`h-4 w-4 ${i < Math.floor(connection.otherUserRating) ? 'text-yellow-400' : 'text-gray-300'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
                <span className="ml-1 text-sm text-gray-600">
                  {connection.otherUserRating.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Remove Connection Button - Now properly positioned on mobile */}
          <div className="flex justify-end md:justify-start">
            <button
              onClick={removeConnection}
              disabled={isRemovingConnection}
              className="flex items-center space-x-1 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 w-full md:w-auto justify-center"
            >
              {isRemovingConnection ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Removing...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Remove Connection</span>
                </>
              )}
            </button>
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

        {/* Rating Section */}
        {connection && auth.currentUser?.uid !== connection.otherUserId && (
          <div className="bg-white rounded-lg p-4 mt-4 shadow-md">
            <button
              onClick={() => setShowRating(!showRating)}
              className="w-full py-2 px-4 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors flex items-center justify-center"
            >
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {existingRating ? 'Update Your Rating' : showRating ? 'Cancel Rating' : 'Rate This User'}
            </button>
            
            {showRating && (
              <div className="flex flex-col items-center mt-4">
                <div className="flex mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className="focus:outline-none"
                      onClick={() => handleRatingSubmit(star)}
                      onMouseEnter={() => setUserRating(star)}
                      onMouseLeave={() => setUserRating(existingRating?.rating || 0)}
                    >
                      <svg
                        className={`h-8 w-8 ${(userRating || 0) >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500">
                  {existingRating 
                    ? `You previously rated ${existingRating.rating} star${existingRating.rating !== 1 ? 's' : ''}. Click to update.`
                    : 'Click a star to rate this user'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}