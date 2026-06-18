from diplomat_worker.models.registry import built_in_model_registry, get_model_entry


def test_built_in_registry_contains_curated_asr_and_translation_models() -> None:
    registry = built_in_model_registry()

    assert len(registry) >= 4
    assert {entry.task for entry in registry} >= {"asr", "translation"}
    assert len({entry.model_id for entry in registry}) == len(registry)
    assert all(entry.checksum_algorithm == "sha256" for entry in registry)
    assert all(entry.source_url for entry in registry)
    assert all(entry.license_name for entry in registry)


def test_built_in_registry_uses_audited_pinned_snapshot_sources() -> None:
    registry = built_in_model_registry()

    assert all(entry.source_url.startswith("hf://") for entry in registry)
    assert all("@" in entry.source_url for entry in registry)
    assert all(entry.checksum != "0" * 64 for entry in registry)
    assert all(len(entry.checksum) == 64 for entry in registry)
    assert all(entry.terms_summary for entry in registry)


def test_get_model_entry_rejects_unknown_ids() -> None:
    registry = built_in_model_registry()

    try:
        get_model_entry("unknown-model", registry)
    except KeyError as exc:
        assert "unknown-model" in str(exc)
    else:
        raise AssertionError("Expected unknown model id to raise KeyError")


def test_registry_contains_0_4_real_model_targets() -> None:
    registry = built_in_model_registry()

    assert get_model_entry("asr.microsoft.vibevoice-asr", registry).runtime == "vibevoice-asr"
    assert get_model_entry("translation.tencent.hunyuan-mt-7b-fp8", registry).runtime == "local-llm"
