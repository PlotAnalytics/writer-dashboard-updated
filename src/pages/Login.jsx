import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  Avatar,
  IconButton,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility,
  VisibilityOff,
  VideoLibrary,
  Analytics,
  TrendingUp,
  PlayCircle
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext.jsx';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      // Navigation will be handled by useEffect when user state updates
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 20% 20%, rgba(102, 126, 234, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(118, 75, 162, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 60%, rgba(102, 126, 234, 0.08) 0%, transparent 50%)
          `,
          animation: 'backgroundFloat 8s ease-in-out infinite',
        },
        '@keyframes backgroundFloat': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-10px) rotate(1deg)' },
          '66%': { transform: 'translateY(5px) rotate(-1deg)' },
        },
        '@keyframes float3D': {
          '0%, 100%': { transform: 'translateY(0px) translateZ(0px) rotateX(0deg)' },
          '50%': { transform: 'translateY(-20px) translateZ(10px) rotateX(5deg)' },
        },
        '@keyframes rotate3D': {
          '0%': { transform: 'rotateY(0deg) rotateX(0deg)' },
          '100%': { transform: 'rotateY(360deg) rotateX(360deg)' },
        },
        '@keyframes pulse3D': {
          '0%, 100%': { transform: 'scale(1) rotateZ(0deg)', boxShadow: '0 0 20px rgba(102, 126, 234, 0.3)' },
          '50%': { transform: 'scale(1.1) rotateZ(180deg)', boxShadow: '0 0 40px rgba(102, 126, 234, 0.6)' },
        },
      }}
    >
      {/* Modern 3D Animated Background Elements */}
      <Box
        sx={{
          position: 'absolute',
          top: '15%',
          left: '8%',
          width: '120px',
          height: '120px',
          background: 'linear-gradient(45deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.1))',
          borderRadius: '20px',
          animation: 'float3D 6s ease-in-out infinite',
          animationDelay: '0s',
          transform: 'perspective(1000px)',
          boxShadow: '0 10px 30px rgba(102, 126, 234, 0.2)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(102, 126, 234, 0.3)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '60%',
          right: '10%',
          width: '80px',
          height: '80px',
          background: 'linear-gradient(135deg, rgba(118, 75, 162, 0.2), transparent)',
          borderRadius: '50%',
          animation: 'rotate3D 20s linear infinite',
          animationDelay: '2s',
          transform: 'perspective(1000px)',
          border: '1px solid rgba(118, 75, 162, 0.4)',
          backdropFilter: 'blur(5px)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '25%',
          right: '20%',
          width: '60px',
          height: '60px',
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15))',
          borderRadius: '10px',
          animation: 'pulse3D 4s ease-in-out infinite',
          animationDelay: '1s',
          transform: 'perspective(1000px)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(102, 126, 234, 0.2)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '20%',
          left: '15%',
          width: '100px',
          height: '100px',
          background: 'linear-gradient(90deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.08))',
          borderRadius: '15px',
          animation: 'float3D 8s ease-in-out infinite',
          animationDelay: '3s',
          transform: 'perspective(1000px) rotateY(45deg)',
          border: '1px solid rgba(102, 126, 234, 0.2)',
          backdropFilter: 'blur(6px)',
        }}
      />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
        >
          {/* Modern Header Section */}
          <Box textAlign="center" mb={4}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                mb: 3,
                mx: 'auto',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
                border: '2px solid rgba(102, 126, 234, 0.3)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <EditIcon sx={{ fontSize: 40, color: 'white' }} />
            </Avatar>

            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontWeight: 700,
                mb: 1,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
              }}
            >
              Writer Studio
            </Typography>

            <Typography
              variant="h6"
              sx={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontWeight: 400,
                mb: 1,
                fontSize: '18px',
              }}
            >
              Professional Content Dashboard
            </Typography>

            {/* Modern Feature Chips */}
            <Box display="flex" justifyContent="center" gap={2} flexWrap="wrap" mt={3}>
              <Chip
                icon={<Analytics />}
                label="Analytics"
                size="medium"
                sx={{
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
                  backdropFilter: 'blur(10px)',
                  color: '#667eea',
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                  fontWeight: '600',
                  '&:hover': {
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                  },
                  transition: 'all 0.3s ease',
                }}
              />
              <Chip
                icon={<VideoLibrary />}
                label="Content"
                size="medium"
                sx={{
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
                  backdropFilter: 'blur(10px)',
                  color: '#667eea',
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                  fontWeight: '600',
                  '&:hover': {
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                  },
                  transition: 'all 0.3s ease',
                }}
              />
              <Chip
                icon={<TrendingUp />}
                label="Growth"
                size="medium"
                sx={{
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
                  backdropFilter: 'blur(10px)',
                  color: '#667eea',
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                  fontWeight: '600',
                  '&:hover': {
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                  },
                  transition: 'all 0.3s ease',
                }}
              />
            </Box>
          </Box>

          {/* Modern Login Card */}
          <Card
            sx={{
              width: '100%',
              maxWidth: 450,
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(102, 126, 234, 0.2), inset 0 1px 0 rgba(102, 126, 234, 0.2)',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(102, 126, 234, 0.5) 50%, transparent 100%)',
                borderRadius: '20px 20px 0 0',
              }
            }}
          >
            <CardContent sx={{ p: 4 }}>
              {error && (
                <Alert
                  severity="error"
                  sx={{
                    mb: 3,
                    background: 'linear-gradient(135deg, rgba(244, 67, 54, 0.1) 0%, rgba(244, 67, 54, 0.05) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(244, 67, 54, 0.3)',
                    borderRadius: '12px',
                    color: '#ff6b6b',
                  }}
                >
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  margin="normal"
                  required
                  autoComplete="username"
                  autoFocus
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '12px',
                      '& fieldset': {
                        borderColor: 'rgba(102, 126, 234, 0.3)',
                        border: '1px solid rgba(102, 126, 234, 0.3)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(102, 126, 234, 0.6)',
                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.1)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#667eea',
                        borderWidth: '2px',
                        boxShadow: '0 4px 20px rgba(102, 126, 234, 0.2)',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(102, 126, 234, 0.8)',
                      fontWeight: '500',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#667eea',
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'white',
                      fontSize: '16px',
                    },
                  }}
                />

                <TextField
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  margin="normal"
                  required
                  autoComplete="current-password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          sx={{ color: 'rgba(102, 126, 234, 0.7)' }}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '12px',
                      '& fieldset': {
                        borderColor: 'rgba(102, 126, 234, 0.3)',
                        border: '1px solid rgba(102, 126, 234, 0.3)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(102, 126, 234, 0.6)',
                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.1)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#667eea',
                        borderWidth: '2px',
                        boxShadow: '0 4px 20px rgba(102, 126, 234, 0.2)',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(102, 126, 234, 0.8)',
                      fontWeight: '500',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#667eea',
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'white',
                      fontSize: '16px',
                    },
                  }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading}
                  sx={{
                    mt: 4,
                    mb: 2,
                    py: 2,
                    fontSize: '16px',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderRadius: '12px',
                    textTransform: 'none',
                    boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
                    border: '1px solid rgba(102, 126, 234, 0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a67d8 0%, #667eea 100%)',
                      boxShadow: '0 6px 25px rgba(102, 126, 234, 0.6)',
                      transform: 'translateY(-2px)',
                    },
                    '&:disabled': {
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                      color: 'rgba(255, 255, 255, 0.5)',
                      boxShadow: 'none',
                      transform: 'none',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  {loading ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          border: '2px solid rgba(0,0,0,0.3)',
                          borderTop: '2px solid black',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          '@keyframes spin': {
                            '0%': { transform: 'rotate(0deg)' },
                            '100%': { transform: 'rotate(360deg)' },
                          },
                        }}
                      />
                      Signing In...
                    </Box>
                  ) : (
                    <Box display="flex" alignItems="center" gap={1}>
                      <PlayCircle />
                      Enter Studio
                    </Box>
                  )}
                </Button>
              </form>


            </CardContent>
          </Card>

          {/* Modern Footer */}
          <Box mt={4} textAlign="center">
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(102, 126, 234, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                fontWeight: '500',
              }}
            >
              Powered by modern technology
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Login;
