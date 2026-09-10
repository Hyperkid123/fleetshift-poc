# Multi-IdP Authentication Spike

This document records the backend direction being explored for OME-315. It is an implementation note, not a final product design.

## Goal

Allow OME to authenticate tokens from multiple OIDC providers without relying on provider ordering or a hardcoded provider.

The core request flow is:

```text
token
  -> read principal authority as an untrusted routing hint
  -> find AuthorityConfig by principal authority
  -> verify signature and claims with that method
  -> attach method and identity to request context
```

## AuthorityConfig

`AuthorityConfig` is the authoritative backend resource for configuration associated with a principal authority. It replaces scattered startup OIDC values as the long-term source of truth. The name is intentional: this resource describes an authority and its accepted identity mechanisms, tenant mapping, provenance configuration, and delivery policy; it is not an AWS-style trust policy.

Conceptually:

```text
AuthorityConfig
  -> PrincipalAuthority
  -> TenantMapping
  -> CredentialMethods
  -> ProvenanceProfiles
  -> DeliveryPolicies
```

`PrincipalAuthority` is a scheme plus authority identifier. For OIDC, the scheme is `oidc` and the authority identifier is the issuer. Other schemes can use their own authority identifier, such as a SPIFFE trust domain. The runtime lookup starts with this canonical authority because the incoming credential identifies its issuing authority before any tenant or policy resolution occurs.

An OIDC credential method describes how credentials from one authority can authenticate:

```yaml
id: corporate-keycloak
principalAuthority:
  scheme: oidc
  authority: https://keycloak.example.com/realms/company
audiences:
  - acme-ome-api
clientId: fleetshift-ui
scopes:
  - openid
  - profile
  - email
```

A tenant mapping describes where an authenticated identity belongs:

```yaml
tenantId: acme
credentialMethodId: corporate-keycloak
emailDomains:
  - acme.example
```

The authority configuration is keyed by principal authority, not by tenant. Tenant mapping remains part of the configuration so one tenant can use multiple authorities and one authority can serve multiple tenants. After authentication, every identity carries three values: opaque subject identifier, principal authority, and tenant identifier. Tenant is the primary isolation key for queries and operations; cross-tenant operations must be explicit and separately authorized.

## Resource Operations

The backend resource should support normal resource operations:

```text
Get   /v1/authorityConfigs/{id}
List  /v1/authorityConfigs
Post  /v1/authorityConfigs
```

Update and disable/delete behavior can follow the normal resource lifecycle. Existing `fleetctl auth setup` can become the client workflow for these APIs; it does not require a separate `AuthSetup` backend resource.

## Bootstrap

Startup configuration is a conditional first create:

```text
server starts
  -> load bootstrap config
  -> check whether AuthorityConfig exists
  -> if absent, internally create initial AuthorityConfig
  -> initialize authentication from persisted configuration
  -> open authenticated API
```

If configuration already exists, startup inputs are ignored. They must not overwrite or reconcile persisted configuration. Bootstrap input may contain one initial IdP; additional authorities are added through AuthorityConfig operations.

Bootstrap should use the same validation and persistence path as the normal create operation, even if the public API is not available yet.

The IdP lifecycle is outside AuthorityConfig. Packaging or deployment selects and starts the initial provider before OME bootstrap runs:

```text
no external IdP configured
  -> packaging starts sandbox Dex
  -> bootstrap creates AuthorityConfig for Dex

external IdP configured
  -> packaging does not start Dex
  -> bootstrap creates AuthorityConfig for external IdP
```

AuthorityConfig records and activates configuration for the selected authority; it does not start or manage the IdP process itself.

## UI Provider Discovery

The UI and CLI need public OIDC metadata before login, but discovery should not return every tenant and authority mapping in one response. Given an email domain or equivalent login hint, `GET /api/ui/config?emailDomain=example.com` returns matching configured OIDC providers. Each entry contains provider-specific login data:

```json
{
  "oidc": [
    {
      "authority": "https://idp.example.com/realms/main",
      "clientId": "fleetshift-ui",
      "scope": "openid profile email",
      "authorizationEndpoint": "https://idp.example.com/auth",
      "emailDomain": "@example.com"
    }
  ]
}
```

The endpoint and provider metadata are not secrets. Domain filtering limits unnecessary tenant enumeration; rate limiting or an established browser session can provide additional defense in depth. The UI chooses a provider before login. The backend still determines and validates the provider from the token authority; the UI selection is not trusted as authentication proof.

The CLI should use the same AuthorityConfig discovery rather than maintaining a separate provider list. `fleetctl auth login` can:

```text
load AuthorityConfig providers
  -> if one provider is available, use it
  -> if several providers are available, prompt for provider
  -> persist selected auth-method ID in the local CLI context
  -> authenticate against selected provider
```

An explicit provider option can bypass the prompt, for example `--auth-method=corporate-keycloak`. The selected method is a login hint; the server still resolves and validates the method from the token authority. An AuthorityConfig ID is only needed if users can select between multiple configurations; for choosing a provider within one configuration, the auth-method ID is the relevant identifier.

The CLI can persist the selected auth-method ID in its local context, similar to how `oc` persists a selected project:

```text
CLI context
  -> OME endpoint
  -> selected auth-method ID
  -> credentials
```

This is a convenience for subsequent logins, not an authority decision. If the method is no longer present or the server rejects the token issuer, the CLI must discard the stale selection and prompt again.

## Domain Mapping

Email domains are discovery hints. They are not identity proof and must not be used instead of principal authority and subject verification.

After token verification, identity is based on:

```text
(principal authority, subject, tenant)
```

The verified identity can then be resolved through the applicable tenant mapping. Tenant is the primary isolation key for queries and operations. If required, the verified email claim can be checked against the mapping's allowed domains.

## Audience

Audience validates token purpose after principal authority selects the credential method.

```text
JWT principal authority -> select credential method
JWT audience -> validate API/resource use
```

AuthorityConfig should accept the audience configured by the customer for OME rather than mandating one global audience name. A dedicated audience that is not shared with another application is the recommended setup, but it remains guidance rather than a universal integration requirement. A list of accepted audiences per credential method supports providers and customers that need more than one OME audience.

This covers two related cases:

1. One auth method accepts tokens issued for several configured audiences.
2. One token contains several audience values, one of which must match the configured list.

Example:

```yaml
id: corporate-keycloak
audiences:
  - acme-ome-api
  - acme-ome-cli
signingEnrollmentAudience: acme-ome-signing
```

The verifier should accept the token only when its `aud` claim intersects the configured audience list. An arbitrary audience should never be accepted just because the issuer is trusted.

Audience values are provider-specific. AuthorityConfig may explicitly accept an existing customer audience to reduce IdP setup work:

```yaml
id: customer-keycloak
principalAuthority:
  scheme: oidc
  authority: https://keycloak.customer.example/realms/main
audiences:
  - existing-customer-api
```

This allows OME to consume an existing client/realm configuration when its tokens are otherwise suitable. A dedicated OME audience is recommended because it clearly identifies OME as the target API and avoids accepting a token intended for another application. Existing customer audiences are also supported when explicitly configured. OME must never accept arbitrary audiences from a trusted authority.

An auth method may also opt into client-level restriction:

```yaml
allowedClients:
  - fleetshift-ui
  - fleetshift-cli
```

When configured, `azp` must identify one of these OIDC client registrations. When omitted, issuer and audience validation are sufficient. `azp` identifies the OIDC client that obtained the token; it does not identify the browser, CLI, or network connection that sent the HTTP request.

## UI and CLI Tokens

Separate OIDC clients for UI and CLI are recommended operationally because they have different redirect URIs, distribution mechanisms, and troubleshooting needs. This is defense in depth, not an enforceable UI-versus-CLI authorization boundary. A user can perform the same operation through a browser, CLI, or browser terminal, and `azp` identifies the client that obtained the token rather than the transport used for the request. These clients can therefore use tokens accepted for the same API audience.

Authorization for sensitive operations belongs in normal endpoint and resource RBAC. UI configuration endpoints may have separate access rules because they are configuration resources, not because the request came from a UI.

Separate token types or audiences remain possible if a concrete protocol or security requirement appears, but they are not required merely to distinguish UI from CLI.

Audience rules should be aligned with OME's planned authentication changes before finalizing verifier behavior. UI client audiences and API resource audiences may not be interchangeable.

### Signing enrollment

Signing enrollment should use an OIDC authentication flow that returns an ID token, rather than relying on an API bearer token or token exchange. A separate client and purpose-specific audience are recommended when the customer IdP can support them, but should not be a universal integration requirement.

```text
normal API token          -> access token for OME API
signing enrollment token  -> OIDC ID token with nonce-bound key evidence
```

The signing client creates a key pair and places a self-signed proof-of-possession, or a binding to that proof, in the OIDC nonce. The user completes the IdP authentication flow, and the resulting ID token proves both the authenticated user and the key binding. The client sends the ID token and key-binding evidence to the resource manager for verification.

The verifier must validate the ID token as an OIDC authentication result, including its nonce, issuer, signature, subject, and intended client. It must not accept an arbitrary access token as signing enrollment evidence. Token keys continue to come from OIDC discovery and JWKS.

The resulting evidence binds:

```text
user identity
  -> authenticated by customer IdP
  -> proof of possession of signing key
  -> nonce binds key evidence to OIDC authentication
```

OME must remain a courier for the resulting evidence and must not mint or assert the signing identity. Signing-specific RBAC, provenance, and operation authorization still apply.

## Runtime Authentication

HTTP and gRPC should use one shared authenticator and provider registry.

The authentication result should include:

```text
credentialMethodId
principalAuthority
subject
tenant
claims
validated audience
raw token
```

The runtime registry should maintain a principal-authority index and isolated JWKS state for each OIDC authority. Provider updates should replace the live registry atomically rather than mutating it partially.

Code must not select the first credential method. This applies to request authentication, signer enrollment, provenance verification, and trust-bundle handling.

For cluster-hosted extension backends, authentication may terminate at the fleetlet or direct cluster proxy. The agent can validate the customer credential and pass a protected identity context to the extension backend. That context requires a trusted channel such as mTLS, a signed envelope, or an equivalent cluster-local trust mechanism. Plain identity headers are not sufficient.

This is one channel mode, not a requirement for every operation. OME also has platform-authenticated API and addon paths where OME validates the request and passes pre-authenticated tenant context downstream. Courier mode applies where the target or fleetlet must remain the trust boundary, especially for delivery, factory targets, and provenance-protected operations.

## Configuration Plumbing

Environment variables, process arguments, and JSON/YAML files should feed one normalized configuration model. `koanf` is a candidate for this plumbing.

Hot reload is not required for the first implementation. Initial work should establish predictable precedence and safe startup loading; reload can be added after provider-registry replacement and JWKS lifecycle behavior are defined.

## AIO Spike Boundary

Sandbox Dex plus external Keycloak is only packaging behavior for this spike. The backend should consume generic provider definitions and should not contain Dex-specific selection logic.

Production behavior may use sandbox Dex when no external provider is configured and disable Dex when an external provider is configured.

## Open Questions

- Exact `AuthorityConfig` resource shape and tenant mapping representation.
- Whether one authority configuration can map to multiple tenants and how those mappings are selected.
- Accepted audience representation and endpoint-specific rules.
- Bootstrap config file format and precedence with flags and environment.
- Runtime API operations for provider replacement and disablement.
