import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  Button,
  FormControl,
  Alert,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Chip,
  Stack,
  TableSortLabel,
  Tabs,
  Tab,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  InputLabel,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from "@mui/material";
import {
  LogoutOutlined,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
} from "@mui/icons-material";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

const PLATFORM_OPTIONS = [
  "YouTube",
  "TikTok",
  "Twitch",
  "Facebook",
  "Instagram",
  "Twitter",
  "LinkedIn",
];
const STATUS_OPTIONS = ["Active", "Inactive", "Reserved", "Exclusive"];

const MasterEditor = () => {
  // Tab state
  const [currentTab, setCurrentTab] = useState(0);
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingScript, setEditingScript] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState({});
  const [selectedStructures, setSelectedStructures] = useState({});
  const [writerFilter, setWriterFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // 'asc' or 'desc'
  const [availableWriters, setAvailableWriters] = useState([]);

  // Admin-related state
  const [saving, setSaving] = useState(false);

  // Posting Accounts state
  const [postingAccounts, setPostingAccounts] = useState([]);
  const [newPostAcct, setNewPostAcct] = useState({
    id: "",
    account: "",
    platform: "YouTube",
    status: "Active",
    writer_id: "",
    daily_limit: 10,
    daily_used: 0,
  });

  // Writer Settings state
  const [writerSettings, setWriterSettings] = useState([]);
  const [newWriterSetting, setNewWriterSetting] = useState({
    id: "",
    writer_id: "",
    writer_name: "",
    writer_fname: "",
    writer_lname: "",
    skip_qa: false,
    post_acct_list: [],
    access_advanced_types: false,
  });

  // Filters
  const [postFilter, setPostFilter] = useState({
    search: "",
    platform: "",
    status: "",
  });
  const [adminWriterFilter, setAdminWriterFilter] = useState({
    search: "",
    skip_qa: "",
    access_advanced_types: "",
  });

  // Debounced search to reduce filtering calculations
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Modals
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postModalMode, setPostModalMode] = useState("create"); // 'create' | 'edit'
  const [postEdit, setPostEdit] = useState(null);

  const [writerModalOpen, setWriterModalOpen] = useState(false);
  const [writerModalMode, setWriterModalMode] = useState("create");
  const [writerEdit, setWriterEdit] = useState(null);

  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const typeOptions = ["Original", "Remix", "Re-write", "STL"];
  const structureOptions = [
    "Payback Revenge",
    "Expectations",
    "Looked Down Upon",
    "Obsession",
    "No Structure",
  ];

  // Memoized functions for admin functionality
  const postingAccountMap = useMemo(() => {
    const map = new Map();
    postingAccounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [postingAccounts]);

  // Memoized render function for posting accounts dropdown to prevent re-renders
  const renderPostingAccountsValue = useMemo(() => {
    return (selected) => (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {selected.map((value) => (
          <Chip
            key={value}
            label={`${
              postingAccountMap.get(value)?.account || value
            } (${value})`}
          />
        ))}
      </Box>
    );
  }, [postingAccountMap]);

  // Memoized function to render posting accounts in table
  const renderPostingAccountsInTable = useMemo(() => {
    return (postAcctList) => {
      let list = [];
      try {
        list = Array.isArray(postAcctList)
          ? postAcctList
          : postAcctList
          ? JSON.parse(postAcctList)
          : [];
      } catch (e) {
        list = [];
      }
      return list
        .map((id) => `${postingAccountMap.get(id)?.account || id} (${id})`)
        .join(", ");
    };
  }, [postingAccountMap]);

  // Memoized function to render truncated posting accounts for table display
  const renderTruncatedPostingAccounts = useMemo(() => {
    return (postAcctList, maxLength = 40) => {
      const fullText = renderPostingAccountsInTable(postAcctList);
      if (fullText.length <= maxLength) {
        return fullText;
      }
      return fullText.substring(0, maxLength) + "...";
    };
  }, [renderPostingAccountsInTable]);

  // Memoized filtered writer settings to prevent recalculation on every render
  const filteredWriterSettings = useMemo(() => {
    return writerSettings
      .filter(
        (w) =>
          !debouncedSearch ||
          (w.writer_name || "")
            .toLowerCase()
            .includes(debouncedSearch.toLowerCase())
      )
      .filter(
        (w) =>
          adminWriterFilter.skip_qa === "" ||
          String(!!w.skip_qa) === adminWriterFilter.skip_qa
      )
      .filter(
        (w) =>
          adminWriterFilter.access_advanced_types === "" ||
          String(!!w.access_advanced_types) ===
            adminWriterFilter.access_advanced_types
      );
  }, [
    writerSettings,
    debouncedSearch,
    adminWriterFilter.skip_qa,
    adminWriterFilter.access_advanced_types,
  ]);

  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(adminWriterFilter.search);
    }, 300);
    return () => clearTimeout(timer);
  }, [adminWriterFilter.search]);

  useEffect(() => {
    // Check if user is master_editor
    if (!user || user.username !== "master_editor") {
      navigate("/login");
      return;
    }

    const init = async () => {
      try {
        setLoading(true);
        // Only fetch posting accounts and writer settings initially
        // Scripts will be fetched when Script Editor tab is selected
        await Promise.all([
          fetchPostingAccounts(),
          fetchWriterSettings(),
          suggestNextPostingAccountId(),
          suggestNextWriterSettingId(),
        ]);
      } catch (e) {
        setError(e?.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user, navigate]);

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 8000); // Keep error messages a bit longer
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchScripts = async () => {
    try {
      const response = await axios.get("/api/master-editor/scripts");
      setScripts(response.data.scripts);

      // Initialize selected types based on current titles
      const initialTypes = {};
      const initialStructures = {};
      response.data.scripts.forEach((script) => {
        // Add null check for script.title
        if (script.title && typeof script.title === "string") {
          const typeMatch = script.title.match(
            /\[(Original|Remix|Re-write|STL)\]/
          );
          if (typeMatch) {
            initialTypes[script.id] = typeMatch[1];
          }

          const structureMatch = script.title.match(
            /\[(Payback Revenge|Expectations|Looked Down Upon|Obsession|No Structure)\]/
          );
          if (structureMatch) {
            initialStructures[script.id] = structureMatch[1];
          }
        }
      });
      setSelectedTypes(initialTypes);
      setSelectedStructures(initialStructures);

      // Extract unique writers for filter dropdown
      const writers = [
        ...new Set(
          response.data.scripts
            .map((script) => script.writer_name)
            .filter((name) => name && name !== "Unknown")
        ),
      ].sort();
      setAvailableWriters(writers);
    } catch (error) {
      console.error("Error fetching scripts:", error);
      setError("Failed to fetch scripts");
    }
  };

  // Admin fetch functions
  const fetchPostingAccounts = async () => {
    const res = await axios.get("/api/admin/posting-accounts");
    setPostingAccounts(res.data.postingAccounts || []);
  };

  const fetchWriterSettings = async () => {
    const res = await axios.get("/api/admin/writer-settings");
    setWriterSettings(res.data.writerSettings || []);
  };

  const suggestNextPostingAccountId = async () => {
    const res = await axios.get("/api/admin/posting-accounts/next-id");
    setNewPostAcct((prev) => ({ ...prev, id: res.data.next_id }));
  };

  const suggestNextWriterSettingId = async () => {
    const res = await axios.get("/api/admin/writer-settings/next-id");
    setNewWriterSetting((prev) => ({ ...prev, id: res.data.next_id }));
  };

  const handleTypeChange = (scriptId, newType) => {
    setSelectedTypes((prev) => ({
      ...prev,
      [scriptId]: newType,
    }));
  };

  const handleStructureChange = (scriptId, newStructure) => {
    setSelectedStructures((prev) => ({
      ...prev,
      [scriptId]: newStructure,
    }));
  };

  // Filter and sort scripts
  const getFilteredAndSortedScripts = () => {
    let filtered = scripts;

    // Apply writer filter
    if (writerFilter) {
      filtered = filtered.filter(
        (script) =>
          script.writer_name &&
          script.writer_name.toLowerCase() === writerFilter.toLowerCase()
      );
    }

    // Apply sorting by created_at
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);

      if (sortOrder === "desc") {
        return dateB - dateA; // Newest first
      } else {
        return dateA - dateB; // Oldest first
      }
    });

    return filtered;
  };

  const handleSortToggle = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  const clearWriterFilter = () => {
    setWriterFilter("");
  };

  const handleEdit = async (scriptId) => {
    try {
      setEditingScript(scriptId);
      setError(null);
      setSuccess(null);

      const newType = selectedTypes[scriptId];
      const newStructure = selectedStructures[scriptId];

      const response = await axios.post(
        "/api/master-editor/update-script-type",
        {
          scriptId,
          newType,
          newStructure,
        }
      );

      if (response.data.success) {
        const updates = [];
        if (newType) updates.push(`type: ${newType}`);
        if (newStructure) updates.push(`structure: ${newStructure}`);

        setSuccess(`Successfully updated script (${updates.join(", ")})`);

        // Update the script in the local state
        setScripts((prev) =>
          prev.map((script) =>
            script.id === scriptId
              ? { ...script, title: response.data.newTitle }
              : script
          )
        );

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error) {
      console.error("Error updating script:", error);
      setError(error.response?.data?.error || "Failed to update script");
    } finally {
      setEditingScript(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Admin handler functions
  const handleTabChange = async (event, newValue) => {
    setCurrentTab(newValue);

    // Fetch scripts only when Script Editor tab (index 2) is selected
    if (newValue === 2 && scripts.length === 0) {
      try {
        setScriptsLoading(true);
        await fetchScripts();
      } catch (e) {
        setError(e?.response?.data?.error || e.message);
      } finally {
        setScriptsLoading(false);
      }
    }
  };

  // Handlers for Posting Accounts
  const handleNewPostAcctChange = (field, value) => {
    setNewPostAcct((prev) => ({ ...prev, [field]: value }));
  };

  const saveNewPostingAccount = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const payload = {
        id: Number(newPostAcct.id) || undefined,
        account: newPostAcct.account?.trim(),
        platform: newPostAcct.platform,
        status: newPostAcct.status,
        writer_id: newPostAcct.writer_id ? Number(newPostAcct.writer_id) : null,
        daily_limit: newPostAcct.daily_limit
          ? Number(newPostAcct.daily_limit)
          : 10,
        daily_used: newPostAcct.daily_used ? Number(newPostAcct.daily_used) : 0,
      };
      const res = await axios.post("/api/admin/posting-accounts", payload);
      setSuccess(`Posting account created (ID ${res.data.postingAccount.id})`);
      await fetchPostingAccounts();
      await suggestNextPostingAccountId();
      // Reset but keep suggested ID
      setNewPostAcct((prev) => ({
        ...prev,
        account: "",
        platform: "YouTube",
        status: "Active",
        writer_id: "",
        daily_limit: 10,
        daily_used: 0,
      }));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const createPostingAccount = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const payload = {
        id: postEdit.id,
        account: postEdit.account,
        platform: postEdit.platform,
        status: postEdit.status,
        daily_limit: postEdit.daily_limit ? Number(postEdit.daily_limit) : 10,
        daily_used: postEdit.daily_used ? Number(postEdit.daily_used) : 0,
      };
      const res = await axios.post("/api/admin/posting-accounts", payload);
      setSuccess(`Posting account created (ID ${res.data.postingAccount.id})`);
      await fetchPostingAccounts();
      await suggestNextPostingAccountId();
      // Reset but keep suggested ID
      setPostEdit((prev) => ({
        ...prev,
        account: "",
        platform: "YouTube",
        status: "Active",
        daily_limit: 10,
        daily_used: 0,
      }));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const updatePostingAccount = async (id, patch) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await axios.put(`/api/admin/posting-accounts/${id}`, patch);
      setSuccess(`Posting account updated (ID ${res.data.postingAccount.id})`);
      await fetchPostingAccounts();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  // Handlers for Writer Settings
  const handleNewWriterSettingChange = (field, value) => {
    setNewWriterSetting((prev) => ({ ...prev, [field]: value }));
  };

  const saveNewWriterSetting = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const payload = {
        id: Number(newWriterSetting.id) || undefined,
        writer_id: Number(newWriterSetting.writer_id),
        writer_name: newWriterSetting.writer_name?.trim(),
        writer_fname: newWriterSetting.writer_fname?.trim() || null,
        writer_lname: newWriterSetting.writer_lname?.trim() || null,
        skip_qa: !!newWriterSetting.skip_qa,
        post_acct_list: Array.isArray(newWriterSetting.post_acct_list)
          ? newWriterSetting.post_acct_list.map(Number)
          : [],
        access_advanced_types: !!newWriterSetting.access_advanced_types,
      };
      if (!payload.writer_id || !payload.writer_name) {
        setError("writer_id and writer_name are required");
        return;
      }
      const res = await axios.post("/api/admin/writer-settings", payload);
      setSuccess(`Writer setting created (ID ${res.data.writerSetting.id})`);
      await fetchWriterSettings();
      await suggestNextWriterSettingId();
      setNewWriterSetting((prev) => ({
        ...prev,
        writer_id: "",
        writer_name: "",
        writer_fname: "",
        writer_lname: "",
        skip_qa: false,
        post_acct_list: [],
        access_advanced_types: false,
      }));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const createWriterSetting = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const payload = {
        id: writerEdit.id,
        writer_id: writerEdit.writer_id || writerEdit.writer_name,
        writer_name: writerEdit.writer_name,
        writer_fname: writerEdit.writer_fname,
        writer_lname: writerEdit.writer_lname,
        skip_qa: !!writerEdit.skip_qa,
        post_acct_list: JSON.stringify(writerEdit.post_acct_list || []),
        access_advanced_types: !!writerEdit.access_advanced_types,
      };
      if (!payload.writer_id || !payload.writer_name) {
        setError("writer_id and writer_name are required");
        return;
      }
      const res = await axios.post("/api/admin/writer-settings", payload);
      setSuccess(`Writer setting created (ID ${res.data.writerSetting.id})`);
      await fetchWriterSettings();
      await suggestNextWriterSettingId();
      setNewWriterSetting((prev) => ({
        ...prev,
        writer_id: "",
        writer_name: "",
        writer_fname: "",
        writer_lname: "",
        skip_qa: false,
        post_acct_list: [],
        access_advanced_types: false,
      }));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateWriterSetting = async (id, patch) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await axios.put(`/api/admin/writer-settings/${id}`, patch);
      setSuccess(`Writer setting updated (ID ${res.data.writerSetting.id})`);
      await fetchWriterSettings();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const extractCurrentType = (title) => {
    if (!title || typeof title !== "string") return "Unknown";
    const match = title.match(/\[(Original|Remix|Re-write|STL)\]/);
    return match ? match[1] : "Unknown";
  };

  const extractCurrentStructure = (title) => {
    if (!title || typeof title !== "string") return "Unknown";
    const match = title.match(
      /\[(Payback Revenge|Expectations|Looked Down Upon|Obsession|No Structure)\]/
    );
    return match ? match[1] : "Unknown";
  };

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

  return (
    <Layout hideSettings={true} hideFeedback={true}>
      <Box
        sx={{
          minHeight: "100vh",
          background: "transparent",
          color: "white",
          p: 0,
        }}
      >
        {/* Modern Header */}
        <Box
          sx={{
            p: 3,
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            position: "relative",
            "&::before": {
              content: '""',
              position: "absolute",
              bottom: -1,
              left: 24,
              width: "60px",
              height: "2px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "2px",
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography
              variant="h4"
              sx={{
                color: "white",
                fontWeight: 700,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Master Editor Dashboard
            </Typography>
            <Button
              variant="outlined"
              onClick={handleLogout}
              startIcon={<LogoutOutlined />}
              sx={{
                color: "white",
                borderColor: "rgba(255, 255, 255, 0.3)",
                background: "rgba(255, 255, 255, 0.04)",
                backdropFilter: "blur(5px)",
                borderRadius: "12px",
                textTransform: "none",
                "&:hover": {
                  borderColor: "rgba(102, 126, 234, 0.5)",
                  background: "rgba(102, 126, 234, 0.1)",
                  transform: "translateY(-1px)",
                  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.15)",
                },
              }}
            >
              Logout
            </Button>
          </Box>
        </Box>

        {/* Tabs */}
        <Box
          sx={{
            borderBottom: 1,
            borderColor: "rgba(255, 255, 255, 0.1)",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            sx={{
              px: 3,
              minHeight: 48,
              "& .MuiTab-root": {
                color: "rgba(255, 255, 255, 0.7)",
                fontWeight: 600,
                textTransform: "none",
                fontSize: "16px",
                minHeight: 48,
                padding: "12px 24px",
                "&.Mui-selected": {
                  color: "white",
                  backgroundColor: "rgba(102, 126, 234, 0.1)",
                },
                "&:hover": {
                  color: "rgba(255, 255, 255, 0.9)",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                },
              },
              "& .MuiTabs-indicator": {
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                height: "3px",
                borderRadius: "2px",
              },
              "& .MuiTabs-flexContainer": {
                borderBottom: "none",
              },
            }}
          >
            <Tab label="Posting Accounts" />
            <Tab label="Writers" />
            <Tab label="Script Editor" />
          </Tabs>
        </Box>

        {/* Main Content */}
        <Box sx={{ p: 4 }}>
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          {success && (
            <Alert
              severity="success"
              sx={{ mb: 2 }}
              onClose={() => setSuccess(null)}
            >
              {success}
            </Alert>
          )}

          {/* Tab Content */}
          {/* Posting Accounts Tab */}
          {currentTab === 0 && (
            <Card
              sx={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <CardContent>
                <Typography variant="h6" sx={{ color: "white", mb: 2 }}>
                  Posting Accounts
                </Typography>

                {/* Toolbar and Filters */}
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                    mb: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <TextField
                    size="small"
                    placeholder="Search account"
                    value={postFilter.search}
                    onChange={(e) =>
                      setPostFilter((prev) => ({
                        ...prev,
                        search: e.target.value,
                      }))
                    }
                    InputProps={{
                      startAdornment: <SearchIcon fontSize="small" />,
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        color: "white",
                        "& fieldset": {
                          borderColor: "rgba(255, 255, 255, 0.3)",
                        },
                        "&:hover fieldset": {
                          borderColor: "rgba(255, 255, 255, 0.5)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#667eea",
                        },
                      },
                      "& .MuiInputLabel-root": {
                        color: "rgba(255, 255, 255, 0.7)",
                      },
                    }}
                  />
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel sx={{ color: "rgba(255, 255, 255, 0.7)" }}>
                      Platform
                    </InputLabel>
                    <Select
                      label="Platform"
                      value={postFilter.platform}
                      onChange={(e) =>
                        setPostFilter((prev) => ({
                          ...prev,
                          platform: e.target.value,
                        }))
                      }
                      sx={{
                        color: "white",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255, 255, 255, 0.3)",
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255, 255, 255, 0.5)",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#667eea",
                        },
                      }}
                    >
                      <MenuItem value="">All</MenuItem>
                      {PLATFORM_OPTIONS.map((p) => (
                        <MenuItem key={p} value={p}>
                          {p}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel sx={{ color: "rgba(255, 255, 255, 0.7)" }}>
                      Status
                    </InputLabel>
                    <Select
                      label="Status"
                      value={postFilter.status}
                      onChange={(e) =>
                        setPostFilter((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                      sx={{
                        color: "white",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255, 255, 255, 0.3)",
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255, 255, 255, 0.5)",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#667eea",
                        },
                      }}
                    >
                      <MenuItem value="">All</MenuItem>
                      {STATUS_OPTIONS.map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={async () => {
                      await suggestNextPostingAccountId();
                      setPostModalMode("create");
                      setPostEdit({ ...newPostAcct });
                      setPostModalOpen(true);
                    }}
                    sx={{
                      background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                      borderRadius: "8px",
                      textTransform: "none",
                      "&:hover": {
                        background:
                          "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                        transform: "translateY(-1px)",
                        boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
                      },
                    }}
                  >
                    Add Account
                  </Button>
                </Box>

                {/* Table */}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "8%",
                          }}
                        >
                          ID
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "20%",
                          }}
                        >
                          Account
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "15%",
                          }}
                        >
                          Platform
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "12%",
                          }}
                        >
                          Status
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "12%",
                          }}
                        >
                          Daily Used
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "12%",
                          }}
                        >
                          Daily Limit
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "21%",
                          }}
                          align="right"
                        >
                          Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {postingAccounts
                        .filter(
                          (a) =>
                            !postFilter.search ||
                            a.account
                              ?.toLowerCase()
                              .includes(postFilter.search.toLowerCase())
                        )
                        .filter(
                          (a) =>
                            !postFilter.platform ||
                            a.platform === postFilter.platform
                        )
                        .filter(
                          (a) =>
                            !postFilter.status || a.status === postFilter.status
                        )
                        .map((acct) => (
                          <TableRow
                            key={acct.id}
                            hover
                            sx={{
                              borderBottom:
                                "1px solid rgba(255, 255, 255, 0.05)",
                              "&:hover": {
                                backgroundColor: "rgba(102, 126, 234, 0.05)",
                                borderColor: "rgba(102, 126, 234, 0.1)",
                              },
                            }}
                          >
                            <TableCell
                              sx={{
                                border: "none",
                                py: 2,
                                color: "white",
                                width: "8%",
                                maxWidth: "8%",
                              }}
                            >
                              {acct.id}
                            </TableCell>
                            <TableCell
                              sx={{
                                border: "none",
                                py: 2,
                                color: "white",
                                width: "20%",
                                maxWidth: "20%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={acct.account}
                            >
                              {acct.account}
                            </TableCell>
                            <TableCell
                              sx={{
                                border: "none",
                                py: 2,
                                color: "white",
                                width: "15%",
                                maxWidth: "15%",
                              }}
                            >
                              {acct.platform}
                            </TableCell>
                            <TableCell
                              sx={{
                                border: "none",
                                py: 2,
                                color: "white",
                                width: "12%",
                                maxWidth: "12%",
                              }}
                            >
                              {acct.status}
                            </TableCell>
                            <TableCell
                              sx={{
                                border: "none",
                                py: 2,
                                color: "white",
                                width: "12%",
                                maxWidth: "12%",
                              }}
                            >
                              {acct.daily_used}
                            </TableCell>
                            <TableCell
                              sx={{
                                border: "none",
                                py: 2,
                                color: "white",
                                width: "12%",
                                maxWidth: "12%",
                              }}
                            >
                              {acct.daily_limit}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                border: "none",
                                py: 2,
                                width: "21%",
                                maxWidth: "21%",
                              }}
                            >
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  sx={{ color: "white" }}
                                  onClick={() => {
                                    setPostModalMode("edit");
                                    setPostEdit({ ...acct });
                                    setPostModalOpen(true);
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={async () => {
                                    if (
                                      confirm(
                                        `Delete posting account ${acct.account} (ID ${acct.id})?`
                                      )
                                    ) {
                                      await axios.delete(
                                        `/api/admin/posting-accounts/${acct.id}`
                                      );
                                      await fetchPostingAccounts();
                                    }
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      {postingAccounts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Typography
                              variant="body2"
                              sx={{ color: "rgba(255,255,255,0.7)" }}
                            >
                              No posting accounts found.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* Writers Tab */}
          {currentTab === 1 && (
            <Card
              sx={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <CardContent>
                <Typography variant="h6" sx={{ color: "white", mb: 2 }}>
                  Writer Setup
                </Typography>

                {/* Toolbar */}
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                    mb: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <TextField
                    size="small"
                    placeholder="Search writer name"
                    value={adminWriterFilter.search}
                    onChange={(e) =>
                      setAdminWriterFilter((prev) => ({
                        ...prev,
                        search: e.target.value,
                      }))
                    }
                    InputProps={{
                      startAdornment: <SearchIcon fontSize="small" />,
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        color: "white",
                        "& fieldset": {
                          borderColor: "rgba(255, 255, 255, 0.3)",
                        },
                        "&:hover fieldset": {
                          borderColor: "rgba(255, 255, 255, 0.5)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#667eea",
                        },
                      },
                      "& .MuiInputLabel-root": {
                        color: "rgba(255, 255, 255, 0.7)",
                      },
                    }}
                  />
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel sx={{ color: "rgba(255, 255, 255, 0.7)" }}>
                      Skip QA
                    </InputLabel>
                    <Select
                      label="Skip QA"
                      value={adminWriterFilter.skip_qa ?? ""}
                      onChange={(e) =>
                        setAdminWriterFilter((prev) => ({
                          ...prev,
                          skip_qa: e.target.value,
                        }))
                      }
                      sx={{
                        color: "white",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255, 255, 255, 0.3)",
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255, 255, 255, 0.5)",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#667eea",
                        },
                      }}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="true">Yes</MenuItem>
                      <MenuItem value="false">No</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 170 }}>
                    <InputLabel sx={{ color: "rgba(255, 255, 255, 0.7)" }}>
                      Advanced Types
                    </InputLabel>
                    <Select
                      label="Advanced Types"
                      value={adminWriterFilter.access_advanced_types ?? ""}
                      onChange={(e) =>
                        setAdminWriterFilter((prev) => ({
                          ...prev,
                          access_advanced_types: e.target.value,
                        }))
                      }
                      sx={{
                        color: "white",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255, 255, 255, 0.3)",
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255, 255, 255, 0.5)",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#667eea",
                        },
                      }}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="true">Has access</MenuItem>
                      <MenuItem value="false">No access</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={async () => {
                      await suggestNextWriterSettingId();
                      setWriterModalMode("create");
                      setWriterEdit({ ...newWriterSetting });
                      setWriterModalOpen(true);
                    }}
                    sx={{
                      background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                      borderRadius: "8px",
                      textTransform: "none",
                      "&:hover": {
                        background:
                          "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                        transform: "translateY(-1px)",
                        boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
                      },
                    }}
                  >
                    Add Writer
                  </Button>
                </Box>

                {/* Table */}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "5%",
                          }}
                        >
                          ID
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "10%",
                          }}
                        >
                          Writer Name
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "15%",
                          }}
                        >
                          First Name
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "15%",
                          }}
                        >
                          Last Name
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "10%",
                          }}
                        >
                          Skip QA
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "10%",
                          }}
                        >
                          Advanced Types
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "25%",
                          }}
                        >
                          Posting Accounts
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "#888",
                            border: "none",
                            py: 1,
                            fontWeight: "bold",
                            width: "10%",
                          }}
                          align="right"
                        >
                          Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredWriterSettings.map((ws) => (
                        <TableRow
                          key={ws.id}
                          hover
                          sx={{
                            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                            "&:hover": {
                              backgroundColor: "rgba(102, 126, 234, 0.05)",
                              borderColor: "rgba(102, 126, 234, 0.1)",
                            },
                          }}
                        >
                          <TableCell
                            sx={{
                              border: "none",
                              py: 2,
                              color: "white",
                              width: "5%",
                              maxWidth: "5%",
                            }}
                          >
                            {ws.id}
                          </TableCell>
                          <TableCell
                            sx={{
                              border: "none",
                              py: 2,
                              color: "white",
                              width: "10%",
                              maxWidth: "10%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={ws.writer_name}
                          >
                            {ws.writer_name}
                          </TableCell>
                          <TableCell
                            sx={{
                              border: "none",
                              py: 2,
                              color: "white",
                              width: "15%",
                              maxWidth: "15%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={ws.writer_fname ?? ""}
                          >
                            {ws.writer_fname ?? ""}
                          </TableCell>
                          <TableCell
                            sx={{
                              border: "none",
                              py: 2,
                              color: "white",
                              width: "15%",
                              maxWidth: "15%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={ws.writer_lname ?? ""}
                          >
                            {ws.writer_lname ?? ""}
                          </TableCell>
                          <TableCell
                            sx={{
                              border: "none",
                              py: 2,
                              width: "10%",
                              maxWidth: "10%",
                            }}
                          >
                            <Checkbox
                              checked={!!ws.skip_qa}
                              disabled
                              sx={{ color: "white" }}
                            />
                          </TableCell>
                          <TableCell
                            sx={{
                              border: "none",
                              py: 2,
                              width: "10%",
                              maxWidth: "10%",
                            }}
                          >
                            <Checkbox
                              checked={!!ws.access_advanced_types}
                              disabled
                              sx={{ color: "white" }}
                            />
                          </TableCell>
                          <TableCell
                            sx={{
                              border: "none",
                              py: 2,
                              color: "white",
                              width: "25%",
                              maxWidth: "25%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={renderPostingAccountsInTable(
                              ws.post_acct_list
                            )}
                          >
                            {renderTruncatedPostingAccounts(ws.post_acct_list)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              border: "none",
                              py: 2,
                              width: "10%",
                              maxWidth: "10%",
                            }}
                          >
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                sx={{ color: "white" }}
                                onClick={() => {
                                  setWriterModalMode("edit");
                                  const editData = {
                                    ...ws,
                                    post_acct_list: (() => {
                                      try {
                                        return Array.isArray(ws.post_acct_list)
                                          ? ws.post_acct_list
                                          : ws.post_acct_list
                                          ? JSON.parse(ws.post_acct_list)
                                          : [];
                                      } catch (e) {
                                        return [];
                                      }
                                    })(),
                                  };
                                  setWriterEdit(editData);
                                  setWriterModalOpen(true);
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={async () => {
                                  if (
                                    confirm(
                                      `Delete writer setting ${ws.writer_name} (ID ${ws.id})?`
                                    )
                                  ) {
                                    await axios.delete(
                                      `/api/admin/writer-settings/${ws.id}`
                                    );
                                    await fetchWriterSettings();
                                  }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredWriterSettings.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8}>
                            <Typography
                              variant="body2"
                              sx={{ color: "rgba(255,255,255,0.7)" }}
                            >
                              No writer settings found.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* Script Editor Tab */}
          {currentTab === 2 && (
            <>
              {scriptsLoading ? (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  minHeight="200px"
                >
                  <CircularProgress sx={{ color: "#667eea" }} />
                  <Typography sx={{ ml: 2, color: "white" }}>
                    Loading scripts...
                  </Typography>
                </Box>
              ) : (
                <>
                  {/* Filter and Sort Controls */}
                  <Box
                    sx={{
                      mb: 3,
                      display: "flex",
                      gap: 2,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Writer Filter */}
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <Select
                        value={writerFilter}
                        onChange={(e) => setWriterFilter(e.target.value)}
                        displayEmpty
                        sx={{
                          color: "white",
                          background: "rgba(255, 255, 255, 0.04)",
                          backdropFilter: "blur(5px)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          borderRadius: "12px",
                          transition: "all 0.2s ease-in-out",
                          "& .MuiOutlinedInput-notchedOutline": {
                            border: "none",
                          },
                          "&:hover": {
                            border: "1px solid rgba(102, 126, 234, 0.3)",
                            background: "rgba(255, 255, 255, 0.06)",
                            transform: "translateY(-1px)",
                            boxShadow: "0 4px 12px rgba(102, 126, 234, 0.15)",
                          },
                          "&.Mui-focused": {
                            border: "1px solid rgba(102, 126, 234, 0.5)",
                            background: "rgba(255, 255, 255, 0.08)",
                            transform: "translateY(-1px)",
                            boxShadow: "0 4px 20px rgba(102, 126, 234, 0.25)",
                          },
                        }}
                        startAdornment={
                          <FilterIcon sx={{ color: "#667eea", mr: 1 }} />
                        }
                      >
                        <MenuItem value="">All Writers</MenuItem>
                        {availableWriters.map((writer) => (
                          <MenuItem key={writer} value={writer}>
                            {writer}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Clear Filter Button */}
                    {writerFilter && (
                      <Chip
                        label={`Writer: ${writerFilter}`}
                        onDelete={clearWriterFilter}
                        deleteIcon={<ClearIcon />}
                        sx={{
                          backgroundColor: "#4fc3f7",
                          color: "white",
                          "& .MuiChip-deleteIcon": {
                            color: "white",
                          },
                        }}
                      />
                    )}

                    {/* Sort Toggle */}
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleSortToggle}
                      sx={{
                        color: "white",
                        borderColor: "#666",
                        "&:hover": {
                          borderColor: "#4fc3f7",
                          backgroundColor: "rgba(79, 195, 247, 0.1)",
                        },
                      }}
                    >
                      Sort by Date:{" "}
                      {sortOrder === "desc" ? "Newest First" : "Oldest First"}
                    </Button>
                  </Box>

                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ borderBottom: "1px solid #333" }}>
                          <TableCell
                            sx={{
                              color: "#888",
                              border: "none",
                              py: 1,
                              fontWeight: "bold",
                            }}
                          >
                            ID
                          </TableCell>
                          <TableCell
                            sx={{
                              color: "#888",
                              border: "none",
                              py: 1,
                              fontWeight: "bold",
                            }}
                          >
                            Title
                          </TableCell>
                          <TableCell
                            sx={{
                              color: "#888",
                              border: "none",
                              py: 1,
                              fontWeight: "bold",
                            }}
                          >
                            <TableSortLabel
                              active={true}
                              direction={sortOrder}
                              onClick={handleSortToggle}
                              sx={{
                                color: "#888 !important",
                                "&:hover": { color: "white !important" },
                                "& .MuiTableSortLabel-icon": {
                                  color: "#667eea !important",
                                },
                              }}
                            >
                              Created At
                            </TableSortLabel>
                          </TableCell>
                          <TableCell
                            sx={{
                              color: "#888",
                              border: "none",
                              py: 1,
                              fontWeight: "bold",
                            }}
                          >
                            Writer Name
                          </TableCell>
                          <TableCell
                            sx={{
                              color: "#888",
                              border: "none",
                              py: 1,
                              fontWeight: "bold",
                            }}
                          >
                            Current Type
                          </TableCell>
                          <TableCell
                            sx={{
                              color: "#888",
                              border: "none",
                              py: 1,
                              fontWeight: "bold",
                            }}
                          >
                            New Type
                          </TableCell>
                          <TableCell
                            sx={{
                              color: "#888",
                              border: "none",
                              py: 1,
                              fontWeight: "bold",
                            }}
                          >
                            Current Structure
                          </TableCell>
                          <TableCell
                            sx={{
                              color: "#888",
                              border: "none",
                              py: 1,
                              fontWeight: "bold",
                            }}
                          >
                            New Structure
                          </TableCell>
                          <TableCell
                            sx={{
                              color: "#888",
                              border: "none",
                              py: 1,
                              fontWeight: "bold",
                            }}
                          >
                            Action
                          </TableCell>
                          <TableCell
                            sx={{
                              color: "#888",
                              border: "none",
                              py: 1,
                              fontWeight: "bold",
                            }}
                          >
                            Status
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getFilteredAndSortedScripts().map((script, index) => (
                          <TableRow
                            key={`${script.id}-${index}`}
                            sx={{
                              borderBottom:
                                "1px solid rgba(255, 255, 255, 0.05)",
                              "&:hover": {
                                backgroundColor: "rgba(102, 126, 234, 0.05)",
                                borderColor: "rgba(102, 126, 234, 0.1)",
                              },
                            }}
                          >
                            <TableCell
                              sx={{ border: "none", py: 2, color: "white" }}
                            >
                              {script.id}
                            </TableCell>
                            <TableCell
                              sx={{ border: "none", py: 2, maxWidth: 400 }}
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  color: "white",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {script.title}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ border: "none", py: 2 }}>
                              <Typography
                                variant="body2"
                                sx={{ color: "white" }}
                              >
                                {script.created_at
                                  ? new Date(
                                      script.created_at
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ border: "none", py: 2 }}>
                              <Typography
                                variant="body2"
                                sx={{ color: "white" }}
                              >
                                {script.writer_name || "Unknown"}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ border: "none", py: 2 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: "#667eea",
                                  fontWeight: 500,
                                  background: "rgba(102, 126, 234, 0.1)",
                                  px: 1,
                                  py: 0.5,
                                  borderRadius: "6px",
                                  display: "inline-block",
                                }}
                              >
                                {extractCurrentType(script.title)}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ border: "none", py: 2 }}>
                              <FormControl size="small" sx={{ minWidth: 120 }}>
                                <Select
                                  value={selectedTypes[script.id] || ""}
                                  onChange={(e) =>
                                    handleTypeChange(script.id, e.target.value)
                                  }
                                  sx={{
                                    color: "white",
                                    background: "rgba(255, 255, 255, 0.04)",
                                    backdropFilter: "blur(5px)",
                                    border:
                                      "1px solid rgba(255, 255, 255, 0.1)",
                                    borderRadius: "8px",
                                    "& .MuiOutlinedInput-notchedOutline": {
                                      border: "none",
                                    },
                                    "&:hover": {
                                      border:
                                        "1px solid rgba(102, 126, 234, 0.3)",
                                      background: "rgba(255, 255, 255, 0.06)",
                                    },
                                  }}
                                >
                                  {typeOptions.map((type) => (
                                    <MenuItem key={type} value={type}>
                                      {type}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell sx={{ border: "none", py: 2 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: "#764ba2",
                                  fontWeight: 500,
                                  background: "rgba(118, 75, 162, 0.1)",
                                  px: 1,
                                  py: 0.5,
                                  borderRadius: "6px",
                                  display: "inline-block",
                                }}
                              >
                                {extractCurrentStructure(script.title)}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ border: "none", py: 2 }}>
                              <FormControl size="small" sx={{ minWidth: 140 }}>
                                <Select
                                  value={selectedStructures[script.id] || ""}
                                  onChange={(e) =>
                                    handleStructureChange(
                                      script.id,
                                      e.target.value
                                    )
                                  }
                                  sx={{
                                    color: "white",
                                    background: "rgba(255, 255, 255, 0.04)",
                                    backdropFilter: "blur(5px)",
                                    border:
                                      "1px solid rgba(255, 255, 255, 0.1)",
                                    borderRadius: "8px",
                                    "& .MuiOutlinedInput-notchedOutline": {
                                      border: "none",
                                    },
                                    "&:hover": {
                                      border:
                                        "1px solid rgba(118, 75, 162, 0.3)",
                                      background: "rgba(255, 255, 255, 0.06)",
                                    },
                                  }}
                                >
                                  {structureOptions.map((structure) => (
                                    <MenuItem key={structure} value={structure}>
                                      {structure}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell sx={{ border: "none", py: 2 }}>
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleEdit(script.id)}
                                disabled={
                                  editingScript === script.id ||
                                  ((!selectedTypes[script.id] ||
                                    selectedTypes[script.id] ===
                                      extractCurrentType(script.title)) &&
                                    (!selectedStructures[script.id] ||
                                      selectedStructures[script.id] ===
                                        extractCurrentStructure(script.title)))
                                }
                                sx={{
                                  background:
                                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                  color: "white",
                                  borderRadius: "8px",
                                  textTransform: "none",
                                  "&:hover": {
                                    background:
                                      "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                                    transform: "translateY(-1px)",
                                    boxShadow:
                                      "0 4px 12px rgba(102, 126, 234, 0.3)",
                                  },
                                  "&:disabled": {
                                    background: "#666",
                                    transform: "none",
                                    boxShadow: "none",
                                  },
                                }}
                              >
                                {editingScript === script.id ? (
                                  <CircularProgress size={16} color="inherit" />
                                ) : (
                                  "Edit"
                                )}
                              </Button>
                            </TableCell>
                            <TableCell sx={{ border: "none", py: 2 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  color:
                                    script.approval_status === "Posted"
                                      ? "#4caf50"
                                      : "#888",
                                  fontWeight: 500,
                                  background:
                                    script.approval_status === "Posted"
                                      ? "rgba(76, 175, 80, 0.1)"
                                      : "rgba(136, 136, 136, 0.1)",
                                  px: 1,
                                  py: 0.5,
                                  borderRadius: "6px",
                                  display: "inline-block",
                                }}
                              >
                                {script.approval_status}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {scripts.length === 0 && (
                    <Typography
                      variant="body1"
                      sx={{
                        color: "#888",
                        textAlign: "center",
                        mt: 4,
                        background: "rgba(255, 255, 255, 0.04)",
                        p: 3,
                        borderRadius: "12px",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      No scripts found with type prefixes (Original, Remix,
                      Re-write, STL)
                    </Typography>
                  )}

                  {scripts.length > 0 &&
                    getFilteredAndSortedScripts().length === 0 && (
                      <Typography
                        variant="body1"
                        sx={{
                          color: "#888",
                          textAlign: "center",
                          mt: 4,
                          background: "rgba(255, 255, 255, 0.04)",
                          p: 3,
                          borderRadius: "12px",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        No scripts match the current filter criteria
                      </Typography>
                    )}
                </>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Posting Account Modal */}
      <Dialog
        open={postModalOpen}
        onClose={() => setPostModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: "rgba(30, 30, 30, 0.95)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          },
        }}
      >
        <DialogTitle sx={{ color: "white" }}>
          {postModalMode === "create"
            ? "Add Posting Account"
            : "Edit Posting Account"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="Account Name"
              value={postEdit?.account || ""}
              onChange={(e) =>
                setPostEdit((prev) => ({ ...prev, account: e.target.value }))
              }
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "white",
                  "& fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                  "&:hover fieldset": {
                    borderColor: "rgba(255, 255, 255, 0.5)",
                  },
                  "&.Mui-focused fieldset": { borderColor: "#667eea" },
                },
                "& .MuiInputLabel-root": { color: "rgba(255, 255, 255, 0.7)" },
              }}
            />
            <FormControl fullWidth>
              <InputLabel sx={{ color: "rgba(255, 255, 255, 0.7)" }}>
                Platform
              </InputLabel>
              <Select
                value={postEdit?.platform || ""}
                onChange={(e) =>
                  setPostEdit((prev) => ({ ...prev, platform: e.target.value }))
                }
                label="Platform"
                sx={{
                  color: "white",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255, 255, 255, 0.3)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255, 255, 255, 0.5)",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#667eea",
                  },
                }}
              >
                {PLATFORM_OPTIONS.map((platform) => (
                  <MenuItem key={platform} value={platform}>
                    {platform}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel sx={{ color: "rgba(255, 255, 255, 0.7)" }}>
                Status
              </InputLabel>
              <Select
                value={postEdit?.status || ""}
                onChange={(e) =>
                  setPostEdit((prev) => ({ ...prev, status: e.target.value }))
                }
                label="Status"
                sx={{
                  color: "white",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255, 255, 255, 0.3)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255, 255, 255, 0.5)",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#667eea",
                  },
                }}
              >
                {STATUS_OPTIONS.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Daily Limit"
              type="number"
              value={postEdit?.daily_limit || ""}
              onChange={(e) =>
                setPostEdit((prev) => ({
                  ...prev,
                  daily_limit: e.target.value,
                }))
              }
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "white",
                  "& fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                  "&:hover fieldset": {
                    borderColor: "rgba(255, 255, 255, 0.5)",
                  },
                  "&.Mui-focused fieldset": { borderColor: "#667eea" },
                },
                "& .MuiInputLabel-root": { color: "rgba(255, 255, 255, 0.7)" },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPostModalOpen(false)}
            sx={{ color: "white" }}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (postModalMode === "create") {
                await createPostingAccount();
              } else {
                await updatePostingAccount(postEdit.id, postEdit);
              }
              setPostModalOpen(false);
            }}
            variant="contained"
            sx={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              "&:hover": {
                background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
              },
            }}
          >
            {postModalMode === "create" ? "Create" : "Update"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Writer Settings Modal */}
      <Dialog
        open={writerModalOpen}
        onClose={() => setWriterModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: "rgba(30, 30, 30, 0.95)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          },
        }}
      >
        <DialogTitle sx={{ color: "white" }}>
          {writerModalMode === "create"
            ? "Add Writer Setting"
            : "Edit Writer Setting"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="Writer Name"
              value={writerEdit?.writer_name || ""}
              onChange={(e) =>
                setWriterEdit((prev) => ({
                  ...prev,
                  writer_name: e.target.value,
                }))
              }
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "white",
                  "& fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                  "&:hover fieldset": {
                    borderColor: "rgba(255, 255, 255, 0.5)",
                  },
                  "&.Mui-focused fieldset": { borderColor: "#667eea" },
                },
                "& .MuiInputLabel-root": { color: "rgba(255, 255, 255, 0.7)" },
              }}
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="First Name"
                value={writerEdit?.writer_fname || ""}
                onChange={(e) =>
                  setWriterEdit((prev) => ({
                    ...prev,
                    writer_fname: e.target.value,
                  }))
                }
                fullWidth
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "white",
                    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                    "&:hover fieldset": {
                      borderColor: "rgba(255, 255, 255, 0.5)",
                    },
                    "&.Mui-focused fieldset": { borderColor: "#667eea" },
                  },
                  "& .MuiInputLabel-root": {
                    color: "rgba(255, 255, 255, 0.7)",
                  },
                }}
              />
              <TextField
                label="Last Name"
                value={writerEdit?.writer_lname || ""}
                onChange={(e) =>
                  setWriterEdit((prev) => ({
                    ...prev,
                    writer_lname: e.target.value,
                  }))
                }
                fullWidth
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "white",
                    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                    "&:hover fieldset": {
                      borderColor: "rgba(255, 255, 255, 0.5)",
                    },
                    "&.Mui-focused fieldset": { borderColor: "#667eea" },
                  },
                  "& .MuiInputLabel-root": {
                    color: "rgba(255, 255, 255, 0.7)",
                  },
                }}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!writerEdit?.skip_qa}
                    onChange={(e) =>
                      setWriterEdit((prev) => ({
                        ...prev,
                        skip_qa: e.target.checked,
                      }))
                    }
                    sx={{ color: "white" }}
                  />
                }
                label="Skip QA"
                sx={{ color: "white" }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!writerEdit?.access_advanced_types}
                    onChange={(e) =>
                      setWriterEdit((prev) => ({
                        ...prev,
                        access_advanced_types: e.target.checked,
                      }))
                    }
                    sx={{ color: "white" }}
                  />
                }
                label="Access Advanced Types"
                sx={{ color: "white" }}
              />
            </Box>
            <FormControl fullWidth>
              <InputLabel sx={{ color: "rgba(255, 255, 255, 0.7)" }}>
                Posting Accounts
              </InputLabel>
              <Select
                multiple
                value={writerEdit?.post_acct_list || []}
                onChange={(e) =>
                  setWriterEdit((prev) => ({
                    ...prev,
                    post_acct_list: e.target.value,
                  }))
                }
                label="Posting Accounts"
                renderValue={renderPostingAccountsValue}
                sx={{
                  color: "white",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255, 255, 255, 0.3)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255, 255, 255, 0.5)",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#667eea",
                  },
                }}
              >
                {postingAccounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    <Checkbox
                      checked={(writerEdit?.post_acct_list || []).includes(
                        account.id
                      )}
                      sx={{ color: "white" }}
                    />
                    {account.account} ({account.platform})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setWriterModalOpen(false)}
            sx={{ color: "white" }}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (writerModalMode === "create") {
                await createWriterSetting();
              } else {
                await updateWriterSetting(writerEdit.id, writerEdit);
              }
              setWriterModalOpen(false);
            }}
            variant="contained"
            sx={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              "&:hover": {
                background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
              },
            }}
          >
            {writerModalMode === "create" ? "Create" : "Update"}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default MasterEditor;
