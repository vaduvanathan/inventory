"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import GlassNotification from "@/components/GlassNotification";

export default function AdminPage() {
  const [adminName, setAdminName] = useState("");
  const [requests, setRequests] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  
  // Notification State
  const [notification, setNotification] = useState({ show: false, message: "", type: "info" as "success" | "error" | "info" });

  // Form States
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamPhone, setNewTeamPhone] = useState("");
  const [newTeamRole, setNewTeamRole] = useState("team");
  
  // Dashboard State
  const [activeTab, setActiveTab] = useState("active");
  const [adminComment, setAdminComment] = useState<{[key: string]: string}>({});
  const [trackingInfo, setTrackingInfo] = useState<{[key: string]: {courier: string, id: string}}>({});
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
      fetchInventory();
    }
  }, [router]);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setNotification({ show: true, message, type });
  };

  async function fetchInventory() {
    const { data, error } = await supabase.from("inventory").select("*");
    if(error) console.error("Inv Error", error);
    if(data) setInventory(data);
  }

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
    const tracking = trackingInfo[id] || { courier: "", id: "" };
    const now = new Date().toISOString();

    // Check if approved but tracking missing (optional logic, but good for "logistics")
const updateStatus = async (id: string, newStatus: string) => {
    const comment = adminComment[id] || "";
    const tracking = trackingInfo[id] || { courier: "", id: "" };
    const now = new Date().toISOString();

    if (newStatus === "approved" && (!tracking.courier || !tracking.id)) {
      if(!confirm("Warning: No tracking information provided. Approve anyway?")) return;
    }

    if (newStatus === "approved") {
      // Use RPC for atomic inventory update
      const { error } = await supabase.rpc('approve_request', { 
        request_id: id, 
        admin_name: adminName,
        tracking_courier: tracking.courier || "",
        tracking_code: tracking.id || ""
      });

      if (error) {
        // Fallback or Error
        console.error("RPC Error:", error);
        // Try manual update if RPC fails (e.g. function not created)
        const { error: updateError } = await supabase.from("requests").update({ 
          status: newStatus,
          admin_comment: comment,
          approved_by: adminName,
          action_timestamp: now,
          courier_name: tracking.courier,
          tracking_id: tracking.id
        }).eq("id", id);
        
        if (updateError) {
             showToast("Error updating request: " + updateError.message, "error");
             return;
        }
        showToast("Request approved (Inventory update failed - check DB functions)", "info");
      } else {
        showToast("Request approved & inventory updated", "success");
      }
    } else {
        // Deny or other status
        const { error } = await supabase.from("requests").update({ 
        status: newStatus,
        admin_comment: comment,
        approved_by: adminName,
        action_timestamp: now,
        }).eq("id", id);

        if (error) showToast("Error: " + error.message, "error");
        else showToast(`Request ${newStatus}`, "info");
    }
    
    setAdminComment(prev => ({...prev, [id]: ""}));
    setExpandedId(null);
    fetchRequests();
    fetchInventory();
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName || !newTeamPhone) return;

    const { error } = await supabase.from("teams").insert([
      { name: newTeamName, phone: String(newTeamPhone), role: newTeamRole }
    ]);

    if (error) {
      showToast("Error adding user: " + error.message, "error");
    } else {
      showToast(newTeamRole === "admin" ? "New admin added!" : "New team user added!", "success");
      setNewTeamName("");
      setNewTeamPhone("");
      fetchTeams();
    }
  };

  const deleteTeam = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the user ${name}?`)) {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) {
        showToast("Error deleting user: " + error.message, "error");
      } else {
        showToast("User deleted successfully", "success");
        fetchTeams();
      }
    }
  };

  const activeRequests = requests.filter(r => r.status === "sent");
  const closedRequests = requests.filter(r => r.status === "approved" || r.status === "denied");

  // Stats for "Network" tab
  const totalDevices = requests.filter(r => r.status === "approved").reduce((sum, r) => sum + (r.device_qty || 0), 0);
  const cities = requests.reduce((acc: any, r) => {
    const city = r.city || "Unknown";
    acc[city] = (acc[city] || 0) + (r.device_qty || 0);
    return acc;
  }, {});
  const sortedCities = Object.entries(cities).sort(([,a]: any, [,b]: any) => b - a);

  const formatTicketId = (id: number) => `#${String(id).padStart(4, "0")}`;

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden font-sans pb-10">
      <GlassNotification 
        message={notification.message}
        type={notification.type}
        isVisible={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />

      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500 opacity-[0.03] blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-white opacity-5 blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-6xl p-4 md:p-8 relative z-10 space-y-8">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter">HQ Admin Dashboard</h1>
            <p className="text-white/50 mt-2 text-sm uppercase tracking-widest">Logged in as <span className="text-white font-bold">{adminName}</span></p>
          </div>
          <button
            onClick={() => { localStorage.clear(); router.push("/"); }}
            className="rounded-xl border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-bold text-white transition-all duration-300 hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-95"
          >
            Logout
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex space-x-2 md:space-x-4 border-b border-white/10 pb-4 overflow-x-auto select-none no-scrollbar">
          <button onClick={() => setActiveTab("active")} className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === "active" ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>Active Tickets <span className="ml-2 bg-black/10 px-2 py-0.5 rounded-full text-xs">{activeRequests.length}</span></button>
          <button onClick={() => setActiveTab("inventory")} className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === "inventory" ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>Inventory Status</button>
          <button onClick={() => setActiveTab("closed")} className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === "closed" ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>Closed Requests <span className="ml-2 bg-black/10 px-2 py-0.5 rounded-full text-xs">{closedRequests.length}</span></button>
          <button onClick={() => setActiveTab("network")} className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === "network" ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>Network Map</button>
          <button onClick={() => setActiveTab("users")} className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === "users" ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>Manage Users</button>
        </div>

        {/* ACTIVE TICKETS */}
        {activeTab === "active" && (
          <div className="space-y-4">
             {activeRequests.length === 0 ? (
               <div className="rounded-[2rem] bg-white/5 p-12 text-center text-white/40 border border-white/5 backdrop-blur-md">All systems clear. No active tickets.</div>
             ) : (
               activeRequests.map((req) => (
                 <div key={req.id} className="rounded-2xl bg-white/5 border border-white/10 p-5 md:p-6 backdrop-blur-xl shadow-lg transition-all duration-500 hover:border-white/20 hover:bg-white/10">
                   {/* Condensed Header View */}
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
                             <div className="flex-1 text-center border-l border-white/10"><span className="block text-[10px] uppercase text-white/40 mb-1">Charging Hubs</span><span className="text-xl font-bold">{req.charger_hub_qty || 0}</span></div>
                           </div>

                           {req.user_comment && (
                             <div className="text-sm italic text-white/70 border-l-2 border-white/20 pl-4 py-2">
                               <span className="block text-[10px] uppercase text-white/40 mb-1 not-italic">Team Note</span>
                               "{req.user_comment}"
                             </div>
                           )}
                           
                           {/* ADMIN LOGISTICS INPUT */}
                           <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-200">Logistics & Tracking</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[10px] uppercase text-white/40 mb-1">Courier Service</label>
                                  <input 
                                    type="text" 
                                    placeholder="e.g. DTDC, Delhivery" 
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500/50"
                                    value={trackingInfo[req.id]?.courier || ""}
                                    onChange={(e) => setTrackingInfo({...trackingInfo, [req.id]: {...trackingInfo[req.id], courier: e.target.value}})}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] uppercase text-white/40 mb-1">Tracking ID</label>
                                  <input 
                                    type="text" 
                                    placeholder="Tracking Number" 
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500/50"
                                    value={trackingInfo[req.id]?.id || ""}
                                    onChange={(e) => setTrackingInfo({...trackingInfo, [req.id]: {...trackingInfo[req.id], id: e.target.value}})}
                                  />
                                </div>
                              </div>
                           </div>
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
                            <button onClick={() => updateStatus(req.id, "approved")} className="w-full bg-green-500/20 text-green-300 border border-green-500/30 py-3 rounded-xl font-bold hover:bg-green-500 hover:text-white transition-all duration-300">Approve & Send</button>
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

        {/* INVENTORY TAB */}
        {activeTab === "inventory" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {inventory.length === 0 ? (
               <div className="col-span-4 text-center py-20 text-white/40">Inventory data currently unavailable</div>
            ) : (
               inventory.map((item) => (
                 <div key={item.item_name} className="relative overflow-hidden rounded-[2rem] bg-white/5 border border-white/10 p-6 backdrop-blur-2xl ring-1 ring-white/10 transition-all hover:bg-white/10 hover:shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300">
                        {/* Icon placeholder */}
                        <div className="w-5 h-5 bg-current rounded opacity-50" />
                      </div>
                      <span className="text-xs uppercase tracking-widest font-bold text-white/40">Item</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-1">{item.item_name}</h3>
                    <div className="mt-6 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white/60">Available (HQ)</span>
                        <span className="font-bold text-green-400">{item.available_stock}</span>
                      </div>
                      <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${(item.available_stock / item.total_stock) * 100}%` }}></div>
                      </div>
                      <div className="flex justify-between items-center text-sm pt-2 border-t border-white/5">
                        <span className="text-white/60">In Transit</span>
                        <span className="font-bold text-yellow-400">{item.in_transit_stock}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white/60">Deployed</span>
                        <span className="font-bold text-blue-400">{item.deployed_stock}</span>
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
                   <div className={`transition-all duration-500 ease-in-out origin-top overflow-hidden ${expandedId === req.id ? "max-h-[1000px] opacity-100 mt-6 pt-6 border-t border-white/10" : "max-h-0 opacity-0 m-0 p-0 border-0"}`}>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
                        <div className="space-y-4 col-span-1 md:col-span-3">
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white/5 rounded-xl p-4 border border-white/5">
                             <div><span className="block text-[10px] uppercase text-white/40 mb-1">Contact</span>{req.person_name}</div>
                             <div><span className="block text-[10px] uppercase text-white/40 mb-1">Phone</span>{req.phone_number}</div>
                             <div><span className="block text-[10px] uppercase text-white/40 mb-1">City/State</span>{req.city}, {req.state}</div>
                             <div><span className="block text-[10px] uppercase text-white/40 mb-1">Pincode</span>{req.pincode}</div>
                             <div className="col-span-2 md:col-span-4"><span className="block text-[10px] uppercase text-white/40 mb-1">Address</span>{req.location}</div>
                           </div>

                           {req.tracking_id && (
                             <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-xl flex items-center justify-between">
                               <div>
                                 <span className="block text-[10px] uppercase text-green-400/60 mb-1">Logistics Provider</span>
                                 <span className="text-lg font-bold text-green-300">{req.courier_name || "Unknown"}</span>
                               </div>
                               <div className="text-right">
                                 <span className="block text-[10px] uppercase text-green-400/60 mb-1">Tracking ID</span>
                                 <span className="font-mono text-lg text-white">{req.tracking_id}</span>
                               </div>
                             </div>
                           )}
                        </div>

                        {/* Action Panel for Closed */}
                        <div className="col-span-1 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 flex flex-col gap-3">
                           <div className={`p-4 rounded-xl border flex flex-col gap-2 flex-1 ${req.status === 'approved' ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                             <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">Resolution Details</p>
                             <p className="text-sm text-white/90 italic">"{req.admin_comment || "No commentary provided."}"</p>
                             <div className="mt-auto pt-4 border-t border-white/10 text-[10px] text-white/40 space-y-1">
                               <p><strong>Processed By:</strong> {req.approved_by || "Unknown"}</p>
                               <p><strong>Time:</strong> {req.action_timestamp ? new Date(req.action_timestamp).toLocaleString() : "N/A"}</p>
                             </div>
                           </div>
                        </div>
                     </div>
                   </div>
                 </div>
               ))
             )}
          </div>
        )}

        {/* NETWORK MAP */}
        {activeTab === "network" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Stats Card */}
              <div className="col-span-1 rounded-[2rem] bg-gradient-to-br from-blue-500/20 to-purple-500/20 p-8 border border-white/10 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-20">
                  <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 2.88-2.88 7.19-5 9.88C9.92 16.21 7 11.85 7 9z"/><circle cx="12" cy="9" r="2.5"/></svg>
                </div>
                <h3 className="text-4xl font-extrabold text-white">{totalDevices}</h3>
                <p className="text-blue-200 text-sm font-bold uppercase tracking-widest mt-2">Active Devices Deployed</p>
              </div>
              
              <div className="col-span-1 md:col-span-2 rounded-[2rem] bg-white/5 p-8 border border-white/10 backdrop-blur-xl">
                 <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                   <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                   Regional Distribution
                 </h3>
                 <div className="space-y-4">
                    {sortedCities.length > 0 ? sortedCities.map(([city, count]: any, idx) => (
                      <div key={idx} className="relative group">
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="font-semibold text-white/80">{city}</span>
                          <span className="text-white/40">{count} units</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 relative"
                            style={{ width: `${(count / totalDevices) * 100}%` }}
                          >
                             <div className="absolute right-0 top-0 bottom-0 w-2 blur-[4px] bg-white/50" />
                          </div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-white/30 italic">No geographic data available yet.</p>
                    )}
                 </div>
              </div>
            </div>

            {/* Simulated Map Visual */}
            <div className="rounded-[2rem] bg-black/40 border border-white/10 h-[400px] w-full relative overflow-hidden flex items-center justify-center p-4">
               {/* Grid Background */}
               <div className="absolute inset-0" 
                 style={{ 
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '30px 30px'
                 }} 
               />
               <div className="relative z-10 text-center">
                 <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/30 mb-4 animate-pulse">
                   <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </div>
                 <h2 className="text-2xl font-bold text-white">Live Network Map</h2>
                 <p className="text-white/50 max-w-md mx-auto mt-2">Geospatial visualization module is initialized. As more devices come online with GPS coordinates, they will populate here.</p>
               </div>
            </div>
          </div>
        )}

        {/* USERS/ADMINS */}
        {activeTab === "users" && (
          <div className="space-y-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-5 rounded-[2rem] bg-white/5 p-6 md:p-8 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <h2 className="mb-6 text-xl font-bold border-b border-white/10 pb-4">Add New User / Admin</h2>
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70">Name</label>
                  <input type="text" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none transition-all focus:bg-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10" required />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70">Phone Number (Password)</label>
                  <input type="text" value={newTeamPhone} onChange={e => setNewTeamPhone(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none transition-all focus:bg-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10" required />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70">Role</label>
                  <select value={newTeamRole} onChange={e => setNewTeamRole(e.target.value)} className="w-full rounded-xl bg-neutral-900 border border-white/10 p-3 text-white outline-none transition-all focus:border-white/30 cursor-pointer">
                    <option value="team">Team / User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" className="w-full mt-2 rounded-xl bg-white p-3 font-bold text-black transition-all hover:bg-neutral-200 active:scale-[0.98] shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  Create Account
                </button>
              </form>
            </div>

            <div className="md:col-span-7 rounded-[2rem] bg-white/5 p-6 md:p-8 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <h2 className="mb-6 text-xl font-bold border-b border-white/10 pb-4">Manage Existing Accounts</h2>
              <div className="overflow-x-auto custom-scrollbar pr-2 max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wider">
                      <th className="p-3 font-semibold">User</th>
                      <th className="p-3 font-semibold hidden sm:table-cell">Phone (Pass)</th>
                      <th className="p-3 font-semibold">Role</th>
                      <th className="p-3 font-semibold text-right">Delete</th>
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


// end of file
