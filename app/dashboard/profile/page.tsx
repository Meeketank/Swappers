"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { deleteUser, signOut } from 'firebase/auth';
import DashboardHeader from '@/app/components/DashboardHeader';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// List of spam words/phrases to detect
const SPAM_WORDS = [
  'spamword1', 'spamword2', 'spamphrase', 'badword', 
  'advertisement', 'promote', 'buy now', 'click here',
  'make money', 'earn cash', 'work from home',
  'love', 'you', 'babe', 'date', 'sexy', 'hot',
  'LOL', 'haha', 'omg', 'wtf', 'damn', 'shit'
];

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    location: '',
    availability: 'weekends',
    profileType: 'private',
    email: '',
    rating: 0,
    skillsOffered: [] as string[],
    skillsWanted: [] as string[],
    profilePic: '',
  });
  const [tempSkillOffered, setTempSkillOffered] = useState('');
  const [tempSkillWanted, setTempSkillWanted] = useState('');

  // Check for spam content
  const containsSpam = (text: string) => {
    const lowerText = text.toLowerCase();
    return SPAM_WORDS.some(word => lowerText.includes(word.toLowerCase()));
  };

  // Delete account completely (auth + firestore)
  const deleteAccountCompletely = async () => {
    try {
      if (!auth.currentUser) return;

      const userId = auth.currentUser.uid;
      
      // Try to delete auth user first
      try {
        await deleteUser(auth.currentUser);
      } catch (authError: any) {
        if (authError.code === 'auth/requires-recent-login') {
          // If requires recent login, sign out and mark for deletion
          await signOut(auth);
          await setDoc(doc(db, "pending_deletions", userId), {
            userId,
            reason: 'spam content detected',
            timestamp: new Date()
          });
          throw new Error('Account deletion requires recent login. Please sign in again to complete deletion.');
        }
        throw authError;
      }

      // Delete Firestore data
      await deleteDoc(doc(db, "users", userId));

      // Redirect to home page first
      router.push('/');

      // Then show toast after a small delay
      setTimeout(() => {
        toast.error('YOUR ACCOUNT HAS BEEN DELETED DUE TO SPAM CONTENT', {
          position: "top-center",
          autoClose: 20000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
      }, 500);

    } catch (err: any) {
      console.error("Account deletion error:", err);
      router.push('/');
      setTimeout(() => {
        toast.error(err.message || 'Error during account deletion', {
          position: "top-center",
          autoClose: 10000,
        });
      }, 500);
    }
  };

  // Network status detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(typeof window !== 'undefined' ? navigator.onLine : true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG, PNG)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image size should be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setProfile({ ...profile, profilePic: event.target.result as string });
        setError('');
      }
    };
    reader.readAsDataURL(file);
  };

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!auth.currentUser) {
          router.push('/login');
          return;
        }

        const docRef = doc(db, "users", auth.currentUser.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        // Check if account is restricted
        if (data.status === 'restricted') {
          await signOut(auth);
          router.push('/');
          setTimeout(() => {
            toast.error('Your account has been restricted. Please contact support.', {
              position: "top-center",
              autoClose: false,
            });
          }, 500);
          return;
        }


          setProfile({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: auth.currentUser?.email || '',
            rating: data.rating || 0,
            location: data.location || '',
            availability: data.availability || 'weekends',
            profileType: data.profileType || 'private',
            skillsOffered: data.skillsOffered || [],
            skillsWanted: data.skillsWanted || [],
            profilePic: data.profilePic || '',
          });
        } else {
          await setDoc(docRef, {
            firstName: '',
            lastName: '',
            email: auth.currentUser?.email || '',
            rating: 0,
            location: '',
            availability: 'weekends',
            profileType: 'private',
            skillsOffered: [],
            skillsWanted: [],
            profilePic: '',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      } catch (err: any) {
        setError(`Error loading profile: ${err.message}`);
        console.error("Profile load error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleSave = async () => {
    try {
      if (!auth.currentUser) {
        router.push('/login');
        return;
      }

      // Check for spam in all text fields
      const fieldsToCheck = [
        profile.firstName,
        profile.lastName,
        profile.location,
        ...profile.skillsOffered,
        ...profile.skillsWanted
      ];

      const hasSpam = fieldsToCheck.some(field => containsSpam(field));

      if (hasSpam) {
        await deleteAccountCompletely();
        return;
      }

      await setDoc(doc(db, "users", auth.currentUser.uid), {
        ...profile,
        updatedAt: new Date(),
      }, { merge: true });

      toast.success('Profile saved successfully!', {
        position: "top-center",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
      setError('');
    } catch (err: any) {
      toast.error(`Error saving profile: ${err.message}`, {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
      console.error("Profile save error:", err);
    }
  };

  const addSkill = (type: 'offered' | 'wanted') => {
    const skill = type === 'offered' ? tempSkillOffered : tempSkillWanted;
    if (skill.trim()) {
      // Check for spam in the skill
      if (containsSpam(skill)) {
        toast.warning('This skill contains restricted content. Please use different words.', {
          position: "top-center",
          autoClose: 5000,
        });
        return;
      }

      const key = type === 'offered' ? 'skillsOffered' : 'skillsWanted';
      if (!profile[key].includes(skill)) {
        setProfile({
          ...profile,
          [key]: [...profile[key], skill],
        });
        if (type === 'offered') setTempSkillOffered('');
        else setTempSkillWanted('');
      }
    }
  };

  const removeSkill = (type: 'offered' | 'wanted', skill: string) => {
    const key = type === 'offered' ? 'skillsOffered' : 'skillsWanted';
    setProfile({
      ...profile,
      [key]: profile[key].filter(s => s !== skill),
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
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
      
      <DashboardHeader profilePic={profile.profilePic} />

      {/* Offline/Error Notifications */}
      {!isOnline && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-yellow-700">
              You're offline. Changes will be saved locally and synced when you're back online.
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 p-4">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Profile Form */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Profile Settings</h1>
          <p className="text-gray-600 mb-8">Manage your personal information and skills</p>
          
          {/* Profile Picture */}
          <div className="flex items-center mb-8">
            <div className="relative">
              {profile.profilePic ? (
                <img 
                  src={profile.profilePic} 
                  alt="Profile" 
                  className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center shadow-md">
                  <svg className="h-16 w-16 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 shadow-md transition-all text-gray-900"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
            <div className="ml-6">
              <p className="text-sm text-gray-500 mb-2">JPG, PNG (Max 2MB)</p>
              {profile.profilePic && (
                <button
                  onClick={() => setProfile({...profile, profilePic: ''})}
                  className="text-sm text-red-500 hover:text-red-700 flex items-center"
                >
                  <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove photo
                </button>
              )}
            </div>
          </div>

          {/* Personal Information */}
          {/* Personal Information */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
    <input
      type="text"
      value={profile.firstName}
      onChange={(e) => setProfile({...profile, firstName: e.target.value})}
      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900"
    />
  </div>
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
    <input
      type="text"
      value={profile.lastName}
      onChange={(e) => setProfile({...profile, lastName: e.target.value})}
      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900"
    />
  </div>
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
    <input
      type="email"
      value={profile.email}
      disabled
      className="w-full border border-gray-300 rounded-lg p-3 bg-gray-100 cursor-not-allowed text-gray-900"
    />
  </div>
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">Your Rating</label>
    <div className="flex items-center">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`h-6 w-6 ${star <= Math.round(profile.rating) ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="ml-2 text-gray-600">{profile.rating.toFixed(1)}</span>
    </div>
  </div>
  <div className="md:col-span-2">
    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
    <input
      type="text"
      value={profile.location}
      onChange={(e) => setProfile({...profile, location: e.target.value})}
      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900"
    />
  </div>
</div>

          {/* Availability */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Availability</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {['weekdays', 'weekends', 'both'].map((option) => (
                <label key={option} className="flex items-center space-x-3 bg-gray-50 hover:bg-gray-100 rounded-lg p-4 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500"
                    checked={profile.availability === option}
                    onChange={() => setProfile({...profile, availability: option})}
                  />
                  <span className="capitalize text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Profile Type */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Profile Visibility</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {['public', 'private'].map((option) => (
                <label key={option} className="flex items-center space-x-3 bg-gray-50 hover:bg-gray-100 rounded-lg p-4 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500"
                    checked={profile.profileType === option}
                    onChange={() => setProfile({...profile, profileType: option})}
                  />
                  <div>
                    <span className="block capitalize text-gray-700">{option}</span>
                    <span className="block text-xs text-gray-500 mt-1">
                      {option === 'public' ? 'Visible to all users' : 'Only visible to your connections'}
                    </span>
                    {option === 'private' && profile.profileType === 'private' && (
                      <span className="block text-xs text-blue-500 mt-1">
                        You need to make your account public so that people can view it
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Skills Offered */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Skills You Offer</h2>
            <div className="flex gap-3 mb-3">
              <input
                type="text"
                value={tempSkillOffered}
                onChange={(e) => setTempSkillOffered(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSkill('offered')}
                placeholder="Add a skill you can teach"
                className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900"
              />
              <button
                onClick={() => addSkill('offered')}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.skillsOffered.map((skill) => (
                <div key={skill} className="flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full shadow-sm">
                  <span>{skill}</span>
                  <button
                    onClick={() => removeSkill('offered', skill)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Skills Wanted */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Skills You Want to Learn</h2>
            <div className="flex gap-3 mb-3">
              <input
                type="text"
                value={tempSkillWanted}
                onChange={(e) => setTempSkillWanted(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSkill('wanted')}
                placeholder="Add a skill you want to learn"
                className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900"
              />
              <button
                onClick={() => addSkill('wanted')}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-md"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.skillsWanted.map((skill) => (
                <div key={skill} className="flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full shadow-sm">
                  <span>{skill}</span>
                  <button
                    onClick={() => removeSkill('wanted', skill)}
                    className="ml-2 text-green-600 hover:text-green-800"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all text-gray-900 shadow-lg"
            >
              Save Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}