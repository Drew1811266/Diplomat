from diplomat_worker.models.capabilities import RuntimeCapabilities
from diplomat_worker.models.profiles import build_runtime_profiles, find_runtime_profile
from diplomat_worker.models.registry import ModelRegistryEntry


def make_entry(
    *,
    model_id: str = "asr.fixture.small",
    task: str = "asr",
    runtime: str = "faster-whisper",
    provider: str = "faster-whisper",
    tier: str = "light",
) -> ModelRegistryEntry:
    return ModelRegistryEntry(
        model_id=model_id,
        name="Fixture Model",
        task=task,
        tier=tier,
        runtime=runtime,
        provider=provider,
        version="test",
        languages=["zh", "en"],
        language_pairs=[] if task == "asr" else [("zh", "en")],
        model_size_bytes=100,
        download_size_bytes=100,
        disk_requirement_bytes=100,
        recommended_hardware="test hardware",
        license_name="MIT",
        license_url="https://example.invalid/license",
        source_url="https://example.invalid/model.bin",
        checksum_algorithm="sha256",
        checksum="f" * 64,
        terms_summary="Fixture model.",
    )


def test_faster_whisper_profiles_explain_cuda_unavailable() -> None:
    profiles = build_runtime_profiles(
        make_entry(),
        RuntimeCapabilities(cuda_available=False, cuda_device_count=0, detected_by="test"),
    )

    cuda_profile = find_runtime_profile(profiles, device="cuda", compute_type="float16")
    cpu_profile = find_runtime_profile(profiles, device="cpu", compute_type="int8")

    assert cpu_profile is not None
    assert cpu_profile.available is True
    assert cpu_profile.batch_size == 1
    assert cuda_profile is not None
    assert cuda_profile.available is False
    assert cuda_profile.reason == "CUDA is not available in this Worker runtime."


def test_ct2_translation_profiles_include_batch_size() -> None:
    profiles = build_runtime_profiles(
        make_entry(
            model_id="translation.fixture.zh-en",
            task="translation",
            runtime="ct2-marian",
            provider="ct2-marian",
        ),
        RuntimeCapabilities(cuda_available=True, cuda_device_count=1, detected_by="test"),
    )

    profile = find_runtime_profile(profiles, device="cuda", compute_type="float16")

    assert profile is not None
    assert profile.available is True
    assert profile.batch_size == 8
    assert profile.notes == "CTranslate2 batch translation profile."


def test_vibevoice_asr_profiles_require_cuda() -> None:
    profiles = build_runtime_profiles(
        make_entry(
            model_id="asr.fixture.vibevoice",
            task="asr",
            runtime="vibevoice-asr",
            provider="microsoft",
            tier="high_quality",
        ),
        RuntimeCapabilities(cuda_available=False, cuda_device_count=0, detected_by="test"),
    )

    cuda_profile = find_runtime_profile(profiles, device="cuda", compute_type="float16")
    cpu_profile = find_runtime_profile(profiles, device="cpu", compute_type="float32")

    assert cuda_profile is not None
    assert cuda_profile.recommended is True
    assert cuda_profile.available is False
    assert cuda_profile.reason == "CUDA is not available in this Worker runtime."
    assert cpu_profile is not None
    assert cpu_profile.available is False
    assert cpu_profile.reason == "VibeVoice ASR requires the CUDA runtime for 0.4 development."
