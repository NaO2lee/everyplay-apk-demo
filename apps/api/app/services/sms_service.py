"""
NHN Cloud SMS API 연동
https://docs.nhncloud.com/ko/Notification/SMS/ko/api-guide/
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

NHN_SMS_API_URL = "https://api-sms.cloud.toast.com/sms/v3.0"


class SMSService:
    """NHN Cloud SMS 발송 서비스"""
    
    def __init__(self):
        self.app_key = settings.NHN_APP_KEY
        self.secret_key = settings.NHN_SECRET_KEY
        self.sender_number = settings.SMS_SENDER_NUMBER
        self.enabled = bool(self.app_key and self.secret_key)
        
        if not self.enabled:
            logger.warning("SMS 서비스 비활성화: NHN_APP_KEY 또는 NHN_SECRET_KEY 미설정")
    
    async def send_sms(
        self,
        recipient: str,
        message: str,
        title: str = None,
    ) -> Dict[str, Any]:
        """
        SMS 발송
        
        Args:
            recipient: 수신 번호 (예: 010-1234-5678)
            message: 메시지 내용 (90바이트 초과 시 LMS 자동 전환)
            title: LMS 제목 (선택)
            
        Returns:
            {
                "success": bool,
                "request_id": str,
                "message": str,
                "error": str (실패 시)
            }
        """
        if not self.enabled:
            logger.info(f"SMS 발송 스킵 (테스트 모드): {recipient}")
            return {
                "success": True,
                "request_id": "test-" + datetime.now().strftime("%Y%m%d%H%M%S"),
                "message": "테스트 모드 - 실제 발송 안 함",
            }
        
        # 번호 정규화 (하이픈 제거)
        recipient = recipient.replace("-", "").replace(" ", "")
        sender = self.sender_number.replace("-", "").replace(" ", "")
        
        # 메시지 길이에 따라 SMS/LMS 구분
        message_bytes = len(message.encode("euc-kr", errors="replace"))
        
        if message_bytes > 90:
            # LMS (장문)
            return await self._send_lms(recipient, sender, message, title)
        else:
            # SMS (단문)
            return await self._send_sms(recipient, sender, message)
    
    async def _send_sms(
        self,
        recipient: str,
        sender: str,
        message: str,
    ) -> Dict[str, Any]:
        """SMS (단문) 발송"""
        url = f"{NHN_SMS_API_URL}/appKeys/{self.app_key}/sender/sms"
        
        payload = {
            "body": message,
            "sendNo": sender,
            "recipientList": [
                {"recipientNo": recipient}
            ],
        }
        
        return await self._request(url, payload)
    
    async def _send_lms(
        self,
        recipient: str,
        sender: str,
        message: str,
        title: str = None,
    ) -> Dict[str, Any]:
        """LMS (장문) 발송"""
        url = f"{NHN_SMS_API_URL}/appKeys/{self.app_key}/sender/mms"
        
        payload = {
            "title": title or "[모두의플레이]",
            "body": message,
            "sendNo": sender,
            "recipientList": [
                {"recipientNo": recipient}
            ],
        }
        
        return await self._request(url, payload)
    
    async def _request(self, url: str, payload: dict) -> Dict[str, Any]:
        """API 요청"""
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "X-Secret-Key": self.secret_key,
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                data = response.json()
                
                if response.status_code == 200 and data.get("header", {}).get("isSuccessful"):
                    body = data.get("body", {}).get("data", {})
                    return {
                        "success": True,
                        "request_id": body.get("requestId"),
                        "message": "발송 성공",
                    }
                else:
                    error_msg = data.get("header", {}).get("resultMessage", "Unknown error")
                    logger.error(f"SMS 발송 실패: {error_msg}")
                    return {
                        "success": False,
                        "request_id": None,
                        "message": "발송 실패",
                        "error": error_msg,
                    }
                    
        except Exception as e:
            logger.exception(f"SMS API 요청 에러: {e}")
            return {
                "success": False,
                "request_id": None,
                "message": "API 요청 실패",
                "error": str(e),
            }
    
    async def send_bulk(
        self,
        recipients: list[str],
        message: str,
        title: str = None,
    ) -> Dict[str, Any]:
        """
        대량 SMS 발송
        
        Args:
            recipients: 수신 번호 목록
            message: 메시지 내용
            title: LMS 제목
            
        Returns:
            {
                "success": bool,
                "total": int,
                "sent": int,
                "failed": int,
                "results": list
            }
        """
        results = []
        sent = 0
        failed = 0
        
        for recipient in recipients:
            result = await self.send_sms(recipient, message, title)
            results.append({
                "recipient": recipient,
                **result,
            })
            
            if result["success"]:
                sent += 1
            else:
                failed += 1
        
        return {
            "success": failed == 0,
            "total": len(recipients),
            "sent": sent,
            "failed": failed,
            "results": results,
        }


# 싱글톤 인스턴스
sms_service = SMSService()
