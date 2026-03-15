import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { localClient } from '@/api/localClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Clock, ArrowRight, ArrowLeft, Building2, User } from 'lucide-react';

const inputClass = 'mt-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500';

function Field({ label, required, children }) {
  return (
    <div>
      <Label className="text-slate-300 text-sm">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function Setup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState('employee');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Common
  const [fullName, setFullName] = useState(user?.full_name || '');

  // Manager-only
  const [companyName, setCompanyName] = useState('');

  // Employee-only
  const [cityState, setCityState] = useState('');
  const [customer, setCustomer] = useState('');
  const [classification, setClassification] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [perDiem, setPerDiem] = useState('');
  const [accommodationAllowance, setAccommodationAllowance] = useState('');
  const [stnAccommodation, setStnAccommodation] = useState('');
  const [stnRental, setStnRental] = useState('');
  const [stnGas, setStnGas] = useState('');

  if (!user) return <Navigate to="/" replace />;
  if (user.setup_complete) return <Navigate to="/Dashboard" replace />;

  const step2Valid =
    fullName.trim() !== '' &&
    (selectedRole === 'manager' ? companyName.trim() !== '' : hourlyRate !== '');

  const handleSubmit = async () => {
    if (!step2Valid) return;
    setError('');
    setSaving(true);

    // Build the data — do NOT include 'role' (protected, admin-only)
    const data = {
      setup_complete: true,
      full_name: fullName,
      display_name: fullName,
      user_role: selectedRole, // stored as custom field, not the system role
    };

    if (selectedRole === 'manager') {
      data.company_name = companyName;
    } else {
      data.city_state = cityState || '';
      data.customer = customer || 'N/A';
      data.classification = classification || 'N/A';
      data.hourly_rate = parseFloat(hourlyRate) || 0;
      data.per_diem = perDiem || 'N/A';
      data.accommodation_allowance = accommodationAllowance || 'N/A';
      data.stn_accommodation = stnAccommodation || 'N/A';
      data.stn_rental = stnRental || 'N/A';
      data.stn_gas = stnGas || 'N/A';
    }

    try {
      await localClient.auth.updateMe(data);
      navigate('/Dashboard', { replace: true });
    } catch (e) {
      console.error('Setup error:', e);
      setError(e?.message || 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-start p-6 overflow-y-auto">
      <div className="w-full max-w-sm py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to TimeTrack</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Step {step} of 2 — {step === 1 ? 'Choose your role' : 'Complete your profile'}
          </p>
          {user?.email && <p className="text-slate-500 text-xs mt-1">{user.email}</p>}
        </div>

        {/* ── Step 1: Role ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-2xl p-6">
              <p className="text-white font-medium mb-4">What's your role?</p>
              <RadioGroup value={selectedRole} onValueChange={setSelectedRole} className="space-y-3">
                <label
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedRole === 'manager' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-700/50'
                  }`}
                >
                  <RadioGroupItem value="manager" id="manager" />
                  <Building2 className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-white font-medium">Manager</p>
                    <p className="text-slate-400 text-xs">Manage team timesheets &amp; export</p>
                  </div>
                </label>
                <label
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedRole === 'employee' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-700/50'
                  }`}
                >
                  <RadioGroupItem value="employee" id="employee" />
                  <User className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-white font-medium">Employee / Subcontractor</p>
                    <p className="text-slate-400 text-xs">Clock in/out &amp; track hours</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
            <Button
              className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base"
              onClick={() => setStep(2)}
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* ── Step 2: Details ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-2xl p-6 space-y-4">
              <p className="text-white font-medium">
                {selectedRole === 'manager' ? 'Manager Details' : 'Employee Details'}
              </p>

              {/* Common */}
              <Field label="Full Name" required>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  className={inputClass}
                />
              </Field>

              {/* Manager */}
              {selectedRole === 'manager' && (
                <Field label="Company Name" required>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Corp"
                    className={inputClass}
                  />
                </Field>
              )}

              {/* Employee */}
              {selectedRole === 'employee' && (
                <>
                  <Field label="City/State">
                    <Input
                      value={cityState}
                      onChange={(e) => setCityState(e.target.value)}
                      placeholder="Columbus, OH"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Customer">
                    <Input
                      value={customer}
                      onChange={(e) => setCustomer(e.target.value)}
                      placeholder="e.g. Microsoft"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Classification Employee/Subcon">
                    <Input
                      value={classification}
                      onChange={(e) => setClassification(e.target.value)}
                      placeholder="Employee or Subcontractor"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Hourly rate" required>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="25.00"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Per Diem">
                    <Input
                      value={perDiem}
                      onChange={(e) => setPerDiem(e.target.value)}
                      placeholder="Leave blank if N/A"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Accommodation Allowance">
                    <Input
                      value={accommodationAllowance}
                      onChange={(e) => setAccommodationAllowance(e.target.value)}
                      placeholder="Leave blank if N/A"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="STN Accommodation Yes/No">
                    <Input
                      value={stnAccommodation}
                      onChange={(e) => setStnAccommodation(e.target.value)}
                      placeholder="Yes or No"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="STN Rental Yes/No">
                    <Input
                      value={stnRental}
                      onChange={(e) => setStnRental(e.target.value)}
                      placeholder="Yes or No"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="STN Gas Yes/No">
                    <Input
                      value={stnGas}
                      onChange={(e) => setStnGas(e.target.value)}
                      placeholder="Yes or No"
                      className={inputClass}
                    />
                  </Field>

                </>
              )}
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-xl p-3">
                <p className="text-red-300 text-sm text-center">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pb-8">
              <Button
                variant="outline"
                className="py-6 border-slate-600 text-slate-300 hover:bg-slate-800 bg-transparent"
                onClick={() => setStep(1)}
                disabled={saving}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button
                className="flex-1 py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base"
                onClick={handleSubmit}
                disabled={saving || !step2Valid}
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Complete Setup'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}