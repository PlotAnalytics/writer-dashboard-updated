import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Container,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  IconButton,
  Link
} from '@mui/material';
import { Visibility, VisibilityOff, Edit as EditIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    email: '',
    registrationCode: '',
    writerType: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/auth/register', formData);
      
      if (response.data.success) {
        setSuccess('Account request submitted successfully! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `
          linear-gradient(135deg, 
            #0a0a0a 0%, 
            #1a1a1a 25%,
            #0f0f0f 50%,
            #151515 75%,
            #0a0a0a 100%
          )
        `,
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
            radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.02) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.01) 0%, transparent 50%),
            linear-gradient(180deg, transparent 0%, rgba(255, 255, 255, 0.005) 100%)
          `,
        },
        '@keyframes subtlePulse': {
          '0%, 100%': { opacity: 0.8 },
          '50%': { opacity: 1 },
        },
        '@keyframes slideUp': {
          '0%': { transform: 'translateY(20px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
      }}
    >
      {/* Subtle Background Elements */}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: '2px',
          height: '100px',
          background: 'linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
          animation: 'subtlePulse 4s ease-in-out infinite',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '20%',
          right: '8%',
          width: '1px',
          height: '60px',
          background: 'linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.08), transparent)',
          animation: 'subtlePulse 6s ease-in-out infinite',
          animationDelay: '2s',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '15%',
          left: '10%',
          width: '1px',
          height: '80px',
          background: 'linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.06), transparent)',
          animation: 'subtlePulse 5s ease-in-out infinite',
          animationDelay: '1s',
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
          {/* CIA-Style Header */}
          <Box textAlign="center" mb={6} sx={{ animation: 'slideUp 0.8s ease-out' }}>
            <Box
              sx={{
                width: 60,
                height: 60,
                mb: 4,
                mx: 'auto',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)',
              }}
            >
              <EditIcon sx={{ fontSize: 28, color: 'rgba(255, 255, 255, 0.9)' }} />
            </Box>

            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 300,
                mb: 2,
                color: 'rgba(255, 255, 255, 0.95)',
                fontSize: '2.2rem',
                letterSpacing: '0.5px',
                fontFamily: '"SF Pro Display", "Helvetica Neue", Arial, sans-serif',
              }}
            >
              PLOTPOINTE
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontWeight: 300,
                fontSize: '14px',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                fontFamily: 'monospace',
              }}
            >
              Writer Registration Portal
            </Typography>
          </Box>

          {/* CIA-Style Registration Panel */}
          <Card
            sx={{
              width: '100%',
              maxWidth: 450,
              background: 'rgba(255, 255, 255, 0.02)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              position: 'relative',
              animation: 'slideUp 1s ease-out 0.2s both',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'rgba(255, 255, 255, 0.1)',
              }
            }}
          >
            <CardContent sx={{ p: 5 }}>
              {/* Access Header */}
              <Box textAlign="center" mb={4}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '12px',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    fontFamily: 'monospace',
                    mb: 1,
                  }}
                >
                  New Writer Registration
                </Typography>
                <Box
                  sx={{
                    width: '40px',
                    height: '1px',
                    background: 'rgba(255, 255, 255, 0.3)',
                    mx: 'auto',
                  }}
                />
              </Box>

              {error && (
                <Alert
                  severity="error"
                  sx={{
                    mb: 3,
                    background: 'rgba(220, 38, 38, 0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    borderRadius: '4px',
                    color: 'rgba(248, 113, 113, 0.9)',
                    '& .MuiAlert-icon': {
                      color: 'rgba(248, 113, 113, 0.9)',
                    },
                  }}
                >
                  {error}
                </Alert>
              )}

              {success && (
                <Alert
                  severity="success"
                  sx={{
                    mb: 3,
                    background: 'rgba(34, 197, 94, 0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '4px',
                    color: 'rgba(74, 222, 128, 0.9)',
                    '& .MuiAlert-icon': {
                      color: 'rgba(74, 222, 128, 0.9)',
                    },
                  }}
                >
                  {success}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                {/* Writer Type Selection */}
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel 
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontWeight: '400',
                      fontSize: '14px',
                      '&.Mui-focused': {
                        color: 'rgba(255, 255, 255, 0.9)',
                      },
                    }}
                  >
                    Writer Type
                  </InputLabel>
                  <Select
                    name="writerType"
                    value={formData.writerType}
                    onChange={handleChange}
                    required
                    sx={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '4px',
                      height: '50px',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.6)',
                        borderWidth: '1px',
                      },
                      '& .MuiSelect-select': {
                        color: 'rgba(255, 255, 255, 0.95)',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                      },
                      '& .MuiSvgIcon-root': {
                        color: 'rgba(255, 255, 255, 0.7)',
                      },
                    }}
                  >
                    <MenuItem value="interviewed">Being Interviewed</MenuItem>
                    <MenuItem value="part-time">Part Time Writer</MenuItem>
                    <MenuItem value="full-time">Full Time Writer</MenuItem>
                    <MenuItem value="stl">STL Writer</MenuItem>
                  </Select>
                </FormControl>

                {/* First Name */}
                <TextField
                  fullWidth
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  margin="normal"
                  required
                  sx={{
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      background: 'rgba(255, 255, 255, 0.03)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '4px',
                      height: '50px',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.6)',
                        borderWidth: '1px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontWeight: '400',
                      fontSize: '14px',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: 'rgba(255, 255, 255, 0.9)',
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'rgba(255, 255, 255, 0.95)',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                    },
                  }}
                />

                {/* Last Name */}
                <TextField
                  fullWidth
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  margin="normal"
                  required
                  sx={{
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      background: 'rgba(255, 255, 255, 0.03)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '4px',
                      height: '50px',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.6)',
                        borderWidth: '1px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontWeight: '400',
                      fontSize: '14px',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: 'rgba(255, 255, 255, 0.9)',
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'rgba(255, 255, 255, 0.95)',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                    },
                  }}
                />

                {/* Username */}
                <TextField
                  fullWidth
                  label="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  margin="normal"
                  required
                  sx={{
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      background: 'rgba(255, 255, 255, 0.03)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '4px',
                      height: '50px',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.6)',
                        borderWidth: '1px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontWeight: '400',
                      fontSize: '14px',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: 'rgba(255, 255, 255, 0.9)',
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'rgba(255, 255, 255, 0.95)',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                    },
                  }}
                />

                {/* Email */}
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  margin="normal"
                  required
                  sx={{
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      background: 'rgba(255, 255, 255, 0.03)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '4px',
                      height: '50px',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.6)',
                        borderWidth: '1px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontWeight: '400',
                      fontSize: '14px',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: 'rgba(255, 255, 255, 0.9)',
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'rgba(255, 255, 255, 0.95)',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                    },
                  }}
                />

                {/* Password */}
                <TextField
                  fullWidth
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  margin="normal"
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          sx={{
                            color: 'rgba(255, 255, 255, 0.5)',
                            '&:hover': {
                              color: 'rgba(255, 255, 255, 0.8)',
                              background: 'rgba(255, 255, 255, 0.05)',
                            }
                          }}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      background: 'rgba(255, 255, 255, 0.03)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '4px',
                      height: '50px',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.6)',
                        borderWidth: '1px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontWeight: '400',
                      fontSize: '14px',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: 'rgba(255, 255, 255, 0.9)',
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'rgba(255, 255, 255, 0.95)',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                    },
                  }}
                />

                {/* Registration Code */}
                <TextField
                  fullWidth
                  label="Registration Code"
                  name="registrationCode"
                  value={formData.registrationCode}
                  onChange={handleChange}
                  margin="normal"
                  required
                  sx={{
                    mb: 4,
                    '& .MuiOutlinedInput-root': {
                      background: 'rgba(255, 255, 255, 0.03)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '4px',
                      height: '50px',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.6)',
                        borderWidth: '1px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontWeight: '400',
                      fontSize: '14px',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: 'rgba(255, 255, 255, 0.9)',
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'rgba(255, 255, 255, 0.95)',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                    },
                  }}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading}
                  sx={{
                    mt: 2,
                    mb: 3,
                    py: 1.5,
                    fontSize: '14px',
                    fontWeight: 400,
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    fontFamily: 'monospace',
                    '&:hover': {
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderColor: 'rgba(255, 255, 255, 0.4)',
                    },
                    '&:disabled': {
                      background: 'rgba(255, 255, 255, 0.02)',
                      color: 'rgba(255, 255, 255, 0.4)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  {loading ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTop: '2px solid rgba(255,255,255,0.9)',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          '@keyframes spin': {
                            '0%': { transform: 'rotate(0deg)' },
                            '100%': { transform: 'rotate(360deg)' },
                          },
                        }}
                      />
                      Creating Account...
                    </Box>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* CIA Footer */}
          <Box mt={6} textAlign="center">
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '11px',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                fontFamily: 'monospace',
                mb: 2,
              }}
            >
              Already have an account?{' '}
              <Link
                component="button"
                type="button"
                onClick={() => navigate('/login')}
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  textDecoration: 'underline',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  '&:hover': {
                    color: 'rgba(255, 255, 255, 0.9)',
                  },
                }}
              >
                Sign In
              </Link>
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '11px',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                fontFamily: 'monospace',
              }}
            >
              Classified • Secure • Authorized Personnel Only
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Register;
