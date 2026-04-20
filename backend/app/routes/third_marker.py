# Import Any type for flexible dictionary typing in current_user
from typing import Any

# Import asyncpg for database connection pool type hints
import asyncpg
# Import FastAPI components for routing, dependency injection, error handling
from fastapi import APIRouter, Depends, HTTPException, status

# Import the database connection pool getter (FastAPI dependency)
from app.lib.database import get_database
# Import role-based access control dependency (restricts to third_marker role)
from app.lib.security import require_role
# Import Pydantic models for request/response validation
from app.models import (
    AssessmentOut,                  # Response model for assessment details
    ModerationCaseOut,              # Response model for moderation case with participant names
    ThirdMarkerDecisionRequest,     # Request body for third marker decision (confirm/remark_all)
    ThirdMarkerDashboardStats,      # Response model for third marker dashboard statistics
    SampleItemOut,                  # Response model for individual sample items
)
# Import database query functions for third marker operations
from app.queries.assessments import (
    get_assessment_by_id,                  # Fetch single assessment by UUID
    get_third_marker_queue,                # Fetch all escalated assessments
    get_sample_items,                      # Fetch sample items for an assessment
    get_moderation_case_by_assessment,     # Fetch moderation case with joined names
    make_third_marker_decision,            # Record third marker's final decision
    get_third_marker_dashboard_stats,      # Fetch dashboard statistics
    log_audit_event,                       # Record action in audit trail
)

# Create a FastAPI router for all third marker endpoints
# prefix="/third-marker" means all routes are under /api/v1/third-marker/...
# tags=["Third Marker"] groups these in the Swagger docs
router = APIRouter(prefix="/third-marker", tags=["Third Marker"])


# ===============================
# GET /third-marker/queue - Escalated Assessments Queue
# ===============================
@router.get("/queue", response_model=list[AssessmentOut])
async def get_escalated_assessments(
    # require_role("third_marker") ensures only users with role="third_marker" can access
    current_user: dict[str, Any] = Depends(require_role("third_marker")),
    db: asyncpg.Pool = Depends(get_database),  # Inject database pool
):
    """Get all escalated assessments for third marker review.
    Per Section 12.25: third marking occurs when moderator cannot confirm marks."""
    assessments = await get_third_marker_queue(db)
    return assessments  # Returns assessments with status ESCALATED


# ===============================
# GET /third-marker/dashboard - Dashboard Statistics
# ===============================
@router.get("/dashboard", response_model=ThirdMarkerDashboardStats)
async def get_dashboard_stats(
    current_user: dict[str, Any] = Depends(require_role("third_marker")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get third marker dashboard statistics.
    Returns count of escalated assessments awaiting review."""
    stats = await get_third_marker_dashboard_stats(db)
    return stats


# ===============================
# GET /third-marker/assessments/{id} - Get Assessment Details
# ===============================
@router.get("/assessments/{assessment_id}", response_model=AssessmentOut)
async def get_third_marker_assessment(
    assessment_id: str,  # String param - manually parsed to UUID for validation
    current_user: dict[str, Any] = Depends(require_role("third_marker")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get assessment details for third marker review.
    The third marker reviews the entire sample independently."""
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
# GET /third-marker/assessments/{id}/sample - Get Sample Items
# ===============================
@router.get("/assessments/{assessment_id}/sample", response_model=list[SampleItemOut])
async def get_assessment_sample(
    assessment_id: str,
    current_user: dict[str, Any] = Depends(require_role("third_marker")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get sample items for an assessment. The third marker reviews
    the same sample that was generated for the moderator."""
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
# GET /third-marker/assessments/{id}/moderation-case - Get Moderation Case
# ===============================
@router.get("/assessments/{assessment_id}/moderation-case", response_model=ModerationCaseOut)
async def get_moderation_case(
    assessment_id: str,
    current_user: dict[str, Any] = Depends(require_role("third_marker")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get moderation case details for an assessment.
    The third marker can see the full moderation history including
    the original moderator's comments and decision."""
    from uuid import UUID

    # Validate UUID format
    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    # Fetch the moderation case with all joined participant names
    moderation_case = await get_moderation_case_by_assessment(db, assessment_uuid)
    if not moderation_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Moderation case not found",
        )

    return moderation_case


# ===============================
# POST /third-marker/assessments/{id}/decision - Submit Third Marker Decision
# ===============================
@router.post("/assessments/{assessment_id}/decision")
async def submit_third_marker_decision(
    assessment_id: str,
    data: ThirdMarkerDecisionRequest,  # Contains decision (CONFIRMED/REMARK_ALL) + comment
    current_user: dict[str, Any] = Depends(require_role("third_marker")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Submit the third marker's final decision for an escalated assessment.
    Per Section 12.27-12.28: if third marker cannot confirm marks, ALL instances
    by the original marker must be re-marked (REMARK_ALL)."""
    from uuid import UUID

    # Validate UUID format
    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    # Fetch the moderation case to verify it exists and is escalated
    moderation_case = await get_moderation_case_by_assessment(db, assessment_uuid)
    if not moderation_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Moderation case not found",
        )

    # Only allow decisions on escalated cases (must be referred by moderator)
    if moderation_case["status"] != "ESCALATED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment is not escalated",
        )

    # Record the third marker's decision (updates case + assessment status)
    result = await make_third_marker_decision(
        db,
        moderation_case_id=moderation_case["id"],
        decision=data.decision,                 # CONFIRMED or REMARK_ALL
        comment=data.comment,                   # Third marker's feedback
        third_marker_id=current_user["id"],     # Who made the decision
    )

    # Log the decision in the audit trail for compliance
    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action=f"Third marker decision: {data.decision}",
        assessment_id=assessment_uuid,
    )

    return {"message": "Third marker decision recorded", "case": result}
