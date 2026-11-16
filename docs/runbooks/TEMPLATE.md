# Runbook: <alert or symptom name>

> Written for the on-call engineer at 3am, and for customers running self-hosted. Commands must be copy-pasteable. No "check the usual places".

- **Alert / symptom:** exact Datadog monitor name or what the user sees
- **Severity guidance:** when this is SEV1 vs SEV2 vs ticket
- **Owner:** team
- **Dashboards:** links

## 1. Confirm impact (≤ 5 min)

What to look at to decide whether users are affected, and how many.

## 2. Mitigate first

The fastest safe action that stops the bleeding (roll back, scale, fail over, disable a feature flag), even before the cause is known.

```sh
# exact commands
```

## 3. Diagnose

Ordered by likelihood. For each: the check, what "bad" looks like, and the fix.

## 4. Verify recovery

What metric or check proves it's fixed.

## 5. Follow-up

Ticket links, postmortem trigger criteria.
