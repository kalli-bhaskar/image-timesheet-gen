import { User, Clock, DollarSign } from 'lucide-react';

export default function EmployeeCard({ name, totalHours, estimatedPay }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
          <User className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{name}</p>
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-sm text-slate-600">{totalHours.toFixed(1)}h</span>
        </div>
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-green-500" />
          <span className="text-sm font-medium text-green-700">${estimatedPay.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}