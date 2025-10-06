import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { buildApiUrl, API_CONFIG } from '../config/api.js';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    // Safely get token from localStorage
    try {
      return localStorage.getItem('token');
    } catch (error) {
      console.warn('Failed to access localStorage:', error);
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Verify token on app load
  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        try {
          console.log('🔍 Verifying token...');
          const response = await axios.get(buildApiUrl(API_CONFIG.ENDPOINTS.AUTH.PROFILE));
          console.log('✅ Token verified, user:', response.data.user);
          setUser(response.data.user);

          // Store writer ID in localStorage if available
          if (response.data.user.writerId) {
            try {
              localStorage.setItem('writerId', response.data.user.writerId.toString());
              console.log('✅ Writer ID stored in localStorage:', response.data.user.writerId);
            } catch (storageError) {
              console.warn('Failed to save writerId to localStorage:', storageError);
            }
          }
        } catch (error) {
          console.log('❌ Token verification failed:', error.response?.status, error.response?.data?.message);
          // Token is invalid, remove it
          try {
            localStorage.removeItem('token');
          } catch (storageError) {
            console.warn('Failed to remove invalid token from localStorage:', storageError);
          }
          setToken(null);
          setUser(null);
        }
      } else {
        console.log('🔍 No token found, user will be redirected to login');
      }
      setLoading(false);
    };

    verifyToken();
  }, [token]);

  const login = async (username, password) => {
    try {
      console.log('🔐 Attempting login for:', username);
      const response = await axios.post(buildApiUrl(API_CONFIG.ENDPOINTS.AUTH.LOGIN), {
        username,
        password,
      });

      console.log('✅ Login response:', response.data);

      const { token: newToken, username: userName, role } = response.data;

      // Create user object from response
      const userData = {
        username: userName,
        role: role,
        name: userName, // Use username as display name
        secondaryRole: response.data.secondaryRole || null
      };

      try {
        localStorage.setItem('token', newToken);
        localStorage.setItem('username', userName); // Store username for Dashboard compatibility
      } catch (error) {
        console.warn('Failed to save token/username to localStorage:', error);
      }
      setToken(newToken);
      setUser(userData);

      // Get writer ID after successful login (skip for special roles)
      if (role !== 'retention_master' && role !== 'master_editor') {
        try {
          const profileResponse = await axios.get(buildApiUrl(API_CONFIG.ENDPOINTS.AUTH.PROFILE));
          if (profileResponse.data.user.writerId) {
            localStorage.setItem('writerId', profileResponse.data.user.writerId.toString());
            console.log('✅ Writer ID stored after login:', profileResponse.data.user.writerId);

            // Update user data with writer ID and secondary role
            setUser({
              ...userData,
              writerId: profileResponse.data.user.writerId,
              secondaryRole: profileResponse.data.user.secondaryRole || null
            });
          }
        } catch (profileError) {
          console.warn('Failed to get writer ID after login:', profileError);
        }
      }

      console.log('✅ Login successful, user set:', userData);
    } catch (error) {
      console.error('❌ Login error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('writerId');
      localStorage.removeItem('username');
    } catch (error) {
      console.warn('Failed to remove token/writerId/username from localStorage:', error);
    }
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const value = {
    user,
    token,
    login,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
