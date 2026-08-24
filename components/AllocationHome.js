"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const CATEGORIES = ["FOLK", "Congregation", "Employee"];
const DROPDOWN_FILTER_COLUMNS = ["gender", "availabilityOn3", "availabilityOn4", "availabilityOn5"];
const EMPTY_DRAFT = { serviceName: "", category: "" };

async function callBackend(action, payload = {}) {
  const response = await fetch("/api/allocations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }), cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(data?.error || "Request failed");
  return data.data;
}

export default function AllocationHome({ view = "home" }) {
  const [live, setLive] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [services, setServices] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [liveColumnFilters, setLiveColumnFilters] = useState({});

  const filteredLive = useMemo(() => filterRows(live, query, liveColumnFilters), [live, query, liveColumnFilters]);
  const liveFilterOptions = useMemo(() => buildFilterOptions(live), [live]);
  const filteredAssigned = useMemo(() => filterRows(assigned, query), [assigned, query]);
  const serviceRows = useMemo(() => selectedService ? assigned.filter((row) => row.serviceName === selectedService) : [], [assigned, selectedService]);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    setLoading(true); setMessage("");
    try {
      const [registrations, serviceRows] = await Promise.all([callBackend("registrations.list"), callBackend("services.list")]);
      setLive(registrations?.live || []); setAssigned(registrations?.assigned || []); setServices(serviceRows || []); setDrafts({});
    } catch (error) { setMessage(error.message || "Could not load data"); }
    finally { setLoading(false); }
  }

  function updateDraft(row, field, value) {
    setDrafts((current) => ({ ...current, [row.responseKey]: { ...(current[row.responseKey] || { serviceName: row.serviceName || "", category: row.category || "" }), [field]: value } }));
  }

  async function saveRow(row) {
    const draft = drafts[row.responseKey] || { serviceName: row.serviceName || "", category: row.category || "" };
    if (!draft.serviceName || !draft.category) { setMessage("Select both service and category before saving"); return; }
    setSaving(row.responseKey); setMessage("Saving assignment...");
    try {
      const result = await callBackend("registrations.assign", { responseKey: row.responseKey, sourceRow: row.sourceRow, serviceName: draft.serviceName, category: draft.category });
      setLive(result?.live || []); setAssigned(result?.assigned || []); setDrafts((current) => { const next = { ...current }; delete next[row.responseKey]; return next; }); setMessage("Assignment saved");
    } catch (error) { setMessage(error.message || "Could not save assignment"); }
    finally { setSaving(""); }
  }

  return <main className="app-shell">
    <header className="hero"><div><p className="eyebrow">KKD Volunteer Allocation</p><h1>{view === "home" ? "Volunteer allocation" : view === "live" ? "Live registrations" : "Assigned volunteers"}</h1><p>{view === "home" ? "Choose a section to manage registrations and service assignments." : "Assign services and categories while new registrations continue to arrive in Google Sheets."}</p></div>{view !== "home" ? <button className="refresh-button" onClick={refresh}>{loading ? "Loading..." : "Refresh"}</button> : null}</header>
    <nav className="main-menu"><Link href="/">Home</Link><Link href="/live-registrations">Live Registrations</Link><Link href="/assigned-volunteers">Assigned Volunteers</Link><Link href="/service-wise">Service Wise View</Link></nav>
    {view === "home" ? <section className="home-actions"><Link href="/live-registrations"><span>01</span><strong>Live Registrations</strong><small>View new registrations and assign service and category.</small></Link><Link href="/assigned-volunteers"><span>02</span><strong>Assigned Volunteers</strong><small>Review assigned volunteers and edit their allocation.</small></Link><Link href="/service-wise"><span>03</span><strong>Service Wise View</strong><small>View assigned volunteers by service and download Excel.</small></Link></section> : view === "service" ? <ServiceWiseSection services={services} rows={serviceRows} selectedService={selectedService} setSelectedService={setSelectedService} loading={loading} onRefresh={refresh} /> : <><section className="control-panel"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, mobile, gender, service or category" /><span>{loading ? "Loading registrations..." : `${view === "live" ? filteredLive.length : filteredAssigned.length} rows`}</span></section>{message ? <div className="message">{message}</div> : null}{view === "live" ? <RegistrationSection title="Live registrations" description="Select a service and category, then save. The row will move to Assigned Volunteers." rows={filteredLive} totalRows={live.length} services={services} drafts={drafts} updateDraft={updateDraft} saveRow={saveRow} saving={saving} assigned={false} loading={loading} filterValues={liveColumnFilters} setFilterValues={setLiveColumnFilters} filterOptions={liveFilterOptions} /> : <RegistrationSection title="Assigned volunteers" description="Assigned rows stay in Form Responses 1. Change service or category and save when needed." rows={filteredAssigned} totalRows={assigned.length} services={services} drafts={drafts} updateDraft={updateDraft} saveRow={saveRow} saving={saving} assigned loading={loading} />}</>}
  </main>;
}

function ServiceWiseSection({ services, rows, selectedService, setSelectedService, loading, onRefresh }) {
  function downloadExcel() {
    if (!selectedService || !rows.length) return;
    const headers = ["Full Name", "Age", "Mobile Number", "Gender", "Availability on 3rd", "Availability on 4th", "Availability on 5th", "Service", "Category"];
    const escape = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const cells = (row) => [row.fullName, row.age, row.mobile, row.gender, row.availabilityOn3, row.availabilityOn4, row.availabilityOn5, row.serviceName, row.category];
    const html = `<table border="1"><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr>${rows.map((row) => `<tr>${cells(row).map((value) => `<td>${escape(value)}</td>`).join("")}</tr>`).join("")}</table>`;
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([`<html><body>${html}</body></html>`], { type: "application/vnd.ms-excel" })); link.download = `${selectedService.replace(/[^a-z0-9]+/gi, "-")}-volunteers.xls`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <><section className="service-toolbar"><div><label htmlFor="service-filter">Select service</label><select id="service-filter" value={selectedService} onChange={(event) => setSelectedService(event.target.value)}><option value="">Choose a service</option>{services.map((service) => <option key={service.serviceName} value={service.serviceName}>{service.serviceName}</option>)}</select></div><div className="service-toolbar-actions"><button className="refresh-button" onClick={onRefresh}>{loading ? "Loading..." : "Refresh"}</button><button className="download-button" onClick={downloadExcel} disabled={!selectedService || !rows.length}>Download Excel</button></div></section><section className="registration-section"><div className="section-title"><div><h2>{selectedService || "Service wise volunteers"}</h2><p>{selectedService ? `${rows.length} assigned volunteers` : "Choose a service to view assigned volunteers."}</p></div></div>{loading ? <div className="loading">Loading assigned volunteers...</div> : selectedService ? <RegistrationSection title="" description="" rows={rows} services={services} drafts={{}} updateDraft={() => {}} saveRow={() => {}} saving="" assigned loading={false} /> : <div className="empty">Select a service above.</div>}</section></>;
}

function RegistrationSection({ title, description, rows, totalRows = rows.length, services, drafts, updateDraft, saveRow, saving, assigned, loading, filterValues = {}, setFilterValues, filterOptions = {} }) {
  const filterable = Boolean(setFilterValues);
  const columns = ["fullName", "age", "mobile", "gender", "availabilityOn3", "availabilityOn4", "availabilityOn5", "serviceName", "category"];
  return <section className="registration-section"><div className="section-title"><div><h2>{title}</h2><p>{description}</p></div><span className="row-count">{rows.length === totalRows ? `${rows.length} rows` : `Showing ${rows.length} of ${totalRows} rows`}</span></div>{loading ? <div className="loading">Loading {title.toLowerCase()}...</div> : !rows.length ? <div className="empty">No records found.</div> : <div className="table-frame"><table><thead><tr><th>Full Name</th><th>Age</th><th>Mobile Number</th><th>Gender</th><th>Availability on 3rd</th><th>Availability on 4th</th><th>Availability on 5th</th><th>Service</th><th>Category</th><th>Action</th></tr>{filterable ? <tr className="filter-row">{columns.map((column) => <th key={column}>{filterOptions[column] ? <select value={filterValues[column] || ""} onChange={(event) => setFilterValues((current) => ({ ...current, [column]: event.target.value }))} aria-label={`Filter ${column}`}><option value="">All</option>{filterOptions[column].map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input value={filterValues[column] || ""} onChange={(event) => setFilterValues((current) => ({ ...current, [column]: event.target.value }))} placeholder="Filter" aria-label={`Filter ${column}`} />}</th>)}<th /></tr> : null}</thead><tbody>{rows.map((row) => <RegistrationRow key={row.responseKey} row={row} services={services} drafts={drafts} updateDraft={updateDraft} saveRow={saveRow} saving={saving} assigned={assigned} />)}</tbody></table></div>}</section>;
}

function RegistrationRow({ row, services, drafts, updateDraft, saveRow, saving, assigned }) {
  const draft = drafts[row.responseKey] || { serviceName: row.serviceName || "", category: row.category || "" };
  return <tr><td>{row.fullName || "-"}</td><td>{row.age || "-"}</td><td>{row.mobile || "-"}</td><td>{row.gender || "-"}</td><AvailabilityCell value={row.availabilityOn3} /><AvailabilityCell value={row.availabilityOn4} /><AvailabilityCell value={row.availabilityOn5} /><td><select value={draft.serviceName} onChange={(event) => updateDraft(row, "serviceName", event.target.value)} disabled={saving === row.responseKey}><option value="">Select service</option>{services.map((service) => <option key={service.serviceName} value={service.serviceName}>{service.serviceName}</option>)}</select></td><td><select className="category-select" value={draft.category} onChange={(event) => updateDraft(row, "category", event.target.value)} disabled={saving === row.responseKey}><option value="">Select category</option>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></td><td><button className="save-button" onClick={() => saveRow(row)} disabled={saving === row.responseKey}>{saving === row.responseKey ? "Saving..." : assigned ? "Save changes" : "Assign"}</button></td></tr>;
}

function AvailabilityCell({ value }) {
  const text = value || "Not available";
  const available = text.toLowerCase() !== "not available" && text.toLowerCase() !== "no";
  return <td><span className={available ? "available" : "not-available"}>{text}</span></td>;
}

function filterRows(rows, query, columnFilters = {}) {
  const needle = String(query || "").trim().toLowerCase();
  return rows.filter((row) => {
    const matchesQuery = !needle || [row.fullName, row.age, row.mobile, row.gender, row.serviceName, row.category].some((value) => String(value || "").toLowerCase().includes(needle));
    const matchesColumns = Object.entries(columnFilters).every(([column, value]) => !String(value || "").trim() || (DROPDOWN_FILTER_COLUMNS.includes(column) ? String(row[column] || "").trim().toLowerCase() === String(value).trim().toLowerCase() : String(row[column] || "").toLowerCase().includes(String(value).trim().toLowerCase())));
    return matchesQuery && matchesColumns;
  });
}

function buildFilterOptions(rows) {
  return Object.fromEntries(DROPDOWN_FILTER_COLUMNS.map((column) => [column, [...new Set(rows.map((row) => String(row[column] || "Not available").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))]));
}
