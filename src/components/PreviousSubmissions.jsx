import React, { useState } from 'react';
import {
  Typography,
  Box,
  Button,
  Menu,
  MenuItem,
  Chip,
  IconButton,
  CircularProgress,
  Stack,
  TextField,
  InputAdornment,
  Divider,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Sort as SortIcon,
  Description as DocIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  DateRange as DateRangeIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

const PreviousSubmissions = ({
  submissions,
  loading,
  onRefresh
}) => {
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [sortAnchorEl, setSortAnchorEl] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Date');

  // Enhanced filter state from reference
  const [filter, setFilter] = useState('');
  const [searchTitle, setSearchTitle] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc');

  // Modern search state
  const [searchQuery, setSearchQuery] = useState('');

  const handleFilterClick = (event) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleSortClick = (event) => {
    setSortAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const handleSortClose = () => {
    setSortAnchorEl(null);
  };

  const handleFilterChange = (filter) => {
    setStatusFilter(filter);
    handleFilterClose();
  };

  const handleSortChange = (sort) => {
    setSortBy(sort);
    handleSortClose();
  };

  // Static color definitions for production compatibility
  const STATUS_COLORS = {
    'Posted': {
      base: '#4CAF50',
      bg: 'rgba(76, 175, 80, 0.05)',
      border: 'rgba(76, 175, 80, 0.2)',
      hoverBg: 'rgba(76, 175, 80, 0.1)',
      hoverBorder: 'rgba(76, 175, 80, 0.4)',
      shadow: 'rgba(76, 175, 80, 0.3)',
      chipShadow: 'rgba(76, 175, 80, 0.4)',
      chipHoverShadow: 'rgba(76, 175, 80, 0.6)',
    },
    'Rejected': {
      base: '#F44336',
      bg: 'rgba(244, 67, 54, 0.05)',
      border: 'rgba(244, 67, 54, 0.2)',
      hoverBg: 'rgba(244, 67, 54, 0.1)',
      hoverBorder: 'rgba(244, 67, 54, 0.4)',
      shadow: 'rgba(244, 67, 54, 0.3)',
      chipShadow: 'rgba(244, 67, 54, 0.4)',
      chipHoverShadow: 'rgba(244, 67, 54, 0.6)',
    },
    'Pending': {
      base: '#FF9800',
      bg: 'rgba(255, 152, 0, 0.05)',
      border: 'rgba(255, 152, 0, 0.2)',
      hoverBg: 'rgba(255, 152, 0, 0.1)',
      hoverBorder: 'rgba(255, 152, 0, 0.4)',
      shadow: 'rgba(255, 152, 0, 0.3)',
      chipShadow: 'rgba(255, 152, 0, 0.4)',
      chipHoverShadow: 'rgba(255, 152, 0, 0.6)',
    },
    'Under Review': {
      base: '#2196F3',
      bg: 'rgba(33, 150, 243, 0.05)',
      border: 'rgba(33, 150, 243, 0.2)',
      hoverBg: 'rgba(33, 150, 243, 0.1)',
      hoverBorder: 'rgba(33, 150, 243, 0.4)',
      shadow: 'rgba(33, 150, 243, 0.3)',
      chipShadow: 'rgba(33, 150, 243, 0.4)',
      chipHoverShadow: 'rgba(33, 150, 243, 0.6)',
    },
    'Draft': {
      base: '#9E9E9E',
      bg: 'rgba(158, 158, 158, 0.05)',
      border: 'rgba(158, 158, 158, 0.2)',
      hoverBg: 'rgba(158, 158, 158, 0.1)',
      hoverBorder: 'rgba(158, 158, 158, 0.4)',
      shadow: 'rgba(158, 158, 158, 0.3)',
      chipShadow: 'rgba(158, 158, 158, 0.4)',
      chipHoverShadow: 'rgba(158, 158, 158, 0.6)',
    },
    'Pending Approval': {
      base: '#2196F3',
      bg: 'rgba(33, 150, 243, 0.05)',
      border: 'rgba(33, 150, 243, 0.2)',
      hoverBg: 'rgba(33, 150, 243, 0.1)',
      hoverBorder: 'rgba(33, 150, 243, 0.4)',
      shadow: 'rgba(33, 150, 243, 0.3)',
      chipShadow: 'rgba(33, 150, 243, 0.4)',
      chipHoverShadow: 'rgba(33, 150, 243, 0.6)',
    },
    'Approved - Ready for Production': {
      base: '#FF9800',
      bg: 'rgba(255, 152, 0, 0.05)',
      border: 'rgba(255, 152, 0, 0.2)',
      hoverBg: 'rgba(255, 152, 0, 0.1)',
      hoverBorder: 'rgba(255, 152, 0, 0.4)',
      shadow: 'rgba(255, 152, 0, 0.3)',
      chipShadow: 'rgba(255, 152, 0, 0.4)',
      chipHoverShadow: 'rgba(255, 152, 0, 0.6)',
    },
    'Video Complete - Pending Upload': {
      base: '#9C27B0',
      bg: 'rgba(156, 39, 176, 0.05)',
      border: 'rgba(156, 39, 176, 0.2)',
      hoverBg: 'rgba(156, 39, 176, 0.1)',
      hoverBorder: 'rgba(156, 39, 176, 0.4)',
      shadow: 'rgba(156, 39, 176, 0.3)',
      chipShadow: 'rgba(156, 39, 176, 0.4)',
      chipHoverShadow: 'rgba(156, 39, 176, 0.6)',
    },
    'Story Continuation': {
      base: '#607D8B',
      bg: 'rgba(96, 125, 139, 0.05)',
      border: 'rgba(96, 125, 139, 0.2)',
      hoverBg: 'rgba(96, 125, 139, 0.1)',
      hoverBorder: 'rgba(96, 125, 139, 0.4)',
      shadow: 'rgba(96, 125, 139, 0.3)',
      chipShadow: 'rgba(96, 125, 139, 0.4)',
      chipHoverShadow: 'rgba(96, 125, 139, 0.6)',
    },
  };

  // Fallback colors for unknown statuses
  const DEFAULT_COLORS = {
    base: '#666',
    bg: 'rgba(102, 102, 102, 0.05)',
    border: 'rgba(102, 102, 102, 0.2)',
    hoverBg: 'rgba(102, 102, 102, 0.1)',
    hoverBorder: 'rgba(102, 102, 102, 0.4)',
    shadow: 'rgba(102, 102, 102, 0.3)',
    chipShadow: 'rgba(102, 102, 102, 0.4)',
    chipHoverShadow: 'rgba(102, 102, 102, 0.6)',
  };

  const getStatusStyles = (status) => {
    return STATUS_COLORS[status] || DEFAULT_COLORS;
  };

  // Status mapping function with granular status categories
  const getStatusDisplay = (status) => {
    if (!status || typeof status !== 'string') {
      return "Pending Approval"; // Default to Pending Approval instead of Unknown
    }
    const normalizedStatus = status.trim().toLowerCase();
    switch (normalizedStatus) {
      case "writer submissions (qa)":
        return "Pending Approval";
      case "approved script. ready for production":
        return "Approved - Ready for Production";
      case "finished video":
        return "Video Complete - Pending Upload";
      case "pending":
        return "Pending Approval";
      case "story continuation":
        return "Story Continuation";
      case "rejected":
        return "Rejected";
      case "posted":
        return "Posted";
      default:
        return "Pending Approval"; // Default to Pending Approval for all unknown statuses
    }
  };

  // Enhanced filtering logic with modern search
  const filterSubmissions = () => {
    let filteredSubmissions = [...submissions];

    // Apply modern search query (always active)
    if (searchQuery.trim()) {
      filteredSubmissions = filteredSubmissions.filter((submission) =>
        submission.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Reset filters for "Show All"
    if (filter === "Show All") {
      setStatusFilter(""); // Reset the status filter to show all statuses
      return filteredSubmissions; // Return filtered submissions
    }

    // Filter by Title (legacy filter)
    if (filter === "Title") {
      filteredSubmissions = filteredSubmissions.filter((submission) =>
        submission.title.toLowerCase().includes(searchTitle.toLowerCase())
      );
    }

    // Filter by Custom Date Range (using created_at from your API)
    if (filter === "Custom") {
      filteredSubmissions = filteredSubmissions.filter((submission) => {
        const submissionDate = new Date(submission.created_at);
        return startDate && endDate
          ? submissionDate >= startDate && submissionDate <= endDate
          : true;
      });
    }

    // Filter by Status (using approval_status from your API)
    if (statusFilter && statusFilter !== 'All' && statusFilter !== "All Statuses") {
      filteredSubmissions = filteredSubmissions.filter(
        (submission) => getStatusDisplay(submission.approval_status) === statusFilter
      );
    }

    // Sort by date based on sortOrder (using created_at from your API)
    filteredSubmissions.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return sortOrder === "desc"
        ? dateB.getTime() - dateA.getTime()
        : dateA.getTime() - dateB.getTime();
    });

    return filteredSubmissions;
  };

  const sortedSubmissions = filterSubmissions();

  return (
    <Box>
      {/* Inline CSS for production fallback */}
      <style>
        {`
          .status-posted {
            background-color: rgba(76, 175, 80, 0.05) !important;
            border-color: rgba(76, 175, 80, 0.2) !important;
          }
          .status-posted::before {
            background-color: #4CAF50 !important;
          }
          .status-posted::after {
            background-color: #4CAF50 !important;
          }
          .status-rejected {
            background-color: rgba(244, 67, 54, 0.05) !important;
            border-color: rgba(244, 67, 54, 0.2) !important;
          }
          .status-rejected::before {
            background-color: #F44336 !important;
          }
          .status-rejected::after {
            background-color: #F44336 !important;
          }
          .status-pending {
            background-color: rgba(255, 152, 0, 0.05) !important;
            border-color: rgba(255, 152, 0, 0.2) !important;
          }
          .status-pending::before {
            background-color: #FF9800 !important;
          }
          .status-pending::after {
            background-color: #FF9800 !important;
          }
          .status-under-review {
            background-color: rgba(33, 150, 243, 0.05) !important;
            border-color: rgba(33, 150, 243, 0.2) !important;
          }
          .status-under-review::before {
            background-color: #2196F3 !important;
          }
          .status-under-review::after {
            background-color: #2196F3 !important;
          }
          .status-draft {
            background-color: rgba(158, 158, 158, 0.05) !important;
            border-color: rgba(158, 158, 158, 0.2) !important;
          }
          .status-draft::before {
            background-color: #9E9E9E !important;
          }
          .status-draft::after {
            background-color: #9E9E9E !important;
          }
          .chip-posted {
            background-color: #4CAF50 !important;
            border-color: #4CAF50 !important;
          }
          .chip-rejected {
            background-color: #F44336 !important;
            border-color: #F44336 !important;
          }
          .chip-pending {
            background-color: #FF9800 !important;
            border-color: #FF9800 !important;
          }
          .chip-under-review {
            background-color: #2196F3 !important;
            border-color: #2196F3 !important;
          }
          .chip-draft {
            background-color: #9E9E9E !important;
            border-color: #9E9E9E !important;
          }
          .status-pending-approval {
            background-color: rgba(33, 150, 243, 0.05) !important; /* light blue background */
            border-color: rgba(33, 150, 243, 0.2) !important;
          }
          .status-pending-approval::before,
          .status-pending-approval::after {
            background-color: #2196F3 !important; /* blue */
          }
          .status-pending-posting {
            background-color: rgba(255, 152, 0, 0.05) !important; /* orange */
            border-color: rgba(255, 152, 0, 0.2) !important;
          }
          .status-pending-posting::before,
          .status-pending-posting::after {
            background-color: #FF9800 !important;
          }
          .chip-pending-approval {
            background-color: #2196F3 !important;
            border-color: #2196F3 !important;
          }
          .chip-pending-posting {
            background-color: #FF9800 !important;
            border-color: #FF9800 !important;
          }
          .status-approved-ready-for-production {
            background-color: rgba(255, 152, 0, 0.05) !important;
            border-color: rgba(255, 152, 0, 0.2) !important;
          }
          .status-approved-ready-for-production::before,
          .status-approved-ready-for-production::after {
            background-color: #FF9800 !important;
          }
          .chip-approved-ready-for-production {
            background-color: #FF9800 !important;
            border-color: #FF9800 !important;
          }
          .status-video-complete-pending-upload {
            background-color: rgba(156, 39, 176, 0.05) !important;
            border-color: rgba(156, 39, 176, 0.2) !important;
          }
          .status-video-complete-pending-upload::before,
          .status-video-complete-pending-upload::after {
            background-color: #9C27B0 !important;
          }
          .chip-video-complete-pending-upload {
            background-color: #9C27B0 !important;
            border-color: #9C27B0 !important;
          }
          .status-story-continuation {
            background-color: rgba(96, 125, 139, 0.05) !important;
            border-color: rgba(96, 125, 139, 0.2) !important;
          }
          .status-story-continuation::before,
          .status-story-continuation::after {
            background-color: #607D8B !important;
          }
          .chip-story-continuation {
            background-color: #607D8B !important;
            border-color: #607D8B !important;
          }
        `}
      </style>
      {/* Modern Header */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 3,
        pb: 2,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        gap: 2
      }}>
        <Typography
          variant="h6"
          fontWeight="600"
          sx={{
            color: 'white',
            fontSize: '1.1rem',
            letterSpacing: '0.5px',
            flex: '0 0 auto'
          }}
        >
          Previous Submissions
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexShrink: 0 }}>
          <IconButton
            onClick={onRefresh}
            size="small"
            sx={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
              backdropFilter: 'blur(10px)',
              color: 'white',
              borderRadius: '10px',
              width: 36,
              height: 36,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              '&:hover': {
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
              },
              transition: 'all 0.3s ease'
            }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
          <Button
            startIcon={<FilterIcon />}
            onClick={handleFilterClick}
            size="small"
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              fontWeight: '500',
              borderRadius: '8px',
              px: 2.5,
              py: 0.8,
              fontSize: '12px',
              textTransform: 'none',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
              minWidth: 'auto',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a67d8 0%, #667eea 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
              },
              transition: 'all 0.2s ease'
            }}
          >
            Filters
          </Button>
          <Button
            startIcon={<SortIcon />}
            onClick={handleSortClick}
            size="small"
            sx={{
              background: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(5px)',
              color: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontWeight: '500',
              borderRadius: '8px',
              px: 2.5,
              py: 0.8,
              fontSize: '12px',
              textTransform: 'none',
              minWidth: 'auto',
              '&:hover': {
                background: 'rgba(102, 126, 234, 0.1)',
                borderColor: 'rgba(102, 126, 234, 0.3)',
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.15)'
              },
              transition: 'all 0.2s ease'
            }}
          >
            Sort By {sortBy}
          </Button>
        </Box>
      </Box>

      {/* Modern Search Bar */}
      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          placeholder="Search submissions by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="medium"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#667eea', fontSize: '20px' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              background: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(5px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              transition: 'all 0.2s ease',
              height: '44px',
              '& fieldset': { border: 'none' },
              '&:hover': {
                border: '1px solid rgba(102, 126, 234, 0.3)',
                background: 'rgba(255, 255, 255, 0.06)',
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.1)',
              },
              '&.Mui-focused': {
                border: '1px solid rgba(102, 126, 234, 0.5)',
                background: 'rgba(255, 255, 255, 0.08)',
                boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)',
              },
            },
            '& .MuiInputBase-input': {
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '14px',
              fontWeight: '400',
              padding: '12px 14px',
              '&::placeholder': {
                color: 'rgba(255, 255, 255, 0.5)',
                opacity: 1,
              },
            },
          }}
        />
      </Box>

      {/* Enhanced Filter Menu */}
      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={handleFilterClose}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#1a1a1a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(10px)',
              mt: 1,
              minWidth: '250px'
            }
          }
        }}
      >
        <MenuItem
          onClick={() => setFilter("")}
          sx={{
            color: 'white',
            fontSize: '0.9rem',
            py: 1.5,
            px: 2,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              transform: 'translateX(4px)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Show All
        </MenuItem>
        <MenuItem
          onClick={() => setFilter("Custom")}
          sx={{
            color: 'white',
            fontSize: '0.9rem',
            py: 1.5,
            px: 2,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              transform: 'translateX(4px)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Custom Date
        </MenuItem>
        <MenuItem
          onClick={() => setFilter("Title")}
          sx={{
            color: 'white',
            fontSize: '0.9rem',
            py: 1.5,
            px: 2,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              transform: 'translateX(4px)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Title
        </MenuItem>
        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
        <MenuItem
          onClick={() => setStatusFilter("")}
          sx={{
            color: 'white',
            fontSize: '0.9rem',
            py: 1.5,
            px: 2,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              transform: 'translateX(4px)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          All Statuses
        </MenuItem>
        <MenuItem
          onClick={() => setStatusFilter("Rejected")}
          sx={{
            color: 'white',
            fontSize: '0.9rem',
            py: 1.5,
            px: 2,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              transform: 'translateX(4px)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Rejected
        </MenuItem>

        <MenuItem
          onClick={() => setStatusFilter("Pending Approval")}
          sx={{
            color: 'white',
            fontSize: '0.9rem',
            py: 1.5,
            px: 2,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              transform: 'translateX(4px)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Pending Approval
        </MenuItem>
        <MenuItem
          onClick={() => setStatusFilter("Approved - Ready for Production")}
          sx={{
            color: 'white',
            fontSize: '0.9rem',
            py: 1.5,
            px: 2,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              transform: 'translateX(4px)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Approved - Ready for Production
        </MenuItem>
        <MenuItem
          onClick={() => setStatusFilter("Video Complete - Pending Upload")}
          sx={{
            color: 'white',
            fontSize: '0.9rem',
            py: 1.5,
            px: 2,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              transform: 'translateX(4px)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Video Complete - Pending Upload
        </MenuItem>
        <MenuItem
          onClick={() => setStatusFilter("Story Continuation")}
          sx={{
            color: 'white',
            fontSize: '0.9rem',
            py: 1.5,
            px: 2,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              transform: 'translateX(4px)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Story Continuation
        </MenuItem>
        <MenuItem
          onClick={() => setStatusFilter("Posted")}
          sx={{
            color: 'white',
            fontSize: '0.9rem',
            py: 1.5,
            px: 2,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              transform: 'translateX(4px)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Posted
        </MenuItem>
      </Menu>

      {/* Enhanced Sort Menu */}
      <Menu
        anchorEl={sortAnchorEl}
        open={Boolean(sortAnchorEl)}
        onClose={handleSortClose}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#1a1a1a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(10px)',
              mt: 1
            }
          }
        }}
      >
        <MenuItem
          onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
          sx={{
            color: 'white',
            fontSize: '0.9rem',
            py: 1.5,
            px: 2,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              transform: 'translateX(4px)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Sort By Date ({sortOrder === "desc" ? "Newest First" : "Oldest First"})
        </MenuItem>
        {['Title', 'Status'].map((sort) => (
          <MenuItem
            key={sort}
            onClick={() => handleSortChange(sort)}
            selected={sortBy === sort}
            sx={{
              color: 'white',
              fontSize: '0.9rem',
              py: 1.5,
              px: 2,
              '&.Mui-selected': {
                bgcolor: 'rgba(230, 184, 0, 0.2)',
                color: '#E6B800',
                fontWeight: '600'
              },
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                transform: 'translateX(4px)'
              },
              transition: 'all 0.2s ease'
            }}
          >
            {sort}
          </MenuItem>
        ))}
      </Menu>

      {/* Search by Title Filter */}
      {filter === "Title" && (
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search by title"
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#2A2A2A',
                border: '1px solid #555',
                '& fieldset': { border: 'none' },
                '&:hover fieldset': { border: 'none' },
                '&.Mui-focused fieldset': { border: '1px solid #E6B800' },
              },
              '& .MuiInputBase-input': { color: 'white' },
            }}
          />
        </Box>
      )}

      {/* Custom Date Range Filter */}
      {filter === "Custom" && (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(date) => setStartDate(date)}
              slotProps={{
                textField: {
                  size: 'small',
                  sx: {
                    '& .MuiOutlinedInput-root': {
                      bgcolor: '#2A2A2A',
                      border: '1px solid #555',
                      '& fieldset': { border: 'none' },
                      '&:hover fieldset': { border: 'none' },
                      '&.Mui-focused fieldset': { border: '1px solid #E6B800' },
                    },
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                    '& .MuiSvgIcon-root': { color: 'rgba(255, 255, 255, 0.7)' },
                  }
                }
              }}
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={(date) => setEndDate(date)}
              slotProps={{
                textField: {
                  size: 'small',
                  sx: {
                    '& .MuiOutlinedInput-root': {
                      bgcolor: '#2A2A2A',
                      border: '1px solid #555',
                      '& fieldset': { border: 'none' },
                      '&:hover fieldset': { border: 'none' },
                      '&.Mui-focused fieldset': { border: '1px solid #E6B800' },
                    },
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                    '& .MuiSvgIcon-root': { color: 'rgba(255, 255, 255, 0.7)' },
                  }
                }
              }}
            />
            <Button
              variant="contained"
              onClick={() => setFilter("Custom")}
              sx={{
                bgcolor: '#E6B800',
                color: 'black',
                fontWeight: '600',
                '&:hover': { bgcolor: '#D4A600' },
              }}
            >
              Apply
            </Button>
          </Box>
        </LocalizationProvider>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress
            sx={{
              color: '#E6B800',
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              }
            }}
            size={32}
            thickness={4}
          />
        </Box>
      ) : (
        <Stack spacing={2.5}>
          {sortedSubmissions.map((submission) => {
            // Use mapped status for styling (using approval_status from your API)
            const displayStatus = getStatusDisplay(submission.approval_status);
            const styles = getStatusStyles(displayStatus);
            // Generate CSS class name for fallback
            const statusClass = `status-${displayStatus.toLowerCase().replace(' ', '-')}`;
            const chipClass = `chip-${displayStatus.toLowerCase().replace(' ', '-')}`;

            // Show exact title as stored in database - no parsing
            const exactTitle = submission.title;

            return (
              <Box
                key={submission.id}
                className={statusClass}
                style={{
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  borderRadius: '12px',
                  padding: '18px',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(102, 126, 234, 0.15)',
                  transform: 'translateY(-2px)',
                }}
                sx={{
                  '&:hover': {
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%)',
                    borderColor: 'rgba(102, 126, 234, 0.4)',
                    transform: 'translateY(-6px)',
                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.1), 0 4px 16px rgba(102, 126, 234, 0.25)',
                  }
                }}
              >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                <Typography
                  variant="h6"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontWeight: '500',
                    flex: 1,
                    mr: 2,
                    fontSize: '0.95rem',
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {exactTitle}
                </Typography>
                <Chip
                  label={displayStatus}
                  size="small"
                  className={chipClass}
                  style={{
                    backgroundColor: styles.base,
                    color: 'white',
                    fontWeight: '500',
                    fontSize: '0.7rem',
                    height: '22px',
                    borderRadius: '11px',
                    border: `1px solid ${styles.base}`,
                    boxShadow: `0 1px 4px ${styles.chipShadow}`,
                  }}
                  sx={{
                    '& .MuiChip-label': {
                      px: 1.2
                    },
                    '&:hover': {
                      transform: 'scale(1.02)',
                      boxShadow: `0 2px 6px ${styles.chipHoverShadow}`,
                    },
                    transition: 'all 0.2s ease'
                  }}
                />
              </Box>

              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  mb: 2,
                  fontSize: '0.8rem'
                }}
              >
                Submitted on {new Date(submission.created_at).toLocaleDateString()}
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {submission.google_doc_link && (
                    <Button
                      startIcon={<DocIcon />}
                      size="small"
                      onClick={() => window.open(submission.google_doc_link, '_blank')}
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        fontWeight: '500',
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        px: 1.5,
                        py: 0.6,
                        textTransform: 'none',
                        boxShadow: '0 1px 4px rgba(102, 126, 234, 0.3)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5a67d8 0%, #667eea 100%)',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Open Doc
                    </Button>
                  )}
                  {submission.loom_url && displayStatus === 'Rejected' && (
                    <Button
                      size="small"
                      onClick={() => window.open(submission.loom_url, '_blank')}
                      sx={{
                        bgcolor: 'rgba(156, 39, 176, 0.8)',
                        color: 'white',
                        fontWeight: '500',
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        px: 1.5,
                        py: 0.6,
                        textTransform: 'none',
                        boxShadow: '0 1px 4px rgba(156, 39, 176, 0.3)',
                        '&:hover': {
                          bgcolor: 'rgba(156, 39, 176, 1)',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(156, 39, 176, 0.4)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      View Feedback
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
            );
          })}

          {sortedSubmissions.length === 0 && (
            <Box sx={{
              textAlign: 'center',
              py: 6,
              bgcolor: 'rgba(255, 255, 255, 0.01)',
              borderRadius: '12px',
              border: '1px dashed rgba(255, 255, 255, 0.08)'
            }}>
              <Typography sx={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '0.9rem',
                fontWeight: '400'
              }}>
                {statusFilter === 'All' ? 'No submissions found' : `No ${statusFilter.toLowerCase()} submissions found`}
              </Typography>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
};

export default PreviousSubmissions;