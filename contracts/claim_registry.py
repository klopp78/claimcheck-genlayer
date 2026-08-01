# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing


class RegistryVerdict(typing.NamedTuple):
    verdict: str
    confidence: u8
    source_count: u8
    matched_sources: u8
    contradicted_sources: u8
    summary: str


class ClaimRegistry(gl.Contract):
    """Persistent registry of consensus-adjudicated public claim checks."""

    check_count: u64
    latest_check_id: str
    check_ids: DynArray[str]
    checks: TreeMap[str, str]

    def __init__(self):
        self.check_count = u64(0)
        self.latest_check_id = ""

    @gl.public.view
    def get_check_count(self) -> u64:
        return self.check_count

    @gl.public.view
    def get_latest_check_id(self) -> str:
        return self.latest_check_id

    @gl.public.view
    def get_check(self, check_id: str) -> str:
        return self.checks.get(check_id, "")

    @gl.public.view
    def list_check_ids(self) -> str:
        return json.dumps([check_id for check_id in self.check_ids], separators=(",", ":"))

    @gl.public.write
    def create_check(self, claim: str, source_urls: DynArray[str]):
        if len(claim) < 12:
            raise Exception("claim is too short")
        if len(source_urls) < 2:
            raise Exception("at least two sources are required")
        if len(source_urls) > 5:
            raise Exception("use five sources or fewer")

        source_list = [url for url in source_urls]

        def leader_fn():
            return _adjudicate_from_sources(claim, source_list)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False

            try:
                proposed = _parse_verdict(leader_result.calldata)
                independent = _parse_verdict(_adjudicate_from_sources(claim, source_list))
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
        verdict = json.loads(agreed_json)

        self.check_count = u64(int(self.check_count) + 1)
        check_id = str(int(self.check_count))
        record = {
            "check_id": check_id,
            "claim": claim,
            "source_urls": source_list,
            "submitted_by": str(gl.message.sender_address),
            "result": verdict,
        }

        self.checks[check_id] = json.dumps(record, sort_keys=True, separators=(",", ":"))
        self.check_ids.append(check_id)
        self.latest_check_id = check_id


def _adjudicate_from_sources(claim: str, source_urls: typing.Sequence[str]) -> str:
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
- Do not invent support that is not visible in the rendered source text.
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


def _parse_verdict(raw_json: str) -> RegistryVerdict:
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

    return RegistryVerdict(
        verdict=verdict,
        confidence=u8(confidence),
        source_count=u8(source_count),
        matched_sources=u8(matched_sources),
        contradicted_sources=u8(contradicted_sources),
        summary=summary,
    )
