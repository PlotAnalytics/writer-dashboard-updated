import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
} from "@mui/icons-material";
import Layout from "../components/Layout";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

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

const AdminSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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

  // Removed unused acctToWriters computation that was causing performance issues

  // Filters
  const [postFilter, setPostFilter] = useState({
    search: "",
    platform: "",
    status: "",
  });
  const [writerFilter, setWriterFilter] = useState({
    search: "",
    skip_qa: "",
    access_advanced_types: "",
  });

  // Debounced search to reduce filtering calculations
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(writerFilter.search);
    }, 300);
    return () => clearTimeout(timer);
  }, [writerFilter.search]);

  // Modals
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postModalMode, setPostModalMode] = useState("create"); // 'create' | 'edit'
  const [postEdit, setPostEdit] = useState(null);

  const [writerModalOpen, setWriterModalOpen] = useState(false);
  const [writerModalMode, setWriterModalMode] = useState("create");
  const [writerEdit, setWriterEdit] = useState(null);

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
          writerFilter.skip_qa === "" ||
          String(!!w.skip_qa) === writerFilter.skip_qa
      )
      .filter(
        (w) =>
          writerFilter.access_advanced_types === "" ||
          String(!!w.access_advanced_types) ===
            writerFilter.access_advanced_types
      );
  }, [
    writerSettings,
    debouncedSearch,
    writerFilter.skip_qa,
    writerFilter.access_advanced_types,
  ]);

  useEffect(() => {
    // Only admin (master_editor) can access
    if (!user || user.username !== "master_editor") {
      navigate("/login");
      return;
    }
    const init = async () => {
      try {
        setLoading(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
    <Layout hideNavigation={true} hideSettings={true} hideFeedback={true}>
      <Box sx={{ p: 3 }}>
        <Typography
          variant="h4"
          sx={{ color: "white", fontWeight: 700, mb: 2 }}
        >
          Admin Settings
        </Typography>

        {error && (
          <Typography variant="body2" color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        {success && (
          <Typography variant="body2" color="success.main" sx={{ mb: 2 }}>
            {success}
          </Typography>
        )}

        <Stack spacing={3}>
          {/* Posting Accounts Section */}
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
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Platform</InputLabel>
                  <Select
                    label="Platform"
                    value={postFilter.platform}
                    onChange={(e) =>
                      setPostFilter((prev) => ({
                        ...prev,
                        platform: e.target.value,
                      }))
                    }
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
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={postFilter.status}
                    onChange={(e) =>
                      setPostFilter((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
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
                >
                  Add Account
                </Button>
              </Box>

              {/* Table */}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Account</TableCell>
                    <TableCell>Platform</TableCell>
                    <TableCell>Status</TableCell>

                    <TableCell>Daily Used</TableCell>
                    <TableCell>Daily Limit</TableCell>
                    <TableCell align="right">Actions</TableCell>
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
                      <TableRow key={acct.id} hover>
                        <TableCell>{acct.id}</TableCell>
                        <TableCell>{acct.account}</TableCell>
                        <TableCell>{acct.platform}</TableCell>
                        <TableCell>{acct.status}</TableCell>

                        <TableCell>{acct.daily_used}</TableCell>
                        <TableCell>{acct.daily_limit}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
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
                      <TableCell colSpan={8}>
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

              {/* Posting Account Modal */}
              <Dialog
                open={postModalOpen}
                onClose={() => setPostModalOpen(false)}
                fullWidth
                maxWidth="sm"
              >
                <DialogTitle>
                  {postModalMode === "create"
                    ? "Add Posting Account"
                    : `Edit Posting Account (ID ${postEdit?.id})`}
                </DialogTitle>
                <DialogContent dividers>
                  <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                      label="ID"
                      type="number"
                      value={postEdit?.id ?? ""}
                      disabled
                      size="small"
                    />
                    <TextField
                      label="Account"
                      value={postEdit?.account ?? ""}
                      onChange={(e) =>
                        setPostEdit((prev) => ({
                          ...prev,
                          account: e.target.value,
                        }))
                      }
                      size="small"
                    />
                    <FormControl size="small">
                      <InputLabel>Platform</InputLabel>
                      <Select
                        label="Platform"
                        value={postEdit?.platform ?? "YouTube"}
                        onChange={(e) =>
                          setPostEdit((prev) => ({
                            ...prev,
                            platform: e.target.value,
                          }))
                        }
                      >
                        {PLATFORM_OPTIONS.map((p) => (
                          <MenuItem key={p} value={p}>
                            {p}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        label="Status"
                        value={postEdit?.status ?? "Active"}
                        onChange={(e) =>
                          setPostEdit((prev) => ({
                            ...prev,
                            status: e.target.value,
                          }))
                        }
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <MenuItem key={s} value={s}>
                            {s}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {/* Writer is derived from writer settings; not editable here */}
                    <TextField
                      label="Daily Limit"
                      type="number"
                      value={postEdit?.daily_limit ?? 10}
                      onChange={(e) =>
                        setPostEdit((prev) => ({
                          ...prev,
                          daily_limit: Number(e.target.value || 10),
                        }))
                      }
                      size="small"
                    />
                    <TextField
                      label="Daily Used"
                      type="number"
                      value={postEdit?.daily_used ?? 0}
                      onChange={(e) =>
                        setPostEdit((prev) => ({
                          ...prev,
                          daily_used: Number(e.target.value || 0),
                        }))
                      }
                      size="small"
                    />
                  </Stack>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setPostModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={async () => {
                      if (postModalMode === "create") {
                        await axios.post("/api/admin/posting-accounts", {
                          id: Number(postEdit?.id) || undefined,
                          account: postEdit?.account,
                          platform: postEdit?.platform,
                          status: postEdit?.status,
                          writer_id: postEdit?.writer_id ?? null,
                          daily_limit: postEdit?.daily_limit ?? 10,
                          daily_used: postEdit?.daily_used ?? 0,
                        });
                      } else {
                        await axios.put(
                          `/api/admin/posting-accounts/${postEdit?.id}`,
                          {
                            account: postEdit?.account,
                            platform: postEdit?.platform,
                            status: postEdit?.status,
                            writer_id: postEdit?.writer_id ?? null,
                            daily_limit: postEdit?.daily_limit ?? 10,
                            daily_used: postEdit?.daily_used ?? 0,
                          }
                        );
                      }
                      setPostModalOpen(false);
                      await fetchPostingAccounts();
                      await suggestNextPostingAccountId();
                    }}
                  >
                    Save
                  </Button>
                </DialogActions>
              </Dialog>
            </CardContent>
          </Card>

          {/* Writer Setup Section */}
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
                  value={writerFilter.search}
                  onChange={(e) =>
                    setWriterFilter((prev) => ({
                      ...prev,
                      search: e.target.value,
                    }))
                  }
                  InputProps={{
                    startAdornment: <SearchIcon fontSize="small" />,
                  }}
                />
                {/* Add button removed - writer settings are auto-created with defaults */}
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Skip QA</InputLabel>
                  <Select
                    label="Skip QA"
                    value={writerFilter.skip_qa ?? ""}
                    onChange={(e) =>
                      setWriterFilter((prev) => ({
                        ...prev,
                        skip_qa: e.target.value,
                      }))
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="true">Yes</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </Select>
                </FormControl>
                {/* Exclusive filter removed */}
                <FormControl size="small" sx={{ minWidth: 170 }}>
                  <InputLabel>Advanced Types</InputLabel>
                  <Select
                    label="Advanced Types"
                    value={writerFilter.access_advanced_types ?? ""}
                    onChange={(e) =>
                      setWriterFilter((prev) => ({
                        ...prev,
                        access_advanced_types: e.target.value,
                      }))
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="true">Has access</MenuItem>
                    <MenuItem value="false">No access</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Table */}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Writer Name</TableCell>
                    <TableCell>First Name</TableCell>
                    <TableCell>Last Name</TableCell>
                    <TableCell>Skip QA</TableCell>
                    <TableCell>Advanced Types</TableCell>
                    <TableCell>Posting Accounts</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredWriterSettings.map((ws) => (
                    <TableRow key={ws.id} hover>
                      <TableCell>{ws.id}</TableCell>
                      <TableCell>{ws.writer_name}</TableCell>
                      <TableCell>{ws.writer_fname ?? ""}</TableCell>
                      <TableCell>{ws.writer_lname ?? ""}</TableCell>
                      <TableCell>
                        <Checkbox checked={!!ws.skip_qa} disabled />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={!!ws.access_advanced_types}
                          disabled
                        />
                      </TableCell>
                      <TableCell>
                        {renderPostingAccountsInTable(ws.post_acct_list)}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
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
                      <TableCell colSpan={10}>
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

              {/* Writer Setting Modal */}
              <Dialog
                open={writerModalOpen}
                onClose={() => setWriterModalOpen(false)}
                fullWidth
                maxWidth="sm"
              >
                <DialogTitle>
                  {writerModalMode === "create"
                    ? "Add Writer Setting"
                    : `Edit Writer Setting (ID ${writerEdit?.id})`}
                </DialogTitle>
                <DialogContent dividers>
                  <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                      label="ID"
                      type="number"
                      value={writerEdit?.id ?? ""}
                      disabled
                      size="small"
                    />
                    {/* Writer ID field removed */}
                    <TextField
                      label="Writer Name"
                      value={writerEdit?.writer_name ?? ""}
                      disabled
                      size="small"
                    />
                    <TextField
                      label="First Name"
                      value={writerEdit?.writer_fname || ""}
                      onChange={(e) =>
                        setWriterEdit((prev) => ({
                          ...prev,
                          writer_fname: e.target.value || "",
                        }))
                      }
                      size="small"
                    />
                    <TextField
                      label="Last Name"
                      value={writerEdit?.writer_lname || ""}
                      onChange={(e) =>
                        setWriterEdit((prev) => ({
                          ...prev,
                          writer_lname: e.target.value || "",
                        }))
                      }
                      size="small"
                    />
                    <FormControl size="small">
                      <InputLabel>Posting Accounts</InputLabel>
                      <Select
                        label="Posting Accounts"
                        multiple
                        value={writerEdit?.post_acct_list || []}
                        onChange={(e) =>
                          setWriterEdit((prev) => ({
                            ...prev,
                            post_acct_list: e.target.value,
                          }))
                        }
                        renderValue={renderPostingAccountsValue}
                      >
                        {postingAccounts.map((acct) => (
                          <MenuItem key={acct.id} value={acct.id}>
                            {acct.account} ({acct.id})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
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
                          />
                        }
                        label="Skip QA"
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
                          />
                        }
                        label="Access Advanced Types"
                      />
                    </Box>
                  </Stack>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setWriterModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={async () => {
                      if (writerModalMode === "create") {
                        await axios.post("/api/admin/writer-settings", {
                          id: Number(writerEdit?.id) || undefined,
                          writer_id: writerEdit?.writer_id
                            ? Number(writerEdit?.writer_id)
                            : null,
                          writer_name: writerEdit?.writer_name,
                          writer_fname: writerEdit?.writer_fname || null,
                          writer_lname: writerEdit?.writer_lname || null,
                          skip_qa: !!writerEdit?.skip_qa,
                          exclusive_post_acct:
                            !!writerEdit?.exclusive_post_acct,
                          post_acct_list: Array.isArray(
                            writerEdit?.post_acct_list
                          )
                            ? writerEdit?.post_acct_list
                            : [],
                          access_advanced_types:
                            !!writerEdit?.access_advanced_types,
                        });
                      } else {
                        const updateData = {
                          writer_id: writerEdit?.writer_id
                            ? Number(writerEdit?.writer_id)
                            : null,
                          writer_name: writerEdit?.writer_name,
                          writer_fname: writerEdit?.writer_fname || null,
                          writer_lname: writerEdit?.writer_lname || null,
                          skip_qa: !!writerEdit?.skip_qa,
                          post_acct_list: Array.isArray(
                            writerEdit?.post_acct_list
                          )
                            ? writerEdit?.post_acct_list
                            : [],
                          access_advanced_types:
                            !!writerEdit?.access_advanced_types,
                        };
                        // console.log("🔍 Saving writer data:", updateData);
                        await axios.put(
                          `/api/admin/writer-settings/${writerEdit?.id}`,
                          updateData
                        );
                      }
                      setWriterModalOpen(false);
                      await fetchWriterSettings();
                      await suggestNextWriterSettingId();
                    }}
                  >
                    Save
                  </Button>
                </DialogActions>
              </Dialog>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Layout>
  );
};

export default AdminSettings;
