"""Unified model provider abstraction for the Python AI service.

Mirrors packages/ai-engine (TypeScript). Keys come only from environment
variables. The sandbox provider never calls a model and is always labelled.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Protocol

import httpx


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class Completion:
    text: str
    usage: Usage = field(default_factory=Usage)
    simulated: bool = False


class Provider(Protocol):
    id: str

    def complete(self, system: str, user: str, max_tokens: int) -> Completion: ...


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


class SandboxProvider:
    """Deterministic stand-in: returns the most informative sentences of the user prompt."""

    id = "sandbox"

    def complete(self, system: str, user: str, max_tokens: int) -> Completion:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", user) if 25 < len(s.strip()) < 400]
        words = re.findall(r"[a-z]{4,}", user.lower())
        freq: dict[str, int] = {}
        for w in words:
            freq[w] = freq.get(w, 0) + 1
        ranked = sorted(sentences, key=lambda s: -sum(freq.get(w, 0) for w in re.findall(r"[a-z]{4,}", s.lower())) / (len(s) ** 0.5))
        text = "[Sandbox output — no AI model was called]\n" + "\n".join(f"- {s}" for s in ranked[:3])
        return Completion(text=text, usage=Usage(estimate_tokens(system + user), estimate_tokens(text)), simulated=True)


class AnthropicProvider:
    id = "anthropic"

    def __init__(self, api_key: str, model: str, client: httpx.Client | None = None):
        self.api_key, self.model, self.client = api_key, model, client or httpx.Client(timeout=120)

    def complete(self, system: str, user: str, max_tokens: int) -> Completion:
        r = self.client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01"},
            json={"model": self.model, "system": system, "max_tokens": max_tokens, "messages": [{"role": "user", "content": user}]},
        )
        r.raise_for_status()
        j = r.json()
        text = "".join(b.get("text", "") for b in j.get("content", []) if b.get("type") == "text")
        u = j.get("usage", {})
        return Completion(text=text, usage=Usage(u.get("input_tokens", 0), u.get("output_tokens", 0)))


class OpenAIProvider:
    id = "openai"

    def __init__(self, api_key: str, model: str, client: httpx.Client | None = None):
        self.api_key, self.model, self.client = api_key, model, client or httpx.Client(timeout=120)

    def complete(self, system: str, user: str, max_tokens: int) -> Completion:
        r = self.client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"model": self.model, "max_completion_tokens": max_tokens, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]},
        )
        r.raise_for_status()
        j = r.json()
        u = j.get("usage", {})
        return Completion(text=j["choices"][0]["message"]["content"] or "", usage=Usage(u.get("prompt_tokens", 0), u.get("completion_tokens", 0)))


def get_provider(name: str, model: str) -> Provider:
    if name == "anthropic" and os.getenv("ANTHROPIC_API_KEY"):
        return AnthropicProvider(os.environ["ANTHROPIC_API_KEY"], model)
    if name == "openai" and os.getenv("OPENAI_API_KEY"):
        return OpenAIProvider(os.environ["OPENAI_API_KEY"], model)
    return SandboxProvider()
