from __future__ import annotations

from dataclasses import dataclass

from diplomat_worker.models.capabilities import RuntimeCapabilities
from diplomat_worker.models.registry import ModelRegistryEntry


@dataclass(frozen=True)
class ModelRuntimeProfile:
    profile_id: str
    task: str
    provider: str
    device: str
    compute_type: str
    batch_size: int
    recommended: bool
    available: bool
    reason: str | None
    notes: str


def build_runtime_profiles(
    entry: ModelRegistryEntry,
    capabilities: RuntimeCapabilities,
) -> list[ModelRuntimeProfile]:
    if entry.runtime == "faster-whisper":
        return [
            _profile(entry, "cpu", "int8", 1, True, True, None, "CPU fallback ASR profile."),
            _profile(entry, "cpu", "float32", 1, False, True, None, "CPU high precision fallback."),
            _profile(
                entry,
                "cuda",
                "int8",
                1,
                entry.tier == "light",
                capabilities.cuda_available,
                None if capabilities.cuda_available else "CUDA is not available in this Worker runtime.",
                "CUDA ASR profile.",
            ),
            _profile(
                entry,
                "cuda",
                "float16",
                1,
                entry.tier == "high_quality",
                capabilities.cuda_available,
                None if capabilities.cuda_available else "CUDA is not available in this Worker runtime.",
                "CUDA float16 ASR profile.",
            ),
        ]
    if entry.runtime == "vibevoice-asr":
        return [
            _profile(
                entry,
                "cuda",
                "bfloat16",
                1,
                True,
                capabilities.cuda_available,
                None if capabilities.cuda_available else "CUDA is not available in this Worker runtime.",
                "VibeVoice ASR CUDA bfloat16 development profile.",
            ),
            _profile(
                entry,
                "cpu",
                "float32",
                1,
                False,
                False,
                "VibeVoice ASR requires the CUDA runtime for 0.4 development.",
                "CPU fallback is not supported for VibeVoice ASR.",
            ),
        ]
    if entry.runtime == "ct2-marian":
        return [
            _profile(entry, "cpu", "int8", 8, True, True, None, "CTranslate2 batch translation profile."),
            _profile(entry, "cpu", "float32", 4, False, True, None, "CTranslate2 CPU precision profile."),
            _profile(
                entry,
                "cuda",
                "int8",
                16,
                False,
                capabilities.cuda_available,
                None if capabilities.cuda_available else "CUDA is not available in this Worker runtime.",
                "CTranslate2 CUDA batch translation profile.",
            ),
            _profile(
                entry,
                "cuda",
                "float16",
                8,
                True,
                capabilities.cuda_available,
                None if capabilities.cuda_available else "CUDA is not available in this Worker runtime.",
                "CTranslate2 batch translation profile.",
            ),
        ]
    if entry.runtime == "local-llm":
        return [
            _profile(
                entry,
                "cuda",
                "float16",
                1,
                True,
                capabilities.cuda_available,
                None if capabilities.cuda_available else "CUDA is not available in this Worker runtime.",
                "Local LLM translation profile.",
            )
        ]
    return []


def find_runtime_profile(
    profiles: list[ModelRuntimeProfile],
    *,
    device: str,
    compute_type: str,
) -> ModelRuntimeProfile | None:
    return next(
        (
            profile
            for profile in profiles
            if profile.device == device and profile.compute_type == compute_type
        ),
        None,
    )


def _profile(
    entry: ModelRegistryEntry,
    device: str,
    compute_type: str,
    batch_size: int,
    recommended: bool,
    available: bool,
    reason: str | None,
    notes: str,
) -> ModelRuntimeProfile:
    return ModelRuntimeProfile(
        profile_id=f"{entry.model_id}:{device}:{compute_type}",
        task=entry.task,
        provider=entry.provider,
        device=device,
        compute_type=compute_type,
        batch_size=batch_size,
        recommended=recommended,
        available=available,
        reason=reason,
        notes=notes,
    )
