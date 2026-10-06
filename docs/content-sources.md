# Typeflow content sources

The snapshots in [js/content.js](../js/content.js) are public-domain material,
independently curated for practice. No Monkeytype/keybr code or data is used.

## Common English words

Source: Grady Ward's **Moby Words II**, Project Gutenberg eBook #3201.

- [Author's documentation and public-domain grant](https://www.gutenberg.org/files/3201/3201-h/3201-h.htm).
- [1,000 words by frequency](https://www.gutenberg.org/files/3201/files/freq.txt).
- [366 often-misspelled words](https://www.gutenberg.org/files/3201/files/oftenmis.txt).

Ward granted the documentation, software and database to the public domain in
January 2001. The deduplicated union supplies 1,189 lowercase ASCII alphabetic
words; repeated entries, headings and multiword/punctuated tokens are excluded.
The frequency source's advertised count includes duplicates. This is a common-word
practice pool, with commonly misspelled words added, not a new frequency ranking.

## Public-domain quotations

Source: John Bartlett's **Familiar Quotations**, ninth edition, Little, Brown and
Company, Boston, **1905**, Project Gutenberg eBook #27889.

- [Catalogue and public-domain status](https://www.gutenberg.org/ebooks/27889).
- [1905 text and source page anchors](https://www.gutenberg.org/files/27889/27889-h/27889-h.htm).

The catalogue marks this edition public domain in the USA. The 100 original English
passages represent 14 authors who died by 1892; the latest is [Alfred Tennyson
(1809–1892)](https://www.gutenberg.org/ebooks/59279), whose death date is blank in the
historical heading. No modern edition or translation is used.

Each quote stores author, stable ID and source page link. IDs depend on author and
wording, not array position; these records form the attribution index. Selection
excludes footnotes, commentary, incomplete fragments, translations and book wrappers.
The raw book stays ignored and is not shipped. Verse line breaks/whitespace become
single spaces. Selected passages already use printable ASCII punctuation; words,
spelling, punctuation and case are retained. Runtime Unicode normalization is unchanged.
