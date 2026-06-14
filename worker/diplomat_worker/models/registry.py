from dataclasses import dataclass
from typing import Literal

ModelTask = Literal["asr", "translation"]
ModelTier = Literal["light", "high_quality"]
ModelRuntime = Literal["faster-whisper", "ct2-marian", "local-llm"]


@dataclass(frozen=True)
class ModelRegistryEntry:
    model_id: str
    name: str
    task: ModelTask
    tier: ModelTier
    runtime: ModelRuntime
    provider: str
    version: str
    languages: list[str]
    language_pairs: list[tuple[str, str]]
    model_size_bytes: int
    download_size_bytes: int
    disk_requirement_bytes: int
    recommended_hardware: str
    license_name: str
    license_url: str
    source_url: str
    checksum_algorithm: Literal["sha256"]
    checksum: str
    terms_summary: str


def built_in_model_registry() -> list[ModelRegistryEntry]:
    return [
        ModelRegistryEntry(
            model_id="asr.faster-whisper.small",
            name="Faster Whisper Small",
            task="asr",
            tier="light",
            runtime="faster-whisper",
            provider="faster-whisper",
            version="2026-06-14",
            languages=["zh", "en"],
            language_pairs=[],
            model_size_bytes=488_000_000,
            download_size_bytes=244_000_000,
            disk_requirement_bytes=600_000_000,
            recommended_hardware="CPU fallback; NVIDIA GPU recommended for regular use.",
            license_name="MIT",
            license_url="https://huggingface.co/Systran/faster-whisper-small",
            source_url="https://huggingface.co/Systran/faster-whisper-small",
            checksum_algorithm="sha256",
            checksum="0" * 64,
            terms_summary="Open model weights; verify upstream license and package checksum before release.",
        ),
        ModelRegistryEntry(
            model_id="asr.faster-whisper.medium",
            name="Faster Whisper Medium",
            task="asr",
            tier="high_quality",
            runtime="faster-whisper",
            provider="faster-whisper",
            version="2026-06-14",
            languages=["zh", "en"],
            language_pairs=[],
            model_size_bytes=1_530_000_000,
            download_size_bytes=770_000_000,
            disk_requirement_bytes=1_800_000_000,
            recommended_hardware="NVIDIA GPU recommended; CPU fallback can be slow.",
            license_name="MIT",
            license_url="https://huggingface.co/Systran/faster-whisper-medium",
            source_url="https://huggingface.co/Systran/faster-whisper-medium",
            checksum_algorithm="sha256",
            checksum="0" * 64,
            terms_summary="Open model weights; verify upstream license and package checksum before release.",
        ),
        ModelRegistryEntry(
            model_id="translation.opus-mt.zh-en",
            name="OPUS-MT Chinese to English",
            task="translation",
            tier="light",
            runtime="ct2-marian",
            provider="ct2-marian",
            version="2026-06-14",
            languages=["zh", "en"],
            language_pairs=[("zh", "en")],
            model_size_bytes=310_000_000,
            download_size_bytes=160_000_000,
            disk_requirement_bytes=400_000_000,
            recommended_hardware="CPU fallback; GPU optional for batch work.",
            license_name="CC-BY-4.0",
            license_url="https://huggingface.co/Helsinki-NLP/opus-mt-zh-en",
            source_url="https://huggingface.co/Helsinki-NLP/opus-mt-zh-en",
            checksum_algorithm="sha256",
            checksum="0" * 64,
            terms_summary="Open translation model; attribution and upstream license review required.",
        ),
        ModelRegistryEntry(
            model_id="translation.opus-mt.en-zh",
            name="OPUS-MT English to Chinese",
            task="translation",
            tier="light",
            runtime="ct2-marian",
            provider="ct2-marian",
            version="2026-06-14",
            languages=["en", "zh"],
            language_pairs=[("en", "zh")],
            model_size_bytes=310_000_000,
            download_size_bytes=160_000_000,
            disk_requirement_bytes=400_000_000,
            recommended_hardware="CPU fallback; GPU optional for batch work.",
            license_name="Apache-2.0",
            license_url="https://huggingface.co/Helsinki-NLP/opus-mt-en-zh",
            source_url="https://huggingface.co/Helsinki-NLP/opus-mt-en-zh",
            checksum_algorithm="sha256",
            checksum="0" * 64,
            terms_summary="Open translation model; verify upstream license and package checksum before release.",
        ),
        ModelRegistryEntry(
            model_id="translation.qwen3.4b",
            name="Qwen3 4B Translation",
            task="translation",
            tier="high_quality",
            runtime="local-llm",
            provider="local-llm",
            version="2026-06-14",
            languages=["zh", "en"],
            language_pairs=[("zh", "en"), ("en", "zh")],
            model_size_bytes=4_000_000_000,
            download_size_bytes=2_500_000_000,
            disk_requirement_bytes=5_000_000_000,
            recommended_hardware="NVIDIA GPU recommended; CPU fallback is not recommended.",
            license_name="Apache-2.0",
            license_url="https://huggingface.co/Qwen/Qwen3-4B",
            source_url="https://huggingface.co/Qwen/Qwen3-4B",
            checksum_algorithm="sha256",
            checksum="0" * 64,
            terms_summary="Open-weight local LLM candidate; release package and license audit required.",
        ),
    ]


def get_model_entry(model_id: str, registry: list[ModelRegistryEntry]) -> ModelRegistryEntry:
    for entry in registry:
        if entry.model_id == model_id:
            return entry
    raise KeyError(f"Unknown model id: {model_id}")
