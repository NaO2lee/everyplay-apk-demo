"""
MySQL 호환 UUID 타입
"""
import uuid
from sqlalchemy import String, TypeDecorator


class GUID(TypeDecorator):
    """
    MySQL 호환 UUID 타입
    CHAR(36)으로 저장
    """
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if isinstance(value, uuid.UUID):
                return str(value)
            return value
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return uuid.UUID(value)
        return value
