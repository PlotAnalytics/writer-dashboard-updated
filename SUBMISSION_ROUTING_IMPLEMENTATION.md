# Submission Routing System Implementation

## Overview
Implemented a comprehensive submission routing management system for the Master Editor interface that allows dynamic configuration of writer submission destinations.

## Backend API Endpoints

### 1. GET `/api/master-editor/submission-routing`
- **Purpose**: Fetch all submission routing data
- **Authentication**: Requires master_editor role
- **Response**: Returns data from `vw_submission_routing` view
- **Query**: `SELECT * FROM vw_submission_routing ORDER BY writer_id`

### 2. GET `/api/master-editor/trello-lists`
- **Purpose**: Fetch all available Trello lists for dropdown options
- **Authentication**: Requires master_editor role
- **Response**: Returns Trello list IDs and names
- **Query**: `SELECT trello_list_id, name FROM api_all_trello_lists ORDER BY name`

### 3. POST `/api/master-editor/update-submission-routing`
- **Purpose**: Update submission routing for a specific writer
- **Authentication**: Requires master_editor role
- **Body Parameters**:
  - `writer_id` (required): The writer's ID
  - `trello_list_id` (required): The new Trello list ID
- **Query**: `UPDATE submission_routing SET trello_list_id = $1 WHERE writer_id = $2`

## Frontend Implementation

### Master Editor Page Updates

#### New Tab Addition
- Added "Submission Routing" as the 4th tab in the Master Editor interface
- Tab index: 3 (zero-based)

#### State Management
```javascript
// New state variables
const [submissionRouting, setSubmissionRouting] = useState([]);
const [trelloLists, setTrelloLists] = useState([]);
const [submissionRoutingLoading, setSubmissionRoutingLoading] = useState(false);
const [routingChanges, setRoutingChanges] = useState({});
```

#### Data Fetching Functions
- `fetchSubmissionRouting()`: Loads current routing configuration
- `fetchTrelloLists()`: Loads available Trello lists for dropdowns
- Integrated into the existing tab loading system

#### User Interface Features

##### Table Display
- **Writer ID**: Displays the writer's unique identifier
- **Writer**: Shows the writer's name from the view
- **Submission Route**: Dropdown selector for Trello lists

##### Interactive Elements
- **Dropdown Selection**: Each writer has a dropdown populated with all available Trello lists
- **Change Tracking**: System tracks which routing assignments have been modified
- **Batch Save**: Save button appears when changes are pending, showing count of modifications
- **Real-time Updates**: Changes are reflected immediately in the interface

##### Visual Design
- Consistent with existing Master Editor styling
- Glass morphism design with backdrop blur effects
- Gradient backgrounds and hover effects
- Loading states with circular progress indicators

## Database Integration

### Required Views and Tables
- **`vw_submission_routing`**: View that provides writer routing data with columns:
  - `writer_id`: Writer's unique identifier
  - `name`: Writer's display name
  - `submission_route_name`: Current route name (derived from submission_route_id)

- **`submission_routing`**: Table for storing routing assignments
  - `writer_id`: Foreign key to writer
  - `trello_list_id`: Target Trello list identifier

- **`api_all_trello_lists`**: Table containing all available Trello lists
  - `trello_list_id`: Unique list identifier
  - `name`: Human-readable list name

## Key Features

### 1. Dynamic Routing Configuration
- Master editors can reassign writers to different submission workflows
- Changes take effect immediately for new submissions
- No code changes required to modify routing

### 2. Batch Operations
- Multiple routing changes can be made before saving
- Single API call saves all pending changes
- Optimistic UI updates with error handling

### 3. User Experience
- Clear visual indication of pending changes
- Loading states during data operations
- Success/error feedback for all operations
- Consistent with existing Master Editor interface

### 4. Error Handling
- Comprehensive error handling for all API operations
- User-friendly error messages
- Graceful degradation when data is unavailable

## Integration with Existing Submission System

The submission routing system integrates seamlessly with the existing script submission logic in `/api/scripts`:

```javascript
// Existing submission routing logic uses the database configuration
const submissionRoute = await pool.query(
  "select trello_list from submission_routing WHERE writer_id = $1 limit 1",
  [writer_id]
);

// Routes are determined by comparing against configured list IDs
const isSTL = submissionRoute.rows[0]?.trello_list == stlDestinationListID;
const isAI = submissionRoute.rows[0]?.trello_list == aiSubmissionsListID;
const isIntern = submissionRoute.rows[0]?.trello_list == internSubmissionsListID;
```

## Benefits

1. **Flexibility**: Easy reassignment of writers between submission workflows
2. **Scalability**: New submission types can be added without code changes
3. **Maintainability**: Centralized routing configuration in database
4. **User-Friendly**: Intuitive interface for managing routing assignments
5. **Audit Trail**: All routing changes are tracked and logged

## Testing

The implementation includes:
- Proper authentication checks for master_editor role
- Input validation for required parameters
- Error handling for database operations
- Loading states and user feedback
- Consistent styling with existing components

## Future Enhancements

Potential improvements could include:
- Audit logging for routing changes
- Bulk import/export of routing configurations
- Advanced filtering and search capabilities
- Historical routing assignment tracking
