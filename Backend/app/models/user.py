from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from app.core.security import validate_password_policy

SRI_LANKAN_DISTRICTS: tuple[str, ...] = (
    "Ampara",
    "Anuradhapura",
    "Badulla",
    "Batticaloa",
    "Colombo",
    "Galle",
    "Gampaha",
    "Hambantota",
    "Jaffna",
    "Kalutara",
    "Kandy",
    "Kegalle",
    "Kilinochchi",
    "Kurunegala",
    "Mannar",
    "Matale",
    "Matara",
    "Monaragala",
    "Mullaitivu",
    "Nuwara Eliya",
    "Polonnaruwa",
    "Puttalam",
    "Ratnapura",
    "Trincomalee",
    "Vavuniya",
)

_DISTRICT_LOOKUP = {d.lower(): d for d in SRI_LANKAN_DISTRICTS}


class UserRegister(BaseModel):
    """Schema for public user registration (Farmer or Agricultural Officer only)."""

    full_name: str = Field(..., min_length=2, max_length=100, examples=["Kasun Perera"])
    email: EmailStr = Field(..., examples=["kasun@example.com"])
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password must be at least 8 characters long, contain at least one letter and one number, and not equal the email",
        examples=["Secret123"],
    )
    role: str = Field(
        default="farmer",
        description="Public registration allows 'farmer' or 'officer' only",
        examples=["farmer"],
    )
    district: str = Field(
        ...,
        description="One of the 25 Sri Lankan districts",
        examples=["Kandy"],
    )
    preferred_language: Literal["si", "en"] = Field(
        default="en",
        description="Preferred language: 'si' (Sinhala) or 'en' (English)",
        examples=["si"],
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

    @field_validator("role")
    @classmethod
    def validate_public_role(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if cleaned == "admin":
            raise ValueError(
                "Admin users cannot be created through public registration"
            )
        if cleaned not in ("farmer", "officer"):
            raise ValueError("Role must be either 'farmer' or 'officer'")
        return cleaned

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
    def check_password_rules(self) -> "UserRegister":
        validate_password_policy(self.password, email=self.email)
        return self


class UserLogin(BaseModel):
    """Schema for user login."""

    email: EmailStr = Field(..., examples=["kasun@example.com"])
    password: str = Field(..., min_length=1, examples=["secret123"])

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).strip().lower()


class UserResponse(BaseModel):
    """Public user profile response (never exposes password)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: EmailStr
    role: Literal["farmer", "officer", "admin"]
    district: str
    preferred_language: Literal["si", "en"]
    is_active: bool = True
    is_approved: bool = True
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_at: datetime


class TokenResponse(BaseModel):
    """JWT authentication response returned on login."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
