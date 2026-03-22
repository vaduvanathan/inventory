"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [teamName, setTeamName] = useState("");
  const [requests, setRequests] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("role");
    const storedTeam = localStorage.getItem("teamName");
    
    if (!storedTeam || role === "admin") {
      router.push("/");
    } else {
      setTeamName(storedTeam);
      fetchRequests(storedTeam);
    }
  }, [router]);

  async function fetchRequests(team: string) {
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .eq("team", team)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    if (data) setRequests(data);
  }

  const handleNewRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const dQty = Number(formData.get("device_qty")) || 0;
    const sQty = Number(formData.get("sd_card_qty")) || 0;
    const cQty = Number(formData.get("charger_hub_qty")) || 0;

    if (dQty === 0 && sQty === 0 && cQty === 0) {
      alert("Please request at least one item (Device, SD Card, or Charger Hub).");
      return;
    }

    const newRequest = {
      team: teamName,
      factory_name: formData.get("factory_name"),
      person_name: formData.get("person_name"),
      phone_number: formData.get("phone_number"),
      location: formData.get("location"), // Full Address
      pincode: formData.get("pincode"),
      poc: formData.get("poc") || "",
      device_qty: dQty,
      sd_card_qty: sQty,
      charger_hub_qty: cQty,
      user_comment: formData.get("user_comment") || "",
      status: "sent",
      item: "Multiple items",
      quantity: dQty + sQty + cQty
    };

    const { error } = await supabase.from("requests").insert([newRequest]);
    
    if (!error) {
      fetchRequests(teamName);
      (e.target as HTMLFormElement).reset();
      alert("Request submitted successfully!");
    } else {
      console.error("Supabase Error: ", error);
      alert("Error submitting request: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Team Dashboard: {teamName}</h1>
          <button 
            onClick={() => { localStorage.clear(); router.push("/"); }}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Logout
          </button>
        </header>

        <div className="grid gap-8 md:grid-cols-2">
          {/* New Request Form */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold border-b pb-2">Create New Request</h2>
            <form onSubmit={handleNewRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Factory Name *</label>
                  <input name="factory_name" type="text" className="w-full rounded border p-2" required />
                </div>
                <div>
                  <label className="block text-sm font-medium">Contact Person Name *</label>
                  <input name="person_name" type="text" className="w-full rounded border p-2" required />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Phone Number *</label>
                  <input name="phone_number" type="text" className="w-full rounded border p-2" required />
                </div>
                <div>
                  <label className="block text-sm font-medium">Pincode *</label>
                  <input name="pincode" type="text" className="w-full rounded border p-2" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Complete Address *</label>
                <textarea name="location" className="w-full rounded border p-2" required rows={2}></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium">POC in Factory (Optional)</label>
                <input name="poc" type="text" className="w-full rounded border p-2" />
              </div>

              <div className="border-t pt-2">
                <label className="block text-md font-semibold mb-2">Items Requested (Enter Quantities)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600">Devices</label>
                    <input name="device_qty" type="number" min="0" defaultValue="0" className="w-full rounded border p-2" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">SD Cards</label>
                    <input name="sd_card_qty" type="number" min="0" defaultValue="0" className="w-full rounded border p-2" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">Charger Hubs</label>
                    <input name="charger_hub_qty" type="number" min="0" defaultValue="0" className="w-full rounded border p-2" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Additional Comments</label>
                <textarea name="user_comment" className="w-full rounded border p-2" rows={2}></textarea>
              </div>

              <button type="submit" className="w-full rounded bg-green-600 p-3 font-bold text-white hover:bg-green-700">
                Submit Request
              </button>
            </form>
          </div>

          {/* Current Status Tracker */}
          <div className="rounded-lg bg-white p-6 shadow flex flex-col h-full">
            <h2 className="mb-4 text-xl font-semibold border-b pb-2">My Requests</h2>
            {requests.length === 0 ? (
              <p className="text-gray-500">No requests submitted yet.</p>
            ) : (
              <div className="space-y-4 overflow-y-auto flex-1 h-96">
                {requests.map((req, i) => (
                  <div key={i} className="rounded border p-4 cursor-pointer hover:bg-gray-50 transition" onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-bold">Request #{req.id}</span>
                      <span className={`px-2 py-1 rounded text-xs text-white ${req.status === "sent" ? "bg-blue-500" : req.status === "approved" ? "bg-green-500" : "bg-red-500"}`}>
                        {req.status === "sent" ? "Pending" : req.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{req.factory_name || req.team}</p>
                    <p className="text-sm text-gray-500">Submitted: {new Date(req.created_at).toLocaleString()}</p>
                    
                    {expandedId === req.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 text-sm space-y-2 bg-gray-50 p-3 rounded">
                        <div className="grid grid-cols-2 gap-2">
                          <p><strong>Person:</strong> {req.person_name}</p>
                          <p><strong>Phone:</strong> {req.phone_number}</p>
                          <p><strong>Pincode:</strong> {req.pincode}</p>
                          <p><strong>POC:</strong> {req.poc || "N/A"}</p>
                        </div>
                        <p><strong>Address:</strong> {req.location}</p>
                        
                        <div className="bg-blue-50 p-2 rounded">
                          <p className="font-semibold">Items requested:</p>
                          <ul className="list-disc list-inside ml-4">
                            {req.device_qty > 0 && <li>{req.device_qty}x Devices</li>}
                            {req.sd_card_qty > 0 && <li>{req.sd_card_qty}x SD Cards</li>}
                            {req.charger_hub_qty > 0 && <li>{req.charger_hub_qty}x Charger Hubs</li>}
                          </ul>
                        </div>

                        {req.user_comment && (
                          <p><strong>My Comments:</strong> {req.user_comment}</p>
                        )}

                        {(req.status === "approved" || req.status === "denied") && (
                          <div className={`p-2 rounded mt-2 ${req.status === "approved" ? "bg-green-50" : "bg-red-50"}`}>
                            <p><strong>Action by:</strong> {req.approved_by || "Admin"}</p>
                            {req.action_timestamp && <p><strong>Time:</strong> {new Date(req.action_timestamp).toLocaleString()}</p>}
                            {req.admin_comment && <p><strong>Admin Note:</strong> {req.admin_comment}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

