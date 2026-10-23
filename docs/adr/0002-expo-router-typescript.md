# ADR-0002 — Expo Router + TypeScript

**Context.** Learners are mostly on Android phones; judges use laptops. Small team.

**Decision.** Expo (current stable SDK) with Expo Router and TypeScript strict. One
codebase for Android, web and iOS. Libraries: `@tanstack/react-query` (server state),
`zod` (validation), `expo-secure-store` (session), `expo-font` + one font package.
Dev: eslint, prettier, openapi-typescript. No separate state-management library.

**Shipped for judging:** Android APK and web. iOS stays buildable from the same code but
is not built or published (no Apple developer account).

**Consequences.** Web build exported to S3/CloudFront; Android APK through EAS (build
early, queues are slow). Expo/React Native specifics are not in the library; use the Expo
documentation.
