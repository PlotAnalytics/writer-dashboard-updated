import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Box, CircularProgress } from '@mui/material';

export const RetentionMasterRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user is retention_master, redirect to retention master page
  if (user.role === 'retention_master') {
    return <Navigate to="/retention-master" replace />;
  }

  return <>{children}</>;
};
