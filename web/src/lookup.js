import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import countries from "world-countries";

const DISCLAIMER =
  "Numbering-plan assignment only. Not a live caller, device, or network location. Caller ID may be spoofed.";
const METADATA_SOURCE = "https://github.com/catamphetamine/libphonenumber-js";
const COUNTRY_SOURCE = "https://github.com/mledoze/countries";
const ITU_E164_SOURCE = "https://www.itu.int/pub/T-SP-E.164D";
const NANPA_AREA_CODE_SOURCE = "https://secure.nanpa.com/public-report/npa/search-area-codes";
const NANPA_ASSIGNMENT_SOURCE = "https://www.nanpa.com/reports/co-code-reports/cocodes_assign";
const LOCAL_CALLING_GUIDE_SOURCE = "https://localcallingguide.com/lca_prefix.php";
const COUNTRY_BY_CODE = new Map(countries.map((country) => [country.cca2, country]));

function source(title, url, category, summary) {
  return { title, url, category, summary };
}

function textFromHtml(value) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function tableCell(html, header) {
  const match = html.match(new RegExp(`<td\\s+headers="${header}"[^>]*>([\\s\\S]*?)<\\/td>`, "i"));
  return match ? textFromHtml(match[1]) : null;
}

async function discoverNanpPrefix(phone, fetchImpl, retrievedAtUtc) {
  if (phone.countryCallingCode !== "1" || phone.nationalNumber.length !== 10) return null;

  const areaCode = phone.nationalNumber.slice(0, 3);
  const exchange = phone.nationalNumber.slice(3, 6);
  const url = `${LOCAL_CALLING_GUIDE_SOURCE}?npa=${areaCode}&nxx=${exchange}`;

  try {
    const response = await fetchImpl(url, {
      headers: { accept: "text/html", "user-agent": "NumberOriginDesk/1.0" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const prefix = tableCell(html, "npanxx")?.match(/\b\d{3}-\d{3}\b/)?.[0] ?? null;
    const rateCenter = tableCell(html, "exchange");
    const region = tableCell(html, "oregion");
    const originalAssignee = tableCell(html, "oocn")?.replace(/^\d+\s+/, "") ?? null;
    if (!prefix || !rateCenter || !region) throw new Error("Expected prefix fields were absent");

    return {
      status: "discovered",
      source: { title: "Local Calling Guide", url, retrievedAtUtc },
      fields: { prefix, rateCenter, region, originalAssignee },
      summary: `${prefix} is listed in the ${rateCenter}, ${region} rate center${originalAssignee ? ` with original assignee ${originalAssignee}` : ""}.`,
      limitation:
        "Scraped public assignment data. It does not identify the subscriber, current carrier, or device location.",
    };
  } catch (error) {
    return {
      status: "unavailable",
      source: { title: "Local Calling Guide", url, retrievedAtUtc },
      fields: null,
      summary: `The public prefix record could not be retrieved during this lookup (${error.message}).`,
      limitation: "Use the source link to inspect the record directly.",
    };
  }
}

function createEvidenceResults(searches, prefixEvidence, phone) {
  const digits = phone.number.replace(/\D/g, "");
  const areaCode = phone.countryCallingCode === "1" ? phone.nationalNumber.slice(0, 3) : null;
  const exchange = areaCode ? phone.nationalNumber.slice(3, 6) : null;
  const formattedNanp = areaCode
    ? `1-${areaCode}-${exchange}-${phone.nationalNumber.slice(6)}`
    : null;
  const requirements = {
    "ITU E.164 assigned country codes": {
      requiredInput: "Country calling code",
      inputValue: `+${phone.countryCallingCode}`,
      accessMethod: "Static official reference; no exact-number form.",
    },
    "NANPA area-code search": {
      requiredInput: "3-digit NPA (area code)",
      inputValue: areaCode,
      accessMethod: "Official interactive area-code form.",
    },
    "NANPA NPA-NXX assignment reports": {
      requiredInput: "3-digit NPA and 3-digit NXX",
      inputValue: areaCode && exchange ? `${areaCode}-${exchange}` : null,
      accessMethod: "Official assignment report search/download.",
    },
    "DuckDuckGo exact-number search": {
      requiredInput: "Full E.164 number as a quoted search query",
      inputValue: `"${phone.number}" phone`,
      accessMethod: "Prefilled public search link; manual review.",
    },
    "Should I Answer? community reports": {
      requiredInput: "Full digits-only international number",
      inputValue: digits,
      accessMethod: "Prefilled public number page; manual review.",
    },
    "Tellows community reports": {
      requiredInput: "Full E.164 number",
      inputValue: phone.number,
      accessMethod: "Prefilled public page; licensed Tellows API required for automation.",
    },
    "800notes community reports": {
      requiredInput: "Full NANP number",
      inputValue: formattedNanp,
      accessMethod: "Prefilled public number page; manual review.",
    },
    "YouMail public directory": {
      requiredInput: "10-digit US national number",
      inputValue: phone.nationalNumber,
      accessMethod: "Prefilled public directory page; manual review.",
    },
    "File an FCC complaint": {
      requiredInput: "Complaint category, incident details, and contact information",
      inputValue: "Not predicted; the reporter must provide accurate incident facts.",
      accessMethod: "Reporting form, not a number-search source.",
    },
    "Report fraud to the FTC": {
      requiredInput: "Incident, loss, suspect, and reporter details",
      inputValue: "Not predicted; the reporter must provide accurate incident facts.",
      accessMethod: "Reporting form, not a number-search source.",
    },
    "Ofcom numbering allocation data": {
      requiredInput: "UK number range or prefix",
      inputValue: phone.nationalNumber,
      accessMethod: "Official downloadable allocation datasets.",
    },
    "Australian Numbering System": {
      requiredInput: "Australian number or number range",
      inputValue: phone.nationalNumber,
      accessMethod: "Official public allocation register.",
    },
    "New Zealand number register": {
      requiredInput: "New Zealand number prefix or allocation",
      inputValue: phone.nationalNumber,
      accessMethod: "Official public number register.",
    },
  };

  return searches.map((search) => {
    const form = search.title.startsWith("Local Calling Guide")
      ? {
          requiredInput: "3-digit NPA and 3-digit NXX",
          inputValue: areaCode && exchange ? `NPA ${areaCode}; NXX ${exchange}` : null,
          accessMethod: "Prefilled public GET form; prefix result retrieved automatically.",
        }
      : search.title.startsWith("Canadian NPA")
        ? {
            requiredInput: "3-digit Canadian NPA",
            inputValue: areaCode,
            accessMethod: "Public NPA assignment table; inspect the NXX row.",
          }
        : requirements[search.title];

    if (search.url.startsWith(LOCAL_CALLING_GUIDE_SOURCE)) {
      return {
        title: search.title,
        category: search.category,
        ...form,
        ...prefixEvidence,
      };
    }

    if (search.category === "community" || search.title === "DuckDuckGo exact-number search") {
      return {
        title: search.title,
        category: search.category,
        ...form,
        status: "manual-review",
        source: { title: search.title, url: search.url },
        fields: null,
        summary:
          "Not fetched automatically because doing so would transmit the complete phone number to a third party. Open the source to run this exact-number search.",
        limitation: search.summary,
      };
    }

    return {
      title: search.title,
      category: search.category,
      ...form,
      status: "reference",
      source: { title: search.title, url: search.url },
      fields: null,
      summary: "Reference or reporting resource; it does not provide an automated exact-number result.",
      limitation: search.summary,
    };
  });
}

function createInvestigation(phone) {
  const digits = phone.number.replace(/\D/g, "");
  const exactNumberQuery = encodeURIComponent(`"${phone.number}" phone`);
  const areaCode = phone.countryCallingCode === "1" ? phone.nationalNumber.slice(0, 3) : null;
  const exchange = areaCode ? phone.nationalNumber.slice(3, 6) : null;
  const nanpNumber = areaCode
    ? `1-${areaCode}-${phone.nationalNumber.slice(3, 6)}-${phone.nationalNumber.slice(6)}`
    : null;
  const searches = [
    source(
      "ITU E.164 assigned country codes",
      ITU_E164_SOURCE,
      "official",
      "Authoritative country-calling-code assignment; not a live location or subscriber record.",
    ),
  ];

  if (areaCode) {
    searches.push(
      source(
        "NANPA area-code search",
        NANPA_AREA_CODE_SOURCE,
        "official",
        "Official North American area-code assignment and status data.",
      ),
    );
    if (phone.country === "CA") {
      searches.push(
        source(
          `Canadian NPA ${areaCode} prefix assignments`,
          `https://cnac.ca/data/COCodeStatus_NPA${areaCode}.htm`,
          "official",
          "Canadian Numbering Administrator block assignee and rate-center data; portability may change the current carrier.",
        ),
      );
    } else {
      searches.push(
        source(
          "NANPA NPA-NXX assignment reports",
          NANPA_ASSIGNMENT_SOURCE,
          "official",
          "Original prefix assignee and rate-center data; portability may change the current carrier.",
        ),
      );
    }
    searches.push(
      source(
        `Local Calling Guide ${areaCode}-${exchange} prefix lookup`,
        `https://localcallingguide.com/lca_prefix.php?npa=${areaCode}&nxx=${exchange}`,
        "web",
        "Public NPA-NXX rate-center and original assignee data; not a subscriber or live-device location.",
      ),
    );
  } else {
    const nationalAuthority = {
      GB: source(
        "Ofcom numbering allocation data",
        "https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbering-data",
        "official",
        "UK regulator datasets showing number-range allocations.",
      ),
      AU: source(
        "Australian Numbering System",
        "https://www.thenumberingsystem.com.au/",
        "official",
        "Public Australian number-allocation register.",
      ),
      NZ: source(
        "New Zealand number register",
        "https://www.nad.org.nz/number-register",
        "official",
        "Public New Zealand number-allocation register.",
      ),
    }[phone.country];
    if (nationalAuthority) searches.push(nationalAuthority);
  }

  searches.push(
    source(
      "DuckDuckGo exact-number search",
      `https://duckduckgo.com/?q=${exactNumberQuery}`,
      "web",
      "Finds public business pages, notices, and discussions. Search results are not verified evidence.",
    ),
    source(
      "Should I Answer? community reports",
      `https://www.shouldianswer.com/phone-number/${digits}`,
      "community",
      "User-contributed reputation reports that may be stale, mistaken, or affected by spoofing.",
    ),
    source(
      "Tellows community reports",
      `https://www.tellows.com/num/${encodeURIComponent(phone.number)}`,
      "community",
      "International user-contributed reputation reports; opens externally and is not queried by this app.",
    ),
  );

  if (nanpNumber) {
    searches.push(
      source(
        "800notes community reports",
        `https://800notes.com/Phone.aspx/${nanpNumber}`,
        "community",
        "North American user discussions; reports do not establish caller identity.",
      ),
    );
    if (phone.country === "US") {
      const usNumber = `${areaCode}-${phone.nationalNumber.slice(3, 6)}-${phone.nationalNumber.slice(6)}`;
      searches.push(
        source(
          "YouMail public directory",
          `https://directory.youmail.com/phone/${usNumber}`,
          "community",
          "US-oriented caller and spam reputation data; ownership and caller ID can change or be spoofed.",
        ),
      );
    }
  }

  if (phone.country === "US") {
    searches.push(
      source(
        "File an FCC complaint",
        "https://consumercomplaints.fcc.gov/hc/en-us",
        "reporting",
        "Official US communications complaint portal.",
      ),
      source(
        "Report fraud to the FTC",
        "https://reportfraud.ftc.gov/",
        "reporting",
        "Official US fraud reporting portal.",
      ),
    );
  }

  return {
    authenticity: {
      status: "unverified",
      summary: "Number validity and numbering assignment do not verify the identity or network origin of the caller.",
      indicators: [
        "Caller ID can be spoofed even when the displayed number is valid.",
        "Only the originating and terminating providers can perform an authoritative call traceback.",
        "STIR/SHAKEN attestation, when exposed by a provider, is stronger evidence than caller ID but is not proof of identity.",
      ],
    },
    publicSearches: searches,
  };
}

export class LookupError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "LookupError";
    this.status = status;
  }
}

export function createLookupService({ now = () => new Date(), fetchImpl = globalThis.fetch } = {}) {
  return async function lookup(rawNumber) {
    const input = typeof rawNumber === "string" ? rawNumber.trim() : "";
    if (!input || input.length > 64) {
      throw new LookupError("Enter a phone number in international format, such as +1 202 555 0123.");
    }

    const phone = parsePhoneNumberFromString(input);
    if (!phone?.isValid()) {
      throw new LookupError("The phone number is not valid. Include the country calling code.");
    }

    const retrievedAtUtc = now().toISOString();
    const country = COUNTRY_BY_CODE.get(phone.country) ?? null;
    const areaCode = phone.countryCallingCode === "1" ? phone.nationalNumber.slice(0, 3) : null;
    const region = country?.name?.common ?? phone.country ?? "Unknown";
    const investigation = createInvestigation(phone);
    investigation.discoveredEvidence = await discoverNanpPrefix(phone, fetchImpl, retrievedAtUtc);
    investigation.evidenceResults = createEvidenceResults(
      investigation.publicSearches,
      investigation.discoveredEvidence,
      phone,
    );

    return {
      input: phone.number,
      formattedInternational: phone.formatInternational(),
      callingCode: `+${phone.countryCallingCode}`,
      countryCode: phone.country ?? null,
      region,
      numberType: phone.getType() ?? "UNKNOWN",
      numberingAssignment: {
        area: country?.name?.common ?? phone.country ?? "Non-geographic numbering plan",
        areaCode,
        basis: areaCode
          ? "NANP area code and country calling-code metadata"
          : phone.country ? "country calling-code metadata" : "non-geographic calling-code metadata",
        tracksCurrentLocation: false,
      },
      mapLocation: country
        ? {
            label: areaCode ? `Area code ${areaCode}, ${region}` : region,
            query: areaCode ? `${areaCode} area code, ${region}` : region,
            scope: "numbering-assignment",
          }
        : null,
      disclaimer: DISCLAIMER,
      investigation,
      sources: [
        { title: "libphonenumber-js metadata", url: METADATA_SOURCE, retrievedAtUtc },
        ...(country
          ? [{ title: "Countries dataset", url: COUNTRY_SOURCE, retrievedAtUtc }]
          : []),
      ],
    };
  };
}