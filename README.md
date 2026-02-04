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
│   │   │   └── auth.py            # Authentication routes
│   │   ├── models/                # Pydantic models
│   │   │   ├── auth.py
│   │   │   └── user.py
│   │   ├── queries/               # Database queries
│   │   │   └── users.py
│   │   └── lib/                   # Core utilities
│   │       ├── config.py          # Settings management
│   │       ├── database.py        # Database connection pool
│   │       ├── security.py        # JWT & auth helpers
│   │       ├── password.py        # Password hashing
│   │       └── middleware.py      # CORS, logging, etc.
│   │
│   └── requirements.txt           # Python dependencies
│
├── database_setup.sql             # PostgreSQL schema definition
├── .env.example                   # Environment variables template
└── README.md                      # This file
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
- Generate moderation samples based on institutional rules
- Submit assessments for moderation
- View moderation feedback and implement requested changes

### 👨‍💼 Moderator
- Review submitted assessments and sample sets
- Examine marking patterns and consistency
- Provide feedback on marking quality
- Approve assessments or request changes
- Escalate problematic cases to third marker

### ⚖️ Third Marker
- Review escalated moderation cases
- Make final decisions on disputed marks
- Provide binding recommendations
- Close moderation cases

### 🔧 Administrator
- Manage user accounts and roles
- Configure modules and module runs
- View system-wide audit logs
- Monitor moderation workflow status
- Generate compliance reports

## 🗄️ Database Schema

### Core Tables

**Users & Authentication:**
- `users` - User accounts with roles
- `audit_log` - Complete action history

**Academic Structure:**
- `modules` - Course modules
- `module_runs` - Academic year/semester instances
- `students` - Student records
- `enrolments` - Student module registrations
- `module_run_staff` - Staff assignments

**Assessment & Marking:**
- `assessments` - Assessment definitions
- `marks` - Student marks with feedback
- `sample_sets` - Generated moderation samples
- `sample_items` - Individual sample entries

**Moderation Workflow:**
- `moderation_cases` - Moderation workflow state
- `moderation_form_responses` - Moderator feedback
- `moderation_item_notes` - Sample-specific comments

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
  ↓ (submitted by lecturer)
SUBMITTED_FOR_MODERATION
  ↓ (assigned to moderator)
IN_MODERATION
  ↓
  ├── APPROVED (closed)
  ├── CHANGES_REQUESTED (back to lecturer)
  └── ESCALATED (to third marker)
```

### Moderation Case Lifecycle

1. **Draft**: Lecturer prepares assessment
2. **Submitted**: Ready for moderation
3. **In Review**: Moderator examining samples
4. **Decision Made**: Approved/Changes/Escalated
5. **Closed**: Process complete

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
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Run production build
npm run lint         # Check code quality
```

### Backend Development

```bash
cd backend
uvicorn app.main:app --reload        # Development server with hot reload
uvicorn app.main:app --reload --log-level debug  # Verbose logging
```

### Code Quality

**Frontend:**
- ESLint for code linting
- TypeScript for type checking
- Consistent component structure

**Backend:**
- Type hints throughout
- Pydantic validation
- Async/await patterns

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

### Current Endpoints

**Authentication:**
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login (returns JWT)
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/me` - Get current user info

*(Additional endpoints for assessments, moderation, etc. are in development)*

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
- Review documentation in `/frontend/STRUCTURE.md`

## 🗺️ Roadmap

### Current Status
- ✅ Database schema defined
- ✅ Frontend UI components built
- ✅ Authentication system implemented
- 🚧 Backend API endpoints (in progress)

---

**Note**: This project is actively under development. Frontend interfaces are complete with mock data. Backend API integration is in progress. Check `TODO` comments in code for pending integrations.