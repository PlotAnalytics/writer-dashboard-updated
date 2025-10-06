import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const TopContentCarousel = ({ videos, onVideoClick }) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const carouselRef = useRef(null);
  const intervalRef = useRef(null);

  // Calculate visible cards based on full available width
  const getVisibleCards = () => {
    if (typeof window !== 'undefined') {
      const screenWidth = window.innerWidth;
      const sidebarWidth = 280; // Actual sidebar width from Layout
      const totalPadding = 144; // 72px on each side (24+24+24 each)
      const scrollbarWidth = 20; // Account for potential scrollbar
      const safetyMargin = 20; // Extra safety margin
      const availableWidth = screenWidth - sidebarWidth - scrollbarWidth - safetyMargin;
      const cardWidth = 152; // 140px + 12px gap
      const maxCards = Math.floor(availableWidth / cardWidth);
      return Math.min(Math.max(1, maxCards), videos?.length || 8); // Allow more cards
    }
    return 5; // More generous default
  };

  const [visibleCards, setVisibleCards] = useState(() => {
    // Use full calculated width now that we have more space
    const calculated = getVisibleCards();
    return Math.min(calculated, 6); // Allow up to 6 cards with full width
  });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const calculated = getVisibleCards();
      setVisibleCards(Math.min(calculated, 6)); // Cap at 6 cards max with full width
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [videos]);

  // Auto-scroll functionality
  useEffect(() => {
    if (videos && videos.length > visibleCards) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const maxIndex = videos.length - visibleCards;
          return prevIndex >= maxIndex ? 0 : prevIndex + 1;
        });
      }, 2000); // Move every 2 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [videos, visibleCards]);

  // Handle mouse wheel scrolling
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    setCurrentIndex((prevIndex) => {
      const maxIndex = videos.length - visibleCards;
      const newIndex = prevIndex + delta;
      return Math.max(0, Math.min(maxIndex, newIndex));
    });
  };

  // Handle click-to-scroll navigation
  const handleCardNavigationClick = (cardIndex, e) => {
    e.stopPropagation(); // Prevent event bubbling

    // Calculate the target index to center the clicked card
    const targetIndex = Math.max(0, Math.min(videos.length - visibleCards, cardIndex - Math.floor(visibleCards / 2)));
    setCurrentIndex(targetIndex);
  };

  if (!videos || videos.length === 0) {
    return null;
  }

  return (
    <Box
      ref={carouselRef}
      onWheel={handleWheel}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        mt: 2,
        width: 'calc(100% - 97px)', // More constrained width
        maxWidth: '970px', // Maximum width
        marginLeft: '48px',
        marginRight: '48px',
        marginTop: '16px'
      }}
    >
      {/* Carousel Container */}
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          transition: 'transform 0.8s cubic-bezier(0.4, 0.0, 0.2, 1)',
          transform: `translateX(-${currentIndex * 152}px)`, // Standard carousel transform
          width: 'max-content', // Let it size naturally
          willChange: 'transform' // Optimize for animations
        }}
      >
        {videos.map((content, index) => {
          const isFirstVisible = index === currentIndex;
          return (
            <Box
              key={content.id || index}
              sx={{
                flex: '0 0 140px', // Fixed width for smooth sliding
                width: '140px',
                position: 'relative',
                background: isFirstVisible
                  ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)'
                  : 'rgba(42, 42, 42, 0.8)',
                borderRadius: '12px',
                border: isFirstVisible
                  ? '1px solid rgba(102, 126, 234, 0.3)'
                  : '1px solid #333',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                overflow: 'hidden',
                backdropFilter: 'blur(10px)',
                boxShadow: isFirstVisible
                  ? '0 4px 16px rgba(102, 126, 234, 0.2)'
                  : '0 2px 8px rgba(0, 0, 0, 0.1)',
                height: '260px',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': {
                  transform: 'translateY(-4px) scale(1.02)',
                  boxShadow: isFirstVisible
                    ? '0 12px 32px rgba(102, 126, 234, 0.4)'
                    : '0 8px 24px rgba(102, 126, 234, 0.3)',
                  border: '1px solid rgba(102, 126, 234, 0.5)',
                  '& .rank-badge': {
                    transform: 'scale(1.1)'
                  },
                  '& .thumbnail': {
                    transform: 'scale(1.05)'
                  },
                  '& .play-overlay': {
                    opacity: 1
                  },
                  '& .navigation-overlay': {
                    opacity: 1
                  }
                }
              }}
            >
              {/* Navigation Click Overlay */}
              <Box
                className="navigation-overlay"
                onClick={(e) => handleCardNavigationClick(index, e)}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 1,
                  cursor: 'pointer',
                  opacity: 0,
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                  transition: 'opacity 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px'
                }}
              >
                <Box
                  sx={{
                    background: 'rgba(102, 126, 234, 0.9)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}
                >
                  Click to center
                </Box>
              </Box>

              {/* Content Click Area */}
              <Box
                className="content-click-area"
                onClick={(event) => {
                  // Only navigate to content if not clicking on navigation overlay
                  if (!event.target.closest('.navigation-overlay')) {
                    navigate(`/content/video/${content.id}`);
                  }
                }}
                sx={{
                  position: 'relative',
                  zIndex: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
              {/* Rank Badge */}
              <Box
                className="rank-badge"
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: index < 3
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'linear-gradient(135deg, #4a4a4a 0%, #2a2a2a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '12px',
                  boxShadow: index < 3
                    ? '0 2px 8px rgba(102, 126, 234, 0.3)'
                    : '0 2px 8px rgba(0, 0, 0, 0.2)',
                  transition: 'all 0.3s ease',
                  zIndex: 2
                }}
              >
                {index + 1}
              </Box>

              {/* Thumbnail */}
              <Box sx={{ position: 'relative', width: '100%', height: '110px', mb: 1 }}>
                <Box
                  className="video-thumbnail-analytics thumbnail"
                  component="img"
                  src={content.highThumbnail || content.mediumThumbnail || content.thumbnail || content.preview || `https://img.youtube.com/vi/${content.url?.split('v=')[1] || content.url?.split('/').pop()}/maxresdefault.jpg`}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '8px 8px 0 0',
                    transition: 'all 0.3s ease'
                  }}
                  onError={(e) => {
                    e.target.src = `https://img.youtube.com/vi/${content.url?.split('v=')[1] || content.url?.split('/').pop()}/hqdefault.jpg`;
                  }}
                />

                {/* Play Overlay */}
                <Box
                  className="play-overlay"
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  <Box
                    sx={{
                      width: 0,
                      height: 0,
                      borderLeft: '10px solid white',
                      borderTop: '6px solid transparent',
                      borderBottom: '6px solid transparent',
                      marginLeft: '2px'
                    }}
                  />
                </Box>

                {/* Duration Badge */}
                {content.duration && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 4,
                      right: 4,
                      background: 'rgba(0, 0, 0, 0.8)',
                      color: 'white',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      fontSize: '9px',
                      fontWeight: 600
                    }}
                  >
                    {content.duration}
                  </Box>
                )}

                {/* Content Type Badge */}
                {content.content_type && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: content.content_type === 'Original'
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : content.content_type === 'Remix'
                          ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                          : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      color: 'white',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      fontSize: '8px',
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}
                  >
                    {content.content_type}
                  </Box>
                )}
              </Box>

              {/* Content Info */}
              <Box sx={{ px: 1.5, pb: 1.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Title */}
                <Typography
                  variant="body2"
                  sx={{
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '11px',
                    lineHeight: 1.2,
                    mb: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {content.title || 'Untitled Video'}
                </Typography>

                {/* Metrics Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto' }}>
                  {/* Views */}
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '11px'
                    }}>
                      {content.views ? (content.views >= 1000000 ? `${(content.views / 1000000).toFixed(1)}M` : content.views >= 1000 ? `${(content.views / 1000).toFixed(0)}K` : content.views.toLocaleString()) : '0'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '8px' }}>
                      views
                    </Typography>
                  </Box>

                  {/* Engagement */}
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '11px'
                    }}>
                      {content.likes && content.views ?
                        ((content.likes / content.views) * 100).toFixed(1) + '%' :
                        'N/A'
                      }
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '8px' }}>
                      engagement
                    </Typography>
                  </Box>
                </Box>
              </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Carousel Indicators */}
      {videos.length > visibleCards && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 1,
            mt: 2
          }}
        >
          {Array.from({ length: Math.ceil(videos.length / visibleCards) }).map((_, index) => (
            <Box
              key={index}
              onClick={() => setCurrentIndex(index * visibleCards)}
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: Math.floor(currentIndex / visibleCards) === index
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '2px solid transparent',
                '&:hover': {
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  transform: 'scale(1.2)',
                  border: '2px solid rgba(102, 126, 234, 0.5)'
                }
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default TopContentCarousel;
