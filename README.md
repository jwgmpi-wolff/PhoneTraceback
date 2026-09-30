# Number Origin Desk

Number Origin Desk is a privacy-preserving Android and web application for validating a phone number and showing general numbering-assignment metadata. It does not locate a caller, device, subscriber, or network route.

## Safety boundary

The application intentionally does not perform real-time tracking, subscriber deanonymization, carrier traceback, SS7/SIGTRAN tracing, or covert location discovery. Phone numbers can be spoofed, reassigned, ported, or used outside their assigned region. Every successful result includes this warning:

> Numbering-plan assignment only. Not a live caller, device, or network location. Caller ID may be spoofed.

For North American Numbering Plan numbers, the app can display the three-digit area code as assignment metadata. Area codes can be ported, reassigned, used remotely, or spoofed and must not be interpreted as the call's physical origin.

After a successful lookup, the web and Android apps can open the assigned country or NANP area-code query in Google Maps or Bing Maps. This is a public-map search for the numbering assignment, not a pin for the caller or device. A route builder also accepts point A, point B, a map provider, and a travel mode; the selected public map service opens the route and displays its current travel distance. No map API key or location data is stored by this application.

The server does not persist submitted phone numbers. Production operators should still treat application and proxy logs as potentially sensitive and configure retention accordingly.

The Android app operates independently of the web application, Azure, and USB. Number parsing, assignment inspection, call-history matching, saving, and export all happen on the device. The optional Scam Phone report check sends the selected ten-digit NANP number to ReportedCalls.com only after the user selects **ReportedCalls public report**. The number is held in transient action state and cleared when that request finishes. A successful result is written to app-private storage only if the user subsequently selects **Save investigation and scam report**. It can optionally inspect matching entries in the device call history after an explicit runtime permission prompt. Call-log access is restricted by Google Play policy, so public distribution may require removing this feature or qualifying for an allowed use.

Investigations are saved only when the user selects the save action. Reports use structured JSON in app-private storage with Android backup disabled. Saved Scam Phone data includes the public summary, assignment, source URL, and retrieval time. The saved-investigations section exports a readable PDF through Android's document picker for later analysis or submission to a provider or regulator. Exports contain phone numbers and call metadata and should be handled as sensitive data.

## Project layout

- `web/`: Node.js/Express API and browser client.
- `android/`: standalone Kotlin/Jetpack Compose Android application.
- `infra/`: private Azure App Service infrastructure and deployment automation.

## Install

The simplest option on every platform is the public HTTPS application:

<https://azappsqwdnoyt7gcd61.azurewebsites.net/>

It is an installable progressive web app and receives web updates automatically.

### Android

1. Open the public site in Chrome.
2. Open the Chrome menu and select **Install app** or **Add to Home screen**.
3. Confirm **Install**.

For the native Android project, install Android Studio with JDK 17 and Android SDK 35, open `android/`, and select **Run**. From a terminal, build a development APK with:

```powershell
cd android
.\gradlew.bat assembleDebug
```

The APK is created at `android/app/build/outputs/apk/debug/NumberOriginDesk.apk`. Transfer it to an Android device, allow installation from the selected file manager, and open the APK to install it.

### Windows

1. Open the public site in Microsoft Edge or Google Chrome.
2. In Edge, select **Settings and more > Apps > Install Number Origin Desk**. In Chrome, select the install icon in the address bar.
3. Launch **Number Origin Desk** from the Start menu.

To run a local copy, install Node.js 20 or newer and use:

```powershell
git clone https://github.com/jwgmpi-wolff/PhoneTraceback.git
cd PhoneTraceback\web
npm ci
npm start
```

Open <http://localhost:3000>.

### Linux

1. Open the public site in Chrome or Chromium.
2. Select the install icon in the address bar, or open the browser menu and select **Install Number Origin Desk**.
3. Launch it from the desktop application menu.

To run a local copy, install Git and Node.js 20 or newer:

```bash
git clone https://github.com/jwgmpi-wolff/PhoneTraceback.git
cd PhoneTraceback/web
npm ci
npm start
```

Open <http://localhost:3000>.

## Data sources

- [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js) parses and validates international numbers from numbering-plan metadata.
- [Countries](https://github.com/mledoze/countries), bundled through `world-countries`, supplies versioned country display names without an outbound lookup.
- [ITU E.164](https://www.itu.int/pub/T-SP-E.164D) is the authoritative international country-calling-code assignment reference.
- [NANPA](https://secure.nanpa.com/public-report/npa/search-area-codes) and the [Canadian Numbering Administrator](https://cnac.ca/co_codes/co_code_status.htm) provide public North American area-code and prefix-assignment records.
- [Local Calling Guide](https://localcallingguide.com/) provides direct public NPA-NXX rate-center and original-assignee lookups for North American numbers. These records describe numbering assignments, not a subscriber or device location.
- Curated national allocation registers are linked for the [United Kingdom](https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbering-data), [Australia](https://www.thenumberingsystem.com.au/), and [New Zealand](https://www.nad.org.nz/number-register).

Each API result reports its source URLs and UTC retrieval time. Non-geographic numbering plans return validated metadata without inferred location.

The investigation section defaults to official allocation records, a direct Local Calling Guide NPA-NXX lookup for North American numbers, quoted-number searches on DuckDuckGo, Google, and Bing, and outbound community-report links from Should I Answer?, Tellows, and—where applicable—800notes and YouMail. Google and Bing use an exact-number `phone owner business` query to find possible public owner or business references; a search match does not verify current ownership or caller identity. Android also retains its optional in-app ReportedCalls.com summary. Apart from the documented prefix-only Local Calling Guide retrieval, the application does not proxy, scrape, cache, or represent outbound community content as its own determination. Assignment records generally show the original block assignee rather than the current carrier of a ported number. Community results are allegations and may be stale, mistaken, malicious, or caused by caller-ID spoofing. These results do not provide a live caller location, subscriber identity, or authoritative traceback.

For NANP numbers, the web application retrieves the public Local Calling Guide page using only the six-digit NPA-NXX prefix and displays its rate center, region, and original assignee in the **Evidence boundary**. The full phone number is not sent to that source. The boundary enumerates every configured source, its required form input, the value derived from the inspected number, and its access method: safely retrieved prefix evidence is labeled `discovered`, static allocation and reporting resources are labeled `reference`, and directories that require the complete phone number are labeled `manual review` with prefilled direct search links. The **Open all exact-number searches** action lets the user explicitly send the number to all listed manual-review sources in separate tabs; browsers may require pop-up permission. The app does not silently transmit a complete phone number to those third parties. Tellows automation requires its licensed API; FCC and FTC destinations are reporting forms rather than number-search sources, and incident facts are never fabricated or predicted. Retrieval failures are shown as unavailable evidence rather than successful findings.

## Run the web app

Requirements: Node.js 20 or newer.

```powershell
cd web
npm install
npm test
npm start
```

Open <http://localhost:3000>. The health endpoint is <http://localhost:3000/health>.

Example API request:

```text
GET /api/lookup?number=%2B1%20202%20555%200123
```

The endpoint accepts international-format numbers only, limits requests per IP, and does not return subscriber or live-location data.

## Run the Android app

Open `android/` in Android Studio with JDK 17 and Android SDK 35 installed, then build and install the application. The installed app does not require the web server, Azure deployment, USB connection, ADB tunnel, account, or network access for number inspection and local reporting.

The public source links and in-app Scam Phone report check require network access after the user selects them. Scam Phone report checks currently support ten-digit North American Numbering Plan numbers. Build a signed release in Android Studio for distribution.

## Validation

Validate the web application with `npm test` from `web/`. Validate Android with `./gradlew testDebugUnitTest assembleDebug --no-daemon` on Linux/macOS or `.\gradlew.bat testDebugUnitTest assembleDebug --no-daemon` on Windows.

## Deploy the web app to Azure

The website can be deployed as a publicly accessible, anonymous Azure App Service. This does not alter the Android app or local Windows/browser workflow.

Requirements: Azure CLI, Azure Developer CLI, an active `az login` session, and permission to create resource groups, App Service resources, managed identities, Log Analytics, and Application Insights.

```powershell
az login
az account set --subscription <subscription-id>

azd auth login
azd env new production --no-prompt
azd env set AZURE_SUBSCRIPTION_ID <subscription-id>
azd env set AZURE_LOCATION centralus
azd up --no-prompt
```

The deployment creates a B1 Linux App Service plan, a public HTTPS web app, a user-assigned managed identity, Log Analytics, and Application Insights. App Service Authentication is explicitly disabled so the public can use the site without signing in. The existing Express rate limit, security headers, privacy warnings, map links, and travel-distance workflow remain active.

After deployment, retrieve the public endpoint:

```powershell
azd env get-value WEB_URL
```

The default B1 plan incurs Azure charges. Delete the resource group when it is no longer needed:

```powershell
azd down --purge --force
```

## Production notes

- Review Application Insights and Log Analytics retention and ingestion costs.
- Add a custom domain and App Service managed certificate if a branded URL is required.
- Keep application and platform dependencies patched.
- Do not market or display results as caller location, ownership, identity, or traceback evidence.