from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from src import limits


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

    @field_validator("email")
    @classmethod
    def _norm_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def _check_password(cls, v: str) -> str:
        if len(v) < limits.PASSWORD_MIN:
            raise ValueError(f"Mật khẩu phải có ít nhất {limits.PASSWORD_MIN} ký tự")
        if len(v.encode("utf-8")) > limits.PASSWORD_MAX_BYTES:
            raise ValueError(f"Mật khẩu quá dài (tối đa {limits.PASSWORD_MAX_BYTES} byte)")
        return v

    @field_validator("full_name")
    @classmethod
    def _check_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if len(v) > limits.FULL_NAME_MAX:
            raise ValueError(f"Họ tên tối đa {limits.FULL_NAME_MAX} ký tự")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def _norm_email(cls, v: str) -> str:
        return v.strip().lower()


class ProfileUpdateIn(BaseModel):
    full_name: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def _check_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if len(v) > limits.FULL_NAME_MAX:
            raise ValueError(f"Họ tên tối đa {limits.FULL_NAME_MAX} ký tự")
        return v


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: Optional[str] = None
    created_at: datetime
