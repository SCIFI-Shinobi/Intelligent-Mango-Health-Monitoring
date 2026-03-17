import { useState, useCallback } from 'react';
import { useAPI } from './useAPI';

export function useTimeRange() {
  const [range, setRange] = useState('24h');
  const { data, loading, error } = useAPI(
    `/sensors/history?range=${range}`
  );

  const handleRangeChange = useCallback((newRange) => {
    if (['24h', '7d', '30d'].includes(newRange)) {
      setRange(newRange);
    }
  }, []);

  return {
    range,
    setRange: handleRangeChange,
    data: data?.data || [],
    loading,
    error
  };
}
