"""엑셀 임포트용 종목·종별·성별 매핑 상수."""

EVENT_TYPE_MAP = {
    "SRSS": {"name": "30초 번갈아뛰기", "en": "Single Rope Speed Sprint", "duration": 30, "per_heat": 1},
    "SRSE": {"name": "3분 뛰기", "en": "Single Rope Speed Endurance", "duration": 180, "per_heat": 1},
    "SRSR": {"name": "4인 스피드 릴레이", "en": "Single Rope Speed Relay", "duration": 120, "per_heat": 4},
    "DDSS": {"name": "3인 쌍줄 스피드", "en": "Double Dutch Speed Sprint", "duration": 60, "per_heat": 3},
    "DDSR": {"name": "4인 쌍줄 스피드 릴레이", "en": "DD Speed Relay", "duration": 120, "per_heat": 4},
    "SRIF": {"name": "개인 프리스타일", "en": "SR Individual Freestyle", "duration": 75, "per_heat": 1},
    "SRPF": {"name": "2인 프리스타일", "en": "SR Pair Freestyle", "duration": 75, "per_heat": 2},
    "DDPF": {"name": "쌍줄 페어 프리스타일", "en": "DD Pair Freestyle", "duration": 75, "per_heat": 4},
}

DIVISION_NORMALIZE = {
    "U9": "U9", "8 under": "U9",
    "9-11": "9-11",
    "12-15": "12-15",
    "U16": "U16", "15 Younger": "U16",
    "16-18": "16-18",
    "16+": "16+",
    "19+": "Open", "Open": "Open",
}

GENDER_MAP = {"M": "남자", "F": "여자", "Mixed": "혼성", "X": "혼성"}

# 팀 종목 코드 (이름이 콤마로 구분된 다수 참가자)
TEAM_EVENT_CODES = {"SRSR", "DDSR", "DDSS", "SRPF", "DDPF"}

# 참가부 표시명 매핑 (원본코드 → 한글)
DIVISION_DISPLAY = {
    "M U9": "남자-9세미만",
    "F U9": "여자-9세미만",
    "M 8 under": "남자-9세미만",
    "F 8 under": "여자-9세미만",
    "M 9-11": "남자-9~11세",
    "F 9-11": "여자-9~11세",
    "M 12-15": "남자-12~15세",
    "F 12-15": "여자-12~15세",
    "M U16": "남자-16세미만",
    "F U16": "여자-16세미만",
    "Mixed U16": "혼성-16세미만",
    "X U16": "혼성-16세미만",
    "M 16-18": "남자-16~18세",
    "F 16-18": "여자-16~18세",
    "M 16+": "남자-16세이상",
    "F 16+": "여자-16세이상",
    "Mixed 16+": "혼성-16세이상",
    "X 16+": "혼성-16세이상",
    "M 19+": "남자-오픈",
    "F 19+": "여자-오픈",
    "M Open": "남자-오픈",
    "F Open": "여자-오픈",
    "Mixed Open": "혼성-오픈",
    "X 15 Younger": "혼성-16세미만",
    "F 15 Younger": "여자-16세미만",
    "M 15 Younger": "남자-16세미만",
}

def display_division(raw: str) -> str:
    """원본 참가부 코드 → 한글 표시명. 매핑 없으면 원본 반환."""
    return DIVISION_DISPLAY.get(raw, raw)
