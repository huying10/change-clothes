from app.core.storage import LocalStorage


def test_save_upload_writes_file_and_returns_path(tmp_path):
    storage = LocalStorage(uploads_dir=tmp_path / "up", outputs_dir=tmp_path / "out")
    path = storage.save_upload("task1", "person", "p.jpg", b"hello")
    assert path.exists()
    assert path.read_bytes() == b"hello"
    assert "task1" in str(path)
    assert path.name.startswith("person")


def test_save_output_and_public_url(tmp_path):
    storage = LocalStorage(uploads_dir=tmp_path / "up", outputs_dir=tmp_path / "out")
    path = storage.save_output("task1", b"video-bytes")
    assert path.exists()
    url = storage.output_public_url(path)
    assert url == "/outputs/task1.mp4"


def test_save_output_image(tmp_path):
    from app.core.storage import LocalStorage
    storage = LocalStorage(uploads_dir=tmp_path / "up", outputs_dir=tmp_path / "out")
    path = storage.save_output_image("task1", b"imgbytes")
    assert path.exists()
    assert path.name == "task1.jpg"
    assert storage.output_public_url(path) == "/outputs/task1.jpg"