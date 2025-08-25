import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Box,
  Typography,
  Select,
  MenuItem,
  CircularProgress,
  Modal,
  Button,
  TextField,
  InputAdornment,
  IconButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import ReactECharts from "echarts-for-react";
import { DataGrid } from "@mui/x-data-grid";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

const formatNumber = (value) => {
  if (typeof value !== "number") return "N/A";
  return Math.round(value).toLocaleString(); // Round to the nearest integer and format with commas
};

// Utility function to format dates for display
const formatDate = (date) => {
  const parsedDate = dayjs(date);
  return parsedDate.isValid()
    ? parsedDate.format("MMM D, YYYY")
    : "Invalid Date";
};

const WriterAnalytics = () => {
  const [viewsData, setViewsData] = useState([]);
  const [tableData, setTableData] = useState([]); // Data for the table
  const [filteredTableData, setFilteredTableData] = useState([]); // Filtered data for the table
  const [loading, setLoading] = useState(false);
  const [writerId, setWriterId] = useState(null);
  const [writerName, setWriterName] = useState("");
  const [dateRange, setDateRange] = useState("lifetime");
  const [customStartDate, setCustomStartDate] = useState(
    dayjs().subtract(30, "days")
  );
  const [customEndDate, setCustomEndDate] = useState(dayjs());
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showClearButton, setShowClearButton] = useState(false);
  const [dailyVideoCounts, setDailyVideoCounts] = useState([]);

  useEffect(() => {
    const username = localStorage.getItem("username");
    if (username) {
      fetchWriterData(username);
    }
  }, []);

  const fetchWriterData = async (username) => {
    try {
      const response = await axios.get(`/api/getWriter?username=${username}`);
      setWriterId(response.data.id);
      setWriterName(response.data.name);
      fetchData(response.data.id, dateRange);
    } catch (error) {
      console.error("Error fetching writer data:", error);
    }
  };

  const getDateRange = (range) => {
    let endDate = dayjs();
    let startDate;

    switch (range) {
      case "7":
        startDate = endDate.subtract(7, "days");
        break;
      case "14":
        startDate = endDate.subtract(14, "days");
        break;
      case "30":
        startDate = endDate.subtract(30, "days");
        break;
      case "custom":
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      case "lifetime":
        startDate = endDate.subtract(240, "days");
        break;
      default:
        startDate = endDate.subtract(240, "days");
    }
    return {
      startDate: startDate.format("YYYY-MM-DD"),
      endDate: endDate.format("YYYY-MM-DD"),
    };
  };

  const fetchData = async (id, range) => {
    const { startDate, endDate } = getDateRange(range);
    const today = dayjs().format("YYYY-MM-DD");
    const yesterday = dayjs().subtract(1, "days").format("YYYY-MM-DD");

    try {
      setLoading(true);

      // Fetch views data for the chart
      const viewsResponse = await axios.get(`/api/writer/views`, {
        params: { writer_id: id, startDate, endDate },
      });
      const sortedViewsData = viewsResponse.data
        .map((item) => ({
          time: item.time.value,
          views: item.views,
        }))
        .filter((item) => item.time !== today && item.time !== yesterday) // Exclude today's and yesterday's data
        .sort((a, b) => new Date(a.time) - new Date(b.time));
      setViewsData(sortedViewsData);

      // Fetch daily video counts for chart boxes
      const videoCountsResponse = await axios.get(`/api/writer/daily-video-counts`, {
        params: { writer_id: id, startDate, endDate },
      });
      setDailyVideoCounts(videoCountsResponse.data.data || []);

      // Fetch table data
      const response = await axios.get(`/api/writer/analytics`, {
        params: { writer_id: id, startDate, endDate },
      });

      // Separate YouTube and non-YouTube data
      const youtubeData = response.data.filter((item) =>
        item.url.includes("youtube.com")
      );

      const nonYoutubeData = response.data.filter(
        (item) => !item.url.includes("youtube.com")
      );

      // Combine YouTube and non-YouTube data
      const combinedData = [...youtubeData, ...nonYoutubeData];

      // Filter out records where views, likes, and comments are all zero
      const filteredData = combinedData.filter(
        (item) =>
          item.views_total > 0 ||
          item.likes_total > 0 ||
          item.comments_total > 0
      );

      setTableData(filteredData); // Set the filtered data for the table
      setFilteredTableData(filteredData); // Initialize filtered data with all data
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleDateRangeChange = (event) => {
    const selectedRange = event.target.value;

    if (selectedRange === "custom") {
      setIsCustomModalOpen(true);
      setDateRange("reset"); // Temporarily reset the dropdown value to enable consecutive custom selections
    } else {
      setDateRange(selectedRange);
      if (writerId) fetchData(writerId, selectedRange);
    }
  };

  const handleCustomApply = () => {
    setDateRange("custom");
    setIsCustomModalOpen(false);
    if (writerId) fetchData(writerId, "custom");
  };

  // Handle search by URL or title
  const handleSearch = (event) => {
    const term = event.target.value;
    setSearchTerm(term);
    setShowClearButton(term.length > 0);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm("");
    setShowClearButton(false);
  };

  // Filter table data based on search term (URL or title)
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredTableData(tableData);
    } else {
      const searchTermLower = searchTerm.toLowerCase();
      const filtered = tableData.filter(item =>
        item.url.toLowerCase().includes(searchTermLower) ||
        (item.title && item.title.toLowerCase().includes(searchTermLower))
      );
      setFilteredTableData(filtered);
    }
  }, [searchTerm, tableData]);

  const totalViews = viewsData.reduce((acc, item) => acc + item.views, 0);

  // Helper function to aggregate data by day
  const aggregateByDay = (data) => {
    const aggregatedData = data.reduce((acc, item) => {
      const date = dayjs(item.time).format("YYYY-MM-DD");
      if (!acc[date]) {
        acc[date] = { time: date, views: 0 };
      }
      acc[date].views += Math.round(item.views); // Round to the nearest integer
      return acc;
    }, {});

    return Object.values(aggregatedData).sort(
      (a, b) => new Date(a.time) - new Date(b.time)
    );
  };

  // Apply the aggregation function to viewsData
  const aggregatedViewsData = aggregateByDay(viewsData);

  const chartOptions = {
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(244, 81, 30, 0.2)",
      borderColor: "#f4511e",
      borderWidth: 1,
      textStyle: { color: "#333" },
      formatter: (params) => {
        const date = params[0]?.axisValue || "N/A";
        const value = params[0]?.value || 0;

        // Use the updated formatNumber function
        const formattedValue = formatNumber(value);

        return `
          <div style="min-width: 150px;">
            <div style="font-size: 12px; color: #747575;">${date}</div>
            <div style="font-size: 18px; font-weight: 600; color: #333;">${formattedValue} Views</div>
          </div>
        `;
      },
      extraCssText: "box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);",
    },

    xAxis: {
      type: "category",
      boundaryGap: false,
      data: aggregatedViewsData.map((item) => formatDate(item.time)),
      axisLabel: {
        formatter: (value, index) => (index % 2 === 0 ? value : ""),
      },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: formatNumber,
      },
    },
    series: [
      {
        data: aggregatedViewsData.map((item) => item.views),
        type: "line",
        smooth: true,
        lineStyle: { color: "#f4511e" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(244, 81, 30, 0.4)" },
              { offset: 1, color: "rgba(244, 81, 30, 0)" },
            ],
          },
        },
      },
    ],
  };

  // Define the formatNumber function
  function formatNumber(value) {
    return Number(value).toLocaleString(); // Automatically adds commas
  }

  return (
    <Box
      sx={{
        padding: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: "#fff",
        width: "1180px",
      }}
    >
      {/* Heading at the top left corner */}
      <Box sx={{ alignSelf: "flex-start", marginBottom: 2 }}>
        <Typography
          variant="h5"
          sx={{ color: "#333", fontWeight: "bold" }}
        >{`Hey ${writerName}, check your Analytics`}</Typography>
      </Box>

      <Box
        sx={{
          width: "80%",
          width: "1180px",
          padding: 2,
          borderRadius: 2,
          boxShadow: 3,
          backgroundColor: "#fff",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 3,
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: "bold",
              alignItems: "center",
              alignContent: "center",
              marginLeft: "300px",
            }}
          >
            {(() => {
              const actualStartDate =
                viewsData.length > 0
                  ? dayjs(viewsData[0].time)
                  : customStartDate;
              const displayStartDate = customStartDate.isBefore(actualStartDate)
                ? actualStartDate
                : customStartDate;
              const displayEndDate = customEndDate;

              return `These videos got ${Math.round(viewsData.reduce((acc, item) => acc + item.views, 0)).toLocaleString()} views ${
                dateRange === "custom"
                  ? `between ${formatDate(displayStartDate)} and ${formatDate(displayEndDate)}`
                  : dateRange === "lifetime"
                    ? "in the lifetime period"
                    : `in the last ${dateRange} days`
              }`;
            })()}
          </Typography>

          <Select
            value={dateRange}
            onChange={handleDateRangeChange}
            sx={{
              backgroundColor: "#f4511e",
              color: "white",
              borderRadius: 2,
              padding: "0px 0px",
            }}
            renderValue={() =>
              dateRange === "custom" ? "Custom" : `${dateRange} Days`
            }
          >
            <MenuItem value="7">Last 7 Days</MenuItem>
            <MenuItem value="14">Last 14 Days</MenuItem>
            <MenuItem value="30">Last 30 Days</MenuItem>
            <MenuItem value="lifetime">Lifetime</MenuItem>
            <MenuItem value="custom">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCustomModalOpen(true);
                }}
                sx={{ color: "#1a73e8" }}
              >
                Custom Date Range
              </Button>
            </MenuItem>
          </Select>
        </Box>

        <Modal
          open={isCustomModalOpen}
          onClose={() => setIsCustomModalOpen(false)}
        >
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 400,
              bgcolor: "background.paper",
              borderRadius: 2,
              boxShadow: 24,
              p: 4,
            }}
          >
            <Typography variant="h6">Select Custom Date Range</Typography>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Start Date"
                value={customStartDate}
                onChange={(newValue) => setCustomStartDate(newValue)}
                renderInput={(params) => (
                  <TextField {...params} fullWidth sx={{ mb: 2 }} />
                )}
              />
              <DatePicker
                label="End Date"
                value={customEndDate}
                onChange={(newValue) => setCustomEndDate(newValue)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </LocalizationProvider>
            <Button
              onClick={handleCustomApply}
              sx={{ backgroundColor: "#f4511e", color: "white", mt: 2 }}
              fullWidth
            >
              Apply
            </Button>
          </Box>
        </Modal>
        <Box sx={{ width: "1180px", height: "300px", marginTop: 4 }}>
          {loading ? (
            <CircularProgress />
          ) : (
            <ReactECharts option={chartOptions} />
          )}
        </Box>

        {/* Daily Video Count Boxes */}
        {!loading && aggregatedViewsData.length > 0 && (
          <Box sx={{
            width: "1180px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            mt: 2,
            gap: 1
          }}>
            {aggregatedViewsData.map((item, index) => {
              // Find matching video count for this date
              const dateStr = item.time; // YYYY-MM-DD format
              const videoCount = dailyVideoCounts.find(vc => vc.date === dateStr)?.count || 0;

              return (
                <Box
                  key={index}
                  sx={{
                    minWidth: "40px",
                    height: "32px",
                    backgroundColor: "#666",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: "600",
                    border: "1px solid #777",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                  }}
                >
                  {videoCount > 9 ? `${videoCount}+` : videoCount}
                </Box>
              );
            })}
          </Box>
        )}

        {/* Search Field for URL and Title */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 4 }}>
          <Typography variant="body2" color="textSecondary">
            {searchTerm ?
              `Showing ${filteredTableData.length} of ${tableData.length} results matching "${searchTerm}"` :
              `${tableData.length} total videos`}
          </Typography>

          <TextField
            placeholder="Search by URL or title"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={handleSearch}
            sx={{ width: '300px' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: showClearButton && (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="clear search"
                    onClick={handleClearSearch}
                    edge="end"
                    size="small"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <DataTable tableData={filteredTableData} />
      </Box>
    </Box>
  );
};

const DataTable = ({ tableData }) => {
  // Get the URL search term from the parent component
  const [searchTerm, setSearchTerm] = useState("");

  // Update search term when it changes in the parent
  useEffect(() => {
    const searchInput = document.querySelector('input[placeholder="Search by URL or title"]');
    if (searchInput) {
      const updateSearchTerm = () => {
        setSearchTerm(searchInput.value.toLowerCase());
      };

      searchInput.addEventListener('input', updateSearchTerm);

      // Initial value
      updateSearchTerm();

      return () => {
        searchInput.removeEventListener('input', updateSearchTerm);
      };
    }
  }, []);

  return (
  <Box sx={{ height: 600, width: "1180px", maxWidth: "100%" }}>
    <DataGrid
      rows={tableData.map((item, index) => ({
        id: index,
        preview: item.preview,
        url: item.url,
        title: item.title,
        views_total: item.views_total,
        likes_total: item.likes_total,
        comments_total: item.comments_total,
        shares_total: item.shares_total,
        saves_total: item.saves_total,
        posted_date: formatDate(item.posted_date),
      }))}
      columns={[
        {
          field: "preview",
          headerName: "Preview",
          sortable: false,
          renderCell: (params) => (
            <img
              src={params.value}
              alt="Video Preview"
              onError={(e) => (e.target.src = "/path/to/default-image.jpg")}
              style={{
                width: 110,
                height: 50,
                objectFit: "cover",
                borderRadius: 4,
              }}
            />
          ),
          width: 110,
        },
        {
          field: "url",
          headerName: "URL",
          sortable: false,
          flex: 1,
          renderCell: (params) => {
            // Highlight the search term if it exists
            if (searchTerm && params.value.toLowerCase().includes(searchTerm)) {
              const parts = params.value.split(new RegExp(`(${searchTerm})`, 'gi'));
              return (
                <a
                  href={params.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#1a73e8", textDecoration: "none" }}
                >
                  {parts.map((part, i) =>
                    part.toLowerCase() === searchTerm.toLowerCase() ?
                      <span key={i} style={{ backgroundColor: '#ffff00', fontWeight: 'bold' }}>{part}</span> :
                      part
                  )}
                </a>
              );
            }

            // Regular rendering without highlighting
            return (
              <a
                href={params.value}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#1a73e8", textDecoration: "none" }}
              >
                {params.value}
              </a>
            );
          },
        },
        {
          field: "title",
          headerName: "Title",
          flex: 1,
          sortable: false,
          renderCell: (params) => {
            // Highlight the search term if it exists and matches in the title
            if (searchTerm && params.value && params.value.toLowerCase().includes(searchTerm)) {
              const parts = params.value.split(new RegExp(`(${searchTerm})`, 'gi'));
              return (
                <div>
                  {parts.map((part, i) =>
                    part.toLowerCase() === searchTerm.toLowerCase() ?
                      <span key={i} style={{ backgroundColor: '#ffff00', fontWeight: 'bold' }}>{part}</span> :
                      part
                  )}
                </div>
              );
            }

            // Regular rendering without highlighting
            return params.value;
          },
        },
        { field: "views_total", headerName: "Views", width: 100 },
        { field: "likes_total", headerName: "Likes", width: 100 },
        { field: "comments_total", headerName: "Comments", width: 100 },

        { field: "posted_date", headerName: "Posted Date", width: 150 },
      ]}
      pageSize={5}
      disableColumnMenu
      disableSelectionOnClick
      sx={{
        "& .MuiDataGrid-columnHeaders": {
          backgroundColor: "#f5f5f5",
          color: "#333",
          fontWeight: "bold",
        },
        "& .MuiDataGrid-row": {
          "&:nth-of-type(even)": { backgroundColor: "#f9f9f9" },
        },
        "& .MuiDataGrid-cell": {
          fontSize: "14px",
          borderBottom: "1px solid #e0e0e0",
        },
      }}
    />
  </Box>
  );
};

export default WriterAnalytics;