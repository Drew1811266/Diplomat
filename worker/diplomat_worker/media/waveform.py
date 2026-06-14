import json
import subprocess
import sys
from array import array
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class WaveformPeak:
    index: int
    start_ms: int
    end_ms: int
    min: float
    max: float


@dataclass(frozen=True)
class WaveformData:
    project_id: str
    duration_ms: int
    sample_rate: int
    peaks: list[WaveformPeak]


def _clamp_sample(value: float) -> float:
    return round(max(-1.0, min(1.0, value)), 6)


def build_waveform_peaks(
    samples: Iterable[float],
    duration_ms: int,
    peak_count: int = 1024,
    sample_rate: int = 8000,
) -> list[WaveformPeak]:
    if duration_ms < 0:
        raise ValueError("duration_ms must be greater than or equal to 0")
    if peak_count <= 0:
        raise ValueError("peak_count must be greater than 0")
    if sample_rate <= 0:
        raise ValueError("sample_rate must be greater than 0")

    sample_values = list(samples)
    total_samples = len(sample_values)
    peaks: list[WaveformPeak] = []

    for index in range(peak_count):
        start_ms = int(round((index / peak_count) * duration_ms))
        end_ms = duration_ms if index == peak_count - 1 else int(
            round(((index + 1) / peak_count) * duration_ms)
        )

        start_sample = int((index / peak_count) * total_samples)
        end_sample = int(((index + 1) / peak_count) * total_samples)
        bucket = sample_values[start_sample:end_sample]
        if bucket:
            minimum = _clamp_sample(min(bucket))
            maximum = _clamp_sample(max(bucket))
        else:
            minimum = 0.0
            maximum = 0.0
        peaks.append(
            WaveformPeak(
                index=index,
                start_ms=start_ms,
                end_ms=end_ms,
                min=minimum,
                max=maximum,
            )
        )

    return peaks


def extract_waveform_samples(
    source_video: Path,
    ffmpeg_path: str = "ffmpeg",
    sample_rate: int = 8000,
) -> list[float]:
    if sample_rate <= 0:
        raise ValueError("sample_rate must be greater than 0")

    command = [
        ffmpeg_path,
        "-v",
        "error",
        "-i",
        str(source_video),
        "-vn",
        "-ac",
        "1",
        "-ar",
        str(sample_rate),
        "-f",
        "f32le",
        "pipe:1",
    ]
    result = subprocess.run(command, capture_output=True, check=True)
    values = array("f")
    values.frombytes(result.stdout)
    if sys.byteorder != "little":
        values.byteswap()
    return [float(value) for value in values]


def generate_waveform_data(
    project_id: str,
    source_video: Path,
    duration_ms: int,
    ffmpeg_path: str = "ffmpeg",
    sample_rate: int = 8000,
    peak_count: int = 1024,
) -> WaveformData:
    samples = extract_waveform_samples(source_video, ffmpeg_path=ffmpeg_path, sample_rate=sample_rate)
    return WaveformData(
        project_id=project_id,
        duration_ms=duration_ms,
        sample_rate=sample_rate,
        peaks=build_waveform_peaks(
            samples,
            duration_ms=duration_ms,
            peak_count=peak_count,
            sample_rate=sample_rate,
        ),
    )


def _peak_to_dict(peak: WaveformPeak) -> dict:
    return {
        "index": peak.index,
        "startMs": peak.start_ms,
        "endMs": peak.end_ms,
        "min": peak.min,
        "max": peak.max,
    }


def waveform_to_dict(data: WaveformData) -> dict:
    return {
        "projectId": data.project_id,
        "durationMs": data.duration_ms,
        "sampleRate": data.sample_rate,
        "peakCount": len(data.peaks),
        "peaks": [_peak_to_dict(peak) for peak in data.peaks],
    }


def waveform_from_dict(payload: dict) -> WaveformData:
    return WaveformData(
        project_id=str(payload["projectId"]),
        duration_ms=int(payload["durationMs"]),
        sample_rate=int(payload["sampleRate"]),
        peaks=[
            WaveformPeak(
                index=int(item["index"]),
                start_ms=int(item["startMs"]),
                end_ms=int(item["endMs"]),
                min=float(item["min"]),
                max=float(item["max"]),
            )
            for item in payload.get("peaks", [])
        ],
    )


def write_waveform_cache(path: Path, data: WaveformData) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(waveform_to_dict(data), ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def read_waveform_cache(path: Path) -> WaveformData:
    return waveform_from_dict(json.loads(path.read_text(encoding="utf-8")))
