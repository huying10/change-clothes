import pytest

from app.config import Settings
from app.providers.factory import get_provider
from app.providers.mock import MockProvider


def test_factory_returns_mock():
    settings = Settings(provider="mock", mock_delay_seconds=0)
    provider = get_provider(settings)
    assert isinstance(provider, MockProvider)


def test_factory_rejects_unknown():
    settings = Settings(provider="nope")
    with pytest.raises(ValueError):
        get_provider(settings)