import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { buildApiUrl } from '../config/api.js';
import { useAuth } from './AuthContext.jsx';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [uncebratedNotifications, setUncebratedNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch notification counts
  const fetchNotificationCounts = async () => {
    if (!token || !user) return;

    try {
      const response = await axios.get(buildApiUrl('/api/notifications/count'));
      if (response.data.success) {
        setUnreadCount(response.data.unread);
        
        // If there are uncelebrated notifications, fetch them
        if (response.data.uncelebrated > 0) {
          fetchUncebratedNotifications();
        }
      }
    } catch (error) {
      console.error('❌ Error fetching notification counts:', error);
    }
  };

  // Fetch uncelebrated notifications for celebration popups
  const fetchUncebratedNotifications = async () => {
    if (!token || !user) return;

    try {
      const response = await axios.get(buildApiUrl('/api/notifications/uncelebrated'));
      if (response.data.success) {
        setUncebratedNotifications(response.data.notifications);
      }
    } catch (error) {
      console.error('❌ Error fetching uncelebrated notifications:', error);
    }
  };

  // Fetch all notifications
  const fetchNotifications = async (limit = 20, offset = 0) => {
    if (!token || !user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(buildApiUrl('/api/notifications'), {
        params: { limit, offset }
      });

      if (response.data.success) {
        if (offset === 0) {
          setNotifications(response.data.notifications);
        } else {
          setNotifications(prev => [...prev, ...response.data.notifications]);
        }
        return response.data;
      }
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      setError('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    if (!token || !user) return;

    try {
      const response = await axios.put(buildApiUrl(`/api/notifications/${notificationId}/read`));
      if (response.data.success) {
        // Update local state
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, is_read: true }
              : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  };

  // Mark notification as celebrated
  const markAsCelebrated = async (notificationId) => {
    if (!token || !user) return;

    try {
      const response = await axios.put(buildApiUrl(`/api/notifications/${notificationId}/celebrated`));
      if (response.data.success) {
        // Remove from uncelebrated list
        setUncebratedNotifications(prev => 
          prev.filter(notif => notif.id !== notificationId)
        );
        
        // Update main notifications list
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, is_celebrated: true }
              : notif
          )
        );
      }
    } catch (error) {
      console.error('❌ Error marking notification as celebrated:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!token || !user) return;

    try {
      const response = await axios.put(buildApiUrl('/api/notifications/read-all'));
      if (response.data.success) {
        // Update local state
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, is_read: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
    }
  };

  // Trigger milestone check (for testing/manual trigger)
  const checkMilestones = async () => {
    if (!token || !user) return;

    try {
      const response = await axios.post(buildApiUrl('/api/notifications/check-milestones'));
      if (response.data.success) {
        console.log('✅ Milestone check completed:', response.data);
        
        // Refresh counts and notifications if new ones were created
        if (response.data.new_notifications > 0) {
          await fetchNotificationCounts();
          await fetchNotifications();
        }
        
        return response.data;
      }
    } catch (error) {
      console.error('❌ Error checking milestones:', error);
      throw error;
    }
  };

  // Format milestone type for display
  const formatMilestoneType = (milestoneType) => {
    const typeMap = {
      '1M_VIEWS': '1 Million Views',
      '5M_VIEWS': '5 Million Views',
      '10M_VIEWS': '10 Million Views',
      '50M_VIEWS': '50 Million Views',
      '100M_VIEWS': '100 Million Views'
    };
    return typeMap[milestoneType] || milestoneType;
  };

  // Format numbers for display
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // Auto-fetch counts when user logs in
  useEffect(() => {
    if (user && token) {
      fetchNotificationCounts();
    }
  }, [user, token]);

  // Poll for new notifications every 5 minutes
  useEffect(() => {
    if (!user || !token) return;

    const interval = setInterval(() => {
      fetchNotificationCounts();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user, token]);

  const value = {
    notifications,
    unreadCount,
    uncebratedNotifications,
    loading,
    error,
    fetchNotifications,
    fetchNotificationCounts,
    markAsRead,
    markAsCelebrated,
    markAllAsRead,
    checkMilestones,
    formatMilestoneType,
    formatNumber
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
