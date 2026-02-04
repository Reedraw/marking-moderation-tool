from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Literal, Union
from uuid import UUID
from pydantic import BaseModel, Field


AssessmentStatus = Literal[
    "DRAFT",
    "MARKS_UPLOADED",
    "SAMPLE_GENERATED",
    "SUBMITTED_FOR_MODERATION",
    "IN_MODERATION",
    "APPROVED",
    "CHANGES_REQUESTED",
    "ESCALATED",
]

ModerationDecision = Literal[
    "APPROVED",
    "CHANGES_REQUESTED",
    "ESCALATED",
]

ThirdMarkerDecision = Literal[
    "CONFIRM_MODERATOR",
    "OVERRIDE_MODERATOR",
    "REFER_BACK",
]

SampleMethod = Literal["RANDOM", "STRATIFIED", "RISK_BASED"]


class AssessmentBase(BaseModel):
    module_code: str = Field(..., min_length=1, max_length=50)
    module_name: str = Field(..., min_length=1, max_length=200)
    title: str = Field(..., min_length=1, max_length=200)
    cohort: str = Field(..., description="e.g. 2025/26")
    due_date: Union[str, date] = Field(..., description="YYYY-MM-DD format")
    weighting: int = Field(..., ge=0, le=100, description="Percentage of module mark")


class AssessmentCreate(AssessmentBase):
    """Request model for creating an assessment.
    
    Note: module_run_id is not required - it's auto-created from module_code and cohort.
    """
    credit_size: int = Field(..., ge=15, description="Credits: 15, 20, 30+")


class AssessmentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    due_date: Optional[str] = Field(None, description="YYYY-MM-DD format")


class AssessmentOut(AssessmentBase):
    id: UUID
    status: AssessmentStatus
    marks_uploaded_count: int = 0
    sample_size: Optional[int] = None
    sample_method: Optional[SampleMethod] = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MarkUpload(BaseModel):
    student_id: str = Field(..., min_length=1)
    mark: float = Field(..., ge=0, le=100)
    marker_id: Optional[str] = None


class MarksUploadRequest(BaseModel):
    marks: list[MarkUpload]


class MarksUploadResponse(BaseModel):
    processed: int
    skipped: int
    errors: list[str]


class SampleGenerateRequest(BaseModel):
    method: SampleMethod = Field(default="RISK_BASED")
    percent: float = Field(default=10.0, ge=1.0, le=30.0)


class SampleGenerateResponse(BaseModel):
    sample_size: int
    method: SampleMethod
    percent: float
    sample_items: list[dict]


class ModerationSubmitRequest(BaseModel):
    comment: Optional[str] = Field(None, max_length=1000)


class ModerationDecisionRequest(BaseModel):
    decision: ModerationDecision
    comment: Optional[str] = Field(None, max_length=1000)


class ThirdMarkerDecisionRequest(BaseModel):
    decision: ThirdMarkerDecision
    comment: Optional[str] = Field(None, max_length=1000)


class SampleItemOut(BaseModel):
    id: UUID
    sample_set_id: UUID
    student_id: str
    mark: float
    marker_id: Optional[str]
    moderator_note: Optional[str]
    reason: Optional[str] = None

    model_config = {"from_attributes": True}


# ========================================
# MODERATION FORM QUESTIONS (per University regulations)
# ========================================

class ModerationFormResponse(BaseModel):
    """
    Internal moderator form responses based on Moderation Form requirements.
    All questions must be answered Yes/No with optional comments.
    """
    # Q1: Was there a marking rubric for the module?
    has_marking_rubric: bool = Field(..., description="Was there a marking rubric for the module?")
    has_marking_rubric_comment: Optional[str] = Field(None, max_length=500)
    
    # Q2: Were the marking criteria consistently applied across all scripts?
    criteria_consistently_applied: bool = Field(..., description="Were the marking criteria consistently applied across all the scripts?")
    criteria_consistently_applied_comment: Optional[str] = Field(None, max_length=500)
    
    # Q3: Was the full range of marks used?
    full_range_of_marks_used: bool = Field(..., description="Was the full range of marks used?")
    full_range_of_marks_used_comment: Optional[str] = Field(None, max_length=500)
    
    # Q4: Were marks awarded fairly?
    marks_awarded_fairly: bool = Field(..., description="Were marks awarded fairly?")
    marks_awarded_fairly_comment: Optional[str] = Field(None, max_length=500)
    
    # Q5: Were feedback comments appropriate and do they justify the marks awarded?
    feedback_comments_appropriate: bool = Field(..., description="Were feedback comments appropriate and do they justify the marks awarded?")
    feedback_comments_appropriate_comment: Optional[str] = Field(None, max_length=500)
    
    # Q6: Are you able to confirm that all marks in the sample are appropriate?
    all_marks_appropriate: bool = Field(..., description="Are you able to confirm that all marks in the sample are appropriate?")
    all_marks_appropriate_comment: Optional[str] = Field(None, max_length=500)
    
    # Additional recommendations (required if all_marks_appropriate is False)
    recommendations: Optional[str] = Field(None, max_length=2000, description="Recommendations or issues for consideration")
    
    # Feedback suggestions (optional, if all_marks_appropriate is True)
    feedback_suggestions: Optional[str] = Field(None, max_length=1000, description="Suggestions relating to feedback provided")


class ModerationFormSubmit(BaseModel):
    """Request body for submitting moderation form responses"""
    form_responses: ModerationFormResponse
    decision: ModerationDecision
    summary_comment: Optional[str] = Field(None, max_length=1000)


class ModerationFormOut(BaseModel):
    """Output for moderation form responses"""
    id: UUID
    moderation_case_id: UUID
    responder_id: UUID
    has_marking_rubric: bool
    has_marking_rubric_comment: Optional[str]
    criteria_consistently_applied: bool
    criteria_consistently_applied_comment: Optional[str]
    full_range_of_marks_used: bool
    full_range_of_marks_used_comment: Optional[str]
    marks_awarded_fairly: bool
    marks_awarded_fairly_comment: Optional[str]
    feedback_comments_appropriate: bool
    feedback_comments_appropriate_comment: Optional[str]
    all_marks_appropriate: bool
    all_marks_appropriate_comment: Optional[str]
    recommendations: Optional[str]
    feedback_suggestions: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ModerationCaseOut(BaseModel):
    id: UUID
    assessment_id: UUID
    moderator_id: Optional[UUID]
    third_marker_id: Optional[UUID]
    status: AssessmentStatus
    lecturer_comment: Optional[str]
    moderator_comment: Optional[str]
    third_marker_comment: Optional[str]
    submitted_at: Optional[datetime]
    escalated_at: Optional[datetime]
    decided_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    # Joined fields
    lecturer_name: Optional[str]
    moderator_name: Optional[str]
    third_marker_name: Optional[str]
    sample_size: Optional[int]
    sample_method: Optional[str]
    sample_percent: Optional[Decimal]

    model_config = {"from_attributes": True}


class LecturerDashboardStats(BaseModel):
    total: int
    draft: int
    marks_uploaded: int
    sample_generated: int
    pending_moderation: int
    in_moderation: int
    approved: int
    changes_requested: int


class ModeratorDashboardStats(BaseModel):
    total: int
    pending: int
    in_moderation: int
    escalated: int


class ThirdMarkerDashboardStats(BaseModel):
    total: int
    escalated: int
    in_review: int


class AdminStats(BaseModel):
    total_assessments: int
    by_status: dict[str, int]
    users: dict[str, int]
    activity_last_24h: dict[str, int]


class AuditEventOut(BaseModel):
    id: UUID
    timestamp: datetime
    actor_id: UUID
    actor_name: str
    actor_role: str
    action: str
    assessment_id: Optional[UUID]

    model_config = {"from_attributes": True}


# ===============================
# Pre-Moderation Checklist Models
# ===============================

class PreModerationChecklistSubmit(BaseModel):
    """Input for submitting pre-moderation checklist (Lecturer/Module Leader)"""
    marking_in_accordance: bool
    late_work_policy_adhered: bool
    plagiarism_policy_adhered: bool
    marks_available_with_percentages: bool
    totalling_checked: bool
    consistency_comments: Optional[str] = None


class PreModerationChecklistOut(BaseModel):
    """Output for pre-moderation checklist"""
    id: UUID
    assessment_id: UUID
    completed_by: Optional[UUID]
    marking_in_accordance: bool
    late_work_policy_adhered: bool
    plagiarism_policy_adhered: bool
    marks_available_with_percentages: bool
    totalling_checked: bool
    consistency_comments: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===============================
# Module Leader Response Models
# ===============================

class ModuleLeaderResponseSubmit(BaseModel):
    """Input for submitting module leader response (after moderator feedback)"""
    moderator_comments_considered: bool
    response_to_issues: Optional[str] = None
    outliers_explanation: Optional[str] = None
    needs_third_marker: bool


class ModuleLeaderResponseOut(BaseModel):
    """Output for module leader response"""
    id: UUID
    moderation_case_id: UUID
    completed_by: Optional[UUID]
    moderator_comments_considered: bool
    response_to_issues: Optional[str]
    outliers_explanation: Optional[str]
    needs_third_marker: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
