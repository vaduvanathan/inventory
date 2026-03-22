"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const [adminName, setAdminName] = useState("");
  const [requests, setRequests] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamPhone, setNewTeamPhone] = useState("");
  const [newTeamRole, setNewTeamRole] = useState("team");
  const [activeTab, setActiveTab] = useState("active");
  const [adminComment, setAdminComment] = useState<{[key: string]: string}>({});
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("teamName");
    
    // Check if the user is actually an admin
    if (role !== "admin") {
      router.push("/");
    } else {
      setAdminName(name || "Admin");
      fetchRequests();
      fetchTeams();
    }
  }, [router]);

  async function fetchRequests() {
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error("Fetch requests error:", error);
    if (data) setRequests(data);
  }

  async function fetchTeams() {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error("Fetch teams error:", error);
    if (data) setTeams(data);
  }

  const updateStatus = async (id: string, newStatus: string) => {
    const comment = adminComment[id] || "";
    const now = new Date().toISOString();

    const { error } = await supabase.from("requests").update({ 
      status: newStatus,
      admin_comment: comment,
      approved_by: adminName,
      action_timestamp: now
    }).eq("id", id); 
    
    if (error) {
      alert("Error updating request: " + error.message);
    } else {
      setAdminComment(prev => ({...prev, [id]: ""}));
      fetchRequests();
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName || !newTeamPhone) return;

    const { error } = await supabase.from("teams").insert([
      { name: newTeamName, phone: String(newTeamPhone), role: newTeamRole }
    ]);

    if (error) {
      console.error("Insert error:", error);
      alert("Error adding user: " + error.message);
    } else {
      alert(newTeamRole === "admin" ? "New admin added successfully!" : "New team added successfully!");
      setNewTeamName("");
      setNewTeamPhone("");
      fetchTeams();
    }
  };

  const deleteTeam = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the user ${name}?`)) {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) {
        alert("Error deleting user: " + error.message);
      } else {
        fetchTeams();
      }
    }
  };

  const activeRequests = requests.filter(r => r.status === "sent");
  const closedRequests = requests.filter(r => r.status === "approved" || r.status === "denied");

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">HQ Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Logged in as: <span className="font-bold">{adminName}</span></p>
          </div>
          <button
            onClick={() => { localStorage.clear(); router.push("/"); }}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Logout
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex space-x-4 border-b pb-2">
          <button onClick={() => setActiveTab("active")} className={`px-4 py-2 font-semibold rounded-t-lg ${activeTab === "active" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>Active Tickets</button>
          <button onClick={() => setActiveTab("closed")} className={`px-4 py-2 font-semibold rounded-t-lg ${activeTab === "closed" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>Closed Requests</button>
          <button onClick={() => setActiveTab("users")} className={`px-4 py-2 font-semibold rounded-t-lg ${activeTab === "users" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>Manage Users/Admins</button>
        </div>

        {/* ACTIVE TICKETS */}
        {activeTab === "active" && (
          <div className="space-y-4">
             {activeRequests.length === 0 ? (
               <div className="bg-white p-6 rounded shadow text-center text-gray-500">No active requests at the moment.</div>
             ) : (
               activeRequests.map((req) => (
                 <div key={req.id} className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
                   <div className="flex justify-between items-start mb-4">
                     <div>
                       <h3 className="text-lg font-bold">Ticket #{req.id} - {req.factory_name || req.team}</h3>
                       <p className="text-sm text-gray-500">Submitted: {new Date(req.created_at).toLocaleString()}</p>
                     </div>
                     <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold text-sm">Needs Review</span>
                   </div>
                   
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div><strong>Person:</strong> {req.person_name}</div>
                      <div><strong>Phone:</strong> {req.phone_number}</div>
                      <div><strong>Pincode:</strong> {req.pincode}</div>
                      <div><strong>POC:</strong> {req.poc || "N/A"}</div>
                   </div>
                   <div className="text-sm mb-4 bg-gray-50 p-2 rounded">
                     <strong>Address:</strong> {req.location}
                   </div>

                   <div className="mb-4">
                     <strong>Requested Items:</strong>
                     <div className="flex space-x-6 mt-1 text-sm">
                       <span className="bg-indigo-50 px-2 py-1 rounded border">Devices: <b>{req.device_qty || 0}</b></span>
                       <span className="bg-indigo-50 px-2 py-1 rounded border">SD Cards: <b>{req.sd_card_qty || 0}</b></span>
                       <span className="bg-indigo-50 px-2 py-1 rounded border">Hubs: <b>{req.charger_hub_qty || 0}</b></span>
                     </div>
                   </div>

                   {req.user_comment && (
                     <div className="mb-4 text-sm italic text-gray-700">
                       User Comment: {req.user_comment}
                     </div>
                   )}

                   <div className="border-t pt-4 flex items-end gap-2">
                     <div className="flex-1">
                       <label className="text-xs font-semibold text-gray-600 mb-1 block">Admin Comment (Optional)</label>
                       <input 
                         type="text" 
                         placeholder="Reason for approval/denial..."
                         className="w-full border rounded p-2 text-sm"
                         value={adminComment[req.id] || ""}
                         onChange={(e) => setAdminComment({...adminComment, [req.id]: e.target.value})}
                       />
                     </div>
                     <button onClick={() => updateStatus(req.id, "approved")} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-bold">Approve</button>
                     <button onClick={() => updateStatus(req.id, "denied")} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-bold">Deny</button>
                   </div>
                 </div>
               ))
             )}
          </div>
        )}

        {/* CLOSED TICKETS */}
        {activeTab === "closed" && (
          <div className="space-y-4">
             {closedRequests.length === 0 ? (
               <div className="bg-white p-6 rounded shadow text-center text-gray-500">No closed requests yet.</div>
             ) : (
               closedRequests.map((req) => (
                 <div key={req.id} className={`bg-white p-6 rounded-lg shadow border-l-4 ${req.status === "approved" ? "border-green-500" : "border-red-500"}`}>
                   <div className="flex justify-between items-start mb-4">
                     <div>
                       <h3 className="text-lg font-bold">Ticket #{req.id} - {req.factory_name || req.team}</h3>
                       <p className="text-sm text-gray-500">Submitted: {new Date(req.created_at).toLocaleString()}</p>
                     </div>
                     <span className={`px-3 py-1 rounded-full font-semibold text-sm ${req.status === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                       {req.status === "approved" ? "Approved" : "Denied"}
                     </span>
                   </div>
                   
                   <div className="text-sm grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 bg-gray-50 p-3 rounded">
                     <div><strong>By Admin:</strong> {req.approved_by || "Unknown"}</div>
                     <div className="col-span-1 md:col-span-2"><strong>Time:</strong> {req.action_timestamp ? new Date(req.action_timestamp).toLocaleString() : "N/A"}</div>
                     <div className="col-span-2 md:col-span-4"><strong>Admin Note:</strong> {req.admin_comment || "None"}</div>
                   </div>
                 </div>
               ))
             )}
          </div>
        )}

        {/* USERS/ADMINS */}
        {activeTab === "users" && (
          <div className="space-y-8">
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold border-b pb-2">Add New User / Admin</h2>
              <form onSubmit={handleCreateTeam} className="flex flex-wrap items-end gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Name / Team Name</label>
                  <input type="text" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="w-full rounded border p-2" required />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number (Password)</label>
                  <input type="text" value={newTeamPhone} onChange={e => setNewTeamPhone(e.target.value)} className="w-full rounded border p-2" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
                  <select value={newTeamRole} onChange={e => setNewTeamRole(e.target.value)} className="w-full rounded border p-2 bg-white">
                    <option value="team">Team / User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" className="rounded bg-blue-600 px-6 py-2 font-bold text-white hover:bg-blue-700">
                  Create Account
                </button>
              </form>
            </div>

            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold border-b pb-2">Manage Existing Accounts</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-gray-100">
                      <th className="p-3">ID</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Phone (Pass)</th>
                      <th className="p-3">Role</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((t) => (
                      <tr key={t.id} className="border-b">
                        <td className="p-3 text-gray-500">#{t.id}</td>
                        <td className="p-3 font-semibold">
                          {t.name}
                          {t.name === adminName && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">You</span>}
                        </td>
                        <td className="p-3">{t.phone}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs text-white ${t.role === "admin" ? "bg-purple-600" : "bg-gray-600"}`}>
                            {t.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {t.name !== adminName && (
                            <button onClick={() => deleteTeam(t.id, t.name)} className="text-red-600 hover:text-red-800 font-semibold underline text-xs">
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

