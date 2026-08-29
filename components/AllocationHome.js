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
  const [statusRows, setStatusRows] = useState([]);
  const [statusLoading, setStatusLoading] = useState(false);

  const filteredLive = useMemo(() => filterRows(live, query, liveColumnFilters), [live, query, liveColumnFilters]);
  const liveFilterOptions = useMemo(() => buildFilterOptions(live), [live]);
  const filteredAssigned = useMemo(() => filterRows(assigned, query), [assigned, query]);
  const serviceRows = useMemo(() => selectedService ? assigned.filter((row) => row.serviceName === selectedService) : [], [assigned, selectedService]);

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (view !== "status") return undefined;
    loadStatus();
    const timer = window.setInterval(loadStatus, 15000);
    return () => window.clearInterval(timer);
  }, [view]);

  async function refresh() {
    setLoading(true); setMessage("");
    try {
      const [registrations, serviceRows] = await Promise.all([callBackend("registrations.list"), callBackend("services.list")]);
      setLive(registrations?.live || []); setAssigned(registrations?.assigned || []); setServices(serviceRows || []); setDrafts({});
    } catch (error) { setMessage(error.message || "Could not load data"); }
    finally { setLoading(false); }
  }

  async function loadStatus() {
    setStatusLoading(true);
    try {
      setStatusRows(await callBackend("status.list") || []);
    } catch (error) {
      setMessage(error.message || "Could not load assignment status");
    } finally {
      setStatusLoading(false);
    }
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
    <header className="hero"><div><p className="eyebrow">HKVT Volunteer Allocation</p><h1>{view === "home" ? "Volunteer allocation" : view === "live" ? "Live registrations" : view === "assigned" ? "Assigned volunteers" : view === "status" ? "Status of assignment" : "Service wise view"}</h1><p>{view === "home" ? "Choose a section to manage registrations and service assignments." : "Assign services and categories while new registrations continue to arrive in Google Sheets."}</p></div>{view !== "home" && view !== "status" ? <button className="refresh-button" onClick={refresh}>{loading ? "Loading..." : "Refresh"}</button> : null}</header>
    <nav className="main-menu"><Link href="/">Home</Link><Link href="/live-registrations">Live Registrations</Link><Link href="/assigned-volunteers">Assigned Volunteers</Link><Link href="/service-wise">Service Wise View</Link><Link href="/status-assignment">Status of Assignment</Link></nav>
    {view === "home" ? <section className="home-actions"><Link href="/live-registrations"><span>01</span><strong>Live Registrations</strong><small>View new registrations and assign service and category.</small></Link><Link href="/assigned-volunteers"><span>02</span><strong>Assigned Volunteers</strong><small>Review assigned volunteers and edit their allocation.</small></Link><Link href="/service-wise"><span>03</span><strong>Service Wise View</strong><small>View assigned volunteers by service and download Excel.</small></Link><Link href="/status-assignment"><span>04</span><strong>Status of Assignment</strong><small>Compare service requirements, allotted volunteers, and remaining needs.</small></Link></section> : view === "status" ? <><StatusSection rows={statusRows} loading={statusLoading} onRefresh={loadStatus} />{message ? <div className="message">{message}</div> : null}</> : view === "service" ? <ServiceWiseSection services={services} rows={serviceRows} selectedService={selectedService} setSelectedService={setSelectedService} loading={loading} onRefresh={refresh} /> : <><section className="control-panel"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, mobile, gender, service or category" /><span>{loading ? "Loading registrations..." : `${view === "live" ? filteredLive.length : filteredAssigned.length} rows`}</span></section>{message ? <div className="message">{message}</div> : null}{view === "live" ? <RegistrationSection title="Live registrations" description="Select a service and category, then save. The row will move to Assigned Volunteers." rows={filteredLive} totalRows={live.length} services={services} drafts={drafts} updateDraft={updateDraft} saveRow={saveRow} saving={saving} assigned={false} loading={loading} filterValues={liveColumnFilters} setFilterValues={setLiveColumnFilters} filterOptions={liveFilterOptions} /> : <RegistrationSection title="Assigned volunteers" description="Assigned rows stay in Form Responses 1. Change service or category and save when needed." rows={filteredAssigned} totalRows={assigned.length} services={services} drafts={drafts} updateDraft={updateDraft} saveRow={saveRow} saving={saving} assigned loading={loading} />}</>}
  </main>;
}

function StatusSection({ rows, loading, onRefresh }) {
  return <section className="registration-section status-section"><div className="section-title"><div><h2>Status of assignment</h2><p>Requirement comes from column F of Service Master. Allotted counts come from Assignment Map.</p></div><button className="refresh-button" onClick={onRefresh}>{loading ? "Loading..." : "Refresh"}</button></div>{loading ? <div className="loading">Loading assignment status...</div> : !rows.length ? <div className="empty">No services found. Add services to Service Master.</div> : <div className="table-frame"><table className="status-table"><thead><tr><th>Service Name</th><th>Requirement</th><th>Allotted</th><th>Remaining</th></tr></thead><tbody>{rows.map((row) => <tr key={row.serviceName}><td>{row.serviceName}</td><td>{row.requirement}</td><td>{row.allotted}</td><td className={row.remaining ? "remaining" : "complete"}>{row.remaining}</td></tr>)}</tbody></table></div>}</section>;
}

function ServiceWiseSection({ services, rows, selectedService, setSelectedService, loading, onRefresh }) {
  function downloadExcel() {
    if (!selectedService || !rows.length) return;
    const headers = ["Name", "Age", "WhatsApp Number", "Gender", "No. of Round Chanting", "Last Year Service", "Address", "This Year Service", "Category", "Photo"];
    const escape = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const cells = (row) => [row.fullName, row.age, row.mobile, row.gender, row.roundsChanting, row.lastYearService, row.address, row.serviceName, row.category, row.photo];
    const html = `<table border="1"><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr>${rows.map((row) => `<tr>${cells(row).map((value) => `<td>${escape(value)}</td>`).join("")}</tr>`).join("")}</table>`;
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([`<html><body>${html}</body></html>`], { type: "application/vnd.ms-excel" })); link.download = `${selectedService.replace(/[^a-z0-9]+/gi, "-")}-volunteers.xls`; link.click(); URL.revokeObjectURL(link.href);
  }

  async function loadStatus() {
    setStatusLoading(true);
    try { setStatusRows(await callBackend("status.list") || []); }
    catch (error) { setMessage(error.message || "Could not load assignment status"); }
    finally { setStatusLoading(false); }
  }

  return <><section className="service-toolbar"><div><label htmlFor="service-filter">Select service</label><select id="service-filter" value={selectedService} onChange={(event) => setSelectedService(event.target.value)}><option value="">Choose a service</option>{services.map((service) => <option key={service.serviceName} value={service.serviceName}>{service.serviceName}</option>)}</select></div><div className="service-toolbar-actions"><button className="refresh-button" onClick={onRefresh}>{loading ? "Loading..." : "Refresh"}</button><button className="download-button" onClick={downloadExcel} disabled={!selectedService || !rows.length}>Download Excel</button></div></section><section className="registration-section"><div className="section-title"><div><h2>{selectedService || "Service wise volunteers"}</h2><p>{selectedService ? `${rows.length} assigned volunteers` : "Choose a service to view assigned volunteers."}</p></div></div>{loading ? <div className="loading">Loading assigned volunteers...</div> : selectedService ? <RegistrationSection title="" description="Assigned rows are read from Volunteer Master and Assignment Map." rows={rows} services={services} drafts={{}} updateDraft={() => {}} saveRow={() => {}} saving="" assigned loading={false} /> : <div className="empty">Select a service above.</div>}</section></>;
}

function RegistrationSection({ title, description, rows, totalRows = rows.length, services, drafts, updateDraft, saveRow, saving, assigned, loading, filterValues = {}, setFilterValues, filterOptions = {} }) {
  const filterable = Boolean(setFilterValues);
  const columns = ["fullName", "age", "mobile", "gender", "roundsChanting", "lastYearService", "address", "thisYearService", "serviceName", "category", "photo"];
  return <section className="registration-section"><div className="section-title"><div><h2>{title}</h2><p>{description}</p></div><span className="row-count">{rows.length === totalRows ? `${rows.length} rows` : `Showing ${rows.length} of ${totalRows} rows`}</span></div>{loading ? <div className="loading">Loading {title.toLowerCase()}...</div> : !rows.length ? <div className="empty">No records found.</div> : <div className="table-frame"><table><thead><tr><th>Name</th><th>Age</th><th>WhatsApp Number</th><th>Gender</th><th>No. of Round Chanting</th><th>Last Year Service</th><th>Address</th><th>This Year Service</th><th>Service</th><th>Category</th><th>Photo</th><th>Action</th></tr>{filterable ? <tr className="filter-row">{columns.map((column) => <th key={column}>{filterOptions[column] ? <select value={filterValues[column] || ""} onChange={(event) => setFilterValues((current) => ({ ...current, [column]: event.target.value }))} aria-label={`Filter ${column}`}><option value="">All</option>{filterOptions[column].map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input value={filterValues[column] || ""} onChange={(event) => setFilterValues((current) => ({ ...current, [column]: event.target.value }))} placeholder="Filter" aria-label={`Filter ${column}`} />}</th>)}<th /></tr> : null}</thead><tbody>{rows.map((row) => <RegistrationRow key={row.responseKey} row={row} services={services} drafts={drafts} updateDraft={updateDraft} saveRow={saveRow} saving={saving} assigned={assigned} />)}</tbody></table></div>}</section>;
}

function RegistrationRow({ row, services, drafts, updateDraft, saveRow, saving, assigned }) {
  const draft = drafts[row.responseKey] || { serviceName: row.serviceName || "", category: row.category || "" };
  return <tr><td>{row.fullName || "-"}</td><td>{row.age || "-"}</td><td>{row.mobile || "-"}</td><td>{row.gender || "-"}</td><td>{row.roundsChanting || "-"}</td><td>{row.lastYearService || "-"}</td><td>{row.address || "-"}</td><td>{row.thisYearService || "-"}</td><td><select value={draft.serviceName} onChange={(event) => updateDraft(row, "serviceName", event.target.value)} disabled={saving === row.responseKey}><option value="">Select service</option>{services.map((service) => <option key={service.serviceName} value={service.serviceName}>{service.serviceName}</option>)}</select></td><td><select className="category-select" value={draft.category} onChange={(event) => updateDraft(row, "category", event.target.value)} disabled={saving === row.responseKey}><option value="">Select category</option>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></td><td>{row.photo ? <a href={row.photo} target="_blank" rel="noreferrer">View photo</a> : "-"}</td><td><button className="save-button" onClick={() => saveRow(row)} disabled={saving === row.responseKey}>{saving === row.responseKey ? "Saving..." : assigned ? "Save changes" : "Assign"}</button></td></tr>;
}

function AvailabilityCell({ value }) {
  const text = value || "Not available";
  const available = text.toLowerCase() !== "not available" && text.toLowerCase() !== "no";
  return <td><span className={available ? "available" : "not-available"}>{text}</span></td>;
}

function filterRows(rows, query, columnFilters = {}) {
  const needle = String(query || "").trim().toLowerCase();
  return rows.filter((row) => {
    const matchesQuery = !needle || [row.fullName, row.age, row.mobile, row.gender, row.roundsChanting, row.lastYearService, row.address, row.thisYearService, row.serviceName, row.category].some((value) => String(value || "").toLowerCase().includes(needle));
    const matchesColumns = Object.entries(columnFilters).every(([column, value]) => !String(value || "").trim() || (DROPDOWN_FILTER_COLUMNS.includes(column) ? String(row[column] || "").trim().toLowerCase() === String(value).trim().toLowerCase() : String(row[column] || "").toLowerCase().includes(String(value).trim().toLowerCase())));
    return matchesQuery && matchesColumns;
  });
}

function buildFilterOptions(rows) {
  return Object.fromEntries(DROPDOWN_FILTER_COLUMNS.map((column) => [column, [...new Set(rows.map((row) => String(row[column] || "Not available").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))]));
}
