import { buildDirectionsUrl, buildMapSearchUrl } from "./maps.js";

const form = document.querySelector("#lookup-form");
const input = document.querySelector("#phone-number");
const button = document.querySelector("#lookup-button");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const sourceList = document.querySelector("#sources");
const liveSearchList = document.querySelector("#live-searches");
const mapTools = document.querySelector("#map-tools");
const routeForm = document.querySelector("#route-form");
const routeOrigin = document.querySelector("#route-origin");
const routeDestination = document.querySelector("#route-destination");
const routeProvider = document.querySelector("#route-provider");
const routeMode = document.querySelector("#route-mode");
const routeStatus = document.querySelector("#route-status");

function setLoading(loading) {
  button.disabled = loading;
  button.querySelector("span").textContent = loading ? "Inspecting..." : "Inspect";
}

function renderSources(sources) {
  sourceList.replaceChildren(
    ...sources.map((source) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      const time = document.createElement("span");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = source.title;
      time.className = "source-time";
      time.textContent = `Retrieved ${new Date(source.retrievedAtUtc).toLocaleString()}`;
      item.append(link, time);
      return item;
    }),
  );
}

function renderLiveSearches(searches) {
  liveSearchList.replaceChildren(
    ...searches.map((search) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = search.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = search.title;
      const category = document.createElement("span");
      const summary = document.createElement("span");
      category.className = `source-category source-category-${search.category}`;
      category.textContent = search.category;
      summary.className = "source-summary";
      summary.textContent = search.summary;
      item.append(category, link, summary);
      return item;
    }),
  );
}

function renderEvidenceResults(results) {
  const intro = document.querySelector("#evidence-results-intro");
  const list = document.querySelector("#evidence-results");
  intro.textContent =
    "Each configured source is listed below. Exact-number directories require a user-initiated review so the app does not silently disclose the complete number.";
  list.replaceChildren(
    ...results.map((result) => {
      const item = document.createElement("li");
      const heading = document.createElement("span");
      const status = document.createElement("span");
      const summary = document.createElement("span");
      const requirements = document.createElement("span");
      const inputValue = document.createElement("span");
      const access = document.createElement("span");
      const limitation = document.createElement("small");
      const link = document.createElement("a");
      heading.className = "evidence-result-title";
      heading.textContent = result.title;
      status.className = `evidence-result-status evidence-result-status-${result.status}`;
      status.textContent = result.status.replaceAll("-", " ");
      summary.textContent = result.summary;
      requirements.className = "evidence-result-detail";
      requirements.textContent = `Required input: ${result.requiredInput}`;
      inputValue.className = "evidence-result-input";
      inputValue.textContent = `Input used: ${result.inputValue}`;
      access.className = "evidence-result-detail";
      access.textContent = `Access: ${result.accessMethod}`;
      limitation.textContent = result.limitation;
      link.href = result.source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = result.status === "manual-review" ? "Search this source" : "View source";
      item.append(heading, status, requirements, inputValue, access, summary, link, limitation);
      return item;
    }),
  );
}

function renderResult(data) {
  document.querySelector("#result-title").textContent = data.region;
  document.querySelector("#country-code").textContent = data.countryCode ?? "N/A";
  document.querySelector("#formatted-number").textContent = data.formattedInternational;
  document.querySelector("#calling-code").textContent = data.callingCode;
  const areaCodeFact = document.querySelector("#area-code-fact");
  areaCodeFact.hidden = !data.numberingAssignment.areaCode;
  document.querySelector("#area-code").textContent = data.numberingAssignment.areaCode ?? "";
  document.querySelector("#number-type").textContent = data.numberType.replaceAll("_", " ");
  document.querySelector("#disclaimer").textContent = data.disclaimer;
  renderEvidenceResults(data.investigation.evidenceResults);
  mapTools.hidden = !data.mapLocation;
  if (data.mapLocation) {
    document.querySelector("#map-scope").textContent =
      `${data.mapLocation.label} is the numbering assignment area, not the caller's current or verified origin.`;
    document.querySelector("#google-map-link").href = buildMapSearchUrl("google", data.mapLocation.query);
    document.querySelector("#bing-map-link").href = buildMapSearchUrl("bing", data.mapLocation.query);
    routeOrigin.value = data.mapLocation.query;
    routeDestination.value = "";
    routeStatus.textContent = "";
  }
  renderLiveSearches(data.investigation.publicSearches);
  renderSources(data.sources);
  result.hidden = false;
}

routeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  routeStatus.textContent = "";

  try {
    const url = buildDirectionsUrl(
      routeProvider.value,
      routeOrigin.value,
      routeDestination.value,
      routeMode.value,
    );
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.click();
  } catch (error) {
    routeStatus.textContent = error.message;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  result.hidden = true;
  setLoading(true);

  try {
    const response = await fetch(`/api/lookup?number=${encodeURIComponent(input.value)}`, {
      headers: { accept: "application/json" },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "The lookup could not be completed.");
    renderResult(data);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    setLoading(false);
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js"));
}