# Import datetime types for timestamp fields, date for due_date
from datetime import datetime, date
# Import Decimal for precise numeric values (sample percentages)
from decimal import Decimal
# Import Optional for nullable fields, Literal for restricted string values, Union for multiple types
from typing import Optional, Literal, Union
# Import UUID type for unique identifier fields
from uuid import UUID
# Import Pydantic BaseModel for data validation and Field for adding constraints/metadata
from pydantic import BaseModel, Field


# ===============================
# Status and Decision Type Definitions
# ===============================

# All possible states an assessment can be in during the moderation workflow
# Flows: DRAFT -> MARKS_UPLOADED -> SAMPLE_GENERATED -> SUBMITTED_FOR_MODERATION
#        -> IN_MODERATION -> APPROVED / CHANGES_REQUESTED / ESCALATED
AssessmentStatus = Literal[
    "DRAFT",                       # Initial state - assessment created but no marks yet
    "MARKS_UPLOADED",              # Lecturer has uploaded student marks via CSV
    "SAMPLE_GENERATED",            # System has generated a sample of marks for moderation
    "SUBMITTED_FOR_MODERATION",    # Lecturer has submitted the sample for moderator review
    "IN_MODERATION",               # Moderator is currently reviewing the sample
    "APPROVED",                    # Moderator confirmed all marks are appropriate
    "CHANGES_REQUESTED",           # Moderator found issues and requested mark revisions
    "ESCALATED",                   # Disagreement between lecturer and moderator - needs third marker
]

# Possible decisions a moderator can make after reviewing a sample
ModerationDecision = Literal[
    "APPROVED",            # All marks are appropriate - no changes needed
    "CHANGES_REQUESTED",   # Some marks need revision by the lecturer
    "ESCALATED",           # Cannot reach agreement - escalate to third marker
]

# Possible decisions a third marker can make when resolving a dispute
ThirdMarkerDecision = Literal[
    "CONFIRM_MODERATOR",    # Agrees with the moderator's concerns
    "OVERRIDE_MODERATOR",   # Disagrees with moderator - original marks stand
    "REFER_BACK",           # Sends back to lecturer and moderator for further discussion
]

# Methods used to select which student marks are included in the sample
SampleMethod = Literal["RANDOM", "STRATIFIED", "RISK_BASED"]


# ===============================
# Assessment Models
# ===============================

# Base fields shared by create and output assessment models
class AssessmentBase(BaseModel):
    module_code: str = Field(..., min_length=1, max_length=50)                # e.g. "CS2001"
    module_name: str = Field(..., min_length=1, max_length=200)               # e.g. "Software Engineering"
    title: str = Field(..., min_length=1, max_length=200)                     # e.g. "Coursework 1"
    cohort: str = Field(..., description="e.g. 2025/26")                      # Academic year
    due_date: Union[str, date] = Field(..., description="YYYY-MM-DD format")  # Assessment due date
    weighting: int = Field(..., ge=0, le=100, description="Percentage of module mark")  # 0-100%


# Request model for creating a new assessment (sent by lecturer)
class AssessmentCreate(AssessmentBase):
    """Request model for creating an assessment.
    
    Note: module_run_id is not required - it's auto-created from module_code and cohort.
    """
    credit_size: int = Field(..., ge=15, description="Credits: 15, 20, 30+")  # Module credit value


# Request model for updating assessment fields (partial update)
class AssessmentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)  # New title (optional)
    due_date: Optional[str] = Field(None, description="YYYY-MM-DD format")  # New due date (optional)


# Response model returned when fetching assessment details
class AssessmentOut(AssessmentBase):
    id: UUID                                          # Unique assessment identifier
    status: AssessmentStatus                          # Current workflow status
    marks_uploaded_count: int = 0                     # Number of student marks uploaded
    sample_size: Optional[int] = None                 # Number of marks in the sample (if generated)
    sample_method: Optional[SampleMethod] = None      # How the sample was selected
    created_by: UUID                                  # ID of the lecturer who created it
    created_at: datetime                              # Creation timestamp
    updated_at: datetime                              # Last modification timestamp

    model_config = {"from_attributes": True}  # Allow creating from database rows


# ===============================
# Mark Upload Models
# ===============================

# Single mark entry for a student (part of CSV upload)
class MarkUpload(BaseModel):
    student_id: str = Field(..., min_length=1)         # Student identifier (e.g. "w1234567")
    mark: float = Field(..., ge=0, le=100)             # Mark value between 0 and 100
    marker_id: Optional[str] = None                    # ID of the person who marked it (optional)


# Request body for uploading marks - contains a list of individual marks
class MarksUploadRequest(BaseModel):
    marks: list[MarkUpload]  # Array of student marks to upload


# Response after processing mark uploads
class MarksUploadResponse(BaseModel):
    processed: int        # Number of marks successfully saved
    skipped: int          # Number of duplicates/skipped entries
    errors: list[str]     # List of error messages for failed entries


# ===============================
# Sample Generation Models
# ===============================

# Request to generate a sample of marks for moderation review
class SampleGenerateRequest(BaseModel):
    method: SampleMethod = Field(default="RISK_BASED")              # Sampling algorithm to use
    percent: float = Field(default=10.0, ge=1.0, le=30.0)          # Percentage of marks to sample


# Response containing the generated sample details
class SampleGenerateResponse(BaseModel):
    sample_size: int             # How many marks were selected
    method: SampleMethod         # Which sampling method was used
    percent: float               # What percentage was requested
    sample_items: list[dict]     # The actual sample items with mark data


# ===============================
# Moderation Workflow Models
# ===============================

# Request to submit an assessment for moderation (sent by lecturer)
class ModerationSubmitRequest(BaseModel):
    comment: Optional[str] = Field(None, max_length=1000)  # Optional note to moderator


# Request for moderator to record their decision
class ModerationDecisionRequest(BaseModel):
    decision: ModerationDecision                                    # APPROVED/CHANGES_REQUESTED/ESCALATED
    comment: Optional[str] = Field(None, max_length=1000)           # Justification for the decision


# Request for third marker to record their binding decision
class ThirdMarkerDecisionRequest(BaseModel):
    decision: ThirdMarkerDecision                                   # CONFIRM_MODERATOR/OVERRIDE_MODERATOR/REFER_BACK
    comment: Optional[str] = Field(None, max_length=1000)           # Justification for the decision


# ===============================
# Sample Item Model
# ===============================

# Individual item in a moderation sample (one student's mark)
class SampleItemOut(BaseModel):
    id: UUID                               # Unique sample item identifier
    sample_set_id: UUID                    # Which sample set this belongs to
    student_id: str                        # Student identifier
    mark: float                            # The student's mark
    marker_id: Optional[str]               # Who marked it
    moderator_note: Optional[str]          # Note added by moderator during review
    reason: Optional[str] = None           # Why this mark was included in the sample

    model_config = {"from_attributes": True}


# ========================================
# MODERATION FORM QUESTIONS (per University regulations)
# These map to the official Moderation Form used in marking assessment
# ========================================

class ModerationFormResponse(BaseModel):
    """
    Internal moderator form responses based on Moderation Form requirements.
    All questions must be answered Yes/No with optional comments.
    These questions are mandated by university academic regulations (Section 12).
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
    
    # Additional recommendations - required if all_marks_appropriate is False
    recommendations: Optional[str] = Field(None, max_length=2000, description="Recommendations or issues for consideration")
    
    # Feedback suggestions - optional positive feedback when marks are appropriate
    feedback_suggestions: Optional[str] = Field(None, max_length=1000, description="Suggestions relating to feedback provided")


# Request body for submitting the complete moderation form with a decision
class ModerationFormSubmit(BaseModel):
    """Request body for submitting moderation form responses"""
    form_responses: ModerationFormResponse                          # All 6 form questions answered
    decision: ModerationDecision                                    # Overall decision: APPROVED/CHANGES_REQUESTED/ESCALATED
    summary_comment: Optional[str] = Field(None, max_length=1000)   # Summary justification


# Response model for retrieving saved moderation form data
class ModerationFormOut(BaseModel):
    """Output for moderation form responses"""
    id: UUID                                                # Unique form response identifier
    moderation_case_id: UUID                                # Which moderation case this form belongs to
    responder_id: UUID                                      # Who filled in the form (moderator)
    has_marking_rubric: bool                                # Q1 answer
    has_marking_rubric_comment: Optional[str]               # Q1 comment
    criteria_consistently_applied: bool                     # Q2 answer
    criteria_consistently_applied_comment: Optional[str]    # Q2 comment
    full_range_of_marks_used: bool                          # Q3 answer
    full_range_of_marks_used_comment: Optional[str]         # Q3 comment
    marks_awarded_fairly: bool                              # Q4 answer
    marks_awarded_fairly_comment: Optional[str]             # Q4 comment
    feedback_comments_appropriate: bool                     # Q5 answer
    feedback_comments_appropriate_comment: Optional[str]    # Q5 comment
    all_marks_appropriate: bool                             # Q6 answer
    all_marks_appropriate_comment: Optional[str]            # Q6 comment
    recommendations: Optional[str]                          # Additional recommendations
    feedback_suggestions: Optional[str]                     # Feedback suggestions
    created_at: datetime                                    # When the form was submitted

    model_config = {"from_attributes": True}


# ===============================
# Moderation Case Model
# ===============================

# Full moderation case with all participants and timeline data
class ModerationCaseOut(BaseModel):
    id: UUID                                     # Unique case identifier
    assessment_id: UUID                          # Which assessment this case is for
    moderator_id: Optional[UUID]                 # Assigned moderator (if any)
    third_marker_id: Optional[UUID]              # Assigned third marker (if escalated)
    status: AssessmentStatus                     # Current case status
    lecturer_comment: Optional[str]              # Lecturer's submission comment
    moderator_comment: Optional[str]             # Moderator's decision comment
    third_marker_comment: Optional[str]          # Third marker's decision comment
    submitted_at: Optional[datetime]             # When submitted for moderation
    escalated_at: Optional[datetime]             # When escalated to third marker
    decided_at: Optional[datetime]               # When final decision was made
    created_at: datetime                         # Case creation timestamp
    updated_at: datetime                         # Last modification timestamp
    # Joined fields from related tables (populated by SQL JOINs)
    lecturer_name: Optional[str]                 # Lecturer's display name
    moderator_name: Optional[str]                # Moderator's display name
    third_marker_name: Optional[str]             # Third marker's display name
    sample_size: Optional[int]                   # Number of items in the sample
    sample_method: Optional[str]                 # Sampling method used
    sample_percent: Optional[Decimal]            # Sampling percentage

    model_config = {"from_attributes": True}


# ===============================
# Dashboard Statistics Models
# ===============================

# Statistics shown on the lecturer's dashboard
class LecturerDashboardStats(BaseModel):
    total: int                  # Total assessments created by this lecturer
    draft: int                  # Assessments in DRAFT status
    marks_uploaded: int         # Assessments with marks uploaded
    sample_generated: int       # Assessments with samples generated
    pending_moderation: int     # Submitted but not yet picked up
    in_moderation: int          # Currently being reviewed
    approved: int               # Approved by moderator
    changes_requested: int      # Moderator requested changes


# Statistics shown on the moderator's dashboard
class ModeratorDashboardStats(BaseModel):
    total: int          # Total cases assigned to this moderator
    pending: int        # Cases waiting for review
    in_moderation: int  # Cases currently being reviewed
    escalated: int      # Cases escalated to third marker


# Statistics shown on the third marker's dashboard
class ThirdMarkerDashboardStats(BaseModel):
    total: int       # Total escalated cases assigned
    escalated: int   # Cases waiting for third marker review
    in_review: int   # Cases currently being reviewed


# System-wide statistics shown on the admin dashboard
class AdminStats(BaseModel):
    total_assessments: int                 # Total assessments in the system
    by_status: dict[str, int]              # Count of assessments grouped by status
    users: dict[str, int]                  # Count of users grouped by role
    activity_last_24h: dict[str, int]      # Audit events in last 24 hours grouped by action


# Single audit log entry for the admin audit trail
class AuditEventOut(BaseModel):
    id: UUID                            # Unique event identifier
    timestamp: datetime                 # When the event occurred
    actor_id: UUID                      # Who performed the action
    actor_name: str                     # Display name of the actor
    actor_role: str                     # Role of the actor
    action: str                         # Description of what happened
    assessment_id: Optional[UUID]       # Related assessment (if applicable)

    model_config = {"from_attributes": True}


# ===============================
# Pre-Moderation Checklist Models
# (Completed by lecturer before submitting for moderation)
# ===============================

# Request body for submitting the pre-moderation checklist
class PreModerationChecklistSubmit(BaseModel):
    """Input for submitting pre-moderation checklist (Lecturer/Module Leader)"""
    marking_in_accordance: bool                         # Marking done according to rubric/criteria
    late_work_policy_adhered: bool                      # Late submission penalties applied correctly
    plagiarism_policy_adhered: bool                     # Plagiarism cases handled per policy
    marks_available_with_percentages: bool               # All marks available as percentages
    totalling_checked: bool                             # Mark totals verified for accuracy
    consistency_comments: Optional[str] = None          # Optional comments about marking consistency


# Response model for retrieving saved checklist data
class PreModerationChecklistOut(BaseModel):
    """Output for pre-moderation checklist"""
    id: UUID                                             # Unique checklist identifier
    assessment_id: UUID                                  # Which assessment this checklist is for
    completed_by: Optional[UUID]                         # Who completed the checklist
    marking_in_accordance: bool                          # Q1 answer
    late_work_policy_adhered: bool                       # Q2 answer
    plagiarism_policy_adhered: bool                      # Q3 answer
    marks_available_with_percentages: bool                # Q4 answer
    totalling_checked: bool                              # Q5 answer
    consistency_comments: Optional[str]                   # Optional comments
    created_at: datetime                                 # When submitted
    updated_at: datetime                                 # Last modified

    model_config = {"from_attributes": True}


# ===============================
# Module Models
# ===============================

# Response model for module listing in admin dashboard
class ModuleOut(BaseModel):
    """Output for a module with summary info."""
    id: UUID                                    # Unique module identifier
    code: str                                   # Module code (e.g. "CS2001")
    title: str                                  # Module title
    credits: Optional[int]                      # Credit value (15, 20, 30, etc.)
    created_at: datetime                        # When the module was first created
    updated_at: datetime                        # Last modification timestamp
    assessment_count: int = 0                   # Number of assessments for this module
    latest_cohort: Optional[str] = None         # Most recent academic year using this module

    model_config = {"from_attributes": True}


# ===============================
# Module Leader Response Models
# (Completed after moderator provides feedback)
# ===============================

# Request body for module leader response to moderator feedback
class ModuleLeaderResponseSubmit(BaseModel):
    """Input for submitting module leader response (after moderator feedback)"""
    moderator_comments_considered: bool          # Whether moderator's comments were reviewed
    response_to_issues: Optional[str] = None     # Response to specific issues raised
    outliers_explanation: Optional[str] = None    # Explanation for any outlier marks
    needs_third_marker: bool                     # Whether a third marker is needed


# Response model for retrieving saved module leader response
class ModuleLeaderResponseOut(BaseModel):
    """Output for module leader response"""
    id: UUID                                     # Unique response identifier
    moderation_case_id: UUID                     # Which moderation case this responds to
    completed_by: Optional[UUID]                 # Who submitted the response
    moderator_comments_considered: bool           # Q1 answer
    response_to_issues: Optional[str]            # Response text
    outliers_explanation: Optional[str]           # Outliers explanation text
    needs_third_marker: bool                     # Whether third marker was requested
    created_at: datetime                         # When submitted
    updated_at: datetime                         # Last modified

    model_config = {"from_attributes": True}
