import importlib.util
import re

from diplomat_worker.asr.base import CancelToken
from diplomat_worker.translation.base import (
    TranslationCanceled,
    TranslationRequest,
    TranslationResult,
)


class LocalLlmTranslationProvider:
    provider = "local-llm"
    HUNYUAN_MODEL_IDS = {"translation.tencent.hunyuan-mt-7b-fp8"}
    HUNYUAN_LANGUAGE_NAMES = {
        "zh": "中文",
        "zh-Hant": "繁体中文",
        "en": "英语",
    }
    LANGUAGE_NAMES = {
        "zh": "Chinese",
        "zh-Hant": "Traditional Chinese",
        "en": "English",
    }

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

        if self._is_hunyuan():
            prompt = self._build_hunyuan_prompt(request)
            input_ids = tokenizer.apply_chat_template(
                [{"role": "user", "content": prompt}],
                tokenize=True,
                add_generation_prompt=False,
                return_tensors="pt",
            )
            input_ids = self._move_to_runtime_device(input_ids, model)
            generated = model.generate(
                input_ids=input_ids,
                max_new_tokens=self.max_new_tokens,
                top_k=20,
                top_p=0.6,
                repetition_penalty=1.05,
                temperature=0.7,
                do_sample=True,
            )
        else:
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

        if self._is_hunyuan() and importlib.util.find_spec("compressed_tensors") is None:
            raise RuntimeError(
                "Hunyuan MT FP8 requires compressed-tensors 0.11.0 or newer. "
                "Install the Worker translation extras before running Hunyuan FP8."
            )

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
        if self.compute_type in {"bfloat16", "bf16"}:
            model_kwargs["torch_dtype"] = torch.bfloat16
        elif self.compute_type == "float16":
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

    def close(self) -> None:
        self._model = None
        self._tokenizer = None
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            return

    def _build_prompt(self, request: TranslationRequest) -> str:
        return (
            f"Translate this subtitle from {request.source_language} to {request.target_language}.\n"
            "Return only the translated subtitle text.\n"
            f"Subtitle: {request.source_text}\n"
            "Translation:"
        )

    def _build_hunyuan_prompt(self, request: TranslationRequest) -> str:
        if request.source_language.startswith("zh") or request.target_language.startswith("zh"):
            target_language = self.HUNYUAN_LANGUAGE_NAMES.get(
                request.target_language,
                request.target_language,
            )
            return f"把下面的文本翻译成{target_language}，不要额外解释。\n\n{request.source_text}"
        target_language = self.LANGUAGE_NAMES.get(request.target_language, request.target_language)
        return (
            f"Translate the following segment into {target_language}, without additional explanation.\n\n"
            f"{request.source_text}"
        )

    def _move_to_runtime_device(self, value, model):
        device = getattr(model, "device", self.device)
        if hasattr(value, "to"):
            return value.to(device)
        return value

    def _extract_translation(self, decoded_text: str, prompt: str) -> str:
        text = decoded_text.strip()
        if text.startswith(prompt):
            text = text[len(prompt):].strip()
        elif prompt in text:
            text = text.split(prompt, 1)[1].strip()
        assistant_match = re.search(r"(?:^|\n)assistant\s*:?\s*", text, flags=re.IGNORECASE)
        if assistant_match:
            text = text[assistant_match.end():].strip()
        text = re.sub(r"^(assistant|user)\s*:?\s*", "", text, flags=re.IGNORECASE).strip()
        return re.sub(
            r"^(translation|translated text|output)\s*:\s*",
            "",
            text,
            flags=re.IGNORECASE,
        ).strip()

    def _raise_if_canceled(self, cancel_token: CancelToken | None) -> None:
        if cancel_token and cancel_token.is_cancel_requested():
            raise TranslationCanceled("Translation canceled")

    def _is_hunyuan(self) -> bool:
        return (self.model_label or "") in self.HUNYUAN_MODEL_IDS
