# Security Spec for Sonic DNA Console

## 1. Data Invariants

1. **User Favorites Isolation**: A user's favorites path `/users/{userId}/favorites/{favoriteId}` is strictly accessible only by `{userId}`. No registered user should be able to read, write, or query another user's favorites.
2. **Global Caching Read-Only Policy**: Anyone (including unsigned/anonymous users, or clients) can read from `/cached_images/{imageId}`, but writes/updates are forbidden unless authorized or restricted strictly to valid schema entries with verified server timestamps.
3. **No Update Gaps / Integrity on Favorites**: Any update/creation of a favorite map must require validation of fields: name, type, and nodes must contain appropriate types and stay within limits. No injection of malicious states.
4. **Verified Emails**: Standard writes to are restricted to users with verified emails, if authenticating.
5. **No Spoofing**: Users cannot write favorite maps with `userId` mismatching their `request.auth.uid`.

---

## 2. The "Dirty Dozen" Payloads

Here are 12 specific hostile payloads designed to compromise the system and verify rules reject them.

### Favorite Map Spoofer (Identity Spoofing)
1. **Malicious Owner Bypass**: Create/write a favorite for `alice_uid` while signed in as `bob_uid`.
   - Path: `/users/alice_uid/favorites/fav_123`
   - Payload: `{ "userId": "alice_uid", "name": "Fake Map", "type": "song", "createdAt": "request.time", "nodes": [] }`
   - *Expected Outcome*: `PERMISSION_DENIED`

### Favorite State Shortcutting & Immortality Violations
2. **Missing Vital Fields**: Send a favorite with missing nodes or name.
   - Path: `/users/bob_uid/favorites/fav_123`
   - Payload: `{ "userId": "bob_uid", "type": "song", "createdAt": "request.time" }`
   - *Expected Outcome*: `PERMISSION_DENIED`

3. **Wrong Enum/Fields**: Attempt to write coordinate types outside allowed ranges or invalid schema type enums.
   - Path: `/users/bob_uid/favorites/fav_124`
   - Payload: `{ "userId": "bob_uid", "name": "Fake Map", "type": "electro-hyper-vibe", "createdAt": "request.time", "nodes": [] }`
   - *Expected Outcome*: `PERMISSION_DENIED`

4. **Timestamp Manipulation**: Provide a client-forged timestamp for `createdAt` instead of server timestamp `request.time`.
   - Path: `/users/bob_uid/favorites/fav_125`
   - Payload: `{ "userId": "bob_uid", "name": "Fake Map", "type": "song", "createdAt": "2020-01-01T00:00:00Z", "nodes": [] }`
   - *Expected Outcome*: `PERMISSION_DENIED`

5. **Mutable Ownership Attempt**: Attempt to update the `userId` field of an existing favorite card to steal or reassign it.
   - Path: `/users/bob_uid/favorites/fav_123` (representing modification of existing)
   - Payload changes: `{ "userId": "alice_uid" }`
   - *Expected Outcome*: `PERMISSION_DENIED`

### Global Cache Exploit (Resource Poisoning)
6. **Poisoning Global Image Cache**: Attempt to overwrite or delete cached images as an unauthenticated or generic caller.
   - Path: `/cached_images/vandalism`
   - Payload: `{ "imageUrl": "https://malicious.site/phishing.png", "createdAt": "request.time" }`
   - *Expected Outcome*: `PERMISSION_DENIED`

7. **Injecting Arbitrarily Large IDs**: Write an extremely long key as `imageId` to exhaust Firestore and cause a Denial of Wallet.
   - Path: `/cached_images/aaaaa...[10KB long]...aaaa`
   - *Expected Outcome*: `PERMISSION_DENIED` (ID validation blocks lengths > 128 chars)

8. **Overwriting Existing Cache Entry**: Write a malicious string to an existing entry.
   - Path: `/cached_images/valid_id`
   - Payload: `{ "id": "valid_id", "imageUrl": "not-a-valid-url", "createdAt": "request.time" }`
   - *Expected Outcome*: `PERMISSION_DENIED`

### Query Trust Tests
9. **Global Favorites Scraping**: Attempt to query `/users/{userId}/favorites` without supplying a `where` check or accessing a different user's subcollection.
   - Path: `/users/alice_uid/favorites`
   - Action: `CollectionGroup` read or direct listing.
   - *Expected Outcome*: `PERMISSION_DENIED`

10. **Unauthenticated favorites access**: Read a user's personal maps as anonymous or unauthorized user.
    - Path: `/users/bob_uid/favorites/fav_123`
    - Auth: `null`
    - *Expected Outcome*: `PERMISSION_DENIED`

### PII / Privilege Escalation Tests
11. **Admin Escalation Attack**: Attempt to write role document in `/admins` to gain admin privilege.
    - Path: `/admins/attacker_uid`
    - Payload: `{ "role": "super-admin" }`
    - *Expected Outcome*: `PERMISSION_DENIED`

12. **Malicious JSON Array Overflow**: Attacking lists of nodes by injecting high element count containing malformed coordinate matrices.
    - Path: `/users/bob_uid/favorites/fav_128`
    - Payload: `{ "userId": "bob_uid", "name": "Deep Vandal", "type": "song", "createdAt": "request.time", "nodes": [/* large payload exceeding size limits */] }`
    - *Expected Outcome*: `PERMISSION_DENIED`

---

## 3. Test Runner Definition

For unit tests, running a standard test suite with `@firebase/rules-unit-testing` or verifying in real-time is handled through unit tests executing inside standard flat layouts:

```typescript
// firestore.rules.test.ts
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
// Validates all 'Dirty Dozen' test cases to ensure PERMISSION_DENIED on each.
```
