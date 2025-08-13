import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Container,
  Form,
  Button,
  Alert,
  Card,
  Row,
  Col,
  Dropdown,
  DropdownButton,
  FormControl,
  InputGroup,
} from "react-bootstrap";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faFileAlt,
  faSort,
  faPlayCircle,
} from "@fortawesome/free-solid-svg-icons";
import MotivationalPopup from "../components/MotivationalPopup";


const WriterDashboard = () => {
  const [writer, setWriter] = useState(null);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState("");
  const [googleDocLink, setGoogleDocLink] = useState("");
  const [aiChatUrl, setAiChatUrl] = useState("");
  const [scripts, setScripts] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [searchTitle, setSearchTitle] = useState("");
  const [filter, setFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // For sorting submissions
  const [statusFilter, setStatusFilter] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prefixType, setPrefixType] = useState("Trope");
  const [prefixNumber, setPrefixNumber] = useState("Choose");
  const [tropeList, setTropeList] = useState([]);
  const [structureList, setStructureList] = useState([]);
  const [selectedStructure, setSelectedStructure] = useState("");

  const username = localStorage.getItem("username");

  useEffect(() => {
    const fetchTropes = async () => {
      try {
        const response = await axios.get("/api/tropes");
        console.log('Tropes API response:', response.data);
        if (Array.isArray(response.data)) {
          setTropeList(response.data.map((trope) => trope.name));
        } else {
          console.error('Tropes API did not return an array:', response.data);
          setTropeList([]);
        }
      } catch (error) {
        console.error("Error fetching tropes:", error);
        setTropeList([]);
      }
    };

    fetchTropes();
  }, []);

  useEffect(() => {
    const fetchWriterData = async () => {
      if (!username) {
        setError("Username not found in local storage.");
        return;
      }
      try {
        const response = await axios.get(`/api/getWriter?username=${username}`);
        setWriter(response.data);
        fetchStructures(response.data.id);
        fetchScripts(response.data.id);
      } catch (error) {
        console.error("Error fetching writer data:", error);
        setError("Error fetching writer data");
      }
    };

    const fetchStructures = async (writerId) => {
      try {
        const response = await axios.get("/api/structures");
        console.log('Structures API response:', response.data);
        if (response.data && response.data.structures) {
          setStructureList(response.data.structures);
          if (response.data.structures.length > 0) {
            setSelectedStructure(response.data.structures[0].name);
          }
        } else {
          console.error('Structures API did not return expected format:', response.data);
          setStructureList([]);
        }
      } catch (error) {
        console.error("Error fetching structures:", error);
        setStructureList([]);
      }
    };

    fetchWriterData();
  }, [username]);

  const fetchScripts = async (writer_id, filters = {}) => {
    try {
      let url = `/api/scripts?writer_id=${writer_id}`;

      // Add query parameters for filtering
      if (filters.startDate && filters.endDate) {
        url += `&startDate=${filters.startDate}&endDate=${filters.endDate}`;
      }
      if (filters.searchTitle) {
        url += `&searchTitle=${encodeURIComponent(filters.searchTitle)}`;
      }

      const response = await axios.get(url);
      console.log('Scripts API response:', response.data);
      if (Array.isArray(response.data)) {
        setScripts(response.data);
      } else {
        console.error('Scripts API did not return an array:', response.data);
        setScripts([]);
      }
    } catch (error) {
      console.error("Error fetching scripts:", error);
      setError("Error fetching scripts");
      setScripts([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!writer) {
      setError("Writer information not loaded yet.");
      return;
    }

    // Validation for Trope type and Number
    if (prefixType === "Trope" && prefixNumber === "Choose") {
      setError("Please select a valid Trope number before submitting.");
      return;
    }

    setError(null); // Clear previous errors
    setIsSubmitting(true);

    try {
      // Check if user is an intern (no structure prefix for interns)
      const isIntern = ['quinn', 'kayla', 'gianmarco'].includes(username?.toLowerCase());
      const structurePrefix = (selectedStructure && !isIntern) ? `[${selectedStructure}] ` : "";

      const fullTitle =
        structurePrefix +
        (prefixType === "Original" ||
        prefixType === "Re-write" ||
        prefixType === "STL"
          ? `[${prefixType}] ${title}`
          : `[${prefixType} ${prefixNumber}] ${title}`);

      const response = await axios.post("/api/scripts", {
        writer_id: writer.id,
        title: fullTitle,
        googleDocLink,
        aiChatUrl,
      });

      setScripts([...scripts, response.data]);
      setTitle("");
      setGoogleDocLink("");
      setAiChatUrl("");
      //  setImageIncluded("No"); // Reset Image field to default "No"

      setError(null);
      alert("Approval pending, may take 24-48 hours");
    } catch (error) {
      setError(error.response?.data?.error || "Error submitting script");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusDisplay = (status) => {
    // Handle undefined or null status
    if (!status || typeof status !== 'string') {
      return "Unknown";
    }
    // Normalize input to prevent casing and trimming issues
    const normalizedStatus = status.trim().toLowerCase();
    switch (normalizedStatus) {
      case "approved script. ready for production":
      case "writer submissions (qa)":
      case "finished video":
        return "Pending";
      case "rejected":
        return "Rejected";
      case "posted":
        return "Posted";
      default:
        return "Unknown";
    }
  };

  const getStatusStyle = (status) => {
    const displayedStatus = getStatusDisplay(status);
    switch (displayedStatus) {
      case "Rejected":
        return { color: "white", backgroundColor: "red" };
      case "Pending":
        return { color: "black", backgroundColor: "yellow" };
      case "Posted":
        return { color: "white", backgroundColor: "purple" };
      default:
        return { color: "white", backgroundColor: "grey" };
    }
  };

  const handleFilterChange = (selectedFilter) => {
    setFilter(selectedFilter);
    if (selectedFilter === "Show All") {
      setStatusFilter(""); // Reset status filter
      setSearchTitle("");
      setStartDate(null);
      setEndDate(null);
      // Reload scripts without filters
      if (writer) {
        fetchScripts(writer.id);
      }
    }
  };

  const applyFilters = () => {
    if (writer) {
      const filters = {};
      if (filter === "Custom" && startDate && endDate) {
        filters.startDate = startDate.toISOString().split('T')[0];
        filters.endDate = endDate.toISOString().split('T')[0];
      }
      if (filter === "Title" && searchTitle) {
        filters.searchTitle = searchTitle;
      }
      fetchScripts(writer.id, filters);
    }
  };

  const filterScripts = () => {
    let filteredScripts = [...scripts];

    // Reset filters for "Show All"
    if (filter === "Show All") {
      setStatusFilter(""); // Reset the status filter to show all statuses
      return [...scripts]; // Return all scripts without further filtering
    }

    // Filter by Title
    if (filter === "Title") {
      filteredScripts = filteredScripts.filter((script) =>
        script.title.toLowerCase().includes(searchTitle.toLowerCase())
      );
    }

    // Filter by Custom Date Range
    if (filter === "Custom") {
      filteredScripts = filteredScripts.filter((script) => {
        const scriptDate = new Date(script.created_at);
        return startDate && endDate
          ? scriptDate >= startDate && scriptDate <= endDate
          : true;
      });
    }

    // Filter by Status
    if (statusFilter && statusFilter !== "All Statuses") {
      filteredScripts = filteredScripts.filter(
        (script) => getStatusDisplay(script.approval_status) === statusFilter
      );
    }

    // Sort by date based on sortOrder
    filteredScripts.sort((a, b) =>
      sortOrder === "desc"
        ? new Date(b.created_at) - new Date(a.created_at)
        : new Date(a.created_at) - new Date(b.created_at)
    );

    return filteredScripts;
  };

  const handleTypeChange = (e) => {
    setPrefixType(e.target.value);
    // Reset prefix number when type changes
    if (e.target.value !== "Trope") {
      setPrefixNumber("Choose");
    }
  };



  return (
    <div className="dashboard">
      <MotivationalPopup />
      <div style={{ marginTop: "30px" }}>
        <Container>
          {writer && (
            <div className="welcome-note">
              <h6 style={{ color: "#2596be", fontSize: "20px" }}>
                Welcome, {writer.name}! What are we writing today?
              </h6>
              <p style={{ color: "grey" }}>Writer ID: {writer.id}</p>
            </div>
          )}
          {error && <Alert variant="danger">{error}</Alert>}
          <Row>
            <Col md={8}>
              <h3>New Script Submission</h3>
              <div className="form-container" style={{ width: "1000px" }}>
                <Form onSubmit={handleSubmit}>
                  <Form.Group style={{ marginBottom: "30px" }}>
                    <Form.Label>Title</Form.Label>
                    <Form.Control
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </Form.Group>

                  <div className="d-flex mb-2">
                    <Form.Group
                      className="me-4"
                      style={{ marginBottom: "25px" }}
                    >
                      <Form.Label>Type</Form.Label>
                      <Form.Control
                        as="select"
                        value={prefixType}
                        onChange={handleTypeChange}
                      >
                        <option value="Trope">Trope</option>
                        <option value="Original">Original</option>
                        {writer?.access_advanced_types && (
                          <>
                            <option value="Re-write">Re-write</option>
                            <option value="STL">STL</option>
                          </>
                        )}
                      </Form.Control>
                    </Form.Group>

                    {prefixType === "Trope" && (
                      <Form.Group>
                        <Form.Label>Number</Form.Label>
                        <div className="d-flex align-items-center">
                          <Form.Control
                            as="select"
                            value={prefixNumber}
                            onChange={(e) => setPrefixNumber(e.target.value)}
                            style={{ width: "100px", marginRight: "15px" }}
                          >
                            <option value="Choose" disabled>
                              Choose
                            </option>
                            {Array.from(
                              { length: tropeList.length },
                              (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                  {i + 1}
                                </option>
                              )
                            )}
                          </Form.Control>

                          {/* Styled Trope Display */}
                          <div
                            style={{
                              border: "1px solid #ced4da", // Same as text field border
                              borderRadius: "4px",
                              padding: "7px 15px", // Match padding with text fields
                              backgroundColor: "#fff", // White background
                              fontSize: "14px", // Font size matching text fields
                              flex: 1,
                              height: "38px", // Ensure a consistent height matching other fields
                              display: "flex", // Flexbox for alignment
                              alignItems: "center", // Center content vertically
                              overflow: "hidden", // Hide overflowing text
                              textOverflow: "ellipsis", // Add ellipsis for overflow
                              whiteSpace: "nowrap", // Prevent text wrapping
                              minWidth: "300px", // Ensures the box is wider for TLDR content
                            }}
                          >
                            {prefixType === "Trope" && prefixNumber !== "Choose"
                              ? `${tropeList[prefixNumber - 1]}`
                              : "TLDR"}
                          </div>
                        </div>
                      </Form.Group>
                    )}
                  </div>
                  {/* Hide structure dropdown for intern writers */}
                  {!['quinn', 'kayla', 'gianmarco'].includes(username?.toLowerCase()) && (
                    <Form.Group style={{ marginBottom: "25px" }}>
                      <Form.Label>Structure</Form.Label>
                      <Form.Control
                        as="select"
                        value={selectedStructure || ""}
                        onChange={(e) => setSelectedStructure(e.target.value)}
                      >
                        <option value="">-- No structure selected --</option>
                        {structureList.map((structure) => (
                          <option key={structure.structure_id || structure.id} value={structure.name}>
                            {structure.name}
                          </option>
                        ))}
                      </Form.Control>
                    </Form.Group>
                  )}

                  <Form.Group>
                    <Form.Label>Google Doc Link</Form.Label>
                    <Form.Control
                      type="url"
                      value={googleDocLink}
                      onChange={(e) => setGoogleDocLink(e.target.value)}
                      required
                    />
                  </Form.Group>

                  <Form.Group style={{ marginBottom: "25px" }}>
                    <Form.Label>AI Chat URL (Optional)</Form.Label>
                    <Form.Control
                      type="url"
                      value={aiChatUrl}
                      onChange={(e) => setAiChatUrl(e.target.value)}
                      placeholder="https://chatgpt.com/share/..."
                    />
                  </Form.Group>

                  <Button
                    type="submit"
                    variant="primary"
                    className="button1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </Button>
                </Form>
              </div>
            </Col>
            <Col md={4} className="left-container d-flex flex-column">
              <h3 style={{ marginLeft: 30 }}>Previous Submissions</h3>
              <div className="filters d-flex flex-column align-items-start mb-3">
                {/* Top Row: Filters and Sort Buttons */}
                <div className="d-flex align-items-center mb-3">
                  <DropdownButton
                    id="filter-dropdown"
                    title="Filters"
                    variant="primary"
                    className="me-3"
                  >
                    <Dropdown.Item onClick={() => handleFilterChange("")}>
                      Show All
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => setFilter("Custom")}>
                      Custom Date
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => setFilter("Title")}>
                      Title
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={() => setStatusFilter("")}>
                      All Statuses
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => setStatusFilter("Rejected")}>
                      Rejected
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => setStatusFilter("Pending")}>
                      Pending
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => setStatusFilter("Posted")}>
                      Posted
                    </Dropdown.Item>
                  </DropdownButton>

                  <Button
                    variant="secondary"
                    onClick={() =>
                      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))
                    }
                    className="me-3"
                  >
                    <FontAwesomeIcon icon={faSort} /> Sort By Date
                  </Button>
                </div>

                {/* Second Row: Search by Title or Custom Date */}
                {filter === "Title" && (
                  <div className="search-title w-100 mb-3">
                    <InputGroup>
                      <FormControl
                        placeholder="Search by title"
                        value={searchTitle}
                        onChange={(e) => setSearchTitle(e.target.value)}
                      />
                      <Button variant="outline-secondary" onClick={applyFilters}>
                        <FontAwesomeIcon icon={faSearch} />
                      </Button>
                    </InputGroup>
                  </div>
                )}

                {filter === "Custom" && (
                  <div className="custom-date-filter w-100 mb-3">
                    <div className="d-flex">
                      <DatePicker
                        selected={startDate}
                        onChange={(date) => setStartDate(date)}
                        className="form-control me-2"
                        placeholderText="Start Date"
                      />
                      <DatePicker
                        selected={endDate}
                        onChange={(date) => setEndDate(date)}
                        className="form-control me-2"
                        placeholderText="End Date"
                      />
                      <Button onClick={applyFilters}>Apply</Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="cards-container flex-grow-1">
                <Row>
                  {filterScripts().map((script) => (
                    <Col key={script.id} sm={12} className="mb-3">
                      <Card className="sticky-note">
                        <Card.Body>
                          <Card.Title>{script.title}</Card.Title>
                          <Card.Text>
                            <small>
                              Submitted on:{" "}
                              {script.created_at
                                ? new Date(
                                    script.created_at
                                  ).toLocaleDateString()
                                : "Unknown"}
                            </small>
                          </Card.Text>

                          {script.google_doc_link && (
                            <a
                              href={script.google_doc_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                marginTop: "10px",
                                textDecoration: "none",
                                color: "#4285F4", // Google's blue color
                              }}
                            >
                              <FontAwesomeIcon
                                icon={faFileAlt}
                                size="lg"
                                style={{ marginRight: "5px" }}
                              />
                              <span>Open Google Doc</span>
                            </a>
                          )}

                          {/* Display Loom URL for Rejected Cards */}
                          {script.approval_status === "Rejected" &&
                            script.loom_url && (
                              <a
                                href={script.loom_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  marginTop: "10px",
                                  textDecoration: "none",
                                  color: "purple", // Purple color for Loom URL
                                }}
                              >
                                <FontAwesomeIcon
                                  icon={faPlayCircle} // Video play icon
                                  size="lg"
                                  style={{ marginRight: "5px" }}
                                />
                                <span>Open Loom Video</span>
                              </a>
                            )}
                        </Card.Body>

                        <Card.Footer
                          style={{
                            ...getStatusStyle(script.approval_status),
                            textAlign: "center", // Center-align text
                            display: "flex", // Enable flexbox
                            justifyContent: "center", // Center content horizontally
                            alignItems: "center", // Center content vertically if needed
                          }}
                        >
                          <small>
                            {getStatusDisplay(script.approval_status)}
                          </small>
                        </Card.Footer>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  );
};

export default WriterDashboard;
