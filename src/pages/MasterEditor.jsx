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
  Select,
  MenuItem,
  Button,
  FormControl,
  Alert,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Chip,
  Stack,
  TableSortLabel
} from '@mui/material';
import {
  LogoutOutlined,
  FilterList as FilterIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

const MasterEditor = () => {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingScript, setEditingScript] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState({});
  const [selectedStructures, setSelectedStructures] = useState({});
  const [writerFilter, setWriterFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [availableWriters, setAvailableWriters] = useState([]);

  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const typeOptions = ['Original', 'Remix', 'Re-write', 'STL'];
  const structureOptions = ['Payback Revenge', 'Expectations', 'Looked Down Upon', 'Obsession', 'No Structure'];

  useEffect(() => {
    // Check if user is master_editor
    if (!user || user.username !== 'master_editor') {
      navigate('/login');
      return;
    }

    fetchScripts();
  }, [user, navigate]);

  const fetchScripts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/master-editor/scripts');
      setScripts(response.data.scripts);

      // Initialize selected types based on current titles
      const initialTypes = {};
      const initialStructures = {};
      response.data.scripts.forEach(script => {
        const typeMatch = script.title.match(/\[(Original|Remix|Re-write|STL)\]/);
        if (typeMatch) {
          initialTypes[script.id] = typeMatch[1];
        }

        const structureMatch = script.title.match(/\[(Payback Revenge|Expectations|Looked Down Upon|Obsession|No Structure)\]/);
        if (structureMatch) {
          initialStructures[script.id] = structureMatch[1];
        }
      });
      setSelectedTypes(initialTypes);
      setSelectedStructures(initialStructures);

      // Extract unique writers for filter dropdown
      const writers = [...new Set(response.data.scripts
        .map(script => script.writer_name)
        .filter(name => name && name !== 'Unknown')
      )].sort();
      setAvailableWriters(writers);

    } catch (error) {
      console.error('Error fetching scripts:', error);
      setError('Failed to fetch scripts');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (scriptId, newType) => {
    setSelectedTypes(prev => ({
      ...prev,
      [scriptId]: newType
    }));
  };

  const handleStructureChange = (scriptId, newStructure) => {
    setSelectedStructures(prev => ({
      ...prev,
      [scriptId]: newStructure
    }));
  };

  // Filter and sort scripts
  const getFilteredAndSortedScripts = () => {
    let filtered = scripts;

    // Apply writer filter
    if (writerFilter) {
      filtered = filtered.filter(script =>
        script.writer_name && script.writer_name.toLowerCase() === writerFilter.toLowerCase()
      );
    }

    // Apply sorting by created_at
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);

      if (sortOrder === 'desc') {
        return dateB - dateA; // Newest first
      } else {
        return dateA - dateB; // Oldest first
      }
    });

    return filtered;
  };

  const handleSortToggle = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const clearWriterFilter = () => {
    setWriterFilter('');
  };

  const handleEdit = async (scriptId) => {
    try {
      setEditingScript(scriptId);
      setError(null);
      setSuccess(null);

      const newType = selectedTypes[scriptId];
      const newStructure = selectedStructures[scriptId];

      const response = await axios.post('/api/master-editor/update-script', {
        scriptId,
        newType,
        newStructure
      });

      if (response.data.success) {
        const updates = [];
        if (newType) updates.push(`type: ${newType}`);
        if (newStructure) updates.push(`structure: ${newStructure}`);

        setSuccess(`Successfully updated script (${updates.join(', ')})`);

        // Update the script in the local state
        setScripts(prev => prev.map(script =>
          script.id === scriptId
            ? { ...script, title: response.data.newTitle }
            : script
        ));

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      }

    } catch (error) {
      console.error('Error updating script:', error);
      setError(error.response?.data?.error || 'Failed to update script');
    } finally {
      setEditingScript(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const extractCurrentType = (title) => {
    const match = title.match(/\[(Original|Remix|Re-write|STL)\]/);
    return match ? match[1] : 'Unknown';
  };

  const extractCurrentStructure = (title) => {
    const match = title.match(/\[(Payback Revenge|Expectations|Looked Down Upon|Obsession|No Structure)\]/);
    return match ? match[1] : 'Unknown';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Layout hideNavigation={true} hideSettings={true} hideFeedback={true}>
      <Box sx={{
        minHeight: '100vh',
        background: 'transparent',
        color: 'white',
        p: 0
      }}>
        {/* Modern Header */}
        <Box sx={{
          p: 3,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            bottom: -1,
            left: 24,
            width: '60px',
            height: '2px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '2px',
          }
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" sx={{
              color: 'white',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Script Type Editor
            </Typography>
            <Button
              variant="outlined"
              onClick={handleLogout}
              startIcon={<LogoutOutlined />}
              sx={{
                color: 'white',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                background: 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(5px)',
                borderRadius: '12px',
                textTransform: 'none',
                '&:hover': {
                  borderColor: 'rgba(102, 126, 234, 0.5)',
                  background: 'rgba(102, 126, 234, 0.1)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                }
              }}
            >
              Logout
            </Button>
          </Box>
        </Box>

        {/* Main Content */}
        <Box sx={{ p: 4 }}>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Filter and Sort Controls */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Writer Filter */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={writerFilter}
              onChange={(e) => setWriterFilter(e.target.value)}
              displayEmpty
              sx={{
                color: 'white',
                background: 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(5px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                transition: 'all 0.2s ease-in-out',
                '& .MuiOutlinedInput-notchedOutline': {
                  border: 'none'
                },
                '&:hover': {
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                },
                '&.Mui-focused': {
                  border: '1px solid rgba(102, 126, 234, 0.5)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 20px rgba(102, 126, 234, 0.25)',
                }
              }}
              startAdornment={
                <FilterIcon sx={{ color: '#667eea', mr: 1 }} />
              }
            >
              <MenuItem value="">All Writers</MenuItem>
              {availableWriters.map(writer => (
                <MenuItem key={writer} value={writer}>
                  {writer}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Clear Filter Button */}
          {writerFilter && (
            <Chip
              label={`Writer: ${writerFilter}`}
              onDelete={clearWriterFilter}
              deleteIcon={<ClearIcon />}
              sx={{
                backgroundColor: '#4fc3f7',
                color: 'white',
                '& .MuiChip-deleteIcon': {
                  color: 'white'
                }
              }}
            />
          )}

          {/* Sort Toggle */}
          <Button
            variant="outlined"
            size="small"
            onClick={handleSortToggle}
            sx={{
              color: 'white',
              borderColor: '#666',
              '&:hover': {
                borderColor: '#4fc3f7',
                backgroundColor: 'rgba(79, 195, 247, 0.1)'
              }
            }}
          >
            Sort by Date: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ borderBottom: '1px solid #333' }}>
                <TableCell sx={{ color: '#888', border: 'none', py: 1, fontWeight: 'bold' }}>ID</TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1, fontWeight: 'bold' }}>Title</TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1, fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={true}
                    direction={sortOrder}
                    onClick={handleSortToggle}
                    sx={{
                      color: '#888 !important',
                      '&:hover': { color: 'white !important' },
                      '& .MuiTableSortLabel-icon': {
                        color: '#667eea !important'
                      }
                    }}
                  >
                    Created At
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1, fontWeight: 'bold' }}>Writer Name</TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1, fontWeight: 'bold' }}>Current Type</TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1, fontWeight: 'bold' }}>New Type</TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1, fontWeight: 'bold' }}>Current Structure</TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1, fontWeight: 'bold' }}>New Structure</TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1, fontWeight: 'bold' }}>Action</TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1, fontWeight: 'bold' }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getFilteredAndSortedScripts().map((script, index) => (
                <TableRow
                  key={`${script.id}-${index}`}
                  sx={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    '&:hover': {
                      backgroundColor: 'rgba(102, 126, 234, 0.05)',
                      borderColor: 'rgba(102, 126, 234, 0.1)',
                    }
                  }}
                >
                  <TableCell sx={{ border: 'none', py: 2, color: 'white' }}>{script.id}</TableCell>
                  <TableCell sx={{ border: 'none', py: 2, maxWidth: 400 }}>
                    <Typography variant="body2" sx={{
                      color: 'white',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {script.title}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Typography variant="body2" sx={{ color: 'white' }}>
                      {script.created_at ? new Date(script.created_at).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Typography variant="body2" sx={{ color: 'white' }}>
                      {script.writer_name || 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Typography variant="body2" sx={{
                      color: '#667eea',
                      fontWeight: 500,
                      background: 'rgba(102, 126, 234, 0.1)',
                      px: 1,
                      py: 0.5,
                      borderRadius: '6px',
                      display: 'inline-block'
                    }}>
                      {extractCurrentType(script.title)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={selectedTypes[script.id] || ''}
                        onChange={(e) => handleTypeChange(script.id, e.target.value)}
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
                        {typeOptions.map(type => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Typography variant="body2" sx={{
                      color: '#764ba2',
                      fontWeight: 500,
                      background: 'rgba(118, 75, 162, 0.1)',
                      px: 1,
                      py: 0.5,
                      borderRadius: '6px',
                      display: 'inline-block'
                    }}>
                      {extractCurrentStructure(script.title)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <Select
                        value={selectedStructures[script.id] || ''}
                        onChange={(e) => handleStructureChange(script.id, e.target.value)}
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
                            border: '1px solid rgba(118, 75, 162, 0.3)',
                            background: 'rgba(255, 255, 255, 0.06)',
                          }
                        }}
                      >
                        {structureOptions.map(structure => (
                          <MenuItem key={structure} value={structure}>
                            {structure}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleEdit(script.id)}
                      disabled={
                        editingScript === script.id ||
                        (
                          (!selectedTypes[script.id] || selectedTypes[script.id] === extractCurrentType(script.title)) &&
                          (!selectedStructures[script.id] || selectedStructures[script.id] === extractCurrentStructure(script.title))
                        )
                      }
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        borderRadius: '8px',
                        textTransform: 'none',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                        },
                        '&:disabled': {
                          background: '#666',
                          transform: 'none',
                          boxShadow: 'none'
                        }
                      }}
                    >
                      {editingScript === script.id ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        'Edit'
                      )}
                    </Button>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Typography variant="body2" sx={{
                      color: script.approval_status === 'Posted' ? '#4caf50' : '#888',
                      fontWeight: 500,
                      background: script.approval_status === 'Posted' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(136, 136, 136, 0.1)',
                      px: 1,
                      py: 0.5,
                      borderRadius: '6px',
                      display: 'inline-block'
                    }}>
                      {script.approval_status}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {scripts.length === 0 && (
          <Typography variant="body1" sx={{
            color: '#888',
            textAlign: 'center',
            mt: 4,
            background: 'rgba(255, 255, 255, 0.04)',
            p: 3,
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            No scripts found with type prefixes (Original, Remix, Re-write, STL)
          </Typography>
        )}

        {scripts.length > 0 && getFilteredAndSortedScripts().length === 0 && (
          <Typography variant="body1" sx={{
            color: '#888',
            textAlign: 'center',
            mt: 4,
            background: 'rgba(255, 255, 255, 0.04)',
            p: 3,
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            No scripts match the current filter criteria
          </Typography>
        )}
        </Box>
      </Box>
    </Layout>
  );
};

export default MasterEditor;
