from pathlib import Path

import pytest

from diplomat_worker.media.waveform import (
    WaveformData,
    build_waveform_peaks,
    read_waveform_cache,
    write_waveform_cache,
)


def test_build_waveform_peaks_normalizes_deterministic_samples() -> None:
    peaks = build_waveform_peaks(
        samples=[-0.5, 0.25, 0.75, -1.0],
        duration_ms=400,
        peak_count=2,
        sample_rate=8000,
    )

    assert [peak.index for peak in peaks] == [0, 1]
    assert peaks[0].start_ms == 0
    assert peaks[0].end_ms == 200
    assert peaks[0].min == -0.5
    assert peaks[0].max == 0.25
    assert peaks[1].start_ms == 200
    assert peaks[1].end_ms == 400
    assert peaks[1].min == -1.0
    assert peaks[1].max == 0.75


def test_build_waveform_peaks_clamps_sample_values() -> None:
    peaks = build_waveform_peaks(
        samples=[-2.5, 1.5],
        duration_ms=100,
        peak_count=1,
        sample_rate=8000,
    )

    assert peaks[0].min == -1.0
    assert peaks[0].max == 1.0


def test_build_waveform_peaks_rejects_invalid_inputs() -> None:
    with pytest.raises(ValueError, match="duration_ms"):
        build_waveform_peaks(samples=[0.1], duration_ms=-1, peak_count=1, sample_rate=8000)
    with pytest.raises(ValueError, match="peak_count"):
        build_waveform_peaks(samples=[0.1], duration_ms=100, peak_count=0, sample_rate=8000)
    with pytest.raises(ValueError, match="sample_rate"):
        build_waveform_peaks(samples=[0.1], duration_ms=100, peak_count=1, sample_rate=0)


def test_build_waveform_peaks_returns_zero_peak_for_empty_audio() -> None:
    peaks = build_waveform_peaks(samples=[], duration_ms=1000, peak_count=3, sample_rate=8000)

    assert [(peak.min, peak.max) for peak in peaks] == [(0.0, 0.0), (0.0, 0.0), (0.0, 0.0)]
    assert peaks[-1].end_ms == 1000


def test_waveform_cache_round_trips(tmp_path: Path) -> None:
    data = WaveformData(
        project_id="project-demo",
        duration_ms=400,
        sample_rate=8000,
        peaks=build_waveform_peaks([-0.5, 0.25], 400, 1, 8000),
    )

    path = write_waveform_cache(tmp_path / "cache" / "waveform.json", data)

    assert path == tmp_path / "cache" / "waveform.json"
    assert read_waveform_cache(path) == data
