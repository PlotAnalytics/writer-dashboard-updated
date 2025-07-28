// Utility function to format numbers with appropriate suffixes
export const formatNumber = (value) => {
  if (typeof value !== "number") return "N/A";
  
  const num = Math.round(value); // Round to the nearest integer
  
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  
  return num.toLocaleString(); // Format with commas for smaller numbers
};

export default formatNumber;
