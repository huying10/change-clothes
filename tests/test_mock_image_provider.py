from pathlib import Path

from app.providers.base import GenOptions
from app.providers.mock import MockImageProvider


def test_mock_image_returns_placeholder_bytes(tmp_path):
    placeholder = tmp_path / "ph.jpg"
    placeholder.write_bytes(b"JPEGDATA")
    provider = MockImageProvider(placeholder_path=placeholder)
    data = provider.generate([Path("person.jpg")], "prompt", GenOptions())
    assert data == b"JPEGDATA"