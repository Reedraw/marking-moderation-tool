# Import Any type for flexible dictionary typing in current_user
from typing import Any

# Import asyncpg for database connection pool type hints
import asyncpg
# Import FastAPI components for routing, dependency injection, error handling
from fastapi import APIRouter, Depends, HTTPException, status

# Import the database connection pool getter (FastAPI dependency)
from app.lib.database import get_database
# Import role-based access control dependency (restricts to moderator role)
from app.lib.security import require_role
# Import Pydantic models for request/response validation
from app.models import (
    AssessmentOut,              # Response model for assessment details
    ModerationCaseOut,          # Response model for moderation case with participant names
    ModerationDecisionRequest,  # Request body for moderator decision (approve/reject/escalate)
    ModerationFormOut,          # Response model for moderation form responses
    ModerationFormSubmit,       # Request body for submitting the 6-question moderation form
    ModeratorDashboardStats,    # Response model for moderator dashboard statistics
    SampleItemOut,              # Response model for individual sample items
)
# Import database query functions for moderation operations
from app.queries.assessments import (
    get_assessment_by_id,                  # Fetch single assessment by UUID
    get_moderator_queue,                   # Fetch all assessments pending moderation
    get_sample_items,                      # Fetch sample items for an assessment
    get_moderation_case_by_assessment,     # Fetch moderation case with joined names
    make_moderation_decision,              # Record moderator's decision
    get_moderator_dashboard_stats,         # Fetch dashboard statistics
    log_audit_event,                       # Record action in audit trail
    save_moderation_form_response,         # Save the 6-question moderation form
    get_latest_moderation_form_response,   # Fetch most recent form response
)

# Create a FastAPI router for all moderator endpoints
# prefix="/moderator" means all routes are under /api/v1/moderator/...
# tags=["Moderator"] groups these in the Swagger docs
router = APIRouter(prefix="/moderator", tags=["Moderator"])


# ===============================
# GET /moderator/queue - Moderation Queue
# ===============================
@router.get("/queue", response_model=list[AssessmentOut])
async def get_moderation_queue(
    # require_role("moderator") ensures only users with role="moderator" can access
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),  # Inject database pool
):
    """Get all assessments in the moderation queue.
    Returns assessments with status SUBMITTED_FOR_MODERATION or IN_MODERATION."""
    assessments = await get_moderator_queue(db)
    return assessments  # FastAPI serializes using list[AssessmentOut]


# ===============================
# GET /moderator/dashboard - Dashboard Statistics
# ===============================
@router.get("/dashboard", response_model=ModeratorDashboardStats)
async def get_dashboard_stats(
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get moderator dashboard statistics.
    Returns counts of pending, in-moderation, and escalated assessments."""
    stats = await get_moderator_dashboard_stats(db)
    return stats


# ===============================
# GET /moderator/assessments/{id} - Get Assessment Details
# ===============================
@router.get("/assessments/{assessment_id}", response_model=AssessmentOut)
async def get_moderation_assessment(
    assessment_id: str,  # String param - manually parsed to UUID for validation
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get assessment details for moderation review."""
    from uuid import UUID  # Import UUID for manual validation

    # Validate the assessment_id is a valid UUID format
    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    # Fetch the assessment from the database
    assessment = await get_assessment_by_id(db, assessment_uuid)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    return assessment


# ===============================
# GET /moderator/assessments/{id}/sample - Get Sample Items
# ===============================
@router.get("/assessments/{assessment_id}/sample", response_model=list[SampleItemOut])
async def get_assessment_sample(
    assessment_id: str,
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get sample items for an assessment. These are the student marks
    selected for moderation review based on academic regulations."""
    from uuid import UUID

    # Validate UUID format
    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    # Fetch sample items sorted by mark descending
    sample_items = await get_sample_items(db, assessment_uuid)
    return sample_items


# ===============================
# GET /moderator/assessments/{id}/moderation-case - Get Moderation Case
# ===============================
@router.get("/assessments/{assessment_id}/moderation-case", response_model=ModerationCaseOut)
async def get_moderation_case(
    assessment_id: str,
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get moderation case details for an assessment.
    Includes joined participant names (lecturer, moderator, third marker)."""
    from uuid import UUID

    # Validate UUID format
    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    # Fetch the moderation case with all joined data
    moderation_case = await get_moderation_case_by_assessment(db, assessment_uuid)
    if not moderation_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Moderation case not found",
        )

    return moderation_case


# ===============================
# POST /moderator/assessments/{id}/decision - Submit Moderation Decision
# ===============================
@router.post("/assessments/{assessment_id}/decision")
async def submit_moderation_decision(
    assessment_id: str,
    data: ModerationDecisionRequest,  # Contains decision (APPROVED/CHANGES_REQUESTED/ESCALATED) + comment
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Submit a moderation decision for an assessment.
    Valid decisions: APPROVED (marks confirmed), CHANGES_REQUESTED (send back to lecturer),
    ESCALATED (refer to third marker per Section 12.25)."""
    from uuid import UUID

    # Validate UUID format
    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    # Fetch the moderation case to verify it exists and check status
    moderation_case = await get_moderation_case_by_assessment(db, assessment_uuid)
    if not moderation_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Moderation case not found",
        )

    # Only allow decisions on cases that are actively being moderated
    if moderation_case["status"] not in ("IN_MODERATION", "SUBMITTED_FOR_MODERATION"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment is not in a state that allows moderation decisions",
        )

    # Record the decision in the database (updates moderation case + assessment status)
    result = await make_moderation_decision(
        db,
        moderation_case_id=moderation_case["id"],
        decision=data.decision,             # APPROVED, CHANGES_REQUESTED, or ESCALATED
        comment=data.comment,               # Moderator's feedback comment
        moderator_id=current_user["id"],    # Who made the decision
    )

    # Log the decision in the audit trail for compliance
    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action=f"Moderation decision: {data.decision}",
        assessment_id=assessment_uuid,
    )

    return {"message": "Moderation decision recorded", "case": result}


# ===============================
# POST /moderator/assessments/{id}/form - Submit Moderation Form
# ===============================
@router.post("/assessments/{assessment_id}/form", response_model=ModerationFormOut)
async def submit_moderation_form(
    assessment_id: str,
    data: ModerationFormSubmit,   # Contains the 6 form questions + decision + summary
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Submit the moderation form response for an assessment.
    
    The form captures the 6 key questions from academic regulations:
    1. Was there a marking rubric?
    2. Were marking criteria consistently applied?
    3. Was the full range of marks used?
    4. Were marks awarded fairly?
    5. Were feedback comments appropriate?
    6. Are all marks in sample appropriate?
    
    Also records the moderator's overall decision and summary comment."""
    from uuid import UUID

    # Validate UUID format
    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    # Verify the assessment exists and is in the correct state
    assessment = await get_assessment_by_id(db, assessment_uuid)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    # Only allow form submission when assessment is actively being moderated
    if assessment["status"] not in ("IN_MODERATION", "SUBMITTED_FOR_MODERATION"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment is not in a state that allows moderation form submission",
        )

    # Save the 6 moderation form question responses to the database
    result = await save_moderation_form_response(
        db,
        assessment_id=assessment_uuid,
        moderator_id=current_user["id"],
        form_data=data.form_responses,      # The 6 questions with answers and comments
    )

    # Also fetch and record the decision alongside the form
    moderation_case = await get_moderation_case_by_assessment(db, assessment_uuid)
    if not moderation_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Moderation case not found",
        )

    # Make the moderation decision (updates case status and assessment status)
    await make_moderation_decision(
        db,
        moderation_case_id=moderation_case["id"],
        decision=data.decision,                 # Overall decision from the form
        comment=data.summary_comment,           # Summary comment from the moderator
        moderator_id=current_user["id"],
    )

    # Log the form submission and decision in the audit trail
    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action=f"Submitted moderation form with decision: {data.decision}",
        assessment_id=assessment_uuid,
    )

    return result  # Return the saved form response


# ===============================
# GET /moderator/assessments/{id}/form - Get Moderation Form Response
# ===============================
@router.get("/assessments/{assessment_id}/form", response_model=ModerationFormOut | None)
async def get_moderation_form(
    assessment_id: str,
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get the latest moderation form response for an assessment.
    Returns None if no form has been submitted yet."""
    from uuid import UUID

    # Validate UUID format
    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    # Fetch the most recent form response
    form_response = await get_latest_moderation_form_response(db, assessment_uuid)
    return form_response  # Returns form data or None
