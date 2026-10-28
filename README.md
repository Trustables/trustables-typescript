# Trustables Typescript SDK

Server-side preview, version **0.1.0**. Requires Node.js 22+. Preview interfaces may change. Supports Simulator and provisioned Wallet Sandbox access.

## Install

```sh
npm install @trustables/sdk
```

## Install and test from source

```sh
git clone https://github.com/Trustables/trustables-typescript.git
cd trustables-typescript
npm ci
npm run build
npm test
python3 tools/generate_types.py --language typescript --check
```

After building, use `npm install /absolute/path/to/trustables-typescript` in your application and import from `@trustables/sdk`.

## Run the Simulator example

Provide `TRUSTABLES_BASE_URL` (your assigned HTTPS origin, without `/api`),
`TRUSTABLES_ORG_ID`, and `TRUSTABLES_API_KEY` through your secret manager or environment.
Use a Simulator key. Never place keys in browser code or commit an `.env` file.
Optionally set `TRUSTABLES_CAMPAIGN_ID` to reuse an existing campaign; otherwise the
example creates one (the service limits active campaigns).

```sh
node examples/simulator.mjs
```

The example displays an authorization URL for private, interactive use. Open it
unchanged and complete any hosted review before choosing an outcome. Do not log
these capability URLs in production. Save the session ID on your backend.
Synthetic results have `mode: simulator`, `simulated: true`, `billable: false`
and `verified_claims: null`. `accepted: true` does not imply customer eligibility.

## Wallet Sandbox

Sandbox requires provisioned organisation access, valid test certificates, a
signing instance, an approved redirect URI, permitted claims and a compatible test
wallet. Use a **wallet** API key and select `sandbox` explicitly. Production is not
supported by this preview. Switching headers cannot provision access.

Copy `examples/verification-request.json`, replace its placeholders, and set
`TRUSTABLES_REQUEST_FILE` to that file. Then run:

```sh
node examples/sandbox.mjs
```

The example creates a verification request and a fresh session, then polls while
you complete the wallet flow. Test credentials do not authorise production actions.
An unprovisioned environment can return `409 sandbox_onboarding_required`.

## Methods and failure handling

The client supports creating wallet requests, creating Simulator campaigns,
starting sessions, reading results, bounded polling, and explicit Simulator
inspect/complete capability calls. Capability calls send **no API key**. A hosted
review token is not a Simulator token; use the hosted browser flow when supplied.

Requests do not retry or follow redirects. Session creation currently uses GET but
creates a new session every time: after a timeout, reconcile the original attempt
before starting another. API errors expose HTTP status, structured detail and
Retry-After; messages do not include keys or response payloads. Treat error details
and returned claims as sensitive. Polling repeats only pending status reads and
stops on completion, failure, expiry, any other terminal status, or its deadline.
HTTP requests use abortable total timeouts; polling has its own overall deadline.

`examples/webhook.mjs` demonstrates raw-body signature verification.
Pass the external URL path without a query string. The default timestamp tolerance
is five minutes. After signature verification, validate the event, organisation
and session and durably deduplicate the submission ID before returning success.
The SDK does not maintain a replay database or make eligibility decisions.

## Validation

Default tests run HTTP loopback fixtures for all five Simulator scenarios,
authentication boundaries, errors, redirects, polling and backend-signed webhook
vectors. They require no credentials and do not claim live service acceptance.

For live acceptance, set the same variables and an existing
`TRUSTABLES_CAMPAIGN_ID`, then run:

```sh
npm run test:live
```

This explicitly creates five sessions and asks a person to choose each outcome in
the hosted browser. It does not bypass review steps. Live wallet acceptance remains
a separate test with your provisioned Sandbox credentials.

## Shared contract

`contract/openapi.json` and generated language models share version 0.1.0 with the
other SDK. See `contract/README.md` for provenance and the export/update procedure.
Both snapshots must be updated together for API changes. CI checks generated types,
compiles/packages the SDK, and runs tests. Version tags (`vX.Y.Z`) publish through GitHub Actions trusted publishing. Releases must match the package version and belong to `main`; version bumps are reviewed in a pull request before tagging.

Documentation: https://docs.trustables.de/sdks/

## License

MIT — see [LICENSE](LICENSE).
