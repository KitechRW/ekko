# Security Policy

EKKO handles public live media, realtime communication, organization administration, and potentially private stream URLs. Security issues should be treated carefully.

## Do not publish secrets

Never commit:

- RTMP credentials or stream keys;
- private HLS URLs or signing secrets;
- database credentials;
- authentication secrets;
- push-notification credentials;
- private user or church data.

## Reporting vulnerabilities

Please avoid opening a public issue for vulnerabilities that could expose credentials, bypass tenant isolation, impersonate users, manipulate moderation, or access another organization's data.

Until a dedicated security contact is published, contact the repository maintainers privately through an appropriate GitHub security-reporting mechanism when available.

## Tenant isolation

Every server-side operation involving organization-owned data must verify organization scope. Client-supplied organization IDs must not be trusted as authorization by themselves.
