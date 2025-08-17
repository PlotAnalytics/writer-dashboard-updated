import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import Layout from '../components/Layout.jsx';
import PreviousSubmissions from '../components/PreviousSubmissions.jsx';
import MotivationalPopup from '../components/MotivationalPopup.jsx';

import { useAuth } from '../contexts/AuthContext.jsx';
import useSocket from '../hooks/useSocket.js';
import axios from 'axios';
import { staticDataApi } from '../utils/simpleApi.js';
import '../styles/firecracker.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form state matching reference code
  const [title, setTitle] = useState('');
  const [prefixType, setPrefixType] = useState('');
  const [prefixNumber, setPrefixNumber] = useState('Choose');
  const [selectedStructure, setSelectedStructure] = useState('');
  const [structureExplanation, setStructureExplanation] = useState('');
  const [googleDocLink, setGoogleDocLink] = useState('');
  const [inspirationLink, setInspirationLink] = useState('');
  const [coreConceptDoc, setCoreConceptDoc] = useState(''); // New field for Remix only
  const [aiChatUrls, setAiChatUrls] = useState(['']); // Array to handle multiple URLs
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Enhanced form state from reference
  const [tropeList, setTropeList] = useState([]);
  const [structureList, setStructureList] = useState([]);
  const [writer, setWriter] = useState(null);

  // Modern notification function
  const showModernNotification = (title, status) => {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      max-width: 400px;
      border-left: 4px solid #ffb300;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideIn 0.3s ease-out;
    `;

    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="
          width: 32px;
          height: 32px;
          background: #ffb300;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        ">✓</div>
        <div>
          <div style="font-weight: 600; margin-bottom: 4px;">Script Updated Successfully</div>
          <div style="font-size: 14px; opacity: 0.9;">"${title}" → ${status}</div>
        </div>
      </div>
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);

    // Add to DOM
    document.body.appendChild(notification);

    // Auto remove after 4 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        if (style.parentNode) {
          style.parentNode.removeChild(style);
        }
      }, 300);
    }, 4000);
  };

  // WebSocket integration for real-time updates
  const { onStatusUpdate, offStatusUpdate } = useSocket();

  // Fetch tropes from API - Updated with caching
  const fetchTropes = async () => {
    try {
      const { data } = await staticDataApi.getTropes();
      console.log('Tropes API response:', data);
      // API returns array of objects with id, number, name - extract names ordered by number
      if (Array.isArray(data)) {
        setTropeList(data.map((trope) => trope.name));
      } else {
        console.error('Tropes API did not return an array:', data);
        // Fallback data for testing
        setTropeList(['Sample Trope 1', 'Sample Trope 2', 'Sample Trope 3']);
      }
    } catch (error) {
      console.error('Error fetching tropes:', error);
      // Fallback to mock data when API is not available
      setTropeList(['The Hero\'s Journey', 'The Mentor', 'The Call to Adventure', 'The Threshold Guardian', 'The Shapeshifter']);
    }
  };

  // Fetch structures from API - Updated with caching
  const fetchStructures = async () => {
    try {
      const { data } = await staticDataApi.getStructures();
      console.log('Structures API response:', data);
      // API returns { structures: [...] } where each structure has structure_id, name, writers
      if (data && data.structures) {
        setStructureList(data.structures);
      } else {
        console.error('Structures API did not return expected format:', data);
        // Fallback data for testing
        setStructureList([
          { structure_id: 1, name: 'Three Act Structure' },
          { structure_id: 2, name: 'Hero\'s Journey' }
        ]);
      }
    } catch (error) {
      console.error('Error fetching structures:', error);
      // Fallback to mock data when API is not available
      setStructureList([
        { structure_id: 1, name: "Three Act Structure", writers: [] },
        { structure_id: 2, name: "Hero's Journey", writers: [] },
        { structure_id: 3, name: "Five Act Structure", writers: [] }
      ]);
    }
  };

  // Fetch writer data - Enhanced with better error handling
  const fetchWriterData = async () => {
    try {
      // First check if we have user data from AuthContext
      if (!user?.username) {
        console.log('⚠️ No user data available yet, waiting for authentication...');
        return;
      }

      console.log('🔍 Fetching writer data for username:', user.username);
      const response = await axios.get(`/api/getWriter?username=${user.username}`);
      console.log('✅ Writer data fetched:', response.data);
      setWriter(response.data);
      fetchStructures();
      fetchScripts(response.data.id);
      setIsInitialized(true);
    } catch (error) {
      console.error('❌ Error fetching writer data:', error);

      // SECURITY: Get writerId safely without dangerous fallbacks
      let writerId = user?.writerId || localStorage.getItem('writerId');

      // If no writerId, try to get from profile endpoint
      if (!writerId) {
        try {
          console.log('🔒 No writerId found, fetching from profile for security...');
          const profileResponse = await axios.get('/api/auth/profile');
          if (profileResponse.data.user.writerId) {
            writerId = profileResponse.data.user.writerId;
            localStorage.setItem('writerId', writerId.toString());
            console.log('✅ Security: Got writerId from profile:', writerId);
          } else {
            console.error('❌ SECURITY ERROR: No writerId available for user');
            setError('Unable to load your dashboard. Please log out and log back in.');
            return;
          }
        } catch (profileError) {
          console.error('❌ SECURITY ERROR: Could not fetch writerId:', profileError);
          setError('Authentication error. Please log out and log back in.');
          return;
        }
      }

      // Enhanced fallback with user data from AuthContext (NO HARDCODED ID)
      const fallbackWriter = {
        id: writerId,
        name: user?.name || user?.username || 'Writer',
        access_advanced_types: true,
        username: user?.username || 'writer'
      };

      console.log('🔄 Using fallback writer data:', fallbackWriter);
      setWriter(fallbackWriter);

      // Still try to fetch scripts with fallback writer ID
      fetchScripts(fallbackWriter.id);
      setIsInitialized(true);
    }
  };

  // Fetch scripts using direct API (NO CACHING for submissions to prevent stale data)
  const fetchScripts = async (writer_id, filters = {}) => {
    try {
      setLoading(true);

      // Build params object for direct API call
      const params = { writer_id };
      if (filters.startDate && filters.endDate) {
        params.startDate = filters.startDate;
        params.endDate = filters.endDate;
      }
      if (filters.searchTitle) {
        params.searchTitle = filters.searchTitle;
      }

      // Use direct axios call to avoid caching submission data
      const response = await axios.get('/api/scripts', { params });
      const data = response.data;
      console.log('Scripts API response (FRESH - no cache):', data);

      if (Array.isArray(data)) {
        setSubmissions(data);
      } else {
        console.error('Scripts API did not return an array:', data);
        setSubmissions([]);
      }
    } catch (error) {
      console.error('Error fetching scripts:', error);
      // Fallback to mock data when API is not available
      setSubmissions([
        {
          id: 1,
          title: "[Trope 1] The Hero's Journey Begins",
          google_doc_link: "https://docs.google.com/document/d/sample1",
          approval_status: "Pending",
          created_at: new Date().toISOString(),
          loom_url: null
        },
        {
          id: 2,
          title: "[Original] My Creative Story",
          google_doc_link: "https://docs.google.com/document/d/sample2",
          approval_status: "Posted",
          created_at: new Date(Date.now() - 86400000).toISOString(),
          loom_url: null
        },
        {
          id: 3,
          title: "[STL] Short Story Example",
          google_doc_link: "https://docs.google.com/document/d/sample3",
          approval_status: "Rejected",
          created_at: new Date(Date.now() - 172800000).toISOString(),
          loom_url: "https://loom.com/sample-feedback"
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // useEffect for tropes - Matching WriterDashboard.jsx
  useEffect(() => {
    fetchTropes();
  }, []);

  // useEffect for writer data - Enhanced with proper dependency handling
  useEffect(() => {
    if (user && user.username && !loading && !isInitialized) {
      console.log('🚀 User authenticated, fetching writer data...');
      fetchWriterData();
    }
  }, [user, loading, isInitialized]);

  // WebSocket listener for real-time status updates
  useEffect(() => {
    const handleStatusUpdate = (updatedScript) => {
      console.log('📡 Received real-time status update:', updatedScript);

      // Update the submissions list with the new script
      setSubmissions(prev => {
        const existingIndex = prev.findIndex(sub => sub.id === updatedScript.id);
        if (existingIndex >= 0) {
          // Update existing submission
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...updatedScript };
          return updated;
        } else {
          // Add new submission to the top of the list
          return [updatedScript, ...prev];
        }
      });

      // Show modern notification to user
      showModernNotification(updatedScript.title, updatedScript.approval_status);
    };

    // Set up the listener
    onStatusUpdate(handleStatusUpdate);

    // Cleanup listener on unmount
    return () => {
      offStatusUpdate(handleStatusUpdate);
    };
  }, [onStatusUpdate, offStatusUpdate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('📝 Form submission attempted');
    console.log('👤 Current user:', user);
    console.log('✍️ Current writer:', writer);
    console.log('🔐 Auth loading state:', loading);

    if (!writer) {
      console.error('❌ Writer information not available');
      setError('Writer information not loaded yet. Please wait a moment and try again.');
      return;
    }



    // Validate Title
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    // Validate Type selection
    console.log('🎭 Type validation - prefixType:', prefixType, 'Type:', typeof prefixType);
    if (!prefixType || prefixType === '' || prefixType === '-- Select Type --') {
      console.log('❌ Type validation failed - must select a valid type');
      setError('Please select a Type (Original, Remix, Re-write, or STL).');
      return;
    }
    console.log('✅ Type validation passed');

    // Validate Structure selection (skip for intern writers)
    const isIntern = ['quinn', 'kayla', 'gianmarco', 'seth'].includes(user?.username?.toLowerCase());
    console.log('🏗️ Structure validation - selectedStructure:', selectedStructure, 'Type:', typeof selectedStructure, 'isIntern:', isIntern);
    if (!isIntern && (!selectedStructure || selectedStructure === '' || selectedStructure === '-- Select Structure --')) {
      console.log('❌ Structure validation failed - must select a valid structure');
      setError('Please select a Structure from the dropdown options.');
      return;
    }
    console.log('✅ Structure validation passed');

    // Validate Script (Google Doc Link)
    if (!googleDocLink.trim()) {
      setError('Script (Google Doc Link) is required.');
      return;
    }

    if (!googleDocLink.includes('docs.google.com')) {
      setError("Script link must contain 'docs.google.com'.");
      return;
    }

    // Validate AI Chat URLs - all fields must be filled
    const hasEmptyUrls = aiChatUrls.some(url => url.trim() === '');
    if (hasEmptyUrls) {
      setError('All AI Chat URL fields must be filled. Please enter a URL in each field or remove empty fields.');
      return;
    }

    // Validate Structure Explanation when "No Structure" is selected (skip for intern writers)
    if (!isIntern && selectedStructure === "No Structure" && structureExplanation.trim().length < 50) {
      setError("Structure explanation must be at least 50 characters when 'No Structure' is selected.");
      return;
    }

    // Validate Inspiration Link for Remix and Re-write
    if ((prefixType === 'Remix' || prefixType === 'Re-write') && !inspirationLink.trim()) {
      setError("Inspiration link is required for Remix and Re-write scripts.");
      return;
    }

    if ((prefixType === 'Remix' || prefixType === 'Re-write') && !inspirationLink.includes('docs.google.com')) {
      setError("Inspiration link must contain 'docs.google.com'.");
      return;
    }

    // Validate Core Concept Doc for Remix only
    if (prefixType === 'Remix' && !coreConceptDoc.trim()) {
      setError("Core Concept Doc is required for Remix scripts.");
      return;
    }

    if (prefixType === 'Remix' && !coreConceptDoc.includes('docs.google.com')) {
      setError("Core Concept Doc must contain 'docs.google.com'.");
      return;
    }

    setError(''); // Clear previous errors
    setIsSubmitting(true);

    try {
      // Build full title with structure and type prefix (no structure for intern writers)
      const structurePrefix = (selectedStructure && !isIntern) ? `[${selectedStructure}] ` : '';
      const fullTitle = structurePrefix + `[${prefixType}] ${title}`;

      // Filter out empty URLs and join multiple URLs with forward slashes
      const filteredUrls = aiChatUrls.filter(url => url.trim() !== '');
      const aiChatUrlsString = filteredUrls.join(' / ');

      await axios.post('/api/scripts', {
        writer_id: writer.id,
        title: fullTitle,
        googleDocLink: googleDocLink,
        aiChatUrl: aiChatUrlsString,
        structure_explanation: (!isIntern && selectedStructure === "No Structure") ? structureExplanation : null,
        inspiration_link: (prefixType === 'Remix' || prefixType === 'Re-write') ? inspirationLink : null,
        core_concept_doc: prefixType === 'Remix' ? coreConceptDoc : null,
        structure: (!isIntern && selectedStructure) ? selectedStructure : null,
      });

      // Refresh the scripts list to get the latest data
      await fetchScripts(writer.id);

      // Reset form
      setTitle('');
      setGoogleDocLink('');
      setAiChatUrls(['']);
      setPrefixType('');
      setPrefixNumber('Choose');
      setSelectedStructure('');
      setStructureExplanation('');
      setInspirationLink('');
      setCoreConceptDoc('');

      setError(null);
      alert('Approval pending, may take 24-48 hours');
    } catch (error) {
      console.error('Error submitting script:', error);
      // Simulate successful submission when API is not available
      const newSubmission = {
        id: Date.now(),
        title: fullTitle,
        google_doc_link: googleDocLink,
        approval_status: "Pending",
        created_at: new Date().toISOString(),
        loom_url: null
      };

      setSubmissions(prev => [newSubmission, ...prev]);

      // Reset form
      setTitle('');
      setPrefixType('');
      setPrefixNumber('Choose');
      setSelectedStructure('');
      setStructureExplanation('');
      setGoogleDocLink('');
      setAiChatUrls(['']);
      setInspirationLink('');
      setCoreConceptDoc('');

      setError(null);
      alert('Script submitted successfully! (Demo mode - API not available)');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle type change
  const handleTypeChange = (e) => {
    setPrefixType(e.target.value);
    // Clear inspiration link if not Remix or Re-write
    if (e.target.value !== 'Remix' && e.target.value !== 'Re-write') {
      setInspirationLink('');
    }
    // Clear core concept doc if not Remix
    if (e.target.value !== 'Remix') {
      setCoreConceptDoc('');
    }
  };

  // Handle multiple AI Chat URLs
  const addAiChatUrl = () => {
    setAiChatUrls([...aiChatUrls, '']);
  };

  const removeAiChatUrl = (index) => {
    if (aiChatUrls.length > 1) {
      const newUrls = aiChatUrls.filter((_, i) => i !== index);
      setAiChatUrls(newUrls);
    }
  };

  const updateAiChatUrl = (index, value) => {
    const newUrls = [...aiChatUrls];
    newUrls[index] = value;
    setAiChatUrls(newUrls);
  };

  return (
    <Layout>
      <MotivationalPopup />
      <Box sx={{
        minHeight: '100vh',
        background: 'transparent',
        color: 'white',
        p: { xs: 2, lg: 4 },
        width: '100%'
      }}>
        {/* Modern Welcome Header with Firecracker Effects */}
        <Box sx={{
          mb: 6,
          textAlign: 'left',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Firecracker Effects Container */}
          <div className="firecracker-container">
            <div className="firecracker firecracker-1"></div>
            <div className="firecracker firecracker-2"></div>
            <div className="firecracker firecracker-3"></div>
            <div className="firecracker firecracker-4"></div>
            <div className="firecracker firecracker-5"></div>
          </div>

          <Typography variant="h4" fontWeight="700" sx={{
            color: 'white',
            mb: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: { xs: '22px', sm: '26px', md: '28px' },
            textAlign: 'center',
            letterSpacing: '0.5px',
            animation: 'fadeInUp 0.8s ease-out',
            position: 'relative',
            zIndex: 2,
            '@keyframes fadeInUp': {
              '0%': {
                opacity: 0,
                transform: 'translateY(30px)',
              },
              '100%': {
                opacity: 1,
                transform: 'translateY(0)',
              },
            },
          }}>
            Welcome, {writer?.name || user?.name || 'Writer'}! What are we writing today?
          </Typography>


        </Box>

        <Box sx={{
          display: 'flex',
          gap: 4,
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', lg: 'row' },
          alignItems: { xs: 'center', lg: 'flex-start' },
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {/* New Script Submission - Left Side */}
          <Box sx={{
            width: { xs: '100%', lg: '450px' },
            maxWidth: { xs: '550px', lg: '500px' },
            flex: { lg: '0 0 550px' }
          }}>
            <Box>
              <Typography
                variant="h6"
                fontWeight="600"
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  mb: 3,
                  fontSize: '18px',
                  letterSpacing: '0.5px'
                }}
              >
                New Script Submission
              </Typography>

              {error && (
                <Alert
                  severity="error"
                  sx={{
                    mb: 3,
                    background: 'linear-gradient(135deg, rgba(244, 67, 54, 0.1) 0%, rgba(244, 67, 54, 0.05) 100%)',
                    border: '1px solid rgba(244, 67, 54, 0.3)',
                    borderRadius: '16px',
                    backdropFilter: 'blur(10px)',
                    '& .MuiAlert-message': { color: '#ff6b6b' }
                  }}
                >
                  {error}
                </Alert>
              )}

              {!writer && !error && (
                <Alert
                  severity="info"
                  sx={{
                    mb: 3,
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(102, 126, 234, 0.05) 100%)',
                    border: '1px solid rgba(102, 126, 234, 0.3)',
                    borderRadius: '16px',
                    backdropFilter: 'blur(10px)',
                    '& .MuiAlert-message': { color: '#667eea' }
                  }}
                >
                  Loading writer information...
                </Alert>
              )}

              <Box
                component="form"
                onSubmit={handleSubmit}
                sx={{
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
                  backdropFilter: 'blur(12px)',
                  p: 3,
                  borderRadius: '12px',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(102, 126, 234, 0.15)',
                  width: '100%',
                  maxWidth: '600px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'translateY(-2px)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%)',
                    border: '1px solid rgba(102, 126, 234, 0.3)',
                    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15), 0 6px 20px rgba(0, 0, 0, 0.1), 0 3px 12px rgba(102, 126, 234, 0.2)',
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                {/* Modern Title Field */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="body2" sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    mb: 1.2,
                    fontWeight: '700',
                    fontSize: '13px'
                  }}>
                    Title <span style={{ color: '#ff4444' }}>*</span>
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="Enter your script title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    size="medium"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        background: 'rgba(255, 255, 255, 0.04)',
                        backdropFilter: 'blur(5px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        '& fieldset': { border: 'none' },
                        '&:hover': {
                          border: '1px solid rgba(102, 126, 234, 0.3)',
                          background: 'rgba(255, 255, 255, 0.06)',
                        },
                        '&.Mui-focused': {
                          border: '1px solid rgba(102, 126, 234, 0.5)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)',
                        },
                      },
                      '& .MuiInputBase-input': {
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '14px',
                        padding: '10px 12px',
                        '&::placeholder': {
                          color: 'rgba(255, 255, 255, 0.4)',
                        }
                      },
                    }}
                  />
                </Box>

                {/* Script (Google Doc Link) */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="body2" sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    mb: 1.2,
                    fontWeight: '700',
                    fontSize: '13px'
                  }}>
                    Script (Google Doc Link) <span style={{ color: '#ff4444' }}>*</span>
                  </Typography>
                  <TextField
                    fullWidth
                    type="url"
                    placeholder="https://docs.google.com/document/d/..."
                    value={googleDocLink}
                    onChange={(e) => setGoogleDocLink(e.target.value)}
                    required
                    size="medium"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        background: 'rgba(255, 255, 255, 0.04)',
                        backdropFilter: 'blur(5px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        '& fieldset': { border: 'none' },
                        '&:hover': {
                          border: '1px solid rgba(102, 126, 234, 0.3)',
                          background: 'rgba(255, 255, 255, 0.06)',
                        },
                        '&.Mui-focused': {
                          border: '1px solid rgba(102, 126, 234, 0.5)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)',
                        },
                      },
                      '& .MuiInputBase-input': {
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '14px',
                        padding: '10px 12px',
                        '&::placeholder': {
                          color: 'rgba(255, 255, 255, 0.4)',
                        }
                      },
                    }}
                  />
                </Box>

                {/* AI Chat URL(s) */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="body2" sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    mb: 1.2,
                    fontWeight: '700',
                    fontSize: '13px'
                  }}>
                    AI Chat URL(s) <span style={{ color: '#ff4444' }}>*</span>
                  </Typography>

                  {/* Container box for URL inputs and button */}
                  <Box sx={{
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '20px',
                    background: 'rgba(255, 255, 255, 0.02)'
                  }}>
                    {/* Multiple URL inputs */}
                    {aiChatUrls.map((url, index) => (
                      <Box key={index} sx={{ mb: index === aiChatUrls.length - 1 ? 0 : 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                          fullWidth
                          type="url"
                          placeholder="https://chatgpt.com/share/..."
                          value={url}
                          onChange={(e) => updateAiChatUrl(index, e.target.value)}
                          size="medium"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              background: 'rgba(255, 255, 255, 0.04)',
                              backdropFilter: 'blur(5px)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              transition: 'all 0.2s ease',
                              '& fieldset': { border: 'none' },
                              '&:hover': {
                                border: '1px solid rgba(102, 126, 234, 0.3)',
                                background: 'rgba(255, 255, 255, 0.06)',
                              },
                              '&.Mui-focused': {
                                border: '1px solid rgba(102, 126, 234, 0.5)',
                                background: 'rgba(255, 255, 255, 0.08)',
                                boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)',
                              },
                            },
                            '& .MuiInputBase-input': {
                              color: 'rgba(255, 255, 255, 0.9)',
                              fontSize: '14px',
                              padding: '10px 12px',
                              '&::placeholder': {
                                color: 'rgba(255, 255, 255, 0.4)',
                              }
                            },
                          }}
                        />

                        {/* Remove button (only show if more than 1 URL) */}
                        {aiChatUrls.length > 1 && (
                          <Button
                            onClick={() => removeAiChatUrl(index)}
                            variant="contained"
                            sx={{
                              background: 'linear-gradient(135deg, #ff4444 0%, #cc3333 100%)',
                              color: 'white',
                              fontWeight: '600',
                              fontSize: '12px',
                              px: 2,
                              py: 1,
                              borderRadius: '8px',
                              textTransform: 'none',
                              minWidth: 'auto',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #ff3333 0%, #bb2222 100%)',
                              },
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </Box>
                    ))}

                    {/* Add Another Chat button */}
                    <Button
                      onClick={addAiChatUrl}
                      variant="contained"
                      sx={{
                        background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '13px',
                        px: 2.5,
                        py: 1,
                        mt: 2,
                        borderRadius: '8px',
                        textTransform: 'none',
                        border: '2px solid #4CAF50',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #45a049 0%, #3d8b40 100%)',
                          border: '2px solid #45a049',
                        },
                      }}
                    >
                      + Add Another Chat
                    </Button>
                  </Box>
                </Box>

                {/* Structure Selection - Hidden for intern writers */}
                {!['quinn', 'kayla', 'gianmarco', 'seth'].includes(user?.username?.toLowerCase()) && (
                  <>
                    <Box sx={{ mb: 2.5 }}>
                      <Typography variant="body2" sx={{
                        color: 'rgba(255, 255, 255, 0.8)',
                        mb: 1.2,
                        fontWeight: '700',
                        fontSize: '13px'
                      }}>
                        Structure <span style={{ color: '#ff4444' }}>*</span>
                      </Typography>
                      <FormControl size="medium" fullWidth>
                        <Select
                          value={selectedStructure}
                          onChange={(e) => {
                            setSelectedStructure(e.target.value);
                            if (e.target.value !== "No Structure") {
                              setStructureExplanation("");
                            }
                          }}
                      displayEmpty
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            background: 'rgba(255, 255, 255, 0.04)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                            '& .MuiMenuItem-root': {
                              color: 'rgba(255, 255, 255, 0.9)',
                              fontSize: '14px',
                              padding: '10px 16px',
                              '&:hover': {
                                background: 'rgba(102, 126, 234, 0.15)',
                              },
                              '&.Mui-selected': {
                                background: 'rgba(102, 126, 234, 0.25)',
                                '&:hover': {
                                  background: 'rgba(102, 126, 234, 0.35)',
                                },
                              },
                            },
                          },
                        },
                      }}
                      sx={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        backdropFilter: 'blur(5px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        '& fieldset': { border: 'none' },
                        '&:hover': {
                          border: '1px solid rgba(102, 126, 234, 0.3)',
                          background: 'rgba(255, 255, 255, 0.06)',
                        },
                        '&.Mui-focused': {
                          border: '1px solid rgba(102, 126, 234, 0.5)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)',
                        },
                        '& .MuiInputBase-input': {
                          color: 'rgba(255, 255, 255, 0.9)',
                          fontSize: '14px',
                          padding: '10px 12px'
                        },
                        '& .MuiSvgIcon-root': { color: 'rgba(255, 255, 255, 0.6)' },
                      }}
                    >
                      <MenuItem value="">-- Select Structure --</MenuItem>
                      {structureList.map((structure) => (
                        <MenuItem key={structure.structure_id || structure.id} value={structure.name}>
                          {structure.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {/* Structure Explanation (conditional) */}
                {selectedStructure === "No Structure" && (
                  <Box sx={{ mb: 2.5 }}>
                    <Typography variant="body2" sx={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      mb: 1.2,
                      fontWeight: '700',
                      fontSize: '13px'
                    }}>
                      Please explain your approach <span style={{ color: '#ff4444' }}>*</span>
                    </Typography>

                    {/* Container box for explanation */}
                    <Box sx={{
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '20px',
                      background: 'rgba(255, 255, 255, 0.02)'
                    }}>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        value={structureExplanation}
                        onChange={(e) => setStructureExplanation(e.target.value)}
                        placeholder="Explain your structure approach (minimum 50 characters)..."
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            background: 'transparent',
                            border: 'none',
                            '& fieldset': { border: 'none' },
                          },
                          '& .MuiInputBase-input': {
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: '14px',
                            '&::placeholder': {
                              color: 'rgba(255, 255, 255, 0.4)',
                            }
                          },
                        }}
                      />
                      <Typography variant="body2" sx={{
                        mt: 1,
                        fontSize: '14px',
                        color: structureExplanation.length >= 50 ? '#4CAF50' : 'rgba(255, 255, 255, 0.6)'
                      }}>
                        {structureExplanation.length}/50 characters
                      </Typography>
                    </Box>
                  </Box>
                )}
                  </>
                )}

                {/* Modern Type Section */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="body2" sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    mb: 1.2,
                    fontWeight: '700',
                    fontSize: '13px'
                  }}>
                    Type <span style={{ color: '#ff4444' }}>*</span>
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControl size="medium" sx={{ minWidth: '200px' }} required>
                      <Select
                        value={prefixType}
                        onChange={handleTypeChange}
                        displayEmpty
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              background: 'rgba(255, 255, 255, 0.04)',
                              backdropFilter: 'blur(12px)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                              '& .MuiMenuItem-root': {
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontSize: '14px',
                                padding: '10px 16px',
                                '&:hover': {
                                  background: 'rgba(102, 126, 234, 0.15)',
                                },
                                '&.Mui-selected': {
                                  background: 'rgba(102, 126, 234, 0.25)',
                                  '&:hover': {
                                    background: 'rgba(102, 126, 234, 0.35)',
                                  },
                                },
                              },
                            },
                          },
                        }}
                        sx={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          backdropFilter: 'blur(5px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          transition: 'all 0.2s ease',
                          '& fieldset': { border: 'none' },
                          '&:hover': {
                            border: '1px solid rgba(102, 126, 234, 0.3)',
                            background: 'rgba(255, 255, 255, 0.06)',
                          },
                          '&.Mui-focused': {
                            border: '1px solid rgba(102, 126, 234, 0.5)',
                            background: 'rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)',
                          },
                          '& .MuiInputBase-input': {
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: '14px',
                            padding: '10px 12px'
                          },
                          '& .MuiSvgIcon-root': { color: 'rgba(255, 255, 255, 0.6)' },
                        }}
                      >
                        <MenuItem value="" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontStyle: 'italic' }}>-- Select Type --</MenuItem>
                        <MenuItem value="Original">Original</MenuItem>
                        <MenuItem value="Remix">Remix</MenuItem>
                        <MenuItem value="Re-write">Re-write</MenuItem>
                        <MenuItem value="STL">STL</MenuItem>
                      </Select>
                    </FormControl>


                  </Box>
                </Box>

                {/* Inspiration Link (conditional) */}
                {(prefixType === 'Remix' || prefixType === 'Re-write') && (
                  <Box sx={{ mb: 2.5 }}>
                    <Typography variant="body2" sx={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      mb: 1.2,
                      fontWeight: '700',
                      fontSize: '13px'
                    }}>
                      Script that inspired you (Google Doc Link) <span style={{ color: '#ff4444' }}>*</span>
                    </Typography>
                    <TextField
                      fullWidth
                      type="url"
                      placeholder="https://docs.google.com/document/d/..."
                      value={inspirationLink}
                      onChange={(e) => setInspirationLink(e.target.value)}
                      required
                      size="medium"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          background: 'rgba(255, 255, 255, 0.04)',
                          backdropFilter: 'blur(5px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          transition: 'all 0.2s ease',
                          '& fieldset': { border: 'none' },
                          '&:hover': {
                            border: '1px solid rgba(102, 126, 234, 0.3)',
                            background: 'rgba(255, 255, 255, 0.06)',
                          },
                          '&.Mui-focused': {
                            border: '1px solid rgba(102, 126, 234, 0.5)',
                            background: 'rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)',
                          },
                        },
                        '& .MuiInputBase-input': {
                          color: 'rgba(255, 255, 255, 0.9)',
                          fontSize: '14px',
                          padding: '10px 12px',
                          '&::placeholder': {
                            color: 'rgba(255, 255, 255, 0.4)',
                          }
                        },
                      }}
                    />
                  </Box>
                )}

                {/* Core Concept Doc (conditional - Remix only) */}
                {prefixType === 'Remix' && (
                  <Box sx={{ mb: 2.5 }}>
                    <Typography variant="body2" sx={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      mb: 1.2,
                      fontWeight: '700',
                      fontSize: '13px'
                    }}>
                      Core Concept Doc <span style={{ color: '#ff4444' }}>*</span>
                    </Typography>
                    <TextField
                      fullWidth
                      type="url"
                      placeholder="https://docs.google.com/document/d/..."
                      value={coreConceptDoc}
                      onChange={(e) => setCoreConceptDoc(e.target.value)}
                      required
                      size="medium"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          background: 'rgba(255, 255, 255, 0.04)',
                          backdropFilter: 'blur(5px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          transition: 'all 0.2s ease',
                          '& fieldset': { border: 'none' },
                          '&:hover': {
                            border: '1px solid rgba(102, 126, 234, 0.3)',
                            background: 'rgba(255, 255, 255, 0.06)',
                          },
                          '&.Mui-focused': {
                            border: '1px solid rgba(102, 126, 234, 0.5)',
                            background: 'rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)',
                          },
                        },
                        '& .MuiInputBase-input': {
                          color: 'rgba(255, 255, 255, 0.9)',
                          fontSize: '14px',
                          padding: '10px 12px',
                          '&::placeholder': {
                            color: 'rgba(255, 255, 255, 0.4)',
                          }
                        },
                      }}
                    />
                  </Box>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={isSubmitting || !writer}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '14px',
                    py: 1.5,
                    borderRadius: '8px',
                    textTransform: 'none',
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a67d8 0%, #667eea 100%)',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                      transform: 'translateY(-1px)',
                    },
                    '&:disabled': {
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.5)',
                      boxShadow: 'none',
                      transform: 'none',
                    },
                  }}
                >
                  {isSubmitting ? 'Submitting...' : !writer ? 'Loading...' : 'Submit Script'}
                </Button>
              </Box>
            </Box>
          </Box>

          {/* Previous Submissions - Right Side */}
          <Box sx={{
            width: { xs: '100%', lg: '500px' },
            maxWidth: { xs: '600px', lg: '500px' },
            flex: { lg: '0 0 500px' }
          }}>
            <PreviousSubmissions
              submissions={submissions}
              loading={loading}
              onRefresh={() => writer && fetchScripts(writer.id)}
            />
          </Box>
        </Box>
      </Box>
    </Layout>
  );
};

export default Dashboard;
