import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  FormControl,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton
} from '@mui/material';
import { LogoutOutlined } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const WriterSettings = () => {
  const [writerSettings, setWriterSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [selectedValues, setSelectedValues] = useState({});

  const { logout, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is master_editor
    if (!user || user.username !== 'master_editor') {
      navigate('/login');
      return;
    }

    fetchWriterSettings();
  }, [user, navigate]);

  const fetchWriterSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/master-editor/writer-settings');
      setWriterSettings(response.data.writerSettings);

      // Initialize selected values based on current skip_qa values
      const initialValues = {};
      response.data.writerSettings.forEach(setting => {
        initialValues[setting.id] = setting.skip_qa;
      });
      setSelectedValues(initialValues);

    } catch (error) {
      console.error('Error fetching writer settings:', error);
      setError('Failed to fetch writer settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipQAChange = (settingId, newValue) => {
    setSelectedValues(prev => ({
      ...prev,
      [settingId]: newValue
    }));
  };

  const handleEdit = async (settingId) => {
    try {
      setEditingId(settingId);
      setError(null);
      setSuccess(null);

      const newSkipQA = selectedValues[settingId];

      const response = await axios.post('/api/master-editor/update-writer-setting', {
        id: settingId,
        skipQA: newSkipQA
      });

      if (response.data.success) {
        setSuccess(`Successfully updated skip QA setting`);

        // Update the writer setting in the local state
        setWriterSettings(prev => prev.map(setting =>
          setting.id === settingId
            ? { ...setting, skip_qa: newSkipQA }
            : setting
        ));

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      }

    } catch (error) {
      console.error('Error updating writer setting:', error);
      setError(error.response?.data?.error || 'Failed to update writer setting');
    } finally {
      setEditingId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <Box sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <CircularProgress sx={{ color: 'white' }} />
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      {/* Header */}
      <AppBar position="static" sx={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        boxShadow: 'none',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Trello - Writer Settings
          </Typography>
          <Button
            color="inherit"
            onClick={handleLogout}
            startIcon={<LogoutOutlined />}
            sx={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(5px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.2)',
              }
            }}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 600, textAlign: 'center' }}>
          Writer Settings Management
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3, background: 'rgba(244, 67, 54, 0.1)', color: 'white' }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3, background: 'rgba(76, 175, 80, 0.1)', color: 'white' }}>
            {success}
          </Alert>
        )}

        <TableContainer component={Paper} sx={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden'
        }}>
          <Table>
            <TableHead>
              <TableRow sx={{ background: 'rgba(255, 255, 255, 0.1)' }}>
                <TableCell sx={{ color: 'white', fontWeight: 600, border: 'none', py: 3 }}>
                  Writer Name
                </TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600, border: 'none', py: 3 }}>
                  Current Skip QA
                </TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600, border: 'none', py: 3 }}>
                  New Skip QA
                </TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600, border: 'none', py: 3 }}>
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {writerSettings.map((setting) => (
                <TableRow key={setting.id} sx={{
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.05)'
                  }
                }}>
                  <TableCell sx={{ color: 'white', border: 'none', py: 2 }}>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {setting.writer_name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Typography variant="body2" sx={{
                      color: setting.skip_qa ? '#ff9800' : '#4caf50',
                      fontWeight: 500,
                      background: setting.skip_qa ? 'rgba(255, 152, 0, 0.1)' : 'rgba(76, 175, 80, 0.1)',
                      px: 1,
                      py: 0.5,
                      borderRadius: '6px',
                      display: 'inline-block'
                    }}>
                      {setting.skip_qa ? 'TRUE' : 'FALSE'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={selectedValues[setting.id] !== undefined ? selectedValues[setting.id] : setting.skip_qa}
                        onChange={(e) => handleSkipQAChange(setting.id, e.target.value)}
                        sx={{
                          color: 'white',
                          background: 'rgba(255, 255, 255, 0.04)',
                          backdropFilter: 'blur(5px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: 'none'
                          },
                          '&:hover': {
                            border: '1px solid rgba(102, 126, 234, 0.3)',
                            background: 'rgba(255, 255, 255, 0.06)',
                          }
                        }}
                      >
                        <MenuItem value={true}>TRUE</MenuItem>
                        <MenuItem value={false}>FALSE</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleEdit(setting.id)}
                      disabled={
                        editingId === setting.id ||
                        selectedValues[setting.id] === setting.skip_qa
                      }
                      sx={{
                        background: 'linear-gradient(45deg, #667eea, #764ba2)',
                        color: 'white',
                        fontWeight: 600,
                        borderRadius: '8px',
                        textTransform: 'none',
                        minWidth: '80px',
                        '&:hover': {
                          background: 'linear-gradient(45deg, #5a6fd8, #6a4190)',
                        },
                        '&:disabled': {
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: 'rgba(255, 255, 255, 0.3)'
                        }
                      }}
                    >
                      {editingId === setting.id ? (
                        <CircularProgress size={16} sx={{ color: 'white' }} />
                      ) : (
                        'Edit'
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {writerSettings.length === 0 && (
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              No writer settings found
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default WriterSettings;
