// Date utility functions

export const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export const formatDateForDisplay = (dateString) => {
  return new Date(dateString).toLocaleDateString();
};