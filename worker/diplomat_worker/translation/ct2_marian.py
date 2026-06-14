from pathlib import Path

from diplomat_worker.asr.base import CancelToken
from diplomat_worker.translation.base import (
    TranslationCanceled,
    TranslationRequest,
    TranslationResult,
)


class CTranslate2MarianProvider:
    provider = "ct2-marian"

    def __init__(
        self,
        model_path: str,
        model_label: str | None = None,
        device: str = "cpu",
        compute_type: str = "int8",
        source_tokenizer_name: str = "source.spm",
        target_tokenizer_name: str = "target.spm",
    ) -> None:
        self.model_path = model_path
        self.model_label = model_label
        self.device = device
        self.compute_type = compute_type
        self.source_tokenizer_name = source_tokenizer_name
        self.target_tokenizer_name = target_tokenizer_name
        self._translator = None
        self._source_tokenizer = None
        self._target_tokenizer = None

    def translate(
        self,
        request: TranslationRequest,
        cancel_token: CancelToken | None = None,
    ) -> TranslationResult:
        self._raise_if_canceled(cancel_token)
        translator, source_tokenizer, target_tokenizer = self._load_runtime()
        self._raise_if_canceled(cancel_token)

        source_tokens = source_tokenizer.EncodeAsPieces(request.source_text)
        results = translator.translate_batch([source_tokens])
        try:
            target_tokens = results[0].hypotheses[0]
        except (IndexError, AttributeError) as exc:
            raise RuntimeError("CTranslate2 Marian returned no translation hypotheses") from exc

        translated_text = target_tokenizer.DecodePieces(target_tokens).strip()
        return TranslationResult(
            line_id=request.line_id,
            translated_text=translated_text,
            provider=self.provider,
            model=self.model_label or self.model_path,
        )

    def _load_runtime(self):
        if self._translator is not None:
            return self._translator, self._source_tokenizer, self._target_tokenizer

        try:
            import ctranslate2
            import sentencepiece
        except ImportError as exc:
            raise RuntimeError(
                "CTranslate2 Marian translation dependencies are not installed. "
                "Install the Worker translation extras before running local translation."
            ) from exc

        model_dir = Path(self.model_path)
        source_tokenizer_path = model_dir / self.source_tokenizer_name
        target_tokenizer_path = model_dir / self.target_tokenizer_name
        if not source_tokenizer_path.is_file() or not target_tokenizer_path.is_file():
            raise RuntimeError(
                "CTranslate2 Marian model is missing source.spm or target.spm tokenizer files."
            )

        self._translator = ctranslate2.Translator(
            self.model_path,
            device=self.device,
            compute_type=self.compute_type,
        )
        self._source_tokenizer = sentencepiece.SentencePieceProcessor(
            model_file=str(source_tokenizer_path)
        )
        self._target_tokenizer = sentencepiece.SentencePieceProcessor(
            model_file=str(target_tokenizer_path)
        )
        return self._translator, self._source_tokenizer, self._target_tokenizer

    def _raise_if_canceled(self, cancel_token: CancelToken | None) -> None:
        if cancel_token and cancel_token.is_cancel_requested():
            raise TranslationCanceled("Translation canceled")
