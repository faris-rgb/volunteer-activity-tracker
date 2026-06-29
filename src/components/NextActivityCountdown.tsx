"use client";

import React, { useState, useEffect } from "react";
import { Clock, AlertCircle } from "lucide-react";

interface NextActivityCountdownProps {
  activityTitle: string;
  activityDate: string;
  activityTime: string;
  location: string;
}

export default function NextActivityCountdown({ 
  activityTitle, 
  activityDate, 
  activityTime,
  location
}: NextActivityCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isOver: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isOver: false });

  useEffect(() => {
    // Parse Date and Time
    // Date format: YYYY-MM-DD
    // Time format: HH:MM AM/PM
    const parseTargetDate = () => {
      try {
        const datePart = activityDate; // e.g., "2026-06-28"
        
        let hours = 9;
        let minutes = 0;
        
        const timeMatch = activityTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeMatch) {
          hours = parseInt(timeMatch[1], 10);
          minutes = parseInt(timeMatch[2], 10);
          const isPm = timeMatch[3].toUpperCase() === "PM";
          
          if (isPm && hours !== 12) hours += 12;
          if (!isPm && hours === 12) hours = 0;
        }
        
        const target = new Date(`${datePart}T${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`);
        return target;
      } catch (err) {
        console.error("Failed to parse activity target date:", err);
        return new Date(Date.now() + 86400000); // fallback 1 day in future
      }
    };

    const targetDate = parseTargetDate();

    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime();
      
      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isOver: false
      };
    };

    setTimeLeft(calculateTimeLeft());
    
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [activityDate, activityTime]);

  if (timeLeft.isOver) {
    return (
      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-6 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> Live Action Now
          </span>
          <h3 className="text-xl font-extrabold text-white">{activityTitle}</h3>
          <p className="text-xs text-slate-400">This campaign has started. Mark volunteer check-ins!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-slate-950/80 to-slate-900/60 border border-slate-900 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="space-y-1">
        <span className="text-xs text-amber-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-amber-400 animate-pulse" /> Next Activity Starts In
        </span>
        <h3 className="text-xl font-extrabold text-white tracking-tight">{activityTitle}</h3>
        <p className="text-xs text-slate-500">Site: <span className="font-semibold text-slate-400">{location}</span></p>
      </div>

      {/* Countdown Digits */}
      <div className="flex items-center gap-3">
        {[
          { label: "Days", val: timeLeft.days },
          { label: "Hrs", val: timeLeft.hours },
          { label: "Min", val: timeLeft.minutes },
          { label: "Sec", val: timeLeft.seconds },
        ].map((unit, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl h-14 w-14 flex items-center justify-center font-bold text-lg text-emerald-400 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
              {unit.val.toString().padStart(2, "0")}
            </div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-1.5">{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
