import { useState, useEffect } from 'react';
import { loadDailyBirdData } from './DailyBirdUtils';

// Hook to fetch subregion data
// Uses loadDailyBirdData from DailyBirdUtils so the parsed daily.json is
// fetched once and cached module-level (busted via invalidateDailyBirdCache).
// eslint-disable-next-line react-refresh/only-export-components
export const useSubregion = (selectedRegion, today) => {
  const [subregion, setSubregion] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubregion = async () => {
      try {
        const data = await loadDailyBirdData();

        // Find today's entry for the selected region
        const todayEntry = data.find(entry =>
          entry.date === today && entry.region === selectedRegion
        );

        if (todayEntry) {
          setSubregion(todayEntry.subregion);
        }
      } catch (error) {
        console.error('Error fetching subregion:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubregion();
  }, [selectedRegion, today]);

  return { subregion, loading };
};

// Component to display subregion
export const SubregionDisplay = ({ selectedRegion, today }) => {
  const { subregion, loading } = useSubregion(selectedRegion, today);

  if (loading) return <span>loading...</span>;
  return subregion;
};
