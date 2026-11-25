"""AgentForge AI — Python execution service (FastAPI).

Runs LangGraph-based multi-agent workflows. Called server-to-server by the web
app with a shared bearer token; never exposed to browsers.
"""
from __future__ import annotations

import hmac
import os
import time

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .providers import get_provider
from .research import BudgetExceeded, build_graph

app = FastAPI(title="AgentForge AI execution service", version="0.1.0")


def require_token(authorization: str = Header(default="")) -> None:
    expected = os.getenv("AI_SERVICE_TOKEN", "")
    if not expected:
        raise HTTPException(503, "AI_SERVICE_TOKEN is not configured")
    supplied = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(401, "Invalid service token")


class SourceIn(BaseModel):
    name: str = Field(max_length=300)
    text: str = Field(min_length=1, max_length=200_000)


class ResearchIn(BaseModel):
    question: str = Field(min_length=8, max_length=400)
    sources: list[SourceIn] = Field(min_length=1, max_length=50)
    provider: str = Field(default="sandbox", pattern="^(sandbox|anthropic|openai)$")
    model: str = Field(default="claude-sonnet-5-5", max_length=80)
    max_tokens: int = Field(default=60_000, ge=1_000, le=200_000)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "langgraph": True, "providers": {"anthropic": bool(os.getenv("ANTHROPIC_API_KEY")), "openai": bool(os.getenv("OPENAI_API_KEY"))}}


@app.post("/v1/research", dependencies=[Depends(require_token)])
def research(body: ResearchIn) -> dict:
    t0 = time.monotonic()
    graph = build_graph(get_provider(body.provider, body.model), max_tokens=body.max_tokens)
    state = {"question": body.question, "sources": [{"label": f"S{i + 1}", "name": s.name, "text": s.text} for i, s in enumerate(body.sources)], "log": [], "tokens": 0, "warnings": []}
    try:
        out = graph.invoke(state, {"recursion_limit": 12})
    except BudgetExceeded as e:
        raise HTTPException(422, str(e))
    return {
        "report": out["report"],
        "subquestions": out["subquestions"],
        "issues": out["issues"],
        "warnings": out.get("warnings", []),
        "log": out["log"],
        "simulated": out.get("simulated", False),
        "tokens": out.get("tokens", 0),
        "ms": int((time.monotonic() - t0) * 1000),
    }
