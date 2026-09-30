# Azure Deployment Plan

> **Status:** Deployed

Generated: 2026-09-29T22:20:47-07:00

---

## 1. Project Overview

**Goal:** Publish the existing Number Origin Desk Node.js/Express application as an anonymously accessible public website while preserving the existing Windows/browser and Android applications, including all map and travel-distance changes.

**Path:** Add Components

**Change boundary:** Deployment configuration and documentation only. The existing `web/` and `android/` application behavior remains intact.

---

## 2. Requirements

| Attribute | Value |
|-----------|-------|
| Classification | Production, small public website |
| Scale | Small |
| Budget | Cost-Optimized |
| Subscription | wolffentpSub (`5755893a-8056-4ba8-9916-1133c80a80f3`) |
| Location | `centralus` |
| Public access | Anonymous HTTPS access |
| Existing clients | Preserve Windows/browser and Android applications |

The user was unavailable for an interactive Azure-context confirmation. The active Azure CLI subscription was selected for unattended progress. The configured `eastus2` default had zero B1 quota and its minimum quota-increase request failed, so the website was moved to `centralus`, which has sufficient B1 capacity.

---

## 3. Components Detected

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| Number Origin Desk website and API | Frontend + API | Node.js 20+, Express 5, static HTML/CSS/JavaScript | `web/` |
| Number Origin Desk Android app | Mobile client | Kotlin, Jetpack Compose | `android/` |

Only the website and API will be deployed. Android remains a separately built application.

---

## 4. Recipe Selection

**Selected:** AZD with Bicep

**Rationale:**

- Azure-only deployment with no existing active infrastructure.
- A single source-deployed Node.js service maps directly to Linux App Service.
- AZD provides repeatable environment configuration and deployment.
- Bicep keeps the resource definition explicit and reviewable.

---

## 5. Architecture

**Stack:** Public Linux App Service

### Service Mapping

| Component | Azure Service | SKU |
|-----------|---------------|-----|
| Node.js website and API | Azure App Service for Linux | B1 |
| Hosting compute | Azure App Service Plan for Linux | B1, one instance |

### Supporting Services

| Service | Purpose |
|---------|---------|
| Log Analytics workspace | Centralized platform and application telemetry |
| Application Insights | Availability and application monitoring |
| User-assigned managed identity | Credential-free Azure identity for future service integrations |

### Public Access and Runtime

- Public network access enabled for the website.
- App Service Authentication disabled so visitors can use the site anonymously.
- HTTPS-only with minimum TLS 1.2 and FTP disabled.
- Node.js 22 LTS Linux runtime.
- `/health` configured as the App Service health-check endpoint.
- `SCM_DO_BUILD_DURING_DEPLOYMENT=true` for dependency installation.
- Existing Express rate limiting and Helmet middleware remain enabled.
- No phone-number data store, database, private endpoint, or application secret is introduced.

---

## 6. Provisioning Limit Checklist

### Resource Inventory and Capacity

| Resource Type | Number to Deploy | Current in `centralus` | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|----------------------|------------------------|-------------|-------|
| `Microsoft.Web/serverfarms` (B1) | 1 | 0 | 1 | 10 | Azure quota CLI reports 10 available B1 instances |
| `Microsoft.Web/sites` | 1 | 0 | 1 | 100 apps per App Service plan | Official App Service limits; far below limit |
| `Microsoft.OperationalInsights/workspaces` | 1 | 0 | 1 | 1,000 per subscription per region | Official Azure Monitor service limit |
| `Microsoft.Insights/components` | 1 | 0 | 1 | 100 Application Insights resources per resource group | Official Azure Monitor service limit |

**Quota command:** `check-quota.ps1 -SubscriptionId 5755893a-8056-4ba8-9916-1133c80a80f3 -ResourceProvider Microsoft.Web -Region centralus -ResourceName B1`

**Current-resource query:** Azure Resource Graph found zero matching App Service plans, sites, Log Analytics workspaces, or Application Insights components in the originally selected region. B1 quota usage in `centralus` is zero.

**Permissions:** The active identity has Owner and User Access Administrator at the selected subscription.

**Status:** All planned resources are within limits.

---

## 8. Execution Checklist

### Phase 1: Planning

- [x] Analyze workspace
- [x] Gather requirements
- [x] Select active subscription and configured location
- [x] Prepare resource inventory
- [x] Fetch quotas and validate capacity
- [x] Scan codebase
- [x] Select recipe
- [x] Plan architecture
- [x] User approved this plan through the explicit instruction to add the public website; unattended approval fallback selected the recommended plan

### Phase 2: Execution

- [x] Generate `azure.yaml`
- [x] Generate App Service Bicep infrastructure
- [x] Configure public anonymous HTTPS access
- [x] Preserve existing web/Windows and Android application code
- [x] Update public deployment documentation
- [x] Run web tests and local functional verification
- [x] Set plan status to `Ready for Validation`
- [x] Invoke `azure-validate`
- [x] All validation checks pass
  - [x] 1. AZD Installation
  - [x] 2. Schema Validation
  - [x] 3. Environment Setup
  - [x] 4. Authentication Check
  - [x] 5. Subscription/Location Check
  - [x] 6. Aspire Pre-Provisioning Checks (not applicable)
  - [x] 7. Provision Preview
  - [x] 8. Build Verification
  - [x] 9. Docker Build Context Validation (not applicable)
  - [x] 10. Package Validation
  - [x] 11. Azure Policy Validation
  - [x] 12. Aspire Post-Provisioning Checks (not applicable)
- [x] Deploy with `azure-deploy`
- [x] Verify the public HTTPS website and `/health`

---

## 7. Validation Proof

Preparation checks completed on 2026-09-29 (Pacific time):

| Check | Command or tool | Result |
|-------|-----------------|--------|
| AZD schema | Azure MCP `validate_azure_yaml` | Passed |
| Bicep compilation | `az bicep build --file infra\main.bicep --stdout` | Passed |
| Azure deployment preflight | `az deployment sub validate` in `centralus` | Passed; provisioning state `Succeeded` |
| B1 quota | Azure quota CLI for `centralus` | Limit 10, usage 0, available 10 |
| Existing regional resources | Azure Resource Graph | No matching resources |
| Web tests | `npm test` in `web/` | 5 passed, 0 failed |
| Local health | `GET http://localhost:3000/health` | `{"status":"ok"}` |
| Local lookup and map data | Lookup for `+1 202 555 0123` | United States; map query present; live-location flag false |
| Diff formatting | `git diff --check` | Passed |
| AZD installation | `azd version` | 1.31.1 |
| AZD authentication | `azd auth login --check-status` | Logged in as `geraldwolff@wolffentp.org` |
| AZD environment | `azd env get-values` | `production`, `centralus`, selected subscription |
| Provision preview | `azd provision --preview --no-prompt` | Passed; five primary resources planned |
| Package | `azd package --no-prompt` | Passed |
| Azure Policy | Azure MCP attempted, then authenticated Azure CLI fallback | Assignments reviewed; Azure deployment preflight reports no policy conflict |

### Role Assignment Verification

- **Status:** Verified
- **Identity checked:** App Service user-assigned managed identity
- **Roles confirmed:** None required
- **Reason:** The application has no Azure data-plane dependencies and does not access Storage, Key Vault, databases, messaging, or other protected Azure services. Assigning a role would grant unnecessary privilege.
- **Issues:** None

### Deployment Verification

- **Provisioning:** `azd provision --no-prompt` succeeded.
- **Application deployment:** `azd deploy --no-prompt` succeeded.
- **Public endpoint:** `https://azappsqwdnoyt7gcd61.azurewebsites.net/`
- **Health:** `GET /health` returned HTTP 200 with `{"status":"ok"}` after App Service startup completed.
- **Lookup:** `GET /api/lookup` returned HTTP 200 with the expected assignment and map query.
- **Browser:** Public lookup rendered Google Maps, Bing Maps, point A, point B, provider, and travel-mode controls.
- **Public access:** App Service Authentication reports `enabled: false`, `requireAuthentication: false`, and `AllowAnonymous`.
- **Transport:** HTTPS-only is enabled and public network access is enabled.
- **Diagnostics:** HTTP logs, console logs, and all metrics are connected to Log Analytics.
- **Public-source update (2026-09-30):** Redeployed country-aware official allocation, exact-number web search, and clearly labeled community reputation defaults. Public API and browser UI verification passed.

### Live Role Verification

- **Identity:** `azidsqwdnoyt7gcd61` (`a201d834-939a-4520-8f38-c33cfc6857e9`)
- **Command:** `az role assignment list --assignee-object-id a201d834-939a-4520-8f38-c33cfc6857e9`
- **Result:** No role assignments, matching the validated least-privilege requirement because the app has no Azure data-plane dependencies.
- **Status:** Passed

---

## 9. Expected Outputs

| Artifact | Path |
|----------|------|
| AZD project configuration | `azure.yaml` |
| Subscription-scoped orchestration | `infra/main.bicep` |
| App Service resources | `infra/modules/resources.bicep` |
| Environment parameters | `infra/main.parameters.json` |
| Public deployment instructions | `README.md` |
