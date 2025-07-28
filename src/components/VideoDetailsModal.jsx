import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Link,
  Chip,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DescriptionIcon from '@mui/icons-material/Description';
import ChatIcon from '@mui/icons-material/Chat';
import { formatNumber } from '../utils/formatNumber';

const VideoDetailsModal = ({ 
  open, 
  onClose, 
  category, 
  videos, 
  loading 
}) => {
  const getCategoryInfo = (category) => {
    const categoryMap = {
      megaVirals: { title: 'Mega Virals', subtitle: '3M+ Views', color: '#FFD700', bgColor: 'rgba(255, 215, 0, 0.08)' },
      virals: { title: 'Virals', subtitle: '1M - 3M Views', color: '#FF5722', bgColor: 'rgba(255, 87, 34, 0.08)' },
      almostVirals: { title: 'Almost Virals', subtitle: '500K - 1M Views', color: '#FF9800', bgColor: 'rgba(255, 152, 0, 0.08)' },
      decentVideos: { title: 'Decent Videos', subtitle: '100K - 500K Views', color: '#4CAF50', bgColor: 'rgba(76, 175, 80, 0.08)' },
      flops: { title: 'Flops', subtitle: 'Under 100K Views', color: '#9E9E9E', bgColor: 'rgba(158, 158, 158, 0.08)' }
    };
    return categoryMap[category] || { title: 'Videos', subtitle: '', color: '#667eea', bgColor: 'rgba(102, 126, 234, 0.08)' };
  };

  const categoryInfo = getCategoryInfo(category);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getBestThumbnail = (thumbnailsJson) => {
    if (!thumbnailsJson) return null;
    
    try {
      const thumbnails = typeof thumbnailsJson === 'string' ? JSON.parse(thumbnailsJson) : thumbnailsJson;
      
      // Priority order: maxres > standard > high > medium > default
      const priorities = ['maxres', 'standard', 'high', 'medium', 'default'];
      
      for (const priority of priorities) {
        if (thumbnails[priority]?.url) {
          return thumbnails[priority].url;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing thumbnails:', error);
      return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(30, 41, 59, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        }
      }}
    >
      <DialogTitle sx={{ 
        background: `linear-gradient(135deg, ${categoryInfo.bgColor}, rgba(255, 255, 255, 0.02))`,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 8,
            height: 40,
            background: `linear-gradient(135deg, ${categoryInfo.color}, ${categoryInfo.color}80)`,
            borderRadius: 1,
            boxShadow: `0 0 20px ${categoryInfo.color}40`
          }} />
          <Box>
            <Typography variant="h5" sx={{ 
              color: 'white', 
              fontWeight: 700,
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>
              {categoryInfo.title}
            </Typography>
            <Typography variant="body2" sx={{ 
              color: 'rgba(255, 255, 255, 0.7)',
              fontWeight: 500
            }}>
              {categoryInfo.subtitle}
            </Typography>
          </Box>
        </Box>
        <IconButton 
          onClick={onClose}
          sx={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            '&:hover': { 
              color: 'white',
              background: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            py: 8 
          }}>
            <CircularProgress sx={{ color: categoryInfo.color }} />
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ 
            background: 'transparent',
            boxShadow: 'none'
          }}>
            <Table>
              <TableHead>
                <TableRow sx={{ 
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600, border: 'none' }}>
                    Video
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600, border: 'none' }}>
                    Views (Last Day)
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600, border: 'none' }}>
                    Published
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600, border: 'none' }}>
                    Links
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {videos?.map((video, index) => (
                  <TableRow 
                    key={video.video_id || index}
                    sx={{ 
                      '&:hover': { 
                        background: 'rgba(255, 255, 255, 0.02)' 
                      },
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    <TableCell sx={{ border: 'none', py: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar
                          src={getBestThumbnail(video.snippet_thumbnails)}
                          variant="rounded"
                          sx={{ 
                            width: 80, 
                            height: 45,
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Link
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              color: 'white',
                              textDecoration: 'none',
                              fontWeight: 500,
                              fontSize: '0.9rem',
                              display: 'block',
                              '&:hover': { color: categoryInfo.color }
                            }}
                          >
                            {video.title || 'Untitled Video'}
                          </Link>
                          <Typography variant="caption" sx={{ 
                            color: 'rgba(255, 255, 255, 0.6)',
                            display: 'block',
                            mt: 0.5
                          }}>
                            ID: {video.video_id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ border: 'none' }}>
                      <Chip
                        label={formatNumber(video.last_day_views || 0)}
                        sx={{
                          background: `${categoryInfo.color}20`,
                          color: categoryInfo.color,
                          fontWeight: 600,
                          border: `1px solid ${categoryInfo.color}40`
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ border: 'none', color: 'rgba(255, 255, 255, 0.8)' }}>
                      {formatDate(video.published_date)}
                    </TableCell>
                    <TableCell sx={{ border: 'none' }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {video.google_doc_link && (
                          <IconButton
                            component="a"
                            href={video.google_doc_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="small"
                            sx={{
                              color: 'rgba(255, 255, 255, 0.7)',
                              '&:hover': { color: '#4285f4' }
                            }}
                            title="Google Doc"
                          >
                            <DescriptionIcon fontSize="small" />
                          </IconButton>
                        )}
                        {video.ai_chat_url && (
                          <IconButton
                            component="a"
                            href={video.ai_chat_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="small"
                            sx={{
                              color: 'rgba(255, 255, 255, 0.7)',
                              '&:hover': { color: '#00d4aa' }
                            }}
                            title="AI Chat"
                          >
                            <ChatIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton
                          component="a"
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small"
                          sx={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': { color: '#ff0000' }
                          }}
                          title="YouTube Video"
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        
        {!loading && (!videos || videos.length === 0) && (
          <Box sx={{ 
            textAlign: 'center', 
            py: 8,
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              No videos found
            </Typography>
            <Typography variant="body2">
              No videos match the criteria for {categoryInfo.title.toLowerCase()}.
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VideoDetailsModal;
