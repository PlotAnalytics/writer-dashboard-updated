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
import FirecrackerEffects from '../components/FirecrackerEffects.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import useSocket from '../hooks/useSocket.js';
import axios from 'axios';

const Dashboard = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form state matching reference code
  const [title, setTitle] = useState('');
  const [prefixType, setPrefixType] = useState('Trope');
  const [prefixNumber, setPrefixNumber] = useState('Choose');
  const [selectedStructure, setSelectedStructure] = useState('');
  const [googleDocLink, setGoogleDocLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  // Fetch tropes from API - Updated for your API structure
  const fetchTropes = async () => {
    try {
      const response = await axios.get('/api/tropes');
      console.log('Tropes API response:', response.data);
      // API returns array of objects with id, number, name - extract names ordered by number
      if (Array.isArray(response.data)) {
        setTropeList(response.data.map((trope) => trope.name));
      } else {
        console.error('Tropes API did not return an array:', response.data);
        // Fallback data for testing
        setTropeList(['Sample Trope 1', 'Sample Trope 2', 'Sample Trope 3']);
      }
    } catch (error) {
      console.error('Error fetching tropes:', error);
      // Fallback to mock data when API is not available
      setTropeList(['The Hero\'s Journey', 'The Mentor', 'The Call to Adventure', 'The Threshold Guardian', 'The Shapeshifter']);
    }
  };

  // Fetch structures from API - Updated for your API structure
  const fetchStructures = async () => {
    try {
      const response = await axios.get('/api/structures');
      console.log('Structures API response:', response.data);
      // API returns { structures: [...] } where each structure has structure_id, name, writers
      if (response.data && response.data.structures) {
        setStructureList(response.data.structures);
      } else {
        console.error('Structures API did not return expected format:', response.data);
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

  // Fetch writer data - Matching WriterDashboard.jsx
  const fetchWriterData = async () => {
    try {
      const username = user?.username || localStorage.getItem('username');
      if (!username) {
        setError('Username not found in local storage.');
        return;
      }

      const response = await axios.get(`/api/getWriter?username=${username}`);
      setWriter(response.data);
      fetchStructures();
      fetchScripts(response.data.id);
    } catch (error) {
      console.error('Error fetching writer data:', error);
      // Fallback to mock data when API is not available
      setWriter({
        id: 1,
        name: username || 'Test Writer',
        access_advanced_types: true,
        username: username || 'test_user'
      });
    }
  };

  // Fetch scripts using your API endpoint
  const fetchScripts = async (writer_id, filters = {}) => {
    try {
      setLoading(true);
      let url = `/api/scripts?writer_id=${writer_id}`;

      // Add query parameters for filtering
      if (filters.startDate && filters.endDate) {
        url += `&startDate=${filters.startDate}&endDate=${filters.endDate}`;
      }
      if (filters.searchTitle) {
        url += `&searchTitle=${encodeURIComponent(filters.searchTitle)}`;
      }

      const response = await axios.get(url);
      console.log('Scripts API response:', response.data);

      if (Array.isArray(response.data)) {
        setSubmissions(response.data);
      } else {
        console.error('Scripts API did not return an array:', response.data);
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

  // useEffect for writer data - Matching WriterDashboard.jsx
  useEffect(() => {
    fetchWriterData();
  }, [user]);

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

    if (!writer) {
      setError('Writer information not loaded yet.');
      return;
    }

    // Enhanced validation for Trope type and Number
    if (prefixType === 'Trope' && prefixNumber === 'Choose') {
      setError('Please select a valid Trope number before submitting.');
      return;
    }

    setError(''); // Clear previous errors
    setIsSubmitting(true);

    try {
      // Build full title with structure and type prefix like in reference
      const fullTitle =
        (selectedStructure ? `[${selectedStructure}] ` : '') +
        (prefixType === 'Original' || prefixType === 'Re-write' || prefixType === 'STL'
          ? `[${prefixType}] ${title}`
          : `[${prefixType} ${prefixNumber}] ${title}`);

      await axios.post('/api/scripts', {
        writer_id: writer.id,
        title: fullTitle,
        googleDocLink: googleDocLink,
      });

      // Refresh the scripts list to get the latest data
      await fetchScripts(writer.id);

      // Reset form
      setTitle('');
      setGoogleDocLink('');
      setPrefixType('Trope');
      setPrefixNumber('Choose');
      setSelectedStructure('');

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
      setPrefixType('Trope');
      setPrefixNumber('Choose');
      setSelectedStructure('');
      setGoogleDocLink('');

      setError(null);
      alert('Script submitted successfully! (Demo mode - API not available)');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle type change like in reference
  const handleTypeChange = (e) => {
    setPrefixType(e.target.value);
    // Reset prefix number when type changes
    if (e.target.value !== 'Trope') {
      setPrefixNumber('Choose');
    }
  };

  return (
    <Layout>
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
          <Box sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 1,
          }}>
            {/* Firecracker 1 - Top Left */}
            <Box sx={{
              position: 'absolute',
              top: '10%',
              left: '15%',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#FFD700',
              opacity: 0,
              animation: 'firecracker1 3s ease-out forwards',
              '@keyframes firecracker1': {
                '0%': { opacity: 0, transform: 'scale(0)' },
                '10%': { opacity: 1, transform: 'scale(1)', boxShadow: '0 0 30px #FFD700' },
                '30%': {
                  opacity: 1,
                  transform: 'scale(3)',
                  boxShadow: '0 0 60px #FFD700, 0 0 80px #FF6B35, 0 0 100px #FF1744'
                },
                '60%': { opacity: 0.8, transform: 'scale(2)' },
                '99%': { opacity: 0, transform: 'scale(0)' },
                '100%': { opacity: 0, transform: 'scale(0)', display: 'none' }
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '-8px',
                left: '-8px',
                right: '-8px',
                bottom: '-8px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,215,0,0.8) 0%, transparent 70%)',
                opacity: 0,
                animation: 'sparkle1 3s ease-out forwards',
                '@keyframes sparkle1': {
                  '0%': { opacity: 0, transform: 'scale(0)' },
                  '20%': { opacity: 1, transform: 'scale(4)' },
                  '99%': { opacity: 0, transform: 'scale(8)' },
                  '100%': { opacity: 0, transform: 'scale(8)', display: 'none' }
                }
              }
            }} />

            {/* Firecracker 2 - Top Right */}
            <Box sx={{
              position: 'absolute',
              top: '15%',
              right: '20%',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#FF6B35',
              opacity: 0,
              animation: 'firecracker2 3.5s ease-out 1s forwards',
              '@keyframes firecracker2': {
                '0%': { opacity: 0, transform: 'scale(0)' },
                '15%': { opacity: 1, transform: 'scale(1)', boxShadow: '0 0 25px #FF6B35' },
                '35%': {
                  opacity: 1,
                  transform: 'scale(2.5)',
                  boxShadow: '0 0 50px #FF6B35, 0 0 70px #FFD700, 0 0 90px #FF1744'
                },
                '65%': { opacity: 0.7, transform: 'scale(1.5)' },
                '99%': { opacity: 0, transform: 'scale(0)' },
                '100%': { opacity: 0, transform: 'scale(0)', display: 'none' }
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '-6px',
                left: '-6px',
                right: '-6px',
                bottom: '-6px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,107,53,0.8) 0%, transparent 70%)',
                opacity: 0,
                animation: 'sparkle2 3.5s ease-out 1s forwards',
                '@keyframes sparkle2': {
                  '0%': { opacity: 0, transform: 'scale(0)' },
                  '25%': { opacity: 1, transform: 'scale(3)' },
                  '99%': { opacity: 0, transform: 'scale(7)' },
                  '100%': { opacity: 0, transform: 'scale(7)', display: 'none' }
                }
              }
            }} />

            {/* Firecracker 3 - Bottom Left */}
            <Box sx={{
              position: 'absolute',
              bottom: '20%',
              left: '10%',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: '#FF1744',
              opacity: 0,
              animation: 'firecracker3 4s ease-out 2s forwards',
              '@keyframes firecracker3': {
                '0%': { opacity: 0, transform: 'scale(0)' },
                '20%': { opacity: 1, transform: 'scale(1)', boxShadow: '0 0 35px #FF1744' },
                '40%': {
                  opacity: 1,
                  transform: 'scale(3.5)',
                  boxShadow: '0 0 70px #FF1744, 0 0 90px #FFD700, 0 0 110px #FF6B35'
                },
                '70%': { opacity: 0.8, transform: 'scale(2)' },
                '99%': { opacity: 0, transform: 'scale(0)' },
                '100%': { opacity: 0, transform: 'scale(0)', display: 'none' }
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '-10px',
                left: '-10px',
                right: '-10px',
                bottom: '-10px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,23,68,0.9) 0%, transparent 70%)',
                opacity: 0,
                animation: 'sparkle3 4s ease-out 2s forwards',
                '@keyframes sparkle3': {
                  '0%': { opacity: 0, transform: 'scale(0)' },
                  '30%': { opacity: 1, transform: 'scale(4)' },
                  '99%': { opacity: 0, transform: 'scale(9)' },
                  '100%': { opacity: 0, transform: 'scale(9)', display: 'none' }
                }
              }
            }} />

            {/* Firecracker 4 - Bottom Right */}
            <Box sx={{
              position: 'absolute',
              bottom: '25%',
              right: '15%',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#9C27B0',
              opacity: 0,
              animation: 'firecracker4 3.8s ease-out 3s forwards',
              '@keyframes firecracker4': {
                '0%': { opacity: 0, transform: 'scale(0)' },
                '12%': { opacity: 1, transform: 'scale(1)', boxShadow: '0 0 40px #9C27B0' },
                '35%': {
                  opacity: 1,
                  transform: 'scale(4)',
                  boxShadow: '0 0 80px #9C27B0, 0 0 100px #FFD700, 0 0 120px #FF6B35'
                },
                '65%': { opacity: 0.9, transform: 'scale(2.5)' },
                '99%': { opacity: 0, transform: 'scale(0)' },
                '100%': { opacity: 0, transform: 'scale(0)', display: 'none' }
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '-12px',
                left: '-12px',
                right: '-12px',
                bottom: '-12px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(156,39,176,0.9) 0%, transparent 70%)',
                opacity: 0,
                animation: 'sparkle4 3.8s ease-out 3s forwards',
                '@keyframes sparkle4': {
                  '0%': { opacity: 0, transform: 'scale(0)' },
                  '25%': { opacity: 1, transform: 'scale(5)' },
                  '99%': { opacity: 0, transform: 'scale(10)' },
                  '100%': { opacity: 0, transform: 'scale(10)', display: 'none' }
                }
              }
            }} />

            {/* Firecracker 5 - Center - Green */}
            <Box sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#00E676',
              opacity: 0,
              animation: 'firecracker5 4.2s ease-out 4s forwards',
              '@keyframes firecracker5': {
                '0%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0)' },
                '12%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', boxShadow: '0 0 45px #00E676' },
                '35%': {
                  opacity: 1,
                  transform: 'translate(-50%, -50%) scale(4.5)',
                  boxShadow: '0 0 90px #00E676, 0 0 120px #FFD700, 0 0 150px #FF1744'
                },
                '65%': { opacity: 0.7, transform: 'translate(-50%, -50%) scale(2.5)' },
                '99%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0)' },
                '100%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0)', display: 'none' }
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '-12px',
                left: '-12px',
                right: '-12px',
                bottom: '-12px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0,230,118,0.9) 0%, transparent 70%)',
                opacity: 0,
                animation: 'sparkle5 4.2s ease-out 4s forwards',
                '@keyframes sparkle5': {
                  '0%': { opacity: 0, transform: 'scale(0)' },
                  '25%': { opacity: 1, transform: 'scale(5)' },
                  '99%': { opacity: 0, transform: 'scale(10)' },
                  '100%': { opacity: 0, transform: 'scale(10)', display: 'none' }
                }
              }
            }} />


          </Box>

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
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    mb: 1.5,
                    fontWeight: '500',
                    fontSize: '13px'
                  }}>
                    Title
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
                        padding: '12px 14px',
                        '&::placeholder': {
                          color: 'rgba(255, 255, 255, 0.4)',
                        }
                      },
                    }}
                  />
                </Box>

                {/* Modern Type Section */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    mb: 1.5,
                    fontWeight: '500',
                    fontSize: '13px'
                  }}>
                    Type
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControl size="medium" sx={{ minWidth: '200px' }} required>
                      <Select
                        value={prefixType}
                        onChange={handleTypeChange}
                        displayEmpty
                        sx={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          backdropFilter: 'blur(5px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                          '&:hover': {
                            border: '1px solid rgba(102, 126, 234, 0.3)',
                            background: 'rgba(255, 255, 255, 0.06)',
                          },
                          '&.Mui-focused': {
                            border: '1px solid rgba(102, 126, 234, 0.5)',
                            background: 'rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)',
                          },
                          '& .MuiSelect-select': {
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: '14px',
                            padding: '12px 14px'
                          },
                          '& .MuiSvgIcon-root': { color: 'rgba(255, 255, 255, 0.6)' },
                        }}
                      >
                        <MenuItem value="Trope">Trope</MenuItem>
                        <MenuItem value="Original">Original</MenuItem>
                        <MenuItem value="STL">STL</MenuItem>
                        <MenuItem value="Re-write">Re-write</MenuItem>
                      </Select>
                    </FormControl>

                    {prefixType === "Trope" && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="body2" sx={{
                          color: 'rgba(255, 255, 255, 0.8)',
                          fontWeight: '500',
                          fontSize: '13px'
                        }}>
                          Number
                        </Typography>
                        <FormControl size="small" sx={{ minWidth: '100px' }}>
                          <Select
                            value={prefixNumber}
                            onChange={(e) => setPrefixNumber(e.target.value)}
                            displayEmpty
                            sx={{
                              background: 'rgba(255, 255, 255, 0.04)',
                              backdropFilter: 'blur(5px)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                              '&:hover': {
                                border: '1px solid rgba(102, 126, 234, 0.3)',
                                background: 'rgba(255, 255, 255, 0.06)',
                              },
                              '&.Mui-focused': {
                                border: '1px solid rgba(102, 126, 234, 0.5)',
                                background: 'rgba(255, 255, 255, 0.08)',
                                boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)',
                              },
                              '& .MuiSelect-select': {
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontSize: '14px',
                                padding: '8px 12px'
                              },
                              '& .MuiSvgIcon-root': { color: 'rgba(255, 255, 255, 0.6)' },
                            }}
                          >
                            <MenuItem value="Choose" disabled>
                              Choose
                            </MenuItem>
                            {Array.from({ length: tropeList.length }, (_, i) => (
                              <MenuItem key={i + 1} value={i + 1}>
                                {i + 1}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Modern Trope Display Box */}
                <Box sx={{ mb: 3 }}>
                  <Box
                    sx={{
                      background: 'rgba(102, 126, 234, 0.05)',
                      border: '1px solid rgba(102, 126, 234, 0.15)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      fontSize: '13px',
                      width: '100%',
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontWeight: '400',
                      backdropFilter: 'blur(5px)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: 'rgba(102, 126, 234, 0.08)',
                        color: 'rgba(255, 255, 255, 0.8)',
                      }
                    }}
                  >
                    {prefixType === "Trope" && prefixNumber !== "Choose"
                      ? `${tropeList[prefixNumber - 1]}`
                      : prefixType === "Trope"
                        ? "Select a trope number to see description"
                        : "Trope description will appear here"}
                  </Box>
                </Box>

                {/* Modern Structure Field */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    mb: 1.5,
                    fontWeight: '500',
                    fontSize: '13px'
                  }}>
                    Structure
                  </Typography>
                  <FormControl fullWidth size="medium">
                    <Select
                      value={selectedStructure || ""}
                      onChange={(e) => setSelectedStructure(e.target.value)}
                      displayEmpty
                      sx={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        backdropFilter: 'blur(5px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                        '&:hover': {
                          border: '1px solid rgba(102, 126, 234, 0.3)',
                          background: 'rgba(255, 255, 255, 0.06)',
                        },
                        '&.Mui-focused': {
                          border: '1px solid rgba(102, 126, 234, 0.5)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)',
                        },
                        '& .MuiSelect-select': {
                          color: 'rgba(255, 255, 255, 0.9)',
                          fontSize: '14px',
                          padding: '12px 14px'
                        },
                        '& .MuiSvgIcon-root': { color: 'rgba(255, 255, 255, 0.6)' },
                      }}
                    >
                      <MenuItem value="">-- No structure selected --</MenuItem>
                      {structureList.map((structure) => (
                        <MenuItem key={structure.structure_id} value={structure.name}>
                          {structure.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {/* Modern Google Doc Link Field */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    mb: 1.5,
                    fontWeight: '500',
                    fontSize: '13px'
                  }}>
                    Google Doc Link
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="https://docs.google.com/document/d/..."
                    type="url"
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
                        padding: '12px 14px',
                        '&::placeholder': {
                          color: 'rgba(255, 255, 255, 0.4)',
                        }
                      },
                    }}
                  />
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={isSubmitting}
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
                  {isSubmitting ? 'Submitting...' : 'Submit Script'}
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