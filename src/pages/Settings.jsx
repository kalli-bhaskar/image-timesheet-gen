import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { localClient } from '@/api/localClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings2, Save } from 'lucide-react';
import { toast } from 'sonner';

const inputClass = 'mt-1 bg-slate-50 border-slate-200 text-slate-900';

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-slate-600 text-xs uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

export default function Settings() {
  const { user, checkAppState } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const initial = useMemo(
    () => ({
      full_name: user?.display_name || user?.full_name || '',
      city_state: user?.city_state || '',
      customer: user?.customer || '',
      classification: user?.classification || '',
      hourly_rate: user?.hourly_rate || '',
      per_diem: user?.per_diem || '',
      accommodation_allowance: user?.accommodation_allowance || '',
      stn_accommodation: user?.stn_accommodation || '',
      stn_rental: user?.stn_rental || '',
      stn_gas: user?.stn_gas || '',
      company_name: user?.company_name || '',
    }),
    [user]
  );

  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  if (!user?.setup_complete) return <Navigate to="/Setup" replace />;

  const isManager = user.user_role === 'manager';

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const saveSettings = async () => {
    setSaving(true);
    setError('');

    try {
      const payload = {
        full_name: form.full_name.trim() || user.full_name || 'Employee',
        display_name: form.full_name.trim() || user.display_name || user.full_name || 'Employee',
      };

      if (isManager) {
        payload.company_name = form.company_name.trim();
      } else {
        payload.city_state = form.city_state.trim();
        payload.customer = form.customer.trim() || 'N/A';
        payload.classification = form.classification.trim() || 'N/A';
        payload.hourly_rate = Number(form.hourly_rate || 0);
        payload.per_diem = form.per_diem.trim() || 'N/A';
        payload.accommodation_allowance = form.accommodation_allowance.trim() || 'N/A';
        payload.stn_accommodation = form.stn_accommodation.trim() || 'N/A';
        payload.stn_rental = form.stn_rental.trim() || 'N/A';
        payload.stn_gas = form.stn_gas.trim() || 'N/A';
      }

      await localClient.auth.updateMe(payload);
      await checkAppState();
      toast.success('Settings updated');
    } catch (e) {
      console.error('Failed saving settings', e);
      setError(e?.message || 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Update your setup information anytime</p>
      </div>

      <Card className="border-slate-200 rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-slate-900">
            <Settings2 className="w-4 h-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Full Name">
            <Input
              value={form.full_name}
              onChange={(e) => setField('full_name', e.target.value)}
              placeholder="Enter your name"
              className={inputClass}
            />
          </Field>

          {isManager ? (
            <Field label="Company Name">
              <Input
                value={form.company_name}
                onChange={(e) => setField('company_name', e.target.value)}
                placeholder="Acme Corp"
                className={inputClass}
              />
            </Field>
          ) : (
            <>
              <Field label="City/State">
                <Input
                  value={form.city_state}
                  onChange={(e) => setField('city_state', e.target.value)}
                  placeholder="Columbus, OH"
                  className={inputClass}
                />
              </Field>

              <Field label="Customer">
                <Input
                  value={form.customer}
                  onChange={(e) => setField('customer', e.target.value)}
                  placeholder="Customer"
                  className={inputClass}
                />
              </Field>

              <Field label="Classification Employee/Subcon">
                <Input
                  value={form.classification}
                  onChange={(e) => setField('classification', e.target.value)}
                  placeholder="Employee or Subcontractor"
                  className={inputClass}
                />
              </Field>

              <Field label="Hourly rate">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.hourly_rate}
                  onChange={(e) => setField('hourly_rate', e.target.value)}
                  placeholder="25.00"
                  className={inputClass}
                />
              </Field>

              <Field label="Per Diem">
                <Input
                  value={form.per_diem}
                  onChange={(e) => setField('per_diem', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Accommodation Allowance">
                <Input
                  value={form.accommodation_allowance}
                  onChange={(e) => setField('accommodation_allowance', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="STN Accommodation Yes/No">
                <Input
                  value={form.stn_accommodation}
                  onChange={(e) => setField('stn_accommodation', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="STN Rental Yes/No">
                <Input
                  value={form.stn_rental}
                  onChange={(e) => setField('stn_rental', e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="STN Gas Yes/No">
                <Input
                  value={form.stn_gas}
                  onChange={(e) => setField('stn_gas', e.target.value)}
                  className={inputClass}
                />
              </Field>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={saveSettings}
            disabled={saving}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
