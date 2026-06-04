import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class VideoProbe:
    duration_ms: int
    has_audio: bool
    audio_codec: str | None
    video_codec: str | None


@dataclass(frozen=True)
class FfmpegCheck:
    ok: bool
    error_code: str | None
    message: str

    @staticmethod
    def for_source(source_video: Path, ffmpeg_path: str, ffprobe_path: str) -> "FfmpegCheck":
        if not source_video.exists():
            return FfmpegCheck(False, "SOURCE_NOT_FOUND", f"Source video does not exist: {source_video}")
        if shutil.which(ffmpeg_path) is None and not Path(ffmpeg_path).exists():
            return FfmpegCheck(False, "FFMPEG_NOT_FOUND", f"FFmpeg executable not found: {ffmpeg_path}")
        if shutil.which(ffprobe_path) is None and not Path(ffprobe_path).exists():
            return FfmpegCheck(False, "FFPROBE_NOT_FOUND", f"FFprobe executable not found: {ffprobe_path}")
        return FfmpegCheck(True, None, "FFmpeg preflight passed")


def probe_video(source_video: Path, ffprobe_path: str = "ffprobe") -> VideoProbe:
    command = [
        ffprobe_path,
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(source_video),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=True)
    payload = json.loads(result.stdout)
    duration_seconds = float(payload.get("format", {}).get("duration", 0))
    has_audio = False
    audio_codec = None
    video_codec = None
    for stream in payload.get("streams", []):
        if stream.get("codec_type") == "audio":
            has_audio = True
            if audio_codec is None:
                audio_codec = stream.get("codec_name")
        if stream.get("codec_type") == "video" and video_codec is None:
            video_codec = stream.get("codec_name")
    return VideoProbe(
        duration_ms=int(duration_seconds * 1000),
        has_audio=has_audio,
        audio_codec=audio_codec,
        video_codec=video_codec,
    )
