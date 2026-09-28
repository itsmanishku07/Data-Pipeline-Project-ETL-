import React, { createContext, useContext, useState, useEffect } from 'react';

export const TIMEZONE_OPTIONS = [
  { value: 'AUTO', label: 'Auto-detect (System Local)', region: 'Automatic', short: 'Local' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST) • UTC+05:30', region: 'Asia', short: 'IST' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC) • UTC+00:00', region: 'Universal', short: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (New York, Toronto) • UTC-05:00 / -04:00', region: 'Americas', short: 'EST/EDT' },
  { value: 'America/Chicago', label: 'Central Time (Chicago, Dallas) • UTC-06:00 / -05:00', region: 'Americas', short: 'CST/CDT' },
  { value: 'America/Denver', label: 'Mountain Time (Denver, Phoenix) • UTC-07:00 / -06:00', region: 'Americas', short: 'MST/MDT' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (LA, Seattle, SF) • UTC-08:00 / -07:00', region: 'Americas', short: 'PST/PDT' },
  { value: 'Europe/London', label: 'Greenwich Mean Time / BST (London) • UTC+00:00 / +01:00', region: 'Europe', short: 'GMT/BST' },
  { value: 'Europe/Paris', label: 'Central European Time (Paris, Berlin, Amsterdam) • UTC+01:00 / +02:00', region: 'Europe', short: 'CET/CEST' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (Dubai, Abu Dhabi) • UTC+04:00', region: 'Middle East', short: 'GST' },
  { value: 'Asia/Singapore', label: 'Singapore Standard Time (Singapore) • UTC+08:00', region: 'Asia', short: 'SGT' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong Time (HKT) • UTC+08:00', region: 'Asia', short: 'HKT' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (Tokyo) • UTC+09:00', region: 'Asia', short: 'JST' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (Sydney, Melbourne) • UTC+10:00 / +11:00', region: 'Australia', short: 'AEST' },
  { value: 'Pacific/Auckland', label: 'New Zealand Time (Auckland) • UTC+12:00 / +13:00', region: 'Pacific', short: 'NZST' },
  { value: 'America/Sao_Paulo', label: 'Brasilia Time (São Paulo) • UTC-03:00', region: 'Americas', short: 'BRT' },
];

const TimezoneContext = createContext({
  timezone: 'Asia/Kolkata',
  effectiveTimezone: 'Asia/Kolkata',
  setTimezone: () => {},
  is24Hour: true,
  setIs24Hour: () => {},
  currentTime: new Date(),
  formattedCurrentTime: '',
  timezoneShort: 'IST',
  formatTimestamp: () => '',
  formatDateTime: () => '',
  formatDate: () => '',
  formatTime: () => '',
});

export const TimezoneProvider = ({ children }) => {
  // Resolve default timezone: stored -> local system detected -> fallback Asia/Kolkata
  const [timezone, setTimezoneState] = useState(() => {
    try {
      const saved = localStorage.getItem('dataflow_timezone');
      if (saved) return saved;
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return detected || 'Asia/Kolkata';
    } catch {
      return 'Asia/Kolkata';
    }
  });

  const [is24Hour, setIs24HourState] = useState(() => {
    try {
      const saved = localStorage.getItem('dataflow_time_24h');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  // Effective IANA timezone name
  const effectiveTimezone = timezone === 'AUTO' 
    ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata')
    : timezone;

  // Save settings
  const setTimezone = (newTz) => {
    setTimezoneState(newTz);
    try {
      localStorage.setItem('dataflow_timezone', newTz);
    } catch {}
  };

  const setIs24Hour = (val) => {
    setIs24HourState(val);
    try {
      localStorage.setItem('dataflow_time_24h', String(val));
    } catch {}
  };

  // Live 1-second clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Timezone short code lookup or formatter
  const getTimezoneShort = () => {
    const found = TIMEZONE_OPTIONS.find((t) => t.value === timezone);
    if (found && found.short && found.short !== 'Local') return found.short;
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: effectiveTimezone,
        timeZoneName: 'short'
      });
      const parts = formatter.formatToParts(currentTime);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      return tzPart ? tzPart.value : effectiveTimezone.split('/').pop().replace('_', ' ');
    } catch {
      return 'IST';
    }
  };

  const timezoneShort = getTimezoneShort();

  // Format full date & time (e.g. 2026-09-28 20:56:47 IST)
  const formatDateTime = (dateInput, includeTzBadge = true) => {
    if (!dateInput) return '-';
    try {
      const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(d.getTime())) return String(dateInput);

      const dStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: effectiveTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);

      const tStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: effectiveTimezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: !is24Hour,
      }).format(d);

      return includeTzBadge ? `${dStr} ${tStr} ${timezoneShort}` : `${dStr} ${tStr}`;
    } catch {
      return String(dateInput);
    }
  };

  // Format only time (e.g. 20:56:47)
  const formatTime = (dateInput = currentTime, includeTz = false) => {
    try {
      const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(d.getTime())) return '-';
      const tStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: effectiveTimezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: !is24Hour,
      }).format(d);
      return includeTz ? `${tStr} ${timezoneShort}` : tStr;
    } catch {
      return '--:--:--';
    }
  };

  // Format only date (e.g. 2026-09-28)
  const formatDate = (dateInput) => {
    if (!dateInput) return '-';
    try {
      const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(d.getTime())) return String(dateInput);
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: effectiveTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    } catch {
      return String(dateInput);
    }
  };

  // Format ISO / Audit timestamp (e.g. 2026-09-28 20:56:47)
  const formatTimestamp = (dateInput) => {
    return formatDateTime(dateInput, false);
  };

  const formattedCurrentTime = formatDateTime(currentTime, true);

  return (
    <TimezoneContext.Provider
      value={{
        timezone,
        effectiveTimezone,
        setTimezone,
        is24Hour,
        setIs24Hour,
        currentTime,
        formattedCurrentTime,
        timezoneShort,
        formatTimestamp,
        formatDateTime,
        formatDate,
        formatTime,
      }}
    >
      {children}
    </TimezoneContext.Provider>
  );
};

export const useTimezone = () => {
  return useContext(TimezoneContext);
};
