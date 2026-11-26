"""Build the server's film-linked Oscar wins from DLu/oscar_data's TSV export."""

import argparse
import csv
import json
import re
from pathlib import Path


def category_label(category):
    return re.sub(r"(?<!^)\b(In|A|An|And|Or|Of|The|To)\b", lambda word: word[0].lower(), category.title())


def winning_films(source):
    with source.open(encoding="utf-8-sig", newline="") as file:
        rows = csv.DictReader(file, delimiter="\t")
        for row in rows:
            if row["Winner"] != "True" or row["Class"] == "SciTech" or not row["Film"]:
                continue
            category = category_label(row["Category"])
            group = category_label(row["CanonicalCategory"])
            recipients = row["Nominees"].replace("|", ", ") if row["Class"] in {"Acting", "Directing"} else ""
            for imdb_id, title in zip(row["FilmId"].split("|"), row["Film"].split("|"), strict=True):
                if re.fullmatch(r"tt\d{7,}", imdb_id):
                    win = (imdb_id, int(row["Ceremony"]), category, title, recipients)
                    yield win if group == category else (*win, group)


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("export", type=Path, help="Path to the upstream oscars.csv")
source = parser.parse_args().export
wins = sorted(set(winning_films(source)))
if not wins:
    parser.error("The export contains no film-linked Oscar wins.")
output = Path(__file__).resolve().parents[1] / "server" / "data" / "oscar-winners.json"
output.write_text("[\n" + ",\n".join(f"  {json.dumps(win, ensure_ascii=False)}" for win in wins) + "\n]\n", encoding="utf-8")
