import { useState, useEffect } from 'react';

// Hook to fetch subregion data
export const useSubregion = (selectedRegion, today) => {
  const [subregion, setSubregion] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubregion = async () => {
      try {
        const response = await fetch('/data/daily.json');
        const data = await response.json();
        
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