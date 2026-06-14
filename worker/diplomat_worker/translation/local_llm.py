import re

from diplomat_worker.asr.base import CancelToken
from diplomat_worker.translation.base import (
    TranslationCanceled,
    TranslationRequest,
    TranslationResult,
)


class LocalLlmTranslationProvider:
    provider = "local-llm"

    def __init__(
        self,
        model_path: str,
        model_label: str | None = None,
        device: str = "cpu",
        compute_type: str = "float16",
        max_new_tokens: int = 256,
    ) -> None:
        self.model_path = model_path
        self.model_label = model_label
        self.device = device
        self.compute_type = compute_type
        self.max_new_tokens = max_new_tokens
        self._tokenizer = None
        self._model = None

    def translate(
        self,
        request: TranslationRequest,
        cancel_token: CancelToken | None = None,
    ) -> TranslationResult:
        self._raise_if_canceled(cancel_token)
        tokenizer, model = self._load_runtime()
        self._raise_if_canceled(cancel_token)

        prompt = self._build_prompt(request)
        encoded = tokenizer(prompt, return_tensors="pt")
        if self.device == "cuda" and hasattr(encoded, "to"):
            encoded = encoded.to("cuda")

        generated = model.generate(
            **encoded,
            max_new_tokens=self.max_new_tokens,
            do_sample=False,
        )
        decoded = tokenizer.decode(generated[0], skip_special_tokens=True)
        translated_text = self._extract_translation(decoded, prompt)
        return TranslationResult(
            line_id=request.line_id,
            translated_text=translated_text,
            provider=self.provider,
            model=self.model_label or self.model_path,
        )

    def _load_runtime(self):
        if self._tokenizer is not None:
            return self._tokenizer, self._model

        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError as exc:
            raise RuntimeError(
                "Local LLM translation dependencies are not installed. "
                "Install the Worker translation extras before running local translation."
            ) from exc

        model_kwargs = {
            "local_files_only": True,
            "trust_remote_code": True,
        }
        if self.compute_type == "float16":
            model_kwargs["torch_dtype"] = torch.float16
        if self.device == "cuda":
            model_kwargs["device_map"] = "auto"

        self._tokenizer = AutoTokenizer.from_pretrained(
            self.model_path,
            local_files_only=True,
            trust_remote_code=True,
        )
        self._model = AutoModelForCausalLM.from_pretrained(
            self.model_path,
            **model_kwargs,
        )
        return self._tokenizer, self._model

    def _build_prompt(self, request: TranslationRequest) -> str:
        return (
            f"Translate this subtitle from {request.source_language} to {request.target_language}.\n"
            "Return only the translated subtitle text.\n"
            f"Subtitle: {request.source_text}\n"
            "Translation:"
        )

    def _extract_translation(self, decoded_text: str, prompt: str) -> str:
        text = decoded_text.strip()
        if text.startswith(prompt):
            text = text[len(prompt):].strip()
        return re.sub(
            r"^(translation|translated text|output)\s*:\s*",
            "",
            text,
            flags=re.IGNORECASE,
        ).strip()

    def _raise_if_canceled(self, cancel_token: CancelToken | None) -> None:
        if cancel_token and cancel_token.is_cancel_requested():
            raise TranslationCanceled("Translation canceled")
