"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [teamName, setTeamName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [teamsList, setTeamsList] = useState<{name: string, role: string}[]>([]);
  const router = useRouter();

  useEffect(() => {
    async function fetchTeams() {
      const { data, error } = await supabase.from("teams").select("name, role");
      if (data && !error) {
        setTeamsList(data);
      }
    }
    fetchTeams();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (teamName && phoneNumber) {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .ilike("name", teamName)
        .eq("phone", phoneNumber)
        .single();

      if (error || !data) {
        alert("Incorrect Phone Number for this Account!");
        return;
      }

      localStorage.setItem("teamName", data.name);
      localStorage.setItem("role", data.role);
      localStorage.setItem("phoneNumber", phoneNumber);

      if (data.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 font-sans text-white relative overflow-hidden">
      {/* Background glow effects for liquid glass aesthetic */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-white opacity-5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-white opacity-5 blur-[120px] pointer-events-none" />
      
      <div className="z-10 w-full max-w-md transform rounded-[2rem] bg-white/5 p-10 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] transition-all duration-500 hover:shadow-[0_8px_40px_0_rgba(255,255,255,0.05)] text-center">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight">Logistics System</h1>
        <p className="mb-8 text-sm text-white/50">Enter your credentials to access the portal</p>
        
        <form onSubmit={handleLogin} className="space-y-6 text-left">
          <div className="group">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70 transition-colors group-hover:text-white">Account Name</label>
            <select
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full appearance-none rounded-xl bg-white/5 border border-white/10 p-4 text-white outline-none transition-all duration-300 focus:bg-white/10 focus:border-white/30 focus:ring-4 focus:ring-white/5 active:scale-[0.98] cursor-pointer"
              required
            >
              <option value="" disabled className="bg-black text-white">Select your account</option>
              {teamsList.map((t) => (
                <option key={t.name} value={t.name} className="bg-neutral-900 text-white">{t.name}</option>
              ))}
            </select>
          </div>

          <div className="group">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70 transition-colors group-hover:text-white">Phone Number (Password)</label>
            <input
              type="password"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white outline-none transition-all duration-300 focus:bg-white/10 focus:border-white/30 focus:ring-4 focus:ring-white/5 active:scale-[0.98] placeholder:text-white/20"
              placeholder="e.g. 9876543210"
              required
            />
          </div>

          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-white p-4 font-bold text-black transition-all duration-300 hover:bg-neutral-200 hover:-translate-y-1 active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
          >
            Enter Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}

