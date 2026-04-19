"""보안 헤더 미들웨어"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """HTTP 응답에 보안 헤더 추가"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # HSTS - HTTPS 강제 (1년)
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        
        # 클릭재킹 방지
        response.headers["X-Frame-Options"] = "DENY"
        
        # MIME 타입 스니핑 방지
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # XSS 필터 (레거시 브라우저용)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # CSP - 콘텐츠 보안 정책
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' wss: ws: https:; "
            "frame-ancestors 'none'"
        )
        
        return response
