---
name: plain
description: Rewrite text in Simplified Technical English (ASD-STE100) at about 80% adherence. Use when the user runs /plain or asks to make instructions, docs, prompts or messages simpler, clearer or STE-style.
argument-hint: "[text or file path; empty = your last answer]"
---

# Plain (ASD-STE100, 80% rule)

Rewrite the input in Simplified Technical English. Keep all facts. Change only the wording and structure.

## Input

1. If `$ARGUMENTS` is a file path, read that file and rewrite its content.
2. If `$ARGUMENTS` is text, rewrite that text.
3. If `$ARGUMENTS` is empty, rewrite your previous answer in this conversation.

## Rules

1. Write a maximum of 20 words per instruction sentence. Descriptive sentences can have 25 words.
2. Put one action in each instruction sentence.
3. Use the active voice. Use the imperative for instructions.
4. Use direct verbs, not verbs turned into nouns. Write "analyze", not "perform an analysis".
5. Use one word for one meaning. Use the simple word:
   - "use", not "utilize" or "leverage"
   - "make sure", not "ensure"
   - "start", not "initiate" or "commence"
   - "help", not "facilitate"
   - "show", not "indicate" or "demonstrate"
   - "get", not "obtain" or "retrieve" (unless "retrieve" is the technical term)
   - "before" / "after", not "prior to" / "subsequent to"
   - "if", not "in the event that"
6. Use the same term for the same thing everywhere. Do not use synonyms for variety.
7. Do not use semicolons. Make two sentences.
8. Do not use contractions, idioms or ambiguous pronouns ("it", "this") when the reference is not clear.
9. Write sequential steps as a numbered list. Write warnings and cautions before the step they apply to.
10. Keep sentence structure flat. Remove nested clauses and filler.

## The 80% rule

Aim for about 80% adherence, not 100%. Full strictness makes the text rigid and removes needed context.

- Keep technical terms, product names, code, commands, paths and identifiers exactly as they are. They are not subject to the word list.
- Keep the reasons, conditions and nuance that the reader needs. Do not delete an explanation only to make a sentence shorter. Split it instead.
- Keep the original format: headings, lists, tables and code blocks. Do not change code blocks.
- Do not add new information. Do not remove facts.

## Output

1. Give only the rewritten text, ready to copy.
2. If the input was a file, show the rewritten text. Do not overwrite the file unless the user asks.
3. If a sentence was ambiguous in the original, add a short note after the text. Do not guess the meaning.
