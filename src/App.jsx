import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import WriterDashboard from './pages/WriterDashboard.jsx';
import Analytics from './pages/Analytics.jsx';
import Content from './pages/Content.jsx';
import VideoAnalytics from './pages/VideoAnalytics.jsx';
import Settings from './pages/Settings.jsx';
import RetentionMaster from './pages/RetentionMaster.jsx';

import './styles/mobile-responsive.css';
import './styles/mobile-fixes.css';
import { useAuth } from './contexts/AuthContext.jsx';

// Component to handle root redirect based on user role
const RootRedirect = () => {
  const { user } = useAuth();

  if (user?.role === 'retention_master') {
    return <Navigate to="/retention-master" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#f4c430', // Golden yellow for buttons
    },
    secondary: {
      main: '#4fc3f7', // Light blue for accents
    },
    background: {
      default: '#1a1a1a',
      paper: '#2d2d2d',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    // Mobile-friendly typography scaling
    h4: {
      '@media (max-width:768px)': {
        fontSize: '1.5rem',
      },
    },
    h5: {
      '@media (max-width:768px)': {
        fontSize: '1.25rem',
      },
    },
    h6: {
      '@media (max-width:768px)': {
        fontSize: '1.1rem',
      },
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 768,
      lg: 1200,
      xl: 1536,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          '@media (max-width:768px)': {
            padding: '8px 16px',
            fontSize: '14px',
            minWidth: 'auto',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          '@media (max-width:768px)': {
            marginBottom: '16px',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          '@media (max-width:768px)': {
            padding: '16px',
            '&:last-child': {
              paddingBottom: '16px',
            },
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '@media (max-width:768px)': {
            padding: '8px',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          '@media (max-width:768px)': {
            minHeight: '40px',
            padding: '6px 12px',
            fontSize: '14px',
            minWidth: 'auto',
          },
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          '@media (max-width:768px)': {
            marginBottom: '16px',
            width: '100%',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          '@media (max-width:768px)': {
            margin: '16px',
            width: 'calc(100vw - 32px)',
            maxWidth: 'none',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          '@media (max-width:768px)': {
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          },
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/retention-master"
              element={
                <ProtectedRoute>
                  <RetentionMaster />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/content"
              element={
                <ProtectedRoute>
                  <Content />
                </ProtectedRoute>
              }
            />
            <Route
              path="/content/video/:id"
              element={
                <ProtectedRoute>
                  <VideoAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/support"
              element={
                <ProtectedRoute>
                  <WriterDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <RootRedirect />
                </ProtectedRoute>
              }
            />

            {/* Catch-all route for any unmatched paths */}
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <RootRedirect />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
