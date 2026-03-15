import React, { useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localClient } from '@/api/localClient';
import { Navigate, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { calculateHours, getPayrollPeriod, formatTime } from '../components/timeUtils';
import CameraCapture from '../components/CameraCapture';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, CheckCircle2, Clock, Camera, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const BACKEND_BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8765').replace(/\/$/, '');
const FALLBACK_CITY_TO_TAG = new Map([
  ['columbus', 'CLB'],
  ['lancaster', 'LCT'],
  ['newark', 'NBY'],
]);
const FALLBACK_COUNTY_TO_TAG = new Map([
  ['franklin', 'CLB'],
  ['fairfield', 'LCT'],
  ['licking', 'NBY'],
]);

function normalizeLocationTag(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeLocationText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/county/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickUserField(user, ...keys) {
  for (const key of keys) {
    const value = user?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

async function analyzeImageWithBackend(file) {
  if (!file) return null;
  const formData = new FormData();
  formData.append('files', file);

  const response = await fetch(`${BACKEND_BASE_URL}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Analyze failed with status ${response.status}`);
  }

  const json = await response.json();
  return json?.results?.[0] || null;
}

function toMetaFallback({ timestamp, locationTag, photoUrl }) {
  if (!timestamp) return null;
  return {
    timestamp,
    location_tag: locationTag || '',
    filename: photoUrl || 'image',
    crop: { strategy: 'frontend-fallback' },
  };
}

function getDurationMinutes(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

async function submitShiftMetaToBackend({ clockInMeta, clockOutMeta, profile, actor }) {
  const payload = {
    clock_in: clockInMeta,
    clock_out: clockOutMeta,
    profile,
    ...(actor || {}),
  };

  const response = await fetch(`${BACKEND_BASE_URL}/submit_shift_meta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `submit_shift_meta failed with status ${response.status}`);
  }

  return response.json();
}

export default function ClockAction() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [captureFlow, setCaptureFlow] = useState(null); // { action: 'in'|'out', mode: 'camera'|'upload' }
  const [success, setSuccess] = useState(null);
  const [locationMismatch, setLocationMismatch] = useState(null);

  if (!user?.setup_complete) return <Navigate to="/Setup" replace />;

  const { data: entries = [] } = useQuery({
    queryKey: ['my-entries', user.email],
    queryFn: () => localClient.entities.TimesheetEntry.filter({ employee_email: user.email }, '-created_date', 10),
  });

  const { data: locationTags = [] } = useQuery({
    queryKey: ['location-tags'],
    queryFn: () => localClient.locationTags.list({ includeInactive: false }),
  });

  const tagContext = useMemo(() => {
    const activeCodes = new Set(locationTags.map((tag) => normalizeLocationTag(tag.code)).filter(Boolean));
    const countyToTag = new Map();
    const cityToTag = new Map();
    for (const tag of locationTags) {
      const county = normalizeLocationText(tag.county_name);
      const city = normalizeLocationText(tag.data_center_location);
      const code = normalizeLocationTag(tag.code);
      if (county && code) countyToTag.set(county, code);
      if (city && code) cityToTag.set(city, code);
    }
    for (const [county, code] of FALLBACK_COUNTY_TO_TAG.entries()) {
      if (!countyToTag.has(county)) countyToTag.set(county, code);
      activeCodes.add(code);
    }
    for (const [city, code] of FALLBACK_CITY_TO_TAG.entries()) {
      if (!cityToTag.has(city)) cityToTag.set(city, code);
      activeCodes.add(code);
    }
    return { activeCodes, countyToTag, cityToTag };
  }, [locationTags]);

  const activeEntry = entries.find((e) => e.status === 'clocked_in');

  const clockInMutation = useMutation({
    mutationFn: async ({ photoUrl, timestamp, imageMeta }) => {
      const today = format(new Date(timestamp), 'yyyy-MM-dd');
      const locationTag = imageMeta?.location_tag || '';
      await localClient.entities.TimesheetEntry.create({
        employee_email: user.email,
        employee_name: user.display_name || user.full_name || 'N/A',
        date: today,
        data_center_location: locationTag,
        location_source: imageMeta?.location_tag ? 'backend_ocr' : 'image_metadata_pending',
        city_state: user.city_state || 'N/A',
        customer: user.customer || 'N/A',
        classification: user.classification || 'N/A',
        hourly_rate: user.hourly_rate || 0,
        per_diem: user.per_diem || 'N/A',
        accommodation_allowance: user.accommodation_allowance || 'N/A',
        time_in: timestamp,
        time_out: '',
        total_hours: '0:00',
        hours_decimal: 0,
        stn_accommodation: user.stn_accommodation || 'N/A',
        stn_rental: user.stn_rental || 'N/A',
        stn_gas: user.stn_gas || 'N/A',
        comment: 'N/A',
        clock_in_photo_url: photoUrl,
        clock_out_photo_url: '',
        clock_in_meta: imageMeta || toMetaFallback({ timestamp, locationTag, photoUrl }),
        payroll_period: getPayrollPeriod(timestamp),
        status: 'clocked_in',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-entries'] });
      setCaptureFlow(null);
      setSuccess('in');
      toast.success('Clocked in successfully!');
      setTimeout(() => setSuccess(null), 3000);
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async ({ photoUrl, timestamp, imageMeta }) => {
      const { totalHours, hoursDecimal } = calculateHours(activeEntry.time_in, timestamp);
      await localClient.entities.TimesheetEntry.update(activeEntry.id, {
        time_out: timestamp,
        total_hours: totalHours,
        hours_decimal: hoursDecimal,
        clock_out_photo_url: photoUrl,
        clock_out_meta: imageMeta || toMetaFallback({ timestamp, locationTag: activeEntry.data_center_location, photoUrl }),
        status: 'completed',
      });

      const clockInMeta = activeEntry.clock_in_meta || toMetaFallback({
        timestamp: activeEntry.time_in,
        locationTag: activeEntry.data_center_location,
        photoUrl: activeEntry.clock_in_photo_url,
      });
      const clockOutMeta = imageMeta || toMetaFallback({
        timestamp,
        locationTag: activeEntry.data_center_location,
        photoUrl,
      });
      const profile = {
        full_name: user.full_name || user.display_name || '',
        city_state: user.city_state || 'Columbus, OH',
        customer: user.customer || 'N/A',
        classification: user.classification || 'N/A',
        hourly_rate: user.hourly_rate || 0,
        per_diem: user.per_diem || 'N/A',
        accommodation_allowance: user.accommodation_allowance || 'N/A',
        stn_accommodation: user.stn_accommodation || 'N/A',
        stn_rental: user.stn_rental || 'N/A',
        stn_gas: user.stn_gas || 'N/A',
      };
      const actor = {
        employee_email: user.email,
        employee_name: user.display_name || user.full_name || user.email,
        manager_email: user.manager_email || '',
        company_name: user.company_name || '',
        work_location_tag: user.work_location_tag || activeEntry.data_center_location || '',
      };

      try {
        await submitShiftMetaToBackend({ clockInMeta, clockOutMeta, profile, actor });
      } catch (error) {
        console.error('submit_shift_meta failed', error);
        toast.warning('Clocked out locally. Backend workbook sync failed for this entry.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-entries'] });
      setCaptureFlow(null);
      setSuccess('out');
      toast.success('Clocked out successfully!');
      setTimeout(() => setSuccess(null), 3000);
    },
  });

  const handleCapture = async (data) => {
    const fallbackTimestamp = data.timestamp || new Date().toISOString();
    let imageMeta = null;

    try {
      imageMeta = await analyzeImageWithBackend(data.file);
    } catch (error) {
      console.error('analyze failed', error);
      toast.warning('OCR analyze failed, using local timestamp fallback.');
    }

    const county = normalizeLocationText(imageMeta?.county);
    const imageDataCenterLocation = normalizeLocationText(imageMeta?.data_center_location || imageMeta?.location_name);
    const mappedByCounty = county ? tagContext.countyToTag.get(county) : '';
    const mappedByCity = imageDataCenterLocation ? tagContext.cityToTag.get(imageDataCenterLocation) : '';
    const detectedTag = normalizeLocationTag(mappedByCounty || mappedByCity || imageMeta?.location_tag);
    if (imageMeta) {
      imageMeta = { ...imageMeta, location_tag: detectedTag || imageMeta.location_tag };
    }

    if (captureFlow?.action === 'in') {
      const directExpectedTag = normalizeLocationTag(
        pickUserField(user, 'work_location_tag', 'workLocationTag', 'location_tag', 'locationTag')
      );
      const expectedDataCenter = pickUserField(user, 'data_center_location', 'dataCenterLocation', 'work_location_name');
      const expectedCityState = pickUserField(user, 'city_state', 'cityState').split(',')[0] || '';
      const expectedByDataCenter = tagContext.cityToTag.get(normalizeLocationText(expectedDataCenter));
      const expectedByCityState = tagContext.cityToTag.get(normalizeLocationText(expectedCityState));
      const expectedByCounty = tagContext.countyToTag.get(normalizeLocationText(expectedDataCenter));
      const expectedTag = normalizeLocationTag(
        directExpectedTag || expectedByDataCenter || expectedByCityState || expectedByCounty
      );
      const isExpectedValid = tagContext.activeCodes.has(expectedTag);

      if (!expectedTag) {
        // Do not block if the user's expected location tag was never configured.
        toast.warning('Your expected work location tag is not configured yet. Clock-in allowed for now.');
      } else if (!isExpectedValid || !detectedTag || detectedTag !== expectedTag) {
        setCaptureFlow(null);
        setLocationMismatch({
          expectedTag: expectedTag || 'NOT SET',
          detectedTag: detectedTag || 'NOT DETECTED',
        });
        return;
      }
    }

    const timestamp = imageMeta?.timestamp || fallbackTimestamp;

    if (captureFlow?.action === 'out' && activeEntry?.time_in) {
      const durationMinutes = getDurationMinutes(activeEntry.time_in, timestamp);
      if (durationMinutes === null) {
        toast.error('Unable to compute shift duration. Please retake/upload clearer photos.');
        return;
      }
      if (durationMinutes < 0) {
        toast.error('Clock-out time appears before clock-in. Please upload the correct clock-out image.');
        return;
      }
      if (durationMinutes > 16 * 60) {
        const missingOcrTimestamp = !imageMeta?.timestamp;
        toast.error(
          missingOcrTimestamp
            ? 'Could not read clock-out timestamp from the image. Re-upload a clearer clock-out photo to avoid inflated hours.'
            : 'Detected shift is longer than 16 hours. Please verify the uploaded images.'
        );
        return;
      }
    }

    if (captureFlow?.action === 'in') {
      clockInMutation.mutate({ ...data, timestamp, imageMeta });
    } else {
      clockOutMutation.mutate({ ...data, timestamp, imageMeta });
    }
  };

  const openCaptureChoice = (action) => {
    setCaptureFlow({ action, mode: null });
  };

  const chooseCaptureMode = (mode) => {
    if (!captureFlow) return;
    setCaptureFlow({ ...captureFlow, mode });
  };

  const closeCapture = () => {
    setCaptureFlow(null);
  };

  if (captureFlow?.mode) {
    return (
      <CameraCapture
        label={captureFlow.action === 'in' ? 'Clock In Photo' : 'Clock Out Photo'}
        captureMode={captureFlow.mode}
        onCapture={handleCapture}
        onCancel={closeCapture}
      />
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Clock In / Out</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-100 text-center">
        <p className="text-5xl font-bold text-slate-900 tabular-nums">
          {format(new Date(), 'hh:mm a')}
        </p>
        {activeEntry && (
          <p className="text-slate-500 text-sm mt-2">
            Clocked in since {formatTime(activeEntry.time_in)}
          </p>
        )}
      </div>

      {success && (
        <div className={`rounded-2xl p-4 flex items-center gap-3 ${
          success === 'in' ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'
        }`}>
          <CheckCircle2 className={`w-5 h-5 ${success === 'in' ? 'text-green-600' : 'text-blue-600'}`} />
          <p className={`font-medium text-sm ${success === 'in' ? 'text-green-800' : 'text-blue-800'}`}>
            {success === 'in' ? 'Successfully clocked in!' : 'Successfully clocked out!'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {!activeEntry ? (
          <Button
            className="w-full py-8 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-lg font-semibold"
            onClick={() => openCaptureChoice('in')}
          >
            <LogIn className="w-6 h-6 mr-3" />
            Clock In
          </Button>
        ) : (
          <Button
            className="w-full py-8 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-lg font-semibold"
            onClick={() => openCaptureChoice('out')}
          >
            <LogOut className="w-6 h-6 mr-3" />
            Clock Out
          </Button>
        )}
      </div>

      {captureFlow && !captureFlow.mode && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
          <p className="text-sm font-semibold text-slate-800">
            {captureFlow.action === 'in' ? 'Clock In' : 'Clock Out'}: choose image source
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => chooseCaptureMode('camera')}
            >
              <Camera className="w-4 h-4 mr-2" />
              Camera
            </Button>
            <Button
              variant="outline"
              className="border-slate-300"
              onClick={() => chooseCaptureMode('upload')}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>
          <Button variant="ghost" className="w-full" onClick={closeCapture}>Cancel</Button>
        </div>
      )}

      <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Location Tag</p>
        <p className="text-sm text-slate-700">
          Data Center Location is auto-detected from your photo and must match your configured work location tag.
        </p>
      </div>

      <AlertDialog
        open={!!locationMismatch}
        onOpenChange={(open) => {
          if (!open) {
            setLocationMismatch(null);
            navigate('/Dashboard');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clock In Blocked: Wrong Work Location</AlertDialogTitle>
            <AlertDialogDescription>
              This image does not match your configured Data Center Location tag.
              Expected: {locationMismatch?.expectedTag}. Detected: {locationMismatch?.detectedTag}.
              Please use a photo from your assigned work location.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setLocationMismatch(null);
                navigate('/Dashboard');
              }}
            >
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}