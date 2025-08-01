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
  IconButton
} from '@mui/material';
import { LogoutOutlined } from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const MasterEditor = () => {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingScript, setEditingScript] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState({});
  
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const typeOptions = ['Original', 'Remix', 'Re-write', 'STL'];

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
      response.data.scripts.forEach(script => {
        const match = script.title.match(/\[(Original|Remix|Re-write|STL)\]/);
        if (match) {
          initialTypes[script.id] = match[1];
        }
      });
      setSelectedTypes(initialTypes);
      
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

  const handleEdit = async (scriptId) => {
    try {
      setEditingScript(scriptId);
      setError(null);
      setSuccess(null);

      const newType = selectedTypes[scriptId];
      
      const response = await axios.post('/api/master-editor/update-script-type', {
        scriptId,
        newType
      });

      if (response.data.success) {
        setSuccess(`Successfully updated script to ${newType}`);
        
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Top Bar with Logout */}
      <AppBar position="static" sx={{ backgroundColor: '#1a1a1a' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: 'white' }}>
            Master Editor - Script Type Manager
          </Typography>
          <IconButton 
            color="inherit" 
            onClick={handleLogout}
            sx={{ color: 'white' }}
          >
            <LogoutOutlined />
            <Typography variant="body2" sx={{ ml: 1 }}>
              Logout
            </Typography>
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" sx={{ color: 'white', mb: 3, textAlign: 'center' }}>
          Script Type Editor
        </Typography>

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

        <TableContainer component={Paper} sx={{ backgroundColor: '#1a1a1a' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#2a2a2a' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>ID</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Title</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Current Type</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>New Type</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Action</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scripts.map((script) => (
                <TableRow 
                  key={script.id}
                  sx={{ 
                    '&:nth-of-type(odd)': { backgroundColor: '#1e1e1e' },
                    '&:nth-of-type(even)': { backgroundColor: '#1a1a1a' }
                  }}
                >
                  <TableCell sx={{ color: 'white' }}>{script.id}</TableCell>
                  <TableCell sx={{ color: 'white', maxWidth: 400 }}>
                    <Typography variant="body2" sx={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {script.title}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ color: '#4fc3f7' }}>
                    {extractCurrentType(script.title)}
                  </TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={selectedTypes[script.id] || ''}
                        onChange={(e) => handleTypeChange(script.id, e.target.value)}
                        sx={{ 
                          color: 'white',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#666'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#4fc3f7'
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
                  <TableCell>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleEdit(script.id)}
                      disabled={
                        editingScript === script.id || 
                        !selectedTypes[script.id] ||
                        selectedTypes[script.id] === extractCurrentType(script.title)
                      }
                      sx={{
                        backgroundColor: '#4fc3f7',
                        '&:hover': { backgroundColor: '#29b6f6' },
                        '&:disabled': { backgroundColor: '#666' }
                      }}
                    >
                      {editingScript === script.id ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        'Edit'
                      )}
                    </Button>
                  </TableCell>
                  <TableCell sx={{ color: 'white' }}>
                    {script.approval_status}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {scripts.length === 0 && (
          <Typography variant="body1" sx={{ color: 'white', textAlign: 'center', mt: 4 }}>
            No scripts found with type prefixes (Original, Remix, Re-write, STL)
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default MasterEditor;
