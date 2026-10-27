"""26/10/2026: thay kho object MinIO bang ban gia trong bo nho cho MOI test - pytest khong can MinIO
dang chay (chi can postgres-ml cho test tich hop). Va tren chinh doi tuong `storage` (singleton) de
moi module da `from app.storage import storage` deu thay ban gia."""

import pytest

from app.storage import PhotoNotFoundError, storage


class FakeStorage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def put(self, key: str, data: bytes) -> None:
        self.objects[key] = data

    def get(self, key: str) -> bytes:
        if key not in self.objects:
            raise PhotoNotFoundError(key)
        return self.objects[key]

    def remove_quietly(self, keys) -> None:
        for key in keys:
            if key:
                self.objects.pop(key, None)


@pytest.fixture(autouse=True)
def fake_storage(monkeypatch):
    fake = FakeStorage()
    monkeypatch.setattr(storage, "put", fake.put)
    monkeypatch.setattr(storage, "get", fake.get)
    monkeypatch.setattr(storage, "remove_quietly", fake.remove_quietly)
    return fake
