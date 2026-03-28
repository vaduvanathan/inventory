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
  const [dailyReports, setDailyReports] = useState<any[]>([]);
  
  // Notification State
  const [notification, setNotification] = useState({ show: false, message: "", type: "info" as "success" | "error" | "info" });

  // Form States
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamPhone, setNewTeamPhone] = useState("");
  const [newTeamRole, setNewTeamRole] = useState("team");
  
  // Dashboard State
  const [activeTab, setActiveTab] = useState("inventory");
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [adminComment, setAdminComment] = useState<{[key: string]: string}>({});
  const [trackingInfo, setTrackingInfo] = useState<{[key: string]: {courier: string, id: string}}>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Manual Stock Add State
  const [manualStock, setManualStock] = useState({ team: "", devices: 0, sdCards: 0, chargers: 0 });
  
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
      fetchDailyReports();
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

  async function fetchDailyReports() {
    const { data, error } = await supabase
      .from("daily_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if(error) console.error("Fetch reports error:", error);
    if(data) setDailyReports(data);
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

    if (newStatus === "approved" && (!comment && !Object.keys(tracking).length)) {
       // Optional warning or check
    }

    // Standard Status Update (No RPC magic, just state change)
    const { error } = await supabase.from("requests").update({ 
      status: newStatus,
      admin_comment: comment,
      approved_by: adminName,
      action_timestamp: now
    }).eq("id", id);
    
    if (error) {
         showToast("Error updating request: " + error.message, "error");
    } else {
         showToast(`Request updated to ${newStatus.toUpperCase()}`, "success");
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

  const activeRequests = requests.filter(r => r.status === "sent" || r.status === "approved");
  const closedRequests = requests.filter(r => r.status === "shipped" || r.status === "denied" || r.status === "completed");
  const deployedRequests = requests.filter(r => r.status === "shipped" || r.status === "completed");

  const teamsStats: Record<string, { devices: number, sdCards: number, locations: Record<string, { devices: number, sdCards: number }> }> = {};
  
  // Initialize teams (Exclude admins from this tracking view)
    teams.filter(t => t.role !== "admin").forEach(t => {
      teamsStats[t.name] = { devices: 0, sdCards: 0, locations: {} };
  });

  // Aggregate holdings
  deployedRequests.forEach(r => {
      // Only aggregate if the team exists in our filtered map (i.e. is not an admin, or is a valid team)
      if (teamsStats[r.team]) {
        teamsStats[r.team].devices += (r.device_qty || 0);
        teamsStats[r.team].sdCards += (r.sd_card_qty || 0);

        const locKey = r.factory_name || r.location || "Unknown Factory";
        if (!teamsStats[r.team].locations[locKey]) {
          teamsStats[r.team].locations[locKey] = { devices: 0, sdCards: 0 };
        }
        teamsStats[r.team].locations[locKey].devices += (r.device_qty || 0);
        teamsStats[r.team].locations[locKey].sdCards += (r.sd_card_qty || 0);
      }
  });

  // Calculate actual deployed totals from requests for the Dashboard UI
  const calculatedDeployed = deployedRequests.reduce((acc, r) => ({
      devices: acc.devices + (r.device_qty || 0),
      sdCards: acc.sdCards + (r.sd_card_qty || 0),
      hubs: acc.hubs + (r.charger_hub_qty || 0)
  }), { devices: 0, sdCards: 0, hubs: 0 });

  // Function to update HQ Inventory Stock
  const updateHqStock = async (itemName: string, currentStock: number) => {
    const newStock = prompt(`Update stock for ${itemName}:`, String(currentStock));
    if (newStock !== null) {
      const stockNum = parseInt(newStock);
      if (!isNaN(stockNum) && stockNum >= 0) {
         const { error } = await supabase.from("inventory").update({ available_stock: stockNum }).eq("item_name", itemName);
         if (error) {
            showToast("Failed to update stock: " + error.message, "error");
         } else {
            showToast("Stock updated successfully", "success");
            fetchInventory();
         }
      } else {
        showToast("Invalid stock number", "error");
      }
    }
  };

  const markAsShipped = async (req: any) => {
      const tracking = trackingInfo[req.id] || { courier: "", id: "" };
      
      if (!tracking.courier || !tracking.id) {
          if (!confirm("No tracking info entered. Mark as shipped anyway?")) return;
      }

      // 1. Deduct from Inventory (Manual calculation to avoid complex RPC requirements)
      // Find current stock
      const deviceStock = inventory.find(i => i.item_name === "Device")?.available_stock || 0;
      const sdStock = inventory.find(i => i.item_name === "SD Card")?.available_stock || 0;
      const hubStock = inventory.find(i => i.item_name === "Charging Hub")?.available_stock || 0;

      // Check sufficiency (Visual warning only, we allow negative for admin override)
      if (req.device_qty > deviceStock) alert(`Warning: Not enough devices in HQ (${deviceStock}). Stock will go negative.`);

      // Update Inventory Tables
      if (req.device_qty > 0) await supabase.from("inventory").update({ available_stock: deviceStock - req.device_qty }).eq("item_name", "Device");
      if (req.sd_card_qty > 0) await supabase.from("inventory").update({ available_stock: sdStock - req.sd_card_qty }).eq("item_name", "SD Card");
      if (req.charger_hub_qty > 0) await supabase.from("inventory").update({ available_stock: hubStock - req.charger_hub_qty }).eq("item_name", "Charging Hub");

      // 2. Update Request Status
      const { error } = await supabase.from("requests").update({ 
          status: "shipped", 
          action_timestamp: new Date().toISOString()
      }).eq("id", req.id);

      if (error) {
          showToast("Error updating request: " + error.message, "error");
      } else {
          showToast("Request marked as SHIPPED & Inventory deducted", "success");
          fetchRequests();
          fetchInventory();
          setExpandedId(null);
      }
  };


  // Manual Stock Update Handler
  const handleManualStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualStock.team) {
        showToast("Please select a team", "error");
        return;
    }
    
    // Create a request to represent this manual stock adjustment
    const { error } = await supabase.from("requests").insert([{
        team: manualStock.team,
        factory_name: "HQ Manual Allocation",
        person_name: adminName,
        phone_number: "-",
        city: "HQ",
        state: "HQ",
        location: "Inventory Adjustment",
        pincode: "-",
        device_qty: Number(manualStock.devices),
        sd_card_qty: Number(manualStock.sdCards),
        charger_hub_qty: Number(manualStock.chargers),
        status: "approved", // Considered sent immediately
        approved_by: adminName,
        action_timestamp: new Date().toISOString(),
        admin_comment: "Manual stock allocation by admin",
        item: "Stock Update",
        quantity: Number(manualStock.devices) + Number(manualStock.sdCards) + Number(manualStock.chargers)
    }]);

    if (error) {
        showToast("Error adding stock: " + error.message, "error");
    } else {
        showToast("Stock allocated successfully!", "success");
        setManualStock({ team: "", devices: 0, sdCards: 0, chargers: 0 });
        fetchRequests();
    }
  };

  // Stats for "Network" tab
  // const totalDevices = requests.filter(r => r.status === "approved").reduce((sum, r) => sum + (r.device_qty || 0), 0);
  // const cities = requests.reduce((acc: any, r) => {
  //   const city = r.city || "Unknown";
  //   acc[city] = (acc[city] || 0) + (r.device_qty || 0);
  //   return acc;
  // }, {});
  // const sortedCities = Object.entries(cities).sort(([,a]: any, [,b]: any) => b - a);

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
          <button onClick={() => setActiveTab("inventory")} className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === "inventory" ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>Inventory Status <span className="ml-2 bg-black/10 px-2 py-0.5 rounded-full text-xs">HQ</span></button>
          <button onClick={() => setActiveTab("active")} className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === "active" ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>Active Tickets <span className="ml-2 bg-black/10 px-2 py-0.5 rounded-full text-xs">{activeRequests.length}</span></button>
          <button onClick={() => setActiveTab("closed")} className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === "closed" ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>Closed Requests <span className="ml-2 bg-black/10 px-2 py-0.5 rounded-full text-xs">{closedRequests.length}</span></button>
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
                           {req.status === "approved" ? (
                              <span className="px-2.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded font-semibold text-[10px] tracking-wider uppercase border border-yellow-500/30">Processing Shipment</span>
                           ) : (
                              <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 rounded font-semibold text-[10px] tracking-wider uppercase border border-blue-500/30">Needs Review</span>
                           )}
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
                           
                           {/* ADMIN RESOLUTION AREA */}
                           {req.status === "approved" ? (
                              /* 1. SHIPPING WORKFLOW (For Approved Requests) */
                              <div className="col-span-1 md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
                                 <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-yellow-200">Step 2: Logistics & Dispatch</h4>
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-[10px] uppercase text-white/40 mb-1">Courier Service</label>
                                        <input 
                                          type="text" 
                                          placeholder="e.g. DTDC, Delhivery" 
                                          className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500/50"
                                          value={trackingInfo[req.id]?.courier || ""}
                                          onChange={(e) => setTrackingInfo({...trackingInfo, [req.id]: {...trackingInfo[req.id], courier: e.target.value}})}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] uppercase text-white/40 mb-1">Tracking ID</label>
                                        <input 
                                          type="text" 
                                          placeholder="Tracking Number" 
                                          className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500/50"
                                          value={trackingInfo[req.id]?.id || ""}
                                          onChange={(e) => setTrackingInfo({...trackingInfo, [req.id]: {...trackingInfo[req.id], id: e.target.value}})}
                                        />
                                      </div>
                                    </div>
                                 </div>
                                 <div className="flex flex-col justify-end gap-3">
                                    <div className="text-xs text-white/50 bg-white/5 p-3 rounded-lg border border-white/5">
                                      <p className="mb-1"><span className="text-yellow-400 font-bold">Caution:</span> Clicking "Ship" will deduct items from HQ inventory.</p>
                                    </div>
                                    <button 
                                      onClick={() => markAsShipped(req)} 
                                      className="w-full bg-blue-500 text-white shadow-lg shadow-blue-500/20 py-3 rounded-xl font-bold hover:bg-blue-400 transition-all duration-300 flex items-center justify-center gap-2"
                                    >
                                      <span>Dispatch & Update Stock</span>
                                      <span className="text-xl">✈</span>
                                    </button>
                                 </div>
                              </div>
                           ) : (
                              /* 2. APPROVAL WORKFLOW (For Sent Requests) */
                              <div className="flex flex-col gap-3 col-span-1 md:col-start-4">
                                <label className="text-[10px] uppercase text-white/40 font-bold tracking-wider">Step 1: Admin Resolution</label>
                                <textarea 
                                  placeholder="Reasoning here..."
                                  className="w-full h-24 bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 resize-none transition-all"
                                  value={adminComment[req.id] || ""}
                                  onChange={(e) => setAdminComment({...adminComment, [req.id]: e.target.value})}
                                />
                                <div className="flex flex-col gap-2">
                                  <button onClick={() => updateStatus(req.id, "approved")} className="w-full bg-green-500/20 text-green-300 border border-green-500/30 py-3 rounded-xl font-bold hover:bg-green-500 hover:text-white transition-all duration-300">Approve for Shipping</button>
                                  <button onClick={() => updateStatus(req.id, "denied")} className="w-full bg-red-500/20 text-red-300 border border-red-500/30 py-3 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all duration-300">Deny</button>
                                </div>
                              </div>
                           )}
                        </div>
                     </div>
                   </div>
                 </div>
               ))
             )}
          </div>
        )}

        {/* INVENTORY & TEAM HEALTH TAB */}
        {activeTab === "inventory" && (
          <div className="space-y-12">
            
            {/* 1. HQ Inventory */}
            <div>
               <h2 className="text-xl font-bold mb-6 border-b border-white/10 pb-2">HQ Warehouse Stock</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {inventory.length === 0 ? (
                    <div className="col-span-4 text-center py-10 text-white/40 italic">Inventory data currently unavailable</div>
                 ) : (
                    inventory.map((item) => (
                      <div key={item.item_name} className="relative overflow-hidden rounded-[2rem] bg-white/5 border border-white/10 p-6 backdrop-blur-2xl ring-1 ring-white/10 transition-all hover:bg-white/10">
                         <div className="flex items-center justify-between mb-4">
                           <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300">
                             <div className="w-5 h-5 bg-current rounded opacity-50" />
                           </div>
                           <span className="text-xs uppercase tracking-widest font-bold text-white/40">Item</span>
                         </div>
                         <h3 className="text-2xl font-bold text-white mb-1">{item.item_name}</h3>
                         <div className="mt-6 flex justify-between items-end">
                            <div 
                              className="group cursor-pointer p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
                              title="Click to edit stock"
                              onClick={() => updateHqStock(item.item_name, item.available_stock)}
                            >
                               <span className="text-xs text-white/60 block mb-1 group-hover:text-blue-300">Available (HQ) ✎</span>
                               <span className="text-3xl font-extrabold text-green-400 group-hover:text-white transition-colors">{item.available_stock}</span>
                            </div>
                            <div className="text-right">
                               <span className="text-xs text-white/60 block mb-1">Deployed</span>
                               <span className="text-xl font-bold text-blue-400">
                                 {
                                    item.item_name === "Device" ? calculatedDeployed.devices :
                                    item.item_name === "SD Card" ? calculatedDeployed.sdCards :
                                    item.item_name === "Charging Hub" ? calculatedDeployed.hubs : item.deployed_stock
                                 }
                               </span>
                            </div>
                         </div>
                      </div>
                    ))
                 )}
               </div>
            </div>

            {/* 2. Team Health Table */}
            <div>
               <h2 className="text-xl font-bold mb-6 border-b border-white/10 pb-2">Team Allocation & Health</h2>
               <div className="overflow-x-auto rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl">
                 <table className="w-full text-left text-sm">
                   <thead>
                     <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/50">
                       <th className="p-4 font-semibold">Team</th>
                       <th className="p-4 font-semibold text-center">Devices Held</th>
                       <th className="p-4 font-semibold text-center">SD Cards Stock</th>
                       <th className="p-4 font-semibold text-center">Est. Supply Days</th>
                       <th className="p-4 font-semibold text-center">Health Status</th>
                     </tr>
                   </thead>
                   <tbody>
                     {Object.entries(teamsStats).map(([tName, stats]) => {
                        const dailyBurn = stats.devices || 1; // Avoid div by zero logically, but physically 0 devices means infinite days
                        const daysLeft = stats.devices > 0 ? (stats.sdCards / stats.devices) : 999;
                      const latestReport = dailyReports.find((r) => r.team === tName);
                      const workersToday = latestReport?.workers_today || 0;
                      const workersProjected = latestReport?.workers_projected || 0;
                      const factoryWorkers = latestReport?.factory_total_workers || 0;
                      const utilization = stats.devices > 0 ? Math.min(100, Math.round((workersToday / stats.devices) * 100)) : 0;
                        let statusColor = "text-green-400";
                        let statusText = "Adequate";
                        let bgColor = "bg-green-500/10 border-green-500/20";
                        
                        if (stats.devices > 0) {
                           if (daysLeft < 3) {
                              statusColor = "text-red-400";
                              statusText = "CRITICAL";
                              bgColor = "bg-red-500/20 border-red-500/30 animate-pulse";
                           } else if (daysLeft < 6) {
                              statusColor = "text-yellow-400";
                              statusText = "Warning";
                              bgColor = "bg-yellow-500/10 border-yellow-500/20";
                           }
                        }

                        return (
                          <div key={tName}>
                            <tr className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setExpandedTeam(expandedTeam === tName ? null : tName)}>
                               <td className="p-4 font-bold text-white flex items-center gap-2">
                               {Object.keys(stats.locations).length > 0 && <span className={`text-[10px] text-white/50 transition-transform ${expandedTeam === tName ? 'rotate-180' : ''}`}>▼</span>}
                                  {tName}
                               </td>
                               <td className="p-4 text-center text-lg font-mono">{stats.devices}</td>
                               <td className="p-4 text-center text-lg font-mono">{stats.sdCards}</td>
                               <td className="p-4 text-center">
                                  {stats.devices === 0 ? <span className="text-white/30">-</span> : <span className="font-bold text-white">{daysLeft.toFixed(1)} Days</span>}
                               </td>
                               <td className="p-4 text-center">
                                  {stats.devices === 0 ? (
                                    <span className="px-3 py-1 rounded text-[10px] uppercase bg-white/5 text-white/30 border border-white/5">Inactive</span>
                                  ) : (
                                    <span className={`px-3 py-1 rounded text-[10px] uppercase font-bold border ${bgColor} ${statusColor}`}>
                                      {statusText}
                                    </span>
                                  )}
                               </td>
                             </tr>
                             
                             {/* Expanded Team Details */}
                              {expandedTeam === tName && (
                                <tr className="bg-white/[0.02]">
                                   <td colSpan={5} className="p-0 animate-in fade-in slide-in-from-top-2 duration-300">
                                      <div className="p-6 pl-12 border-b border-white/10">
                                         
                                         {/* 1. Daily Usage & Projection Stats */}
                                         <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                               <h4 className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Today's Usage</h4>
                                               <div className="flex items-end gap-2">
                                                <span className="text-2xl font-bold text-white">{workersToday}</span>
                                                  <span className="text-xs text-white/40 mb-1">Workers deployed</span>
                                               </div>
                                            </div>
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                               <h4 className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Projected (Next 7 Days)</h4>
                                               <div className="flex items-end gap-2">
                                                <span className="text-2xl font-bold text-blue-300">{workersProjected}</span>
                                                  <span className="text-xs text-white/40 mb-1">Estimated workers</span>
                                               </div>
                                            </div>
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                              <h4 className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Factory Workforce</h4>
                                               <div className="flex items-end gap-2">
                                                <span className="text-2xl font-bold text-green-300">{factoryWorkers}</span>
                                                <span className="text-xs text-white/40 mb-1">Total workers at team factories</span>
                                               </div>
                                            </div>
                                         </div>

                                          <div className="mb-6 p-3 rounded-lg border border-white/10 bg-white/5 text-xs text-white/60 flex flex-wrap gap-6">
                                            <span>Utilization: <span className="text-white font-semibold">{utilization}%</span></span>
                                            <span>Estimated SD runway at projected usage: <span className="text-white font-semibold">{workersProjected > 0 ? (stats.sdCards / workersProjected).toFixed(1) : "-"} days</span></span>
                                          </div>

                                         {/* 2. Factory Breakdown Table */}
                                         <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">Active Factories ({Object.keys(stats.locations).length})</h4>
                                         {Object.keys(stats.locations).length === 0 ? (
                                            <div className="text-white/20 text-xs italic p-4 border border-dashed border-white/10 rounded-lg text-center">
                                               No active factory deployments recorded for this team.
                                            </div>
                                         ) : (
                                            <div className="overflow-hidden rounded-lg border border-white/10">
                                               <table className="w-full text-left text-xs">
                                                  <thead className="bg-white/5 text-white/40">
                                                     <tr>
                                                        <th className="p-3 font-medium">Factory Name / Location</th>
                                                        <th className="p-3 font-medium text-right">Devices</th>
                                                        <th className="p-3 font-medium text-right">SD Cards</th>
                                                        <th className="p-3 font-medium text-right">Est. Workers</th>
                                                     </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-white/5">
                                                     {Object.entries(stats.locations).map(([loc, lStats]: [string, any]) => (
                                                        <tr key={loc} className="hover:bg-white/5 transition-colors">
                                                           <td className="p-3 text-white/80 font-medium">{loc}</td>
                                                           <td className="p-3 text-right font-mono text-blue-200">{lStats.devices}</td>
                                                           <td className="p-3 text-right font-mono text-fuchsia-200">{lStats.sdCards}</td>
                                                          <td className="p-3 text-right text-white/80 font-mono">{stats.devices > 0 ? Math.round((lStats.devices / stats.devices) * workersToday) : 0}</td>
                                                        </tr>
                                                     ))}
                                                  </tbody>
                                               </table>
                                            </div>
                                         )}
                                      </div>
                                   </td>
                                </tr>
                             )}
                          </div>
                        );
                     })}
                   </tbody>
                 </table>
               </div>
            </div>

            {/* 3. Manual Allocation */}
            <div className="rounded-[2rem] border border-white/10 bg-blue-500/5 p-8 backdrop-blur-xl">
               <h3 className="text-lg font-bold text-blue-200 mb-4">Send Stock to Team (Manual Allocation)</h3>
               <p className="text-sm text-white/50 mb-6 max-w-2xl">Use this strictly to record devices/cards physically handed over or shipped outside the normal request flow. This will immediately increment their holding count.</p>
               
               <form onSubmit={handleManualStock} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-1">
                     <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">Team</label>
                     <select 
                       className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-white outline-none focus:border-blue-500/50"
                       value={manualStock.team}
                       onChange={(e) => setManualStock({...manualStock, team: e.target.value})}
                     >
                        <option value="">Select Team...</option>
                        {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">Devices</label>
                     <input 
                       type="number" min="0" 
                       className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-white outline-none focus:border-blue-500/50"
                       value={manualStock.devices}
                       onChange={(e) => setManualStock({...manualStock, devices: Number(e.target.value)})}
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">SD Cards</label>
                     <input 
                       type="number" min="0" 
                       className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-white outline-none focus:border-blue-500/50"
                       value={manualStock.sdCards}
                       onChange={(e) => setManualStock({...manualStock, sdCards: Number(e.target.value)})}
                     />
                  </div>
                  <div>
                     <button type="submit" className="w-full rounded-xl bg-blue-500 text-white font-bold p-3 shadow-lg hover:bg-blue-400 transition-colors">
                        Add to Stock
                     </button>
                  </div>
               </form>
            </div>

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
                     ${req.status !== "denied" ? "border-green-500/20 hover:border-green-500/40" : "border-red-500/20 hover:border-red-500/40"}`}
                 >
                   <div 
                     className="flex flex-col md:flex-row justify-between md:items-center gap-4 cursor-pointer"
                     onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                   >
                     <div className="flex items-center gap-4">
                       <div className={`h-12 w-12 rounded-full border flex items-center justify-center text-lg font-bold shrink-0 ${req.status !== 'denied' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                         {req.status !== 'denied' ? '✓' : '×'}
                       </div>
                       <div>
                         <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
                           Ticket {formatTicketId(req.id)}
                           <span className={`px-2.5 py-0.5 rounded font-semibold text-[10px] tracking-wider uppercase border ${req.status !== "denied" ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}`}>
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
                           <div className={`p-4 rounded-xl border flex flex-col gap-2 flex-1 ${req.status !== 'denied' ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
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
