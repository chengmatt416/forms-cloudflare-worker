# Notice and Modification Disclaimers

This project is a modified version and fork of [HeyForm](https://github.com/heyform/heyform), originally created and copyrighted by HeyForm Inc. and upstream contributors under the GNU Affero General Public License v3.0 (AGPL-3.0).

---

## License Attribution
This software is licensed under the **GNU Affero General Public License v3.0** (GNU AGPLv3).
A complete copy of the license is included in the [LICENSE](./LICENSE) file.

---

## Modifications and Attribution (AGPL-3.0 Section 5 & 13)

- **Date of Modification**: September 2026
- **Fork Maintainer**: chengmatt416
- **Public Source Code Repository**: [https://github.com/chengmatt416/forms-cloudflare-worker](https://github.com/chengmatt416/forms-cloudflare-worker)

### Key Architectural & Feature Modifications:
1. **Serverless Edge Architecture (Cloudflare Workers & D1)**:
   - Created the `@heyform/worker` package (`packages/worker/`) providing a native, zero-container serverless runtime.
   - Replaced MongoDB and Redis dependencies with Cloudflare D1 (edge SQLite) and optional Cloudflare R2 object storage.
   - Built a lightweight GraphQL API executor using `graphql-js` directly at the edge, serving both application queries and public respondent form endpoints.
   - Integrated Cloudflare Workers Static Assets binding (`packages/webapp/dist`) to deliver the single-page React application globally with zero origin servers.

2. **Access Control & Activation Code Registration**:
   - Replaced third-party social logins and unverified public registrations with an admin-managed activation code system (`HEY-XXXXXXXX`).
   - Registration requires a valid, unused activation code.
   - Implemented admin capabilities (`pinyencheng@gmail.com`) to generate, query, and revoke activation codes directly from the workspace UI and API.
   - Streamlined authentication by removing mandatory external SMTP email verification.

3. **Unlimited Quotas & Resource Allocation**:
   - Configured all workspaces with unlimited submission quotas, storage quotas, and team member seats without commercial restrictions or paywalls.

4. **Trademark Removal (AGPL-3.0 Section 7(e))**:
   - In accordance with Section 7(e) of the GNU AGPLv3 and trademark compliance principles, proprietary HeyForm commercial trademarks and "Made with HeyForm" badges have been removed from user-facing form templates and web applications to prevent confusion with upstream commercial services.
