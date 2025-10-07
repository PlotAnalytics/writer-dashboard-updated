import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Paper } from '@mui/material';

const AccessGate = ({ children }) => {
  const [accessCode, setAccessCode] = useState('');
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState('');

  // Check if access was previously granted (stored in sessionStorage)
  useEffect(() => {
    const storedAccess = sessionStorage.getItem('plotpointe_access');
    if (storedAccess === 'granted') {
      setHasAccess(true);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Simple access code - you can change this
    const validCode = 'plotpointe2024';
    
    if (accessCode === validCode) {
      setHasAccess(true);
      sessionStorage.setItem('plotpointe_access', 'granted');
      setError('');
    } else {
      setError('Invalid access code');
      setAccessCode('');
    }
  };

  // If access is granted, render the children (main app)
  if (hasAccess) {
    return children;
  }

  // Otherwise, show the access gate
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        padding: 2
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 4,
          maxWidth: 400,
          width: '100%',
          textAlign: 'center'
        }}
      >
        <Typography variant="h4" gutterBottom>
          PlotPointe Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          This is a private internal dashboard. Please enter the access code to continue.
        </Typography>
        
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            type="password"
            label="Access Code"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            error={!!error}
            helperText={error}
            sx={{ mb: 2 }}
            autoFocus
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={!accessCode.trim()}
          >
            Enter Dashboard
          </Button>
        </form>
        
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Authorized personnel only
        </Typography>
      </Paper>
    </Box>
  );
};

export default AccessGate;
