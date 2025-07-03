import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Box, CircularProgress } from '@mui/material';

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

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

  // If user is retention_master and not on retention-master page, redirect
  if (user.role === 'retention_master' && location.pathname !== '/retention-master') {
    return <Navigate to="/retention-master" replace />;
  }

  // If user is NOT retention_master and trying to access retention-master page, redirect to dashboard
  if (user.role !== 'retention_master' && location.pathname === '/retention-master') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
