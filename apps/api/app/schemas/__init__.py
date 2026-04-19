from app.schemas.common import APIResponse, ErrorResponse, ErrorDetail
from app.schemas.auth import (
    DeviceRegister,
    DeviceTokenResponse,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    AccessTokenResponse,
    UserResponse,
)
from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventResponse,
    EventDetailResponse,
    EventListResponse,
    StationResponse,
    StationStatusUpdate,
)
from app.schemas.heat import (
    HeatStart,
    HeatResponse,
    HeatDetailResponse,
    HeatListResponse,
    ParticipantBrief,
    ParticipantMapping,
)
from app.schemas.participant import (
    ParticipantCreate,
    ParticipantUpdate,
    ParticipantResponse,
    ParticipantListResponse,
    BulkImportResult,
)
from app.schemas.notification import (
    NotifyRequest,
    NotifyAllRequest,
    NotificationResponse,
    NotifyResult,
    BulkNotifyResult,
)
