"use client";

import React from "react";
import { Icon as LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  Icon: React.ComponentType<any>;
}

export default function StatCard({ title, value, Icon }: StatCardProps) {
  return (
    <div className="flex items-center space-x-4 rounded-xl bg-slate-800 p-4 shadow-lg transition-colors hover:bg-slate-700">
      <Icon className="h-8 w-8 text-emerald-400" />
      <div>
        <p className="text-sm font-medium text-slate-400">{title}</p>
        <p className="text-xl font-bold text-slate-100">{value}</p>
      </div>
    </div>
  );
}
