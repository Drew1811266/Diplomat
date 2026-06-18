from dataclasses import dataclass
from typing import Literal

ModelTask = Literal["asr", "translation"]
ModelTier = Literal["light", "high_quality"]
ModelRuntime = Literal["faster-whisper", "vibevoice-asr", "ct2-marian", "local-llm"]


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
            download_size_bytes=486_215_847,
            disk_requirement_bytes=600_000_000,
            recommended_hardware="CPU fallback; NVIDIA GPU recommended for regular use.",
            license_name="MIT",
            license_url="https://huggingface.co/Systran/faster-whisper-small",
            source_url="hf://Systran/faster-whisper-small@536b0662742c02347bc0e980a01041f333bce120",
            checksum_algorithm="sha256",
            checksum="bcfe217645389979477c3abc24b1d03f75b80fa6225f96a51d85f3ddae4f22b9",
            terms_summary="Pinned Hugging Face snapshot manifest for MIT faster-whisper model weights.",
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
            download_size_bytes=1_530_575_217,
            disk_requirement_bytes=1_900_000_000,
            recommended_hardware="NVIDIA GPU recommended; CPU fallback can be slow.",
            license_name="MIT",
            license_url="https://huggingface.co/Systran/faster-whisper-medium",
            source_url="hf://Systran/faster-whisper-medium@08e178d48790749d25932bbc082711ddcfdfbc4f",
            checksum_algorithm="sha256",
            checksum="1b60d162dfa44c0fbc371d8f4593c6ba0fa0d1d631da1854014c88261a46a64a",
            terms_summary="Pinned Hugging Face snapshot manifest for MIT faster-whisper model weights.",
        ),
        ModelRegistryEntry(
            model_id="translation.opus-mt.zh-en",
            name="OPUS-MT Chinese to English CTranslate2",
            task="translation",
            tier="light",
            runtime="ct2-marian",
            provider="ct2-marian",
            version="2026-06-14",
            languages=["zh", "en"],
            language_pairs=[("zh", "en")],
            model_size_bytes=160_000_000,
            download_size_bytes=160_043_381,
            disk_requirement_bytes=260_000_000,
            recommended_hardware="CPU fallback; GPU optional for batch work.",
            license_name="Apache-2.0; upstream OPUS-MT attribution required",
            license_url="https://huggingface.co/gaudi/opus-mt-zh-en-ctranslate2",
            source_url="hf://gaudi/opus-mt-zh-en-ctranslate2@05d8fc158397bae0c65b8d46c858b6c18e094c12",
            checksum_algorithm="sha256",
            checksum="26ff589b3c7cdead35b5f9d5230a3a2cb25ad2e1ca4e52ccd7404d362f823256",
            terms_summary="Pinned Hugging Face snapshot manifest for CTranslate2 OPUS-MT conversion; preserve upstream attribution.",
        ),
        ModelRegistryEntry(
            model_id="translation.opus-mt.en-zh",
            name="OPUS-MT English to Chinese CTranslate2",
            task="translation",
            tier="light",
            runtime="ct2-marian",
            provider="ct2-marian",
            version="2026-06-14",
            languages=["en", "zh"],
            language_pairs=[("en", "zh")],
            model_size_bytes=160_000_000,
            download_size_bytes=160_043_033,
            disk_requirement_bytes=260_000_000,
            recommended_hardware="CPU fallback; GPU optional for batch work.",
            license_name="Apache-2.0",
            license_url="https://huggingface.co/gaudi/opus-mt-en-zh-ctranslate2",
            source_url="hf://gaudi/opus-mt-en-zh-ctranslate2@dcd22168f08b99dd34c62bc2195e31dc2f04e90b",
            checksum_algorithm="sha256",
            checksum="5be230bc6ec3bf6bc74356f44da071a224a723744c78065908def2e9318a8308",
            terms_summary="Pinned Hugging Face snapshot manifest for CTranslate2 OPUS-MT conversion.",
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
            model_size_bytes=8_000_000_000,
            download_size_bytes=8_060_926_626,
            disk_requirement_bytes=9_000_000_000,
            recommended_hardware="NVIDIA GPU recommended; CPU fallback is not recommended.",
            license_name="Apache-2.0",
            license_url="https://huggingface.co/Qwen/Qwen3-4B",
            source_url="hf://Qwen/Qwen3-4B@1cfa9a7208912126459214e8b04321603b3df60c",
            checksum_algorithm="sha256",
            checksum="b31e1da988e39a506f50ab27701e65a46c13a1bfea94e1bb180fe36cfbf354eb",
            terms_summary="Pinned Hugging Face snapshot manifest for Apache-2.0 Qwen3 local LLM weights.",
        ),
        ModelRegistryEntry(
            model_id="asr.microsoft.vibevoice-asr",
            name="Microsoft VibeVoice ASR",
            task="asr",
            tier="high_quality",
            runtime="vibevoice-asr",
            provider="microsoft",
            version="d0c9efdb8d614685062c04425d91e01b6f37d944",
            languages=["zh", "en"],
            language_pairs=[],
            model_size_bytes=17_349_559_904,
            download_size_bytes=17_349_559_904,
            disk_requirement_bytes=18_500_000_000,
            recommended_hardware="NVIDIA GPU required; 24 GB VRAM recommended for 0.4 development.",
            license_name="MIT",
            license_url="https://huggingface.co/microsoft/VibeVoice-ASR",
            source_url="hf://microsoft/VibeVoice-ASR@d0c9efdb8d614685062c04425d91e01b6f37d944",
            checksum_algorithm="sha256",
            checksum="60d61effa5b94497f1638a38cdbadb3bd908985d5b00798e44d87ed3d8c1ff9f",
            terms_summary="Pinned Hugging Face development manifest for Microsoft VibeVoice ASR.",
        ),
        ModelRegistryEntry(
            model_id="translation.tencent.hunyuan-mt-7b-fp8",
            name="Tencent Hunyuan MT 7B FP8",
            task="translation",
            tier="high_quality",
            runtime="local-llm",
            provider="tencent",
            version="81e5a3f7199524570ba75e61360e990ba88665e4",
            languages=["zh", "en"],
            language_pairs=[("zh", "en"), ("en", "zh")],
            model_size_bytes=8_047_121_287,
            download_size_bytes=8_047_121_287,
            disk_requirement_bytes=9_000_000_000,
            recommended_hardware="NVIDIA GPU required; FP8 runtime target for 24 GB VRAM development.",
            license_name="Upstream License.txt",
            license_url="https://huggingface.co/tencent/Hunyuan-MT-7B-fp8/blob/main/License.txt",
            source_url="hf://tencent/Hunyuan-MT-7B-fp8@81e5a3f7199524570ba75e61360e990ba88665e4",
            checksum_algorithm="sha256",
            checksum="89f1757846ac6c9e9d85da914c0818850e10c2244e885d9a3e7db6f3e77e1392",
            terms_summary="Pinned Hugging Face development manifest for Tencent Hunyuan MT 7B FP8; upstream license acceptance required.",
        ),
    ]


def get_model_entry(model_id: str, registry: list[ModelRegistryEntry]) -> ModelRegistryEntry:
    for entry in registry:
        if entry.model_id == model_id:
            return entry
    raise KeyError(f"Unknown model id: {model_id}")
