# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing


class SourceVerdict(typing.NamedTuple):
    verdict: str
    confidence: u8
    source_count: u8
    matched_sources: u8
    contradicted_sources: u8
    summary: str


class SourceCredibilityAdjudicator(gl.Contract):
    """Adjudicates whether a public claim is supported by supplied web sources."""

    latest_claim: str
    latest_result: str

    def __init__(self):
        self.latest_claim = ""
        self.latest_result = ""

    @gl.public.view
    def get_latest_result(self) -> str:
        return self.latest_result

    @gl.public.write
    def adjudicate_claim(self, claim: str, source_urls: DynArray[str]):
        if len(claim) < 12:
            raise Exception("claim is too short")
        if len(source_urls) < 2:
            raise Exception("at least two sources are required")
        if len(source_urls) > 5:
            raise Exception("use five sources or fewer")

        def leader_fn():
            return _adjudicate_from_sources(claim, source_urls)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False

            try:
                proposed = _parse_verdict(leader_result.calldata)
                independent = _parse_verdict(_adjudicate_from_sources(claim, source_urls))
            except Exception:
                return False

            if proposed.verdict != independent.verdict:
                return False

            if abs(int(proposed.confidence) - int(independent.confidence)) > 20:
                return False

            if proposed.source_count != independent.source_count:
                return False

            matched_delta = abs(int(proposed.matched_sources) - int(independent.matched_sources))
            contradicted_delta = abs(
                int(proposed.contradicted_sources) - int(independent.contradicted_sources)
            )
            return matched_delta <= 1 and contradicted_delta <= 1

        agreed_json = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        self.latest_claim = claim
        self.latest_result = agreed_json


def _adjudicate_from_sources(claim: str, source_urls: DynArray[str]) -> str:
    source_payloads = []
    for url in source_urls:
        page = gl.nondet.web.render(url, mode="text")
        source_payloads.append(
            {
                "url": url,
                "text": page[:6000],
            }
        )

    prompt = f"""
You are evaluating whether a public claim is supported by supplied sources.

Claim:
{claim}

Sources:
{json.dumps(source_payloads)}

Return only minified JSON with exactly these keys:
- verdict: one of "supported", "contradicted", "mixed", "insufficient"
- confidence: integer from 0 to 100
- source_count: number of sources reviewed
- matched_sources: number of sources that directly support the claim
- contradicted_sources: number of sources that directly contradict the claim
- summary: concise explanation under 450 characters

Rules:
- Prefer "insufficient" when sources are thin, unrelated, inaccessible, or mostly repeat each other.
- Use "mixed" when material sources disagree or support only part of the claim.
- Do not reward claims that rely on a single source duplicated across mirrors.
- Count only direct evidence, not vague similarity.
"""

    raw = gl.nondet.exec_prompt(prompt)
    data = json.loads(raw)
    normalized = {
        "verdict": str(data["verdict"]).lower(),
        "confidence": max(0, min(100, int(data["confidence"]))),
        "source_count": int(data["source_count"]),
        "matched_sources": int(data["matched_sources"]),
        "contradicted_sources": int(data["contradicted_sources"]),
        "summary": str(data["summary"])[:450],
    }
    return json.dumps(normalized, sort_keys=True, separators=(",", ":"))


def _parse_verdict(raw_json: str) -> SourceVerdict:
    data = json.loads(raw_json)
    verdict = str(data["verdict"]).lower()
    if verdict not in ("supported", "contradicted", "mixed", "insufficient"):
        raise Exception("invalid verdict")

    confidence = int(data["confidence"])
    source_count = int(data["source_count"])
    matched_sources = int(data["matched_sources"])
    contradicted_sources = int(data["contradicted_sources"])
    summary = str(data["summary"])

    if confidence < 0 or confidence > 100:
        raise Exception("invalid confidence")
    if source_count < 2 or source_count > 5:
        raise Exception("invalid source count")
    if matched_sources < 0 or contradicted_sources < 0:
        raise Exception("invalid evidence counts")
    if matched_sources + contradicted_sources > source_count:
        raise Exception("invalid source accounting")
    if len(summary) == 0 or len(summary) > 450:
        raise Exception("invalid summary")

    return SourceVerdict(
        verdict=verdict,
        confidence=u8(confidence),
        source_count=u8(source_count),
        matched_sources=u8(matched_sources),
        contradicted_sources=u8(contradicted_sources),
        summary=summary,
    )
