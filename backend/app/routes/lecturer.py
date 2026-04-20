# Import Any type for flexible dictionary typing in current_user
from typing import Any
# Import UUID for type-safe assessment ID path parameters
from uuid import UUID

# Import asyncpg for database connection pool type hints
import asyncpg
# Import FastAPI components for routing, dependency injection, error handling
from fastapi import APIRouter, Depends, HTTPException, status

# Import the database connection pool getter (FastAPI dependency)
from app.lib.database import get_database
# Import role-based access control dependency (restricts to lecturer role)
from app.lib.security import require_role
# Import Pydantic models for request/response validation and serialization
from app.models import (
    AssessmentOut,                   # Response model for assessment details
    AssessmentCreate,                # Request body for creating a new assessment
    MarksUploadRequest,              # Request body for uploading student marks
    MarksUploadResponse,             # Response body for marks upload result
    SampleGenerateRequest,           # Request body for generating moderation sample
    SampleGenerateResponse,          # Response body for sample generation result
    ModerationSubmitRequest,         # Request body for submitting for moderation
    LecturerDashboardStats,          # Response model for lecturer dashboard statistics
    SampleItemOut,                   # Response model for individual sample items
    PreModerationChecklistSubmit,    # Request body for pre-moderation checklist
    PreModerationChecklistOut,       # Response model for checklist data
    ModuleLeaderResponseSubmit,      # Request body for module leader response
    ModuleLeaderResponseOut,         # Response model for module leader response
)
# Import database query functions for assessment operations
from app.queries.assessments import (
    create_assessment,                       # Insert new assessment record
    get_assessment_by_id,                    # Fetch single assessment by UUID
    get_lecturer_assessments,                # Fetch all assessments for a lecturer
    upload_marks,                            # Insert/update student marks
    generate_sample,                         # Generate moderation sample using academic regulations
    submit_for_moderation,                   # Submit assessment for moderation review
    get_sample_items,                        # Fetch sample items for an assessment
    get_lecturer_dashboard_stats,            # Fetch dashboard statistics for lecturer
    log_audit_event,                         # Record action in audit trail
    create_module_run,                       # Create a module run (module + academic year)
    get_or_create_module,                    # Get existing module or create new one
    save_pre_moderation_checklist,           # Save pre-moderation checklist
    get_pre_moderation_checklist,            # Fetch pre-moderation checklist
    save_module_leader_response,             # Save module leader response to moderation
    get_module_leader_response_by_assessment, # Fetch module leader response
    get_moderation_case_by_assessment,       # Fetch moderation case for an assessment
)

# Create a FastAPI router for all lecturer endpoints
# prefix="/lecturer" means all routes are under /api/v1/lecturer/...
# tags=["Lecturer"] groups these in the Swagger docs
router = APIRouter(prefix="/lecturer", tags=["Lecturer"])


# ===============================
# GET /lecturer/assessments - List All Assessments
# ===============================
@router.get("/assessments", response_model=list[AssessmentOut])
async def get_my_assessments(
    # require_role("lecturer") ensures only lecturers can access this endpoint
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),  # Inject database pool
):
    """Get all assessments created by the current lecturer.
    Filtered by created_by = current user's ID."""
    assessments = await get_lecturer_assessments(db, lecturer_id=current_user["id"])
    return assessments  # FastAPI serializes using list[AssessmentOut]


# ===============================
# GET /lecturer/assessments/{id} - Get Single Assessment
# ===============================
@router.get("/assessments/{assessment_id}", response_model=AssessmentOut)
async def get_assessment(
    assessment_id: UUID,  # Path parameter automatically validated as UUID
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get details of a specific assessment by its UUID."""
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        # Return 404 if assessment doesn't exist
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )
    return assessment


# ===============================
# POST /lecturer/assessments - Create New Assessment
# ===============================
@router.post("/assessments", response_model=AssessmentOut, status_code=status.HTTP_201_CREATED)
async def create_new_assessment(
    data: AssessmentCreate,  # Request body validated by Pydantic model
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Create a new assessment. Also creates the module and module run if needed.
    This implements the create-or-update pattern using UPSERT queries."""
    try:
        # Step 1: Create or get the module record (e.g. "CS2001 - Intro to Programming")
        # Uses UPSERT - if module code already exists, updates title/credits
        module = await get_or_create_module(
            db,
            code=data.module_code,          # Module code from the form
            title=data.module_name,         # Module title from the form
            credits=data.credit_size,       # Credit value (15, 20, 30, etc.)
            created_by=current_user["id"],  # Who created it
        )

        # Step 2: Create the module run (module + academic year combination)
        # E.g. "CS2001 running in 2024/25"
        module_run = await create_module_run(
            db,
            module_id=module["id"],             # Link to the module
            academic_year=data.cohort,          # Academic year from the form
            created_by=current_user["id"],      # Who created it
        )

        # Step 3: Create the actual assessment record
        assessment = await create_assessment(
            db,
            module_code=data.module_code,
            module_name=data.module_name,
            title=data.title,                    # Assessment title (e.g. "Coursework 1")
            cohort=data.cohort,                  # Academic year
            due_date=data.due_date,              # Submission deadline
            weighting=data.weighting,            # Assessment weighting percentage
            module_run_id=module_run["id"],      # Link to the module run
            credit_size=data.credit_size,        # Credit size for the module
            created_by=current_user["id"],       # The lecturer creating it
        )

        # Step 4: Log the creation in the audit trail for compliance
        await log_audit_event(
            db,
            actor_id=current_user["id"],
            actor_name=current_user["full_name"] or current_user["username"],
            actor_role=current_user["role"],
            action="Created assessment",
            assessment_id=assessment["id"],       # Link audit event to the assessment
        )

        return assessment  # Return the created assessment
    except Exception as e:
        # Catch any unexpected errors and return a 400 with the error message
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create assessment: {str(e)}",
        )


# ===============================
# POST /lecturer/assessments/{id}/marks/upload - Upload Student Marks
# ===============================
@router.post("/assessments/{assessment_id}/marks/upload", response_model=MarksUploadResponse)
async def upload_assessment_marks(
    assessment_id: UUID,          # Path param: which assessment
    data: MarksUploadRequest,     # Request body: list of student marks
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Upload marks for an assessment. CSV parsing is done on the frontend;
    this endpoint receives structured mark data. Supports both initial upload
    and revision upload (when status is CHANGES_REQUESTED)."""
    # Verify the assessment exists
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    # Authorization check: only the assessment creator can upload marks
    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this assessment",
        )

    # Check if this is a mark revision (after moderator requested changes)
    is_revision = assessment["status"] == "CHANGES_REQUESTED"
    
    # Upload the marks to the database (handles both insert and revision tracking)
    result = await upload_marks(
        db,
        assessment_id=assessment_id,
        marks=[m.model_dump() for m in data.marks],  # Convert Pydantic models to dicts
        uploaded_by=current_user["id"],
        is_revision=is_revision,                      # Enables revision tracking if true
    )

    if result["processed"] > 0:
        # Update assessment status based on whether this is initial upload or revision
        if not is_revision:
            # Initial upload: transition from DRAFT to MARKS_UPLOADED
            await db.execute(
                """
                UPDATE assessments SET status = 'MARKS_UPLOADED', updated_at = NOW()
                WHERE id = $1
                """,
                assessment_id,
            )

        # Build descriptive audit message based on upload type
        action_text = f"Revised marks ({result['processed']} records)" if is_revision else f"Uploaded marks ({result['processed']} records)"
        # Add revision tracking info if marks changed
        if is_revision and result.get("revisions_tracked", 0) > 0:
            action_text += f" - {result['revisions_tracked']} changed"
            
        # Log the upload action in the audit trail
        await log_audit_event(
            db,
            actor_id=current_user["id"],
            actor_name=current_user["full_name"] or current_user["username"],
            actor_role=current_user["role"],
            action=action_text,
            assessment_id=assessment_id,
        )

    return result  # Return upload statistics (processed count, errors, etc.)


# ===============================
# POST /lecturer/assessments/{id}/generate-sample - Generate Moderation Sample
# ===============================
@router.post("/assessments/{assessment_id}/generate-sample", response_model=SampleGenerateResponse)
async def generate_moderation_sample(
    assessment_id: UUID,
    data: SampleGenerateRequest,  # Contains method (e.g. "regulation") and percent
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Generate a moderation sample based on academic regulations (Section 12.18-12.20).
    Selects students for moderation review including boundary cases, pass mark cases,
    highest/lowest marks, and representative coverage of all markers."""
    # Verify the assessment exists
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    # Authorization check: only the creator can generate samples
    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this assessment",
        )

    # Generate the sample using the specified method and percentage
    result = await generate_sample(
        db,
        assessment_id=assessment_id,
        method=data.method,             # Sample method (e.g. "regulation", "random")
        percent=data.percent,           # Target sample percentage
        generated_by=current_user["id"],
    )

    # Log the sample generation in the audit trail
    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action=f"Generated moderation sample ({data.method}, {data.percent}%)",
        assessment_id=assessment_id,
    )

    return result  # Return sample generation results (size, items, etc.)


# ===============================
# POST /lecturer/assessments/{id}/submit-for-moderation - Submit for Review
# ===============================
@router.post("/assessments/{assessment_id}/submit-for-moderation")
async def submit_assessment_for_moderation(
    assessment_id: UUID,
    data: ModerationSubmitRequest,    # Contains optional comment
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Submit an assessment for moderation review. Creates a moderation case
    and transitions the assessment to SUBMITTED_FOR_MODERATION status.
    Also handles resubmission after changes were requested."""
    # Verify the assessment exists
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    # Authorization check: only the creator can submit for moderation
    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this assessment",
        )

    # Validate that the assessment is in the correct state for submission
    # Must have a generated sample OR be resubmitting after changes
    if assessment["status"] not in ("SAMPLE_GENERATED", "CHANGES_REQUESTED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment must have a generated sample before submission",
        )

    # Check if this is a resubmission (after moderator requested changes)
    is_resubmission = assessment["status"] == "CHANGES_REQUESTED"

    # Submit for moderation (creates/updates moderation case, updates status)
    await submit_for_moderation(
        db,
        assessment_id=assessment_id,
        comment=data.comment,               # Lecturer's comment to the moderator
        submitted_by=current_user["id"],
    )

    # Use appropriate audit message based on whether first submission or resubmission
    action_text = "Resubmitted for moderation after revisions" if is_resubmission else "Submitted for moderation"
    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action=action_text,
        assessment_id=assessment_id,
    )

    return {"message": "Assessment submitted for moderation"}


# ===============================
# GET /lecturer/assessments/{id}/sample - Get Sample Items
# ===============================
@router.get("/assessments/{assessment_id}/sample", response_model=list[SampleItemOut])
async def get_assessment_sample(
    assessment_id: UUID,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get the moderation sample items for an assessment.
    Returns the list of student marks selected for moderation review."""
    sample_items = await get_sample_items(db, assessment_id)
    return sample_items  # List of SampleItemOut objects


# ===============================
# GET /lecturer/dashboard - Dashboard Statistics
# ===============================
@router.get("/dashboard", response_model=LecturerDashboardStats)
async def get_dashboard_stats(
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get lecturer dashboard statistics - assessment counts by status.
    Used by the lecturer dashboard page to show summary cards."""
    stats = await get_lecturer_dashboard_stats(db, lecturer_id=current_user["id"])
    return stats


# ===============================
# Pre-Moderation Checklist Routes
# (Completed by the lecturer before submitting for moderation)
# ===============================

# POST /lecturer/assessments/{id}/checklist - Submit Checklist
@router.post("/assessments/{assessment_id}/checklist", response_model=PreModerationChecklistOut)
async def submit_pre_moderation_checklist(
    assessment_id: UUID,
    data: PreModerationChecklistSubmit,   # Checklist form data from frontend
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Submit the pre-moderation checklist. This must be completed before
    submitting for moderation. Includes questions about marking consistency,
    policy adherence, and mark verification."""
    # Verify the assessment exists
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Authorization: only the assessment creator can submit their checklist
    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this assessment's checklist",
        )

    # Save the checklist data (UPSERT - creates or updates existing)
    checklist = await save_pre_moderation_checklist(
        db,
        assessment_id=assessment_id,
        user_id=current_user["id"],
        marking_in_accordance=data.marking_in_accordance,              # Marking done per rubric
        late_work_policy_adhered=data.late_work_policy_adhered,        # Late penalties applied
        plagiarism_policy_adhered=data.plagiarism_policy_adhered,      # Plagiarism handled
        marks_available_with_percentages=data.marks_available_with_percentages,  # Marks as %
        totalling_checked=data.totalling_checked,                      # Totals verified
        consistency_comments=data.consistency_comments,                 # Optional comments
    )

    # Log checklist submission in audit trail
    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action="Submitted pre-moderation checklist",
        assessment_id=assessment_id,
    )

    return checklist  # Return the saved checklist data


# GET /lecturer/assessments/{id}/checklist - Get Checklist
@router.get("/assessments/{assessment_id}/checklist", response_model=PreModerationChecklistOut)
async def get_assessment_checklist(
    assessment_id: UUID,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get the pre-moderation checklist for an assessment.
    Returns the saved checklist data or 404 if not yet submitted."""
    # Verify the assessment exists
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Authorization: only the creator can view their own checklist
    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this assessment's checklist",
        )

    # Fetch the checklist from the database
    checklist = await get_pre_moderation_checklist(db, assessment_id)
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    return checklist


# ===============================
# Module Leader Response Routes
# (Lecturer's response to moderator feedback after moderation)
# ===============================

# POST /lecturer/assessments/{id}/response - Submit Response
@router.post("/assessments/{assessment_id}/response", response_model=ModuleLeaderResponseOut)
async def submit_module_leader_response(
    assessment_id: UUID,
    data: ModuleLeaderResponseSubmit,     # Response form data from frontend
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Submit the module leader response after receiving moderator feedback.
    This allows the lecturer to respond to issues raised, explain outliers,
    and indicate whether a third marker is needed."""
    # Verify the assessment exists
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Authorization: only the creator can respond
    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to respond to this assessment's moderation",
        )

    # Get the moderation case (needed to link the response)
    moderation_case = await get_moderation_case_by_assessment(db, assessment_id)
    if not moderation_case:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No moderation case found for this assessment",
        )

    # Save the module leader response (UPSERT - creates or updates)
    response = await save_module_leader_response(
        db,
        moderation_case_id=moderation_case["id"],                       # Link to moderation case
        user_id=current_user["id"],                                     # Who responded
        moderator_comments_considered=data.moderator_comments_considered, # Confirmed reading feedback
        response_to_issues=data.response_to_issues,                     # Response to issues raised
        outliers_explanation=data.outliers_explanation,                  # Explain any outlier marks
        needs_third_marker=data.needs_third_marker,                     # Whether to escalate
    )

    # Log the response in the audit trail
    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action="Submitted module leader response",
        assessment_id=assessment_id,
    )

    # If the lecturer indicates a third marker is needed, escalate the case
    if data.needs_third_marker:
        # Update the moderation case status to ESCALATED
        await db.execute(
            """
            UPDATE moderation_cases
            SET status = 'ESCALATED', escalated_at = NOW()
            WHERE id = $1
            """,
            moderation_case["id"],
        )
        # Also update the assessment status to ESCALATED
        await db.execute(
            """
            UPDATE assessments
            SET status = 'ESCALATED'
            WHERE id = $1
            """,
            assessment_id,
        )
        # Log the escalation separately in the audit trail
        await log_audit_event(
            db,
            actor_id=current_user["id"],
            actor_name=current_user["full_name"] or current_user["username"],
            actor_role=current_user["role"],
            action="Escalated to third marker",
            assessment_id=assessment_id,
        )

    return response  # Return the saved response data


# ===============================
# GET /lecturer/assessments/{id}/moderation-case - View Moderation Case
# ===============================
@router.get("/assessments/{assessment_id}/moderation-case")
async def get_my_moderation_case(
    assessment_id: UUID,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get the moderation case for the lecturer's own assessment.
    Allows the lecturer to see moderator feedback and decisions."""
    # Verify the assessment exists
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Authorization: only the creator can view their own moderation case
    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this moderation case",
        )

    # Fetch the moderation case with joined participant names
    moderation_case = await get_moderation_case_by_assessment(db, assessment_id)
    if not moderation_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No moderation case found for this assessment",
        )

    return moderation_case  # Return the moderation case data


# ===============================
# GET /lecturer/assessments/{id}/response - Get Module Leader Response
# ===============================
@router.get("/assessments/{assessment_id}/response", response_model=ModuleLeaderResponseOut)
async def get_assessment_response(
    assessment_id: UUID,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get the module leader response for an assessment.
    Returns the previously submitted response or 404 if not yet submitted."""
    # Verify the assessment exists
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Authorization: only the creator can view their own response
    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this assessment's response",
        )

    # Fetch the response via the assessment's moderation case
    response = await get_module_leader_response_by_assessment(db, assessment_id)
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")

    return response  # Return the module leader response data
