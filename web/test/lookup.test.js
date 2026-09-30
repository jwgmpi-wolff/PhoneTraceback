import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createLookupService } from "../src/lookup.js";
import { buildDirectionsUrl, buildMapSearchUrl } from "../public/maps.js";

const fixedNow = () => new Date("2026-07-28T12:00:00.000Z");
const prefixHtml = `
  <table><tbody><tr>
    <td headers="npanxx"><a>202-555</a> A</td>
    <td headers="exchange"><a>Washington Zone 1</a></td>
    <td headers="oregion"><a>DC</a></td>
    <td headers="oocn"><a>9999 EXAMPLE TELECOM, LLC</a></td>
  </tr></tbody></table>`;
const fetchPrefix = async () => ({ ok: true, status: 200, text: async () => prefixHtml });
const lookupService = (options = {}) =>
  createLookupService({ now: fixedNow, fetchImpl: fetchPrefix, ...options });

test("returns sourced numbering assignment without inferred coordinates", async () => {
  const app = createApp({ lookup: lookupService() });

  const response = await request(app).get("/api/lookup").query({ number: "+1 202 555 0123" });

  assert.equal(response.status, 200);
  assert.equal(response.body.countryCode, "US");
  assert.equal(response.body.region, "United States");
  assert.equal(response.body.numberingAssignment.area, "United States");
  assert.equal(response.body.numberingAssignment.areaCode, "202");
  assert.equal(response.body.numberingAssignment.tracksCurrentLocation, false);
  assert.deepEqual(response.body.mapLocation, {
    label: "Area code 202, United States",
    query: "202 area code, United States",
    scope: "numbering-assignment",
  });
  assert.equal("approximateCoordinates" in response.body, false);
  assert.doesNotMatch(JSON.stringify(response.body), /latitude|longitude|approximateCoordinates/);
  assert.match(response.body.disclaimer, /Not a live caller, device, or network location/);
  assert.equal(response.body.investigation.authenticity.status, "unverified");
  assert.match(response.body.investigation.authenticity.summary, /do not verify/);
  assert.deepEqual(response.body.investigation.discoveredEvidence.fields, {
    prefix: "202-555",
    rateCenter: "Washington Zone 1",
    region: "DC",
    originalAssignee: "EXAMPLE TELECOM, LLC",
  });
  assert.match(response.body.investigation.discoveredEvidence.summary, /Washington Zone 1, DC/);
  const searches = response.body.investigation.publicSearches;
  assert.equal(searches.length, 13);
  assert.deepEqual(
    searches.map(({ title, category }) => ({ title, category })),
    [
      { title: "ITU E.164 assigned country codes", category: "official" },
      { title: "NANPA area-code search", category: "official" },
      { title: "NANPA NPA-NXX assignment reports", category: "official" },
      { title: "Local Calling Guide 202-555 prefix lookup", category: "web" },
      { title: "DuckDuckGo exact-number search", category: "web" },
      { title: "Google possible-owner search", category: "web" },
      { title: "Bing possible-owner search", category: "web" },
      { title: "Should I Answer? community reports", category: "community" },
      { title: "Tellows community reports", category: "community" },
      { title: "800notes community reports", category: "community" },
      { title: "YouMail public directory", category: "community" },
      { title: "File an FCC complaint", category: "reporting" },
      { title: "Report fraud to the FTC", category: "reporting" },
    ],
  );
  assert.equal(
    searches[3].url,
    "https://localcallingguide.com/lca_prefix.php?npa=202&nxx=555",
  );
  assert.match(searches[4].url, /duckduckgo\.com\/\?q=%22%2B12025550123%22%20phone/);
  assert.equal(
    searches[5].url,
    "https://www.google.com/search?q=%22%2B12025550123%22%20phone%20owner%20business",
  );
  assert.equal(
    searches[6].url,
    "https://www.bing.com/search?q=%22%2B12025550123%22%20phone%20owner%20business",
  );
  assert.equal(searches[7].url, "https://www.shouldianswer.com/phone-number/12025550123");
  assert.equal(searches[9].url, "https://800notes.com/Phone.aspx/1-202-555-0123");
  assert.equal(searches[10].url, "https://directory.youmail.com/phone/202-555-0123");
  assert.equal(response.body.sources.length, 2);
  assert.equal(response.body.sources[0].retrievedAtUtc, "2026-07-28T12:00:00.000Z");
  const evidence = response.body.investigation.evidenceResults;
  assert.equal(evidence.length, searches.length);
  assert.equal(
    evidence.find(({ title }) => title.startsWith("Local Calling Guide")).status,
    "discovered",
  );
  assert.equal(
    evidence.find(({ title }) => title === "Should I Answer? community reports").status,
    "manual-review",
  );
  assert.equal(
    evidence.find(({ title }) => title === "Should I Answer? community reports").requiredInput,
    "Full digits-only international number",
  );
  assert.equal(
    evidence.find(({ title }) => title === "Should I Answer? community reports").inputValue,
    "12025550123",
  );
  assert.equal(
    evidence.find(({ title }) => title === "NANPA NPA-NXX assignment reports").inputValue,
    "202-555",
  );
  assert.equal(
    evidence.find(({ title }) => title === "DuckDuckGo exact-number search").inputValue,
    "\"+12025550123\" phone",
  );
  assert.equal(
    evidence.find(({ title }) => title === "Google possible-owner search").inputValue,
    "\"+12025550123\" phone owner business",
  );
  assert.match(
    evidence.find(({ title }) => title === "Tellows community reports").accessMethod,
    /licensed Tellows API/,
  );
  assert.equal(
    evidence.find(({ title }) => title === "ITU E.164 assigned country codes").status,
    "reference",
  );
});

test("uses Canadian numbering authority for Canadian NANP numbers", async () => {
  const response = await request(createApp({ lookup: lookupService() }))
    .get("/api/lookup")
    .query({ number: "+1 416 555 0123" });

  assert.equal(response.status, 200);
  assert.equal(response.body.countryCode, "CA");
  assert.equal(
    response.body.investigation.publicSearches[2].url,
    "https://cnac.ca/data/COCodeStatus_NPA416.htm",
  );
  assert.equal(
    response.body.investigation.publicSearches[3].url,
    "https://localcallingguide.com/lca_prefix.php?npa=416&nxx=555",
  );
  assert.equal(
    response.body.investigation.publicSearches.some(({ title }) => title === "YouMail public directory"),
    false,
  );
  assert.equal(
    response.body.investigation.publicSearches.some(({ category }) => category === "reporting"),
    false,
  );
});

test("uses national allocation source when one is curated", async () => {
  const response = await request(createApp({ lookup: lookupService() }))
    .get("/api/lookup")
    .query({ number: "+44 20 7946 0958" });

  assert.equal(response.status, 200);
  assert.equal(response.body.countryCode, "GB");
  assert.equal(
    response.body.investigation.publicSearches[1].url,
    "https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbering-data",
  );
  assert.equal(
    response.body.investigation.publicSearches.some(({ title }) => title.includes("800notes")),
    false,
  );
  assert.equal(
    response.body.investigation.publicSearches.some(({ category }) => category === "reporting"),
    false,
  );
});

test("rejects invalid numbers", async () => {
  const lookup = createLookupService();

  const response = await request(createApp({ lookup })).get("/api/lookup").query({ number: "123" });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /not valid/);
});

test("surfaces prefix source retrieval failures without failing the lookup", async () => {
  let requestedUrl;
  const lookup = lookupService({
    fetchImpl: async (url) => {
      requestedUrl = url;
      return { ok: false, status: 503 };
    },
  });

  const response = await request(createApp({ lookup }))
    .get("/api/lookup")
    .query({ number: "+1 206 619 9985" });

  assert.equal(response.status, 200);
  assert.equal(requestedUrl, "https://localcallingguide.com/lca_prefix.php?npa=206&nxx=619");
  assert.equal(response.body.investigation.discoveredEvidence.status, "unavailable");
  assert.equal(response.body.investigation.discoveredEvidence.fields, null);
  assert.match(response.body.investigation.discoveredEvidence.summary, /could not be retrieved/);
});

test("supports non-geographic numbering plans without inferred coordinates", async () => {
  const lookup = lookupService();

  const response = await request(createApp({ lookup }))
    .get("/api/lookup")
    .query({ number: "+800 1234 5678" });

  assert.equal(response.status, 200);
  assert.equal(response.body.countryCode, null);
  assert.equal(response.body.numberingAssignment.area, "Non-geographic numbering plan");
  assert.equal(response.body.numberingAssignment.tracksCurrentLocation, false);
  assert.equal(response.body.mapLocation, null);
  assert.equal(response.body.investigation.discoveredEvidence, null);
  assert.equal("approximateCoordinates" in response.body, false);
  assert.equal(response.body.sources.length, 1);
});

test("builds public map and point-to-point route URLs", () => {
  assert.equal(
    buildMapSearchUrl("google", "202 area code, United States"),
    "https://www.google.com/maps/search/?api=1&query=202%20area%20code%2C%20United%20States",
  );
  assert.equal(
    buildDirectionsUrl("bing", "Washington, DC", "Baltimore, MD", "driving"),
    "https://www.bing.com/maps?rtp=adr.Washington%2C%20DC~adr.Baltimore%2C%20MD&mode=D",
  );
});

test("requires both route endpoints", () => {
  assert.throws(
    () => buildDirectionsUrl("google", "Washington, DC", " ", "walking"),
    /Point B is required/,
  );
});