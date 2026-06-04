import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AudioChunk:
    index: int
    start_ms: int
    end_ms: int


def build_fixed_chunks(duration_ms: int, chunk_ms: int = 30_000, overlap_ms: int = 500) -> list[AudioChunk]:
    if duration_ms <= 0:
        return []
    if chunk_ms <= overlap_ms:
        raise ValueError("chunk_ms must be greater than overlap_ms")

    chunks: list[AudioChunk] = []
    start = 0
    index = 0
    while start < duration_ms:
        end = min(start + chunk_ms, duration_ms)
        chunks.append(AudioChunk(index=index, start_ms=start, end_ms=end))
        if end >= duration_ms:
            break
        start = end - overlap_ms
        index += 1
    return chunks


def extract_audio(source_video: Path, target_wav: Path, ffmpeg_path: str = "ffmpeg") -> Path:
    target_wav.parent.mkdir(parents=True, exist_ok=True)
    command = [
        ffmpeg_path,
        "-y",
        "-i",
        str(source_video),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        str(target_wav),
    ]
    subprocess.run(command, capture_output=True, text=True, check=True)
    return target_wav
