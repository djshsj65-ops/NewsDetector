"""Shared text cleaning for training and prediction.

Most FAKE rows in IFND are fact-checkers' headlines ("Fact Check: No, X did not...",
"Old video falsely shared as..."), not the false claims themselves. Without
cleaning, the model learns to spot fact-check wording ("viral", "fake", "old
video") instead of the claim. This module removes that framing from every text,
in training and at prediction time, so both see the same kind of input.
"""

import re
import unicodedata

# Broken characters from a wrong text encoding in the dataset (e.g. "DonÕt").
# Each publisher has its own broken pattern, so leaving them in would let the
# model recognise the source instead of the claim. Anything left over after this
# mapping that is not plain ASCII or Devanagari is removed in clean_claim_text.
MOJIBAKE = {
    "‰Ûª": "'", "‰Û÷": "'", "‰Ûœ": '"', "‰Û\x9d": '"', "‰Û": '"', "ï¿½": "'",
    "â€™": "'", "â€˜": "'", "â€œ": '"', "â€\x9d": '"', "â€”": "-", "â€“": "-", "â€¦": " ",
    "Õ": "'", "Ô": "'", "Ò": '"', "Ó": '"', "’": "'", "‘": "'", "“": '"', "”": '"',
}
NON_TEXT_RE = re.compile(r"[^\x00-\x7fऀ-ॿ]")

# Fact-checker framing, removed wherever it appears. Order matters: longer
# phrases first so "fact check" is removed before the single word "fact".
FRAMING_PATTERNS = [
    r"fact[\s-]*check(?:ed|s)?\s*[:|-]?",
    r"here'?s the (?:truth|reality|fact)s?(?: behind (?:it|this|the))?",
    r"here'?s (?:what|why|how)[^.]*",
    r"(?:know|find out|read) the truth",
    r"the truth behind",
    r"(?:is|are|was|were) (?:a )?(?:fake|false|misleading|doctored|morphed|edited|hoax)",
    r"falsely (?:shared|claimed|linked|attributed|passed off)(?: as| to| with)?",
    r"(?:shared|viral|circulat(?:ed|ing)|passed off) (?:as|with|claiming)",
    r"with (?:a )?(?:false|fake|misleading|communal) (?:claim|claims|narrative|spin|context|angle)",
    r"(?:old|unrelated|edited|morphed|doctored|cropped|clipped|digitally altered) "
    r"(?:video|image|photo|picture|pic|clip|footage)s?",
    r"\b(?:fake|false|misleading|viral|hoax|morphed|doctored|debunked|busted|"
    r"rumou?r|falsely|misleadingly|fabricated|bogus)\b",
    # Fact-checkers write "X did not say Y"; news headlines rarely use this form.
    r"\b(?:did|does|do|is|was|are|were|has|have|had)(?:n'?t| not)\b",
    r"\bnot\b",
    # Words fact-checkers use to describe the post rather than the claim itself.
    r"\b(?:news|claims?|claiming|claimed|netizens|social media(?: users)?|"
    r"post(?:s|ed)?|tweets?|videos?|images?|photos?|pictures?|pics?|clips?|"
    r"footage|screenshots?|messages?|forwards?)\b",
    r"^(?:no|yes|nope|wrong|explained|claim|reality)\s*[,:!.-]+",
    # Fact-check headlines are often questions: "Did X really say Y?"
    r"^(?:did|does|do|is|was|are|were|has|have|can|will)\b",
    r"\breally\b",
    r"\b(?:is it true|true or (?:false|fake)|the truth|truth|true|real|facts?|wrong(?:ly)?|"
    r"don'?t (?:fall for|believe)|fall for|believe|hoaxposed|revived)\b",
    r"\.{2,}|…",
]
FRAMING_RE = re.compile("|".join(f"(?:{p})" for p in FRAMING_PATTERNS))


def clean_claim_text(value):
    """Normalize a headline or claim and remove fact-check framing."""
    if value is None:
        return ""
    text = str(value)
    for broken, fixed in MOJIBAKE.items():
        text = text.replace(broken, fixed)
    text = unicodedata.normalize("NFKC", text).casefold()
    text = NON_TEXT_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    # Run twice: removing a prefix can expose another ("fact check: no, ...").
    for _ in range(2):
        text = FRAMING_RE.sub(" ", text)
        text = re.sub(r"\s+", " ", text).strip(" ,:;!-|.")
    return text
