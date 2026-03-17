import { useState, useCallback, useMemo } from 'react';
import { useAPI } from './useAPI';

const EMPTY_ARRAY = [];

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

  const historyData = useMemo(() => data?.data || EMPTY_ARRAY, [data]);

  return {
    range,
    setRange: handleRangeChange,
    data: historyData,
    loading,
    error
  };
}
