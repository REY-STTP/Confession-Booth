# Confession Booth — Moderation Specification

## 1. Purpose

Anonymous communities need active abuse controls because anonymity lowers social friction for both honest expression and abuse.

## 2. Moderation States

- `VISIBLE`
- `PENDING`
- `QUARANTINED`
- `HIDDEN`
- `REMOVED`

## 3. Report Reasons

Initial taxonomy:

- SPAM
- HARASSMENT
- HATE
- THREAT
- DOXXING
- SEXUAL_EXPLOITATION
- SELF_HARM
- FRAUD
- MALWARE
- ILLEGAL_ACTIVITY
- OTHER

## 4. Moderation Flow

```text
User report
    ↓
Automated triage
    ↓
Risk score
    ├── Low → queue
    ├── Medium → priority queue
    └── Critical → temporary quarantine + human review
    ↓
Moderator decision
    ↓
Audit log
```

## 5. Moderation Actions

- dismiss;
- hide;
- remove;
- restrict contributor;
- ban contributor;
- restore content.

Do not expose the moderator's identity publicly.

## 6. Critical Content

Threats, doxxing, exploitation, and other high-risk content should receive priority handling according to the platform's legal and safety requirements.

## 7. Appeals

A moderation system should eventually support:

- appeal submission;
- appeal status;
- second-level review;
- policy version at decision time.

## 8. Immutable Content Caveat

Removing content from the application does not remove an already-published blockchain transaction or historical copies.

This must be clearly communicated internally and, where relevant, to users.
