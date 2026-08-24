"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const CATEGORIES = ["FOLK", "Congregation", "Employee"];
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

  const filteredLive = useMemo(() => filterRows(live, query), [live, query]);
  const filteredAssigned = useMemo(() => filterRows(assigned, query), [assigned, query]);

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
    <nav className="main-menu"><Link href="/">Home</Link><Link href="/live-registrations">Live Registrations</Link><Link href="/assigned-volunteers">Assigned Volunteers</Link></nav>
    {view === "home" ? <section className="home-actions"><Link href="/live-registrations"><span>01</span><strong>Live Registrations</strong><small>View new registrations and assign service and category.</small></Link><Link href="/assigned-volunteers"><span>02</span><strong>Assigned Volunteers</strong><small>Review assigned volunteers and edit their allocation.</small></Link></section> : <><section className="control-panel"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, mobile, gender, service or category" /><span>{loading ? "Loading registrations..." : `${view === "live" ? filteredLive.length : filteredAssigned.length} rows`}</span></section>{message ? <div className="message">{message}</div> : null}{view === "live" ? <RegistrationSection title="Live registrations" description="Select a service and category, then save. The row will move to Assigned Volunteers." rows={filteredLive} services={services} drafts={drafts} updateDraft={updateDraft} saveRow={saveRow} saving={saving} assigned={false} loading={loading} /> : <RegistrationSection title="Assigned volunteers" description="Assigned rows stay in Form Responses 1. Change service or category and save when needed." rows={filteredAssigned} services={services} drafts={drafts} updateDraft={updateDraft} saveRow={saveRow} saving={saving} assigned loading={loading} />}</>}
  </main>;
}

function RegistrationSection({ title, description, rows, services, drafts, updateDraft, saveRow, saving, assigned, loading }) {
  return <section className="registration-section"><div className="section-title"><div><h2>{title}</h2><p>{description}</p></div><span className="row-count">{rows.length} rows</span></div>{loading ? <div className="loading">Loading {title.toLowerCase()}...</div> : !rows.length ? <div className="empty">No records found.</div> : <div className="table-frame"><table><thead><tr><th>Full Name</th><th>Age</th><th>Mobile Number</th><th>Gender</th><th>Availability on 2nd</th><th>Availability on 3rd</th><th>Availability on 4th</th><th>Availability on 5th</th><th>Availability on 6th</th><th>Service</th><th>Category</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <RegistrationRow key={row.responseKey} row={row} services={services} drafts={drafts} updateDraft={updateDraft} saveRow={saveRow} saving={saving} assigned={assigned} />)}</tbody></table></div>}</section>;
}

function RegistrationRow({ row, services, drafts, updateDraft, saveRow, saving, assigned }) {
  const draft = drafts[row.responseKey] || { serviceName: row.serviceName || "", category: row.category || "" };
  return <tr><td>{row.fullName || "-"}</td><td>{row.age || "-"}</td><td>{row.mobile || "-"}</td><td>{row.gender || "-"}</td><AvailabilityCell value={row.availabilityOn2} /><AvailabilityCell value={row.availabilityOn3} /><AvailabilityCell value={row.availabilityOn4} /><AvailabilityCell value={row.availabilityOn5} /><AvailabilityCell value={row.availabilityOn6} /><td><select value={draft.serviceName} onChange={(event) => updateDraft(row, "serviceName", event.target.value)} disabled={saving === row.responseKey}><option value="">Select service</option>{services.map((service) => <option key={service.serviceName} value={service.serviceName}>{service.serviceName}</option>)}</select></td><td><select className="category-select" value={draft.category} onChange={(event) => updateDraft(row, "category", event.target.value)} disabled={saving === row.responseKey}><option value="">Select category</option>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></td><td><button className="save-button" onClick={() => saveRow(row)} disabled={saving === row.responseKey}>{saving === row.responseKey ? "Saving..." : assigned ? "Save changes" : "Assign"}</button></td></tr>;
}

function AvailabilityCell({ value }) {
  const available = String(value || "").toLowerCase() === "available";
  return <td><span className={available ? "available" : "not-available"}>{value || "Not available"}</span></td>;
}

function filterRows(rows, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => [row.fullName, row.age, row.mobile, row.gender, row.serviceName, row.category].some((value) => String(value || "").toLowerCase().includes(needle)));
}
