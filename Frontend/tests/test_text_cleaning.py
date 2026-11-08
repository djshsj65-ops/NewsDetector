import unittest

import pandas as pd

from make_dataset import prepare_dataset
from text_cleaning import clean_claim_text


class TextCleaningTests(unittest.TestCase):
    def test_fact_check_framing_is_removed(self):
        self.assertEqual(
            clean_claim_text("Fact Check: No, Shabana Azmi did not say this; fake quote viral"),
            "shabana azmi say this; quote",
        )
        self.assertEqual(
            clean_claim_text("Old image from 2016 falsely shared as BJP leader's sister wedding"),
            "from 2016 bjp leader's sister wedding",
        )

    def test_plain_claims_keep_their_words(self):
        self.assertEqual(
            clean_claim_text("New 2000 rupee note has a GPS nano chip"),
            "new 2000 rupee note has a gps nano chip",
        )

    def test_broken_characters_are_repaired_or_removed(self):
        self.assertEqual(clean_claim_text("Farmers to burn PM‰Ûªs effigy"), "farmers to burn pm's effigy")
        self.assertEqual(clean_claim_text("Pakâ€™s Corona plan"), "pak's corona plan")
        self.assertNotIn("û", clean_claim_text("odd ‰Û÷text‰Û"))

    def test_case_does_not_change_cleaned_text(self):
        self.assertEqual(
            clean_claim_text("COVID VACCINE CONTAINS MICROCHIP"),
            clean_claim_text("covid vaccine contains microchip"),
        )

    def test_generated_augment_rows_are_excluded(self):
        source = pd.DataFrame(
            [
                {"Statement": "Real report one", "Label": "true", "Web": "TRIBUNEINDIA"},
                {"Statement": "Fake claim one", "Label": "fake", "Web": "BOOMLIVE"},
                {"Statement": "Glued fact check one....Fact check two", "Label": "fake", "Web": "AUGMENT"},
            ]
        )
        with self.assertRaisesRegex(ValueError, "FAKE=1"):
            prepare_dataset(source, sample_size=2)
        result = prepare_dataset(source, sample_size=1)
        self.assertNotIn("AUGMENT", set(result["Web"]))


if __name__ == "__main__":
    unittest.main()
