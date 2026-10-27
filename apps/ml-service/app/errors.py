"""26/10/2026: loi nghiep vu co ma (Technical_Spec.md muc 27.6 - moi loi cua /ml/face/* tra ve
`{ detail, errorCode }`) - web dich `errorCode` qua i18n (errors.json), `detail` tieng Viet giu
nguyen cho client khong doc ma loi. Dang ky handler trong app/main.py."""


class FaceError(Exception):
    def __init__(self, status_code: int, error_code: str, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.error_code = error_code
        self.detail = detail
