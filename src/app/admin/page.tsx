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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("teamName");
    
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
      setExpandedId(null);
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

  const formatTicketId = (id: number) => `#${String(id).padStart(4, "0")}`;

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden font-sans pb-10">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500 opacity-[0.03] blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-white opacity-5 blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-6xl p-4 md:p-8 relative z-10 space-y-8">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter">HQ Control</h1>
            <p className="text-white/50 mt-2 text-sm uppercase tracking-widest">Authorized as <span className="text-white font-bold">{adminName}</span></p>
          </div>
          <button
            onClick={() => { localStorage.clear(); router.push("/"); }}
            className="rounded-xl border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-bold text-white transition-all duration-300 hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-95"
          >
            Terminal Lock (Logout)
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex space-x-2 md:space-x-4 border-b border-white/10 pb-4 overflow-x-auto select-none">
          <button onClick={() => setActiveTab("active")} className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === "active" ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>Active Tickets <span className="ml-2 bg-black/10 px-2 py-0.5 rounded-full text-xs">{activeRequests.length}</span></button>
          <button onClick={() => setActiveTab("closed")} className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === "closed" ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>Closed History <span className="ml-2 bg-black/10 px-2 py-0.5 rounded-full text-xs">{closedRequests.length}</span></button>
          <button onClick={() => setActiveTab("users")} className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === "users" ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>Access Management</button>
        </div>

        {/* ACTIVE TICKETS */}
        {activeTab === "active" && (
          <div className="space-y-4">
             {activeRequests.length === 0 ? (
               <div className="rounded-[2rem] bg-white/5 p-12 text-center text-white/40 border border-white/5 backdrop-blur-md">All systems clear. No active tickets.</div>
             ) : (
               activeRequests.map((req) => (
                 <div key={req.id} className="rounded-2xl bg-white/5 border border-white/10 p-5 md:p-6 backdrop-blur-xl shadow-lg transition-all duration-500 hover:border-white/20 hover:bg-white/10">
                   {/* Condensed Header View (Click to expand) */}
                   <div 
                     className="flex flex-col md:flex-row justify-between md:items-center gap-4 cursor-pointer"
                     onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                   >
                     <div className="flex items-center gap-4">
                       <div className="h-12 w-12 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-200 font-bold shrink-0">
                         {req.team.substring(0,2).toUpperCase()}
                       </div>
                       <div>
                         <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
                           Ticket {formatTicketId(req.id)}
                           <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 rounded font-semibold text-[10px] tracking-wider uppercase border border-blue-500/30">Needs Review</span>
                         </h3>
                         <p className="text-sm text-white/60 mt-1">
                           <span className="font-semibold text-white/90">{req.team}</span> &bull; {req.factory_name} ({req.city || 'Unknown City'}) &bull; <span className="text-white/90">{req.device_qty || 0} Devices</span>
                         </p>
                       </div>
                     </div>
                     <div className="text-right text-xs text-white/40 hidden md:block">
                       Submitted {new Date(req.created_at).toLocaleDateString()}
                     </div>
                   </div>

                   {/* Expanded Details */}
                   <div className={`transition-all duration-500 ease-in-out origin-top overflow-hidden ${expandedId === req.id ? "max-h-[1500px] opacity-100 mt-6 pt-6 border-t border-white/10" : "max-h-0 opacity-0 m-0 p-0 border-0"}`}>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
                        <div className="space-y-4 col-span-1 md:col-span-3">
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white/5 rounded-xl p-4 border border-white/5">
                             <div><span className="block text-[10px] uppercase text-white/40 mb-1">Contact</span>{req.person_name}</div>
                             <div><span className="block text-[10px] uppercase text-white/40 mb-1">Phone</span>{req.phone_number}</div>
                             <div><span className="block text-[10px] uppercase text-white/40 mb-1">City/State</span>{req.city}, {req.state}</div>
                             <div><span className="block text-[10px] uppercase text-white/40 mb-1">Pincode</span>{req.pincode}</div>
                             <div className="col-span-2 md:col-span-4"><span className="block text-[10px] uppercase text-white/40 mb-1">Address</span>{req.location}</div>
                           </div>

                           <div className="flex gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                             <div className="flex-1 text-center"><span className="block text-[10px] uppercase text-white/40 mb-1">Devices</span><span className="text-xl font-bold">{req.device_qty || 0}</span></div>
                             <div className="flex-1 text-center border-l border-white/10"><span className="block text-[10px] uppercase text-white/40 mb-1">SD Cards</span><span className="text-xl font-bold">{req.sd_card_qty || 0}</span></div>
                             <div className="flex-1 text-center border-l border-white/10"><span className="block text-[10px] uppercase text-white/40 mb-1">Hubs</span><span className="text-xl font-bold">{req.charger_hub_qty || 0}</span></div>
                           </div>

                           {req.user_comment && (
                             <div className="text-sm italic text-white/70 border-l-2 border-white/20 pl-4 py-2">
                               <span className="block text-[10px] uppercase text-white/40 mb-1 not-italic">Team Note</span>
                               "{req.user_comment}"
                             </div>
                           )}
                        </div>

                        {/* Action Panel */}
                        <div className="col-span-1 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 flex flex-col gap-3">
                          <label className="text-[10px] uppercase text-white/40 font-bold tracking-wider">Admin Resolution</label>
                          <textarea 
                            placeholder="Reasoning here..."
                            className="w-full h-24 bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 resize-none transition-all"
                            value={adminComment[req.id] || ""}
                            onChange={(e) => setAdminComment({...adminComment, [req.id]: e.target.value})}
                          />
                          <div className="flex flex-col gap-2 mt-auto">
                            <button onClick={() => updateStatus(req.id, "approved")} className="w-full bg-green-500/20 text-green-300 border border-green-500/30 py-3 rounded-xl font-bold hover:bg-green-500 hover:text-white transition-all duration-300">Approve</button>
                            <button onClick={() => updateStatus(req.id, "denied")} className="w-full bg-red-500/20 text-red-300 border border-red-500/30 py-3 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all duration-300">Deny</button>
                          </div>
                        </div>
                     </div>
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
               <div className="rounded-[2rem] bg-white/5 p-12 text-center text-white/40 border border-white/5 backdrop-blur-md">Log is completely empty.</div>
             ) : (
               closedRequests.map((req) => (
                 <div key={req.id} 
                   className={`rounded-2xl border bg-white/5 p-5 md:p-6 backdrop-blur-xl shadow-lg transition-all 
                     ${req.status === "approved" ? "border-green-500/20 hover:border-green-500/40" : "border-red-500/20 hover:border-red-500/40"}`}
                 >
                   <div 
                     className="flex flex-col md:flex-row justify-between md:items-center gap-4 cursor-pointer"
                     onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                   >
                     <div className="flex items-center gap-4">
                       <div className={`h-12 w-12 rounded-full border flex items-center justify-center text-lg font-bold shrink-0 ${req.status === 'approved' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                         {req.status === 'approved' ? '✓' : '×'}
                       </div>
                       <div>
                         <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
                           Ticket {formatTicketId(req.id)}
                           <span className={`px-2.5 py-0.5 rounded font-semibold text-[10px] tracking-wider uppercase border ${req.status === "approved" ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}`}>
                             {req.status}
                           </span>
                         </h3>
                         <p className="text-sm text-white/60 mt-1">
                           <span className="font-semibold text-white/90">{req.team}</span> &bull; {req.factory_name} ({req.city || 'Unknown City'}) &bull; <span className="text-white/90">{req.device_qty || 0} Devices</span>
                         </p>
                       </div>
                     </div>
                     <div className="text-right text-xs text-white/40 hidden md:block">
                       Action via {req.approved_by || "System"} <br/>
                       {new Date(req.action_timestamp || req.created_at).toLocaleDateString()}
                     </div>
                   </div>

                   {/* Expanded Closed Details */}
                   <div className={`transition-all duration-500 ease-in-out origin-top overflow-hidden ${expandedId === req.id ? "max-h-[500px] opacity-100 mt-6 pt-5 border-t border-white/10" : "max-h-0 opacity-0 m-0 p-0 border-0"}`}>
                     <div className={`p-4 rounded-xl border flex flex-col gap-2 ${req.status === 'approved' ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                       <p className="text-xs uppercase tracking-wider text-white/40">Resolution Notes</p>
                       <p className="text-sm text-white/90">"{req.admin_comment || "No commentary provided."}"</p>
                       <div className="text-[10px] text-white/40 mt-2">
                         Processed by {req.approved_by || "Unknown"} on {req.action_timestamp ? new Date(req.action_timestamp).toLocaleString() : "N/A"}
                       </div>
                     </div>
                   </div>
                 </div>
               ))
             )}
          </div>
        )}

        {/* USERS/ADMINS */}
        {activeTab === "users" && (
          <div className="space-y-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-5 rounded-[2rem] bg-white/5 p-6 md:p-8 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <h2 className="mb-6 text-xl font-bold border-b border-white/10 pb-4">Issue Security Pass (Add User)</h2>
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70">Identifier (Name)</label>
                  <input type="text" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none transition-all focus:bg-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10" required />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70">Access Code (Phone)</label>
                  <input type="text" value={newTeamPhone} onChange={e => setNewTeamPhone(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none transition-all focus:bg-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10" required />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70">Clearance Level</label>
                  <select value={newTeamRole} onChange={e => setNewTeamRole(e.target.value)} className="w-full rounded-xl bg-neutral-900 border border-white/10 p-3 text-white outline-none transition-all focus:border-white/30 cursor-pointer">
                    <option value="team">Standard Logistics (Team)</option>
                    <option value="admin">HQ Control (Admin)</option>
                  </select>
                </div>
                <button type="submit" className="w-full mt-2 rounded-xl bg-white p-3 font-bold text-black transition-all hover:bg-neutral-200 active:scale-[0.98] shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  Provision Access
                </button>
              </form>
            </div>

            <div className="md:col-span-7 rounded-[2rem] bg-white/5 p-6 md:p-8 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <h2 className="mb-6 text-xl font-bold border-b border-white/10 pb-4">Active Clearance Registry</h2>
              <div className="overflow-x-auto custom-scrollbar pr-2 max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wider">
                      <th className="p-3 font-semibold">User</th>
                      <th className="p-3 font-semibold hidden sm:table-cell">Secret Code</th>
                      <th className="p-3 font-semibold">Clearance</th>
                      <th className="p-3 font-semibold text-right">Revoke</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((t) => (
                      <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                        <td className="p-3 font-bold text-base flex flex-col sm:flex-row sm:items-center">
                          {t.name}
                          {t.name === adminName && <span className="sm:ml-3 mt-1 sm:mt-0 text-[9px] bg-white/20 text-white px-2 py-0.5 rounded uppercase tracking-widest self-start">You</span>}
                        </td>
                        <td className="p-3 text-white/60 font-mono hidden sm:table-cell">{t.phone}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-widest ${t.role === "admin" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-white/10 text-white/70 border border-white/10"}`}>
                            {t.role}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {t.name !== adminName && (
                            <button onClick={() => deleteTeam(t.id, t.name)} className="text-red-400 hover:text-red-300 font-semibold text-xs opacity-50 hover:opacity-100 transition-opacity bg-red-500/10 px-3 py-1.5 rounded">
                              Revoke
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

