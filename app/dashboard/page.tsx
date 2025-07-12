"use client";

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, serverTimestamp, setDoc, doc, getDoc } from 'firebase/firestore';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Link from 'next/link';
import DashboardHeader from '../components/DashboardHeader';
import FirestoreErrorBoundary from '../components/FirestoreErrorBoundary';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  profilePic: string;
  skillsOffered: string[];
  skillsWanted: string[];
  rating: number;
  email: string;
  ratings: { userId: string; rating: number }[];
  profileType: string;
}

interface Connection {
  id: string;
  user1Id: string;
  user2Id: string;
}

interface Request {
  toUserId: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<UserProfile[]>([]);
  const [matchedProfiles, setMatchedProfiles] = useState<UserProfile[]>([]);
  const [otherProfiles, setOtherProfiles] = useState<UserProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Request[]>([]);

  const fetchUsers = async () => {
    try {
      if (!auth.currentUser) {
        router.push('/login');
        return;
      }

      const currentUserDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!currentUserDoc.exists()) {
        router.push('/login');
        return;
      }

      const userData = currentUserDoc.data() as UserProfile;
      setCurrentUser({
        ...userData,
        id: currentUserDoc.id
      });

      const publicProfilesQuery = query(
        collection(db, 'users'),
        where('profileType', '==', 'public'),
        where('__name__', '!=', auth.currentUser.uid)
      );

      const publicProfilesSnapshot = await getDocs(publicProfilesQuery);
      const profiles = publicProfilesSnapshot.docs.map(doc => ({
        ...doc.data() as UserProfile,
        id: doc.id
      }));

      setAllProfiles(profiles);
      setFilteredProfiles(profiles);

      // Calculate matches based on skills
      const matched = profiles.filter(profile => 
        profile.skillsOffered.some(skill => 
          userData.skillsWanted.includes(skill)
      ));

      const others = profiles.filter(profile => 
        !matched.some(mp => mp.id === profile.id)
      );

      setMatchedProfiles(matched);
      setOtherProfiles(others);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error('Error loading user data');
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    if (!auth.currentUser?.uid) return;

    try {
      const q1 = query(
        collection(db, 'connections'),
        where('user1Id', '==', auth.currentUser.uid)
      );
      const q2 = query(
        collection(db, 'connections'),
        where('user2Id', '==', auth.currentUser.uid)
      );

      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const connectionsData = [
        ...snapshot1.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      ] as Connection[];

      setConnections(connectionsData);
    } catch (error) {
      console.error("Error fetching connections:", error);
      toast.error('Error loading connections');
    }
  };

  const fetchPendingRequests = async () => {
    if (!auth.currentUser?.uid) return;

    try {
      const q = query(
        collection(db, 'requests'),
        where('fromUserId', '==', auth.currentUser.uid),
        where('status', '==', 'pending')
      );
      
      const snapshot = await getDocs(q);
      const requests = snapshot.docs.map(doc => ({
        toUserId: doc.data().toUserId
      }));
      
      setPendingRequests(requests);
    } catch (error) {
      console.error("Error fetching pending requests:", error);
      toast.error('Error loading pending requests');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchUsers();
      await fetchConnections();
      await fetchPendingRequests();
    };
    fetchData();
  }, [router]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProfiles(allProfiles);
      // Restore original matched/other split when search is cleared
      if (currentUser) {
        const matched = allProfiles.filter(profile => 
          profile.skillsOffered.some(skill => 
            currentUser.skillsWanted.includes(skill))
        );
        const others = allProfiles.filter(profile => 
          !matched.some(mp => mp.id === profile.id)
        );
        setMatchedProfiles(matched);
        setOtherProfiles(others);
      }
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = allProfiles.filter(profile => 
      profile.firstName.toLowerCase().includes(term) ||
      profile.lastName.toLowerCase().includes(term) ||
      profile.skillsOffered.some(skill => skill.toLowerCase().includes(term)) ||
      profile.skillsWanted.some(skill => skill.toLowerCase().includes(term))
    );

    setFilteredProfiles(filtered);
    
    // During search, show all results together without splitting into matches/others
    setMatchedProfiles([]);
    setOtherProfiles(filtered);
  }, [searchTerm, allProfiles, currentUser]);

  const handleSendRequest = async (userId: string) => {
    if (!auth.currentUser || !currentUser) return;
  
    try {
      const requestRef = doc(collection(db, 'requests'));
      await setDoc(requestRef, {
        fromUserId: auth.currentUser.uid,
        fromUserName: `${currentUser.firstName} ${currentUser.lastName}`,
        toUserId: userId,
        status: 'pending',
        createdAt: serverTimestamp(),
        skillsOffered: currentUser.skillsOffered,
        skillsWanted: currentUser.skillsWanted
      });

      await fetchPendingRequests();
  
      toast.success('Request sent successfully!', {
        position: "top-center",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error("Error sending request:", error);
      toast.error('Failed to send request', {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      toast.info('Logging out...', {
        position: "top-center",
        autoClose: 1000,
        hideProgressBar: true,
      });
      setTimeout(() => router.push('/login'), 1000);
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error('Failed to log out', {
        position: "top-center",
        autoClose: 5000,
      });
    }
  };

  const handleError = (error: Error) => {
    console.log('Caught Firestore error:', error.message);
    toast.error(`Database error: ${error.message}`, {
      position: "top-center",
      autoClose: 5000,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Loading your swapper matches...</p>
        </div>
      </div>
    );
  }

  return (
    <FirestoreErrorBoundary onError={handleError}>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <ToastContainer
          position="top-center"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
        
        <DashboardHeader profilePic={currentUser?.profilePic || ""} />
        
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              Find Your Perfect <span className="text-blue-600">Skill Swap</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Connect with talented professionals who have what you need and need what you have
            </p>
            
            <div className="max-w-2xl mx-auto relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by name, skill offered, or skill wanted..."
                className="w-full p-4 pl-10 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-lg transition-all duration-300 hover:shadow-xl text-blue-800 placeholder-blue-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
              <h3 className="text-sm font-medium text-gray-500">Total Swappers</h3>
              <p className="text-3xl font-bold text-gray-800">{allProfiles.length}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500 hover:shadow-lg transition-shadow">
              <h3 className="text-sm font-medium text-gray-500">Your Potential Matches</h3>
              <p className="text-3xl font-bold text-gray-800">{matchedProfiles.length}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-purple-500 hover:shadow-lg transition-shadow">
              <h3 className="text-sm font-medium text-gray-500">Skills You Offer</h3>
              <p className="text-3xl font-bold text-gray-800">{currentUser?.skillsOffered.length || 0}</p>
            </div>
          </div>

          {searchTerm ? (
            <section className="mb-12">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Search Results
                </h2>
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center transition-colors"
                >
                  <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear search
                </button>
              </div>
              
              {filteredProfiles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProfiles.map((profile) => (
                    <ProfileCard 
                      key={profile.id}
                      profile={profile}
                      onSelect={setSelectedProfile}
                      onSendRequest={handleSendRequest}
                      isMatch={currentUser?.skillsWanted.some(skill => 
                        profile.skillsOffered.includes(skill)) || false}
                      connections={connections}
                      pendingRequests={pendingRequests}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-md p-8 text-center">
                  <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">No results found</h3>
                  <p className="text-gray-500">Try different search terms</p>
                </div>
              )}
            </section>
          ) : (
            <>
              {matchedProfiles.length > 0 && (
                <section className="mb-12">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                      Your <span className="text-blue-600">Perfect Matches</span>
                    </h2>
                    <div className="text-sm text-gray-500">
                      {matchedProfiles.length} {matchedProfiles.length === 1 ? 'match' : 'matches'} found
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matchedProfiles.map((profile) => (
                      <ProfileCard 
                        key={profile.id}
                        profile={profile}
                        onSelect={setSelectedProfile}
                        onSendRequest={handleSendRequest}
                        isMatch={true}
                        connections={connections}
                        pendingRequests={pendingRequests}
                      />
                    ))}
                  </div>
                </section>
              )}

              {otherProfiles.length > 0 && (
                <section className="mb-12">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                      Other <span className="text-purple-600">Available Swappers</span>
                    </h2>
                    <div className="text-sm text-gray-500">
                      {otherProfiles.length} {otherProfiles.length === 1 ? 'swapper' : 'swappers'} available
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {otherProfiles.map((profile) => (
                      <ProfileCard 
                        key={profile.id}
                        profile={profile}
                        onSelect={setSelectedProfile}
                        onSendRequest={handleSendRequest}
                        isMatch={false}
                        connections={connections}
                        pendingRequests={pendingRequests}
                      />
                    ))}
                  </div>
                </section>
              )}

              {!matchedProfiles.length && !otherProfiles.length && (
                <div className="bg-white rounded-xl shadow-md p-8 text-center">
                  <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">No swappers available yet</h3>
                  <p className="text-gray-500 mb-4">Check back later or invite friends to join the platform</p>
                  <button className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                    Invite Friends
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        {selectedProfile && (
          <ProfileModal 
            profile={selectedProfile}
            currentUserId={auth.currentUser?.uid}
            onClose={() => setSelectedProfile(null)}
            onSendRequest={handleSendRequest}
            connections={connections}
            pendingRequests={pendingRequests}
          />
        )}
      </div>
    </FirestoreErrorBoundary>
  );
}

const ProfileCard = ({ 
  profile, 
  onSelect, 
  onSendRequest, 
  isMatch, 
  connections, 
  pendingRequests 
}: {
  profile: UserProfile;
  onSelect: (profile: UserProfile) => void;
  onSendRequest: (userId: string) => void;
  isMatch: boolean;
  connections: Connection[];
  pendingRequests: Request[];
}) => {
  const isConnected = connections.some(conn => 
    (conn.user1Id === auth.currentUser?.uid && conn.user2Id === profile.id) ||
    (conn.user2Id === auth.currentUser?.uid && conn.user1Id === profile.id)
  );

  const isRequestPending = pendingRequests.some(request => 
    request.toUserId === profile.id
  );

  return (
    <div 
      className={`bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-t-4 ${isMatch ? 'border-blue-500' : 'border-purple-500'}`}
      onClick={() => onSelect(profile)}
    >
      <div className="p-6">
        <div className="flex items-center mb-4">
          <div className={`w-16 h-16 rounded-full overflow-hidden mr-4 flex items-center justify-center ${!profile.profilePic ? (isMatch ? 'bg-blue-100' : 'bg-purple-100') : ''}`}>
            {profile.profilePic ? (
              <img 
                src={profile.profilePic} 
                alt={`${profile.firstName} ${profile.lastName}`} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/default-profile.png';
                }}
              />
            ) : (
              <svg className={`h-8 w-8 ${isMatch ? 'text-blue-500' : 'text-purple-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{profile.firstName} {profile.lastName}</h3>
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={`h-4 w-4 ${i < Math.floor(profile.rating) ? 'text-yellow-400' : 'text-gray-300'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="ml-1 text-sm text-gray-600">
                {(profile.rating || 0).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Skills Offered:</h4>
          <div className="flex flex-wrap gap-1">
            {profile.skillsOffered.slice(0, 3).map((skill) => (
              <span key={skill} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                {skill}
              </span>
            ))}
            {profile.skillsOffered.length > 3 && (
              <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                +{profile.skillsOffered.length - 3}
              </span>
            )}
          </div>
        </div>
        
        {isMatch && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-500 mb-1">Skills Wanted (Matches Yours):</h4>
            <div className="flex flex-wrap gap-1">
              {profile.skillsWanted.slice(0, 3).map((skill) => (
                <span key={skill} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                  {skill}
                </span>
              ))}
              {profile.skillsWanted.length > 3 && (
                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                  +{profile.skillsWanted.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
        
        {isConnected ? (
          <button
            disabled
            className="w-full mt-4 py-2 px-4 rounded-lg font-medium bg-gray-100 text-gray-500 cursor-not-allowed"
          >
            Connected
          </button>
        ) : isRequestPending ? (
          <button
            disabled
            className="w-full mt-4 py-2 px-4 rounded-lg font-medium bg-gray-100 text-gray-500 cursor-not-allowed"
          >
            Request Pending
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSendRequest(profile.id);
            }}
            className={`w-full mt-4 py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
              isMatch 
                ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg' 
                : 'bg-white text-purple-600 border border-purple-500 hover:bg-purple-50'
            }`}
          >
            {isMatch ? 'Send Request' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  );
};

const ProfileModal = ({
  profile,
  currentUserId,
  onClose,
  onSendRequest,
  connections,
  pendingRequests
}: {
  profile: UserProfile;
  currentUserId?: string;
  onClose: () => void;
  onSendRequest: (userId: string) => void;
  connections: Connection[];
  pendingRequests: Request[];
}) => {
  const isConnected = connections.some(conn => 
    (conn.user1Id === currentUserId && conn.user2Id === profile.id) ||
    (conn.user2Id === currentUserId && conn.user1Id === profile.id)
  );

  const isRequestPending = pendingRequests.some(request => 
    request.toUserId === profile.id
  );

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 overflow-hidden mr-4 flex items-center justify-center">
                {profile.profilePic ? (
                  <img 
                    src={profile.profilePic} 
                    alt={`${profile.firstName} ${profile.lastName}`} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/default-profile.png';
                    }}
                  />
                ) : (
                  <svg className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">{profile.firstName} {profile.lastName}</h2>
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`h-5 w-5 ${i < Math.floor(profile.rating) ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="ml-1 text-gray-600">
                    {(profile.rating || 0).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Contact Information</h3>
            <div className="flex items-center text-gray-600">
              <svg className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p>{profile.email}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Skills Offered</h3>
            <div className="flex flex-wrap gap-2">
              {profile.skillsOffered.map((skill) => (
                <span key={skill} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Skills Wanted</h3>
            <div className="flex flex-wrap gap-2">
              {profile.skillsWanted.map((skill) => (
                <span key={skill} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {isConnected ? (
            <button
              disabled
              className="w-full bg-gray-200 text-gray-600 py-3 px-4 rounded-lg cursor-not-allowed"
            >
              Already Connected
            </button>
          ) : isRequestPending ? (
            <button
              disabled
              className="w-full bg-gray-200 text-gray-600 py-3 px-4 rounded-lg cursor-not-allowed"
            >
              Request Already Sent
            </button>
          ) : (
            <button
              onClick={() => {
                onSendRequest(profile.id);
                onClose();
              }}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-4 rounded-lg shadow-md transition-all duration-300 hover:shadow-lg"
            >
              Send Swap Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
};