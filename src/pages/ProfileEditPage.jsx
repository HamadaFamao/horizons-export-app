import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { updateUserProfile, fetchUserProfile, interestsToString } from '@/lib/profileUtils';
import CountrySelect from '@/components/CountrySelect';
import CountryDisplay from '@/components/CountryDisplay';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ProfileEditPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '',
    living_in_code: '',
    from_code: '',
    occupation: '',
    marital_status: '',
    lookingfor: '',
    bio: '',
    interests: '',
  });

  // Load profile
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          navigate('/auth');
          return;
        }

        setCurrentUser(user);

        // Fetch profile using utility
        const profileData = await fetchUserProfile(user.id);
        
        if (profileData) {
          // Clean up any legacy URL data in codes
          let livingInCode = profileData.living_in_code || profileData.country || '';
          let fromCode = profileData.from_code || profileData.from_country || '';

          if (livingInCode && livingInCode.includes('flagcdn')) {
            const match = livingInCode.match(/\/([a-z]{2})\.png/i);
            if (match) livingInCode = match[1].toUpperCase();
          }
          if (fromCode && fromCode.includes('flagcdn')) {
            const match = fromCode.match(/\/([a-z]{2})\.png/i);
            if (match) fromCode = match[1].toUpperCase();
          }

          setFormData({
            name: profileData.name || '',
            age: profileData.age || '',
            gender: profileData.gender || '',
            living_in_code: livingInCode,
            from_code: fromCode,
            occupation: profileData.occupation || '',
            marital_status: profileData.marital_status || '',
            lookingfor: profileData.lookingfor || '',
            bio: profileData.bio || '',
            // Convert interests array to string for editing
            interests: interestsToString(profileData.interests),
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setErrorMessage("Failed to load profile data. Please try refreshing.");
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  // Handle form input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle select change
  const handleSelectChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle save
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      if (!formData.name?.trim()) {
        setErrorMessage('Name is required.');
        setSaving(false);
        return;
      }

      if (!currentUser?.id) {
        setErrorMessage('User not authenticated');
        setSaving(false);
        return;
      }

      // Prepare data for update
      // Note: We don't need to manually clean here because updateUserProfile does it via normalizeProfileData
      const updates = {
        ...formData,
        // Ensure backward compatibility for legacy fields if needed, 
        // but rely on code fields primarily
        country: formData.living_in_code, // Legacy sync
        living_in: formData.living_in_code, // Legacy sync
      };

      // Use the utility function to update profile
      const { error: updateError } = await updateUserProfile(
        currentUser.id,
        updates
      );

      if (updateError) throw new Error(updateError);

      setSuccessMessage('Profile updated successfully');
      toast({
        title: "Success",
        description: "Profile updated successfully!",
        className: "bg-green-50 border-green-200"
      });

      // Reload profile data to confirm save and standardized formatting
      const updatedProfile = await fetchUserProfile(currentUser.id);
      if (updatedProfile) {
        setFormData(prev => ({
          ...prev,
          interests: interestsToString(updatedProfile.interests),
        }));
      }

      setTimeout(() => {
        navigate('/profile');
      }, 1500);

    } catch (error) {
      console.error('❌ Save failed:', error);
      setErrorMessage(error?.message || 'Failed to update profile');
      toast({
        title: "Error",
        description: error?.message || 'Failed to update profile',
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.24))]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-8 md:pb-0">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate('/profile')}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <ArrowLeft size={24} className="text-gray-700" />
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Edit Profile</h1>
          </div>

          {/* Success/Error Messages */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
              <Check size={20} /> {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
              <AlertCircle size={20} /> {errorMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-6">
            {/* Name */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                required
              />
            </div>

            {/* Living In */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Living In
              </label>
              <CountrySelect
                value={formData.living_in_code}
                onChange={(value) => handleSelectChange('living_in_code', value)}
                placeholder="Select country…"
              />
              {formData.living_in_code && (
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <CountryDisplay code={formData.living_in_code} prefix="Preview:" />
                </div>
              )}
            </div>

            {/* From */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                From
              </label>
              <CountrySelect
                value={formData.from_code}
                onChange={(value) => handleSelectChange('from_code', value)}
                placeholder="Select country…"
              />
              {formData.from_code && (
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <CountryDisplay code={formData.from_code} prefix="Preview:" />
                </div>
              )}
            </div>

            {/* Age, Gender, Occupation, etc. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Age</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  min="18"
                  max="120"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={(e) => handleSelectChange('gender', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Bio */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows="4"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
                placeholder="Tell us about yourself..."
              />
            </div>

             {/* Interests */}
             <div className="bg-white rounded-2xl shadow-lg p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Interests</label>
              <input
                type="text"
                name="interests"
                value={formData.interests}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="Separate with commas (e.g. travel, cooking, hiking)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter interests separated by commas
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                onClick={() => navigate('/profile')}
                variant="outline"
                className="flex-1 h-12 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-xl"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}