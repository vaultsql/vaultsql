import io

import pytest
from django.test import override_settings
from PIL import Image

from accounts.storage import process_profile_image


pytestmark = pytest.mark.django_db


def _image_bytes(size: tuple[int, int], fmt: str = "PNG") -> io.BytesIO:
    image = Image.new("RGB", size, color=(0, 255, 0))
    output = io.BytesIO()
    image.save(output, format=fmt)
    output.seek(0)
    return output


@override_settings(IMAGE_MAX_DIMENSION=512, IMAGE_WEBP_QUALITY=85)
def test_process_profile_image_respects_max_dimension_and_aspect_ratio():
    processed_bytes, content_type, metadata = process_profile_image(_image_bytes((1200, 400)))

    assert content_type == "image/webp"
    assert metadata.width == 512
    assert metadata.height < 512

    output = Image.open(io.BytesIO(processed_bytes))
    assert output.format == "WEBP"
    assert output.size == (metadata.width, metadata.height)


@override_settings(IMAGE_MAX_DIMENSION=512)
def test_process_profile_image_does_not_upscale_small_image():
    processed_bytes, _, metadata = process_profile_image(_image_bytes((80, 60)))

    assert metadata.width == 80
    assert metadata.height == 60
    assert len(processed_bytes) > 0
