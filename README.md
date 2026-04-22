# Marking Moderation Tool

A comprehensive web application for managing academic assessment marking, moderation workflows, and quality assurance in higher education institutions.

## 📋 Overview

The Marking Moderation Tool provides a systematic approach to managing the marking and moderation process for academic assessments. It supports multiple user roles (Lecturers, Moderators, Third Markers, and Administrators) with dedicated workflows for:

- **Assessment Management**: Create and manage module assessments with automated sample generation
- **Marking Workflow**: Upload and track student marks with built-in validation
- **Moderation Process**: Systematic review of marking samples with decision tracking
- **Escalation Handling**: Third marker intervention for disputed cases
- **Audit Trails**: Complete logging of all actions for quality assurance and compliance

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- Next.js 16 (App Router) with React 19
- TypeScript for type safety
- Tailwind CSS 4 for styling
- Lucide React for icons

**Backend:**
- FastAPI (Python) - REST API
- PostgreSQL with asyncpg for async database operations
- Pydantic for data validation
- Argon2 for password hashing
- JWT-based authentication

**Database:**
- PostgreSQL 14+ with UUID support
- Comprehensive relational schema with foreign key constraints
- Indexed for performance on common queries

## 📁 Project Structure

```
marking-moderation-tool/
├── frontend/                      # Next.js application
│   ├── app/                       # Next.js App Router (routing)
│   │   ├── login/                 # Authentication pages
│   │   ├── register/              # User registration
│   │   ├── admin/                 # Admin dashboard & features
│   │   ├── lecturer/              # Lecturer workflows
│   │   │   ├── dashboard/
│   │   │   └── assessments/[id]/  # Assessment detail & upload
│   │   ├── moderator/             # Moderator review workflows
│   │   └── third-marker/          # Third marker escalation handling
│   │
│   ├── components/                # React components
│   │   ├── ui/                    # Reusable UI primitives (Card, Button, Badge, etc.)
│   │   └── features/              # Feature-specific components
│   │       ├── admin/
│   │       ├── lecturer/
│   │       ├── moderator/
│   │       └── third-marker/
│   │
│   ├── types/                     # TypeScript type definitions
│   ├── lib/                       # Utility functions
│   └── public/                    # Static assets
│
├── backend/                       # FastAPI application
│   ├── app/
│   │   ├── main.py                # FastAPI app entry point
│   │   ├── routes/                # API endpoints
│   │   │   ├── auth.py            # Authentication routes
│   │   │   ├── admin.py           # Admin management routes
│   │   │   ├── lecturer.py        # Lecturer workflow routes
│   │   │   ├── moderator.py       # Moderator review routes
│   │   │   └── third_marker.py    # Third marker decision routes
│   │   ├── models/                # Pydantic models
│   │   │   ├── auth.py
│   │   │   ├── assessment.py
│   │   │   └── user.py
│   │   ├── queries/               # Database queries
│   │   │   ├── assessments.py
│   │   │   └── users.py
│   │   └── lib/                   # Core utilities
│   │       ├── config.py          # Settings management
│   │       ├── database.py        # Database connection pool
│   │       ├── security.py        # JWT & auth helpers
│   │       ├── password.py        # Password hashing
│   │       └── middleware.py      # CORS, logging, etc.
│   │
│   ├── tests/                     # Backend test suite
│   │   ├── test_api.py            # API endpoint integration tests
│   │   └── test_e2e_auth.py       # End-to-end authentication tests
│   └── requirements.txt           # Python dependencies
│
├── database_setup.sql             # PostgreSQL schema definition
├── register_users.py              # Script to create test users
├── .env.example                   # Environment variables template
├── README.md                      # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm/pnpm/yarn
- **Python** 3.11+
- **PostgreSQL** 14+
- **Git**

### 1. Clone the Repository

```bash
git clone <repository-url>
cd marking-moderation-tool
```

### 2. Database Setup

1. Create a PostgreSQL database:
```bash
createdb marking_moderation_tool
```

2. Run the schema setup:
```bash
psql -d marking_moderation_tool -f database_setup.sql
```

### 3. Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
```bash
cp ../.env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/marking_moderation_tool
SECRET_KEY=your-secret-key-here
CORS_ORIGINS=["http://localhost:3000"]
```

5. Run the backend:
```bash
uvicorn app.main:app --reload
```

Backend will be available at `http://localhost:8000`

### 4. Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

Frontend will be available at `http://localhost:3000`

## 👥 User Roles & Features

### 👨‍🏫 Lecturer
- Create and manage assessments for module runs
- Upload student marks (via CSV or manual entry)
- **Revise marks** when changes are requested by moderator
- Complete pre-moderation checklist (5 required items)
- Generate moderation samples based on institutional rules
- Submit/resubmit assessments for moderation
- View moderation feedback and sample-specific notes
- **Respond to moderator** with implementation confirmation (module leader response)
- Track mark revision history with audit trail

### 👨‍💼 Moderator
- Review submitted assessments and sample sets
- Complete structured moderation form (7 questions)
- Examine marking patterns and consistency across full grade range
- Add notes to individual sample items
- Make moderation decisions:
  - **APPROVE**: Assessment meets quality standards
  - **REQUEST_CHANGES**: Issues found, lecturer must revise marks
  - **ESCALATE**: Significant concerns, refer to third marker
- Provide detailed feedback and summary comments
- Track resubmissions from lecturers

### ⚖️ Third Marker
- Review escalated moderation cases with full context
- View moderator feedback and concerns
- Make binding third marker decisions:
  - **CONFIRM_MODERATOR**: Agree with moderator's concerns → Status becomes CHANGES_REQUESTED
  - **OVERRIDE**: Disagree, approve assessment → Status becomes APPROVED
  - **REFER_BACK**: Need more information → Status returns to IN_MODERATION
- Provide final recommendations
- Close moderation cases with rationale

### 🔧 Administrator
- Manage user accounts and roles
- Configure modules and module runs
- View system-wide audit logs
- Monitor moderation workflow status with real-time statistics
- Generate compliance reports
- Access complete mark revision history

## 🗄️ Database Schema

### Core Tables

**Users & Authentication:**
- `users` - User accounts with roles (lecturer, moderator, third_marker, admin)
- `audit_log` - Complete action history for compliance

**Academic Structure:**
- `modules` - Course modules
- `module_runs` - Academic year/semester instances
- `students` - Student records (anonymized until marking complete)
- `enrolments` - Student module registrations
- `module_run_staff` - Staff assignments to module runs

**Assessment & Marking:**
- `assessments` - Assessment definitions with metadata
- `marks` - Student marks with feedback, **includes is_revised and revision_reason**
- **`marks_revision_history`** - Complete audit trail of all mark changes (original_mark, revised_mark, revision_reason, revised_by, revised_at)
- `sample_sets` - Generated moderation samples
- `sample_items` - Individual sample entries with risk factors

**Moderation Workflow:**
- `moderation_cases` - Moderation workflow state and decision tracking
- **`pre_moderation_checklists`** - Lecturer's 5-item checklist completed before submission
- `moderation_form_responses` - Moderator's 7-question structured review
- `moderation_item_notes` - Sample-specific comments from moderator
- **`module_leader_responses`** - Lecturer's confirmation after moderator approval
- `third_marker_reviews` - Third marker decisions and recommendations

### New Features Added

**Mark Revision Workflow:**
- When moderator requests changes, lecturer can revise marks
- All revisions tracked in `marks_revision_history` with timestamp and user
- Original marks preserved for audit compliance
- Assessment status becomes CHANGES_REQUESTED
- Lecturer regenerates sample and resubmits for review

**Pre-Moderation Checklist:**
Five required items completed by lecturer before first submission:
1. Marking rubric was used
2. Marking criteria consistently applied
3. Full range of marks used
4. Marks awarded fairly
5. Feedback comments appropriate

**Module Leader Response:**
- After moderator approves assessment (status = APPROVED)
- Lecturer confirms implementation of any feedback
- Provides response comments
- Completes the moderation workflow

See [`database_setup.sql`](database_setup.sql) for complete schema.

## 🔐 Authentication & Security

- **Password Hashing**: Argon2 (industry standard)
- **JWT Tokens**: Secure stateless authentication
- **Role-Based Access Control**: Enforced at API level
- **CORS Protection**: Configurable allowed origins
- **Input Validation**: Pydantic models with type checking
- **SQL Injection Protection**: Parameterized queries via asyncpg

## 🎨 Frontend Components

### UI Components (`components/ui/`)
Reusable, accessible UI primitives:
- `Card` - Content containers with consistent styling
- `Button` - Multiple variants (primary, outline, ghost, danger)
- `Badge` - Status indicators with color variants
- `Input` - Form inputs with validation states

### Feature Components (`components/features/`)
Role-specific business logic components:
- Dashboard views for each role
- Assessment detail and review interfaces
- Mark upload and validation forms
- Moderation form builders

### Design System
- **Tailwind CSS 4** with custom configuration
- Consistent color palette for status indicators
- Responsive design (mobile-first)
- Accessible components (ARIA attributes)

## 🔄 Workflow States

### Assessment Status Flow

```
DRAFT
  ↓ (marks uploaded)
MARKS_UPLOADED
  ↓ (sample generated)
SAMPLE_GENERATED
  ↓ (lecturer completes pre-moderation checklist & submits)
SUBMITTED_FOR_MODERATION
  ↓ (assigned to moderator)
IN_MODERATION
  ↓ (moderator makes decision)
  ├── APPROVED → Lecturer responds to moderator → Workflow complete
  ├── CHANGES_REQUESTED → Lecturer revises marks → MARKS_UPLOADED → (cycle repeats)
  └── ESCALATED → Third marker reviews
         ↓
         ├── CONFIRM_MODERATOR → CHANGES_REQUESTED (lecturer revises)
         ├── OVERRIDE → APPROVED (lecturer responds)
         └── REFER_BACK → IN_MODERATION (moderator reviews again)
```

### Complete Moderation Workflow

#### Phase 1: Preparation (Lecturer)
1. Create assessment with module run details
2. Upload student marks (CSV or manual entry)
3. Generate sample set based on institutional rules
4. **Complete pre-moderation checklist** (5 required items):
   - Marking rubric was used
   - Marking criteria consistently applied
   - Full range of marks used
   - Marks awarded fairly
   - Feedback comments appropriate
5. Submit for moderation

#### Phase 2: Moderation Review (Moderator)
1. Receive assessment in moderation queue
2. Review sample items and marking patterns
3. Add notes to specific sample items if needed
4. **Complete structured moderation form** (7 questions):
   - Was there a marking rubric?
   - Were marking criteria consistently applied?
   - Was the full range of marks used?
   - Were marks awarded fairly?
   - Were feedback comments appropriate?
   - Are all marks in sample appropriate?
   - Are the marks in this assessment ready for ratification?
5. Make decision:
   - **APPROVE**: Mark quality meets standards → Status becomes APPROVED
   - **REQUEST_CHANGES**: Issues found → Status becomes CHANGES_REQUESTED
   - **ESCALATE**: Significant concerns → Status becomes ESCALATED

#### Phase 3A: Changes Requested (Lecturer)
1. View moderator feedback and sample notes
2. **Revise marks** for affected students
   - System tracks all revisions in marks_revision_history
   - Original marks preserved for audit
3. Regenerate sample set with revised marks
4. Resubmit for moderation (no checklist required for resubmission)
5. Returns to Phase 2 for review

#### Phase 3B: Escalation (Third Marker)
1. Review complete case history
2. View moderator's concerns and sample notes
3. Make binding decision:
   - **CONFIRM_MODERATOR**: Agree with concerns → CHANGES_REQUESTED (go to Phase 3A)
   - **OVERRIDE**: Disagree, approve assessment → APPROVED (go to Phase 4)
   - **REFER_BACK**: Need more info → IN_MODERATION (return to Phase 2)

#### Phase 4: Completion (Lecturer - Module Leader Response)
1. Receive notification of approval
2. Review moderator's feedback and recommendations
3. **Submit module leader response**:
   - Confirm understanding of feedback
   - Provide implementation comments
   - Complete workflow
4. Assessment finalized

### Status Transitions

| Current Status | Action | New Status |
|---------------|--------|-----------|
| DRAFT | Upload marks | MARKS_UPLOADED |
| MARKS_UPLOADED | Generate sample | SAMPLE_GENERATED |
| SAMPLE_GENERATED | Submit (with checklist) | SUBMITTED_FOR_MODERATION |
| SUBMITTED_FOR_MODERATION | Assign to moderator | IN_MODERATION |
| IN_MODERATION | Moderator approves | APPROVED |
| IN_MODERATION | Moderator requests changes | CHANGES_REQUESTED |
| IN_MODERATION | Moderator escalates | ESCALATED |
| CHANGES_REQUESTED | Revise marks | MARKS_UPLOADED |
| ESCALATED | Third marker confirms moderator | CHANGES_REQUESTED |
| ESCALATED | Third marker overrides | APPROVED |
| ESCALATED | Third marker refers back | IN_MODERATION |
| APPROVED | Module leader responds | (Workflow complete) |

### Moderation Case Lifecycle

1. **Draft**: Lecturer prepares assessment
2. **Submitted**: Ready for moderation (checklist completed)
3. **In Review**: Moderator examining samples
4. **Decision Made**: Approved/Changes/Escalated
5. **Revised** (if changes requested): Lecturer updates marks, resubmits
6. **Third Marker Review** (if escalated): Final binding decision
7. **Module Leader Response**: Lecturer confirms implementation
8. **Closed**: Process complete, audit trail preserved

## 📊 Sample Generation Rules

The system automatically generates moderation samples based on:

- **Cohort Size**: Determines required sample size
- **Grade Distribution**: Ensures representative sampling
- **Risk Factors**:
  - Marks within 2% below pass threshold (38-39%)
  - Boundary cases (38-42%, 58-62%, 68-72%)
  - Highest and lowest marks
  - Random sample across grade bands

## 🧪 Development

### Frontend Development

```bash
cd frontend
npm run dev          # Start development server on http://localhost:3000
npm run build        # Build for production
npm run start        # Run production build
npm run lint         # Check code quality with ESLint
```

### Backend Development

```bash
cd backend
uvicorn app.main:app --reload        # Development server with hot reload on http://localhost:8000
uvicorn app.main:app --reload --log-level debug  # Verbose logging for debugging
```

### Testing

The project includes comprehensive test suites in `backend/tests/`:

```bash
cd backend

# Run all tests
pytest

# Run specific test file
pytest tests/test_e2e_auth.py

# Run with verbose output
pytest -v

# Run specific test function
pytest tests/test_api.py -k "test_specific_function"
```

**Test Files:**
- `test_api.py` - API endpoint integration tests (requires running backend + database)
- `test_e2e_auth.py` - End-to-end authentication workflows

### Testing the Complete Workflow

1. **Register Test Users** (use `register_users.py` script in the root folder):
```python
# Creates 4 test users:
# - L0DMAFIA@gmail.com (lecturer, password: Testing_123!)
# - D0DMAFIA@gmail.com (moderator, password: Testing_123!)
# - B0DMAFIA@gmail.com (third_marker, password: Testing_123!)
# - M0DMAFIA@gmail.com (admin, password: Testing_123!)
python register_users.py
```

2. **Lecturer Workflow Test**:
   - Login as lecturer
   - Create assessment or select existing
   - Upload marks (CSV or manual)
   - Generate sample (automatic based on cohort size)
   - Complete pre-moderation checklist (5 items)
   - Submit for moderation
   - Check dashboard shows "Submitted for Moderation" status

3. **Moderator Workflow Test**:
   - Login as moderator
   - View moderation queue
   - Open assessment for review
   - Add notes to specific sample items (optional)
   - Complete moderation form (7 questions)
   - Test each decision type:
     - **APPROVE**: Assessment moves to APPROVED, lecturer sees "Respond to Moderator" button
     - **REQUEST_CHANGES**: Assessment moves to CHANGES_REQUESTED, lecturer sees "Revise Marks" button
     - **ESCALATE**: Assessment moves to ESCALATED, appears in third marker queue

4. **Mark Revision Test** (when moderator requests changes):
   - Login as lecturer
   - Dashboard shows amber "Revise Marks" button
   - Click assessment to view feedback
   - Upload revised marks (marks_revision_history tracks changes)
   - Regenerate sample
   - Resubmit (no checklist required on resubmission)
   - Moderation case is updated (not duplicated)

5. **Third Marker Workflow Test** (when moderator escalates):
   - Login as third marker
   - View escalated cases queue
   - Review moderator feedback and concerns
   - Test each decision:
     - **CONFIRM_MODERATOR**: Status → CHANGES_REQUESTED (lecturer revises)
     - **OVERRIDE**: Status → APPROVED (lecturer responds)
     - **REFER_BACK**: Status → IN_MODERATION (moderator reviews again)

6. **Module Leader Response Test** (after approval):
   - Login as lecturer
   - Dashboard shows blue "Respond to Moderator" button (only when APPROVED)
   - Click to view moderator feedback
   - Submit response confirming implementation
   - Workflow complete

### Database Query Performance

**Fixed Duplicate Row Issues**:
- All queue queries use LATERAL joins to fetch only latest sample per assessment
- Prevents duplicate assessment rows in lecturer, moderator, and third marker queues
- Example pattern:
```sql
LATERAL (
  SELECT ss.id, ss.created_at
  FROM sample_sets ss
  WHERE ss.assessment_id = a.id
  ORDER BY ss.created_at DESC
  LIMIT 1
) latest_sample
```

### Code Quality

**Frontend:**
- ESLint for code linting
- TypeScript strict mode enabled
- Consistent component structure (UI vs Features)
- Proper error handling (displays object errors as JSON strings)

**Backend:**
- Type hints throughout
- Pydantic validation on all inputs
- Async/await patterns for database operations
- Parameterized queries prevent SQL injection
- Comprehensive error handling in main.py

## 🚢 Deployment

### Frontend (Vercel/Netlify)

```bash
cd frontend
npm run build
npm run start
```

### Backend (Docker/Cloud)

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Environment Variables

Ensure all required environment variables are set:
- `DATABASE_URL`
- `SECRET_KEY`
- `CORS_ORIGINS`
- `API_V1_STR` (optional, default: `/api/v1`)

## 📝 API Documentation

Once the backend is running, visit:
- **Interactive Docs**: `http://localhost:8000/docs` (Swagger UI)
- **Alternative Docs**: `http://localhost:8000/redoc` (ReDoc)

### Authentication Endpoints

**`POST /api/v1/auth/register`** - Register new user
- Body: `{email, password, name, role}`
- Returns: User object with JWT token

**`POST /api/v1/auth/login`** - User login
- Body: `{email, password}`
- Returns: JWT token and user details

**`POST /api/v1/auth/logout`** - User logout
- Requires: Authorization header
- Returns: Success confirmation

**`GET /api/v1/auth/me`** - Get current user info
- Requires: Authorization header
- Returns: Current user details

### Lecturer Endpoints

**`GET /api/v1/lecturer/assessments`** - List all assessments for lecturer
- Returns: Array of assessments with latest sample only (uses LATERAL join)

**`GET /api/v1/lecturer/assessments/{id}`** - Get assessment details
- Returns: Full assessment with marks, samples, moderation status

**`POST /api/v1/lecturer/assessments/{id}/marks`** - Upload/revise marks
- Body: `{marks: [{student_id, mark, feedback}]}`
- Detects revision: If status = CHANGES_REQUESTED, tracks in marks_revision_history
- Preserves CHANGES_REQUESTED status when revising
- Returns: Success with marks count

**`POST /api/v1/lecturer/assessments/{id}/generate-sample`** - Generate sample set
- Automatically calculates sample size based on cohort
- Includes risk factors (boundaries, near-pass marks, grade distribution)
- Can regenerate after mark revisions
- Returns: Sample items with metadata

**`POST /api/v1/lecturer/assessments/{id}/submit`** - Submit for moderation
- First submission: Requires pre-moderation checklist
- Resubmission: No checklist required, updates existing moderation case
- Body: `{checklist_responses: {...}}` (only on first submission)
- Returns: Moderation case ID

**`GET /api/v1/lecturer/assessments/{id}/moderation-case`** - View own moderation case
- Returns: Moderation case with moderator feedback (lecturer can view their own case)

**`POST /api/v1/lecturer/assessments/{id}/respond`** - Submit module leader response
- Only available when status = APPROVED
- Body: `{response_comments: string}`
- Returns: Response confirmation

### Moderator Endpoints

**`GET /api/v1/moderator/queue`** - Get moderation queue
- Returns: Assessments with status IN_MODERATION (latest sample only via LATERAL)

**`GET /api/v1/moderator/assessments/{id}/moderation-case`** - Get full moderation case
- Returns: Assessment, samples, marks, previous notes

**`POST /api/v1/moderator/assessments/{id}/moderation-form`** - Submit moderation review
- Body: 
  ```json
  {
    "form_responses": {
      "has_rubric": "YES/NO/PARTIAL",
      "criteria_applied": "YES/NO/PARTIAL",
      "full_range_used": "YES/NO/PARTIAL",
      "marks_fair": "YES/NO/PARTIAL",
      "feedback_appropriate": "YES/NO/PARTIAL",
      "sample_marks_appropriate": "YES/NO/PARTIAL",
      "ready_for_ratification": "YES/NO/PARTIAL"
    },
    "decision": "APPROVE/REQUEST_CHANGES/ESCALATE",
    "summary_comment": "Overall feedback"
  }
  ```
- Creates/updates moderation_form_responses
- Sets assessment status based on decision
- Returns: Updated moderation case

**`POST /api/v1/moderator/assessments/{id}/sample-notes`** - Add notes to sample items
- Body: `{sample_item_id, notes}`
- Returns: Note confirmation

### Third Marker Endpoints

**`GET /api/v1/third-marker/queue`** - Get escalated cases queue
- Returns: Assessments with status ESCALATED (latest sample only via LATERAL)

**`GET /api/v1/third-marker/assessments/{id}`** - Get escalated case details
- Returns: Full context including moderator feedback

**`POST /api/v1/third-marker/assessments/{id}/decision`** - Make third marker decision
- Body: 
  ```json
  {
    "decision": "CONFIRM_MODERATOR/OVERRIDE/REFER_BACK",
    "comments": "Rationale for decision"
  }
  ```
- Decision effects:
  - **CONFIRM_MODERATOR**: Status → CHANGES_REQUESTED (lecturer revises)
  - **OVERRIDE**: Status → APPROVED (lecturer responds)
  - **REFER_BACK**: Status → IN_MODERATION (moderator reviews again)
- Returns: Updated assessment status

### Admin Endpoints

**`GET /api/v1/admin/users`** - List all users
- Returns: Array of users with roles

**`GET /api/v1/admin/stats`** - Get system statistics
- Returns: 
  - Total assessments
  - By status (uses COALESCE for empty JSON)
  - Recent activity
  - Moderation metrics

**`POST /api/v1/admin/users`** - Create new user
- Body: `{email, password, name, role}`
- Returns: Created user

**`PUT /api/v1/admin/users/{id}`** - Update user
- Body: `{name, role, is_active}`
- Returns: Updated user

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes with clear commit messages
3. Test thoroughly (frontend and backend)
4. Submit a pull request with description

## 📄 License

[Add your license information here]

## 👨‍💻 Authors

[Add author information here]

## 📞 Support

For questions or issues:
- Create an issue in the repository
- Contact the development team
- Review documentation in this README

## 🗺️ Roadmap

### ✅ Completed Features
- ✅ Database schema with audit trail support
- ✅ Frontend UI components built (Card, Button, Badge, Input)
- ✅ Authentication system (JWT, Argon2 password hashing)
- ✅ Role-based access control (Lecturer, Moderator, Third Marker, Admin)
- ✅ Complete assessment workflow (create, upload, sample, submit)
- ✅ **Mark revision workflow with audit history**
- ✅ **Pre-moderation checklist (5 required items)**
- ✅ **Module leader response workflow**
- ✅ Sample generation based on institutional rules
- ✅ Moderation form with structured questions (7 items)
- ✅ Moderator decision system (Approve/Request Changes/Escalate)
- ✅ Third marker review and binding decisions
- ✅ Sample-specific notes from moderators
- ✅ Real-time admin statistics dashboard
- ✅ Resubmission workflow (updates existing case, no duplicates)
- ✅ **Marks revision history tracking** (original_mark, revised_mark, reason, timestamp)
- ✅ Latest sample only in queues (LATERAL joins prevent duplicates)
- ✅ Proper status transitions for all workflow paths
- ✅ Test user registration script
- ✅ **Backend pytest test suite** (database, auth, moderation workflows)

### 🚧 In Progress
- 🚧 Frontend testing suite (Jest/React Testing Library)
- 🚧 CSV mark upload validation and error handling enhancement
- 🚧 Email notifications for workflow transitions
- 🚧 Bulk operations for administrators
- 🚧 Enhanced error messaging and user feedback

### 📋 Planned Features
- 📋 Advanced analytics and reporting
- 📋 Export moderation reports as PDF
- 📋 Configurable sample generation rules
- 📋 Multi-semester comparison views
- 📋 Mobile-responsive improvements
- 📋 Integration with institutional SIS systems
- 📋 Automated anonymization toggle based on workflow stage

### 🐛 Known Issues & Fixes Applied

**Fixed Issues:**
- ✅ React rendering object errors → Convert to JSON strings
- ✅ Duplicate moderation cases on resubmission → UPDATE instead of INSERT
- ✅ Duplicate assessment rows in queues → LATERAL joins for latest sample
- ✅ Admin stats returning NULL → COALESCE for empty JSON
- ✅ Third marker CONFIRM_MODERATOR incorrect status → Now sets CHANGES_REQUESTED
- ✅ Moderator form structure validation → Nested form_responses with decision
- ✅ Lecturer cannot view own moderation case → Added lecturer-accessible endpoint
- ✅ Missing mark revision capability → Complete revision workflow implemented
- ✅ Respond button showing when CHANGES_REQUESTED → Only shows when APPROVED

### 🔐 Security Enhancements
- All passwords hashed with Argon2
- JWT tokens with expiration
- CORS protection configured
- Input validation via Pydantic
- SQL injection prevention (parameterized queries)
- Role-based endpoint protection
- Audit log for all critical actions

### 📊 Performance Optimizations
- Database connection pooling (asyncpg)
- Async/await throughout backend
- LATERAL joins prevent N+1 queries
- Indexed foreign keys for fast lookups
- Efficient sample generation algorithm

---

**Current Status**: All core workflows fully functional. Backend API complete with comprehensive pytest test suite. Frontend connected with real API integration. Mark revision, moderation, and third marker workflows tested end-to-end. Backend tests cover database connectivity, authentication, and complete moderation workflows.

**Testing**: 
- Backend: Run `pytest` in `backend/` directory for automated tests
- Manual Testing: Use `register_users.py` to create test accounts
- E2E Testing: Test complete workflow from mark upload → moderation → revision → third marker → module leader response

**Deployment**: Ready for staging environment. Ensure all environment variables configured (DATABASE_URL, SECRET_KEY, CORS_ORIGINS).


