import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Card,
  CardContent,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import BigHeadAvatar from './BigHeadAvatar.jsx';

const AvatarSelector = ({ currentSeed, onSeedChange, userName }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Generate random avatar seeds for selection
  const generateRandomSeeds = () => {
    const seeds = [];
    const baseSeeds = [
      userName, // Current username
      `${userName}_1`,
      `${userName}_2`, 
      `${userName}_3`,
      `${userName}_cool`,
      `${userName}_pro`,
      `${userName}_star`,
      `${userName}_ninja`,
      `${userName}_hero`,
      `${userName}_legend`,
      `${userName}_master`,
      `${userName}_ace`,
    ];
    
    // Add some completely random seeds
    for (let i = 0; i < 8; i++) {
      seeds.push(`${userName}_${Math.random().toString(36).substring(2, 8)}`);
    }
    
    return [...baseSeeds, ...seeds].slice(0, 20); // Show 20 options
  };

  const [availableSeeds, setAvailableSeeds] = useState(generateRandomSeeds());
  const [selectedSeed, setSelectedSeed] = useState(currentSeed || userName);

  const handleSeedSelect = (seed) => {
    setSelectedSeed(seed);
  };

  const handleSave = () => {
    onSeedChange(selectedSeed);
  };

  const handleRefresh = () => {
    // Generate new random seeds
    const newSeeds = generateRandomSeeds();
    setAvailableSeeds(newSeeds);
  };

  return (
    <Box>
      <Typography
        variant="h6"
        sx={{
          color: 'white',
          fontWeight: 600,
          mb: 3,
          textAlign: 'center'
        }}
      >
        Choose Your Avatar
      </Typography>

      {/* Current Selection Preview */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          mb: 4,
          p: 3,
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Typography
          variant="body2"
          sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}
        >
          Current Selection
        </Typography>
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid #667eea',
            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
            background: 'white',
            mb: 2,
          }}
        >
          <BigHeadAvatar
            name={userName}
            avatarSeed={selectedSeed}
            size={74}
          />
        </Box>
        <Typography
          variant="body2"
          sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem' }}
        >
          {selectedSeed}
        </Typography>
      </Box>

      {/* Avatar Grid */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography
            variant="body1"
            sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
          >
            Select an Avatar
          </Typography>
          <IconButton
            onClick={handleRefresh}
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': {
                color: '#667eea',
                bgcolor: 'rgba(102, 126, 234, 0.1)',
              },
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Box>

        <Grid container spacing={2}>
          {availableSeeds.map((seed, index) => (
            <Grid item xs={3} sm={2.4} md={2} key={seed}>
              <Card
                sx={{
                  background: selectedSeed === seed 
                    ? 'rgba(102, 126, 234, 0.2)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  border: selectedSeed === seed 
                    ? '2px solid #667eea' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)',
                    border: '2px solid rgba(102, 126, 234, 0.5)',
                  },
                }}
                onClick={() => handleSeedSelect(seed)}
              >
                <CardContent
                  sx={{
                    p: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    '&:last-child': { pb: 1.5 },
                  }}
                >
                  <Box
                    sx={{
                      width: isMobile ? 40 : 50,
                      height: isMobile ? 40 : 50,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: 'white',
                      mb: 1,
                    }}
                  >
                    <BigHeadAvatar
                      name={userName}
                      avatarSeed={seed}
                      size={isMobile ? 36 : 46}
                    />
                  </Box>
                  
                  {selectedSeed === seed && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        bgcolor: '#667eea',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CheckIcon sx={{ fontSize: 12, color: 'white' }} />
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={selectedSeed === currentSeed}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            px: 4,
            py: 1.5,
            borderRadius: '12px',
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
              boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
            },
            '&:disabled': {
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.5)',
              boxShadow: 'none',
            },
          }}
        >
          {selectedSeed === currentSeed ? 'No Changes' : 'Save Avatar'}
        </Button>
      </Box>
    </Box>
  );
};

export default AvatarSelector;
