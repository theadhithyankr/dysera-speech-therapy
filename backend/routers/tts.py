"""Text-to-speech endpoints.
GET  /tts?text=...  — simple audio fetch
POST /tts           — Google Cloud TTS-compatible format used by TalkingHead.js:
                      receives {input:{ssml:...}, voice:{...}, audioConfig:{...}}
                      returns  {audioContent: base64_mp3, timepoints: [...]}
                      Uses Microsoft Edge TTS for accurate word-level timing.
"""

from collections import OrderedDict
from fastapi import APIRouter, Query, Depends, Body
from fastapi.responses import Response, JSONResponse
import re
import base64
import edge_tts

from routers.auth import get_current_user

router = APIRouter()

# Neural voice — run `edge-tts --list-voices` to see all options
EDGE_VOICE = "en-US-JennyNeural"

# In-memory LRU cache: plain-text → (audio_bytes, word_boundaries)
_CACHE_MAX = 50
_tts_cache: OrderedDict[str, tuple[bytes, list]] = OrderedDict()


def _ssml_to_text(ssml: str) -> str:
    """Strip SSML tags, returning plain speakable text."""
    text = re.sub(r"<break[^>]*/?>", " ", ssml)
    text = re.sub(r"<[^>]+>", "", text)
    text = (text
        .replace("&amp;", "&").replace("&lt;", "<")
        .replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'"))
    return re.sub(r"\s+", " ", text).strip()


# ── Sound-word translation book ───────────────────────────────────────────────
# Edge TTS reads consonant clusters letter-by-letter ("B-R-R-R").
# Map them to phonetic equivalents the engine pronounces naturally.
# Longer variants are listed first so the regex matches them before short ones.
_SOUND_MAP: dict[str, str] = {
    # Cold / shiver
    "brrr":  "burr",       # "B-R-R-R" → the real word "burr"
    "brr":   "burr",
    # Thinking / hesitation
    "hmmm":  "hm",
    "hmm":   "hm",
    # Quiet / silence gesture
    "shhh":  "shush",      # "S-H-H-H" → the real word "shush"
    "shh":   "shush",
    # Attention-getting whisper
    "psst":  "hey",        # all consonants → nearest natural word
    # Dismissive puff
    "pfft":  "pff",
    # Growl / irritation
    "grrr":  "growl",
    "grr":   "growl",
    # Affirmative hum
    "mhmm":  "mm hm",
    "mmhm":  "mm hm",
    # Throat-clearing
    "ahem":  "ah hem",
    # Frustration / exasperation
    "argh":  "arg",
    # Disgust
    "ugh":   "ugh",
}

# Compiled once at startup: matches any key, case-insensitive, at word boundaries.
# Sorted longest-first so "hmmm" is tried before "hmm", etc.
_SOUND_RE = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in sorted(_SOUND_MAP, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)


def _normalize_sound_words(text: str) -> str:
    return _SOUND_RE.sub(lambda m: _SOUND_MAP[m.group(0).lower()], text)
# ─────────────────────────────────────────────────────────────────────────────


async def _edge_tts_synthesize(text: str) -> tuple[bytes, list]:
    """Generate MP3 audio + word-boundary timing via Microsoft Edge TTS.
    Results are cached in-memory (LRU, max 50 entries) to avoid re-hitting
    the Edge TTS network on repeated or pre-warmed requests.
    """
    text = _normalize_sound_words(text)
    if text in _tts_cache:
        _tts_cache.move_to_end(text)
        return _tts_cache[text]

    communicate = edge_tts.Communicate(text, EDGE_VOICE)
    audio_chunks: list[bytes] = []
    word_boundaries: list[dict] = []

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            word_boundaries.append(chunk)

    result: tuple[bytes, list] = (b"".join(audio_chunks), word_boundaries)
    _tts_cache[text] = result
    if len(_tts_cache) > _CACHE_MAX:
        _tts_cache.popitem(last=False)
    return result


@router.get("/tts")
async def text_to_speech_get(
    text: str = Query(..., max_length=2000),
    _user=Depends(get_current_user),
):
    """GET version — used by our frontend audio fetch."""
    audio_bytes, _ = await _edge_tts_synthesize(text)
    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/tts")
async def text_to_speech_post(payload: dict = Body(...)):
    """POST version — TalkingHead.js sends Google Cloud TTS format.
    No auth required — called directly by the CDN-loaded TalkingHead module."""
    inp = payload.get("input", {})
    ssml = inp.get("ssml", "") if isinstance(inp, dict) else ""

    if not ssml:
        return Response(status_code=400)

    plain_text = _ssml_to_text(ssml)
    if not plain_text or len(plain_text) > 2000:
        return Response(status_code=400)

    audio_bytes, word_boundaries = await _edge_tts_synthesize(plain_text)
    audio_b64 = base64.b64encode(audio_bytes).decode()

    # TalkingHead inserts <mark name='N'/> before the Nth word (N >= 1).
    # word_boundaries[0] = first word → always at time 0, no timepoint needed.
    # word_boundaries[k] → timepoints[k-1] = {markName: str(k), timeSeconds: ...}
    timepoints = [
        {
            "markName": str(k),
            "timeSeconds": wb["offset"] / 10_000_000,  # 100-ns → seconds
        }
        for k, wb in enumerate(word_boundaries[1:], start=1)
    ]

    return JSONResponse({"audioContent": audio_b64, "timepoints": timepoints})
