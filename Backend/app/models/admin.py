from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from app.core.security import validate_password_policy
from app.models.user import SRI_LANKAN_DISTRICTS, _DISTRICT_LOOKUP, UserResponse


# ============================================================================
# USER ADMIN SCHEMAS
# ============================================================================


class AdminUserCreate(BaseModel):
    """Schema for an admin creating a Farmer, Officer, or Admin account."""

    full_name: str = Field(..., min_length=2, max_length=100, examples=["Nimal Silva"])
    email: EmailStr = Field(..., examples=["nimal.silva@agrolens.lk"])
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password must be at least 8 characters long, contain at least one letter and one number, and not equal the email",
        examples=["Password123"],
    )
    role: Literal["farmer", "officer", "admin"] = Field(
        default="farmer",
        description="User role: 'farmer', 'officer', or 'admin'",
        examples=["officer"],
    )
    district: str = Field(
        ...,
        description="One of the 25 Sri Lankan districts",
        examples=["Kandy"],
    )
    preferred_language: Literal["si", "en"] = Field(
        default="en",
        description="Preferred language: 'si' or 'en'",
        examples=["en"],
    )
    is_active: bool = Field(default=True, description="Whether the account is active")
    is_approved: Optional[bool] = Field(
        default=None,
        description="Optional override for officer approval status. Defaults to True when created by an admin.",
    )

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("full_name must contain at least 2 non-whitespace characters")
        return cleaned

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

    @field_validator("district")
    @classmethod
    def validate_district(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if cleaned not in _DISTRICT_LOOKUP:
            valid_list = ", ".join(SRI_LANKAN_DISTRICTS)
            raise ValueError(
                f"Invalid district '{v}'. Must be one of the 25 Sri Lankan districts: {valid_list}"
            )
        return _DISTRICT_LOOKUP[cleaned]

    @model_validator(mode="after")
    def check_password_rules(self) -> "AdminUserCreate":
        validate_password_policy(self.password, email=self.email)
        return self


class AdminUserUpdate(BaseModel):
    """Schema for editing a user's profile, role, district, language, or active status."""

    full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    role: Optional[Literal["farmer", "officer", "admin"]] = None
    district: Optional[str] = None
    preferred_language: Optional[Literal["si", "en"]] = None
    is_active: Optional[bool] = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("full_name must contain at least 2 non-whitespace characters")
        return cleaned

    @field_validator("district")
    @classmethod
    def validate_district(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip().lower()
        if cleaned not in _DISTRICT_LOOKUP:
            valid_list = ", ".join(SRI_LANKAN_DISTRICTS)
            raise ValueError(
                f"Invalid district '{v}'. Must be one of the 25 Sri Lankan districts: {valid_list}"
            )
        return _DISTRICT_LOOKUP[cleaned]


class AdminPasswordReset(BaseModel):
    """Schema for admin resetting a user's password."""

    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="New password (minimum 8 characters, at least one letter and one number, not equal to email)",
        examples=["NewSecurePass123"],
    )

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return validate_password_policy(v)


class AdminUserDetailResponse(UserResponse):
    """Detailed user response including scan and review counts."""

    deleted_at: Optional[datetime] = None
    scan_count: int = 0
    review_count: int = 0


class AdminUserListResponse(BaseModel):
    """Paginated list of users."""

    items: list[UserResponse]
    total: int
    page: int
    limit: int
    pages: int


# ============================================================================
# TREATMENT ADMIN SCHEMAS
# ============================================================================


def _normalize_treatment_text(value: str | list[str], field_name: str) -> str:
    if isinstance(value, list):
        cleaned_items = [str(v).strip() for v in value if str(v).strip()]
        text = "\n".join(cleaned_items)
    elif isinstance(value, str):
        text = value.strip()
    else:
        raise ValueError(f"{field_name} must be a string")

    if not text:
        raise ValueError(f"{field_name} cannot be empty")
    return text


class AdminTreatmentCreate(BaseModel):
    """Schema for creating a new treatment entry."""

    disease_key: str = Field(
        ...,
        min_length=2,
        max_length=150,
        description="Must match one of the class names in class_names.json and be unique",
        examples=["Tomato___Early_blight"],
    )
    crop: str = Field(..., min_length=2, max_length=60, examples=["Tomato"])
    disease_name_en: str = Field(..., min_length=2, max_length=150, examples=["Tomato Early Blight"])
    disease_name_si: str = Field(..., min_length=2, max_length=150, examples=["තක්කාලි මුල් අංගමාරය"])
    is_healthy: bool = Field(default=False)
    symptoms_en: str | list[str] = Field(..., description="Symptoms in English")
    symptoms_si: str | list[str] = Field(..., description="Symptoms in Sinhala")
    treatment_en: str | list[str] = Field(..., description="Treatment instructions in English")
    treatment_si: str | list[str] = Field(..., description="Treatment instructions in Sinhala")
    prevention_en: str | list[str] = Field(..., description="Prevention advice in English")
    prevention_si: str | list[str] = Field(..., description="Prevention advice in Sinhala")
    source: Optional[str] = Field(
        default="Department of Agriculture, Sri Lanka",
        max_length=250,
        examples=["Department of Agriculture, Sri Lanka"],
    )
    is_verified: bool = Field(
        default=False,
        description="Whether this treatment has been verified (cannot contain 'TO BE VERIFIED')",
    )

    @field_validator(
        "symptoms_en",
        "symptoms_si",
        "treatment_en",
        "treatment_si",
        "prevention_en",
        "prevention_si",
    )
    @classmethod
    def validate_text_fields(cls, v: str | list[str], info: Any) -> str:
        return _normalize_treatment_text(v, info.field_name)


class AdminTreatmentUpdate(BaseModel):
    """Schema for updating an existing treatment entry."""

    disease_key: Optional[str] = Field(default=None, min_length=2, max_length=150)
    crop: Optional[str] = Field(default=None, min_length=2, max_length=60)
    disease_name_en: Optional[str] = Field(default=None, min_length=2, max_length=150)
    disease_name_si: Optional[str] = Field(default=None, min_length=2, max_length=150)
    is_healthy: Optional[bool] = None
    symptoms_en: Optional[str | list[str]] = None
    symptoms_si: Optional[str | list[str]] = None
    treatment_en: Optional[str | list[str]] = None
    treatment_si: Optional[str | list[str]] = None
    prevention_en: Optional[str | list[str]] = None
    prevention_si: Optional[str | list[str]] = None
    source: Optional[str] = Field(default=None, max_length=250)
    is_verified: Optional[bool] = None

    @field_validator(
        "symptoms_en",
        "symptoms_si",
        "treatment_en",
        "treatment_si",
        "prevention_en",
        "prevention_si",
    )
    @classmethod
    def validate_optional_text(
        cls, v: Optional[str | list[str]], info: Any
    ) -> Optional[str]:
        if v is None:
            return None
        return _normalize_treatment_text(v, info.field_name)


class AdminTreatmentVerifyRequest(BaseModel):
    """Optional body when marking a treatment as verified."""

    source: Optional[str] = Field(
        default="Department of Agriculture, Sri Lanka",
        max_length=250,
        description="Verification source attribution (e.g. 'Department of Agriculture, Sri Lanka')",
    )


class TreatmentResponse(BaseModel):
    """Serialized treatment response model."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    disease_key: str
    crop: str
    disease_name_en: str
    disease_name_si: str
    is_healthy: bool
    symptoms_en: str
    symptoms_si: str
    treatment_en: str
    treatment_si: str
    prevention_en: str
    prevention_si: str
    is_verified: bool = False
    source: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AdminTreatmentListResponse(BaseModel):
    """List of treatments returned by GET /api/admin/treatments."""

    items: list[TreatmentResponse]
    total: int


# ============================================================================
# DIAGNOSES ADMIN SCHEMAS
# ============================================================================


class TopPredictionItem(BaseModel):
    class_name: str
    confidence: float


class AdminDiagnosisItem(BaseModel):
    id: str
    user_id: str
    farmer_name: str = "Unknown Farmer"
    farmer_email: Optional[str] = None
    district: str
    image_url: str
    heatmap_url: str
    predicted_class: str
    confidence: float
    top3: list[TopPredictionItem]
    status: str
    officer_label: Optional[str] = None
    officer_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime


class AdminDiagnosisListResponse(BaseModel):
    items: list[AdminDiagnosisItem]
    total: int
    page: int
    limit: int
    pages: int


class AdminDiagnosisDetailResponse(BaseModel):
    diagnosis: AdminDiagnosisItem
    treatment: Optional[TreatmentResponse] = None


# ============================================================================
# ANALYTICS & MODEL ADMIN SCHEMAS
# ============================================================================


class UsersByRoleStats(BaseModel):
    farmer: int
    officer: int
    admin: int
    total: int


class ConfirmedVsCorrectedStats(BaseModel):
    confirmed: int
    corrected: int
    total_reviewed: int


class AdminAnalyticsOverviewResponse(BaseModel):
    users_by_role: UsersByRoleStats
    pending_officer_approvals: int
    total_scans: int
    scans_today: int
    pending_reviews: int
    confirmed_vs_corrected: ConfirmedVsCorrectedStats
    unverified_treatments_count: int


class DailyScanPoint(BaseModel):
    date: str
    count: int


class AdminScansOverTimeResponse(BaseModel):
    days: int
    total_in_period: int
    series: list[DailyScanPoint]


class DiseaseCountItem(BaseModel):
    disease_key: str
    predicted_count: int
    final_count: int


class AdminDiseaseAnalyticsResponse(BaseModel):
    items: list[DiseaseCountItem]


class DistrictScanCountItem(BaseModel):
    district: str
    count: int


class AdminDistrictAnalyticsResponse(BaseModel):
    items: list[DistrictScanCountItem]


class CorrectedClassStatItem(BaseModel):
    predicted_class: str
    corrected_count: int
    most_common_true_label: Optional[str] = None


class AdminModelInfoResponse(BaseModel):
    class_names: list[str]
    num_classes: int
    metrics: dict[str, Any]
    total_reviewed: int
    confirmed_count: int
    corrected_count: int
    officer_agreement_rate: Optional[float] = None
    most_corrected_classes: list[CorrectedClassStatItem]


# ============================================================================
# AUDIT LOG SCHEMAS
# ============================================================================


class AuditLogItem(BaseModel):
    id: str
    admin_id: str
    admin_name: str
    action: str
    target_type: str
    target_id: str
    details: dict[str, Any]
    ip_address: Optional[str] = None
    created_at: datetime


class AdminAuditLogListResponse(BaseModel):
    items: list[AuditLogItem]
    total: int
    page: int
    limit: int
    pages: int
